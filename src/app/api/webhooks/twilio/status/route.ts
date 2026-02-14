/**
 * POST /api/webhooks/twilio/status
 * 
 * Handles Twilio SMS delivery status callbacks.
 * Updates sms_logs table with delivery status from Twilio.
 * 
 * SECURITY: Validates Twilio signature to ensure requests are genuine
 * 
 * Expected Twilio webhook payload:
 * {
 *   MessageSid: 'SMxxxxx',
 *   MessageStatus: 'delivered' | 'failed' | 'undelivered' | etc,
 *   ErrorCode: '30001' (optional),
 *   From: '+1234567890',
 *   To: '+255712345678'
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// Map Twilio status to our internal status
const STATUS_MAP: Record<string, string> = {
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

/**
 * Validate Twilio request signature
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
function validateTwilioSignature(
  request: NextRequest,
  body: URLSearchParams
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  
  if (!authToken) {
    console.error('TWILIO_AUTH_TOKEN not configured')
    return false
  }

  // In production, get the signature from headers
  const signature = request.headers.get('x-twilio-signature')
  
  if (!signature) {
    console.error('Missing X-Twilio-Signature header')
    return false
  }

  // Construct the URL that Twilio used (your webhook URL)
  const url = process.env.TWILIO_STATUS_CALLBACK_URL || 
    `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}/api/webhooks/twilio/status`

  // Build the parameter string
  const params: Record<string, string> = {}
  body.forEach((value, key) => {
    params[key] = value
  })

  // Sort params alphabetically and concatenate
  const sortedKeys = Object.keys(params).sort()
  let data = url
  for (const key of sortedKeys) {
    data += key + params[key]
  }

  // Generate HMAC-SHA1
  const expectedSignature = crypto
    .createHmac('sha1', authToken)
    .update(data)
    .digest('base64')

  // Compare signatures (timing-safe)
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse the form data from Twilio
    const body = await request.text()
    const params = new URLSearchParams(body)

    const messageSid = params.get('MessageSid')
    const messageStatus = params.get('MessageStatus')
    const errorCode = params.get('ErrorCode')

    // Validate required fields
    if (!messageSid || !messageStatus) {
      console.error('Missing required fields from Twilio webhook')
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Skip signature validation in development (for testing)
    if (process.env.NODE_ENV === 'production') {
      const isValid = validateTwilioSignature(request, params)
      if (!isValid) {
        console.error('Invalid Twilio signature')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 403 }
        )
      }
    } else {
      console.log('[DEV] Skipping Twilio signature validation')
    }

    // Map Twilio status to our internal status
    const mappedStatus = STATUS_MAP[messageStatus.toLowerCase()]
    
    if (!mappedStatus) {
      console.warn(`Unknown Twilio status: ${messageStatus}`)
    }

    // Update SMS log
    const updateData: Record<string, unknown> = {
      status: mappedStatus || 'FAILED',
      twilioResponse: JSON.stringify({
        MessageSid: messageSid,
        MessageStatus: messageStatus,
        ErrorCode: errorCode,
        receivedAt: new Date().toISOString()
      })
    }

    // Set delivered time if delivered
    if (mappedStatus === 'DELIVERED') {
      updateData.deliveredAt = new Date()
    }

    // Set error info if failed
    if (errorCode) {
      updateData.errorCode = errorCode
      updateData.errorMessage = getErrorMessage(errorCode)
    }

    // Find and update the SMS log
    const updated = await prisma.smsLog.updateMany({
      where: { messageId: messageSid },
      data: updateData
    })

    if (updated.count === 0) {
      console.warn(`No SMS log found for MessageSid: ${messageSid}`)
    } else {
      console.log(`Updated SMS ${messageSid} status to ${mappedStatus}`)
    }

    // Return 200 OK to Twilio
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Twilio webhook error:', error)
    
    // Always return 200 to Twilio to prevent retries
    // Log the error but acknowledge receipt
    return NextResponse.json(
      { error: 'Internal error but acknowledged' },
      { status: 200 }
    )
  }
}

/**
 * Get human-readable error message for Twilio error codes
 */
function getErrorMessage(code: string): string {
  const errorMessages: Record<string, string> = {
    '30001': 'Queue overflow - too many messages queued',
    '30002': 'Account suspended',
    '30003': 'Unreachable destination handset',
    '30004': 'Message blocked',
    '30005': 'Unknown destination handset',
    '30006': 'Landline or unreachable carrier',
    '30007': 'Carrier violation - message filtered',
    '30008': 'Unknown error',
    '30009': 'Missing segment - one or more segments failed',
    '30010': 'Message price exceeds max price'
  }

  return errorMessages[code] || `Delivery error (${code})`
}
