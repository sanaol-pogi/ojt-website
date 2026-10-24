import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let prisma: PrismaClient

// Use DATABASE_URL but strip pgbouncer=true if present — the PrismaPg adapter
// uses the pg driver directly and doesn't need/want pgbouncer mode.
// Supabase provides two URLs: the pooler (port 6543, pgbouncer) and the
// session-mode pooler (port 5432). We use port 5432 for direct compatibility.
const rawUrl = process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy'
const connectionString = rawUrl
  .replace('&pgbouncer=true', '')
  .replace('?pgbouncer=true&', '?')
  .replace('?pgbouncer=true', '')
  // Switch port 6543 (transaction pooler) to 5432 (session pooler) for Supabase
  .replace(':6543/', ':5432/')

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
})
const adapter = new PrismaPg(pool)

prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query'] : [],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export { prisma }
