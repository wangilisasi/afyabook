/**
 * Patient Search Page
 * Server Component
 */

import { prisma } from '@/lib/prisma'
import SearchClient from './SearchClient'

interface SearchPageProps {
  params: Promise<{ clinic_id: string }>
  searchParams: Promise<{ phone?: string }>
}

async function searchPatients(clinicId: string, phoneQuery: string) {
  const patients = await prisma.patient.findMany({
    where: {
      phoneNumber: {
        contains: phoneQuery
      }
    },
    include: {
      appointments: {
        where: {
          clinicId
        },
        include: {
          slot: {
            select: {
              slotDate: true,
              startTime: true,
              staff: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      }
    },
    take: 10
  })

  // Get visit counts for each patient
  const patientsWithStats = await Promise.all(
    patients.map(async (patient) => {
      const totalVisits = await prisma.appointment.count({
        where: {
          patientId: patient.id,
          clinicId,
          status: 'COMPLETED'
        }
      })

      const lastVisit = patient.appointments[0]?.slot.slotDate || null

      return {
        ...patient,
        totalVisits,
        lastVisit
      }
    })
  )

  return patientsWithStats
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { clinic_id } = await params
  const { phone } = await searchParams

  const patients = phone ? await searchPatients(clinic_id, phone) : []

  return (
    <SearchClient 
      clinicId={clinic_id}
      patients={patients}
      initialQuery={phone || ''}
    />
  )
}
