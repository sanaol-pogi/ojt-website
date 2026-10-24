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
    /**
     * signIn — fires immediately after Google authenticates the user.
     * Reads the callbackUrl from account.state to detect intent, then
     * creates the correct DB record BEFORE jwt() runs so the token gets
     * the right role on the very first request.
     */
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) return true

      try {
        let intent: "teacher" | "student" = "student"

        // NextAuth encodes callbackUrl into the OAuth state as JSON
        if (account.state) {
          try {
            const parsed = JSON.parse(account.state as string)
            const cbUrl  = (parsed?.callbackUrl ?? "") as string
            if (cbUrl.includes("finalize-teacher")) intent = "teacher"
          } catch { /* state was not JSON — default to student */ }
        }

        const email = user.email
        const name  = user.name  ?? email.split("@")[0]
        const image = user.image ?? null

        if (intent === "teacher") {
          // Remove any student record for this email, then upsert teacher
          await prisma.student.deleteMany({ where: { email } })
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
          // Remove any teacher record for this email, then upsert student
          await prisma.teacher.deleteMany({ where: { email } })
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
        console.error("[signIn] DB error:", err)
        return true // don't block sign-in even if DB fails
      }
    },

    /**
     * jwt — called on every request that needs a session token.
     * We only hit the DB on:
     *   1. First sign-in (user object is present)
     *   2. Role is unresolved ("pending" or missing)
     * All other requests return the cached token immediately — no DB hit.
     */
    async jwt({ token, user, trigger, session }) {
      // Handle session.update() calls (e.g. profile picture/name changes)
      if (trigger === "update" && session) {
        if (session.profilePicture !== undefined) token.profilePicture = session.profilePicture
        if (session.name          !== undefined) token.name           = session.name
        return token
      }

      const email = (user?.email ?? token.email) as string | undefined
      if (!email) return token

      // Cache hit: role is resolved and this is not the initial sign-in
      if (token.role && token.role !== "pending" && token.userId && !user) return token

      // DB lookup: runs only on first sign-in or when role is unresolved
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

        // No DB record yet
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
