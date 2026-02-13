/**
 * POST /api/patient/login
 * Patient authentication via phone number
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json()

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number required' },
        { status: 400 }
      )
    }

    // Format phone number
    const formattedPhone = phoneNumber.startsWith('+') 
      ? phoneNumber 
      : `+${phoneNumber}`

    // Find patient by phone
    const patient = await prisma.patient.findUnique({
      where: { phoneNumber: formattedPhone },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phoneNumber: true
      }
    })

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      )
    }

    // Return patient info (in production, you'd generate a JWT token)
    return NextResponse.json({
      patientId: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      phoneNumber: patient.phoneNumber
    })

  } catch (error) {
    console.error('Patient login error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}
