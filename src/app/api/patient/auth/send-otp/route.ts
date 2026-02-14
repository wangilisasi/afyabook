/**
 * POST /api/patient/auth/send-otp
 * Send OTP to patient for authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendPatientOTP } from '@/lib/auth/auth-service'
import { validateBody } from '@/lib/validation/helpers'
import { SendOTPSchema } from '@/lib/validation/schemas'

export async function POST(request: NextRequest) {
  try {
    // Validate request body using Zod
    const validation = await validateBody(request, SendOTPSchema)
    
    if (!validation.success) {
      return validation.error
    }

    const { phoneNumber } = validation.data

    // Send OTP
    const result = await sendPatientOTP(phoneNumber)

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
