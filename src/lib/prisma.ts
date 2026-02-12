import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool } from '@neondatabase/serverless'
import { authorizationMiddleware } from './middleware/authorization'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// Create Neon connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaNeon(pool)

// Create Prisma client with adapter
export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter })

// Apply authorization middleware
prisma.$use(authorizationMiddleware)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
