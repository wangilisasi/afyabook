/**
 * Authentication Middleware
 * Validates JWT tokens for protected routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth/auth-service'

export interface AuthContext {
  userId: string
  userType: 'patient' | 'clinic'
  phoneNumber?: string
  clinicId?: string
}

// JWT payload types
interface PatientJWTPayload {
  patientId: string
  phoneNumber: string
  type: 'patient'
}

interface ClinicJWTPayload {
  clinicId: string
  type: 'clinic'
}

/**
 * Extract and verify JWT token from request cookies
 */
export function getAuthFromRequest(request: NextRequest): AuthContext | null {
  // Check for patient session
  const patientToken = request.cookies.get('patient_session')?.value
  if (patientToken) {
    const decoded = verifyJWT(patientToken)
    if (decoded && 'patientId' in decoded) {
      const payload = decoded as PatientJWTPayload
      return {
        userId: payload.patientId,
        userType: 'patient',
        phoneNumber: payload.phoneNumber
      }
    }
  }

  // Check for clinic session
  const clinicToken = request.cookies.get('clinic_session')?.value
  if (clinicToken) {
    const decoded = verifyJWT(clinicToken)
    if (decoded && 'clinicId' in decoded) {
      const payload = decoded as ClinicJWTPayload
      return {
        userId: payload.clinicId,
        userType: 'clinic',
        clinicId: payload.clinicId
      }
    }
  }

  return null
}

/**
 * Middleware to protect API routes
 * Usage: export const middleware = withAuth(handler, options)
 */
export function withAuth(
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>,
  options: { requiredType?: 'patient' | 'clinic' } = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const auth = getAuthFromRequest(request)

    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login.' },
        { status: 401 }
      )
    }

    if (options.requiredType && auth.userType !== options.requiredType) {
      return NextResponse.json(
        { error: `Access denied. ${options.requiredType} access required.` },
        { status: 403 }
      )
    }

    return handler(request, auth)
  }
}

/**
 * Check if user is authenticated (for use in route handlers)
 */
export function requireAuth(
  request: NextRequest,
  options: { requiredType?: 'patient' | 'clinic' } = {}
): { success: true; auth: AuthContext } | { success: false; response: NextResponse } {
  const auth = getAuthFromRequest(request)

  if (!auth) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Unauthorized. Please login.' },
        { status: 401 }
      )
    }
  }

  if (options.requiredType && auth.userType !== options.requiredType) {
    return {
      success: false,
      response: NextResponse.json(
        { error: `Access denied. ${options.requiredType} access required.` },
        { status: 403 }
      )
    }
  }

  return { success: true, auth }
}
