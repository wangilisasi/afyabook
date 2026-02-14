/**
 * Zod Validation Schemas
 * Centralized validation for all API inputs
 */

import { z } from 'zod'

// ============================================================================
// Common Schemas
// ============================================================================

export const UUIDSchema = z.string().uuid()

export const PhoneNumberSchema = z.string().regex(/^\+[1-9]\d{1,14}$/, {
  message: 'Phone number must be in E.164 format (e.g., +255XXXXXXXXX)'
})

export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: 'Date must be in YYYY-MM-DD format'
})

export const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
  message: 'Time must be in HH:MM format'
})

// ============================================================================
// Auth Schemas
// ============================================================================

export const SendOTPSchema = z.object({
  phoneNumber: PhoneNumberSchema
})

export const VerifyOTPSchema = z.object({
  phoneNumber: PhoneNumberSchema,
  otp: z.string().regex(/^\d{6}$/, {
    message: 'OTP must be 6 digits'
  })
})

export const ClinicLoginSchema = z.object({
  clinicId: z.string().min(1, 'Clinic ID is required'),
  password: z.string().min(1, 'Password is required')
})

// ============================================================================
// Appointment Schemas
// ============================================================================

export const CreateAppointmentSchema = z.object({
  slotId: UUIDSchema,
  patientId: UUIDSchema,
  clinicId: UUIDSchema,
  appointmentType: z.enum(['general', 'follow_up', 'consultation', 'emergency']).default('general'),
  notes: z.string().optional()
})

export const UpdateAppointmentStatusSchema = z.object({
  status: z.enum(['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
})

export const GetAppointmentsQuerySchema = z.object({
  clinic_id: UUIDSchema.optional(),
  patient_id: UUIDSchema.optional(),
  status: z.enum(['BOOKED', 'CONFIRMED', 'REMINDER_SENT', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  date: DateSchema.optional(),
  start_date: DateSchema.optional(),
  end_date: DateSchema.optional()
})

// ============================================================================
// Slot Schemas
// ============================================================================

export const GetAvailableSlotsQuerySchema = z.object({
  clinic_id: UUIDSchema,
  date: DateSchema,
  service_type: z.string().optional()
})

// ============================================================================
// Patient Schemas
// ============================================================================

export const CreatePatientSchema = z.object({
  phoneNumber: PhoneNumberSchema,
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['M', 'F', 'O']).optional(),
  language: z.enum(['sw', 'en']).default('sw')
})

export const UpdatePatientSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['M', 'F', 'O']).optional(),
  language: z.enum(['sw', 'en']).optional(),
  preferredChannel: z.enum(['SMS', 'WHATSAPP', 'BOTH']).optional()
})

// ============================================================================
// Waitlist Schemas
// ============================================================================

export const CreateWaitlistEntrySchema = z.object({
  patientId: UUIDSchema,
  clinicId: UUIDSchema,
  preferredDate: z.string().datetime(),
  preferredTimeSlot: z.string().optional(),
  appointmentType: z.string().default('general'),
  staffId: UUIDSchema.optional(),
  priority: z.number().int().min(0).default(0),
  notes: z.string().optional()
})

// ============================================================================
// Reminder Schemas
// ============================================================================

export const SendRemindersQuerySchema = z.object({
  type: z.enum(['24h', 'same_day', 'all']).optional(),
  appointment_id: UUIDSchema.optional(),
  dry_run: z.enum(['true', 'false']).optional()
})

export const SendRemindersBodySchema = z.object({
  force: z.boolean().default(false),
  testMode: z.boolean().default(false)
})

// ============================================================================
// Analytics Schemas
// ============================================================================

export const GetAnalyticsQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month']).default('week'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
})

// ============================================================================
// Webhook Schemas
// ============================================================================

export const TwilioSmsStatusSchema = z.object({
  MessageSid: z.string(),
  MessageStatus: z.string(),
  To: z.string(),
  From: z.string().optional(),
  ErrorCode: z.string().optional()
})

export const TwilioStatusSchema = z.object({
  MessageSid: z.string(),
  MessageStatus: z.string(),
  To: z.string(),
  From: z.string(),
  ErrorCode: z.string().optional()
})
