import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { format } from 'date-fns'

/**
 * GET /api/appointments/today
 * 
 * Returns all appointments for today for a specific clinic.
 * Includes patient phone, slot time, and status.
 * 
 * Query Parameters:
 * - clinic_id (required): UUID of the clinic
 * - status (optional): Filter by status (booked, confirmed, checked_in, etc.)
 * - staff_id (optional): Filter by staff member
 * 
 * Response:
 * {
 *   appointments: Array<{
 *     id: string,
 *     status: string,
 *     appointment_type: string,
 *     notes: string | null,
 *     created_at: string,
 *     patient: {
 *       id: string,
 *       first_name: string,
 *       last_name: string,
 *       phone_number: string
 *     },
 *     slot: {
 *       id: string,
 *       start_time: string,
 *       end_time: string,
 *       duration_minutes: number
 *     },
 *     staff: {
 *       id: string,
 *       first_name: string,
 *       last_name: string,
 *       role: string
 *     }
 *   }>,
 *   summary: {
 *     total: number,
 *     by_status: Record<string, number>,
 *     checked_in: number,
 *     pending: number
 *   },
 *   clinic_id: string,
 *   date: string
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const clinicId = searchParams.get('clinic_id')
    const statusFilter = searchParams.get('status')
    const staffIdFilter = searchParams.get('staff_id')

    // Validation: Required parameters
    if (!clinicId) {
      return NextResponse.json(
        {
          error: 'Kitambulisho cha kliniki kinahitajika / Clinic ID is required',
          code: 'MISSING_CLINIC_ID'
        },
        { status: 400 }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(clinicId)) {
      return NextResponse.json(
        {
          error: 'Kitambulisho cha kliniki sio sahihi / Invalid clinic ID format',
          code: 'INVALID_CLINIC_ID'
        },
        { status: 400 }
      )
    }

    // Get today's date (start and end of day)
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)

    // Build where clause using Prisma types
    const whereClause: Prisma.AppointmentWhereInput = {
      clinicId: clinicId,
      slot: {
        slotDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    }

    // Add status filter if provided
    if (statusFilter) {
      const validStatuses = ['BOOKED', 'CONFIRMED', 'REMINDER_SENT', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW']
      const normalizedStatus = statusFilter.toUpperCase()
      
      if (validStatuses.includes(normalizedStatus)) {
        whereClause.status = normalizedStatus as 'BOOKED' | 'CONFIRMED' | 'REMINDER_SENT' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
      }
    }

    // Add staff filter if provided
    if (staffIdFilter) {
      if (!uuidRegex.test(staffIdFilter)) {
        return NextResponse.json(
          {
            error: 'Kitambulisho cha mtaalamu sio sahihi / Invalid staff ID format',
            code: 'INVALID_STAFF_ID'
          },
          { status: 400 }
        )
      }
      // Type-safe way to add staffId to the slot filter
      const slotFilter = whereClause.slot as { slotDate: { gte: Date; lte: Date }; staffId?: string }
      slotFilter.staffId = staffIdFilter
      whereClause.slot = slotFilter
    }

    // Fetch appointments
    const appointments = await prisma.appointment.findMany({
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
        slot: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            staff: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true
              }
            }
          }
        }
      },
      orderBy: [
        { slot: { startTime: 'asc' } }
      ]
    })

    // Calculate summary statistics
    const summary = {
      total: appointments.length,
      byStatus: {} as Record<string, number>,
      checkedIn: 0,
      pending: 0,
      completed: 0,
      cancelled: 0
    }

    appointments.forEach(apt => {
      // Count by status
      summary.byStatus[apt.status] = (summary.byStatus[apt.status] || 0) + 1
      
      // Calculate checked in
      if (apt.status === 'CHECKED_IN' || apt.status === 'COMPLETED') {
        summary.checkedIn++
      }
      
      // Calculate pending (booked or confirmed but not yet checked in)
      if (apt.status === 'BOOKED' || apt.status === 'CONFIRMED' || apt.status === 'REMINDER_SENT') {
        summary.pending++
      }
      
      // Calculate completed
      if (apt.status === 'COMPLETED') {
        summary.completed++
      }
      
      // Calculate cancelled
      if (apt.status === 'CANCELLED' || apt.status === 'NO_SHOW') {
        summary.cancelled++
      }
    })

    // Format appointments for response
    const formattedAppointments = appointments.map(apt => ({
      id: apt.id,
      status: apt.status,
      appointmentType: apt.appointmentType,
      notes: apt.notes,
      createdAt: apt.createdAt.toISOString(),
      patient: apt.patient ? {
        id: apt.patient.id,
        firstName: apt.patient.firstName,
        lastName: apt.patient.lastName,
        phoneNumber: apt.patient.phoneNumber
      } : null,
      slot: apt.slot ? {
        id: apt.slot.id,
        startTime: apt.slot.startTime,
        endTime: apt.slot.endTime,
        durationMinutes: calculateDuration(apt.slot.startTime, apt.slot.endTime)
      } : null,
      staff: apt.slot?.staff || null
    }))

    return NextResponse.json({
      appointments: formattedAppointments,
      summary: {
        total: summary.total,
        byStatus: summary.byStatus,
        checkedIn: summary.checkedIn,
        pending: summary.pending,
        completed: summary.completed,
        cancelled: summary.cancelled
      },
      clinicId: clinicId,
      date: format(today, 'yyyy-MM-dd'),
      filters: {
        status: statusFilter || null,
        staffId: staffIdFilter || null
      }
    })

  } catch (error) {
    console.error('Error fetching today\'s appointments:', error)
    
    return NextResponse.json(
      {
        error: 'Hitilafu katika kupata miadi ya leo / Error fetching today\'s appointments',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

/**
 * Calculate duration between two times in minutes
 */
function calculateDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)
  
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  
  return endMinutes - startMinutes
}
