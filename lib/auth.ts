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
    // signIn: just allow everyone through — record creation happens in /api/auth/finalize
    async signIn({ user }) {
      return true
    },

    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session) {
        if (session.profilePicture !== undefined) token.profilePicture = session.profilePicture
        if (session.name          !== undefined) token.name           = session.name
        return token
      }

      const email = (user?.email ?? token.email) as string | undefined
      if (!email) return token

      // Avoid re-fetching on every request — only look up DB when user just signed in
      // token.userId is set after first lookup; skip DB on subsequent requests
      if (token.userId && !user) return token

      try {
        // Teacher takes priority — if a Teacher record exists, they are a teacher
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

        // No DB record yet — will be created by /api/auth/finalize
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
  // useSecureCookies: true breaks local dev (http://localhost) because the browser
  // won't send Secure cookies over HTTP, so the session is lost after the OAuth
  // callback and NextAuth returns OAuthCallback error.
  // Let NextAuth auto-detect: it sets Secure only when NEXTAUTH_URL starts with https://
  useSecureCookies: process.env.NEXTAUTH_URL?.startsWith('https://') ?? false,
}
