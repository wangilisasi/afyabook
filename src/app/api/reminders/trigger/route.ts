/**
 * POST /api/reminders/trigger
 * 
 * Manual trigger for sending appointment reminders
 * Protected by secret key for testing purposes
 * 
 * Query Parameters:
 * - secret_key (required): Secret key for authentication
 * - type (optional): '24h' | 'same_day' | 'all' - Which reminders to send
 * - appointment_id (optional): Send reminder for specific appointment
 * 
 * Request Body (optional):
 * {
 *   test_mode: boolean - If true, only logs SMS without sending
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   sent: number,
 *   failed: number,
 *   results: Array<{
 *     appointmentId: string,
 *     patientName: string,
 *     phone: string,
 *     status: 'sent' | 'failed' | 'skipped',
 *     messageSid?: string,
 *     error?: string
 *   }>,
 *   summary: {
 *     totalAppointments: number,
 *     remindersSent: number,
 *     alreadyReminded: number,
 *     errors: number
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendSMS, isTwilioConfigured } from '@/lib/sms/sms-service'
import { generateMessageContent, mapMessageTypeToSmsType } from '@/lib/sms/message-templates'
import { format, addHours, startOfDay, endOfDay } from 'date-fns'
import type { Prisma } from '@prisma/client'

const SECRET_KEY = process.env.REMINDERS_SECRET_KEY
if (!SECRET_KEY) {
  console.error('REMINDERS_SECRET_KEY environment variable is not set')
}

export async function POST(request: NextRequest) {
  try {
    // Verify secret key
    const searchParams = request.nextUrl.searchParams
    const providedSecret = searchParams.get('secret_key')

    if (providedSecret !== SECRET_KEY) {
      return NextResponse.json(
        {
          error: 'Ukomeshaji sio sahihi / Invalid authorization',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      )
    }

    // Check if Twilio is configured
    if (!isTwilioConfigured()) {
      return NextResponse.json(
        {
          error: 'Twilio haijasanidiwa / Twilio not configured',
          code: 'TWILIO_NOT_CONFIGURED'
        },
        { status: 503 }
      )
    }

    // Get parameters
    const reminderType = searchParams.get('type') as '24h' | 'same_day' | 'all' | null
    const specificAppointmentId = searchParams.get('appointment_id')

    // Parse body for test mode
    let testMode = false
    try {
      const body = await request.json()
      testMode = body?.test_mode === true
    } catch {
      // No body or invalid JSON, continue with defaults
    }

    const results: Array<{
      appointmentId: string
      patientName: string
      phone: string
      status: 'sent' | 'failed' | 'skipped'
      messageSid?: string
      error?: string
    }> = []

    const summary = {
      totalAppointments: 0,
      remindersSent: 0,
      alreadyReminded: 0,
      errors: 0
    }

    // If specific appointment ID provided, send for just that one
    if (specificAppointmentId) {
      const result = await sendReminderForAppointment(
        specificAppointmentId,
        testMode
      )
      results.push(result)
      summary.totalAppointments = 1
      if (result.status === 'sent') summary.remindersSent++
      if (result.status === 'skipped') summary.alreadyReminded++
      if (result.status === 'failed') summary.errors++
    } else {
      // Find appointments needing reminders
      const appointmentsToRemind = await findAppointmentsNeedingReminders(reminderType)
      summary.totalAppointments = appointmentsToRemind.length

      // Send reminders
      for (const appointment of appointmentsToRemind) {
        const result = await sendReminderForAppointment(appointment.id, testMode)
        results.push(result)

        if (result.status === 'sent') summary.remindersSent++
        else if (result.status === 'skipped') summary.alreadyReminded++
        else if (result.status === 'failed') summary.errors++
      }
    }

    return NextResponse.json({
      success: true,
      testMode: testMode,
      summary: summary,
      results: results
    })

  } catch (error) {
    console.error('Error triggering reminders:', error)
    return NextResponse.json(
      {
        error: 'Hitilafu katika kutuma kumbusho / Error sending reminders',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

/**
 * Find appointments that need reminders
 */
async function findAppointmentsNeedingReminders(
  type: '24h' | 'same_day' | 'all' | null
) {
  const now = new Date()
  const tomorrow = addHours(now, 24)
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const tomorrowStart = startOfDay(tomorrow)
  const tomorrowEnd = endOfDay(tomorrow)

  // Build base query conditions
  const whereConditions: Prisma.AppointmentWhereInput = {
    status: {
      in: ['BOOKED', 'CONFIRMED']
    },
    reminderSent: false
  }

  // Filter by reminder type
  if (type === '24h' || type === 'all') {
    // Appointments within next 24 hours
    whereConditions.slot = {
      slotDate: {
        gte: now,
        lte: tomorrow
      }
    }
  } else if (type === 'same_day') {
    // Appointments today
    whereConditions.slot = {
      slotDate: {
        gte: todayStart,
        lte: todayEnd
      }
    }
  }

  const appointments = await prisma.appointment.findMany({
    where: whereConditions,
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
        include: {
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
    take: 100 // Limit to prevent overwhelming the system
  })

  return appointments
}

/**
 * Send reminder for a specific appointment
 */
async function sendReminderForAppointment(
  appointmentId: string,
  testMode: boolean
): Promise<{
  appointmentId: string
  patientName: string
  phone: string
  status: 'sent' | 'failed' | 'skipped'
  messageSid?: string
  error?: string
}> {
  // Fetch appointment with all details
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
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
        include: {
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
    }
  })

  if (!appointment) {
    return {
      appointmentId,
      patientName: 'Unknown',
      phone: 'Unknown',
      status: 'failed',
      error: 'Appointment not found'
    }
  }

  const patient = appointment.patient
  const slot = appointment.slot
  const clinic = appointment.clinic

  // Check if already reminded
  if (appointment.reminderSent) {
    return {
      appointmentId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      phone: patient.phoneNumber,
      status: 'skipped',
      error: 'Reminder already sent'
    }
  }

  // Determine reminder type based on timing
  const now = new Date()
  const appointmentDate = new Date(slot.slotDate)
  const hoursUntil = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60)

  let messageType: 'REMINDER_24H' | 'REMINDER_1H'
  if (hoursUntil <= 1) {
    messageType = 'REMINDER_1H'
  } else {
    messageType = 'REMINDER_24H'
  }

  // Generate message content
  const messageContent = generateMessageContent({
    type: messageType,
    patient: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      language: (patient.language as 'sw' | 'en') || 'sw'
    },
    appointment: {
      date: format(slot.slotDate, 'yyyy-MM-dd'),
      time: slot.startTime,
      doctorName: `Dr. ${slot.staff.firstName} ${slot.staff.lastName}`,
      doctorRole: slot.staff.role,
      clinicName: clinic.name,
      clinicPhone: clinic.phoneNumber,
      address: clinic.address || undefined
    }
  })

  const messageText = messageContent.primary

  // If test mode, just log and return
  if (testMode) {
    console.log('TEST MODE - Would send SMS:', {
      to: patient.phoneNumber,
      message: messageText,
      type: messageType
    })

    return {
      appointmentId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      phone: patient.phoneNumber,
      status: 'sent',
      messageSid: 'TEST-MODE'
    }
  }

  // Send actual SMS
  const smsResult = await sendSMS({
    to: patient.phoneNumber,
    message: messageText,
    type: mapMessageTypeToSmsType(messageType),
    appointmentId: appointment.id,
    patientId: patient.id,
    clinicId: clinic.id
  })

  if (smsResult.success) {
    // Update appointment reminder flags
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        reminderSent: true,
        reminderSentAt: new Date(),
        status: 'REMINDER_SENT'
      }
    })

    return {
      appointmentId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      phone: patient.phoneNumber,
      status: 'sent',
      messageSid: smsResult.messageSid
    }
  } else {
    return {
      appointmentId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      phone: patient.phoneNumber,
      status: 'failed',
      error: smsResult.error
    }
  }
}

/**
 * GET endpoint for checking reminders status
 * Protected by same secret key
 */
export async function GET(request: NextRequest) {
  try {
    // Verify secret key
    const searchParams = request.nextUrl.searchParams
    const providedSecret = searchParams.get('secret_key')

    if (providedSecret !== SECRET_KEY) {
      return NextResponse.json(
        {
          error: 'Ukomeshaji sio sahihi / Invalid authorization',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      )
    }

    // Get upcoming appointments needing reminders
    const now = new Date()
    const tomorrow = addHours(now, 24)

    const upcomingAppointments = await prisma.appointment.count({
      where: {
        status: {
          in: ['BOOKED', 'CONFIRMED']
        },
        reminderSent: false,
        slot: {
          slotDate: {
            gte: now,
            lte: tomorrow
          }
        }
      }
    })

    const alreadyReminded = await prisma.appointment.count({
      where: {
        status: 'REMINDER_SENT',
        slot: {
          slotDate: {
            gte: now,
            lte: tomorrow
          }
        }
      }
    })

    return NextResponse.json({
      status: 'ok',
      twilioConfigured: isTwilioConfigured(),
      upcomingAppointmentsNeedingReminders: upcomingAppointments,
      alreadyRemindedToday: alreadyReminded,
      instructions: {
        sendAllReminders: 'POST /api/reminders/trigger?secret_key=YOUR_KEY&type=all',
        send24hReminders: 'POST /api/reminders/trigger?secret_key=YOUR_KEY&type=24h',
        testMode: 'POST with body: { "test_mode": true }'
      }
    })

  } catch (error) {
    console.error('Error getting reminders status:', error)
    return NextResponse.json(
      {
        error: 'Hitilafu katika kupata hali ya kumbusho / Error getting reminders status',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}
