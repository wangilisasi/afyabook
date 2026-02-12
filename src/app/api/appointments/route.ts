import { NextRequest, NextResponse } from 'next/server'
import { prisma, withAuthContext } from '@/lib/prisma'

// GET /api/appointments - List appointments (filtered by auth context)
export async function GET(request: NextRequest) {
  try {
    // In production, get this from your auth session (e.g., NextAuth, Clerk, etc.)
    // This is a simplified example
    const authHeader = request.headers.get('authorization')
    const userId = authHeader?.replace('Bearer ', '')
    
    // Example: Patient accessing their appointments
    const authContext = {
      userId: userId || 'patient-123',
      userRole: 'patient' as const,
      isAuthenticated: true
    }

    // Wrap database calls with auth context
    const appointments = await withAuthContext(authContext, async () => {
      return prisma.appointment.findMany({
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
              phoneNumber: true
            }
          },
          slot: {
            include: {
              staff: {
                select: {
                  firstName: true,
                  lastName: true,
                  role: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    })

    return NextResponse.json({ appointments })
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch appointments' },
      { status: 500 }
    )
  }
}

// POST /api/appointments - Create appointment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { slotId, patientId, notes } = body

    // Example: Patient creating their own appointment
    const authContext = {
      userId: patientId,
      userRole: 'patient' as const,
      isAuthenticated: true
    }

    const appointment = await withAuthContext(authContext, async () => {
      return prisma.$transaction(async (tx) => {
        // Mark slot as unavailable
        await tx.appointmentSlot.update({
          where: { id: slotId },
          data: { isAvailable: false }
        })

        // Create appointment
        return tx.appointment.create({
          data: {
            slotId,
            patientId,
            clinicId: body.clinicId,
            status: 'BOOKED',
            appointmentType: body.appointmentType || 'general',
            notes
          }
        })
      })
    })

    return NextResponse.json({ appointment }, { status: 201 })
  } catch (error) {
    console.error('Error creating appointment:', error)
    return NextResponse.json(
      { error: 'Failed to create appointment' },
      { status: 500 }
    )
  }
}
