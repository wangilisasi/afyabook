/**
 * GET /api/patient/appointments
 * Returns all appointments for logged-in patient
 * Requires patient_session cookie
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    // Get patient ID from cookie
    const cookieStore = await cookies()
    const patientSession = cookieStore.get('patient_session')

    if (!patientSession) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const patientId = patientSession.value

    // Get patient's appointments
    const appointments = await prisma.appointment.findMany({
      where: {
        patientId,
        status: {
          in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW']
        }
      },
      include: {
        slot: {
          select: {
            slotDate: true,
            startTime: true,
            endTime: true,
            staff: {
              select: {
                firstName: true,
                lastName: true,
                role: true
              }
            }
          }
        },
        clinic: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            address: true
          }
        }
      },
      orderBy: {
        slot: {
          slotDate: 'desc'
        }
      }
    })

    // Separate upcoming and past
    const now = new Date()
    const upcoming = appointments.filter(apt => 
      new Date(apt.slot.slotDate) >= now && 
      !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(apt.status)
    )
    const past = appointments.filter(apt => 
      new Date(apt.slot.slotDate) < now || 
      ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(apt.status)
    )

    return NextResponse.json({
      patientId,
      upcoming,
      past,
      total: appointments.length
    })

  } catch (error) {
    console.error('Patient appointments error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch appointments' },
      { status: 500 }
    )
  }
}
