/**
 * Patient Login Page
 * Simple phone-based authentication for patient portal
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PatientLoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/patient/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone })
      })

      if (response.ok) {
        const data = await response.json()
        // Store patient session
        document.cookie = `patient_session=${data.patientId}; path=/; max-age=86400`
        router.push('/patient/appointments')
      } else {
        const data = await response.json()
        setError(data.error || 'Nambari sio sahihi / Invalid number')
      }
    } catch {
      setError('Hitilafu ya mtandao / Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AfyaBook</h1>
          <p className="text-gray-600 mt-1">Portal ya Mgonjwa / Patient Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Namba ya Simu / Phone Number
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-gray-500">+</span>
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                className="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition"
                placeholder="255712345678"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Weka namba uliyosajilia / Enter your registered number
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || phone.length < 10}
            className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Inaingia...' : 'Ingia / Login'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="/login" className="text-sm text-teal-600 hover:text-teal-700">
            Ni mfanyakazi? Ingia hapa / Staff? Login here
          </a>
        </div>
      </div>
    </div>
  )
}
