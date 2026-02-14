/**
 * Environment Variable Validation
 * Validates all required environment variables on startup
 */

import { logger } from './logger'

interface EnvVar {
  name: string
  required: boolean
  validate?: (value: string) => boolean
}

const requiredEnvVars: EnvVar[] = [
  { name: 'DATABASE_URL', required: true },
  { name: 'JWT_SECRET', required: true },
  { 
    name: 'CLINIC_CREDENTIALS', 
    required: true,
    validate: (value) => {
      try {
        JSON.parse(value)
        return true
      } catch {
        return false
      }
    }
  }
]

const optionalEnvVars: EnvVar[] = [
  { name: 'TWILIO_ACCOUNT_SID', required: false },
  { name: 'TWILIO_AUTH_TOKEN', required: false },
  { name: 'TWILIO_PHONE_NUMBER', required: false },
  { name: 'REMINDERS_SECRET_KEY', required: false },
  { name: 'CRON_SECRET', required: false },
  { name: 'WHATSAPP_PHONE_NUMBER_ID', required: false },
  { name: 'WHATSAPP_ACCESS_TOKEN', required: false }
]

/**
 * Validate all environment variables
 * Call this function early in application startup
 */
export function validateEnvironment(): void {
  const errors: string[] = []
  const warnings: string[] = []

  // Check required variables
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar.name]
    
    if (!value) {
      errors.push(`Missing required environment variable: ${envVar.name}`)
    } else if (envVar.validate && !envVar.validate(value)) {
      errors.push(`Invalid format for environment variable: ${envVar.name}`)
    }
  }

  // Check optional variables
  for (const envVar of optionalEnvVars) {
    const value = process.env[envVar.name]
    
    if (!value) {
      warnings.push(`Optional environment variable not set: ${envVar.name}`)
    } else if (envVar.validate && !envVar.validate(value)) {
      warnings.push(`Invalid format for optional variable: ${envVar.name}`)
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    warnings.forEach(warning => logger.warn(warning))
  }

  // Throw error if required vars are missing
  if (errors.length > 0) {
    errors.forEach(error => logger.error(error))
    throw new Error(
      `Environment validation failed:\n${errors.join('\n')}\n\n` +
      'Please check your .env file and ensure all required variables are set.'
    )
  }

  logger.info('Environment validation passed')
}

/**
 * Get environment variable with type safety
 */
export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name]
  
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue
    }
    throw new Error(`Environment variable ${name} is not set`)
  }
  
  return value
}
