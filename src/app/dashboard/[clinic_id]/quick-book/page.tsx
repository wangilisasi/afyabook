/**
 * Quick Book Page
 * Server Component - fetches initial data
 */

import { prisma } from '@/lib/prisma'
import { startOfDay, addDays } from 'date-fns'
import QuickBookClient from './QuickBookClient'

interface QuickBookPageProps {
  params: Promise<{ clinic_id: string }>
  searchParams: Promise<{ 
    patient?: string
    phone?: string
    slot?: string
  }>
}

async function getPatient(patientId: string) {
  return await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneNumber: true
    }
  })
}

async function getPatientByPhone(phone: string) {
  return await prisma.patient.findFirst({
    where: { phoneNumber: phone },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneNumber: true
    }
  })
}

async function getPreselectedSlot(slotId: string, clinicId: string) {
  return await prisma.appointmentSlot.findFirst({
    where: {
      id: slotId,
      clinicId,
      isAvailable: true
    },
    include: {
      staff: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          specialization: true
        }
      }
    }
  })
}

async function getAvailableSlots(clinicId: string) {
  const today = startOfDay(new Date())
  const nextWeek = addDays(today, 7)

  return await prisma.appointmentSlot.findMany({
    where: {
      clinicId,
      isAvailable: true,
      slotDate: {
        gte: today,
        lte: nextWeek
      }
    },
    include: {
      staff: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          specialization: true
        }
      }
    },
    orderBy: [
      { slotDate: 'asc' },
      { startTime: 'asc' }
    ],
    take: 50
  })
}

async function getStaff(clinicId: string) {
  return await prisma.staff.findMany({
    where: {
      clinicId,
      isActive: true
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      specialization: true
    },
    orderBy: {
      firstName: 'asc'
    }
  })
}

export default async function QuickBookPage({ params, searchParams }: QuickBookPageProps) {
  const { clinic_id } = await params
  const { patient: patientId, phone, slot: slotId } = await searchParams

  // Fetch initial data
  const [slots, staff, preselectedSlot] = await Promise.all([
    getAvailableSlots(clinic_id),
    getStaff(clinic_id),
    slotId ? getPreselectedSlot(slotId, clinic_id) : null
  ])

  // Fetch patient if provided
  let patient = null
  if (patientId) {
    patient = await getPatient(patientId)
  } else if (phone) {
    patient = await getPatientByPhone(phone)
  }

  return (
    <QuickBookClient
      clinicId={clinic_id}
      slots={slots}
      staff={staff}
      preselectedPatient={patient}
      preselectedSlot={preselectedSlot}
      initialPhone={phone || ''}
    />
  )
}
