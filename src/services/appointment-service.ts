/**
 * Appointment Service
 * Business logic for appointment operations
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { Prisma, AppointmentStatus } from '@prisma/client'
import { addHours, startOfDay, endOfDay } from 'date-fns'
import { toTanzaniaTime } from '@/lib/timezone'

export interface CreateAppointmentInput {
  slotId: string
  patientId: string
  clinicId: string
  appointmentType?: string
  notes?: string
}

export interface AppointmentFilters {
  clinicId?: string
  patientId?: string
  status?: AppointmentStatus
  startDate?: Date
  endDate?: Date
}

/**
 * Create a new appointment
 */
export async function createAppointment(input: CreateAppointmentInput) {
  const { slotId, patientId, clinicId, appointmentType = 'general', notes } = input

  // Check if slot exists and is available
  const slot = await prisma.appointmentSlot.findUnique({
    where: { id: slotId },
    include: { clinic: true }
  })

  if (!slot) {
    throw new Error('SLOT_NOT_FOUND')
  }

  if (!slot.isAvailable) {
    throw new Error('SLOT_NOT_AVAILABLE')
  }

  // Check if slot belongs to the clinic
  if (slot.clinicId !== clinicId) {
    throw new Error('SLOT_CLINIC_MISMATCH')
  }

  // Check if patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId }
  })

  if (!patient) {
    throw new Error('PATIENT_NOT_FOUND')
  }

  // Create appointment and mark slot as unavailable in a transaction
  const appointment = await prisma.$transaction(async (tx) => {
    // Create the appointment
    const newAppointment = await tx.appointment.create({
      data: {
        slotId,
        patientId,
        clinicId,
        appointmentType,
        notes,
        status: 'BOOKED'
      },
      include: {
        patient: true,
        slot: {
          include: {
            staff: true
          }
        },
        clinic: true
      }
    })

    // Mark slot as unavailable
    await tx.appointmentSlot.update({
      where: { id: slotId },
      data: { isAvailable: false }
    })

    return newAppointment
  })

  logger.info('Appointment created', {
    appointmentId: appointment.id,
    patientId,
    clinicId,
    slotId
  })

  return appointment
}

/**
 * Get appointments with filters
 */
export async function getAppointments(filters: AppointmentFilters) {
  const where: Prisma.AppointmentWhereInput = {}

  if (filters.clinicId) {
    where.clinicId = filters.clinicId
  }

  if (filters.patientId) {
    where.patientId = filters.patientId
  }

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.startDate || filters.endDate) {
    where.slot = {
      slotDate: {}
    }
    if (filters.startDate) {
      (where.slot as Prisma.AppointmentSlotWhereInput).slotDate!.gte = filters.startDate
    }
    if (filters.endDate) {
      (where.slot as Prisma.AppointmentSlotWhereInput).slotDate!.lte = filters.endDate
    }
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneNumber: true
        }
      },
      slot: {
        select: {
          id: true,
          startTime: true,
          endTime: true,
          staff: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return appointments
}

/**
 * Get today's appointments for a clinic
 */
export async function getTodaysAppointments(clinicId: string) {
  // Get today's date in Tanzania timezone
  const tzNow = toTanzaniaTime(new Date())
  const startOfToday = startOfDay(tzNow)
  const endOfToday = endOfDay(tzNow)

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId,
      slot: {
        slotDate: {
          gte: startOfToday,
          lte: endOfToday
        }
      }
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneNumber: true
        }
      },
      slot: {
        select: {
          id: true,
          startTime: true,
          endTime: true,
          staff: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true
            }
          }
        }
      }
    },
    orderBy: [
      { slot: { startTime: 'asc' } }
    ]
  })

  // Calculate summary statistics
  const summary = {
    total: appointments.length,
    byStatus: {} as Record<string, number>,
    checkedIn: 0,
    pending: 0,
    completed: 0,
    cancelled: 0
  }

  appointments.forEach(apt => {
    summary.byStatus[apt.status] = (summary.byStatus[apt.status] || 0) + 1
    
    if (apt.status === 'CHECKED_IN' || apt.status === 'COMPLETED') {
      summary.checkedIn++
    }
    
    if (['BOOKED', 'CONFIRMED', 'REMINDER_SENT'].includes(apt.status)) {
      summary.pending++
    }
    
    if (apt.status === 'COMPLETED') {
      summary.completed++
    }
    
    if (['CANCELLED', 'NO_SHOW'].includes(apt.status)) {
      summary.cancelled++
    }
  })

  return { appointments, summary }
}

/**
 * Update appointment status
 */
export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus
) {
  const appointment = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status },
    include: {
      patient: true,
      slot: true,
      clinic: true
    }
  })

  logger.info('Appointment status updated', {
    appointmentId,
    newStatus: status
  })

  return appointment
}

/**
 * Cancel an appointment
 */
export async function cancelAppointment(appointmentId: string, reason?: string) {
  const appointment = await prisma.$transaction(async (tx) => {
    // Update appointment status
    const updated = await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'CANCELLED',
        notes: reason ? `Cancelled: ${reason}` : undefined
      },
      include: {
        slot: true
      }
    })

    // Mark slot as available again
    await tx.appointmentSlot.update({
      where: { id: updated.slotId },
      data: { isAvailable: true }
    })

    return updated
  })

  logger.info('Appointment cancelled', {
    appointmentId,
    reason
  })

  return appointment
}

/**
 * Get appointment by ID
 */
export async function getAppointmentById(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: true,
      slot: {
        include: {
          staff: true
        }
      },
      clinic: true
    }
  })

  return appointment
}

/**
 * Get upcoming appointments for reminders
 */
export async function getUpcomingAppointmentsForReminders(hoursAhead: number = 24) {
  const now = new Date()
  const futureDate = addHours(now, hoursAhead + 1) // Buffer for processing

  const appointments = await prisma.appointment.findMany({
    where: {
      status: {
        in: ['BOOKED', 'CONFIRMED']
      },
      reminder24hSent: false,
      slot: {
        slotDate: {
          gte: now,
          lte: futureDate
        }
      }
    },
    include: {
      patient: true,
      slot: {
        include: {
          staff: true
        }
      },
      clinic: true
    }
  })

  return appointments
}
