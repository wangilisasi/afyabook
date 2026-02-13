# Automated Reminder System

## Overview

The AfyaBook automated reminder system uses **Vercel Cron** to send SMS appointment reminders to patients. This document explains the architecture, edge cases, and why we chose Cron over alternatives like `setTimeout`.

---

## Architecture

### 1. Vercel Cron Configuration (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/cron/send-reminders",
      "schedule": "0 * * * *"
    }
  ]
}
```

- **Schedule**: Every hour at minute 0 (cron expression `0 * * * *`)
- **Route**: `/api/cron/send-reminders`
- **Execution**: Vercel invokes this endpoint automatically

### 2. Cron Route Implementation

**File**: `src/app/api/cron/send-reminders/route.ts`

#### Security Verification
The cron verifies requests originate from Vercel:

```typescript
function verifyVercelCron(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`
  return authHeader === expectedToken
}
```

**Environment Variable**: Set `CRON_SECRET` in Vercel dashboard.

#### Appointment Query Logic

The cron checks for two types of reminders:

**24-Hour Reminders** (`REMINDER_24H`):
- Sent when appointment is between 23-25 hours away
- Query: `reminder24hSent = false AND slotDate BETWEEN now+23h AND now+25h`
- Statuses: Only `BOOKED` or `CONFIRMED` appointments

**Same-Day Reminders** (`REMINDER_1H`):
- Sent when appointment is 2-4 hours away
- Query: `reminderSameDaySent = false AND slotDate BETWEEN now+2h AND now+4h`
- Additional filter: Must be "today" in Tanzania timezone
- Statuses: Only `BOOKED` or `CONFIRMED` appointments

#### Response Format

```json
{
  "sent": 5,
  "failed": 1,
  "totalChecked": 6,
  "nextRun": "2024-01-15T14:00:00.000Z",
  "executionTimeMs": 2340,
  "cronLogId": "uuid",
  "status": "partial"
}
```

---

## Edge Case Handling

### 1. Timezone: Tanzania (EAT - UTC+3)

Tanzania uses **East Africa Time (EAT)**, which is **UTC+3**.

**Key Facts**:
- Tanzania **does NOT observe daylight saving time**
- Time remains UTC+3 year-round
- All database times are stored in UTC
- Conversion happens at application layer

**Implementation**:

```typescript
const TZ_OFFSET_HOURS = 3

function toTanzaniaTime(utcDate: Date): Date {
  return new Date(utcDate.getTime() + (TZ_OFFSET_HOURS * 60 * 60 * 1000))
}

function isTodayInTanzania(utcDate: Date): boolean {
  const tzNow = toTanzaniaTime(new Date())
  const tzDate = toTanzaniaTime(utcDate)
  
  return (
    tzDate.getFullYear() === tzNow.getFullYear() &&
    tzDate.getMonth() === tzNow.getMonth() &&
    tzDate.getDate() === tzNow.getDate()
  )
}
```

**Same-Day Reminder Logic**:
- A patient books at 10:00 PM Tanzania time for 9:00 AM next day
- The same-day reminder window is 2-4 hours before (5:00-7:00 AM)
- Since 5:00 AM Tanzania time is 2:00 AM UTC, the cron at 2:00 AM UTC will catch it

### 2. Failed Sends & Retry Logic

**Retry Strategy**:
- Maximum 1 retry per failed send
- 1-second delay between retry attempts
- Failed sends are tracked in database flags

**Database Flags**:
```typescript
reminder24hFailed: boolean      // True if 24h reminder failed
reminder24hError: string | null // Error message for debugging
reminderSameDayFailed: boolean
reminderSameDayError: string | null
```

**Alerting**:
Failed reminders are visible in:
1. Dashboard via `GET /api/reminders/send-now?secret_key=xxx`
2. Database queries on `reminder24hFailed = true`
3. Cron logs showing `remindersFailed > 0`

### 3. Empty Response Handling

When no appointments need reminders:

```json
{
  "sent": 0,
  "failed": 0,
  "skipped": 0,
  "totalChecked": 0,
  "nextRun": "2024-01-15T14:00:00.000Z",
  "executionTimeMs": 45,
  "status": "success"
}
```

This is a clean, successful response - no errors thrown.

### 4. Duplicate Prevention

Each appointment can only receive:
- One 24-hour reminder (tracked by `reminder24hSent`)
- One same-day reminder (tracked by `reminderSameDaySent`)

Even if the cron runs multiple times in the window, flags prevent duplicates.

---

## Monitoring with Cron Logs

### Database Table: `cron_logs`

Each cron execution is logged:

```sql
CREATE TABLE cron_logs (
  id TEXT PRIMARY KEY,
  job_name TEXT NOT NULL,           -- 'send-reminders'
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  status CronStatus,                -- RUNNING | SUCCESS | PARTIAL | FAILED | TIMEOUT
  appointments_checked INT DEFAULT 0,
  reminders_sent INT DEFAULT 0,
  reminders_failed INT DEFAULT 0,
  retries_attempted INT DEFAULT 0,
  error_message TEXT,
  duration_ms INT,
  triggered_by TEXT DEFAULT 'cron'  -- 'cron' | 'manual' | 'test'
);
```

### Querying Success Rate

```sql
-- Last 7 days success rate
SELECT 
  DATE(started_at) as date,
  COUNT(*) as total_runs,
  SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as successful,
  SUM(reminders_sent) as total_sent,
  SUM(reminders_failed) as total_failed,
  ROUND(
    100.0 * SUM(reminders_sent) / NULLIF(SUM(reminders_sent + reminders_failed), 0), 
    2
  ) as success_rate_pct
FROM cron_logs
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(started_at)
ORDER BY date DESC;
```

---

## Manual Override Endpoint

**File**: `src/app/api/reminders/send-now/route.ts`

### Usage Examples

**Test Mode (No SMS Sent)**:
```bash
POST /api/reminders/send-now?secret_key=xxx&dry_run=true
```

**Send 24-Hour Reminders Only**:
```bash
POST /api/reminders/send-now?secret_key=xxx&type=24h
```

**Force Re-send for Specific Appointment**:
```bash
POST /api/reminders/send-now?secret_key=xxx&appointment_id=uuid
Body: { "force": true }
```

**Check Status**:
```bash
GET /api/reminders/send-now?secret_key=xxx
```

### When to Use Manual Override

1. **Testing**: Verify SMS templates in development
2. **Emergency Re-send**: After Twilio outage
3. **Same-Day Bookings**: Patient books at 8 AM for 11 AM appointment
4. **Debugging**: Check pending reminders and recent runs

---

## Why Cron Beats setTimeout for Production

### The Problem with setTimeout

```javascript
// What NOT to do in production
setTimeout(() => {
  sendReminders()
}, timeUntilNextReminder)
```

**Issues**:

1. **Serverless Environment**: Vercel functions are stateless and ephemeral
   - `setTimeout` only works while the function is running
   - Function may timeout or be killed after response
   - No persistence across requests

2. **No Guarantee**: If the server restarts, all timeouts are lost

3. **Scale Issues**: With multiple instances, you'd have duplicate timeouts

4. **Memory Leaks**: Accumulating timeouts causes memory issues

5. **No Observability**: Hard to track what was scheduled vs executed

### Why Vercel Cron Wins

| Feature | setTimeout | Vercel Cron |
|---------|------------|-------------|
| **Persistence** | ❌ Lost on restart | ✅ Managed by Vercel |
| **Reliability** | ❌ Function-dependent | ✅ Guaranteed invocation |
| **Observability** | ❌ Hard to track | ✅ Built-in logs & webhooks |
| **Scaling** | ❌ Per-instance | ✅ Single scheduled trigger |
| **Failure Handling** | ❌ Manual retry | ✅ Built-in retry logic |
| **Timezone** | ❌ Manual handling | ✅ Configurable |
| **Monitoring** | ❌ Custom needed | ✅ Dashboard integration |

### Production-Grade Cron Benefits

1. **Reliability**: Vercel guarantees invocation even if previous run failed
2. **Idempotency**: Cron jobs should be idempotent (safe to run multiple times)
3. **Observability**: Built-in monitoring and alerting
4. **Audit Trail**: Every run logged with duration, success/failure counts
5. **Manual Override**: Easy to trigger on-demand for testing or emergencies
6. **No State Management**: Don't need Redis/job queues for simple scheduling

### When to Use setTimeout

`setTimeout` is fine for:
- Delays within a single request (e.g., retry after 1 second)
- Client-side countdown timers
- Development/testing (with caveats)

**Never use setTimeout for**:
- Scheduled tasks in production
- Reminders or notifications
- Recurring background jobs
- Anything that must survive server restarts

---

## Environment Variables

```bash
# Required
CRON_SECRET=your-secret-key-for-vercel-cron-verification
REMINDERS_SECRET_KEY=your-secret-key-for-manual-endpoint
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=your-twilio-number

# Optional
TWILIO_STATUS_CALLBACK_URL=https://your-domain.com/api/webhooks/twilio/sms-status
```

---

## Testing the Cron Locally

```bash
# Run the cron route directly (will fail auth without CRON_SECRET)
curl http://localhost:3000/api/cron/send-reminders

# Test with manual endpoint (bypasses Vercel auth)
curl -X POST "http://localhost:3000/api/reminders/send-now?secret_key=dev-secret-key-change-in-production&dry_run=true"
```

---

## Migration Notes

### From Legacy System

Old fields (kept for backwards compatibility):
- `reminderSent` → Use `reminder24hSent` instead
- `reminderSentAt` → Use `reminder24hSentAt` instead

New fields (current system):
- `reminder24hSent` / `reminder24hSentAt`
- `reminder24hFailed` / `reminder24hError`
- `reminderSameDaySent` / `reminderSameDaySentAt`
- `reminderSameDayFailed` / `reminderSameDayError`

### Running the Migration

```bash
npm run db:migrate
npm run db:generate
```

---

## Summary

The Vercel Cron-based reminder system provides:
- ✅ Production-grade reliability
- ✅ Automatic retry and failure handling
- ✅ Comprehensive monitoring via cron_logs
- ✅ Tanzania timezone support (UTC+3, no DST)
- ✅ Manual override for testing/emergencies
- ✅ No state management complexity
- ✅ Idempotent operations (safe to re-run)

**Bottom line**: For production scheduled tasks, always use a proper cron system like Vercel Cron. Avoid `setTimeout` for anything critical.
