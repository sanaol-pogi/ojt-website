import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

/**
 * Supabase free tier = 15 direct connections max.
 * Vercel serverless = potentially hundreds of concurrent function instances.
 *
 * Solution: Supabase Transaction Pooler (port 6543, pgbouncer mode).
 * PgBouncer sits in front of Postgres and multiplexes thousands of app
 * connections into the 15 allowed DB connections — handles 100+ users easily.
 *
 * Requirements for PrismaPg + pgbouncer:
 *  - Port 6543 (transaction pooler, NOT session pooler on 5432)
 *  - pgbouncer=true in the URL (disables prepared statements)
 *  - pool.max = 1 per serverless function instance (pgbouncer handles the rest)
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const rawUrl = process.env.DATABASE_URL ?? 'postgresql://dummy:dummy@localhost:5432/dummy'

// Build the correct Supabase transaction pooler URL
function buildConnectionString(url: string): string {
  // Not a Supabase URL — use as-is (local dev)
  if (!url.includes('supabase.com')) return url

  // Parse and rebuild with correct pooler settings
  // Switch to transaction pooler port
  let conn = url
    .replace(/[?&]supa=base-pooler\.x/g, '')   // remove Supabase-added junk
    .replace(/[?&]pgbouncer=true/g, '')          // remove existing pgbouncer flag
    .replace('pooler.supabase.com:5432/', 'pooler.supabase.com:6543/')  // session → transaction pooler

  // Add pgbouncer=true — required for transaction pooler mode
  conn += conn.includes('?') ? '&pgbouncer=true' : '?pgbouncer=true'
  return conn
}

const connectionString = buildConnectionString(rawUrl)

// In serverless: max=1 per instance — pgbouncer multiplexes everything.
// In dev: max=3 to allow hot-reload without exhausting connections.
const pool = new Pool({
  connectionString,
  max: process.env.NODE_ENV === 'production' ? 1 : 3,
})

const adapter = new PrismaPg(pool)

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })

// Only cache in dev — in production each serverless instance is isolated anyway
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
