import { AsyncLocalStorage } from 'async_hooks'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Authorization context - set per request
export interface AuthContext {
  userId?: string
  userRole?: 'admin' | 'doctor' | 'nurse' | 'patient' | 'owner'
  clinicId?: string
  isAuthenticated: boolean
}

// AsyncLocalStorage to maintain context across async operations
export const authContext = new AsyncLocalStorage<AuthContext>()

// Helper to run code with auth context
export function withAuthContext<T>(context: AuthContext, fn: () => Promise<T>): Promise<T> {
  return authContext.run(context, fn)
}

// Helper to get current auth context
export function getAuthContext(): AuthContext | undefined {
  return authContext.getStore()
}

/**
 * Execute a database query with RLS context
 * This sets the PostgreSQL session variables that RLS policies use
 */
export async function withRLSContext<T>(
  context: AuthContext,
  fn: () => Promise<T>
): Promise<T> {
  return withAuthContext(context, async () => {
    // If no clinic context, just run the function
    if (!context.clinicId && context.userRole !== 'admin') {
      return fn()
    }

    // Set PostgreSQL session variables for RLS policies
    try {
      await prisma.$executeRawUnsafe(
        `SET LOCAL app.current_clinic_id = '${context.clinicId || ''}'`
      )
      await prisma.$executeRawUnsafe(
        `SET LOCAL app.current_user_role = '${context.userRole || ''}'`
      )

      const result = await fn()

      // Reset session variables after query
      await prisma.$executeRawUnsafe('RESET app.current_clinic_id')
      await prisma.$executeRawUnsafe('RESET app.current_user_role')

      return result
    } catch (error) {
      // Reset on error
      try {
        await prisma.$executeRawUnsafe('RESET app.current_clinic_id')
        await prisma.$executeRawUnsafe('RESET app.current_user_role')
      } catch {
        // Ignore reset errors
      }
      throw error
    }
  })
}

// Prisma middleware parameters type with generic where clause
interface MiddlewareParams {
  model?: Prisma.ModelName
  action: Prisma.PrismaAction
  args: {
    where?: Record<string, unknown>
    [key: string]: unknown
  }
  dataPath: string[]
  runInTransaction: boolean
}

// Authorization middleware for Prisma (legacy middleware type)
export const authorizationMiddleware = async (
  params: MiddlewareParams, 
  next: (params: MiddlewareParams) => Promise<unknown>
): Promise<unknown> => {
  const context = getAuthContext()
  
  // If no context, proceed without filtering (be careful with this!)
  if (!context) {
    return next(params)
  }

  // Apply authorization based on model and user role
  if (params.model) {
    params = applyAuthorizationFilters(params, context)
  }

  return next(params)
}

function applyAuthorizationFilters(
  params: MiddlewareParams,
  context: AuthContext
): MiddlewareParams {
  const { userRole, clinicId, userId } = context

  // Admins can see everything
  if (userRole === 'admin') {
    return params
  }

  // Clone params to avoid mutating original
  const newParams = { ...params }
  
  // Ensure args object exists
  if (!newParams.args) {
    newParams.args = {}
  }

  // Ensure where clause exists
  if (!newParams.args.where) {
    newParams.args.where = {}
  }

  switch (newParams.model) {
    case 'Patient':
      // Patients can only see their own record
      // Staff can see patients from their clinic
      if (userRole === 'patient' && userId) {
        newParams.args.where = {
          ...newParams.args.where,
          id: userId
        }
      }
      break

    case 'Appointment':
      // Patients see only their appointments
      // Staff see appointments from their clinic
      if (userRole === 'patient' && userId) {
        newParams.args.where = {
          ...newParams.args.where,
          patientId: userId
        }
      } else if (clinicId) {
        newParams.args.where = {
          ...newParams.args.where,
          clinicId: clinicId
        }
      }
      break

    case 'AppointmentSlot':
      // Staff see slots from their clinic
      if (clinicId && userRole !== 'patient') {
        newParams.args.where = {
          ...newParams.args.where,
          clinicId: clinicId
        }
      }
      break

    case 'Staff':
      // Staff can see all staff from their clinic
      if (clinicId) {
        newParams.args.where = {
          ...newParams.args.where,
          clinicId: clinicId
        }
      }
      break

    case 'Clinic':
      // Staff see only their clinic (admins already returned above)
      if (clinicId) {
        newParams.args.where = {
          ...newParams.args.where,
          id: clinicId
        }
      }
      break

    case 'SmsLog':
      // Patients see only their SMS logs
      // Staff see SMS from their clinic
      if (userRole === 'patient' && userId) {
        newParams.args.where = {
          ...newParams.args.where,
          patientId: userId
        }
      } else if (clinicId) {
        newParams.args.where = {
          ...newParams.args.where,
          clinicId: clinicId
        }
      }
      break
  }

  return newParams
}

/**
 * Execute Prisma queries with RLS enforcement
 * 
 * Usage in API routes:
 * ```
 * const patients = await applyRLS(auth, () => 
 *   prisma.patient.findMany()
 * )
 * ```
 */
export async function applyRLS<T>(
  auth: AuthContext,
  queryFn: () => Promise<T>
): Promise<T> {
  return withRLSContext(auth, queryFn)
}

/**
 * Check if user has access to a specific clinic
 */
export function canAccessClinic(auth: AuthContext, clinicId: string): boolean {
  if (auth.userRole === 'admin') return true
  return auth.clinicId === clinicId
}

/**
 * Get clinic-aware Prisma client
 * Returns a proxy that automatically applies RLS context
 */
export function getRLSPrisma(auth: AuthContext) {
  return new Proxy(prisma, {
    get(target, prop) {
      const value = (target as unknown as Record<string, unknown>)[prop as string]

      // If it's a model (like prisma.patient, prisma.appointment), wrap it
      if (typeof value === 'object' && value !== null) {
        return new Proxy(value, {
          get(model, method) {
            const modelMethod = (model as Record<string, unknown>)[method as string]

            // Wrap query methods
            if (typeof modelMethod === 'function' && 
                ['findMany', 'findFirst', 'findUnique', 'findFirstOrThrow', 'findUniqueOrThrow',
                 'create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany',
                 'upsert', 'count', 'aggregate', 'groupBy'].includes(method as string)) {
              return async (...args: unknown[]) => {
                return applyRLS(auth, async () => (modelMethod as (...args: unknown[]) => Promise<unknown>).apply(model, args))
              }
            }

            return modelMethod
          }
        })
      }

      return value
    }
  }) as typeof prisma
}
