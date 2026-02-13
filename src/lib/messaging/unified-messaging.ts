/**
 * Unified Messaging Service
 * Sends messages via SMS (Twilio) or WhatsApp (Business API) based on patient preference
 */

import { SmsType } from '@prisma/client'
import { sendSMS, isTwilioConfigured } from './sms-service'
import { 
  sendWhatsAppMessage, 
  sendAppointmentConfirmationWhatsApp, 
  sendReminderWhatsApp,
  isWhatsAppConfigured,
  checkWhatsAppNumber 
} from '../whatsapp/whatsapp-service'
import { prisma } from '@/lib/prisma'

type MessageChannel = 'SMS' | 'WHATSAPP' | 'BOTH'

interface SendMessageParams {
  to: string
  message: string
  type: SmsType
  channel: MessageChannel
  patientId?: string
  clinicId?: string
  appointmentId?: string
  // WhatsApp template params
  templateName?: string
  languageCode?: string
  components?: any[]
}

interface SendMessageResult {
  success: boolean
  smsResult?: { success: boolean; messageSid?: string; error?: string }
  whatsAppResult?: { success: boolean; messageId?: string; error?: string }
}

/**
 * Check which messaging channels are available
 */
export function getAvailableChannels(): MessageChannel[] {
  const channels: MessageChannel[] = []
  if (isTwilioConfigured()) channels.push('SMS')
  if (isWhatsAppConfigured()) channels.push('WHATSAPP')
  if (channels.length === 2) channels.push('BOTH')
  return channels
}

/**
 * Get patient's preferred messaging channel
 */
export async function getPatientMessagePreference(patientId: string): Promise<MessageChannel> {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { preferredChannel: true }
    })
    
    return (patient?.preferredChannel as MessageChannel) || 'SMS'
  } catch {
    return 'SMS'
  }
}

/**
 * Update patient's messaging preference
 */
export async function updatePatientMessagePreference(
  patientId: string, 
  channel: MessageChannel
): Promise<boolean> {
  try {
    await prisma.patient.update({
      where: { id: patientId },
      data: { preferredChannel: channel }
    })
    return true
  } catch (error) {
    console.error('Failed to update message preference:', error)
    return false
  }
}

/**
 * Send message via preferred channel(s)
 */
export async function sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
  const { to, channel, patientId, clinicId, appointmentId, type } = params
  
  const result: SendMessageResult = { success: false }

  // Send via SMS
  if (channel === 'SMS' || channel === 'BOTH') {
    if (isTwilioConfigured()) {
      result.smsResult = await sendSMS({
        to,
        message: params.message,
        type,
        patientId,
        clinicId,
        appointmentId
      })
    } else {
      result.smsResult = { success: false, error: 'SMS not configured' }
    }
  }

  // Send via WhatsApp
  if (channel === 'WHATSAPP' || channel === 'BOTH') {
    if (isWhatsAppConfigured() && params.templateName) {
      result.whatsAppResult = await sendWhatsAppMessage({
        to,
        templateName: params.templateName,
        languageCode: params.languageCode || 'sw',
        components: params.components || [],
        type,
        patientId,
        clinicId,
        appointmentId
      })
    } else {
      result.whatsAppResult = { 
        success: false, 
        error: isWhatsAppConfigured() ? 'Template required' : 'WhatsApp not configured' 
      }
    }
  }

  // Overall success if at least one channel succeeded
  result.success = 
    (result.smsResult?.success || false) || 
    (result.whatsAppResult?.success || false)

  return result
}

/**
 * Send appointment confirmation via preferred channel
 */
export async function sendAppointmentConfirmation(params: {
  to: string
  patientName: string
  appointmentDate: string
  appointmentTime: string
  doctorName: string
  clinicName: string
  clinicPhone: string
  channel: MessageChannel
  patientId?: string
  clinicId?: string
  appointmentId?: string
}): Promise<SendMessageResult> {
  const messageText = `Habari ${params.patientName}, umefanikiwa kuhudumu ${params.appointmentDate} saa ${params.appointmentTime} na ${params.doctorName}. Kliniki: ${params.clinicName}. Mawasiliano: ${params.clinicPhone}. Tafadhali kuja mapema. Asante!`

  return sendMessage({
    to: params.to,
    message: messageText,
    type: 'BOOKING_CONFIRMATION',
    channel: params.channel,
    patientId: params.patientId,
    clinicId: params.clinicId,
    appointmentId: params.appointmentId,
    templateName: 'appointment_confirmation_sw',
    languageCode: 'sw',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: params.patientName },
          { type: 'text', text: params.appointmentDate },
          { type: 'text', text: params.appointmentTime },
          { type: 'text', text: params.doctorName },
          { type: 'text', text: params.clinicName },
          { type: 'text', text: params.clinicPhone }
        ]
      }
    ]
  })
}

/**
 * Send appointment reminder via preferred channel
 */
export async function sendAppointmentReminder(params: {
  to: string
  patientName: string
  appointmentDate: string
  appointmentTime: string
  doctorName: string
  clinicName: string
  hoursUntil: number
  channel: MessageChannel
  patientId?: string
  clinicId?: string
  appointmentId?: string
}): Promise<SendMessageResult> {
  const isSameDay = params.hoursUntil <= 4
  
  const messageText = isSameDay
    ? `Habari ${params.patientName}, leo saa ${params.appointmentTime} una hudumu na ${params.doctorName} katika ${params.clinicName}. Tafadhali kuja mapema.`
    : `Kumbuka kesho ${params.appointmentDate} saa ${params.appointmentTime} una hudumu na ${params.doctorName} kutoka ${params.clinicName}. Mawasiliano: Tafadhali kuja mapema.`

  const templateName = isSameDay 
    ? 'appointment_reminder_same_day_sw' 
    : 'appointment_reminder_24h_sw'

  return sendMessage({
    to: params.to,
    message: messageText,
    type: isSameDay ? 'REMINDER_1H' : 'REMINDER_24H',
    channel: params.channel,
    patientId: params.patientId,
    clinicId: params.clinicId,
    appointmentId: params.appointmentId,
    templateName,
    languageCode: 'sw',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: params.patientName },
          { type: 'text', text: params.appointmentDate },
          { type: 'text', text: params.appointmentTime },
          { type: 'text', text: params.doctorName },
          { type: 'text', text: params.clinicName }
        ]
      }
    ]
  })
}

/**
 * Auto-detect best channel for a phone number
 * 1. Check if WhatsApp available
 * 2. If yes, return WHATSAPP (cheaper, higher open rate)
 * 3. If no, return SMS
 */
export async function detectBestChannel(phone: string): Promise<MessageChannel> {
  // If WhatsApp not configured, use SMS
  if (!isWhatsAppConfigured()) {
    return 'SMS'
  }

  // Check if number has WhatsApp
  const hasWhatsApp = await checkWhatsAppNumber(phone)
  
  if (hasWhatsApp) {
    return 'WHATSAPP'
  }

  return 'SMS'
}
