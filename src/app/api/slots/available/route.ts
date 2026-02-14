import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateDuration } from '@/lib/date-utils'
import { getCurrentTanzaniaTime, MILLISECONDS_PER_MINUTE } from '@/lib/timezone'
import { validateQuery } from '@/lib/validation/helpers'
import { GetAvailableSlotsQuerySchema } from '@/lib/validation/schemas'

/**
 * GET /api/slots/available
 * 
 * Returns available appointment slots for a specific clinic and date.
 * Filters out already-booked slots and past times for today.
 * 
 * Query Parameters:
 * - clinic_id (required): UUID of the clinic
 * - date (required): Date in YYYY-MM-DD format
 * - service_type (optional): Filter by service type
 * 
 * Response:
 * {
 *   slots: Array<{
 *     id: string,
 *     slot_date: string,
 *     start_time: string,
 *     end_time: string,
 *     is_available: boolean,
 *     staff: {
 *       id: string,
 *       first_name: string,
 *       last_name: string,
 *       role: string,
 *       specialization?: string
 *     }
 *   }>
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Validate query parameters
    const validation = validateQuery(request.nextUrl.searchParams, GetAvailableSlotsQuerySchema)
    if (!validation.success) {
      return validation.error
    }

    const { clinic_id, date, service_type } = validation.data

    // Parse the date
    const requestedDate = new Date(date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Check if date is in the past
    if (requestedDate < today) {
      return NextResponse.json(
        { 
          error: 'Tarehe imepita. Chagua tarehe ya leo au baadaye / Date is in the past. Select today or a future date',
          code: 'PAST_DATE'
        },
        { status: 400 }
      )
    }

    // Calculate date range for the requested date
    const startOfDay = new Date(requestedDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(requestedDate)
    endOfDay.setHours(23, 59, 59, 999)

    // If it's today, filter out past times (using Tanzania timezone EAT = UTC+3)
    const tanzaniaTime = getCurrentTanzaniaTime()
    const isToday = requestedDate.toDateString() === tanzaniaTime.toDateString()
    
    let cutoffTime: string | undefined
    if (isToday) {
      // Only show slots that start after current time + buffer
      const bufferTime = new Date(tanzaniaTime.getTime() + 15 * MILLISECONDS_PER_MINUTE)
      cutoffTime = bufferTime.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'Africa/Dar_es_Salaam'
      })
    }

    // Build query using Prisma
    const slots = await prisma.appointmentSlot.findMany({
      where: {
        clinicId: clinic_id,
        slotDate: {
          gte: startOfDay,
          lte: endOfDay
        },
        isAvailable: true,
        ...(service_type && {
          staff: {
            specialization: service_type
          }
        }),
        ...(cutoffTime && {
          startTime: {
            gt: cutoffTime
          }
        })
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            specialization: true
          }
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    })

    // Transform data for cleaner response
    const formattedSlots = slots.map(slot => ({
      id: slot.id,
      slot_date: slot.slotDate,
      start_time: slot.startTime,
      end_time: slot.endTime,
      duration: calculateDuration(slot.startTime, slot.endTime),
      is_available: slot.isAvailable,
      staff: slot.staff
    }))

    return NextResponse.json({
      slots: formattedSlots,
      count: formattedSlots.length,
      clinic_id: clinic_id,
      date: date,
      is_today: isToday
    })

  } catch (error) {
    console.error('Unexpected error fetching slots:', error)
    return NextResponse.json(
      { 
        error: 'Hitilafu isiyotarajiwa / Unexpected error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}
