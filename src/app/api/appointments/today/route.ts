import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { format } from 'date-fns'
import { calculateDuration } from '@/lib/date-utils'
import { withRLS } from '@/lib/middleware/rls-route-helpers'

/**
 * GET /api/appointments/today
 *
 * Returns all appointments for today for the authenticated clinic.
 * Uses RLS (Row Level Security) to ensure staff only see their clinic's data.
 *
 * Query Parameters:
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
export const GET = withRLS(async (request, { auth, db }) => {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const statusFilter = searchParams.get('status')
    const staffIdFilter = searchParams.get('staff_id')

    // Validate staff_id if provided
    if (staffIdFilter) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(staffIdFilter)) {
        return NextResponse.json(
          {
            error: 'Kitambulisho cha mtaalamu sio sahihi / Invalid staff ID format',
            code: 'INVALID_STAFF_ID'
          },
          { status: 400 }
        )
      }
    }

    // Get today's date in Tanzania timezone (EAT = UTC+3)
    const tanzaniaTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Dar_es_Salaam' }))
    const startOfDay = new Date(tanzaniaTime.getFullYear(), tanzaniaTime.getMonth(), tanzaniaTime.getDate(), 0, 0, 0)
    const endOfDay = new Date(tanzaniaTime.getFullYear(), tanzaniaTime.getMonth(), tanzaniaTime.getDate(), 23, 59, 59, 999)

    // Build where clause using Prisma types
    // Note: RLS automatically filters by clinic_id, so we don't need to specify it
    const whereClause: Prisma.AppointmentWhereInput = {
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
      const slotFilter = whereClause.slot as { slotDate: { gte: Date; lte: Date }; staffId?: string }
      slotFilter.staffId = staffIdFilter
      whereClause.slot = slotFilter
    }

    // Fetch appointments - RLS automatically filters to only show this clinic's data
    const appointments = await db.appointment.findMany({
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
      clinicId: auth.clinicId,
      date: format(tanzaniaTime, 'yyyy-MM-dd'),
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
}, { requiredType: 'clinic', requireClinic: true })
