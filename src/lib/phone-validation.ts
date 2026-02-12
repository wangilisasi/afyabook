/**
 * Tanzanian phone number validation utilities
 * Valid prefixes: 071X, 065X, 067X, 074X, 075X, 076X, 077X, 078X, 068X
 */

// Valid Tanzanian mobile prefixes
const VALID_PREFIXES = [
  '065', '067', '068',
  '071',
  '074', '075', '076', '077', '078'
]

/**
 * Validates and normalizes Tanzanian phone numbers
 * @param phone - Phone number in various formats
 * @returns { isValid: boolean, normalized: string | null, error?: string }
 */
export function validateTanzanianPhone(phone: string): {
  isValid: boolean
  normalized: string | null
  error?: string
} {
  if (!phone || typeof phone !== 'string') {
    return {
      isValid: false,
      normalized: null,
      error: 'Namba ya simu inahitajika / Phone number is required'
    }
  }

  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '')

  // Handle international format (+255 or 255 prefix)
  if (cleaned.startsWith('255') && cleaned.length === 12) {
    cleaned = '0' + cleaned.slice(3)
  }

  // Check length (should be 10 digits for Tanzanian format)
  if (cleaned.length !== 10) {
    return {
      isValid: false,
      normalized: null,
      error: 'Namba ya simu sio sahihi. Urefu unapaswa kuwa tarakimu 10 / Invalid phone number. Must be 10 digits'
    }
  }

  // Check if starts with 0
  if (!cleaned.startsWith('0')) {
    return {
      isValid: false,
      normalized: null,
      error: 'Namba ya simu lazima ianze na 0 / Phone number must start with 0'
    }
  }

  // Extract prefix (first 3 digits)
  const prefix = cleaned.substring(0, 3)

  // Check if prefix is valid
  if (!VALID_PREFIXES.includes(prefix)) {
    return {
      isValid: false,
      normalized: null,
      error: `Kichwa cha namba (${prefix}) sio sahihi. Kichwa halali: ${VALID_PREFIXES.join(', ')} / Invalid prefix. Valid prefixes: ${VALID_PREFIXES.join(', ')}`
    }
  }

  // Convert to E.164 format for storage (+255XXXXXXXXX)
  const normalized = '+255' + cleaned.substring(1)

  return {
    isValid: true,
    normalized,
    error: undefined
  }
}

/**
 * Formats phone number for display ( Tanzanian format: 0712 345 678)
 * @param phone - Phone number in any format
 * @returns Formatted string or null if invalid
 */
export function formatPhoneForDisplay(phone: string): string | null {
  const validation = validateTanzanianPhone(phone)
  
  if (!validation.isValid || !validation.normalized) {
    return null
  }

  // Convert back to local format (0XXXXXXXXX)
  const local = '0' + validation.normalized.substring(4)
  
  // Format: 0712 345 678
  return `${local.substring(0, 4)} ${local.substring(4, 7)} ${local.substring(7)}`
}

/**
 * Quick validation check
 * @param phone - Phone number to validate
 * @returns boolean
 */
export function isValidTanzanianPhone(phone: string): boolean {
  return validateTanzanianPhone(phone).isValid
}
