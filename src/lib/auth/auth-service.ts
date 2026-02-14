import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendSMS } from '@/lib/sms/sms-service'
import jwt, { Secret } from 'jsonwebtoken'

const JWT_SECRET: Secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const OTP_EXPIRY_MINUTES = 10
const SALT_ROUNDS = 12

/**
 * Generate a 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Create a JWT token
 */
export function createJWT(payload: object, expiresInMs: number = 8 * 60 * 60 * 1000): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: Math.floor(expiresInMs / 1000) })
}

/**
 * Verify a JWT token
 */
export function verifyJWT(token: string): object | null {
  try {
    return jwt.verify(token, JWT_SECRET) as object
  } catch {
    return null
  }
}

/**
 * Send OTP to patient via SMS
 */
export async function sendPatientOTP(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Format phone number
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`

    // Check if patient exists
    const patient = await prisma.patient.findUnique({
      where: { phoneNumber: formattedPhone },
      select: { id: true, firstName: true }
    })

    if (!patient) {
      return { success: false, error: 'Patient not found' }
    }

    // Generate OTP
    const otp = generateOTP()

    // Hash OTP for storage
    const hashedOTP = await hashPassword(otp)

    // Store OTP in database
    await prisma.patientOTP.upsert({
      where: { patientId: patient.id },
      update: {
        otp: hashedOTP,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
        attempts: 0,
        used: false
      },
      create: {
        patientId: patient.id,
        otp: hashedOTP,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
        attempts: 0,
        used: false
      }
    })

    // Send OTP via SMS
    const message = `Habari ${patient.firstName}, namba yako ya kuthibitisha ni: ${otp}. Itaisha baada ya dakika ${OTP_EXPIRY_MINUTES}. Usiishare na mtu yeyote.`
    
    const smsResult = await sendSMS({
      to: formattedPhone,
      message,
      type: 'VERIFICATION'
    })

    if (!smsResult.success) {
      logger.error('Failed to send OTP SMS', { phone: formattedPhone, error: smsResult.error })
      return { success: false, error: 'Failed to send OTP. Please try again.' }
    }

    logger.info('OTP sent successfully', { patientId: patient.id, phone: formattedPhone })
    return { success: true }

  } catch (error) {
    logger.error('Error sending OTP', { error: error instanceof Error ? error.message : String(error) })
    return { success: false, error: 'Internal server error' }
  }
}

/**
 * Verify patient OTP and return JWT token
 */
export async function verifyPatientOTP(
  phoneNumber: string, 
  otp: string
): Promise<{ 
  success: boolean
  token?: string
  patient?: {
    id: string
    firstName: string
    lastName: string
    phoneNumber: string
  }
  error?: string 
}> {
  try {
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`

    // Find patient
    const patient = await prisma.patient.findUnique({
      where: { phoneNumber: formattedPhone },
      select: { id: true, firstName: true, lastName: true, phoneNumber: true }
    })

    if (!patient) {
      return { success: false, error: 'Invalid OTP' }
    }

    // Get stored OTP
    const otpRecord = await prisma.patientOTP.findUnique({
      where: { patientId: patient.id }
    })

    if (!otpRecord) {
      return { success: false, error: 'OTP not found. Please request a new one.' }
    }

    // Check if already used
    if (otpRecord.used) {
      return { success: false, error: 'OTP already used. Please request a new one.' }
    }

    // Check expiry
    if (new Date() > otpRecord.expiresAt) {
      return { success: false, error: 'OTP expired. Please request a new one.' }
    }

    // Check max attempts
    if (otpRecord.attempts >= 3) {
      return { success: false, error: 'Too many failed attempts. Please request a new OTP.' }
    }

    // Verify OTP
    const isValid = await verifyPassword(otp, otpRecord.otp)

    if (!isValid) {
      // Increment attempts
      await prisma.patientOTP.update({
        where: { patientId: patient.id },
        data: { attempts: { increment: 1 } }
      })
      return { success: false, error: 'Invalid OTP' }
    }

    // Mark OTP as used
    await prisma.patientOTP.update({
      where: { patientId: patient.id },
      data: { used: true }
    })

    // Create JWT token
    const token = createJWT({
      patientId: patient.id,
      phoneNumber: patient.phoneNumber,
      type: 'patient'
    })

    logger.info('Patient authenticated successfully', { patientId: patient.id })

    return {
      success: true,
      token,
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        phoneNumber: patient.phoneNumber
      }
    }

  } catch (error) {
    logger.error('Error verifying OTP', { error: error instanceof Error ? error.message : String(error) })
    return { success: false, error: 'Internal server error' }
  }
}

/**
 * Hash clinic credentials for secure storage
 * Use this to hash passwords before storing in CLINIC_CREDENTIALS env var
 */
export async function hashClinicPassword(password: string): Promise<string> {
  return hashPassword(password)
}

/**
 * Verify clinic password against hash
 */
export async function verifyClinicPassword(password: string, hash: string): Promise<boolean> {
  return verifyPassword(password, hash)
}
