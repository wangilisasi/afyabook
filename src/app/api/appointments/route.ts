import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, recordBookingAttempt } from '@/lib/rate-limit/booking-rate-limit'

/**
 * POST /api/appointments
 * 
 * Creates a new appointment with transaction safety and race condition protection.
 * 
 * Request Body:
 * {
 *   patient_id: string (required) - UUID of the patient
 *   slot_id: string (required) - UUID of the appointment slot
 *   notes?: string (optional) - Notes about the appointment
 * }
 * 
 * Response:
 * {
 *   appointment: {
 *     id: string,
 *     patient_id: string,
 *     slot_id: string,
 *     clinic_id: string,
 *     status: 'BOOKED',
 *     appointment_type: string,
 *     notes: string | null,
 *     created_at: string,
 *     patient: { id, first_name, last_name, phone_number },
 *     slot: { id, slot_date, start_time, end_time, staff: {...} },
 *     clinic: { id, name, address, phone_number }
 *   }
 * }
 * 
 * Error Responses:
 * - 400: Missing required fields, slot in past, rate limited
 * - 409: Slot already booked (race condition)
 * - 404: Patient or slot not found
 * - 500: Database error
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const { patient_id, slot_id, notes } = body

    // Validation: Required fields
    if (!patient_id) {
      return NextResponse.json(
        {
          error: 'Kitambulisho cha mgonjwa kinahitajika / Patient ID is required',
          code: 'MISSING_PATIENT_ID'
        },
        { status: 400 }
      )
    }

    if (!slot_id) {
      return NextResponse.json(
        {
          error: 'Kitambulisho cha nafasi kinahitajika / Slot ID is required',
          code: 'MISSING_SLOT_ID'
        },
        { status: 400 }
      )
    }

    // Execute everything in a transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Fetch patient with lock
      const patient = await tx.patient.findUnique({
        where: { id: patient_id }
      })

      if (!patient) {
        throw new Error('PATIENT_NOT_FOUND')
      }

      // Step 2: Check rate limit for this phone number
      const rateLimitCheck = checkRateLimit(patient.phoneNumber)
      if (rateLimitCheck.isLimited) {
        throw new Error(`RATE_LIMITED:${rateLimitCheck.message}`)
      }

      // Step 3: Fetch and lock the slot (FOR UPDATE prevents race conditions)
      const slot = await tx.$queryRaw`
        SELECT 
          s.id, 
          s.slot_date, 
          s.start_time, 
          s.end_time, 
          s.is_available,
          s.clinic_id,
          st.id as staff_id,
          st.first_name as staff_first_name,
          st.last_name as staff_last_name,
          st.role as staff_role
        FROM appointment_slots s
        JOIN staff st ON st.id = s.staff_id
        WHERE s.id = ${slot_id}
        FOR UPDATE
      `

      if (!slot || !Array.isArray(slot) || slot.length === 0) {
        throw new Error('SLOT_NOT_FOUND')
      }

      const slotData = slot[0] as {
        id: string
        slot_date: Date
        start_time: string
        end_time: string
        is_available: boolean
        clinic_id: string
        staff_id: string
        staff_first_name: string
        staff_last_name: string
        staff_role: string
      }

      // Step 4: Business rule - Cannot book slot in the past
      const slotDateTime = new Date(`${slotData.slot_date.toISOString().split('T')[0]}T${slotData.start_time}`)
      const now = new Date()
      
      if (slotDateTime < now) {
        throw new Error('SLOT_IN_PAST')
      }

      // Step 5: Business rule - Cannot double-book
      if (!slotData.is_available) {
        throw new Error('SLOT_ALREADY_BOOKED')
      }

      // Step 6: Check if patient already has an appointment for this slot time
      const existingAppointment = await tx.appointment.findFirst({
        where: {
          patientId: patient_id,
          slot: {
            slotDate: slotData.slot_date,
            startTime: slotData.start_time
          },
          status: {
            notIn: ['CANCELLED', 'NO_SHOW']
          }
        }
      })

      if (existingAppointment) {
        throw new Error('PATIENT_ALREADY_BOOKED')
      }

      // Step 7: Mark slot as unavailable
      await tx.appointmentSlot.update({
        where: { id: slot_id },
        data: { isAvailable: false }
      })

      // Step 8: Create appointment
      const appointment = await tx.appointment.create({
        data: {
          slotId: slot_id,
          patientId: patient_id,
          clinicId: slotData.clinic_id,
          status: 'BOOKED',
          appointmentType: 'general',
          notes: notes || null,
          reminderSent: false
        }
      })

      // Step 9: Record booking attempt for rate limiting
      recordBookingAttempt(patient.phoneNumber)

      // Step 10: Fetch clinic details
      const clinic = await tx.clinic.findUnique({
        where: { id: slotData.clinic_id },
        select: {
          id: true,
          name: true,
          address: true,
          phoneNumber: true
        }
      })

      if (!clinic) {
        throw new Error('CLINIC_NOT_FOUND')
      }

      // Return full appointment details
      return {
        appointment: {
          id: appointment.id,
          patientId: appointment.patientId,
          slotId: appointment.slotId,
          clinicId: appointment.clinicId,
          status: appointment.status,
          appointmentType: appointment.appointmentType,
          notes: appointment.notes,
          createdAt: appointment.createdAt.toISOString(),
          updatedAt: appointment.updatedAt.toISOString(),
          patient: {
            id: patient.id,
            firstName: patient.firstName,
            lastName: patient.lastName,
            phoneNumber: patient.phoneNumber
          },
          slot: {
            id: slotData.id,
            slot_date: slotData.slot_date.toISOString().split('T')[0],
            start_time: slotData.start_time,
            end_time: slotData.end_time,
            staff: {
              id: slotData.staff_id,
              first_name: slotData.staff_first_name,
              last_name: slotData.staff_last_name,
              role: slotData.staff_role
            }
          },
          clinic: {
            id: clinic.id,
            name: clinic.name,
            address: clinic.address,
            phoneNumber: clinic.phoneNumber
          }
        }
      }
    }, {
      // Transaction options
      isolationLevel: 'Serializable', // Highest isolation level for race condition protection
      maxWait: 5000, // Maximum time to wait for transaction lock
      timeout: 10000 // Maximum time for transaction to complete
    })

    return NextResponse.json(result, { status: 201 })

  } catch (error) {
    console.error('Error creating appointment:', error)
    
    // Handle specific error cases
    if (error instanceof Error) {
      const errorMessage = error.message
      
      // Rate limited
      if (errorMessage.startsWith('RATE_LIMITED:')) {
        return NextResponse.json(
          {
            error: errorMessage.replace('RATE_LIMITED:', ''),
            code: 'RATE_LIMITED'
          },
          { status: 429 }
        )
      }
      
      // Patient not found
      if (errorMessage === 'PATIENT_NOT_FOUND') {
        return NextResponse.json(
          {
            error: 'Mgonjwa hajapatikana / Patient not found',
            code: 'PATIENT_NOT_FOUND'
          },
          { status: 404 }
        )
      }
      
      // Slot not found
      if (errorMessage === 'SLOT_NOT_FOUND') {
        return NextResponse.json(
          {
            error: 'Nafasi haijapatikana / Slot not found',
            code: 'SLOT_NOT_FOUND'
          },
          { status: 404 }
        )
      }
      
      // Slot in past
      if (errorMessage === 'SLOT_IN_PAST') {
        return NextResponse.json(
          {
            error: 'Haiwezi kufanya booking kwa nafasi iliyopita / Cannot book a slot in the past',
            code: 'SLOT_IN_PAST'
          },
          { status: 400 }
        )
      }
      
      // Slot already booked (race condition)
      if (errorMessage === 'SLOT_ALREADY_BOOKED') {
        return NextResponse.json(
          {
            error: 'Nafasi tayari imechukuliwa / Slot is already booked',
            code: 'SLOT_ALREADY_BOOKED'
          },
          { status: 409 }
        )
      }
      
      // Patient already booked
      if (errorMessage === 'PATIENT_ALREADY_BOOKED') {
        return NextResponse.json(
          {
            error: 'Mgonjwa tayari ana miadi kwa muda huu / Patient already has an appointment at this time',
            code: 'PATIENT_ALREADY_BOOKED'
          },
          { status: 409 }
        )
      }
      
      // Clinic not found
      if (errorMessage === 'CLINIC_NOT_FOUND') {
        return NextResponse.json(
          {
            error: 'Kliniki haijapatikana / Clinic not found',
            code: 'CLINIC_NOT_FOUND'
          },
          { status: 404 }
        )
      }
    }
    
    // Database constraint violation (unique constraint on slot_id)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'Nafasi tayari imechukuliwa / Slot is already booked',
          code: 'SLOT_ALREADY_BOOKED'
        },
        { status: 409 }
      )
    }
    
    // Generic error
    return NextResponse.json(
      {
        error: 'Hitilafu katika kutengeneza miadi / Error creating appointment',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}
