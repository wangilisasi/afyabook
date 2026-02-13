# Still Needs Attention

> Generated: February 13, 2026

Issues identified during codebase audit that still require manual attention.

---

## 🔴 P0 — Critical Security

### 1. Patient Login Has Zero Authentication
**File:** `src/app/api/patient/login/route.ts`

Any valid phone number grants full access to that patient's appointments — no OTP, no password, no verification. The session cookie is also set client-side without `HttpOnly` or `Secure` flags.

**Fix:** Implement OTP-based authentication (send a code via SMS, verify before granting access). Set cookies server-side with `HttpOnly`, `Secure`, and `SameSite` flags.

---

### 2. No Auth on Most API Routes
**Affected routes:**
- `POST /api/appointments` — anyone can book
- `POST /api/appointments/[id]/status` — anyone can change status
- `GET /api/appointments/today` — exposes patient phone numbers
- `GET /api/analytics/[clinic_id]` — exposes clinic analytics
- `POST /api/waitlist` — anyone can add to waitlist
- `POST /api/patients/lookup` — anyone can look up / create patients

**Fix:** Create a `src/middleware.ts` that validates `clinic_session` / `patient_session` cookies and redirects or returns 401 for unauthenticated requests on all `/api/` and `/dashboard/` routes.

---

## 🟡 P1 — High Security

### 3. Wildcard CORS in Production
**File:** `vercel.json`

```json
"Access-Control-Allow-Origin": "*"
```

Combined with missing auth, any website on the internet can call your API.

**Fix:** Restrict to your own domain (e.g., `https://afyabook.vercel.app`) or use dynamic origin checking.

---

### 4. Secret Keys Passed in URL Query Parameters
**Files:** `src/app/api/reminders/send-now/route.ts`, `src/app/api/reminders/trigger/route.ts`

```
POST /api/reminders/send-now?secret_key=xxx
```

Query params are logged in server access logs, browser history, and proxy logs.

**Fix:** Pass the secret via the `Authorization` header instead:
```typescript
const secret = request.headers.get('authorization')?.replace('Bearer ', '')
```

---

### 5. Clinic Login Uses Plaintext Password Comparison
**File:** `src/app/api/auth/login/route.ts`

Passwords stored in env var and compared with `===` — no hashing, no timing-safe comparison.

**Fix:** Use `bcrypt` or `argon2` for password hashing. Use `crypto.timingSafeEqual()` for comparison.

---

## 🟡 P2 — Functional Issues

### 6. In-Memory Rate Limiting Doesn't Work in Serverless
**File:** `src/lib/rate-limit/booking-rate-limit.ts`

Uses a `Map` in memory. On Vercel, each cold start gets a fresh `Map`, so rate limiting is effectively disabled. The `setInterval` cleanup also leaks in serverless.

**Fix:** Use [Upstash Rate Limit](https://github.com/upstash/ratelimit) or Vercel KV (Redis).

---

### 7. Sequential SMS Sending in Cron Can Timeout
**File:** `src/app/api/cron/send-reminders/route.ts`

Reminders sent one-by-one with `await` in a loop. With 100 appointments at ~1-2s each, this exceeds Vercel's function timeout (10s free, 60s pro).

**Fix:** Process in batches using `Promise.allSettled`:
```typescript
const BATCH_SIZE = 5
for (let i = 0; i < appointments.length; i += BATCH_SIZE) {
  const batch = appointments.slice(i, i + BATCH_SIZE)
  await Promise.allSettled(batch.map(apt => sendReminder(apt, type)))
}
```

---

### 8. Mixed Prisma + Supabase Data Access
**Files:** `src/app/api/slots/available/route.ts`, `src/app/api/patients/lookup/route.ts` use Supabase client. All other routes use Prisma.

This creates two separate connection pools, bypasses Prisma authorization middleware for Supabase calls, and makes the codebase inconsistent.

**Fix:** Migrate the Supabase routes to use Prisma for all data access.

---

## 🔵 P3 — Code Quality

### 9. No Next.js Middleware for Route Protection
There is no `src/middleware.ts`. Protected routes rely on individual cookie checks in layouts/handlers.

**Fix:** Create middleware that intercepts requests to `/dashboard/*` and `/api/*` routes.

---

### 10. Zod Installed But Never Used
`zod` is in `package.json` but all request validation is manual `if (!field)` checks.

**Fix:** Define Zod schemas for API request bodies:
```typescript
import { z } from 'zod'

const BookAppointmentSchema = z.object({
  patient_id: z.string().uuid(),
  slot_id: z.string().uuid(),
  notes: z.string().max(500).optional(),
})
```

---

### 11. Accessibility Gaps
- No `aria-label` on icon-only buttons (nav, status actions, date arrows)
- No `role="status"` on loading spinners
- Color-only status indicators (no icon/pattern for color-blind users)
- No skip-to-content link in dashboard layout
- Native `window.confirm()` used for cancellation (not accessible/styleable)

---

### 12. Missing CSRF Protection
No CSRF tokens on form submissions. The `clinic_session` cookie has `SameSite` protection, but the `patient_session` cookie set client-side has no `SameSite` attribute.

---

## Summary

| Priority | Count | Category |
|----------|-------|----------|
| 🔴 P0 | 2 | Critical security — app is exploitable |
| 🟡 P1 | 3 | High security — data exposure risk |
| 🟡 P2 | 3 | Functional — features don't work as expected |
| 🔵 P3 | 4 | Code quality & accessibility |
