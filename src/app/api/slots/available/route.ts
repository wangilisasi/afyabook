import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { calculateDuration } from '@/lib/date-utils'
import { getCurrentTanzaniaTime, MILLISECONDS_PER_MINUTE } from '@/lib/timezone'

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
    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const clinicId = searchParams.get('clinic_id')
    const date = searchParams.get('date')
    const serviceType = searchParams.get('service_type')

    // Validate required parameters
    if (!clinicId) {
      return NextResponse.json(
        { 
          error: 'Kitambulisho cha kliniki kinahitajika / Clinic ID is required',
          code: 'MISSING_CLINIC_ID'
        },
        { status: 400 }
      )
    }

    if (!date) {
      return NextResponse.json(
        { 
          error: 'Tarehe inahitajika / Date is required',
          code: 'MISSING_DATE'
        },
        { status: 400 }
      )
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { 
          error: 'Formati ya tarehe sio sahihi. Tumia YYYY-MM-DD / Invalid date format. Use YYYY-MM-DD',
          code: 'INVALID_DATE_FORMAT'
        },
        { status: 400 }
      )
    }

    // Check if date is in the past
    const requestedDate = new Date(date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (requestedDate < today) {
      return NextResponse.json(
        { 
          error: 'Tarehe imepita. Chagua tarehe ya leo au baadaye / Date is in the past. Select today or a future date',
          code: 'PAST_DATE'
        },
        { status: 400 }
      )
    }

    // Build query for available slots
    let query = supabaseAdmin
      .from('appointment_slots')
      .select(`
        id,
        slot_date,
        start_time,
        end_time,
        is_available,
        staff (
          id,
          first_name,
          last_name,
          role,
          specialization
        )
      `)
      .eq('clinic_id', clinicId)
      .eq('slot_date', date)
      .eq('is_available', true)

    // Filter by service type if provided
    // This assumes staff have specializations that match service types
    if (serviceType) {
      query = query.eq('staff.specialization', serviceType)
    }

    // If it's today, filter out past times (using Tanzania timezone EAT = UTC+3)
    const tanzaniaTime = getCurrentTanzaniaTime()
    const isToday = requestedDate.toDateString() === tanzaniaTime.toDateString()
    
    if (isToday) {
      // Only show slots that start after current time + buffer
      const bufferTime = new Date(tanzaniaTime.getTime() + 15 * MILLISECONDS_PER_MINUTE)
      const cutoffTime = bufferTime.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'Africa/Dar_es_Salaam'
      })
      
      query = query.gt('start_time', cutoffTime)
    }

    // Order by start time
    query = query.order('start_time', { ascending: true })

    const { data: slots, error } = await query

    if (error) {
      console.error('Error fetching slots:', error)
      return NextResponse.json(
        { 
          error: 'Hitilafu katika kupata nafasi / Error fetching slots',
          code: 'FETCH_ERROR',
          details: error.message
        },
        { status: 500 }
      )
    }

    // Transform data for cleaner response
    const formattedSlots = slots?.map(slot => ({
      id: slot.id,
      slot_date: slot.slot_date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      duration: calculateDuration(slot.start_time, slot.end_time),
      is_available: slot.is_available,
      staff: Array.isArray(slot.staff) ? slot.staff[0] : slot.staff
    })) || []

    return NextResponse.json({
      slots: formattedSlots,
      count: formattedSlots.length,
      clinic_id: clinicId,
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

