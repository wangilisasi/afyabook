/**
 * Authentication Middleware (NextAuth.js)
 * Validates sessions for protected routes
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth/auth"

export interface AuthContext {
  userId: string
  userType: "patient" | "clinic"
  phoneNumber?: string
  clinicId?: string
}

/**
 * Extract auth context from NextAuth session
 */
export async function getAuthFromRequest(request: NextRequest): Promise<AuthContext | null> {
  const session = await auth()

  if (!session?.user) {
    return null
  }

  const user = session.user

  if (user.type === "patient") {
    return {
      userId: user.patientId || user.id,
      userType: "patient",
      phoneNumber: user.phoneNumber,
    }
  } else if (user.type === "clinic") {
    return {
      userId: user.clinicId || user.id,
      userType: "clinic",
      clinicId: user.clinicId,
    }
  }

  return null
}

/**
 * Middleware to protect API routes
 * Usage: export const middleware = withAuth(handler, options)
 */
export function withAuth(
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>,
  options: { requiredType?: "patient" | "clinic" } = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const auth = await getAuthFromRequest(request)

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please login." }, { status: 401 })
    }

    if (options.requiredType && auth.userType !== options.requiredType) {
      return NextResponse.json({ error: `Access denied. ${options.requiredType} access required.` }, { status: 403 })
    }

    return handler(request, auth)
  }
}

/**
 * Check if user is authenticated (for use in route handlers)
 */
export async function requireAuth(
  request: NextRequest,
  options: { requiredType?: "patient" | "clinic" } = {}
): Promise<{ success: true; auth: AuthContext } | { success: false; response: NextResponse }> {
  const auth = await getAuthFromRequest(request)

  if (!auth) {
    return {
      success: false,
      response: NextResponse.json({ error: "Unauthorized. Please login." }, { status: 401 }),
    }
  }

  if (options.requiredType && auth.userType !== options.requiredType) {
    return {
      success: false,
      response: NextResponse.json({ error: `Access denied. ${options.requiredType} access required.` }, { status: 403 }),
    }
  }

  return { success: true, auth }
}
