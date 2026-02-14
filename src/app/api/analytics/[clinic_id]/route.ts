/**
 * GET /api/analytics/[clinic_id]
 * 
 * Returns analytics data for the dashboard
 * Query params:
 * - period: 'day' | 'week' | 'month' (default: 'week')
 * - startDate: ISO date string (optional)
 * - endDate: ISO date string (optional)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns'

import { requireAuth } from '@/lib/auth/middleware'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clinic_id: string }> }
) {
  try {
    // Require clinic authentication
    const authResult = requireAuth(request, { requiredType: 'clinic' })
    if (!authResult.success) {
      return authResult.response
    }

    const { clinic_id } = await params
    
    // Verify clinic is accessing their own data
    if (clinic_id !== authResult.auth.clinicId) {
      return NextResponse.json(
        { error: 'Access denied. Cannot view other clinic data.' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') as 'day' | 'week' | 'month' || 'week'
    
    // Calculate date range
    const now = new Date()
    let startDate: Date
    let endDate: Date
    
    if (searchParams.get('startDate') && searchParams.get('endDate')) {
      startDate = new Date(searchParams.get('startDate')!)
      endDate = new Date(searchParams.get('endDate')!)
    } else {
      switch (period) {
        case 'day':
          startDate = startOfDay(now)
          endDate = endOfDay(now)
          break
        case 'month':
          startDate = startOfMonth(now)
          endDate = endOfMonth(now)
          break
        case 'week':
        default:
          startDate = startOfWeek(now, { weekStartsOn: 1 }) // Monday
          endDate = endOfWeek(now, { weekStartsOn: 1 })
      }
    }

    // Fetch all analytics in parallel
    const [
      appointmentStats,
      staffUtilization,
      smsStats,
      noShowAnalysis,
      dailyBreakdown,
      topPatients
    ] = await Promise.all([
      getAppointmentStats(clinic_id, startDate, endDate),
      getStaffUtilization(clinic_id, startDate, endDate),
      getSmsStats(clinic_id, startDate, endDate),
      getNoShowAnalysis(clinic_id, startDate, endDate),
      getDailyBreakdown(clinic_id, startDate, endDate),
      getTopPatients(clinic_id, startDate, endDate)
    ])

    return NextResponse.json({
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
    })

  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

async function getAppointmentStats(clinicId: string, startDate: Date, endDate: Date) {
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

async function getStaffUtilization(clinicId: string, startDate: Date, endDate: Date) {
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

async function getSmsStats(clinicId: string, startDate: Date, endDate: Date) {
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

async function getNoShowAnalysis(clinicId: string, startDate: Date, endDate: Date) {
  // Get no-shows by day of week
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

async function getDailyBreakdown(clinicId: string, startDate: Date, endDate: Date) {
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

async function getTopPatients(clinicId: string, startDate: Date, endDate: Date) {
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

  // Get patient details for top 10
  const topPatientIds = patientStats
    .sort((a, b) => b._count.id - a._count.id)
    .slice(0, 10)
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
    .slice(0, 10)
    .map(stat => {
      const patient = patients.find(p => p.id === stat.patientId)
      return {
        ...patient,
        visitCount: stat._count.id
      }
    })
}
