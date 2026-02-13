/**
 * Error State for Quick Book Page
 */

'use client'

import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function QuickBookError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Quick book error:', error)
  }, [error])

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Hitilafu ya kuhifadhi
        </h2>
        <p className="text-gray-600 mb-2">
          Error loading booking page
        </p>
        <p className="text-sm text-red-600 mb-6">
          {error.message || 'Something went wrong'}
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-medium"
        >
          Jaribu tena / Try again
        </button>
      </div>
    </div>
  )
}
