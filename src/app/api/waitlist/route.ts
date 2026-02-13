/**
 * Waitlist API Routes
 * 
 * POST /api/waitlist - Add patient to waitlist
 * GET /api/waitlist?clinicId=xxx&date=xxx - Get waitlist for clinic
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

// POST /api/waitlist - Add to waitlist
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      patientId,
      clinicId,
      preferredDate,
      preferredTimeSlot,
      appointmentType,
      staffId,
      priority,
      notes
    } = body

    // Validate required fields
    if (!patientId || !clinicId || !preferredDate) {
      return NextResponse.json(
        { error: 'Patient ID, clinic ID, and preferred date are required' },
        { status: 400 }
      )
    }

    // Check if patient already has an appointment on this date
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        patientId,
        clinicId,
        slot: {
          slotDate: {
            gte: startOfDay(new Date(preferredDate)),
            lte: endOfDay(new Date(preferredDate))
          }
        },
        status: {
          in: ['BOOKED', 'CONFIRMED']
        }
      }
    })

    if (existingAppointment) {
      return NextResponse.json(
        { error: 'Patient already has an appointment on this date' },
        { status: 409 }
      )
    }

    // Check if patient is already on waitlist for this date
    const existingWaitlist = await prisma.waitlist.findFirst({
      where: {
        patientId,
        clinicId,
        preferredDate: {
          gte: startOfDay(new Date(preferredDate)),
          lte: endOfDay(new Date(preferredDate))
        },
        status: 'WAITING'
      }
    })

    if (existingWaitlist) {
      return NextResponse.json(
        { error: 'Patient is already on the waitlist for this date' },
        { status: 409 }
      )
    }

    // Create waitlist entry
    const waitlistEntry = await prisma.waitlist.create({
      data: {
        patientId,
        clinicId,
        preferredDate: new Date(preferredDate),
        preferredTimeSlot,
        appointmentType: appointmentType || 'general',
        staffId,
        priority: priority || 0,
        notes,
        status: 'WAITING'
      },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            phoneNumber: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      waitlist: waitlistEntry,
      message: 'Added to waitlist successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Waitlist creation error:', error)
    return NextResponse.json(
      { error: 'Failed to add to waitlist' },
      { status: 500 }
    )
  }
}

// GET /api/waitlist - Get waitlist
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const clinicId = searchParams.get('clinicId')
    const date = searchParams.get('date')
    const status = searchParams.get('status') || 'WAITING'

    if (!clinicId) {
      return NextResponse.json(
        { error: 'Clinic ID is required' },
        { status: 400 }
      )
    }

    const whereClause: any = {
      clinicId,
      status: status as any
    }

    if (date) {
      whereClause.preferredDate = {
        gte: startOfDay(new Date(date)),
        lte: endOfDay(new Date(date))
      }
    }

    const waitlist = await prisma.waitlist.findMany({
      where: whereClause,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phoneNumber: true
          }
        },
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    })

    return NextResponse.json({ waitlist })

  } catch (error) {
    console.error('Waitlist fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch waitlist' },
      { status: 500 }
    )
  }
}
