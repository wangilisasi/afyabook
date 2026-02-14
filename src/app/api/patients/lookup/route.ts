import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateTanzanianPhone } from '@/lib/phone-validation'
import { validateBody } from '@/lib/validation/helpers'
import { z } from 'zod'

const PatientLookupSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  name: z.string().optional(),
  language_preference: z.enum(['sw', 'en']).default('sw')
})

/**
 * POST /api/patients/lookup
 * 
 * Looks up a patient by phone number. If found, returns existing patient.
 * If not found, creates a new patient with provided name or "Unknown".
 * 
 * Request Body:
 * {
 *   phone: string (required) - Tanzanian phone number
 *   name?: string (optional) - Patient name for new registrations
 *   language_preference?: 'sw' | 'en' (optional) - Preferred language
 * }
 * 
 * Response:
 * {
 *   patient: Patient,
 *   isNew: boolean
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const validation = await validateBody(request, PatientLookupSchema)
    if (!validation.success) {
      return validation.error
    }

    const { phone, name, language_preference } = validation.data

    // Validate phone number
    const phoneValidation = validateTanzanianPhone(phone)
    
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { 
          error: phoneValidation.error,
          code: 'INVALID_PHONE'
        },
        { status: 400 }
      )
    }

    const normalizedPhone = phoneValidation.normalized!

    // Check if patient exists using Prisma
    const existingPatient = await prisma.patient.findUnique({
      where: { phoneNumber: normalizedPhone }
    })

    // If patient exists, return them
    if (existingPatient) {
      return NextResponse.json({
        patient: existingPatient,
        isNew: false,
        message: 'Mgonjwa amepatikana / Patient found'
      })
    }

    // Patient doesn't exist - create new one
    const patientName = name?.trim() || 'Unknown'
    
    // Parse name into first and last
    const nameParts = patientName.split(' ')
    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(' ') || 'Unknown'

    const newPatient = await prisma.patient.create({
      data: {
        phoneNumber: normalizedPhone,
        firstName: firstName,
        lastName: lastName,
        language: language_preference
      }
    })

    return NextResponse.json({
      patient: newPatient,
      isNew: true,
      message: 'Mgonjwa mpya amesajiliwa / New patient registered'
    }, { status: 201 })

  } catch (error) {
    console.error('Unexpected error in patient lookup:', error)
    return NextResponse.json(
      { 
        error: 'Hitilafu isiyotarajiwa / Unexpected error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}
