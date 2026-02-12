/**
 * POST /api/webhooks/twilio/sms-status
 * 
 * Webhook endpoint for receiving Twilio SMS delivery status updates
 * Twilio sends these callbacks when message status changes
 * 
 * Expected Twilio Webhook Payload:
 * {
 *   MessageSid: string,
 *   MessageStatus: string,
 *   ErrorCode?: string,
 *   ErrorMessage?: string,
 *   From: string,
 *   To: string,
 *   Body: string,
 *   ApiVersion: string
 * }
 * 
 * Response: 200 OK (Twilio expects 200 for success)
 */

import { NextRequest, NextResponse } from 'next/server'
import { updateSMSStatus } from '@/lib/sms/sms-service'

// Validate Twilio webhook signature (optional but recommended for production)
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN

export async function POST(request: NextRequest) {
  try {
    // Parse the form data from Twilio
    const formData = await request.formData()
    
    // Extract key fields from Twilio webhook
    const messageSid = formData.get('MessageSid') as string
    const messageStatus = formData.get('MessageStatus') as string
    const errorCode = formData.get('ErrorCode') as string | null
    const errorMessage = formData.get('ErrorMessage') as string | null
    const to = formData.get('To') as string
    const from = formData.get('From') as string
    const body = formData.get('Body') as string

    // Validate required fields
    if (!messageSid || !messageStatus) {
      console.error('Invalid Twilio webhook: missing required fields', {
        messageSid,
        messageStatus
      })
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Log the webhook for debugging
    console.log('Twilio SMS status webhook received:', {
      messageSid,
      messageStatus,
      errorCode,
      to,
      timestamp: new Date().toISOString()
    })

    // Update SMS status in database
    await updateSMSStatus(messageSid, messageStatus, errorCode || undefined)

    // Log delivery failures for monitoring
    if (messageStatus === 'failed' || messageStatus === 'undelivered') {
      console.error('SMS delivery failed:', {
        messageSid,
        status: messageStatus,
        errorCode,
        errorMessage,
        to,
        body: body?.substring(0, 50) + '...'
      })

      // TODO: Add alerting here (e.g., send to monitoring service)
      // Example: await sendAlertToSlack({ messageSid, errorCode, to })
    }

    // Return 200 OK (Twilio expects this)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error processing Twilio webhook:', error)
    
    // Still return 200 to prevent Twilio retries (we logged the error)
    return NextResponse.json({ success: false, error: 'Processing error' })
  }
}

/**
 * GET endpoint for webhook verification
 * Returns instructions for setting up the webhook
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  
  return NextResponse.json({
    description: 'Twilio SMS Status Webhook Endpoint',
    setup: {
      twilioConsole: 'Configure this URL in Twilio Console > Messaging > Settings > Webhooks',
      url: `${url.protocol}//${url.host}/api/webhooks/twilio/sms-status`,
      method: 'POST',
      expectedContentType: 'application/x-www-form-urlencoded'
    },
    handledStatuses: [
      'queued',
      'sending',
      'sent',
      'delivered',
      'undelivered',
      'failed'
    ],
    security: {
      note: 'In production, validate Twilio signature using TWILIO_AUTH_TOKEN',
      documentation: 'https://www.twilio.com/docs/usage/security#validating-requests'
    },
    examplePayload: {
      MessageSid: 'SM1234567890abcdef1234567890abcdef',
      MessageStatus: 'delivered',
      ErrorCode: null,
      From: '+1234567890',
      To: '+255712345678',
      Body: 'Hello from AfyaBook'
    }
  })
}
