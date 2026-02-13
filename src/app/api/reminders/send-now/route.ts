/**
 * POST /api/reminders/send-now
 * 
 * Manual override endpoint for triggering appointment reminders.
 * Protected by secret key for testing and emergency use.
 * 
 * QUERY PARAMETERS:
 * - secret_key (required): Secret key for authentication
 * - type (optional): '24h' | 'same_day' | 'all' - Which reminders to send
 * - appointment_id (optional): Send reminder for specific appointment only
 * - dry_run (optional): If 'true', simulate without sending actual SMS
 * 
 * REQUEST BODY:
 * {
 *   force?: boolean - Ignore already-sent flags and re-send
 *   testMode?: boolean - Log only, don't send SMS
 * }
 * 
 * RESPONSE:
 * {
 *   success: boolean,
 *   sent: number,
 *   failed: number,
 *   executionTimeMs: number,
 *   results: Array<{
 *     appointmentId: string,
 *     patientName: string,
 *     phone: string,
 *     type: '24h' | 'same_day',
 *     status: 'sent' | 'failed' | 'skipped',
 *     messageSid?: string,
 *     error?: string
 *   }>
 * }
 * 
 * EXAMPLES:
 * 
 * Test mode (no SMS sent):
 *   POST /api/reminders/send-now?secret_key=xxx&dry_run=true
 * 
 * Send specific reminder type:
 *   POST /api/reminders/send-now?secret_key=xxx&type=24h
 * 
 * Force re-send for a specific appointment:
 *   POST /api/reminders/send-now?secret_key=xxx&appointment_id=uuid
 *   Body: { "force": true }
 * 
 * WHY THIS EXISTS:
 * This endpoint serves as a manual override for the automated cron job.
 * Use cases:
 * 1. Testing SMS templates in development
 * 2. Emergency re-send after Twilio outage
 * 3. On-demand reminders for same-day bookings
 * 4. Debugging reminder issues in production
 * 
 * SECURITY NOTES:
 * - Always use HTTPS in production
 * - Rotate secret keys regularly
 * - Monitor usage via cron_logs table (triggered_by = 'manual')
 * - Rate limit this endpoint in production Vercel config
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendSMS, isTwilioConfigured } from '@/lib/sms/sms-service'
import { generateMessageContent, mapMessageTypeToSmsType } from '@/lib/sms/message-templates'
import { addHours, startOfDay, endOfDay } from 'date-fns'

// Configuration
const SECRET_KEY = process.env.REMINDERS_SECRET_KEY || 'dev-secret-key-change-in-production'
const TZ_OFFSET_HOURS = 3 // Tanzania is UTC+3

/**
 * Verify authorization
 */
function verifyAuthorization(request: NextRequest): boolean {
  const searchParams = request.nextUrl.searchParams
  const providedSecret = searchParams.get('secret_key')
  return providedSecret === SECRET_KEY
}

/**
 * Convert UTC Date to Tanzania Time (EAT - UTC+3)
 */
function toTanzaniaTime(utcDate: Date): Date {
  return new Date(utcDate.getTime() + (TZ_OFFSET_HOURS * 60 * 60 * 1000))
}

/**
 * Check if a date is "today" in Tanzania timezone
 */
function isTodayInTanzania(utcDate: Date): boolean {
  const tzNow = toTanzaniaTime(new Date())
  const tzDate = toTanzaniaTime(utcDate)
  
  return (
    tzDate.getFullYear() === tzNow.getFullYear() &&
    tzDate.getMonth() === tzNow.getMonth() &&
    tzDate.getDate() === tzNow.getDate()
  )
}

/**
 * Find appointments needing 24-hour reminders
 */
async function find24HourReminders(force: boolean = false) {
  const now = new Date()
  const tomorrow = addHours(now, 26) // Slightly wider window for manual trigger

  return await prisma.appointment.findMany({
    where: {
      status: {
        in: ['BOOKED', 'CONFIRMED']
      },
      ...(force ? {} : { reminder24hSent: false }),
      slot: {
        slotDate: {
          gte: now,
          lte: tomorrow
        }
      }
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          language: true
        }
      },
      slot: {
        select: {
          slotDate: true,
          startTime: true,
          staff: {
            select: {
              firstName: true,
              lastName: true,
              role: true
            }
          }
        }
      },
      clinic: {
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          address: true
        }
      }
    },
    orderBy: {
      slot: {
        slotDate: 'asc'
      }
    },
    take: 50
  })
}

/**
 * Find appointments needing same-day reminders
 */
async function findSameDayReminders(force: boolean = false) {
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)

  const appointments = await prisma.appointment.findMany({
    where: {
      status: {
        in: ['BOOKED', 'CONFIRMED']
      },
      ...(force ? {} : { reminderSameDaySent: false }),
      slot: {
        slotDate: {
          gte: todayStart,
          lte: todayEnd
        }
      }
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          language: true
        }
      },
      slot: {
        select: {
          slotDate: true,
          startTime: true,
          staff: {
            select: {
              firstName: true,
              lastName: true,
              role: true
            }
          }
        }
      },
      clinic: {
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          address: true
        }
      }
    },
    orderBy: {
      slot: {
        slotDate: 'asc'
      }
    },
    take: 50
  })

  // Filter to only include appointments that are actually "today" in Tanzania time
  return appointments.filter(apt => isTodayInTanzania(apt.slot.slotDate))
}

/**
 * Send reminder for a specific appointment
 */
async function sendReminder(
  appointment: any,
  type: '24h' | 'same_day',
  dryRun: boolean,
  force: boolean
): Promise<{
  success: boolean
  skipped?: boolean
  messageSid?: string
  error?: string
}> {
  const patient = appointment.patient
  const slot = appointment.slot
  const clinic = appointment.clinic

  // Check if already sent (unless forcing)
  if (!force) {
    if (type === '24h' && appointment.reminder24hSent) {
      return { success: false, skipped: true, error: '24h reminder already sent' }
    }
    if (type === 'same_day' && appointment.reminderSameDaySent) {
      return { success: false, skipped: true, error: 'Same-day reminder already sent' }
    }
  }

  // Generate message
  const messageType = type === '24h' ? 'REMINDER_24H' : 'REMINDER_1H'
  const messageContent = generateMessageContent({
    type: messageType,
    patient: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      language: (patient.language as 'sw' | 'en') || 'sw'
    },
    appointment: {
      date: slot.slotDate.toISOString().split('T')[0],
      time: slot.startTime,
      doctorName: `Dr. ${slot.staff.firstName} ${slot.staff.lastName}`,
      doctorRole: slot.staff.role,
      clinicName: clinic.name,
      clinicPhone: clinic.phoneNumber,
      address: clinic.address || undefined
    }
  })

  // Dry run - just log
  if (dryRun) {
    console.log(`[MANUAL] DRY RUN - Would send ${type} reminder:`, {
      to: patient.phoneNumber,
      message: messageContent.primary.substring(0, 50) + '...'
    })
    return { success: true, messageSid: 'DRY-RUN' }
  }

  // Send SMS
  try {
    const result = await sendSMS({
      to: patient.phoneNumber,
      message: messageContent.primary,
      type: mapMessageTypeToSmsType(messageType),
      appointmentId: appointment.id,
      patientId: patient.id,
      clinicId: clinic.id
    })

    if (result.success) {
      // Update flags
      if (type === '24h') {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: {
            reminder24hSent: true,
            reminder24hSentAt: new Date(),
            reminder24hFailed: false,
            reminder24hError: null
          }
        })
      } else {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: {
            reminderSameDaySent: true,
            reminderSameDaySentAt: new Date(),
            reminderSameDayFailed: false,
            reminderSameDayError: null
          }
        })
      }

      return { success: true, messageSid: result.messageSid }
    } else {
      throw new Error(result.error || 'SMS send failed')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: errorMessage }
  }
}

/**
 * POST handler for manual reminder trigger
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify authorization
    if (!verifyAuthorization(request)) {
      return NextResponse.json(
        {
          error: 'Ukomeshaji sio sahihi / Invalid authorization',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      )
    }

    // Check Twilio configuration
    if (!isTwilioConfigured()) {
      return NextResponse.json(
        {
          error: 'Twilio haijasanidiwa / Twilio not configured',
          code: 'TWILIO_NOT_CONFIGURED'
        },
        { status: 503 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const reminderType = searchParams.get('type') as '24h' | 'same_day' | 'all' | null
    const specificAppointmentId = searchParams.get('appointment_id')
    const dryRun = searchParams.get('dry_run') === 'true'

    // Parse body
    let force = false
    let testMode = false
    try {
      const body = await request.json()
      force = body?.force === true
      testMode = body?.testMode === true
    } catch {
      // No body or invalid JSON, continue with defaults
    }

    const results: Array<{
      appointmentId: string
      patientName: string
      phone: string
      type: '24h' | 'same_day'
      status: 'sent' | 'failed' | 'skipped'
      messageSid?: string
      error?: string
    }> = []

    let sent = 0
    let failed = 0
    let skipped = 0

    // Handle specific appointment
    if (specificAppointmentId) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: specificAppointmentId },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
              language: true
            }
          },
          slot: {
            select: {
              slotDate: true,
              startTime: true,
              staff: {
                select: {
                  firstName: true,
                  lastName: true,
                  role: true
                }
              }
            }
          },
          clinic: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              address: true
            }
          }
        }
      })

      if (!appointment) {
        return NextResponse.json(
          { error: 'Appointment not found', code: 'NOT_FOUND' },
          { status: 404 }
        )
      }

      // Determine reminder type based on timing
      const now = new Date()
      const appointmentDate = new Date(appointment.slot.slotDate)
      const hoursUntil = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60)

      const type = hoursUntil <= 4 ? 'same_day' : '24h'
      const result = await sendReminder(appointment, type, dryRun || testMode, force)

      results.push({
        appointmentId: appointment.id,
        patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
        phone: appointment.patient.phoneNumber,
        type,
        status: result.skipped ? 'skipped' : result.success ? 'sent' : 'failed',
        messageSid: result.messageSid,
        error: result.error
      })

      if (result.success) sent++
      else if (result.skipped) skipped++
      else failed++
    } else {
      // Find appointments based on type filter
      let appointments24h: any[] = []
      let appointmentsSameDay: any[] = []

      if (reminderType === '24h' || reminderType === 'all' || !reminderType) {
        appointments24h = await find24HourReminders(force)
      }

      if (reminderType === 'same_day' || reminderType === 'all' || !reminderType) {
        appointmentsSameDay = await findSameDayReminders(force)
      }

      // Send 24h reminders
      for (const apt of appointments24h) {
        const result = await sendReminder(apt, '24h', dryRun || testMode, force)
        results.push({
          appointmentId: apt.id,
          patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
          phone: apt.patient.phoneNumber,
          type: '24h',
          status: result.skipped ? 'skipped' : result.success ? 'sent' : 'failed',
          messageSid: result.messageSid,
          error: result.error
        })

        if (result.success) sent++
        else if (result.skipped) skipped++
        else failed++

        // Small delay between sends
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      // Send same-day reminders
      for (const apt of appointmentsSameDay) {
        const result = await sendReminder(apt, 'same_day', dryRun || testMode, force)
        results.push({
          appointmentId: apt.id,
          patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
          phone: apt.patient.phoneNumber,
          type: 'same_day',
          status: result.skipped ? 'skipped' : result.success ? 'sent' : 'failed',
          messageSid: result.messageSid,
          error: result.error
        })

        if (result.success) sent++
        else if (result.skipped) skipped++
        else failed++

        // Small delay between sends
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    const duration = Date.now() - startTime

    // Log to cron_logs for audit trail
    await prisma.cronLog.create({
      data: {
        jobName: 'send-reminders',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        status: failed === 0 ? 'SUCCESS' : sent > 0 ? 'PARTIAL' : 'FAILED',
        appointmentsChecked: results.length,
        remindersSent: sent,
        remindersFailed: failed,
        retriesAttempted: 0,
        durationMs: duration,
        triggeredBy: dryRun ? 'test' : 'manual'
      }
    })

    return NextResponse.json({
      success: failed === 0,
      sent,
      failed,
      skipped,
      dryRun: dryRun || testMode,
      executionTimeMs: duration,
      results: results.length > 0 ? results : undefined
    })

  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    console.error('[MANUAL] Error sending reminders:', errorMessage)

    return NextResponse.json(
      {
        error: 'Hitilafu katika kutuma kumbusho / Error sending reminders',
        code: 'INTERNAL_ERROR',
        message: errorMessage,
        executionTimeMs: duration
      },
      { status: 500 }
    )
  }
}

/**
 * GET handler for status check
 */
export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyAuthorization(request)) {
    return NextResponse.json(
      {
        error: 'Ukomeshaji sio sahihi / Invalid authorization',
        code: 'UNAUTHORIZED'
      },
      { status: 401 }
    )
  }

  try {
    const now = new Date()
    const tomorrow = addHours(now, 24)

    // Get counts
    const upcoming24h = await prisma.appointment.count({
      where: {
        status: { in: ['BOOKED', 'CONFIRMED'] },
        reminder24hSent: false,
        slot: {
          slotDate: {
            gte: now,
            lte: tomorrow
          }
        }
      }
    })

    const upcomingSameDay = await prisma.appointment.count({
      where: {
        status: { in: ['BOOKED', 'CONFIRMED'] },
        reminderSameDaySent: false,
        slot: {
          slotDate: {
            gte: startOfDay(now),
            lte: endOfDay(now)
          }
        }
      }
    })

    const failed24h = await prisma.appointment.count({
      where: {
        reminder24hFailed: true
      }
    })

    const failedSameDay = await prisma.appointment.count({
      where: {
        reminderSameDayFailed: true
      }
    })

    // Get recent cron runs
    const recentRuns = await prisma.cronLog.findMany({
      where: {
        jobName: 'send-reminders'
      },
      orderBy: {
        startedAt: 'desc'
      },
      take: 5,
      select: {
        id: true,
        startedAt: true,
        status: true,
        remindersSent: true,
        remindersFailed: true,
        triggeredBy: true,
        durationMs: true
      }
    })

    return NextResponse.json({
      status: 'ok',
      twilioConfigured: isTwilioConfigured(),
      pendingReminders: {
        '24h': upcoming24h,
        sameDay: upcomingSameDay,
        failed24h,
        failedSameDay
      },
      recentRuns,
      usage: {
        send24hReminders: 'POST /api/reminders/send-now?secret_key=xxx&type=24h',
        sendSameDayReminders: 'POST /api/reminders/send-now?secret_key=xxx&type=same_day',
        sendAll: 'POST /api/reminders/send-now?secret_key=xxx&type=all',
        testMode: 'POST /api/reminders/send-now?secret_key=xxx&dry_run=true',
        forceResend: 'POST with body: { "force": true }',
        specificAppointment: 'POST /api/reminders/send-now?secret_key=xxx&appointment_id=uuid'
      }
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Error fetching status',
        code: 'INTERNAL_ERROR',
        message: errorMessage
      },
      { status: 500 }
    )
  }
}
