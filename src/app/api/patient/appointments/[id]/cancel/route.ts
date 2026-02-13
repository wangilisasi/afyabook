/**
 * PATCH /api/patient/appointments/[id]/cancel
 * Patient cancels their own appointment
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
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

    // Find appointment and verify ownership
    const appointment = await prisma.appointment.findFirst({
      where: {
        id,
        patientId,
        status: {
          in: ['BOOKED', 'CONFIRMED']
        }
      },
      include: {
        slot: {
          select: {
            slotDate: true,
            startTime: true
          }
        }
      }
    })

    if (!appointment) {
      return NextResponse.json(
        { error: 'Appointment not found or cannot be cancelled' },
        { status: 404 }
      )
    }

    // Check if appointment is in the past
    const appointmentDateTime = new Date(`${appointment.slot.slotDate.toISOString().split('T')[0]}T${appointment.slot.startTime}`)
    if (appointmentDateTime < new Date()) {
      return NextResponse.json(
        { error: 'Cannot cancel past appointments' },
        { status: 400 }
      )
    }

    // Cancel the appointment
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: 'Cancelled by patient via portal'
      }
    })

    // Make slot available again
    await prisma.appointmentSlot.update({
      where: { id: appointment.slotId },
      data: { isAvailable: true }
    })

    return NextResponse.json({
      success: true,
      message: 'Appointment cancelled successfully',
      appointment: updated
    })

  } catch (error) {
    console.error('Cancel appointment error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel appointment' },
      { status: 500 }
    )
  }
}
