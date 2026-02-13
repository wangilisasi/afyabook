// Authorization context - set per request
export interface AuthContext {
  userId?: string
  userRole?: 'admin' | 'doctor' | 'nurse' | 'patient'
  clinicId?: string
  isAuthenticated: boolean
}

// AsyncLocalStorage to maintain context across async operations
import { AsyncLocalStorage } from 'async_hooks'

export const authContext = new AsyncLocalStorage<AuthContext>()

// Helper to run code with auth context
export function withAuthContext<T>(context: AuthContext, fn: () => Promise<T>): Promise<T> {
  return authContext.run(context, fn)
}

// Helper to get current auth context
export function getAuthContext(): AuthContext | undefined {
  return authContext.getStore()
}

// Authorization middleware for Prisma (legacy middleware type)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const authorizationMiddleware = async (params: any, next: (params: any) => Promise<any>) => {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any,
  context: AuthContext
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
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
