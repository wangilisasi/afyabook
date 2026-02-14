/**
 * Timezone utilities for Tanzania (East Africa Time - EAT)
 * Tanzania is UTC+3 and does not observe daylight saving time
 */

const TANZANIA_TZ_OFFSET_HOURS = 3
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000
const MILLISECONDS_PER_MINUTE = 60 * 1000
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Convert UTC Date to Tanzania Time (EAT - UTC+3)
 * Tanzania does not observe daylight saving time
 */
export function toTanzaniaTime(utcDate: Date): Date {
  return new Date(utcDate.getTime() + (TANZANIA_TZ_OFFSET_HOURS * MILLISECONDS_PER_HOUR))
}

/**
 * Convert Tanzania Time to UTC
 */
export function fromTanzaniaTime(tzDate: Date): Date {
  return new Date(tzDate.getTime() - (TANZANIA_TZ_OFFSET_HOURS * MILLISECONDS_PER_HOUR))
}

/**
 * Check if a date is "today" in Tanzania timezone
 */
export function isTodayInTanzania(utcDate: Date): boolean {
  const tzNow = toTanzaniaTime(new Date())
  const tzDate = toTanzaniaTime(utcDate)
  
  return (
    tzDate.getFullYear() === tzNow.getFullYear() &&
    tzDate.getMonth() === tzNow.getMonth() &&
    tzDate.getDate() === tzNow.getDate()
  )
}

/**
 * Get the current time in Tanzania timezone
 */
export function getCurrentTanzaniaTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Dar_es_Salaam' }))
}

/**
 * Check if two dates are the same day in Tanzania timezone
 */
export function isSameDayInTanzania(date1: Date, date2: Date): boolean {
  const tzDate1 = toTanzaniaTime(date1)
  const tzDate2 = toTanzaniaTime(date2)
  
  return (
    tzDate1.getFullYear() === tzDate2.getFullYear() &&
    tzDate1.getMonth() === tzDate2.getMonth() &&
    tzDate1.getDate() === tzDate2.getDate()
  )
}

/**
 * Format a date to Tanzania time string
 */
export function formatTanzaniaTime(date: Date, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Dar_es_Salaam',
    ...options
  }
  
  return date.toLocaleTimeString('en-US', defaultOptions)
}

export { TANZANIA_TZ_OFFSET_HOURS, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE, MILLISECONDS_PER_DAY }
