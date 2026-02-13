/**
 * Patient Appointments Page
 * View upcoming and past appointments, cancel upcoming ones
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, isPast, parseISO } from 'date-fns'

interface Appointment {
  id: string
  status: string
  appointmentType: string
  notes: string | null
  clinic: {
    id: string
    name: string
    phoneNumber: string
    address: string | null
  }
  slot: {
    slotDate: Date
    startTime: string
    endTime: string
    staff: {
      firstName: string
      lastName: string
      role: string
    }
  }
}

export default function PatientAppointmentsPage() {
  const router = useRouter()
  const [upcoming, setUpcoming] = useState<Appointment[]>([])
  const [past, setPast] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  useEffect(() => {
    fetchAppointments()
  }, [])

  const fetchAppointments = async () => {
    try {
      const response = await fetch('/api/patient/appointments')
      
      if (response.status === 401) {
        router.push('/patient/login')
        return
      }
      
      if (!response.ok) throw new Error('Failed to fetch appointments')
      
      const data = await response.json()
      setUpcoming(data.upcoming || [])
      setPast(data.past || [])
    } catch (err) {
      setError('Failed to load appointments')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const cancelAppointment = async (appointmentId: string) => {
    if (!confirm('Una uhakika unataka kughairi miadi hii? / Are you sure you want to cancel this appointment?')) {
      return
    }

    setCancellingId(appointmentId)
    
    try {
      const response = await fetch(`/api/patient/appointments/${appointmentId}/cancel`, {
        method: 'PATCH'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to cancel')
      }

      // Refresh appointments
      await fetchAppointments()
      alert('Miadi imeghairiwa / Appointment cancelled successfully')
    } catch (err: any) {
      alert(err.message || 'Failed to cancel appointment')
    } finally {
      setCancellingId(null)
    }
  }

  const handleLogout = () => {
    document.cookie = 'patient_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
    router.push('/patient/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 bg-teal-200 rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Inapakia...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchAppointments}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg"
          >
            Jaribu tena / Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-teal-600 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Miadi Zangu</h1>
              <p className="text-teal-100 text-sm">My Appointments</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm bg-teal-700 hover:bg-teal-800 px-3 py-1.5 rounded-lg transition"
            >
              Toka / Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Upcoming Appointments */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Zinazokuja / Upcoming
          </h2>
          
          {upcoming.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-600 mb-1">Huna miadi ijayo</p>
              <p className="text-sm text-gray-500">You have no upcoming appointments</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcoming.map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  appointment={apt}
                  isUpcoming
                  onCancel={() => cancelAppointment(apt.id)}
                  isCancelling={cancellingId === apt.id}
                />
              ))}
            </div>
          )}
        </section>

        {/* Past Appointments */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Zilizopita / Past
          </h2>
          
          {past.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <p className="text-gray-600">Huna historia ya miadi</p>
              <p className="text-sm text-gray-500">No appointment history</p>
            </div>
          ) : (
            <div className="space-y-4">
              {past.map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  appointment={apt}
                  isUpcoming={false}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function AppointmentCard({
  appointment,
  isUpcoming,
  onCancel,
  isCancelling
}: {
  appointment: Appointment
  isUpcoming: boolean
  onCancel?: () => void
  isCancelling?: boolean
}) {
  const statusColors: Record<string, string> = {
    BOOKED: 'bg-blue-100 text-blue-800',
    CONFIRMED: 'bg-green-100 text-green-800',
    CHECKED_IN: 'bg-teal-100 text-teal-800',
    COMPLETED: 'bg-gray-100 text-gray-800',
    CANCELLED: 'bg-red-100 text-red-800',
    NO_SHOW: 'bg-orange-100 text-orange-800'
  }

  const statusLabels: Record<string, string> = {
    BOOKED: 'Imehifadhiwa',
    CONFIRMED: 'Imethibitishwa',
    CHECKED_IN: 'Amefika',
    COMPLETED: 'Imekamilika',
    CANCELLED: 'Imeghairiwa',
    NO_SHOW: 'Hajafika'
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-2xl font-bold text-gray-900">
            {format(parseISO(appointment.slot.slotDate.toString()), 'MMM d')}
          </p>
          <p className="text-gray-600">
            {appointment.slot.startTime} - {appointment.slot.endTime}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[appointment.status]}`}>
          {statusLabels[appointment.status]}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-gray-700">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <span className="font-medium">{appointment.clinic.name}</span>
        </div>

        <div className="flex items-center gap-2 text-gray-700">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>Dr. {appointment.slot.staff.firstName} {appointment.slot.staff.lastName}</span>
          <span className="text-sm text-gray-500">({appointment.slot.staff.role})</span>
        </div>

        {appointment.clinic.address && (
          <div className="flex items-center gap-2 text-gray-700">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm">{appointment.clinic.address}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-gray-700">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <a 
            href={`tel:${appointment.clinic.phoneNumber}`}
            className="text-teal-600 hover:text-teal-700"
          >
            {appointment.clinic.phoneNumber}
          </a>
        </div>

        {appointment.notes && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
            <span className="font-medium">Maelezo / Notes:</span> {appointment.notes}
          </div>
        )}
      </div>

      {isUpcoming && onCancel && (
        <button
          onClick={onCancel}
          disabled={isCancelling}
          className="w-full py-2.5 border-2 border-red-300 text-red-600 font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isCancelling ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Inaoghairiwa...
            </span>
          ) : (
            'Ghairi Miadi / Cancel Appointment'
          )}
        </button>
      )}
    </div>
  )
}
