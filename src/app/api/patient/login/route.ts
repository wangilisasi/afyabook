/**
 * POST /api/patient/login
 * 
 * DEPRECATED: This endpoint is deprecated for security reasons.
 * Please use the new OTP-based authentication flow:
 * 1. POST /api/patient/auth/send-otp - Request OTP
 * 2. POST /api/patient/auth/verify - Verify OTP and get session
 * 
 * This endpoint now returns a deprecation warning and redirects to the new flow.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'This authentication method is deprecated for security reasons.',
      message: 'Please use the new secure OTP-based authentication.',
      documentation: {
        step1: 'POST /api/patient/auth/send-otp with { phoneNumber: "+255..." }',
        step2: 'POST /api/patient/auth/verify with { phoneNumber: "+255...", otp: "123456" }'
      },
      deprecated: true
    },
    { status: 410 }
  )
}
