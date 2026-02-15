import { NextAuthConfig } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

// Parse clinic credentials from env
const getClinicCredentials = (): Record<string, string> => {
  try {
    const creds = process.env.CLINIC_CREDENTIALS
    if (!creds) {
      logger.error("CLINIC_CREDENTIALS not set")
      return {}
    }
    return JSON.parse(creds)
  } catch {
    logger.error("Invalid CLINIC_CREDENTIALS format")
    return {}
  }
}

export const authConfig: NextAuthConfig = {
  providers: [
    // Clinic Staff Login
    CredentialsProvider({
      id: "clinic-login",
      name: "Clinic Staff",
      credentials: {
        clinicId: { label: "Clinic ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.clinicId || !credentials?.password) {
          return null
        }

        const clinicId = credentials.clinicId as string
        const password = credentials.password as string
        const normalizedClinicId = clinicId.trim()

        const credentialsMap = getClinicCredentials()
        const storedHash = credentialsMap[normalizedClinicId]

        if (!storedHash) {
          logger.warn("Login attempt for unknown clinic", { clinicId: normalizedClinicId })
          return null
        }

        // Verify password
        const isValid = await bcrypt.compare(password, storedHash)

        if (!isValid) {
          logger.warn("Failed login attempt", { clinicId: normalizedClinicId })
          return null
        }

        // Resolve to real clinic ID
        let dashboardClinicId = normalizedClinicId
        let clinicName = normalizedClinicId

        const clinicById = await prisma.clinic.findUnique({
          where: { id: normalizedClinicId },
          select: { id: true, name: true },
        })

        if (clinicById) {
          dashboardClinicId = clinicById.id
          clinicName = clinicById.name
        } else {
          // Find fallback clinic
          const fallbackClinic = await prisma.clinic.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true },
          })

          if (fallbackClinic) {
            dashboardClinicId = fallbackClinic.id
            clinicName = fallbackClinic.name
          }
        }

        logger.info("Clinic login successful", { clinicId: dashboardClinicId })

        return {
          id: dashboardClinicId,
          clinicId: dashboardClinicId,
          credentialClinicId: normalizedClinicId,
          name: clinicName,
          type: "clinic" as const,
        }
      },
    }),

    // Patient OTP Login - Step 1: Send OTP (custom flow)
    CredentialsProvider({
      id: "patient-otp-send",
      name: "Patient OTP Send",
      credentials: {
        phoneNumber: { label: "Phone Number", type: "text" },
        step: { label: "Step", type: "text" },
      },
      async authorize(credentials) {
        // This is a marker - actual OTP sending happens in separate API route
        // This provider exists for type consistency
        return null
      },
    }),

    // Patient OTP Login - Step 2: Verify OTP
    CredentialsProvider({
      id: "patient-otp-verify",
      name: "Patient OTP Verify",
      credentials: {
        phoneNumber: { label: "Phone Number", type: "text" },
        otp: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.phoneNumber || !credentials?.otp) {
          return null
        }

        const phoneNumber = credentials.phoneNumber as string
        const otp = credentials.otp as string
        const formattedPhone = phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`

        // Find patient
        const patient = await prisma.patient.findUnique({
          where: { phoneNumber: formattedPhone },
          select: { id: true, firstName: true, lastName: true, phoneNumber: true },
        })

        if (!patient) {
          return null
        }

        // Get stored OTP
        const otpRecord = await prisma.patientOTP.findUnique({
          where: { patientId: patient.id },
        })

        if (!otpRecord || otpRecord.used || new Date() > otpRecord.expiresAt || otpRecord.attempts >= 3) {
          return null
        }

        // Verify OTP
        const isValid = await bcrypt.compare(otp, otpRecord.otp)

        if (!isValid) {
          // Increment attempts
          await prisma.patientOTP.update({
            where: { patientId: patient.id },
            data: { attempts: { increment: 1 } },
          })
          return null
        }

        // Mark OTP as used
        await prisma.patientOTP.update({
          where: { patientId: patient.id },
          data: { used: true },
        })

        logger.info("Patient authenticated successfully", { patientId: patient.id })

        return {
          id: patient.id,
          patientId: patient.id,
          name: `${patient.firstName} ${patient.lastName}`,
          phoneNumber: patient.phoneNumber,
          type: "patient" as const,
        }
      },
    }),
  ],

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },

  jwt: {
    maxAge: 8 * 60 * 60, // 8 hours
  },

  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.type = user.type

        if (user.type === "clinic") {
          token.clinicId = user.clinicId
          token.credentialClinicId = user.credentialClinicId
        } else if (user.type === "patient") {
          token.patientId = user.patientId
          token.phoneNumber = user.phoneNumber
        }
      }
      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.type = token.type as "clinic" | "patient"

        if (token.type === "clinic") {
          session.user.clinicId = token.clinicId as string
          session.user.credentialClinicId = token.credentialClinicId as string
        } else if (token.type === "patient") {
          session.user.patientId = token.patientId as string
          session.user.phoneNumber = token.phoneNumber as string
        }
      }
      return session
    },

    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },

  events: {
    async signIn({ user, account }) {
      logger.info("User signed in", {
        userId: user.id,
        type: user.type,
        provider: account?.provider,
      })
    },
  },

  debug: process.env.NODE_ENV === "development",
}
