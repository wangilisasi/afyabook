/**
 * Application constants
 * Centralized location for magic numbers and configuration values
 */

// Time-related constants
export const MINUTES_PER_HOUR = 60
export const MILLISECONDS_PER_SECOND = 1000
export const MILLISECONDS_PER_MINUTE = 60 * 1000
export const MILLISECONDS_PER_HOUR = 60 * 60 * 1000
export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

// Tanzania timezone
export const TANZANIA_TZ_OFFSET_HOURS = 3
export const TANZANIA_TIMEZONE = 'Africa/Dar_es_Salaam'

// Reminder windows (in hours)
export const REMINDER_24H_WINDOW_MIN = 23
export const REMINDER_24H_WINDOW_MAX = 25
export const REMINDER_SAME_DAY_WINDOW_MIN = 2
export const REMINDER_SAME_DAY_WINDOW_MAX = 4

// Time buffers (in minutes)
export const APPOINTMENT_BUFFER_MINUTES = 15
export const SLOT_BUFFER_MINUTES = 15

// Retry configuration
export const MAX_SMS_RETRIES = 1
export const SMS_RETRY_DELAY_MS = 200
export const DEFAULT_RETRY_DELAY_MS = 1000

// Rate limiting
export const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
export const RATE_LIMIT_MAX_REQUESTS = 5

// Pagination
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

// Session/cookie
export const SESSION_MAX_AGE_HOURS = 8
export const SESSION_COOKIE_NAME = 'afyabook_session'

// API timeouts
export const API_TIMEOUT_MS = 30000 // 30 seconds
export const CRON_TIMEOUT_MS = 60000 // 60 seconds

// Phone validation
export const TANZANIA_PHONE_PREFIXES = ['+255', '255', '0']
export const TANZANIA_PHONE_LENGTH = 9

// Costs
export const SMS_COST_USD = 0.02

// Validation patterns
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const UUID_REGEX_LOOSE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
export const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/
