import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
import { authorizationMiddleware } from './middleware/authorization'

// Configure Neon to use ws (WebSocket) for Node.js
neonConfig.webSocketConstructor = ws

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// Create Prisma client with Neon adapter
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter })

// Apply authorization middleware when supported by the Prisma client runtime
if ("$use" in prisma && typeof prisma.$use === "function") {
	prisma.$use(authorizationMiddleware)
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
