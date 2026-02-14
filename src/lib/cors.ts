/**
 * CORS Configuration
 * Restricted to specific allowed origins for security
 */

// List of allowed origins (add your production domains here)
const ALLOWED_ORIGINS = [
  'http://localhost:3000',     // Local development
  'http://localhost:3001',     // Local development alt
  // Add production domains here:
  // 'https://afyabook.com',
  // 'https://www.afyabook.com',
  // 'https://app.afyabook.com',
]

// For production, you can also use environment variable
// const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false
  
  // Allow localhost in development
  if (process.env.NODE_ENV === 'development') {
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return true
    }
  }
  
  return ALLOWED_ORIGINS.includes(origin)
}

/**
 * Get CORS headers for a request
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-API-Key',
    'Access-Control-Max-Age': '86400', // 24 hours
  }
  
  // Only set Allow-Origin if origin is allowed
  if (isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin!
    headers['Access-Control-Allow-Credentials'] = 'true'
  }
  
  return headers
}

/**
 * Handle CORS preflight request
 */
export function handleCorsPreflight(request: Request): Response | null {
  const origin = request.headers.get('origin')
  
  if (request.method === 'OPTIONS') {
    const headers = getCorsHeaders(origin)
    
    return new Response(null, {
      status: 204,
      headers
    })
  }
  
  return null
}
