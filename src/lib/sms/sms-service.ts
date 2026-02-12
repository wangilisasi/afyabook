/**
 * SMS Service for AfyaBook
 * Handles sending SMS via Twilio with comprehensive logging and error handling
 */

import twilio from 'twilio'
import { prisma } from '@/lib/prisma'
import { SmsType, SmsStatus } from '@prisma/client'

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER

if (!accountSid || !authToken || !fromPhoneNumber) {
  console.error('Missing Twilio environment variables')
}

const twilioClient = accountSid && authToken 
  ? twilio(accountSid, authToken)
  : null

// SMS Cost estimation (approximate rates for Tanzania)
const SMS_COST_USD = 0.02 // $0.02 per message to Tanzania

interface SendSMSParams {
  to: string
  message: string
  type: SmsType
  appointmentId?: string
  patientId?: string
  clinicId?: string
}

interface SendSMSResult {
  success: boolean
  messageSid?: string
  error?: string
  errorCode?: string
  cost?: number
}

/**
 * Send SMS via Twilio with full logging
 * 
 * @param params - SMS parameters
 * @returns Result with message SID or error details
 */
export async function sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
  const { to, message, type, appointmentId, patientId, clinicId } = params

  // Validate Twilio client is configured
  if (!twilioClient) {
    return {
      success: false,
      error: 'Twilio client not configured. Check environment variables.'
    }
  }

  // Validate phone number format
  const phoneRegex = /^\+[1-9]\d{1,14}$/
  if (!phoneRegex.test(to)) {
    return {
      success: false,
      error: 'Invalid phone number format. Must be E.164 format (+255XXXXXXXXX)',
      errorCode: 'INVALID_PHONE'
    }
  }

  // Create SMS log entry (pending)
  let smsLogId: string
  try {
    const smsLog = await prisma.smsLog.create({
      data: {
        patientId: patientId || null,
        clinicId: clinicId || null,
        phoneNumber: to,
        messageType: type,
        messageBody: message,
        status: 'PENDING',
        costUsd: SMS_COST_USD
      }
    })
    smsLogId = smsLog.id
  } catch (error) {
    console.error('Failed to create SMS log:', error)
    return {
      success: false,
      error: 'Failed to log SMS attempt',
      errorCode: 'LOG_ERROR'
    }
  }

  try {
    // Send SMS via Twilio
    const twilioMessage = await twilioClient.messages.create({
      body: message,
      from: fromPhoneNumber,
      to: to,
      statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL // Optional: webhook for delivery updates
    })

    // Update SMS log to SENT
    await prisma.smsLog.update({
      where: { id: smsLogId },
      data: {
        messageId: twilioMessage.sid,
        status: 'SENT',
        sentAt: new Date(),
        twilioResponse: JSON.stringify({
          sid: twilioMessage.sid,
          status: twilioMessage.status,
          direction: twilioMessage.direction,
          dateCreated: twilioMessage.dateCreated
        })
      }
    })

    // Update appointment reminder flags if applicable
    if (appointmentId && type === 'REMINDER_24H') {
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          reminderSent: true,
          reminderSentAt: new Date()
        }
      })
    }

    return {
      success: true,
      messageSid: twilioMessage.sid,
      cost: SMS_COST_USD
    }

  } catch (error: any) {
    // Handle Twilio errors
    const errorCode = error.code || 'UNKNOWN'
    const errorMessage = getTwilioErrorMessage(errorCode, error.message)

    console.error('Twilio SMS error:', {
      code: errorCode,
      message: error.message,
      to: to
    })

    // Update SMS log to FAILED
    await prisma.smsLog.update({
      where: { id: smsLogId },
      data: {
        status: 'FAILED',
        errorCode: errorCode,
        errorMessage: errorMessage,
        twilioResponse: JSON.stringify({
          error: error.message,
          code: errorCode,
          moreInfo: error.moreInfo
        })
      }
    })

    return {
      success: false,
      error: errorMessage,
      errorCode: errorCode
    }
  }
}

/**
 * Get human-readable error message for Twilio error codes
 */
function getTwilioErrorMessage(code: string, defaultMessage: string): string {
  const errorMessages: Record<string, string> = {
    '21211': 'Invalid phone number format',
    '21214': 'Phone number not valid for messaging',
    '21606': 'From number not valid for messaging',
    '21610': 'Message cannot be delivered to this number',
    '21612': 'To number not reachable',
    '21614': 'Not a mobile number',
    '30001': 'Queue overflow - too many messages queued',
    '30002': 'Account suspended',
    '30003': 'Unreachable destination handset',
    '30004': 'Message blocked',
    '30005': 'Unknown destination handset',
    '30006': 'Landline or unreachable carrier',
    '30007': 'Carrier violation - message filtered',
    '30008': 'Unknown error',
    '21602': 'Message body is required',
    '20003': 'Permission denied - check credentials',
    '20429': 'Rate limit exceeded - too many messages sent'
  }

  return errorMessages[code] || defaultMessage
}

/**
 * Update SMS status from Twilio webhook
 * 
 * @param messageSid - Twilio message SID
 * @param status - Delivery status from Twilio
 * @param errorCode - Optional error code
 */
export async function updateSMSStatus(
  messageSid: string,
  status: string,
  errorCode?: string
): Promise<void> {
  try {
    // Map Twilio status to our SmsStatus enum
    const mappedStatus = mapTwilioStatus(status)

    const updateData: any = {
      status: mappedStatus
    }

    if (mappedStatus === 'DELIVERED') {
      updateData.deliveredAt = new Date()
    }

    if (errorCode) {
      updateData.errorCode = errorCode
      updateData.errorMessage = getTwilioErrorMessage(errorCode, 'Delivery failed')
    }

    await prisma.smsLog.updateMany({
      where: { messageId: messageSid },
      data: updateData
    })

    console.log(`SMS ${messageSid} status updated to ${mappedStatus}`)
  } catch (error) {
    console.error('Failed to update SMS status:', error)
  }
}

/**
 * Map Twilio status to our internal status
 */
function mapTwilioStatus(twilioStatus: string): SmsStatus {
  const statusMap: Record<string, SmsStatus> = {
    'queued': 'PENDING',
    'accepted': 'SENT',
    'scheduled': 'PENDING',
    'sending': 'SENT',
    'sent': 'SENT',
    'delivered': 'DELIVERED',
    'undelivered': 'UNDELIVERED',
    'failed': 'FAILED',
    'received': 'DELIVERED',
    'canceled': 'FAILED'
  }

  return statusMap[twilioStatus.toLowerCase()] || 'FAILED'
}

/**
 * Get SMS statistics for a clinic
 * 
 * @param clinicId - Clinic UUID
 * @param startDate - Optional start date
 * @param endDate - Optional end date
 */
export async function getSMSStats(
  clinicId: string,
  startDate?: Date,
  endDate?: Date
) {
  const whereClause: any = {
    clinicId: clinicId
  }

  if (startDate || endDate) {
    whereClause.createdAt = {}
    if (startDate) whereClause.createdAt.gte = startDate
    if (endDate) whereClause.createdAt.lte = endDate
  }

  const stats = await prisma.smsLog.groupBy({
    by: ['status'],
    where: whereClause,
    _count: {
      id: true
    },
    _sum: {
      costUsd: true
    }
  })

  const totalCost = stats.reduce((sum, stat) => sum + (stat._sum.costUsd || 0), 0)

  return {
    byStatus: stats.map(stat => ({
      status: stat.status,
      count: stat._count.id,
      cost: stat._sum.costUsd || 0
    })),
    totalCost: totalCost,
    totalMessages: stats.reduce((sum, stat) => sum + stat._count.id, 0)
  }
}

/**
 * Check if Twilio is properly configured
 */
export function isTwilioConfigured(): boolean {
  return !!twilioClient && !!fromPhoneNumber
}

/**
 * Get SMS cost estimate
 */
export function getSMSCostEstimate(): number {
  return SMS_COST_USD
}
