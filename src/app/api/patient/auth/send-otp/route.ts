/**
 * POST /api/patient/auth/send-otp
 * Send OTP to patient for authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendPatientOTP } from '@/lib/auth/auth-service'

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json()

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Validate phone number format (E.164)
    const phoneRegex = /^\+[1-9]\d{1,14}$/
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`
    
    if (!phoneRegex.test(formattedPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Use E.164 format (+255XXXXXXXXX)' },
        { status: 400 }
      )
    }

    // Send OTP
    const result = await sendPatientOTP(formattedPhone)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === 'Patient not found' ? 404 : 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully. Check your SMS.',
      expiresIn: '10 minutes'
    })

  } catch (error) {
    console.error('Send OTP error:', error)
    return NextResponse.json(
      { error: 'Failed to send OTP' },
      { status: 500 }
    )
  }
}
