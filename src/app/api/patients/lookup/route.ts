import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateTanzanianPhone } from '@/lib/phone-validation'

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
    // Parse request body
    const body = await request.json()
    const { phone, name, language_preference = 'sw' } = body

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

    // Check if patient exists
    const { data: existingPatient, error: lookupError } = await supabaseAdmin
      .from('patients')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .single()

    if (lookupError && lookupError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is expected for new patients
      console.error('Error looking up patient:', lookupError)
      return NextResponse.json(
        { 
          error: 'Hitilafu katika kutafuta mgonjwa / Error searching for patient',
          code: 'LOOKUP_ERROR'
        },
        { status: 500 }
      )
    }

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

    const { data: newPatient, error: createError } = await supabaseAdmin
      .from('patients')
      .insert({
        phone_number: normalizedPhone,
        first_name: firstName,
        last_name: lastName,
        language: language_preference === 'en' ? 'en' : 'sw'
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating patient:', createError)
      return NextResponse.json(
        { 
          error: 'Hitilafu katika kusajili mgonjwa mpya / Error registering new patient',
          code: 'CREATE_ERROR',
          details: createError.message
        },
        { status: 500 }
      )
    }

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
