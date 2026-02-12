import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AppointmentStatus } from '@prisma/client'

/**
 * POST /api/appointments/[id]/status
 * 
 * Updates appointment status with proper slot management.
 * If cancelled: frees up the slot for rebooking.
 * Tracks who made the change.
 * 
 * Request Body:
 * {
 *   status: 'confirmed' | 'cancelled' | 'completed' | 'no_show' (required)
 *   staff_id?: string (optional) - Staff member making the change
 *   notes?: string (optional) - Additional notes about status change
 *   cancellation_reason?: string (optional) - Reason for cancellation
 * }
 * 
 * Response:
 * {
 *   appointment: {
 *     id: string,
 *     status: AppointmentStatus,
 *     previous_status: AppointmentStatus,
 *     slot_freed: boolean,
 *     updated_at: string
 *   }
 * }
 * 
 * Error Responses:
 * - 400: Invalid status, missing required fields
 * - 404: Appointment not found
 * - 409: Invalid status transition
 * - 500: Database error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { 
      status, 
      staff_id, 
      notes, 
      cancellation_reason 
    } = body

    // Validation: Required fields
    if (!id) {
      return NextResponse.json(
        {
          error: 'Kitambulisho cha miadi kinahitajika / Appointment ID is required',
          code: 'MISSING_APPOINTMENT_ID'
        },
        { status: 400 }
      )
    }

    if (!status) {
      return NextResponse.json(
        {
          error: 'Hali inahitajika / Status is required',
          code: 'MISSING_STATUS'
        },
        { status: 400 }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        {
          error: 'Kitambulisho cha miadi sio sahihi / Invalid appointment ID format',
          code: 'INVALID_APPOINTMENT_ID'
        },
        { status: 400 }
      )
    }

    // Validate status value
    const validStatuses: AppointmentStatus[] = ['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']
    const normalizedStatus = status.toUpperCase() as AppointmentStatus
    
    if (!validStatuses.includes(normalizedStatus)) {
      return NextResponse.json(
        {
          error: `Hali sio sahihi. Chagua: ${validStatuses.join(', ')} / Invalid status. Choose: confirmed, cancelled, completed, no_show`,
          code: 'INVALID_STATUS'
        },
        { status: 400 }
      )
    }

    // Execute in transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Fetch appointment with slot
      const appointment = await tx.appointment.findUnique({
        where: { id },
        include: {
          slot: true
        }
      })

      if (!appointment) {
        throw new Error('APPOINTMENT_NOT_FOUND')
      }

      const previousStatus = appointment.status

      // Step 2: Validate status transition
      const isValidTransition = validateStatusTransition(previousStatus, normalizedStatus)
      if (!isValidTransition.valid) {
        throw new Error(`INVALID_TRANSITION:${isValidTransition.message}`)
      }

      // Step 3: Prepare update data
      const updateData: {
        status: AppointmentStatus
        cancelledAt?: Date
        cancellationReason?: string | null
        completedAt?: Date
      } = {
        status: normalizedStatus
      }

      // Track timestamps based on status
      const now = new Date()
      
      switch (normalizedStatus) {
        case 'CONFIRMED':
          // Just update status
          break
        case 'CANCELLED':
          updateData.cancelledAt = now
          updateData.cancellationReason = cancellation_reason || notes || null
          break
        case 'COMPLETED':
          updateData.completedAt = now
          break
        case 'NO_SHOW':
          // Just update status
          break
      }

      // Step 4: Update appointment
      const updatedAppointment = await tx.appointment.update({
        where: { id },
        data: updateData
      })

      // Step 5: Handle slot management for cancellations
      let slotFreed = false
      if (normalizedStatus === 'CANCELLED' && appointment.slot) {
        // Free up the slot for rebooking
        await tx.appointmentSlot.update({
          where: { id: appointment.slotId },
          data: { isAvailable: true }
        })
        slotFreed = true
      }

      // Step 6: Log status change (if staff_id provided)
      // Note: In a production app, you might want a separate audit log table
      // For now, we just include it in the response

      return {
        appointment: {
          id: updatedAppointment.id,
          status: updatedAppointment.status,
          previousStatus: previousStatus,
          slotFreed: slotFreed,
          updatedAt: updatedAppointment.updatedAt.toISOString(),
          staffId: staff_id || null,
          notes: notes || null
        }
      }
    }, {
      isolationLevel: 'Serializable',
      maxWait: 5000,
      timeout: 10000
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error updating appointment status:', error)
    
    if (error instanceof Error) {
      const errorMessage = error.message
      
      // Appointment not found
      if (errorMessage === 'APPOINTMENT_NOT_FOUND') {
        return NextResponse.json(
          {
            error: 'Miadi haijapatikana / Appointment not found',
            code: 'APPOINTMENT_NOT_FOUND'
          },
          { status: 404 }
        )
      }
      
      // Invalid status transition
      if (errorMessage.startsWith('INVALID_TRANSITION:')) {
        return NextResponse.json(
          {
            error: errorMessage.replace('INVALID_TRANSITION:', ''),
            code: 'INVALID_STATUS_TRANSITION'
          },
          { status: 409 }
        )
      }
    }
    
    return NextResponse.json(
      {
        error: 'Hitilafu katika kusasisha hali ya miadi / Error updating appointment status',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

/**
 * Validates if a status transition is allowed
 * Returns { valid: boolean, message?: string }
 */
function validateStatusTransition(
  from: AppointmentStatus,
  to: AppointmentStatus
): { valid: boolean; message?: string } {
  // Terminal states - cannot transition from these
  const terminalStates: AppointmentStatus[] = ['COMPLETED', 'CANCELLED']
  
  if (terminalStates.includes(from)) {
    return {
      valid: false,
      message: `Haiwezi kubadilisha hali kutoka ${formatStatus(from)}. Miadi tayari imekamilika au kughairiwa / Cannot change status from ${formatStatus(from)}. Appointment is already completed or cancelled`
    }
  }

  // Valid transitions
  const validTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
    'BOOKED': ['CONFIRMED', 'CANCELLED'],
    'CONFIRMED': ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
    'REMINDER_SENT': ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
    'CHECKED_IN': ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
    'COMPLETED': [],
    'CANCELLED': [],
    'NO_SHOW': []
  }

  const allowedTransitions = validTransitions[from] || []
  
  if (!allowedTransitions.includes(to)) {
    return {
      valid: false,
      message: `Haiwezi kubadilisha kutoka ${formatStatus(from)} hadi ${formatStatus(to)} / Cannot transition from ${formatStatus(from)} to ${formatStatus(to)}`
    }
  }

  return { valid: true }
}

/**
 * Format status for display (bilingual)
 */
function formatStatus(status: AppointmentStatus): string {
  const statusMap: Record<AppointmentStatus, string> = {
    'BOOKED': 'Booked (Imehifadhiwa)',
    'CONFIRMED': 'Confirmed (Imethibitishwa)',
    'REMINDER_SENT': 'Reminder Sent (Kumbusho Limetumwa)',
    'CHECKED_IN': 'Checked In (Amecheck-in)',
    'COMPLETED': 'Completed (Imekamilika)',
    'CANCELLED': 'Cancelled (Imeghairiwa)',
    'NO_SHOW': 'No Show (Hajafika)'
  }
  
  return statusMap[status] || status
}
