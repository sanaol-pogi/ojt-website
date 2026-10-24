import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"

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
    async signIn({ user, account }) {
      // For Google OAuth: create the correct DB record RIGHT HERE based on
      // which finalize route is in the callbackUrl (encoded in account.state).
      // This runs before jwt(), so the token gets the right role immediately.
      if (account?.provider !== "google" || !user.email) return true

      try {
        // NextAuth stores callbackUrl inside the state param as JSON
        let intent: "teacher" | "student" = "student"
        if (account.state) {
          try {
            const state = JSON.parse(account.state as string)
            const cbUrl = state?.callbackUrl ?? ""
            if (cbUrl.includes("finalize-teacher")) intent = "teacher"
          } catch { /* state wasn't JSON, default to student */ }
        }

        const email = user.email
        const name  = user.name  ?? email.split("@")[0]
        const image = user.image ?? null

        console.log(`[signIn] email=${email} intent=${intent} state=${account.state}`)

        if (intent === "teacher") {
          // Switch to teacher: remove student record, upsert teacher record
          await prisma.student.deleteMany({ where: { email } })
          const existing = await prisma.teacher.findUnique({ where: { email } })
          if (!existing) {
            await prisma.teacher.create({
              data: {
                email, name,
                teacherId:   `TCH-${Date.now()}`,
                role:        "teacher",
                accessLevel: "teacher",
                profilePicture: image,
              },
            })
            console.log(`[signIn] created teacher for ${email}`)
          }
        } else {
          // Switch to student: remove teacher record, upsert student record
          await prisma.teacher.deleteMany({ where: { email } })
          const existing = await prisma.student.findUnique({ where: { email } })
          if (!existing) {
            await prisma.student.create({
              data: { email, name, studentId: `STU-${Date.now()}`, profilePicture: image },
            })
            console.log(`[signIn] created student for ${email}`)
          }
        }
        return true
      } catch (err) {
        console.error("[signIn] error:", err)
        return true // don't block sign-in even if DB fails
      }
    },

    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session) {
        if (session.profilePicture !== undefined) token.profilePicture = session.profilePicture
        if (session.name          !== undefined) token.name           = session.name
        if (session.refreshRole) {
          // Force re-read from DB on next request
          token.userId = undefined
          token.role   = "pending"
        }
        return token
      }

      const email = (user?.email ?? token.email) as string | undefined
      if (!email) return token

      // Re-read from DB when: first sign-in (user present) OR role is unresolved
      if (token.role && token.role !== "pending" && token.userId && !user) return token

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

        token.role   = "pending"
        token.userId = undefined
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
