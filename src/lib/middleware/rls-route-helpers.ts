/**
 * RLS Route Helpers
 * Simplifies protecting API routes with Row Level Security
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth, AuthContext as BaseAuthContext } from "@/lib/auth/middleware"
import { applyRLS, getRLSPrisma } from "@/lib/middleware/authorization"
import { prisma } from "@/lib/prisma"

// Extended auth context with additional fields from JWT
export interface RLSAuthContext extends BaseAuthContext {
  role?: "admin" | "doctor" | "nurse" | "owner"
  clinicId: string
}

/**
 * Extract auth context from request and verify RLS requirements
 * Returns either the auth context or an error response
 */
export async function requireRLSAuth(
  request: NextRequest,
  options: {
    requiredType?: "patient" | "clinic"
    requireClinic?: boolean
  } = {}
): Promise<{ success: true; auth: RLSAuthContext } | { success: false; response: NextResponse }> {
  const authResult = await requireAuth(request, options)

  if (!authResult.success) {
    return authResult
  }

  const auth = authResult.auth

  // For clinic routes, we need a clinic_id
  if (options.requireClinic !== false && auth.userType === "clinic") {
    if (!auth.clinicId) {
      return {
        success: false,
        response: NextResponse.json({ error: "Invalid session. Clinic ID missing." }, { status: 403 }),
      }
    }
  }

  return {
    success: true,
    auth: {
      ...auth,
      role: auth.clinicId ? "doctor" : undefined, // Default role based on type
      clinicId: auth.clinicId || "",
    },
  }
}

/**
 * Higher-order function to protect API routes with RLS
 *
 * Usage:
 * ```typescript
 * export const GET = withRLS(async (request, { auth, db }) => {
 *   // auth contains the authenticated user context
 *   // db is a Prisma client that automatically applies RLS
 *   const patients = await db.patient.findMany()
 *   return NextResponse.json({ patients })
 * }, { requireClinic: true })
 * ```
 */
export function withRLS(
  handler: (request: NextRequest, context: { auth: RLSAuthContext; db: typeof prisma }) => Promise<NextResponse>,
  options: {
    requiredType?: "patient" | "clinic"
    requireClinic?: boolean
  } = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authResult = await requireRLSAuth(request, options)

    if (!authResult.success) {
      return authResult.response
    }

    const { auth } = authResult

    try {
      // Execute handler with RLS context
      const result = await applyRLS(
        {
          userId: auth.userId,
          userRole: auth.role || (auth.userType === "clinic" ? "doctor" : "patient"),
          clinicId: auth.clinicId,
          isAuthenticated: true,
        },
        () =>
          handler(request, {
            auth,
            db: getRLSPrisma({
              userId: auth.userId,
              userRole: auth.role || (auth.userType === "clinic" ? "doctor" : "patient"),
              clinicId: auth.clinicId,
              isAuthenticated: true,
            }),
          })
      )

      return result
    } catch (error) {
      console.error("RLS handler error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }
}

/**
 * For use when you need to manually check authorization without the wrapper
 *
 * Example:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const authCheck = await requireRLSAuth(request)
 *   if (!authCheck.success) return authCheck.response
 *
 *   const { auth } = authCheck
 *
 *   const patients = await applyRLS(
 *     { userId: auth.userId, userRole: 'doctor', clinicId: auth.clinicId, isAuthenticated: true },
 *     () => prisma.patient.findMany()
 *   )
 *
 *   return NextResponse.json({ patients })
 * }
 * ```
 */
export { applyRLS, getRLSPrisma }
