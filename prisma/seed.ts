import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || 'file:./dev.db',
})

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Start seeding...')

  // ============================================================================
  // TEST CLINIC: Afya Health Centre - Dar es Salaam
  // ============================================================================
  
  const clinic = await prisma.clinic.create({
    data: {
      name: 'Afya Health Centre',
      phoneNumber: '+255713123456',
      address: '123 Kimweri Avenue, Kinondoni',
      region: 'Dar es Salaam',
      isActive: true,
      operatingHours: JSON.stringify({
        monday: { open: '08:00', close: '17:00', slots: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '16:00'] },
        tuesday: { open: '08:00', close: '17:00', slots: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '16:00'] },
        wednesday: { open: '08:00', close: '17:00', slots: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '16:00'] },
        thursday: { open: '08:00', close: '17:00', slots: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '16:00'] },
        friday: { open: '08:00', close: '17:00', slots: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '16:00'] },
        saturday: { open: '09:00', close: '13:00', slots: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'] },
        sunday: { open: null, close: null, slots: [] }
      }),
      timezone: 'Africa/Dar_es_Salaam'
    }
  })
  console.log(`Created clinic: ${clinic.name}`)

  // ============================================================================
  // STAFF: 3 medical personnel
  // ============================================================================

  const doctor1 = await prisma.staff.create({
    data: {
      clinicId: clinic.id,
      firstName: 'John',
      lastName: 'Mbalwa',
      phoneNumber: '+255713111111',
      role: 'doctor',
      specialization: 'general',
      licenseNumber: 'MD-TZ-2018-0042',
      isActive: true
    }
  })
  console.log(`Created staff: Dr. ${doctor1.firstName} ${doctor1.lastName}`)

  const doctor2 = await prisma.staff.create({
    data: {
      clinicId: clinic.id,
      firstName: 'Sarah',
      lastName: 'Kweka',
      phoneNumber: '+255713222222',
      role: 'doctor',
      specialization: 'pediatrics',
      licenseNumber: 'MD-TZ-2020-0089',
      isActive: true
    }
  })
  console.log(`Created staff: Dr. ${doctor2.firstName} ${doctor2.lastName}`)

  const nurse1 = await prisma.staff.create({
    data: {
      clinicId: clinic.id,
      firstName: 'Grace',
      lastName: 'Moshi',
      phoneNumber: '+255713333333',
      role: 'nurse',
      specialization: 'general',
      licenseNumber: 'RN-TZ-2019-0156',
      isActive: true
    }
  })
  console.log(`Created staff: Nurse ${nurse1.firstName} ${nurse1.lastName}`)

  // ============================================================================
  // APPOINTMENT SLOTS: One week of slots (Monday-Saturday)
  // ============================================================================
  
  const today = new Date()
  // Get next Monday
  const nextMonday = new Date(today)
  nextMonday.setDate(today.getDate() + (1 + 7 - today.getDay()) % 7)
  nextMonday.setHours(0, 0, 0, 0)

  const timeSlots = [
    { start: '08:00', end: '08:30' },
    { start: '08:30', end: '09:00' },
    { start: '09:00', end: '09:30' },
    { start: '09:30', end: '10:00' },
    { start: '10:00', end: '10:30' },
    { start: '10:30', end: '11:00' },
    { start: '11:00', end: '11:30' },
    { start: '14:00', end: '14:30' },
    { start: '14:30', end: '15:00' },
    { start: '15:00', end: '15:30' },
    { start: '15:30', end: '16:00' },
    { start: '16:00', end: '16:30' }
  ]

  const saturdaySlots = [
    { start: '09:00', end: '09:30' },
    { start: '09:30', end: '10:00' },
    { start: '10:00', end: '10:30' },
    { start: '10:30', end: '11:00' },
    { start: '11:00', end: '11:30' },
    { start: '11:30', end: '12:00' },
    { start: '12:00', end: '12:30' }
  ]

  let slotCount = 0

  // Create slots for Monday-Friday for all 3 staff
  for (let day = 0; day < 5; day++) {
    const slotDate = new Date(nextMonday)
    slotDate.setDate(nextMonday.getDate() + day)

    for (const staff of [doctor1, doctor2, nurse1]) {
      for (const time of timeSlots) {
        await prisma.appointmentSlot.create({
          data: {
            clinicId: clinic.id,
            staffId: staff.id,
            slotDate: slotDate,
            startTime: time.start,
            endTime: time.end,
            isAvailable: true
          }
        })
        slotCount++
      }
    }
  }

  // Create slots for Saturday (shorter hours)
  const saturday = new Date(nextMonday)
  saturday.setDate(nextMonday.getDate() + 5)

  for (const staff of [doctor1, doctor2]) { // Only doctors work Saturdays
    for (const time of saturdaySlots) {
      await prisma.appointmentSlot.create({
        data: {
          clinicId: clinic.id,
          staffId: staff.id,
          slotDate: saturday,
          startTime: time.start,
          endTime: time.end,
          isAvailable: true
        }
      })
      slotCount++
    }
  }

  console.log(`Created ${slotCount} appointment slots for the week`)

  // ============================================================================
  // EXAMPLE PATIENT
  // ============================================================================

  const patient = await prisma.patient.create({
    data: {
      phoneNumber: '+255712345678',
      firstName: 'Maria',
      lastName: 'Juma',
      dateOfBirth: new Date('1985-03-15'),
      gender: 'F',
      language: 'sw'
    }
  })
  console.log(`Created patient: ${patient.firstName} ${patient.lastName}`)

  // ============================================================================
  // EXAMPLE BOOKED APPOINTMENT
  // ============================================================================

  // Get a slot for tomorrow
  const tomorrow = new Date(nextMonday)
  tomorrow.setDate(nextMonday.getDate() + 1)

  const availableSlot = await prisma.appointmentSlot.findFirst({
    where: {
      clinicId: clinic.id,
      slotDate: tomorrow,
      startTime: '09:00',
      isAvailable: true
    }
  })

  if (availableSlot) {
    // Mark slot as unavailable
    await prisma.appointmentSlot.update({
      where: { id: availableSlot.id },
      data: { isAvailable: false }
    })

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        slotId: availableSlot.id,
        patientId: patient.id,
        clinicId: clinic.id,
        status: 'BOOKED',
        appointmentType: 'general',
        notes: 'Regular checkup'
      }
    })
    console.log(`Created appointment: ${appointment.id}`)
  }

  // ============================================================================
  // EXAMPLE SMS LOG
  // ============================================================================

  await prisma.smsLog.create({
    data: {
      patientId: patient.id,
      clinicId: clinic.id,
      phoneNumber: patient.phoneNumber,
      messageType: 'BOOKING_CONFIRMATION',
      messageBody: 'Habari Maria, umefanikiwa kuhifadhi miadi yako tarehe 13/02/2025 saa 3:00 asubuhi kwa Daktari Kweka. Tafadhali kuja dakika 10 kabla. Asante!',
      status: 'DELIVERED',
      sentAt: new Date(),
      deliveredAt: new Date(),
      costUsd: 0.0075
    }
  })
  console.log('Created SMS log entry')

  console.log('\n✅ Seeding completed successfully!')
  console.log(`\nSummary:
  - 1 Clinic: ${clinic.name}
  - 3 Staff members (2 doctors, 1 nurse)
  - ${slotCount} Appointment slots (Mon-Sat)
  - 1 Sample patient
  - 1 Sample appointment
  - 1 Sample SMS log`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
