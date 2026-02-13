/**
 * Analytics Dashboard Page
 * Server Component
 */

import { prisma } from '@/lib/prisma'
import { startOfWeek, endOfWeek } from 'date-fns'
import AnalyticsClient from './AnalyticsClient'

interface AnalyticsPageProps {
  params: Promise<{ clinic_id: string }>
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { clinic_id } = await params
  
  // Get initial data for the current week
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
  
  // Get clinic info
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinic_id },
    select: { name: true }
  })

  return (
    <AnalyticsClient 
      clinicId={clinic_id}
      clinicName={clinic?.name || 'Unknown Clinic'}
      initialPeriod="week"
    />
  )
}
