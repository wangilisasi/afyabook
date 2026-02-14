/**
 * POST /api/patient/auth/verify
 * Verify OTP and authenticate patient
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyPatientOTP } from '@/lib/auth/auth-service'

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, otp } = await request.json()

    if (!phoneNumber || !otp) {
      return NextResponse.json(
        { error: 'Phone number and OTP are required' },
        { status: 400 }
      )
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: 'OTP must be 6 digits' },
        { status: 400 }
      )
    }

    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`

    // Verify OTP
    const result = await verifyPatientOTP(formattedPhone, otp)

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
