import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"

/**
 * Extract the intent ('teacher' | 'student') from the callbackUrl.
 *
 * The login page passes callbackUrl='/teacher/dashboard' or '/dashboard'.
 * We detect teacher intent simply by checking for '/teacher' in the URL.
 * This avoids any cookie/header access inside NextAuth callbacks, which is
 * unsupported and throws in Next.js 15.
 */
function intentFromCallbackUrl(callbackUrl?: string | null): "teacher" | "student" {
  if (!callbackUrl) return "student"
  return callbackUrl.includes("/teacher") ? "teacher" : "student"
}

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
     * signIn callback — fires immediately after Google returns the OAuth code,
     * before the JWT is created. This is where we create the DB record for the
     * correct role so the jwt() callback finds it right away.
     *
     * The intent is read from the callbackUrl that the login page set:
     *   /teacher/dashboard → teacher
     *   /dashboard          → student
     */
    async signIn({ user, account, profile }) {
      // Credentials provider: always allow (already validated in authorize())
      if (account?.provider !== "google") return true
      if (!user.email) return false

      // NextAuth passes the callbackUrl through account.state in some versions;
      // fall back to checking user.image/profile if needed. The safest is to
      // read it from the token's `state` param that Google echoes back.
      // NextAuth v4 puts the callbackUrl inside account.state as a JSON string.
      let intent: "teacher" | "student" = "student"
      try {
        if (account.state) {
          // NextAuth encodes state as JSON: { callbackUrl, csrfToken }
          const state = JSON.parse(account.state as string)
          intent = intentFromCallbackUrl(state?.callbackUrl)
        }
      } catch {
        // state wasn't JSON — fall back to student
        intent = "student"
      }

      const email = user.email
      const name  = user.name ?? email.split("@")[0]
      const image = user.image ?? null

      try {
        if (intent === "teacher") {
          // Block if already registered as a student
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
          // Block if already registered as a teacher
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

    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session) {
        if (session.profilePicture !== undefined) token.profilePicture = session.profilePicture
        if (session.name          !== undefined) token.name           = session.name
        return token
      }

      const email = (user?.email ?? token.email) as string | undefined
      if (!email) return token

      // Skip DB lookup on subsequent requests — only look up when user just signed in
      if (token.userId && !user) return token

      try {
        // Teacher record takes priority
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
