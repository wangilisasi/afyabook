/**
 * Waitlist Auto-Fill Service
 * Automatically fills cancelled slots from waitlist
 */

import { prisma } from '@/lib/prisma'
import { sendAppointmentConfirmation } from '@/lib/messaging/unified-messaging'

// Patient type from waitlist query
interface WaitlistPatient {
  id: string
  firstName: string
  lastName: string
  phoneNumber: string
  preferredChannel: string
}

/**
 * Try to fill a cancelled slot from the waitlist
 * Called when an appointment is cancelled
 */
export async function tryFillFromWaitlist(
  slotId: string,
  clinicId: string
): Promise<{ success: boolean; filled?: boolean; patient?: WaitlistPatient; error?: string }> {
  try {
    // Get the slot details
    const slot = await prisma.appointmentSlot.findUnique({
      where: { id: slotId },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    if (!slot) {
      return { success: false, error: 'Slot not found' }
    }

    // Find matching waitlist entries
    // Prioritize by: preferred staff match, time slot match, priority, then FIFO
    const waitlistEntries = await prisma.waitlist.findMany({
      where: {
        clinicId,
        preferredDate: {
          gte: new Date(slot.slotDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
          lte: new Date(slot.slotDate.getTime() + 24 * 60 * 60 * 1000)  // 1 day after
        },
        status: 'WAITING'
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            preferredChannel: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ],
      take: 10 // Check top 10 candidates
    })

    if (waitlistEntries.length === 0) {
      return { success: true, filled: false }
    }

    // Score each candidate
    let bestMatch = null
    let bestScore = -1

    for (const entry of waitlistEntries) {
      let score = 0

      // Exact date match (+10 points)
      if (entry.preferredDate.toDateString() === slot.slotDate.toDateString()) {
        score += 10
      }

      // Preferred staff match (+5 points)
      if (entry.staffId && entry.staffId === slot.staffId) {
        score += 5
      }

      // Time slot preference match (+3 points)
      if (entry.preferredTimeSlot) {
        const slotHour = parseInt(slot.startTime.split(':')[0])
        if (entry.preferredTimeSlot === 'morning' && slotHour < 12) {
          score += 3
        } else if (entry.preferredTimeSlot === 'afternoon' && slotHour >= 12 && slotHour < 17) {
          score += 3
        } else if (entry.preferredTimeSlot === slot.startTime) {
          score += 5 // Exact time match is even better
        }
      }

      // Priority bonus
      score += entry.priority

      if (score > bestScore) {
        bestScore = score
        bestMatch = entry
      }
    }

    if (!bestMatch) {
      return { success: true, filled: false }
    }

    // Check if patient already has appointment on this date
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        patientId: bestMatch.patientId,
        clinicId,
        slot: {
          slotDate: slot.slotDate
        },
        status: {
          in: ['BOOKED', 'CONFIRMED']
        }
      }
    })

    if (existingAppointment) {
      // Patient already booked, mark waitlist as expired
      await prisma.waitlist.update({
        where: { id: bestMatch.id },
        data: { status: 'EXPIRED' }
      })
      return { success: true, filled: false }
    }

    // Create appointment for the waitlist patient
    const appointment = await prisma.appointment.create({
      data: {
        slotId: slot.id,
        patientId: bestMatch.patientId,
        clinicId,
        status: 'BOOKED',
        appointmentType: bestMatch.appointmentType,
        notes: bestMatch.notes
      }
    })

    // Update waitlist entry
    await prisma.waitlist.update({
      where: { id: bestMatch.id },
      data: {
        status: 'NOTIFIED',
        filledAt: new Date(),
        filledSlotId: slot.id
      }
    })

    // Mark slot as unavailable
    await prisma.appointmentSlot.update({
      where: { id: slot.id },
      data: { isAvailable: false }
    })

    // Send notification to patient
    try {
      const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { name: true, phoneNumber: true }
      })

      if (clinic) {
        await sendAppointmentConfirmation({
          to: bestMatch.patient.phoneNumber,
          patientName: bestMatch.patient.firstName,
          appointmentDate: slot.slotDate.toISOString().split('T')[0],
          appointmentTime: slot.startTime,
          doctorName: `Dr. ${slot.staff.firstName} ${slot.staff.lastName}`,
          clinicName: clinic.name,
          clinicPhone: clinic.phoneNumber,
          channel: (bestMatch.patient.preferredChannel as 'SMS' | 'WHATSAPP' | 'BOTH') || 'SMS',
          patientId: bestMatch.patientId,
          clinicId,
          appointmentId: appointment.id
        })
      }
    } catch (smsError) {
      console.error('Failed to send waitlist notification:', smsError)
      // Don't fail the whole operation if SMS fails
    }

    return {
      success: true,
      filled: true,
      patient: bestMatch.patient
    }

  } catch (error) {
    console.error('Waitlist auto-fill error:', error)
    return { success: false, error: 'Auto-fill failed' }
  }
}

/**
 * Process all open waitlist entries for a clinic
 * Can be called periodically or manually
 */
export async function processWaitlist(clinicId: string): Promise<{
  processed: number
  filled: number
  errors: number
}> {
  const stats = { processed: 0, filled: 0, errors: 0 }

  try {
    // Get all waiting entries
    const entries = await prisma.waitlist.findMany({
      where: {
        clinicId,
        status: 'WAITING',
        preferredDate: {
          gte: new Date() // Only future dates
        }
      },
      orderBy: [
        { preferredDate: 'asc' },
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    })

    for (const entry of entries) {
      stats.processed++

      // Find available slots matching preferences
      const availableSlots = await prisma.appointmentSlot.findMany({
        where: {
          clinicId,
          slotDate: {
            gte: new Date(entry.preferredDate.getTime() - 24 * 60 * 60 * 1000),
            lte: new Date(entry.preferredDate.getTime() + 24 * 60 * 60 * 1000)
          },
          isAvailable: true
        }
      })

      if (availableSlots.length > 0) {
        // Try to fill with best matching slot
        const result = await tryFillFromWaitlist(availableSlots[0].id, clinicId)
        if (result.filled) {
          stats.filled++
        }
      }
    }

    return stats

  } catch (error) {
    console.error('Waitlist processing error:', error)
    return { ...stats, errors: 1 }
  }
}
