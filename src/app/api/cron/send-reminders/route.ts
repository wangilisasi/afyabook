/**
 * CRON /api/cron/send-reminders
 * 
 * Automated appointment reminder system using Vercel Cron.
 * Runs every hour to send SMS reminders for upcoming appointments.
 * 
 * TIMEZONE HANDLING:
 * - Tanzania (East Africa Time): UTC+3
 * - Tanzania does NOT observe daylight saving time
 * - All times stored in UTC, converted to EAT (UTC+3) for logic
 * 
 * REMINDER SCHEDULE:
 * - 24-hour reminder: Sent when appointment is 23-25 hours away
 * - Same-day reminder: Sent when appointment is 2-4 hours away on the same day
 * 
 * SECURITY:
 * - Verifies request originates from Vercel Cron (Authorization header)
 * - Logs all execution attempts for monitoring
 * 
 * RESPONSE:
 * {
 *   sent: number,           // Successfully sent reminders
 *   failed: number,         // Failed sends (after retry)
 *   skipped: number,        // Appointments not requiring reminders
 *   nextRun: string,        // ISO timestamp of next scheduled run
 *   executionTimeMs: number // Duration of this run
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendSMS, isTwilioConfigured } from '@/lib/sms/sms-service'
import { generateMessageContent, mapMessageTypeToSmsType } from '@/lib/sms/message-templates'
import { CronStatus, Prisma } from '@prisma/client'

// Configuration
const TZ_OFFSET_HOURS = 3 // Tanzania is UTC+3
const REMINDER_24H_WINDOW = { min: 23, max: 25 } // Hours before appointment
const REMINDER_SAME_DAY_WINDOW = { min: 2, max: 4 } // Hours before appointment
const MAX_RETRIES = 1 // Retry failed sends once

/**
 * Verify request is from Vercel Cron
 * Vercel sends a signed JWT in the Authorization header
 */
function verifyVercelCron(request: NextRequest): boolean {
  // In production, Vercel sends a signed JWT token
  // For security, we check the Authorization header
  const authHeader = request.headers.get('authorization')
  
  // Vercel Cron jobs include a signature we can verify
  if (!authHeader) {
    // In development, allow without header if CRON_SECRET is not set
    if (process.env.NODE_ENV === 'development' && !process.env.CRON_SECRET) {
      console.warn('[CRON] Running in development mode without CRON_SECRET')
      return true
    }
    return false
  }

  // Verify against our secret
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`
  if (process.env.CRON_SECRET && authHeader !== expectedToken) {
    console.error('[CRON] Invalid authorization header')
    return false
  }

  return true
}

/**
 * Convert UTC Date to Tanzania Time (EAT - UTC+3)
 * Tanzania does not observe daylight saving time
 */
function toTanzaniaTime(utcDate: Date): Date {
  return new Date(utcDate.getTime() + (TZ_OFFSET_HOURS * 60 * 60 * 1000))
}

/**
 * Convert Tanzania Time to UTC
 */
function fromTanzaniaTime(tzDate: Date): Date {
  return new Date(tzDate.getTime() - (TZ_OFFSET_HOURS * 60 * 60 * 1000))
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
 * Create a new cron log entry
 */
async function createCronLog(triggeredBy: string = 'cron'): Promise<string> {
  const log = await prisma.cronLog.create({
    data: {
      jobName: 'send-reminders',
      startedAt: new Date(),
      status: 'RUNNING',
      triggeredBy
    }
  })
  return log.id
}

/**
 * Update cron log with completion status
 */
async function updateCronLog(
  logId: string,
  status: CronStatus,
  stats: {
    appointmentsChecked: number
    remindersSent: number
    remindersFailed: number
    retriesAttempted: number
    durationMs: number
    errorMessage?: string
    errorStack?: string
  }
): Promise<void> {
  await prisma.cronLog.update({
    where: { id: logId },
    data: {
      status,
      completedAt: new Date(),
      appointmentsChecked: stats.appointmentsChecked,
      remindersSent: stats.remindersSent,
      remindersFailed: stats.remindersFailed,
      retriesAttempted: stats.retriesAttempted,
      durationMs: stats.durationMs,
      errorMessage: stats.errorMessage,
      errorStack: stats.errorStack
    }
  })
}

/**
 * Find appointments needing 24-hour reminders
 * Criteria: reminder_24h_sent = false AND appointment_time is between 23-25 hours from now
 */
async function find24HourReminders(): Promise<AppointmentWithDetails[]> {
  const now = new Date()
  const windowStart = new Date(now.getTime() + (REMINDER_24H_WINDOW.min * 60 * 60 * 1000))
  const windowEnd = new Date(now.getTime() + (REMINDER_24H_WINDOW.max * 60 * 60 * 1000))

  const appointments = await prisma.appointment.findMany({
    where: {
      status: {
        in: ['BOOKED', 'CONFIRMED']
      },
      reminder24hSent: false,
      reminder24hFailed: false,
      slot: {
        slotDate: {
          gte: windowStart,
          lte: windowEnd
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
          id: true,
          slotDate: true,
          startTime: true,
          staff: {
            select: {
              id: true,
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
    take: 100 // Process in batches to avoid overwhelming the system
  })

  return appointments
}

/**
 * Find appointments needing same-day reminders
 * Criteria: reminder_same_day_sent = false AND appointment is 2-4 hours away AND date is today
 */
async function findSameDayReminders(): Promise<AppointmentWithDetails[]> {
  const now = new Date()
  const windowStart = new Date(now.getTime() + (REMINDER_SAME_DAY_WINDOW.min * 60 * 60 * 1000))
  const windowEnd = new Date(now.getTime() + (REMINDER_SAME_DAY_WINDOW.max * 60 * 60 * 1000))

  const appointments = await prisma.appointment.findMany({
    where: {
      status: {
        in: ['BOOKED', 'CONFIRMED']
      },
      reminderSameDaySent: false,
      reminderSameDayFailed: false,
      slot: {
        slotDate: {
          gte: windowStart,
          lte: windowEnd
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
          id: true,
          slotDate: true,
          startTime: true,
          staff: {
            select: {
              id: true,
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
    take: 100
  })

  // Filter to only include appointments that are actually "today" in Tanzania time
  return appointments.filter(apt => isTodayInTanzania(apt.slot.slotDate))
}

/**
 * Send reminder SMS for an appointment
 */
async function sendReminder(
  appointment: AppointmentWithDetails,
  type: '24h' | 'same_day',
  retryCount: number = 0
): Promise<{ success: boolean; error?: string; retryAttempted: boolean }> {
  const patient = appointment.patient
  const slot = appointment.slot
  const clinic = appointment.clinic

  // Generate message content
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

  try {
    // Send SMS
    const result = await sendSMS({
      to: patient.phoneNumber,
      message: messageContent.primary,
      type: mapMessageTypeToSmsType(messageType),
      appointmentId: appointment.id,
      patientId: patient.id,
      clinicId: clinic.id
    })

    if (result.success) {
      // Update appointment flags
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

      return { success: true, retryAttempted: false }
    } else {
      throw new Error(result.error || 'SMS send failed')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Retry if we haven't exceeded max retries
    if (retryCount < MAX_RETRIES) {
      console.log(`[CRON] Retrying ${type} reminder for appointment ${appointment.id} (attempt ${retryCount + 1})`)
      await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second before retry
      return sendReminder(appointment, type, retryCount + 1)
    }

    // Mark as failed after retries exhausted
    if (type === '24h') {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          reminder24hFailed: true,
          reminder24hError: errorMessage
        }
      })
    } else {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          reminderSameDayFailed: true,
          reminderSameDayError: errorMessage
        }
      })
    }

    return { success: false, error: errorMessage, retryAttempted: retryCount > 0 }
  }
}

// Type definition for appointment with included relations
type AppointmentWithDetails = Awaited<ReturnType<typeof find24HourReminders>>[number]

/**
 * Main cron handler
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  let cronLogId: string | null = null

  try {
    // Verify request is from Vercel
    if (!verifyVercelCron(request)) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // Check Twilio configuration
    if (!isTwilioConfigured()) {
      const duration = Date.now() - startTime
      return NextResponse.json(
        { 
          error: 'Twilio not configured', 
          code: 'TWILIO_NOT_CONFIGURED',
          executionTimeMs: duration
        },
        { status: 503 }
      )
    }

    // Create cron log entry
    cronLogId = await createCronLog('cron')
    console.log(`[CRON] Starting reminder job ${cronLogId} at ${new Date().toISOString()}`)

    // Find appointments needing reminders
    const [appointments24h, appointmentsSameDay] = await Promise.all([
      find24HourReminders(),
      findSameDayReminders()
    ])

    const allAppointments = [...appointments24h, ...appointmentsSameDay]
    const uniqueAppointments = Array.from(
      new Map(allAppointments.map(apt => [apt.id, apt])).values()
    )

    console.log(`[CRON] Found ${appointments24h.length} 24h reminders, ${appointmentsSameDay.length} same-day reminders`)

    // Send reminders
    let sent = 0
    let failed = 0
    let retries = 0
    const results: Array<{
      appointmentId: string
      type: '24h' | 'same_day'
      status: 'sent' | 'failed'
      retryAttempted: boolean
      error?: string
    }> = []

    for (const appointment of uniqueAppointments) {
      const is24h = appointments24h.some(apt => apt.id === appointment.id)
      const type = is24h ? '24h' : 'same_day'

      const result = await sendReminder(appointment, type)
      
      if (result.success) {
        sent++
      } else {
        failed++
      }
      
      if (result.retryAttempted) {
        retries++
      }

      results.push({
        appointmentId: appointment.id,
        type,
        status: result.success ? 'sent' : 'failed',
        retryAttempted: result.retryAttempted,
        error: result.error
      })

      // Small delay between sends to avoid rate limiting
      if (uniqueAppointments.indexOf(appointment) < uniqueAppointments.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    const duration = Date.now() - startTime
    const status: CronStatus = failed === 0 ? 'SUCCESS' : sent > 0 ? 'PARTIAL' : 'FAILED'

    // Update cron log
    if (cronLogId) {
      await updateCronLog(cronLogId, status, {
        appointmentsChecked: uniqueAppointments.length,
        remindersSent: sent,
        remindersFailed: failed,
        retriesAttempted: retries,
        durationMs: duration
      })
    }

    console.log(`[CRON] Job ${cronLogId} completed: ${sent} sent, ${failed} failed, ${duration}ms`)

    // Calculate next run (top of next hour)
    const nextRun = new Date()
    nextRun.setHours(nextRun.getHours() + 1)
    nextRun.setMinutes(0)
    nextRun.setSeconds(0)
    nextRun.setMilliseconds(0)

    return NextResponse.json({
      sent,
      failed,
      skipped: uniqueAppointments.length === 0 ? 0 : undefined,
      totalChecked: uniqueAppointments.length,
      nextRun: nextRun.toISOString(),
      executionTimeMs: duration,
      cronLogId,
      status: status.toLowerCase(),
      details: results.length > 0 ? results : undefined
    })

  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error('[CRON] Job failed:', errorMessage)

    // Update cron log with failure
    if (cronLogId) {
      await updateCronLog(cronLogId, 'FAILED', {
        appointmentsChecked: 0,
        remindersSent: 0,
        remindersFailed: 0,
        retriesAttempted: 0,
        durationMs: duration,
        errorMessage,
        errorStack
      })
    }

    return NextResponse.json(
      {
        error: 'Cron job failed',
        code: 'INTERNAL_ERROR',
        message: errorMessage,
        executionTimeMs: duration,
        cronLogId
      },
      { status: 500 }
    )
  }
}
