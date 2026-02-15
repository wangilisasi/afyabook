/**
 * OTP Service
 * Handles OTP generation and SMS sending for patient authentication
 */

import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { sendSMS } from "@/lib/sms/sms-service"

const OTP_EXPIRY_MINUTES = 10
const SALT_ROUNDS = 12

/**
 * Generate a 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Send OTP to patient via SMS
 */
export async function sendPatientOTP(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Format phone number
    const formattedPhone = phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`

    // Check if patient exists
    const patient = await prisma.patient.findUnique({
      where: { phoneNumber: formattedPhone },
      select: { id: true, firstName: true },
    })

    if (!patient) {
      return { success: false, error: "Patient not found" }
    }

    // Generate OTP
    const otp = generateOTP()

    // Hash OTP for storage
    const hashedOTP = await bcrypt.hash(otp, SALT_ROUNDS)

    // Store OTP in database
    await prisma.patientOTP.upsert({
      where: { patientId: patient.id },
      update: {
        otp: hashedOTP,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
        attempts: 0,
        used: false,
      },
      create: {
        patientId: patient.id,
        otp: hashedOTP,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
        attempts: 0,
        used: false,
      },
    })

    // Send OTP via SMS
    const message = `Habari ${patient.firstName}, namba yako ya kuthibitisha ni: ${otp}. Itaisha baada ya dakika ${OTP_EXPIRY_MINUTES}. Usiishare na mtu yeyote.`

    const smsResult = await sendSMS({
      to: formattedPhone,
      message,
      type: "VERIFICATION",
    })

    if (!smsResult.success) {
      logger.error("Failed to send OTP SMS", { phone: formattedPhone, error: smsResult.error })
      return { success: false, error: "Failed to send OTP. Please try again." }
    }

    logger.info("OTP sent successfully", { patientId: patient.id, phone: formattedPhone })
    return { success: true }
  } catch (error) {
    logger.error("Error sending OTP", { error: error instanceof Error ? error.message : String(error) })
    return { success: false, error: "Internal server error" }
  }
}
