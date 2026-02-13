/**
 * Dashboard Layout
 * Provides navigation and common UI for all dashboard pages
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

interface DashboardLayoutProps {
  children: React.ReactNode
  params: Promise<{ clinic_id: string }>
}

async function getClinic(clinicId: string) {
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { id: true, name: true }
    })
    return clinic
  } catch {
    return null
  }
}

export default async function DashboardLayout({ 
  children, 
  params 
}: DashboardLayoutProps) {
  const { clinic_id } = await params
  
  // Verify session
  const cookieStore = await cookies()
  const session = cookieStore.get('clinic_session')
  
  if (!session || session.value !== clinic_id) {
    redirect('/login')
  }

  const clinic = await getClinic(clinic_id)
  
  if (!clinic) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-teal-600 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href={`/dashboard/${clinic_id}/today`} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <span className="font-bold text-lg hidden sm:block">{clinic.name}</span>
            </Link>
            
            <nav className="flex items-center gap-1 sm:gap-2">
              <NavLink href={`/dashboard/${clinic_id}/today`} icon="calendar">
                <span className="hidden sm:inline">Leo</span>
              </NavLink>
              <NavLink href={`/dashboard/${clinic_id}/search`} icon="search">
                <span className="hidden sm:inline">Tafuta</span>
              </NavLink>
              <NavLink href={`/dashboard/${clinic_id}/quick-book`} icon="plus">
                <span className="hidden sm:inline">Weka</span>
              </NavLink>
              <NavLink href={`/dashboard/${clinic_id}/analytics`} icon="chart">
                <span className="hidden sm:inline">Ripoti</span>
              </NavLink>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  )
}

function NavLink({ 
  href, 
  children, 
  icon 
}: { 
  href: string
  children: React.ReactNode
  icon: 'calendar' | 'search' | 'plus' | 'chart'
}) {
  const icons = {
    calendar: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    search: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    plus: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    chart: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  }

  return (
    <Link 
      href={href}
      className="flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-white/10 transition text-sm font-medium"
    >
      {icons[icon]}
      {children}
    </Link>
  )
}
