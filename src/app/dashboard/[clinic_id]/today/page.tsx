/**
 * Today Dashboard Page
 * Server Component that fetches today's appointments
 */

import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'
import TodayClient from './TodayClient'

interface TodayPageProps {
  params: Promise<{ clinic_id: string }>
  searchParams: Promise<{ date?: string }>
}

async function getTodaySlots(clinicId: string, date: Date) {
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)

  const slots = await prisma.appointmentSlot.findMany({
    where: {
      clinicId,
      slotDate: {
        gte: dayStart,
        lte: dayEnd
      }
    },
    include: {
      staff: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true
        }
      },
      appointment: {
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true
            }
          }
        }
      }
    },
    orderBy: {
      startTime: 'asc'
    }
  })

  return slots
}

async function getStats(clinicId: string, date: Date) {
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)

  const [
    total,
    confirmed,
    checkedIn,
    noShow,
    completed
  ] = await Promise.all([
    prisma.appointment.count({
      where: {
        clinicId,
        slot: {
          slotDate: {
            gte: dayStart,
            lte: dayEnd
          }
        }
      }
    }),
    prisma.appointment.count({
      where: {
        clinicId,
        status: 'CONFIRMED',
        slot: {
          slotDate: {
            gte: dayStart,
            lte: dayEnd
          }
        }
      }
    }),
    prisma.appointment.count({
      where: {
        clinicId,
        status: 'CHECKED_IN',
        slot: {
          slotDate: {
            gte: dayStart,
            lte: dayEnd
          }
        }
      }
    }),
    prisma.appointment.count({
      where: {
        clinicId,
        status: 'NO_SHOW',
        slot: {
          slotDate: {
            gte: dayStart,
            lte: dayEnd
          }
        }
      }
    }),
    prisma.appointment.count({
      where: {
        clinicId,
        status: 'COMPLETED',
        slot: {
          slotDate: {
            gte: dayStart,
            lte: dayEnd
          }
        }
      }
    })
  ])

  return { total, confirmed, checkedIn, noShow, completed }
}

export default async function TodayPage({ params, searchParams }: TodayPageProps) {
  const { clinic_id } = await params
  const { date } = await searchParams
  
  // Parse date or use today
  const selectedDate = date ? new Date(date) : new Date()
  
  const [slots, stats] = await Promise.all([
    getTodaySlots(clinic_id, selectedDate),
    getStats(clinic_id, selectedDate)
  ])

  return (
    <TodayClient 
      clinicId={clinic_id}
      slots={slots}
      stats={stats}
      selectedDate={selectedDate}
    />
  )
}
