/**
 * POST /api/patient/auth/verify
 * Verify OTP and authenticate patient
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyPatientOTP } from '@/lib/auth/auth-service'
import { validateBody } from '@/lib/validation/helpers'
import { VerifyOTPSchema } from '@/lib/validation/schemas'

export async function POST(request: NextRequest) {
  try {
    // Validate request body using Zod
    const validation = await validateBody(request, VerifyOTPSchema)
    
    if (!validation.success) {
      return validation.error
    }

    const { phoneNumber, otp } = validation.data

    // Verify OTP
    const result = await verifyPatientOTP(phoneNumber, otp)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      )
    }

    // Set JWT token in HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      patient: result.patient,
      message: 'Authentication successful'
    })

    // Set secure cookie with JWT
    response.cookies.set('patient_session', result.token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/'
    })

    return response

  } catch (error) {
    console.error('Verify OTP error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
