/**
 * Analytics Service
 * Business logic for analytics and reporting
 */

import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'

export interface AnalyticsPeriod {
  startDate: Date
  endDate: Date
}

export type PeriodType = 'day' | 'week' | 'month'

/**
 * Get date range for analytics period
 */
export function getPeriodDateRange(period: PeriodType): AnalyticsPeriod {
  const now = new Date()
  
  switch (period) {
    case 'day':
      return {
        startDate: startOfDay(now),
        endDate: endOfDay(now)
      }
    case 'week':
      return {
        startDate: startOfWeek(now, { weekStartsOn: 1 }), // Monday
        endDate: endOfWeek(now, { weekStartsOn: 1 })
      }
    case 'month':
    default:
      return {
        startDate: startOfMonth(now),
        endDate: endOfMonth(now)
      }
  }
}

/**
 * Get appointment statistics
 */
export async function getAppointmentStats(clinicId: string, startDate: Date, endDate: Date) {
  const stats = await prisma.appointment.groupBy({
    by: ['status'],
    where: {
      clinicId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    _count: {
      id: true
    }
  })

  const total = stats.reduce((sum, s) => sum + s._count.id, 0)
  const completed = stats.find(s => s.status === 'COMPLETED')?._count.id || 0
  const noShows = stats.find(s => s.status === 'NO_SHOW')?._count.id || 0
  const cancelled = stats.find(s => s.status === 'CANCELLED')?._count.id || 0

  return {
    total,
    completed,
    noShows,
    cancelled,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    noShowRate: total > 0 ? Math.round((noShows / total) * 100) : 0
  }
}

/**
 * Get staff utilization
 */
export async function getStaffUtilization(clinicId: string, startDate: Date, endDate: Date) {
  const staffAppointments = await prisma.appointment.findMany({
    where: {
      clinicId,
      status: { in: ['COMPLETED', 'CHECKED_IN', 'BOOKED', 'CONFIRMED'] },
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
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
      }
    }
  })

  // Group by staff
  const staffMap = new Map()
  
  staffAppointments.forEach(apt => {
    const staff = apt.slot.staff
    if (!staffMap.has(staff.id)) {
      staffMap.set(staff.id, {
        ...staff,
        appointmentCount: 0
      })
    }
    staffMap.get(staff.id).appointmentCount++
  })

  return Array.from(staffMap.values())
    .sort((a, b) => b.appointmentCount - a.appointmentCount)
}

/**
 * Get SMS statistics
 */
export async function getSmsStats(clinicId: string, startDate: Date, endDate: Date) {
  const smsData = await prisma.smsLog.groupBy({
    by: ['status'],
    where: {
      clinicId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    _count: {
      id: true
    },
    _sum: {
      costUsd: true
    }
  })

  const total = smsData.reduce((sum, s) => sum + s._count.id, 0)
  const delivered = smsData.find(s => s.status === 'DELIVERED')?._count.id || 0
  const failed = smsData.find(s => s.status === 'FAILED')?._count.id || 0
  const totalCost = smsData.reduce((sum, s) => sum + (s._sum.costUsd || 0), 0)

  return {
    total,
    delivered,
    failed,
    deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
    totalCost: Math.round(totalCost * 100) / 100
  }
}

/**
 * Get no-show analysis
 */
export async function getNoShowAnalysis(clinicId: string, startDate: Date, endDate: Date) {
  const noShows = await prisma.appointment.findMany({
    where: {
      clinicId,
      status: 'NO_SHOW',
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      slot: {
        select: {
          slotDate: true,
          startTime: true
        }
      }
    }
  })

  const dayOfWeekCount = [0, 0, 0, 0, 0, 0, 0] // Sun-Sat
  const timeSlotCount: Record<string, number> = {}

  noShows.forEach(apt => {
    const day = new Date(apt.slot.slotDate).getDay()
    dayOfWeekCount[day]++
    
    const hour = apt.slot.startTime.split(':')[0]
    timeSlotCount[hour] = (timeSlotCount[hour] || 0) + 1
  })

  return {
    totalNoShows: noShows.length,
    byDayOfWeek: dayOfWeekCount,
    byTimeSlot: timeSlotCount
  }
}

/**
 * Get daily breakdown
 */
export async function getDailyBreakdown(clinicId: string, startDate: Date, endDate: Date) {
  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    select: {
      status: true,
      createdAt: true
    }
  })

  // Group by date
  const dailyMap = new Map()
  
  appointments.forEach(apt => {
    const date = apt.createdAt.toISOString().split('T')[0]
    if (!dailyMap.has(date)) {
      dailyMap.set(date, { date, total: 0, completed: 0, noShows: 0 })
    }
    const day = dailyMap.get(date)
    day.total++
    if (apt.status === 'COMPLETED') day.completed++
    if (apt.status === 'NO_SHOW') day.noShows++
  })

  return Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Get top patients
 */
export async function getTopPatients(clinicId: string, startDate: Date, endDate: Date, limit: number = 10) {
  const patientStats = await prisma.appointment.groupBy({
    by: ['patientId'],
    where: {
      clinicId,
      status: 'COMPLETED',
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    _count: {
      id: true
    }
  })

  // Get patient details for top patients
  const topPatientIds = patientStats
    .sort((a, b) => b._count.id - a._count.id)
    .slice(0, limit)
    .map(p => p.patientId)

  const patients = await prisma.patient.findMany({
    where: {
      id: { in: topPatientIds }
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneNumber: true
    }
  })

  return patientStats
    .slice(0, limit)
    .map(stat => {
      const patient = patients.find(p => p.id === stat.patientId)
      return {
        ...patient,
        visitCount: stat._count.id
      }
    })
}

/**
 * Get complete analytics for clinic
 */
export async function getClinicAnalytics(
  clinicId: string,
  period: PeriodType,
  customStartDate?: Date,
  customEndDate?: Date
) {
  const { startDate, endDate } = customStartDate && customEndDate
    ? { startDate: customStartDate, endDate: customEndDate }
    : getPeriodDateRange(period)

  const [
    appointmentStats,
    staffUtilization,
    smsStats,
    noShowAnalysis,
    dailyBreakdown,
    topPatients
  ] = await Promise.all([
    getAppointmentStats(clinicId, startDate, endDate),
    getStaffUtilization(clinicId, startDate, endDate),
    getSmsStats(clinicId, startDate, endDate),
    getNoShowAnalysis(clinicId, startDate, endDate),
    getDailyBreakdown(clinicId, startDate, endDate),
    getTopPatients(clinicId, startDate, endDate)
  ])

  return {
    period,
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    },
    summary: appointmentStats,
    staffUtilization,
    smsStats,
    noShowAnalysis,
    dailyBreakdown,
    topPatients
  }
}
