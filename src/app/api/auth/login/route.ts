/**
 * POST /api/auth/login
 * Clinic authentication with bcrypt password hashing
 * Clinic credentials stored in environment variables
 * Format: CLINIC_CREDENTIALS={"clinic-id": "hashed_password", ...}
 * 
 * To hash a password for the env var:
 * node -e "const bcrypt=require('bcryptjs'); console.log(bcrypt.hashSync('your-password', 12))"
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, createJWT } from '@/lib/auth/auth-service'
import { logger } from '@/lib/logger'

// Parse clinic credentials from env
// Format: CLINIC_CREDENTIALS={"clinic-001": "$2a$12$...", "clinic-002": "$2a$12$..."}
const getClinicCredentials = (): Record<string, string> => {
  try {
    const creds = process.env.CLINIC_CREDENTIALS
    if (!creds) {
      logger.error('CLINIC_CREDENTIALS not set')
      return {}
    }
    return JSON.parse(creds)
  } catch {
    logger.error('Invalid CLINIC_CREDENTIALS format')
    return {}
  }
}

export async function POST(request: NextRequest) {
  try {
    const { clinicId, password } = await request.json()
    const normalizedClinicId = String(clinicId || '').trim()

    if (!normalizedClinicId || !password) {
      return NextResponse.json(
        { error: 'Clinic ID and password required' },
        { status: 400 }
      )
    }

    const credentials = getClinicCredentials()
    const storedHash = credentials[normalizedClinicId]
    
    if (!storedHash) {
      logger.warn('Login attempt for unknown clinic', { clinicId: normalizedClinicId })
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }
    
    // Verify password using bcrypt (timing-safe comparison)
    const isValid = await verifyPassword(password, storedHash)
    
    if (!isValid) {
      logger.warn('Failed login attempt', { clinicId: normalizedClinicId })
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Credentials can be an alias (e.g. demo-clinic), while dashboard expects DB clinic UUID.
    // Resolve to a real clinic ID for routing/session.
    let dashboardClinicId = normalizedClinicId

    const clinicById = await prisma.clinic.findUnique({
      where: { id: normalizedClinicId },
      select: { id: true, name: true }
    })

    if (!clinicById) {
      const fallbackClinic = await prisma.clinic.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true }
      })

      if (!fallbackClinic) {
        return NextResponse.json(
          { error: 'No active clinic found in database' },
          { status: 500 }
        )
      }

      dashboardClinicId = fallbackClinic.id
    }

    // Create JWT token
    const token = createJWT({
      clinicId: dashboardClinicId,
      type: 'clinic'
    })

    // Set session cookie with JWT
    const response = NextResponse.json({
      success: true,
      clinicId: dashboardClinicId,
      credentialClinicId: normalizedClinicId,
      clinicName: clinicById?.name
    })
    
    // Set secure HTTP-only cookie (expires in 8 hours)
    response.cookies.set('clinic_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/'
    })

    logger.info('Clinic login successful', { clinicId: dashboardClinicId })
    return response

  } catch (error) {
    logger.error('Login error', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
