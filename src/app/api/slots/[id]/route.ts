import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { calculateDuration } from '@/lib/date-utils'

/**
 * GET /api/slots/[id]
 * 
 * Returns detailed information about a specific appointment slot
 * including clinic information and staff details.
 * 
 * Path Parameters:
 * - id (required): UUID of the appointment slot
 * 
 * Response:
 * {
 *   slot: {
 *     id: string,
 *     slot_date: string,
 *     start_time: string,
 *     end_time: string,
 *     is_available: boolean,
 *     clinic: {
 *       id: string,
 *       name: string,
 *       address: string,
 *       phone_number: string,
 *       region: string
 *     },
 *     staff: {
 *       id: string,
 *       first_name: string,
 *       last_name: string,
 *       role: string,
 *       specialization: string,
 *       license_number: string
 *     }
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Validate slot ID
    if (!id) {
      return NextResponse.json(
        { 
          error: 'Kitambulisho cha nafasi kinahitajika / Slot ID is required',
          code: 'MISSING_SLOT_ID'
        },
        { status: 400 }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { 
          error: 'Kitambulisho cha nafasi sio sahihi / Invalid slot ID format',
          code: 'INVALID_SLOT_ID'
        },
        { status: 400 }
      )
    }

    // Fetch slot with clinic and staff details
    const { data: slot, error } = await supabaseAdmin
      .from('appointment_slots')
      .select(`
        id,
        slot_date,
        start_time,
        end_time,
        is_available,
        created_at,
        clinic:clinics (
          id,
          name,
          address,
          phone_number,
          region,
          timezone
        ),
        staff (
          id,
          first_name,
          last_name,
          role,
          specialization,
          license_number,
          phone_number
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return NextResponse.json(
          { 
            error: 'Nafisi haijapatikana / Slot not found',
            code: 'SLOT_NOT_FOUND'
          },
          { status: 404 }
        )
      }

      console.error('Error fetching slot:', error)
      return NextResponse.json(
        { 
          error: 'Hitilafu katika kupata maelezo ya nafasi / Error fetching slot details',
          code: 'FETCH_ERROR',
          details: error.message
        },
        { status: 500 }
      )
    }

    if (!slot) {
      return NextResponse.json(
        { 
          error: 'Nafisi haijapatikana / Slot not found',
          code: 'SLOT_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    // Format the response
    const formattedSlot = {
      id: slot.id,
      slot_date: slot.slot_date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      duration: calculateDuration(slot.start_time, slot.end_time),
      is_available: slot.is_available,
      created_at: slot.created_at,
      clinic: Array.isArray(slot.clinic) ? slot.clinic[0] : slot.clinic,
      staff: Array.isArray(slot.staff) ? slot.staff[0] : slot.staff
    }

    // Check if slot is in the past
    const slotDateTime = new Date(`${slot.slot_date}T${slot.start_time}`)
    const now = new Date()
    const isPast = slotDateTime < now

    return NextResponse.json({
      slot: formattedSlot,
      is_past: isPast,
      can_book: slot.is_available && !isPast
    })

  } catch (error) {
    console.error('Unexpected error fetching slot:', error)
    return NextResponse.json(
      { 
        error: 'Hitilafu isiyotarajiwa / Unexpected error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

