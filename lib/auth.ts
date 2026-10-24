import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { cookies } from "next/headers"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { prompt: "select_account" } },
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required")
        }
        const teacher = await prisma.teacher.findUnique({ where: { email: credentials.email } })
        if (!teacher)          throw new Error("No teacher account found with this email")
        if (!teacher.password) throw new Error("This account requires Google Sign-In")
        const valid = await bcrypt.compare(credentials.password, teacher.password)
        if (!valid) throw new Error("Incorrect password")
        return {
          id: teacher.id, email: teacher.email, name: teacher.name,
          image: teacher.profilePicture ?? null,
        }
      },
    }),
  ],

  callbacks: {
    /**
     * signIn callback — runs server-side right after Google returns the code.
     * This is the ONLY reliable place to read cookies from the OAuth round-trip
     * and create/assign the DB record for the correct role.
     *
     * We read `signin_intent` (set by POST /api/auth/set-intent before OAuth started)
     * to know whether this Google account should be a teacher or student.
     */
    async signIn({ user, account }) {
      // Only intercept Google OAuth — leave credentials provider alone
      if (account?.provider !== "google") return true
      if (!user.email) return false

      try {
        // Read intent cookie — set by /api/auth/set-intent before the OAuth redirect
        const cookieStore = await cookies()
        const intent = cookieStore.get("signin_intent")?.value === "teacher" ? "teacher" : "student"

        const email = user.email
        const name  = user.name ?? email.split("@")[0]
        const image = user.image ?? null

        if (intent === "teacher") {
          // Block if already a student
          const existingStudent = await prisma.student.findUnique({ where: { email }, select: { id: true } })
          if (existingStudent) return "/login?error=AlreadyStudent"

          // Upsert teacher record
          const existing = await prisma.teacher.findUnique({ where: { email } })
          if (!existing) {
            await prisma.teacher.create({
              data: {
                email, name,
                teacherId:      `TCH-${Date.now()}`,
                role:           "teacher",
                accessLevel:    "teacher",
                profilePicture: image,
              },
            })
          } else if (!existing.profilePicture && image) {
            await prisma.teacher.update({ where: { id: existing.id }, data: { profilePicture: image } })
          }
        } else {
          // Block if already a teacher
          const existingTeacher = await prisma.teacher.findUnique({ where: { email }, select: { id: true } })
          if (existingTeacher) return "/login?error=AlreadyTeacher"

          // Upsert student record
          const existing = await prisma.student.findUnique({ where: { email } })
          if (!existing) {
            await prisma.student.create({
              data: { email, name, studentId: `STU-${Date.now()}`, profilePicture: image },
            })
          } else if (!existing.profilePicture && image) {
            await prisma.student.update({ where: { id: existing.id }, data: { profilePicture: image } })
          }
        }

        return true
      } catch (err) {
        console.error("signIn callback error:", err)
        return "/login?error=DatabaseError"
      }
    },

    /**
     * redirect callback — called after signIn to determine where to send the user.
     * We read the intent cookie here too to send teacher → /teacher/dashboard.
     */
    async redirect({ url, baseUrl }) {
      // If NextAuth is redirecting to an error, honour it
      if (url.includes("/login?error=")) return url
      if (url.startsWith(baseUrl)) return url

      try {
        const cookieStore = await cookies()
        const intent = cookieStore.get("signin_intent")?.value
        if (intent === "teacher") return `${baseUrl}/teacher/dashboard`
        return `${baseUrl}/dashboard`
      } catch {
        return `${baseUrl}/dashboard`
      }
    },

    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session) {
        if (session.profilePicture !== undefined) token.profilePicture = session.profilePicture
        if (session.name          !== undefined) token.name           = session.name
        return token
      }

      const email = (user?.email ?? token.email) as string | undefined
      if (!email) return token

      // Skip DB lookup on every request — only look up when user just signed in
      if (token.userId && !user) return token

      try {
        const teacher = await prisma.teacher.findUnique({
          where:  { email },
          select: { id: true, teacherId: true, name: true, profilePicture: true },
        })
        if (teacher) {
          token.role           = "teacher"
          token.userId         = teacher.id
          token.teacherId      = teacher.teacherId
          token.studentId      = undefined
          token.sub            = teacher.id
          token.name           = teacher.name
          token.profilePicture = teacher.profilePicture ?? token.profilePicture ?? undefined
          return token
        }

        const student = await prisma.student.findUnique({
          where:  { email },
          select: { id: true, studentId: true, name: true, profilePicture: true },
        })
        if (student) {
          token.role           = "student"
          token.userId         = student.id
          token.studentId      = student.studentId
          token.teacherId      = undefined
          token.sub            = student.id
          token.name           = student.name
          token.profilePicture = student.profilePicture ?? token.profilePicture ?? undefined
          return token
        }

        token.role = "pending"
      } catch (err) {
        console.error("jwt error:", err)
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id             = (token.userId as string) ?? token.sub ?? ""
        session.user.role           = (token.role   as string) ?? "student"
        session.user.studentId      = token.studentId  as string | undefined
        session.user.teacherId      = token.teacherId  as string | undefined
        if (token.name)           session.user.name           = token.name           as string
        if (token.profilePicture) session.user.profilePicture = token.profilePicture as string
      }
      return session
    },
  },

  pages:   { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  secret:  process.env.NEXTAUTH_SECRET,
}
