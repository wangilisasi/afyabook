/**
 * WhatsApp Business API Service
 * Handles sending messages via WhatsApp Business API
 * 
 * Note: This uses the WhatsApp Business API (not WhatsApp Web)
 * Requires Meta Business verification and WhatsApp Business account
 */

import { prisma } from '@/lib/prisma'
import { SmsType } from '@prisma/client'

// WhatsApp Business API configuration
const WHATSAPP_API_VERSION = 'v18.0'
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID

// WhatsApp template component parameter type
interface WhatsAppComponentParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document'
  text?: string
  currency?: {
    code: string
    amount_1000: number
  }
  date_time?: {
    fallback_value: string
  }
  image?: {
    link: string
  }
  document?: {
    link: string
    filename: string
  }
}

// WhatsApp template component type
interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button'
  parameters?: WhatsAppComponentParameter[]
  sub_type?: 'url' | 'quick_reply'
  index?: number
}

interface SendWhatsAppParams {
  to: string
  templateName: string
  languageCode: string
  components: WhatsAppTemplateComponent[]
  patientId?: string
  clinicId?: string
  appointmentId?: string
  type: SmsType
}

interface SendWhatsAppResult {
  success: boolean
  messageId?: string
  error?: string
  errorCode?: string
}

/**
 * Check if WhatsApp is configured
 */
export function isWhatsAppConfigured(): boolean {
  return !!WHATSAPP_PHONE_NUMBER_ID && !!WHATSAPP_ACCESS_TOKEN
}

/**
 * Format phone number for WhatsApp API
 * Must include country code, no + prefix for API
 */
function formatPhoneForWhatsApp(phone: string): string {
  // Remove + and any non-digit characters
  return phone.replace(/\D/g, '')
}

/**
 * Send WhatsApp message using Business API
 */
export async function sendWhatsAppMessage(
  params: SendWhatsAppParams
): Promise<SendWhatsAppResult> {
  const { to, templateName, languageCode, components, patientId, clinicId, appointmentId, type } = params

  if (!isWhatsAppConfigured()) {
    return {
      success: false,
      error: 'WhatsApp Business API not configured'
    }
  }

  // Validate phone number
  const formattedPhone = formatPhoneForWhatsApp(to)
  if (formattedPhone.length < 10) {
    return {
      success: false,
      error: 'Invalid phone number format',
      errorCode: 'INVALID_PHONE'
    }
  }

  // Create WhatsApp log entry
  let whatsAppLogId: string
  try {
    const log = await prisma.smsLog.create({
      data: {
        patientId: patientId || null,
        clinicId: clinicId || null,
        phoneNumber: to,
        messageType: type,
        messageBody: `WhatsApp Template: ${templateName}`,
        status: 'PENDING',
        costUsd: 0 // WhatsApp pricing varies by template type
      }
    })
    whatsAppLogId = log.id
  } catch (error) {
    console.error('Failed to create WhatsApp log:', error)
    return {
      success: false,
      error: 'Failed to log WhatsApp attempt'
    }
  }

  try {
    // Call WhatsApp Business API
    const response = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: languageCode
            },
            components: components
          }
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'WhatsApp API error')
    }

    // Update log to SENT
    await prisma.smsLog.update({
      where: { id: whatsAppLogId },
      data: {
        messageId: data.messages?.[0]?.id,
        status: 'SENT',
        sentAt: new Date(),
        twilioResponse: JSON.stringify(data)
      }
    })

    return {
      success: true,
      messageId: data.messages?.[0]?.id
    }

  } catch (error) {
    const err = error as { code?: string; message: string }
    console.error('WhatsApp API error:', error)

    // Update log to FAILED
    await prisma.smsLog.update({
      where: { id: whatsAppLogId },
      data: {
        status: 'FAILED',
        errorCode: err.code || 'UNKNOWN',
        errorMessage: err.message,
        twilioResponse: JSON.stringify({ error: err.message })
      }
    })

    return {
      success: false,
      error: err.message,
      errorCode: err.code
    }
  }
}

/**
 * Send appointment confirmation via WhatsApp
 */
export async function sendAppointmentConfirmationWhatsApp(params: {
  to: string
  patientName: string
  appointmentDate: string
  appointmentTime: string
  doctorName: string
  clinicName: string
  clinicPhone: string
  patientId?: string
  clinicId?: string
  appointmentId?: string
}): Promise<SendWhatsAppResult> {
  const components: WhatsAppTemplateComponent[] = [
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

  return sendWhatsAppMessage({
    to: params.to,
    templateName: 'appointment_confirmation_sw', // Must be pre-approved by Meta
    languageCode: 'sw', // Swahili
    components,
    patientId: params.patientId,
    clinicId: params.clinicId,
    appointmentId: params.appointmentId,
    type: 'BOOKING_CONFIRMATION'
  })
}

/**
 * Send appointment reminder via WhatsApp
 */
export async function sendReminderWhatsApp(params: {
  to: string
  patientName: string
  appointmentDate: string
  appointmentTime: string
  doctorName: string
  clinicName: string
  hoursUntil: number
  patientId?: string
  clinicId?: string
  appointmentId?: string
}): Promise<SendWhatsAppResult> {
  const templateName = params.hoursUntil <= 4 
    ? 'appointment_reminder_same_day_sw' 
    : 'appointment_reminder_24h_sw'

  const components: WhatsAppTemplateComponent[] = [
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

  return sendWhatsAppMessage({
    to: params.to,
    templateName,
    languageCode: 'sw',
    components,
    patientId: params.patientId,
    clinicId: params.clinicId,
    appointmentId: params.appointmentId,
    type: params.hoursUntil <= 4 ? 'REMINDER_1H' : 'REMINDER_24H'
  })
}

/**
 * WhatsApp message template type
 */
interface WhatsAppMessageTemplate {
  id: string
  name: string
  status: string
  category: string
  language: string
  components: WhatsAppTemplateComponent[]
}

/**
 * Get WhatsApp message templates
 * Must be pre-approved by Meta
 */
export async function getMessageTemplates(): Promise<WhatsAppMessageTemplate[]> {
  if (!isWhatsAppConfigured()) {
    return []
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`
        }
      }
    )

    const data = await response.json()
    return (data.data || []) as WhatsAppMessageTemplate[]
  } catch (error) {
    console.error('Failed to fetch WhatsApp templates:', error)
    return []
  }
}

/**
 * Check if phone number has WhatsApp
 */
export async function checkWhatsAppNumber(phone: string): Promise<boolean> {
  if (!isWhatsAppConfigured()) {
    return false
  }

  try {
    const formattedPhone = formatPhoneForWhatsApp(phone)
    
    const response = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/contacts`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          blocking: 'wait',
          contacts: [formattedPhone]
        })
      }
    )

    const data = await response.json()
    return data.contacts?.[0]?.status === 'valid'
  } catch (error) {
    console.error('WhatsApp number check error:', error)
    return false
  }
}
