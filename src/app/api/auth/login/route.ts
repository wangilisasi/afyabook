/**
 * POST /api/auth/login
 * Simple clinic authentication
 * Clinic credentials stored in environment variables
 * Format: CLINIC_CREDENTIALS={"clinic-id": "password", ...}
 */

import { NextRequest, NextResponse } from 'next/server'

// Parse clinic credentials from env
// Format: CLINIC_CREDENTIALS={"clinic-001": "password123", "clinic-002": "password456"}
const getClinicCredentials = (): Record<string, string> => {
  try {
    const creds = process.env.CLINIC_CREDENTIALS
    if (!creds) return {}
    return JSON.parse(creds)
  } catch {
    console.error('Invalid CLINIC_CREDENTIALS format')
    return {}
  }
}

export async function POST(request: NextRequest) {
  try {
    const { clinicId, password } = await request.json()

    if (!clinicId || !password) {
      return NextResponse.json(
        { error: 'Clinic ID and password required' },
        { status: 400 }
      )
    }

    const credentials = getClinicCredentials()
    
    // Check if clinic exists and password matches
    if (credentials[clinicId] && credentials[clinicId] === password) {
      // Set a simple session cookie
      const response = NextResponse.json({ success: true, clinicId })
      
      // Set cookie with clinic ID (expires in 8 hours)
      response.cookies.set('clinic_session', clinicId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 8 // 8 hours
      })

      return response
    }

    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    )

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
