/**
 * Rate limiting utilities for preventing spam
 * Uses in-memory storage (Redis recommended for production with multiple instances)
 */

interface RateLimitEntry {
  phoneNumber: string
  lastAttemptAt: Date
  attemptCount: number
}

// In-memory store (use Redis in production for distributed systems)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up old entries every 10 minutes
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000

setInterval(() => {
  const now = new Date()
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.lastAttemptAt < fiveMinutesAgo) {
      rateLimitStore.delete(key)
    }
  }
}, CLEANUP_INTERVAL_MS)

/**
 * Check if a phone number is rate limited
 * @param phoneNumber - Normalized phone number
 * @returns { isLimited: boolean, remainingSeconds: number, message: string }
 */
export function checkRateLimit(phoneNumber: string): {
  isLimited: boolean
  remainingSeconds: number
  message: string
} {
  const now = new Date()
  const entry = rateLimitStore.get(phoneNumber)
  
  if (!entry) {
    return {
      isLimited: false,
      remainingSeconds: 0,
      message: 'OK'
    }
  }
  
  const timeSinceLastAttempt = now.getTime() - entry.lastAttemptAt.getTime()
  const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000 // 5 minutes
  
  if (timeSinceLastAttempt < RATE_LIMIT_WINDOW_MS) {
    const remainingSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - timeSinceLastAttempt) / 1000)
    const remainingMinutes = Math.ceil(remainingSeconds / 60)
    
    return {
      isLimited: true,
      remainingSeconds,
      message: `Tafadhali subiri dakika ${remainingMinutes} kabla ya kufanya booking nyingine / Please wait ${remainingMinutes} minutes before making another booking`
    }
  }
  
  // Reset if window has passed
  rateLimitStore.delete(phoneNumber)
  
  return {
    isLimited: false,
    remainingSeconds: 0,
    message: 'OK'
  }
}

/**
 * Record a booking attempt for rate limiting
 * @param phoneNumber - Normalized phone number
 */
export function recordBookingAttempt(phoneNumber: string): void {
  const now = new Date()
  const existing = rateLimitStore.get(phoneNumber)
  
  if (existing) {
    existing.lastAttemptAt = now
    existing.attemptCount += 1
    rateLimitStore.set(phoneNumber, existing)
  } else {
    rateLimitStore.set(phoneNumber, {
      phoneNumber,
      lastAttemptAt: now,
      attemptCount: 1
    })
  }
}

/**
 * Clear rate limit for a phone number (e.g., after successful booking)
 * @param phoneNumber - Normalized phone number
 */
export function clearRateLimit(phoneNumber: string): void {
  rateLimitStore.delete(phoneNumber)
}

/**
 * Get rate limit status for a phone number
 * @param phoneNumber - Normalized phone number
 */
export function getRateLimitStatus(phoneNumber: string): {
  isLimited: boolean
  lastAttemptAt: Date | null
  attemptCount: number
  remainingSeconds: number
} {
  const entry = rateLimitStore.get(phoneNumber)
  
  if (!entry) {
    return {
      isLimited: false,
      lastAttemptAt: null,
      attemptCount: 0,
      remainingSeconds: 0
    }
  }
  
  const now = new Date()
  const timeSinceLastAttempt = now.getTime() - entry.lastAttemptAt.getTime()
  const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000
  
  const remainingSeconds = timeSinceLastAttempt < RATE_LIMIT_WINDOW_MS
    ? Math.ceil((RATE_LIMIT_WINDOW_MS - timeSinceLastAttempt) / 1000)
    : 0
  
  return {
    isLimited: remainingSeconds > 0,
    lastAttemptAt: entry.lastAttemptAt,
    attemptCount: entry.attemptCount,
    remainingSeconds
  }
}
