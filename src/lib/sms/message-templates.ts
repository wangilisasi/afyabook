/**
 * SMS Message Templates for AfyaBook
 * Generates bilingual (Swahili/English) messages for appointment notifications
 */

import { SmsType } from '@prisma/client'

export type MessageType = 'BOOKING_CONFIRMATION' | 'REMINDER_24H' | 'REMINDER_1H' | 'CANCELLATION' | 'RESCHEDULE' | 'CHECK_IN_CONFIRMATION'

interface PatientInfo {
  firstName: string
  lastName: string
  language: 'sw' | 'en'
}

interface AppointmentInfo {
  date: string // YYYY-MM-DD
  time: string // HH:MM
  doctorName: string
  doctorRole: string
  clinicName: string
  clinicPhone: string
  address?: string
}

interface GenerateMessageParams {
  type: MessageType
  patient: PatientInfo
  appointment: AppointmentInfo
}

interface GeneratedMessage {
  swahili: string
  english: string
  primary: string // The patient's preferred language
}

/**
 * Generate SMS message content in both Swahili and English
 * Returns message in patient's preferred language
 * 
 * @param params - Message generation parameters
 * @returns Generated messages in both languages
 */
export function generateMessageContent(params: GenerateMessageParams): GeneratedMessage {
  const { type, patient, appointment } = params
  const patientName = `${patient.firstName}`
  
  const swahiliMessage = generateSwahiliMessage(type, patientName, appointment)
  const englishMessage = generateEnglishMessage(type, patientName, appointment)

  return {
    swahili: swahiliMessage,
    english: englishMessage,
    primary: patient.language === 'sw' ? swahiliMessage : englishMessage
  }
}

/**
 * Generate message in Swahili
 */
function generateSwahiliMessage(
  type: MessageType,
  patientName: string,
  appointment: AppointmentInfo
): string {
  const { date, time, doctorName, clinicName, clinicPhone, address } = appointment

  // Format date to be more readable in Swahili
  const formattedDate = formatDateForDisplay(date, 'sw')
  const formattedTime = convertTo12Hour(time)

  switch (type) {
    case 'BOOKING_CONFIRMATION':
      return `Habari ${patientName}, umefanikiwa kuhudumu ${formattedDate} saa ${formattedTime} na ${doctorName}. Kliniki: ${clinicName}. Mawasiliano: ${clinicPhone}. Tafadhali kuja mapema. Asante!`

    case 'REMINDER_24H':
      return `Kumbuka kesho ${formattedDate} saa ${formattedTime} una hudumu na ${doctorName} kutoka ${clinicName}. Mawasiliano: ${clinicPhone}. Tafadhali kuja mapema.`

    case 'REMINDER_1H':
      return `Habari ${patientName}, leo saa ${formattedTime} una hudumu na ${doctorName} katika ${clinicName}. Tafadhali kuja mapema.`

    case 'CANCELLATION':
      return `Habari ${patientName}, miadi yako ya ${formattedDate} saa ${formattedTime} na ${doctorName} imeghairiwa. Tafadhali piga ${clinicPhone} kupanga tena.`

    case 'RESCHEDULE':
      return `Habari ${patientName}, miadi yako imehamishwa hadi ${formattedDate} saa ${formattedTime} na ${doctorName}. Kliniki: ${clinicName}. Mawasiliano: ${clinicPhone}`

    case 'CHECK_IN_CONFIRMATION':
      return `Habari ${patientName}, umecheck-in kwa mafanikio. Tafadhali subiri kuitwa kwa ${doctorName}. Asante!`

    default:
      return `Habari ${patientName}, kuna taarifa kuhusu miadi yako. Tafadhali wasiliana na ${clinicPhone}`
  }
}

/**
 * Generate message in English
 */
function generateEnglishMessage(
  type: MessageType,
  patientName: string,
  appointment: AppointmentInfo
): string {
  const { date, time, doctorName, clinicName, clinicPhone, address } = appointment

  // Format date to be more readable
  const formattedDate = formatDateForDisplay(date, 'en')
  const formattedTime = convertTo12Hour(time)

  switch (type) {
    case 'BOOKING_CONFIRMATION':
      return `Hello ${patientName}, your appointment is confirmed for ${formattedDate} at ${formattedTime} with ${doctorName}. Clinic: ${clinicName}. Phone: ${clinicPhone}. Please arrive early. Thank you!`

    case 'REMINDER_24H':
      return `Reminder: Tomorrow ${formattedDate} at ${formattedTime} you have an appointment with ${doctorName} at ${clinicName}. Phone: ${clinicPhone}. Please arrive early.`

    case 'REMINDER_1H':
      return `Hello ${patientName}, you have an appointment today at ${formattedTime} with ${doctorName} at ${clinicName}. Please arrive early.`

    case 'CANCELLATION':
      return `Hello ${patientName}, your appointment on ${formattedDate} at ${formattedTime} with ${doctorName} has been cancelled. Please call ${clinicPhone} to reschedule.`

    case 'RESCHEDULE':
      return `Hello ${patientName}, your appointment has been rescheduled to ${formattedDate} at ${formattedTime} with ${doctorName}. Clinic: ${clinicName}. Phone: ${clinicPhone}`

    case 'CHECK_IN_CONFIRMATION':
      return `Hello ${patientName}, you have successfully checked in. Please wait to be called by ${doctorName}. Thank you!`

    default:
      return `Hello ${patientName}, there is an update regarding your appointment. Please contact ${clinicPhone}`
  }
}

/**
 * Format date for display in SMS
 */
function formatDateForDisplay(dateString: string, language: 'sw' | 'en'): string {
  const date = new Date(dateString)
  
  if (language === 'sw') {
    const months = [
      'Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni',
      'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'
    ]
    const month = months[date.getMonth()]
    return `${date.getDate()} ${month}, ${date.getFullYear()}`
  } else {
    const options: Intl.DateTimeFormatOptions = { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    }
    return date.toLocaleDateString('en-US', options)
  }
}

/**
 * Convert 24-hour time to 12-hour format with AM/PM
 */
function convertTo12Hour(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hours12 = hours % 12 || 12
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`
}

/**
 * Map internal message type to SmsType enum
 */
export function mapMessageTypeToSmsType(messageType: MessageType): SmsType {
  const typeMap: Record<MessageType, SmsType> = {
    'BOOKING_CONFIRMATION': 'BOOKING_CONFIRMATION',
    'REMINDER_24H': 'REMINDER_24H',
    'REMINDER_1H': 'REMINDER_1H',
    'CANCELLATION': 'CANCELLATION',
    'RESCHEDULE': 'RESCHEDULE',
    'CHECK_IN_CONFIRMATION': 'CHECK_IN_CONFIRMATION'
  }

  return typeMap[messageType]
}

/**
 * Get message preview for dashboard/UI
 * Returns shortened version for display
 */
export function getMessagePreview(message: string, maxLength: number = 100): string {
  if (message.length <= maxLength) return message
  return message.substring(0, maxLength - 3) + '...'
}

/**
 * Calculate estimated character count and SMS segments
 * SMS limit is 160 characters per segment
 */
export function calculateSMSStats(message: string): {
  characterCount: number
  segments: number
  estimatedCost: number
} {
  const characterCount = message.length
  const segments = Math.ceil(characterCount / 160)
  const costPerSegment = 0.02 // USD

  return {
    characterCount,
    segments,
    estimatedCost: segments * costPerSegment
  }
}

/**
 * Template variables helper
 * Returns all available variables for a message type
 */
export function getTemplateVariables(): Record<string, string> {
  return {
    '{patient_name}': 'Patient first name',
    '{date}': 'Appointment date (YYYY-MM-DD)',
    '{time}': 'Appointment time (HH:MM)',
    '{doctor_name}': 'Doctor/staff name',
    '{clinic_name}': 'Clinic name',
    '{clinic_phone}': 'Clinic phone number',
    '{address}': 'Clinic address'
  }
}
