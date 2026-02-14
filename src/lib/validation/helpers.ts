/**
 * Validation Helpers
 * Utility functions for validating API inputs with Zod
 */

import { ZodSchema, ZodError } from 'zod'
import { NextRequest, NextResponse } from 'next/server'

export type ValidationSuccess<T> = {
  success: true
  data: T
}

export type ValidationError = {
  success: false
  error: NextResponse
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError

interface ValidationErrorDetail {
  field: string
  message: string
}

function formatZodErrors(error: ZodError): ValidationErrorDetail[] {
  return error.issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message
  }))
}

/**
 * Validate request body against a Zod schema
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    const body = await request.json()
    const data = schema.parse(body)
    return { success: true, data }
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatZodErrors(error)
      
      return {
        success: false,
        error: NextResponse.json(
          {
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: errors
          },
          { status: 400 }
        )
      }
    }
    
    return {
      success: false,
      error: NextResponse.json(
        {
          error: 'Invalid request body',
          code: 'INVALID_JSON'
        },
        { status: 400 }
      )
    }
  }
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): ValidationResult<T> {
  try {
    // Convert URLSearchParams to object
    const params: Record<string, string | string[]> = {}
    searchParams.forEach((value, key) => {
      if (params[key]) {
        // Handle multiple values for same key
        if (Array.isArray(params[key])) {
          (params[key] as string[]).push(value)
        } else {
          params[key] = [params[key] as string, value]
        }
      } else {
        params[key] = value
      }
    })
    
    const data = schema.parse(params)
    return { success: true, data }
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatZodErrors(error)
      
      return {
        success: false,
        error: NextResponse.json(
          {
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: errors
          },
          { status: 400 }
        )
      }
    }
    
    return {
      success: false,
      error: NextResponse.json(
        {
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      )
    }
  }
}

/**
 * Validate route parameters against a Zod schema
 */
export function validateParams<T>(
  params: Record<string, string>,
  schema: ZodSchema<T>
): ValidationResult<T> {
  try {
    const data = schema.parse(params)
    return { success: true, data }
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatZodErrors(error)
      
      return {
        success: false,
        error: NextResponse.json(
          {
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: errors
          },
          { status: 400 }
        )
      }
    }
    
    return {
      success: false,
      error: NextResponse.json(
        {
          error: 'Invalid parameters',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      )
    }
  }
}
