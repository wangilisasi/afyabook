/**
 * Health Check Endpoint
 * GET /api/health
 * 
 * Returns system health status including:
 * - API status
 * - Database connectivity
 * - External service status (Twilio)
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isTwilioConfigured } from '@/lib/sms/sms-service'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks = {
    api: true,
    database: false,
    twilio: false
  }

  let status = 200
  let overallStatus = 'healthy'

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = true
  } catch (error) {
    checks.database = false
    status = 503
    overallStatus = 'degraded'
    logger.error('Health check: Database connection failed', {
      error: error instanceof Error ? error.message : String(error)
    })
  }

  // Check Twilio configuration
  checks.twilio = isTwilioConfigured()
  if (!checks.twilio) {
    logger.warn('Health check: Twilio not configured')
  }

  // If critical services are down, mark as unhealthy
  if (!checks.database) {
    overallStatus = 'unhealthy'
  }

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    checks,
    uptime: process.uptime()
  }

  return NextResponse.json(response, { status })
}
