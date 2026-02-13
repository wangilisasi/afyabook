/**
 * Quick Book Client Component
 * Multi-step booking wizard
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

type Step = 'phone' | 'patient' | 'service' | 'slot' | 'confirm'

interface Staff {
  id: string
  firstName: string
  lastName: string
  role: string
  specialization: string | null
}

interface Slot {
  id: string
  slotDate: Date
  startTime: string
  endTime: string
  staff: Staff
}

interface Patient {
  id: string
  firstName: string
  lastName: string
  phoneNumber: string
}

interface QuickBookClientProps {
  clinicId: string
  slots: Slot[]
  staff: Staff[]
  preselectedPatient: Patient | null
  preselectedSlot: Slot | null
  initialPhone: string
}

const SERVICE_TYPES = [
  { value: 'general', label: 'Huduma ya jumla / General Consultation' },
  { value: 'followup', label: 'Ufuatiliaji / Follow-up Visit' },
  { value: 'emergency', label: 'Dharura / Emergency' },
  { value: 'prenatal', label: 'Ufuatiliaji wa ujauzito / Prenatal' },
  { value: 'vaccination', label: 'Chanjo / Vaccination' },
  { value: 'dental', label: 'Meno / Dental' },
  { value: 'lab', label: 'Maabara / Laboratory' }
]

export default function QuickBookClient({ 
  clinicId, 
  slots, 
  staff,
  preselectedPatient,
  preselectedSlot,
  initialPhone
}: QuickBookClientProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Form state
  const [phone, setPhone] = useState(initialPhone)
  const [patient, setPatient] = useState<Patient | null>(preselectedPatient)
  const [isNewPatient, setIsNewPatient] = useState(false)
  const [newPatientName, setNewPatientName] = useState('')
  const [serviceType, setServiceType] = useState('general')
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(preselectedSlot)
  const [bookingComplete, setBookingComplete] = useState(false)
  const [bookingResult, setBookingResult] = useState<{success: boolean; message: string} | null>(null)

  // Skip phone step if patient is preselected
  useEffect(() => {
    if (preselectedPatient) {
      setCurrentStep('service')
    }
  }, [preselectedPatient])

  // Skip slot step if slot is preselected
  useEffect(() => {
    if (preselectedSlot) {
      setSelectedSlot(preselectedSlot)
      if (preselectedPatient) {
        setCurrentStep('confirm')
      }
    }
  }, [preselectedSlot, preselectedPatient])

  const formatPhone = (phone: string) => {
    return phone.replace(/(\+\d{3})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')
  }

  const searchPatient = async () => {
    if (!phone.trim()) return
    
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/patients/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() })
      })
      const data = await response.json()
      
      if (data.patient) {
        setPatient(data.patient)
        setIsNewPatient(false)
        setCurrentStep('service')
      } else {
        setPatient(null)
        setIsNewPatient(true)
        setCurrentStep('patient')
      }
    } catch {
      setError('Hitilafu katika kutafuta / Error searching patient')
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePatient = async () => {
    if (!newPatientName.trim() || !phone.trim()) return
    
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/patients/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          name: newPatientName.trim()
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setPatient(data.patient)
        setCurrentStep('service')
      } else {
        setError(data.error || 'Failed to create patient')
      }
    } catch {
      setError('Hitilafu ya mtandao / Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleBookAppointment = async () => {
    if (!patient || !selectedSlot) return
    
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: selectedSlot.id,
          patient_id: patient.id,
          clinic_id: clinicId,
          appointment_type: serviceType
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setBookingComplete(true)
        setBookingResult({ success: true, message: 'Appointment booked successfully!' })
      } else {
        setBookingComplete(true)
        setBookingResult({ success: false, message: data.error || 'Failed to book appointment' })
      }
    } catch {
      setBookingComplete(true)
      setBookingResult({ success: false, message: 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  const goToStep = (step: Step) => {
    // Only allow going back or to adjacent steps
    const stepOrder: Step[] = ['phone', 'patient', 'service', 'slot', 'confirm']
    const currentIndex = stepOrder.indexOf(currentStep)
    const targetIndex = stepOrder.indexOf(step)
    
    if (targetIndex <= currentIndex) {
      setCurrentStep(step)
    }
  }

  // Progress indicator
  const StepIndicator = () => {
    const steps: { key: Step; label: string; icon: string }[] = [
      { key: 'phone', label: 'Simu', icon: '📞' },
      { key: 'patient', label: 'Mgonjwa', icon: '👤' },
      { key: 'service', label: 'Huduma', icon: '🏥' },
      { key: 'slot', label: 'Muda', icon: '🕐' },
      { key: 'confirm', label: 'Thibitisha', icon: '✓' }
    ]

    const stepOrder: Step[] = ['phone', 'patient', 'service', 'slot', 'confirm']
    const currentIndex = stepOrder.indexOf(currentStep)

    return (
      <div className="flex items-center justify-between mb-6 px-2 overflow-x-auto">
        {steps.map((step, index) => {
          const stepIndex = stepOrder.indexOf(step.key)
          const isActive = stepIndex === currentIndex
          const isCompleted = stepIndex < currentIndex
          const isClickable = stepIndex <= currentIndex

          // Skip patient step if not needed
          if (step.key === 'patient' && !isNewPatient) return null

          return (
            <div key={step.key} className="flex items-center">
              <button
                onClick={() => isClickable && goToStep(step.key)}
                disabled={!isClickable}
                className={`flex flex-col items-center gap-1 min-w-[60px] ${
                  isClickable ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-medium transition ${
                  isActive 
                    ? 'bg-teal-600 text-white ring-4 ring-teal-100' 
                    : isCompleted 
                      ? 'bg-teal-500 text-white' 
                      : 'bg-gray-200 text-gray-400'
                }`}>
                  {isCompleted ? '✓' : step.icon}
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${
                  isActive ? 'text-teal-600' : isCompleted ? 'text-teal-600' : 'text-gray-400'
                }`}>
                  {step.label}
                </span>
              </button>
              {index < steps.length - 1 && (
                <div className={`w-8 h-0.5 mx-2 ${
                  stepIndex < currentIndex ? 'bg-teal-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Step 1: Phone Input
  const PhoneStep = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">
        Weka namba ya simu / Enter phone number
      </h2>
      
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <span className="text-gray-500 font-medium">+</span>
        </div>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="255XXXXXXXXX"
          className="w-full pl-8 pr-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition"
          autoFocus
        />
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      
      <button
        onClick={searchPatient}
        disabled={loading || phone.length < 10}
        className="w-full py-4 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Inatafuta...
          </>
        ) : (
          <>
            Endelea / Continue
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </>
        )}
      </button>
    </div>
  )

  // Step 2: New Patient Registration
  const PatientStep = () => (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-yellow-800">
          <span className="font-medium">Mgonjwa mpya!</span> Tafadhali andika jina lake.
        </p>
        <p className="text-sm text-yellow-700 mt-1">
          New patient! Please enter their name.
        </p>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Jina kamili / Full name
        </label>
        <input
          type="text"
          value={newPatientName}
          onChange={(e) => setNewPatientName(e.target.value)}
          placeholder="e.g., Juma Abdallah"
          className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition"
          autoFocus
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Simu / Phone
        </label>
        <input
          type="tel"
          value={formatPhone(phone)}
          disabled
          className="w-full px-4 py-3 bg-gray-100 text-gray-600 rounded-xl"
        />
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      
      <div className="flex gap-3">
        <button
          onClick={() => setCurrentStep('phone')}
          className="flex-1 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition"
        >
          Rudi / Back
        </button>
        <button
          onClick={handleCreatePatient}
          disabled={loading || !newPatientName.trim()}
          className="flex-1 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? 'Inahifadhi...' : 'Sajili / Register'}
        </button>
      </div>
    </div>
  )

  // Step 3: Service Selection
  const ServiceStep = () => (
    <div className="space-y-4">
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
        <p className="font-medium text-teal-900">
          {patient?.firstName} {patient?.lastName}
        </p>
        <p className="text-sm text-teal-700">{formatPhone(patient?.phoneNumber || '')}</p>
      </div>
      
      <h2 className="text-xl font-bold text-gray-900">
        Chagua huduma / Select service
      </h2>
      
      <div className="space-y-2">
        {SERVICE_TYPES.map((service) => (
          <button
            key={service.value}
            onClick={() => {
              setServiceType(service.value)
              setCurrentStep('slot')
            }}
            className={`w-full p-4 text-left rounded-xl border-2 transition ${
              serviceType === service.value
                ? 'border-teal-500 bg-teal-50'
                : 'border-gray-200 hover:border-teal-300'
            }`}
          >
            <span className="font-medium text-gray-900">{service.label}</span>
          </button>
        ))}
      </div>
      
      <button
        onClick={() => setCurrentStep('phone')}
        className="w-full py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition"
      >
        Rudi / Back
      </button>
    </div>
  )

  // Step 4: Slot Selection
  const SlotStep = () => {
    // Group slots by date
    const groupedSlots = slots.reduce((acc, slot) => {
      const dateKey = format(new Date(slot.slotDate), 'yyyy-MM-dd')
      if (!acc[dateKey]) {
        acc[dateKey] = []
      }
      acc[dateKey].push(slot)
      return acc
    }, {} as Record<string, Slot[]>)

    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">
          Chagua muda / Select time
        </h2>
        
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {Object.entries(groupedSlots).map(([dateKey, dateSlots]) => (
            <div key={dateKey}>
              <h3 className="font-medium text-gray-700 mb-2 sticky top-0 bg-white py-2">
                {format(new Date(dateKey), 'EEEE, MMM d')}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {dateSlots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => {
                      setSelectedSlot(slot)
                      setCurrentStep('confirm')
                    }}
                    className={`p-3 rounded-xl border-2 text-left transition ${
                      selectedSlot?.id === slot.id
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-teal-300'
                    }`}
                  >
                    <p className="font-bold text-gray-900">{slot.startTime}</p>
                    <p className="text-xs text-gray-600">
                      Dr. {slot.staff.firstName} {slot.staff.lastName}
                    </p>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                      {slot.staff.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <button
          onClick={() => setCurrentStep('service')}
          className="w-full py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition"
        >
          Rudi / Back
        </button>
      </div>
    )
  }

  // Step 5: Confirmation
  const ConfirmStep = () => {
    if (!patient || !selectedSlot) return null

    const serviceLabel = SERVICE_TYPES.find(s => s.value === serviceType)?.label || serviceType

    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">
          Thibitisha / Confirm
        </h2>
        
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Mgonjwa / Patient:</span>
            <span className="font-medium">{patient.firstName} {patient.lastName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Simu / Phone:</span>
            <span className="font-medium">{formatPhone(patient.phoneNumber)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Huduma / Service:</span>
            <span className="font-medium">{serviceLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Tarehe / Date:</span>
            <span className="font-medium">{format(new Date(selectedSlot.slotDate), 'MMM d, yyyy')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Muda / Time:</span>
            <span className="font-medium">{selectedSlot.startTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Daktari / Doctor:</span>
            <span className="font-medium">Dr. {selectedSlot.staff.firstName} {selectedSlot.staff.lastName}</span>
          </div>
        </div>
        
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        
        <div className="flex gap-3">
          <button
            onClick={() => setCurrentStep('slot')}
            disabled={loading}
            className="flex-1 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
          >
            Rudi / Back
          </button>
          <button
            onClick={handleBookAppointment}
            disabled={loading}
            className="flex-1 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Inahifadhi...
              </>
            ) : (
              <>
                Thibitisha / Confirm
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  // Success/Error State
  if (bookingComplete && bookingResult) {
    return (
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <div className={`text-center py-12 rounded-2xl ${bookingResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
            bookingResult.success ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {bookingResult.success ? (
              <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          
          <h2 className={`text-2xl font-bold mb-2 ${bookingResult.success ? 'text-green-900' : 'text-red-900'}`}>
            {bookingResult.success ? 'Imefanikiwa!' : 'Imeshindwa'}
          </h2>
          <p className={`mb-6 ${bookingResult.success ? 'text-green-700' : 'text-red-700'}`}>
            {bookingResult.success ? 'Appointment booked successfully!' : bookingResult.message}
          </p>
          
          {bookingResult.success && (
            <p className="text-sm text-gray-600 mb-6">
              SMS ya uthibitisho imetumwa / Confirmation SMS sent
            </p>
          )}
          
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push(`/dashboard/${clinicId}/today`)}
              className="px-6 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition"
            >
              Rudi kwenye orodha / Back to list
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto">
      <StepIndicator />
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        {currentStep === 'phone' && <PhoneStep />}
        {currentStep === 'patient' && <PatientStep />}
        {currentStep === 'service' && <ServiceStep />}
        {currentStep === 'slot' && <SlotStep />}
        {currentStep === 'confirm' && <ConfirmStep />}
      </div>
    </div>
  )
}
