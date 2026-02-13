/**
 * Patient Search Client Component
 */

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'

interface Appointment {
  id: string
  status: string
  slot: {
    slotDate: Date
    startTime: string
    staff: {
      firstName: string
      lastName: string
    }
  }
}

interface Patient {
  id: string
  firstName: string
  lastName: string
  phoneNumber: string
  appointments: Appointment[]
  totalVisits: number
  lastVisit: Date | null
}

interface SearchClientProps {
  clinicId: string
  patients: Patient[]
  initialQuery: string
}

const STATUS_LABELS: Record<string, string> = {
  BOOKED: 'Umehifadhiwa',
  CONFIRMED: 'Imethibitishwa',
  CHECKED_IN: 'Amefika',
  COMPLETED: 'Imekamilika',
  NO_SHOW: 'Hajafika',
  CANCELLED: 'Imeghairiwa'
}

const STATUS_COLORS: Record<string, string> = {
  BOOKED: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  CHECKED_IN: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  NO_SHOW: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-500'
}

export default function SearchClient({ clinicId, patients, initialQuery }: SearchClientProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [loading, setLoading] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      setLoading(true)
      router.push(`/dashboard/${clinicId}/search?phone=${encodeURIComponent(query.trim())}`)
    }
  }, [query, router, clinicId])

  const formatPhone = (phone: string) => {
    return phone.replace(/(\+\d{3})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')
  }

  return (
    <div className="p-4 pb-24 max-w-4xl mx-auto">
      {/* Search Form */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4">
          Tafuta Mgonjwa / Search Patient
        </h1>
        
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <input
              type="tel"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Weka namba ya simu... / Enter phone number"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              'Tafuta'
            )}
          </button>
        </form>
      </div>

      {/* Results */}
      {patients.length > 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {patients.length} mgonjwa wamepatikana / {patients.length} patients found
          </p>

          {patients.map((patient) => (
            <div 
              key={patient.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Patient Header */}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {patient.firstName} {patient.lastName}
                    </h3>
                    <p className="text-gray-600 mt-1">
                      {formatPhone(patient.phoneNumber)}
                    </p>
                    <div className="flex gap-4 mt-3 text-sm">
                      <span className="text-gray-600">
                        <span className="font-medium">{patient.totalVisits}</span> mazoea / visits
                      </span>
                      {patient.lastVisit && (
                        <span className="text-gray-600">
                          Mwisho / Last: {format(new Date(patient.lastVisit), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <Link
                    href={`/dashboard/${clinicId}/quick-book?patient=${patient.id}`}
                    className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition"
                  >
                    Hifadhi miadi / Book
                  </Link>
                </div>

                {/* Toggle History */}
                {patient.appointments.length > 0 && (
                  <button
                    onClick={() => setSelectedPatient(
                      selectedPatient?.id === patient.id ? null : patient
                    )}
                    className="mt-4 text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                  >
                    <svg 
                      className={`w-4 h-4 transition-transform ${selectedPatient?.id === patient.id ? 'rotate-180' : ''}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    {selectedPatient?.id === patient.id ? 'Ficha historia' : 'Onyesha historia'} / 
                    {selectedPatient?.id === patient.id ? 'Hide history' : 'Show history'}
                  </button>
                )}
              </div>

              {/* Appointment History */}
              {selectedPatient?.id === patient.id && patient.appointments.length > 0 && (
                <div className="border-t border-gray-200 bg-gray-50 p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Historia ya miadi / Appointment History
                  </h4>
                  <div className="space-y-2">
                    {patient.appointments.map((apt) => (
                      <div 
                        key={apt.id}
                        className="bg-white rounded-lg p-3 border border-gray-200 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {format(new Date(apt.slot.slotDate), 'MMM d, yyyy')} at {apt.slot.startTime}
                          </p>
                          <p className="text-sm text-gray-600">
                            Dr. {apt.slot.staff.firstName} {apt.slot.staff.lastName}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[apt.status]}`}>
                          {STATUS_LABELS[apt.status]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : initialQuery ? (
        <div className="text-center py-12 bg-white rounded-xl">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Hakuna mgonjwa aliyepatikana
          </h3>
          <p className="text-gray-600 mb-4">
            No patients found with phone number &quot;{initialQuery}&quot;
          </p>
          <Link
            href={`/dashboard/${clinicId}/quick-book?phone=${encodeURIComponent(initialQuery)}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Sajili mgonjwa mpya / Register new patient
          </Link>
        </div>
      ) : null}
    </div>
  )
}
