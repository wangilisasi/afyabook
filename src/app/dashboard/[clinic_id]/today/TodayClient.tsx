/**
 * Today Dashboard Client Component
 * Interactive timeline with appointment management
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, addDays, subDays } from 'date-fns'

interface Staff {
  id: string
  firstName: string
  lastName: string
  role: string
}

interface Patient {
  id: string
  firstName: string
  lastName: string
  phoneNumber: string
}

interface Appointment {
  id: string
  status: string
  patient: Patient
}

interface Slot {
  id: string
  startTime: string
  endTime: string
  isAvailable: boolean
  staff: Staff
  appointment: Appointment | null
}

interface Stats {
  total: number
  confirmed: number
  checkedIn: number
  noShow: number
  completed: number
}

interface TodayClientProps {
  clinicId: string
  slots: Slot[]
  stats: Stats
  selectedDate: Date
}

const STATUS_COLORS: Record<string, string> = {
  BOOKED: 'bg-blue-100 text-blue-800 border-blue-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  REMINDER_SENT: 'bg-purple-100 text-purple-800 border-purple-200',
  CHECKED_IN: 'bg-green-100 text-green-800 border-green-200',
  COMPLETED: 'bg-gray-100 text-gray-800 border-gray-200',
  NO_SHOW: 'bg-red-100 text-red-800 border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200'
}

const STATUS_LABELS: Record<string, string> = {
  BOOKED: 'Umehifadhiwa',
  CONFIRMED: 'Imethibitishwa',
  REMINDER_SENT: 'Kumbusho Limetumwa',
  CHECKED_IN: 'Amefika',
  COMPLETED: 'Imekamilika',
  NO_SHOW: 'Hajafika',
  CANCELLED: 'Imeghairiwa'
}

export default function TodayClient({ clinicId, slots, stats, selectedDate }: TodayClientProps) {
  const router = useRouter()
  const [updatingSlots, setUpdatingSlots] = useState<Set<string>>(new Set())
  const [optimisticSlots, setOptimisticSlots] = useState<Slot[]>(slots)
  const [swipedSlot, setSwipedSlot] = useState<string | null>(null)
  const [touchStart, setTouchStart] = useState<number | null>(null)

  // Sync optimistic slots when server slots change
  useEffect(() => {
    setOptimisticSlots(slots)
  }, [slots])

  const handleDateChange = (days: number) => {
    const newDate = days > 0 
      ? addDays(selectedDate, days) 
      : subDays(selectedDate, Math.abs(days))
    
    const dateStr = format(newDate, 'yyyy-MM-dd')
    router.push(`/dashboard/${clinicId}/today?date=${dateStr}`)
  }

  const updateAppointmentStatus = useCallback(async (slotId: string, appointmentId: string, status: string) => {
    setUpdatingSlots(prev => new Set(prev).add(appointmentId))

    // Optimistic update
    setOptimisticSlots(prev => prev.map(slot => {
      if (slot.id === slotId && slot.appointment) {
        return {
          ...slot,
          appointment: {
            ...slot.appointment,
            status
          }
        }
      }
      return slot
    }))

    try {
      const response = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })

      if (!response.ok) {
        throw new Error('Failed to update')
      }
    } catch (error) {
      // Revert optimistic update on error
      setOptimisticSlots(slots)
      alert('Hitilafu katika kusasisha hali / Error updating status')
    } finally {
      setUpdatingSlots(prev => {
        const next = new Set(prev)
        next.delete(appointmentId)
        return next
      })
      setSwipedSlot(null)
    }
  }, [slots])

  // Touch handlers for swipe gestures
  const handleTouchStart = (e: React.TouchEvent, slotId: string) => {
    setTouchStart(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent, slotId: string) => {
    if (touchStart === null) return
    
    const touchEnd = e.changedTouches[0].clientX
    const diff = touchStart - touchEnd

    // Swipe left (show actions)
    if (diff > 50) {
      setSwipedSlot(slotId)
    }
    // Swipe right (hide actions)
    else if (diff < -50) {
      setSwipedSlot(null)
    }
    
    setTouchStart(null)
  }

  // Pull to refresh
  const [pullStart, setPullStart] = useState<number | null>(null)
  const [pulling, setPulling] = useState(false)

  const handlePullStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setPullStart(e.touches[0].clientY)
    }
  }

  const handlePullMove = (e: React.TouchEvent) => {
    if (pullStart !== null) {
      const diff = e.touches[0].clientY - pullStart
      if (diff > 0 && window.scrollY === 0) {
        setPulling(diff > 80)
      }
    }
  }

  const handlePullEnd = () => {
    if (pulling) {
      router.refresh()
    }
    setPullStart(null)
    setPulling(false)
  }

  const maskPhone = (phone: string) => {
    return phone.replace(/(\+\d{3})(\d{3})(\d{3})(\d{3})/, '$1 *** *** $4')
  }

  return (
    <div 
      className="p-4 pb-24"
      onTouchStart={handlePullStart}
      onTouchMove={handlePullMove}
      onTouchEnd={handlePullEnd}
    >
      {/* Pull to refresh indicator */}
      {pulling && (
        <div className="text-center py-4 text-teal-600">
          <svg className="animate-spin h-6 w-6 mx-auto mb-2" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">Inafurisha...</span>
        </div>
      )}

      {/* Date Navigation */}
      <div className="flex items-center justify-between mb-4 bg-white rounded-xl shadow-sm p-3">
        <button
          onClick={() => handleDateChange(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900">
            {format(selectedDate, 'EEEE, MMM d')}
          </p>
          <p className="text-sm text-gray-500">
            {format(selectedDate, 'yyyy')}
          </p>
        </div>
        
        <button
          onClick={() => handleDateChange(1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        <StatCard label="Jumla" value={stats.total} color="blue" />
        <StatCard label="Imethibitishwa" value={stats.confirmed} color="indigo" />
        <StatCard label="Amefika" value={stats.checkedIn} color="green" />
        <StatCard label="Imekamilika" value={stats.completed} color="gray" />
        <StatCard label="Hajafika" value={stats.noShow} color="red" />
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {optimisticSlots.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <p className="text-gray-500">Hakuna miadi leo</p>
            <p className="text-sm text-gray-400">No appointments today</p>
          </div>
        ) : (
          optimisticSlots.map((slot) => (
            <div
              key={slot.id}
              className="relative overflow-hidden"
              onTouchStart={(e) => handleTouchStart(e, slot.id)}
              onTouchEnd={(e) => handleTouchEnd(e, slot.id)}
            >
              {/* Swipe Actions */}
              {slot.appointment && (
                <div 
                  className={`absolute inset-y-0 right-0 flex items-center gap-1 px-2 transition-transform duration-200 ${
                    swipedSlot === slot.id ? 'translate-x-0' : 'translate-x-full'
                  }`}
                >
                  {slot.appointment.status !== 'CHECKED_IN' && (
                    <ActionButton
                      onClick={() => updateAppointmentStatus(slot.id, slot.appointment!.id, 'CHECKED_IN')}
                      color="blue"
                      icon="check"
                      label="Amefika"
                      loading={updatingSlots.has(slot.appointment.id)}
                    />
                  )}
                  {slot.appointment.status !== 'COMPLETED' && (
                    <ActionButton
                      onClick={() => updateAppointmentStatus(slot.id, slot.appointment!.id, 'COMPLETED')}
                      color="green"
                      icon="completed"
                      label="Imekamilika"
                      loading={updatingSlots.has(slot.appointment.id)}
                    />
                  )}
                  {slot.appointment.status !== 'NO_SHOW' && (
                    <ActionButton
                      onClick={() => updateAppointmentStatus(slot.id, slot.appointment!.id, 'NO_SHOW')}
                      color="red"
                      icon="x"
                      label="Hajafika"
                      loading={updatingSlots.has(slot.appointment.id)}
                    />
                  )}
                  {slot.appointment.status !== 'CANCELLED' && (
                    <ActionButton
                      onClick={() => updateAppointmentStatus(slot.id, slot.appointment!.id, 'CANCELLED')}
                      color="gray"
                      icon="cancel"
                      label="Ghairi"
                      loading={updatingSlots.has(slot.appointment.id)}
                    />
                  )}
                </div>
              )}

              {/* Slot Card */}
              <div 
                className={`bg-white rounded-xl shadow-sm border-2 transition-all duration-200 ${
                  swipedSlot === slot.id ? '-translate-x-48' : 'translate-x-0'
                } ${slot.isAvailable ? 'border-green-200' : 'border-gray-200'}`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Time & Staff */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-bold text-gray-900">
                          {slot.startTime}
                        </span>
                        <span className="text-sm text-gray-500">
                          {slot.staff.firstName} {slot.staff.lastName}
                        </span>
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600">
                          {slot.staff.role}
                        </span>
                      </div>

                      {/* Patient Info or Available */}
                      {slot.appointment ? (
                        <div className="mt-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-gray-900">
                              {slot.appointment.patient.firstName} {slot.appointment.patient.lastName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {maskPhone(slot.appointment.patient.phoneNumber)}
                          </div>
                          <div className="mt-3">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[slot.appointment.status]}`}>
                              {STATUS_LABELS[slot.appointment.status]}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                            Inapatikana / Available
                          </span>
                          <Link
                            href={`/dashboard/${clinicId}/quick-book?slot=${slot.id}`}
                            className="mt-2 inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Hifadhi miadi / Book appointment
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Mobile swipe hint */}
                    {slot.appointment && (
                      <div className="hidden sm:flex flex-col gap-1">
                        {slot.appointment.status !== 'CHECKED_IN' && (
                          <button
                            onClick={() => updateAppointmentStatus(slot.id, slot.appointment!.id, 'CHECKED_IN')}
                            disabled={updatingSlots.has(slot.appointment.id)}
                            className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 disabled:opacity-50"
                          >
                            Amefika
                          </button>
                        )}
                        {slot.appointment.status !== 'COMPLETED' && (
                          <button
                            onClick={() => updateAppointmentStatus(slot.id, slot.appointment!.id, 'COMPLETED')}
                            disabled={updatingSlots.has(slot.appointment.id)}
                            className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 disabled:opacity-50"
                          >
                            Imekamilika
                          </button>
                        )}
                        {slot.appointment.status !== 'CANCELLED' && (
                          <button
                            onClick={() => updateAppointmentStatus(slot.id, slot.appointment!.id, 'CANCELLED')}
                            disabled={updatingSlots.has(slot.appointment.id)}
                            className="px-3 py-1.5 bg-gray-400 text-white text-xs rounded-lg hover:bg-gray-500 disabled:opacity-50"
                          >
                            Ghairi
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-900',
    indigo: 'bg-indigo-50 text-indigo-900',
    green: 'bg-green-50 text-green-900',
    gray: 'bg-gray-50 text-gray-900',
    red: 'bg-red-50 text-red-900'
  }

  return (
    <div className={`${colors[color]} rounded-lg p-2 text-center`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs opacity-75">{label}</p>
    </div>
  )
}

function ActionButton({ 
  onClick, 
  color, 
  icon, 
  label, 
  loading 
}: { 
  onClick: () => void
  color: string
  icon: string
  label: string
  loading: boolean
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500 hover:bg-blue-600',
    green: 'bg-green-500 hover:bg-green-600',
    red: 'bg-red-500 hover:bg-red-600',
    gray: 'bg-gray-400 hover:bg-gray-500'
  }

  const icons: Record<string, React.ReactNode> = {
    check: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    completed: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    x: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    cancel: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`${colors[color]} text-white p-2 rounded-lg flex flex-col items-center gap-1 min-w-[60px] disabled:opacity-50`}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        icons[icon]
      )}
      <span className="text-xs">{label}</span>
    </button>
  )
}
