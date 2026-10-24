import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// ── Singleton prisma client ──────────────────────────────────────────────────
// In serverless (Vercel), each cold start creates a new Pool.
// In development, we reuse via globalThis to avoid too many connections.

const rawUrl = process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy'

// Strip pgbouncer params — incompatible with the pg driver adapter
const connectionString = rawUrl
  .replace(/[?&]pgbouncer=true/g, '')
  .replace(/[?&]supa=base-pooler\.x/g, '')
  .replace(':6543/', ':5432/')

// Always disable SSL cert verification — Supabase uses a self-signed cert
// in its connection chain that Node.js rejects without this setting
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
