# Suggested Learning Order for TibaTime

Complete each section fully before moving to the next. Verify the checkpoint before proceeding.

---

## Learning Roadmap

| Order | Section | Time | Checkpoint |
|:---:|---|:---:|---|
| **0** | **Project Init** | 1-2 hrs | `npm run dev` starts, folder structure exists, no errors |
| **1** | **Database Schema** | 2-3 hrs | Can query tables in Supabase SQL editor, seed data loads |
| **2** | **RLS Policies** | 1-2 hrs | Test that data isolation works — cross-clinic access blocked |
| **3** | **Patients & Slots API** | 3-4 hrs | Postman/fetch calls return correct data, phone validation works |
| **4** | **Booking API** | 3-4 hrs | Can book without double-booking, race condition test passes |
| **5** | **SMS Integration** | 3-4 hrs | Receive actual SMS on your phone, delivery logged |
| **6** | **Cron Jobs** | 2-3 hrs | Reminders send automatically, timezone correct |
| **7** | **Dashboard UI** | 4-6 hrs | Staff can complete full workflow on mobile |
| **8** | **Deployment** | 2-3 hrs | Live on Vercel, real clinic could use it |

**Total Estimated Time: 21-32 hours**

---

## Section 0: Project Init (1-2 hours)

### What You'll Do
- Set up Next.js project with TypeScript
- Install dependencies (Prisma, Twilio, date-fns, etc.)
- Configure environment variables
- Create folder structure
- Verify dev server runs

### Key Files to Create
```
.env
package.json (with scripts)
prisma/schema.prisma (empty for now)
src/app/page.tsx
src/lib/prisma.ts
```

### Checkpoint ✅
```bash
npm run dev
# Should start on http://localhost:3000 without errors
# Folder structure should match AfyaBook layout
```

### Study Resources
- Next.js App Router fundamentals
- TypeScript with React
- Environment variable management

---

## Section 1: Database Schema (2-3 hours)

### What You'll Do
- Design database schema in Prisma
- Create all tables (patients, clinics, staff, slots, appointments, sms_logs)
- Set up enums for status types
- Add indexes for performance
- Create seed data
- Push to Supabase

### Key Learning Points
- PostgreSQL data types
- Prisma schema syntax
- Database relationships (1:1, 1:N, M:N)
- Indexing strategy

### Checkpoint ✅
```bash
npx prisma db push
npx prisma studio
# Can see all tables in Prisma Studio
# Can run queries in Supabase SQL Editor
```

### Test This
```sql
-- Should return empty result (no errors)
SELECT * FROM patients LIMIT 1;

-- Seed data should load without errors
-- After seed: Should see demo data in tables
```

---

## Section 2: RLS Policies (1-2 hours)

### What You'll Do
- Enable Row Level Security on all tables
- Write policies for clinic data isolation
- Test cross-clinic access is blocked
- Understand PostgreSQL RLS syntax

### Key Learning Points
- PostgreSQL RLS (Row Level Security)
- Policy syntax (USING vs WITH CHECK)
- Data isolation patterns
- Security best practices

### Checkpoint ✅
```sql
-- As Clinic A user, should only see Clinic A data
SELECT clinic_id, name FROM clinics;
-- Should return only rows belonging to your clinic

-- Direct SQL bypass test (should fail)
-- Try to access another clinic's data via SQL injection
-- Should be blocked by RLS
```

### Test This
Create two test clinics and verify:
- Clinic A staff cannot see Clinic B appointments
- Clinic B staff cannot modify Clinic A data
- Admins can see all data (if applicable)

---

## Section 3: Patients & Slots API (3-4 hours)

### What You'll Do
- Create API routes:
  - `GET /api/patients/lookup` - Search by phone
  - `POST /api/patients` - Create new patient
  - `GET /api/slots/available` - Get available slots
  - `GET /api/slots/[id]` - Get specific slot
- Add phone number validation
- Handle E.164 format for Tanzania

### Key Learning Points
- Next.js API routes (App Router)
- Zod validation schemas
- Phone number validation (libphonenumber-js)
- Query parameters vs body parameters
- Error handling patterns

### Checkpoint ✅
```bash
# Test patient lookup
curl "http://localhost:3000/api/patients/lookup?phone=+255712345678"
# Should return patient data or null

# Test slot listing
curl "http://localhost:3000/api/slots/available?clinicId=xxx&date=2024-01-15"
# Should return array of available slots

# Invalid phone should return 400
curl "http://localhost:3000/api/patients/lookup?phone=invalid"
# Should return error
```

### Test This
- Phone numbers stored in E.164 format (+255...)
- Invalid phone numbers rejected with helpful error
- Missing parameters return 400
- Database errors handled gracefully

---

## Section 4: Booking API (3-4 hours)

### What You'll Do
- Create `POST /api/appointments` endpoint
- Implement atomic booking (prevent double-booking)
- Add database transaction
- Handle race conditions
- Return booking confirmation

### Key Learning Points
- Database transactions (ACID)
- Race condition prevention
- Atomic operations
- Prisma $transaction API
- Unique constraints

### Checkpoint ✅
```bash
# Successful booking
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "slotId": "slot-uuid",
    "patientId": "patient-uuid",
    "clinicId": "clinic-uuid"
  }'
# Should return 201 with appointment data

# Try to book same slot again (should fail)
# Should return 409 Conflict or 400 with "already booked" message
```

### Test This (Race Condition)
```bash
# Run this script to test race conditions
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/appointments \
    -H "Content-Type: application/json" \
    -d '{"slotId": "same-slot", "patientId": "patient-'$i'", "clinicId": "clinic"}' &
done
wait

# Result: Only 1 should succeed, others should fail
# No duplicate bookings in database
```

---

## Section 5: SMS Integration (3-4 hours)

### What You'll Do
- Set up Twilio account
- Install Twilio SDK
- Create SMS service module
- Integrate SMS into booking flow
- Add message templates (Swahili/English)
- Create SMS logging system

### Key Learning Points
- Twilio Node.js SDK
- SMS cost optimization
- Message templating
- Delivery status tracking
- Tanzania SMS regulations

### Checkpoint ✅
```bash
# Book an appointment with your phone number
# Check your phone - should receive SMS within 30 seconds
# Check sms_logs table - should have entry with status

# In Supabase:
SELECT * FROM sms_logs ORDER BY created_at DESC LIMIT 1;
# Should show your message with status 'SENT' or 'DELIVERED'
```

### Test This
- **Use your actual phone number**
- SMS arrives in Swahili (or English)
- Contains appointment details
- Delivery status updates in database
- Failed SMS logged with error code

### Tanzania-Specific
- Phone format: +255XXXXXXXXX
- Test with actual Tanzanian number if possible
- Understand Twilio pricing for TZ

---

## Section 6: Cron Jobs (2-3 hours)

### What You'll Do
- Set up Vercel Cron
- Create reminder checking logic
- Implement timezone handling (EAT UTC+3)
- Add retry logic for failed sends
- Create cron logging table

### Key Learning Points
- Vercel Cron configuration
- Timezone math (Tanzania = UTC+3)
- Cron job scheduling
- Failed job handling
- Monitoring and logging

### Checkpoint ✅
```bash
# Manual trigger test
curl -X POST "http://localhost:3000/api/reminders/send-now?secret_key=xxx"

# Should send reminders for appointments 23-25 hours away
# Check cron_logs table for execution record
# Check your phone if you have appointment tomorrow
```

### Test This
- Book appointment 23-25 hours from now
- Wait for cron (or trigger manually)
- Receive reminder SMS
- Verify timezone is correct (Tanzania time)

### Timezone Verification
```javascript
// Tanzania is UTC+3, no DST
// 9:00 AM Tanzania = 6:00 AM UTC
// Test that reminders send at correct local time
```

---

## Section 7: Dashboard UI (4-6 hours)

### What You'll Do
- Build login page
- Create dashboard layout
- Build today view (timeline)
- Build patient search
- Build quick-book wizard
- Add mobile optimizations
- Implement optimistic updates

### Key Learning Points
- Next.js Server Components
- Client Components for interactivity
- Tailwind CSS responsive design
- Swipe gestures on mobile
- Optimistic UI updates
- Form validation

### Checkpoint ✅
```bash
# Full workflow test on your phone:
1. Login to dashboard
2. View today's appointments
3. Search for patient
4. Book new appointment
5. Update appointment status
6. All actions work smoothly on mobile
```

### Test This (Mobile)
- **Test on actual phone, not just browser**
- Swipe gestures work
- Pull-to-refresh works
- Buttons are easy to tap (44px+)
- Text is readable
- No horizontal scrolling
- Works on slow connections

### Bilingual Testing
- Test Swahili text rendering
- Verify all user-facing text has Swahili version
- Check right-to-left compatibility (if applicable)

---

## Section 8: Deployment (2-3 hours)

### What You'll Do
- Push to GitHub
- Import to Vercel
- Configure environment variables
- Set up custom domain (optional)
- Configure Twilio webhooks
- Run production tests

### Key Learning Points
- Vercel deployment process
- Environment variable management
- Production debugging
- Domain configuration
- SSL/TLS certificates

### Checkpoint ✅
```bash
# Production URL works
https://your-app.vercel.app/login

# All features work in production:
- Login
- Booking
- SMS delivery
- Cron jobs
- Dashboard UI
```

### Production Tests
- [ ] Can login with real credentials
- [ ] Can book appointment
- [ ] Receives SMS confirmation
- [ ] Reminders send automatically
- [ ] Dashboard works on mobile
- [ ] No console errors
- [ ] Fast load times (<2s)

---

## Tips for Success

### Do's ✅
- **Do not skip checkpoints**. If something doesn't work, fix it before continuing.
- Keep a running notes file of "things I don't understand yet" — review at the end.
- **Test on your actual phone** for SMS and mobile UI sections.
- **Deploy to Vercel early** (Section 3 or 4) — production bugs differ from local bugs.
- Write tests as you go (even simple ones).
- Commit code after each section.

### Don'ts ❌
- Don't skip sections — each builds on previous.
- Don't test SMS only with console logs — use real phone.
- Don't ignore TypeScript errors.
- Don't hardcode secrets — use environment variables.
- Don't skip RLS — security is not optional.

### Recommended Schedule

**Week 1 (Sections 0-4): Foundation**
- Days 1-2: Project Init + Database
- Days 3-4: APIs (Patients, Slots, Booking)

**Week 2 (Sections 5-8): Integration & Deploy**
- Days 5-6: SMS + Cron
- Days 7-8: Dashboard UI
- Day 9-10: Deployment + Testing

### Study Resources by Section

| Section | Resources |
|---------|-----------|
| 0 | Next.js docs, TypeScript handbook |
| 1 | Prisma docs, PostgreSQL tutorial |
| 2 | Supabase RLS docs, PostgreSQL security |
| 3 | Zod docs, REST API design |
| 4 | Database transactions, ACID properties |
| 5 | Twilio Node.js docs, SMS regulations |
| 6 | Vercel Cron docs, Timezone handling |
| 7 | Tailwind docs, React hooks |
| 8 | Vercel deployment docs |

### Common Pitfalls

1. **Skipping RLS testing** — always verify data isolation
2. **Not testing race conditions** — use the parallel curl test
3. **SMS not working in production** — check Twilio credentials
4. **Timezone bugs** — always store UTC, display local
5. **Mobile issues** — test on real devices, not just Chrome DevTools

---

## Completion Checklist

Before moving to next section, verify:

- [ ] All checkpoint tests pass
- [ ] No TypeScript errors
- [ ] No console warnings
- [ ] Code committed to git
- [ ] Notes file updated with learnings
- [ ] Edge cases considered

---

## Final Project Requirements

When complete, your TibaTime should:

- ✅ Book appointments via API and dashboard
- ✅ Send confirmation SMS in Swahili
- ✅ Send automated reminders (24h + same-day)
- ✅ Staff dashboard works on mobile
- ✅ Data isolated by clinic (RLS)
- ✅ No double-booking (race condition safe)
- ✅ Live on Vercel with custom domain
- ✅ All tests passing
- ✅ Real clinic could use it

---

**Good luck! Take your time and verify each checkpoint.**

If you get stuck:
1. Check the error message carefully
2. Review the checkpoint requirements
3. Look at AfyaBook implementation for hints
4. Search the error online
5. Ask for help after trying for 30 minutes

**Remember: Understanding > Speed**
