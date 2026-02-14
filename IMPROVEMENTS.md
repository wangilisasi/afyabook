# AfyaBook Improvement Roadmap

This document tracks technical improvements, security fixes, and feature enhancements for the AfyaBook appointment booking system.

## Critical Priority (P0) - Security & Stability

### 1. Authentication System Overhaul
**Status:** 🔴 Critical  
**Issue:** Patient login has zero security - any valid phone number grants full access without OTP, password, or verification.  
**Location:** `src/app/api/patient/login/route.ts`  
**Impact:** Any user can access any patient's appointments by knowing their phone number.

**Solution:**
- Implement OTP (One-Time Password) via SMS
- Add password/PIN option for patients
- Store session server-side with HttpOnly cookies
- Add session expiration and refresh logic

### 2. Password Security
**Status:** 🔴 Critical  
**Issue:** Passwords compared with `===` - no hashing, no timing-safe comparison.  
**Location:** `src/app/api/auth/login/route.ts`  
**Impact:** Plaintext passwords in database, vulnerable to timing attacks.

**Solution:**
- Use bcrypt/argon2 for password hashing
- Implement proper password comparison
- Add password strength requirements
- Support password reset flow

### 3. API Route Protection
**Status:** 🔴 Critical  
**Issue:** Most API routes are unprotected - anyone can book appointments, change statuses, view analytics.  
**Locations:**
- `src/app/api/appointments/route.ts`
- `src/app/api/appointments/[id]/status/route.ts`
- `src/app/api/analytics/[clinic_id]/route.ts`

**Solution:**
- Create centralized auth middleware
- Verify JWT/session on every protected route
- Implement role-based access control (RBAC)
- Add permission checks for sensitive operations

### 4. CORS Configuration
**Status:** 🔴 Critical  
**Issue:** Wildcard CORS `"*"` allows any website to call the API.  
**Location:** `vercel.json`  
**Impact:** CSRF attacks, unauthorized API access from malicious sites.

**Solution:**
- Restrict CORS to specific domains
- Add proper origin validation
- Implement CSRF tokens for state-changing operations

### 5. Secrets in URLs
**Status:** 🔴 Critical  
**Issue:** Secrets passed as `?secret_key=xxx` - logged in server logs and browser history.  
**Location:** `src/app/api/reminders/send-now/route.ts`, `src/app/api/reminders/trigger/route.ts`

**Solution:**
- Move secrets to headers (`X-API-Key`)
- Implement proper API key management
- Add request signing for webhooks

## High Priority (P1) - Architecture & Quality

### 6. Centralized Authentication Middleware
**Status:** 🟡 High  
**Issue:** No Next.js middleware for route protection - cookie checks scattered in layouts/handlers.  
**Missing:** `src/middleware.ts`

**Solution:**
- Create `src/middleware.ts` for Next.js App Router
- Centralize session validation
- Handle role-based redirects

### 7. Input Validation with Zod
**Status:** 🟡 High  
**Issue:** Zod installed but validation is manual `if (!field)` checks.  
**Impact:** Inconsistent validation, no type safety on inputs.

**Solution:**
- Define Zod schemas for all API inputs
- Validate request bodies/query params
- Generate TypeScript types from schemas

### 8. Database Consistency
**Status:** 🟡 High  
**Issue:** Mixed database access patterns - some routes use Prisma, others use Supabase client directly.  
**Impact:** Two connection pools, inconsistent error handling.

**Solution:**
- Standardize on Prisma ORM
- Remove direct Supabase calls
- Use Prisma transactions for atomic operations

### 9. Service Layer Architecture
**Status:** 🟡 High  
**Issue:** Business logic scattered in API routes (God objects).  
**Examples:**
- `src/app/api/cron/send-reminders/route.ts` (577 lines)
- `src/app/api/reminders/send-now/route.ts` (672 lines)

**Solution:**
- Extract business logic to service classes
- Create `src/services/` directory
- Separate concerns (auth, appointments, reminders, etc.)

### 10. Error Handling & Logging
**Status:** 🟡 High  
**Issue:** Silent failures, no error tracking, inconsistent error formats.

**Solution:**
- Integrate Sentry or similar error tracking
- Standardize API error responses
- Add structured logging with correlation IDs
- Implement circuit breakers for external services

## Medium Priority (P2) - Testing & Performance

### 11. Test Coverage
**Status:** 🟠 Medium  
**Issue:** Zero test coverage - no unit, integration, or e2e tests.

**Solution:**
- Add Jest for unit testing
- Add React Testing Library for component tests
- Add Playwright for e2e tests
- Test critical paths: booking flow, reminders, auth

### 12. SMS Batch Processing
**Status:** 🟠 Medium  
**Issue:** Sequential SMS sending - 100 appointments at ~1-2s each = timeout on Vercel.  
**Location:** `src/app/api/cron/send-reminders/route.ts`

**Solution:**
- Implement queue-based processing (Bull/Redis)
- Batch SMS sends
- Add progress tracking
- Handle partial failures

### 13. Caching Layer
**Status:** 🟠 Medium  
**Issue:** No caching - slots, analytics fetched fresh every time.

**Solution:**
- Add Redis cache for frequently accessed data
- Cache slot availability
- Cache analytics with TTL
- Implement cache invalidation

### 14. Database Query Optimization
**Status:** 🟠 Medium  
**Issue:** N+1 queries in some routes, no query optimization.

**Solution:**
- Use Prisma `include` efficiently
- Add database indexes for common queries
- Implement cursor-based pagination
- Optimize analytics queries

## Lower Priority (P3) - Features & DX

### 15. Email Notifications
**Status:** 🟢 Low  
**Issue:** Currently only SMS, no email option for patients who prefer it.

**Solution:**
- Integrate SendGrid/AWS SES
- Add email templates
- Let patients choose notification channel

### 16. Push Notifications
**Status:** 🟢 Low  
**Issue:** No push notification support for mobile PWA.

**Solution:**
- Implement Web Push API
- Add service worker
- Request notification permissions

### 17. Appointment Rescheduling
**Status:** 🟢 Low  
**Issue:** Currently only cancel available, no reschedule flow.

**Solution:**
- Add reschedule API endpoint
- UI for selecting new slot
- Handle waitlist promotion on reschedule

### 18. Recurring Appointments
**Status:** 🟢 Low  
**Issue:** No support for recurring appointments (weekly dialysis, etc.).

**Solution:**
- Add recurrence rules (RRULE)
- Generate future slots
- Handle exceptions/cancellations

### 19. Multi-Clinic Support
**Status:** 🟢 Low  
**Issue:** Staff working at multiple clinics not supported.

**Solution:**
- Many-to-many staff-clinic relationships
- Clinic switcher UI
- Cross-clinic analytics

### 20. Audit Logs
**Status:** 🟢 Low  
**Issue:** No tracking of who changed what data.

**Solution:**
- Add audit log table
- Log all create/update/delete operations
- Add admin audit trail view

## DevOps & Infrastructure

### 21. CI/CD Pipeline
**Status:** 🟡 High  
**Issue:** No GitHub Actions for testing/building.

**Solution:**
- Add GitHub Actions workflow
- Run tests on PR
- Deploy to staging/production
- Add branch protection rules

### 22. Environment Validation
**Status:** 🟡 High  
**Issue:** Missing required env vars fail silently.

**Solution:**
- Create env validation schema
- Fail fast on startup if required vars missing
- Document all environment variables

### 23. Health Checks
**Status:** 🟡 High  
**Issue:** No `/health` endpoint for monitoring.

**Solution:**
- Add health check endpoint
- Check database connectivity
- Check Twilio/WhatsApp configuration
- Return 503 if degraded

### 24. Database Migrations
**Status:** 🟠 Medium  
**Issue:** No migration verification, schema drift possible.

**Solution:**
- Add migration check in CI
- Document migration process
- Add rollback procedures

## Accessibility & UX

### 25. Accessibility Improvements
**Status:** 🟡 High  
**Issues:**
- No `aria-label` on icon-only buttons
- No `role="status"` on loading spinners
- Color-only status indicators (colorblind users)
- Native `window.confirm()` used for cancellation

**Solution:**
- Add proper ARIA labels
- Add loading state announcements
- Use icons + color for status
- Replace confirm with accessible modal

### 26. Offline Support
**Status:** 🟢 Low  
**Issue:** No service worker for PWA offline functionality.

**Solution:**
- Add Next.js PWA configuration
- Cache critical assets
- Queue actions when offline
- Sync when back online

## Documentation

### 27. API Documentation
**Status:** 🟠 Medium  
**Issue:** No Swagger/OpenAPI specs.

**Solution:**
- Add OpenAPI specification
- Generate documentation from code
- Add request/response examples

### 28. Developer Onboarding
**Status:** 🟠 Medium  
**Issue:** No seed data, hard to onboard new developers.

**Solution:**
- Expand Prisma seed script
- Add sample clinics, staff, patients
- Document local development setup

## Compliance & Data

### 29. Data Export/GDPR
**Status:** 🟢 Low  
**Issue:** No way for patients to export or delete their data.

**Solution:**
- Add data export endpoint
- Implement right to be forgotten
- Add data retention policies

### 30. Backup Strategy
**Status:** 🟡 High  
**Issue:** No documented backup/restore process.

**Solution:**
- Automate database backups
- Test restore procedures
- Document disaster recovery

---

## Quick Wins (Can implement immediately)

1. ✅ Remove duplicate `afyabook/` folder (DONE)
2. ✅ Extract shared utilities (DONE)
3. ✅ Replace console.log with logger (DONE)
4. ✅ Fix explicit `any` types (DONE)
5. 🔄 Add centralized auth middleware
6. 🔄 Implement OTP for patient login
7. 🔄 Add bcrypt for password hashing
8. 🔄 Write tests for booking flow

## Current Stats

- **Codebase Size:** ~9,265 lines TypeScript
- **Test Coverage:** 0%
- **Lint Errors:** 7 (all in scripts)
- **Type Safety:** ✅ All `any` types removed from production code
- **Code Duplication:** ✅ Eliminated duplicate functions

---

*Last Updated: 2026-02-14*  
*Next Review: After implementing P0 items*
