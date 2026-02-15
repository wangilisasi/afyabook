import { DefaultSession, DefaultUser } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      type: "clinic" | "patient"
      clinicId?: string
      credentialClinicId?: string
      patientId?: string
      phoneNumber?: string
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    type: "clinic" | "patient"
    clinicId?: string
    credentialClinicId?: string
    patientId?: string
    phoneNumber?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    type?: "clinic" | "patient"
    clinicId?: string
    credentialClinicId?: string
    patientId?: string
    phoneNumber?: string
  }
}
