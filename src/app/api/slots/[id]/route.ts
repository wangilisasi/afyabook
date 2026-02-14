import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateDuration } from '@/lib/date-utils'
import { validateParams } from '@/lib/validation/helpers'
import { z } from 'zod'

const SlotParamsSchema = z.object({
  id: z.string().uuid()
})

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
    const validation = validateParams({ id }, SlotParamsSchema)
    if (!validation.success) {
      return validation.error
    }

    // Fetch slot with clinic and staff details using Prisma
    const slot = await prisma.appointmentSlot.findUnique({
      where: { id },
      include: {
        clinic: {
          select: {
            id: true,
            name: true,
            address: true,
            phoneNumber: true,
            region: true,
            timezone: true
          }
        },
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            specialization: true,
            licenseNumber: true,
            phoneNumber: true
          }
        }
      }
    })

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
      slot_date: slot.slotDate,
      start_time: slot.startTime,
      end_time: slot.endTime,
      duration: calculateDuration(slot.startTime, slot.endTime),
      is_available: slot.isAvailable,
      created_at: slot.createdAt,
      clinic: slot.clinic,
      staff: slot.staff
    }

    // Check if slot is in the past
    const slotDateTime = new Date(`${slot.slotDate.toISOString().split('T')[0]}T${slot.startTime}`)
    const now = new Date()
    const isPast = slotDateTime < now

    return NextResponse.json({
      slot: formattedSlot,
      is_past: isPast,
      can_book: slot.isAvailable && !isPast
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
