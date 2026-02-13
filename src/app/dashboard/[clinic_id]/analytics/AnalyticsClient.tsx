/**
 * Analytics Dashboard Client Component
 * Interactive charts and reports
 */

'use client'

import { useState, useEffect } from 'react'
import { format, subDays } from 'date-fns'

interface AnalyticsData {
  period: string
  dateRange: {
    start: string
    end: string
  }
  summary: {
    total: number
    completed: number
    noShows: number
    cancelled: number
    completionRate: number
    noShowRate: number
  }
  staffUtilization: Array<{
    id: string
    firstName: string
    lastName: string
    role: string
    appointmentCount: number
  }>
  smsStats: {
    total: number
    delivered: number
    failed: number
    deliveryRate: number
    totalCost: number
  }
  noShowAnalysis: {
    totalNoShows: number
    byDayOfWeek: number[]
    byTimeSlot: Record<string, number>
  }
  dailyBreakdown: Array<{
    date: string
    total: number
    completed: number
    noShows: number
  }>
  topPatients: Array<{
    id: string
    firstName: string
    lastName: string
    phoneNumber: string
    visitCount: number
  }>
}

interface AnalyticsClientProps {
  clinicId: string
  clinicName: string
  initialPeriod: string
}

export default function AnalyticsClient({ clinicId, clinicName }: AnalyticsClientProps) {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAnalytics()
  }, [period])

  const fetchAnalytics = async () => {
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch(`/api/analytics/${clinicId}?period=${period}`)
      if (!response.ok) throw new Error('Failed to fetch analytics')
      
      const analyticsData = await response.json()
      setData(analyticsData)
    } catch (err) {
      setError('Failed to load analytics data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 pb-24">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700">{error || 'No data available'}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ripoti / Analytics</h1>
        <p className="text-gray-600">{clinicName}</p>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 mb-6">
        {(['day', 'week', 'month'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              period === p
                ? 'bg-teal-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {p === 'day' ? 'Leo / Today' : p === 'week' ? 'Wiki / Week' : 'Mwezi / Month'}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          title="Jumla / Total"
          value={data.summary.total}
          color="blue"
        />
        <SummaryCard
          title="Imekamilika / Completed"
          value={data.summary.completed}
          subtitle={`${data.summary.completionRate}%`}
          color="green"
        />
        <SummaryCard
          title="Hajafika / No-Shows"
          value={data.summary.noShows}
          subtitle={`${data.summary.noShowRate}%`}
          color="red"
        />
        <SummaryCard
          title="Imeghairiwa / Cancelled"
          value={data.summary.cancelled}
          color="gray"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Daily Breakdown Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Shughuli za Kila Siku / Daily Activity
          </h2>
          <div className="space-y-3">
            {data.dailyBreakdown.map((day) => (
              <div key={day.date} className="flex items-center gap-3">
                <span className="w-20 text-sm text-gray-600">
                  {format(new Date(day.date), 'MMM d')}
                </span>
                <div className="flex-1 h-8 bg-gray-100 rounded-full overflow-hidden flex">
                  {day.completed > 0 && (
                    <div
                      className="bg-green-500 h-full"
                      style={{ width: `${(day.completed / day.total) * 100}%` }}
                    />
                  )}
                  {day.noShows > 0 && (
                    <div
                      className="bg-red-500 h-full"
                      style={{ width: `${(day.noShows / day.total) * 100}%` }}
                    />
                  )}
                </div>
                <span className="w-12 text-right text-sm font-medium">
                  {day.total}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-4 text-sm">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-green-500 rounded-full" />
              Imekamilika
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-red-500 rounded-full" />
              Hajafika
            </span>
          </div>
        </div>

        {/* Staff Utilization */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Watumiaji wa Wafanyakazi / Staff Utilization
          </h2>
          <div className="space-y-4">
            {data.staffUtilization.map((staff) => (
              <div key={staff.id}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">
                    Dr. {staff.firstName} {staff.lastName}
                  </span>
                  <span className="text-sm text-gray-600">
                    {staff.appointmentCount} miadi
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full"
                    style={{
                      width: `${Math.min((staff.appointmentCount / 20) * 100, 100)}%`
                    }}
                  />
                </div>
              </div>
            ))}
            {data.staffUtilization.length === 0 && (
              <p className="text-gray-500 text-center py-4">
                Hakuna data / No data
              </p>
            )}
          </div>
        </div>

        {/* SMS Statistics */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Takwimu za SMS / SMS Statistics
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-3xl font-bold text-blue-600">{data.smsStats.total}</p>
              <p className="text-sm text-blue-800">Jumla / Total</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-3xl font-bold text-green-600">{data.smsStats.deliveryRate}%</p>
              <p className="text-sm text-green-800">Kufika / Delivery</p>
            </div>
          </div>
          <div className="flex justify-between items-center py-2 border-t">
            <span className="text-gray-600">Imefika / Delivered</span>
            <span className="font-medium">{data.smsStats.delivered}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-t">
            <span className="text-gray-600">Imeshindwa / Failed</span>
            <span className="font-medium text-red-600">{data.smsStats.failed}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-t">
            <span className="text-gray-600">Gharama / Cost</span>
            <span className="font-medium">${data.smsStats.totalCost.toFixed(2)}</span>
          </div>
        </div>

        {/* Top Patients */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Wagomjwa Wanaoongoza / Top Patients
          </h2>
          <div className="space-y-3">
            {data.topPatients.map((patient, index) => (
              <div
                key={patient.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium">
                      {patient.firstName} {patient.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {patient.phoneNumber.replace(/(\+\d{3})(\d{3})(\d{3})(\d{3})/, '$1 *** *** $4')}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm font-medium">
                  {patient.visitCount} ziara
                </span>
              </div>
            ))}
            {data.topPatients.length === 0 && (
              <p className="text-gray-500 text-center py-4">
                Hakuna data / No data
              </p>
            )}
          </div>
        </div>
      </div>

      {/* No-Show Analysis */}
      {data.noShowAnalysis.totalNoShows > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Uchambuzi wa Wasiofika / No-Show Analysis
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* By Day of Week */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Kwa Siku ya Wiki / By Day of Week
              </h3>
              <div className="grid grid-cols-7 gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                  <div key={day} className="text-center">
                    <div
                      className={`h-16 rounded-lg flex items-end justify-center p-1 ${
                        data.noShowAnalysis.byDayOfWeek[i] > 0
                          ? 'bg-red-100'
                          : 'bg-gray-100'
                      }`}
                    >
                      {data.noShowAnalysis.byDayOfWeek[i] > 0 && (
                        <div
                          className="w-full bg-red-500 rounded"
                          style={{
                            height: `${Math.min(
                              (data.noShowAnalysis.byDayOfWeek[i] / data.noShowAnalysis.totalNoShows) * 100,
                              100
                            )}%`
                          }}
                        />
                      )}
                    </div>
                    <span className="text-xs text-gray-600 mt-1 block">{day}</span>
                    {data.noShowAnalysis.byDayOfWeek[i] > 0 && (
                      <span className="text-xs font-medium text-red-600">
                        {data.noShowAnalysis.byDayOfWeek[i]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* By Time Slot */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Kwa Muda / By Time
              </h3>
              <div className="space-y-2">
                {Object.entries(data.noShowAnalysis.byTimeSlot)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([hour, count]) => (
                    <div key={hour} className="flex items-center gap-2">
                      <span className="w-12 text-sm text-gray-600">{hour}:00</span>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-400 rounded-full"
                          style={{
                            width: `${(count / data.noShowAnalysis.totalNoShows) * 100}%`
                          }}
                        />
                      </div>
                      <span className="w-8 text-right text-sm">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date Range Info */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          Kipindi: {format(new Date(data.dateRange.start), 'MMM d, yyyy')} - {format(new Date(data.dateRange.end), 'MMM d, yyyy')}
        </p>
      </div>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  subtitle,
  color
}: {
  title: string
  value: number
  subtitle?: string
  color: 'blue' | 'green' | 'red' | 'gray'
}) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    gray: 'bg-gray-50 border-gray-200'
  }

  const valueColors = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    red: 'text-red-700',
    gray: 'text-gray-700'
  }

  return (
    <div className={`${colors[color]} border rounded-xl p-4`}>
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className={`text-3xl font-bold ${valueColors[color]}`}>{value}</p>
      {subtitle && (
        <p className={`text-sm ${valueColors[color]} mt-1`}>{subtitle}</p>
      )}
    </div>
  )
}
