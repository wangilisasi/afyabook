# AfyaBook Testing Checklist

Complete testing guide to verify all functionality before and after deployment.

## Pre-Deployment Testing

### 1. Environment Setup

```bash
# Run verification script
node scripts/verify-install.js
```

**Expected:** All checks should pass ✓

---

### 2. Database Connection

```bash
# Test database connection
npx prisma db pull

# Run migrations
npx prisma migrate dev

# Generate client
npx prisma generate

# Verify connection
npx prisma studio
```

**Expected:** 
- Connection successful
- All tables visible in Prisma Studio
- No migration errors

---

### 3. Build Test

```bash
# Build the application
npm run build
```

**Expected:**
- Build completes without errors
- No TypeScript errors
- All routes compiled successfully

---

## Post-Deployment Testing

### 4. Authentication Flow

#### Test: Staff Login
```
URL: https://your-domain.com/login
```

**Steps:**
1. Navigate to /login
2. Enter clinic ID: `demo-clinic`
3. Enter password: `demo123`
4. Click "Ingia / Login"

**Expected:**
- ✓ Redirects to /dashboard/[clinic_id]/today
- ✓ Clinic name displayed in header
- ✓ Navigation visible (Leo, Tafuta, Weka)

---

### 5. Dashboard - Today View

#### Test: View Today's Appointments
```
URL: https://your-domain.com/dashboard/[clinic_id]/today
```

**Steps:**
1. Load today view
2. Verify stats cards show correct counts
3. Check timeline shows slots 8am-6pm
4. Click date picker to change dates

**Expected:**
- ✓ Stats displayed (Jumla, Imethibitishwa, Amefika, Imekamilika, Hajafika)
- ✓ Timeline shows 30-min intervals
- ✓ Booked slots show patient info
- ✓ Available slots show "Inapatikana"
- ✓ Date navigation works

---

### 6. Dashboard - Status Updates

#### Test: Update Appointment Status

**Steps:**
1. Find a booked appointment
2. Click "Amefika" (Arrived)

**Expected:**
- ✓ Status badge changes to green "Amefika"
- ✓ UI updates immediately (optimistic)
- ✓ No page refresh required
- ✓ Status persists after refresh

**Test Other Statuses:**
- ✓ "Imekamilika" (Completed) → Grey badge
- ✓ "Hajafika" (No-show) → Red badge
- ✓ "Ghairi" (Cancel) → Slot becomes available

---

### 7. Dashboard - Swipe Gestures (Mobile)

#### Test: Mobile Swipe Actions

**Steps:**
1. Open dashboard on mobile device
2. Swipe left on an appointment card
3. Tap status buttons that appear

**Expected:**
- ✓ Swipe reveals action buttons
- ✓ Buttons are tappable
- ✓ Status updates correctly

---

### 8. Dashboard - Pull to Refresh

#### Test: Pull-to-Refresh

**Steps:**
1. On mobile, pull down on the page
2. Release when "Inafurisha" appears

**Expected:**
- ✓ Loading indicator shows
- ✓ Page refreshes with latest data

---

### 9. Patient Search

#### Test: Search Existing Patient
```
URL: https://your-domain.com/dashboard/[clinic_id]/search
```

**Steps:**
1. Enter phone: `+255712345678`
2. Click "Tafuta"

**Expected:**
- ✓ Shows "Juma Abdallah"
- ✓ Shows visit count
- ✓ Shows last visit date
- ✓ Has "Hifadhi miadi" button

#### Test: Search Non-Existent Patient

**Steps:**
1. Enter phone: `+255999999999`
2. Click "Tafuta"

**Expected:**
- ✓ Shows "Hakuna mgonjwa aliyepatikana"
- ✓ Offers "Sajili mgonjwa mpya" button

---

### 10. Patient History

#### Test: View Appointment History

**Steps:**
1. Search for existing patient
2. Click "Onyesha historia"

**Expected:**
- ✓ Expands to show past appointments
- ✓ Shows dates, doctors, statuses

---

### 11. Quick Book - Step 1: Phone Lookup

#### Test: Book for Existing Patient
```
URL: https://your-domain.com/dashboard/[clinic_id]/quick-book
```

**Steps:**
1. Enter phone: `+255712345678`
2. Click continue

**Expected:**
- ✓ Skips to Step 3 (Service)
- ✓ Shows patient name in summary

#### Test: Book for New Patient

**Steps:**
1. Enter new phone: `+255777888999`
2. Click continue

**Expected:**
- ✓ Goes to Step 2 (Patient Registration)
- ✓ Prompts for patient name

---

### 12. Quick Book - Step 2: Patient Registration

#### Test: Register New Patient

**Steps:**
1. Enter name: "Mwanaidi Hassan"
2. Click "Sajili"

**Expected:**
- ✓ Patient created
- ✓ Advances to Step 3

---

### 13. Quick Book - Step 3: Service Selection

#### Test: Select Service Type

**Steps:**
1. Click "Huduma ya jumla" (General)

**Expected:**
- ✓ Advances to Step 4 (Slots)

---

### 14. Quick Book - Step 4: Slot Selection

#### Test: Select Available Slot

**Steps:**
1. Choose a date
2. Click an available time slot

**Expected:**
- ✓ Advances to Step 5 (Confirm)
- ✓ Slot details shown in summary

---

### 15. Quick Book - Step 5: Confirmation

#### Test: Complete Booking

**Steps:**
1. Review booking details
2. Click "Thibitisha"

**Expected:**
- ✓ Shows success message
- ✓ Appointment created in database
- ✓ Slot marked as unavailable
- ✓ SMS confirmation queued

---

### 16. API - Patient Booking

#### Test: Book Appointment via API

```bash
curl -X POST https://your-domain.com/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "slotId": "your-slot-id",
    "patientId": "your-patient-id",
    "clinicId": "your-clinic-id",
    "appointmentType": "general"
  }'
```

**Expected:**
- ✓ Returns 201 Created
- ✓ Appointment data in response
- ✓ SMS sent to patient

---

### 17. SMS - Confirmation

#### Test: Receive Booking Confirmation

**Steps:**
1. Book an appointment with your phone number
2. Check your SMS inbox

**Expected:**
- ✓ SMS received within 30 seconds
- ✓ Message in Swahili
- ✓ Contains appointment details

**Sample Message:**
```
Habari Juma, umefanikiwa kuhudumu Jan 15, 2024 saa 9:00 AM 
na Dr. John Masanja. Kliniki: Demo Medical Center. 
Mawasiliano: +255123456789. Tafadhali kuja mapema. Asante!
```

---

### 18. Cron - 24h Reminder

#### Test: Automated Reminder

**Setup:**
1. Book appointment 23-25 hours from now
2. Wait for cron job to run (runs every hour)

**Or manually trigger:**
```bash
curl -X POST "https://your-domain.com/api/reminders/send-now?secret_key=YOUR_KEY"
```

**Expected:**
- ✓ Reminder SMS sent
- ✓ `reminder24hSent` flag updated to true
- ✓ Entry in cron_logs table

---

### 19. Cron - Same-Day Reminder

#### Test: Same-Day Reminder

**Setup:**
1. Book appointment 2-4 hours from now
2. Wait for cron job

**Expected:**
- ✓ Same-day reminder SMS sent
- ✓ `reminderSameDaySent` flag updated

---

### 20. Webhook - SMS Status

#### Test: Delivery Status Update

**Setup:**
1. Configure Twilio webhook URL
2. Send an SMS
3. Wait for delivery callback

**Verify:**
```sql
SELECT * FROM sms_logs 
WHERE status = 'DELIVERED' 
ORDER BY created_at DESC 
LIMIT 5;
```

**Expected:**
- ✓ Status updates from SENT to DELIVERED
- ✓ `delivered_at` timestamp set
- ✓ `twilio_response` contains webhook data

---

### 21. Status Change Updates Availability

#### Test: Cancel Appointment

**Steps:**
1. Cancel an existing appointment
2. Check if slot becomes available

**Verify:**
```sql
SELECT is_available FROM appointment_slots 
WHERE id = 'your-slot-id';
```

**Expected:**
- ✓ Slot `is_available` returns to true
- ✓ Can book new appointment in that slot

---

### 22. RLS - Cross-Clinic Isolation

#### Test: Clinic Data Isolation

**Setup:**
1. Create appointment in Clinic A
2. Try to access from Clinic B context

**Expected:**
- ✓ Clinic B cannot see Clinic A's appointments
- ✓ RLS policy prevents cross-clinic access

---

### 23. Mobile Responsiveness

#### Test: Mobile Layout

**Devices to Test:**
- iPhone (Safari)
- Android (Chrome)
- Tablet (iPad/Android)

**Check:**
- ✓ Login page fits screen
- ✓ Dashboard timeline scrolls properly
- ✓ Buttons are tappable (min 44px)
- ✓ Text is readable
- ✓ No horizontal scroll

---

### 24. Error Handling

#### Test: Invalid Login

**Steps:**
1. Try login with wrong password

**Expected:**
- ✓ Shows error message in Swahili
- ✓ No stack trace leaked
- ✓ Can retry

#### Test: Invalid API Request

```bash
curl -X POST https://your-domain.com/api/appointments \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}'
```

**Expected:**
- ✓ Returns 400 Bad Request
- ✓ Helpful error message
- ✓ No server crash

---

### 25. Performance

#### Test: Page Load Times

Use browser DevTools:
- Today dashboard: < 2 seconds
- Search page: < 1 second
- Quick book: < 1 second

#### Test: API Response Times

```bash
curl -w "@curl-format.txt" -o /dev/null -s \
  https://your-domain.com/api/appointments/today?clinicId=xxx
```

**Expected:**
- ✓ API responses < 500ms

---

## Load Testing

### 26. Concurrent Bookings

```bash
# Run multiple bookings simultaneously
for i in {1..10}; do
  curl -X POST https://your-domain.com/api/appointments \
    -H "Content-Type: application/json" \
    -d "{\"slotId\": \"slot-$i\", \"patientId\": \"patient-$i\", \"clinicId\": \"demo-clinic\", \"appointmentType\": \"general\"}" &
done
wait
```

**Expected:**
- ✓ No race conditions
- ✓ No double-booking
- ✓ All transactions succeed

---

## Security Testing

### 27. SQL Injection

```bash
curl "https://your-domain.com/api/patients/lookup?phone='; DROP TABLE patients; --"
```

**Expected:**
- ✓ No SQL injection possible
- ✓ Prisma parameterized queries protect against this

### 28. XSS Prevention

Try entering in patient name:
```html
<script>alert('xss')</script>
```

**Expected:**
- ✓ Script tags escaped
- ✓ No JavaScript execution

---

## Troubleshooting Tests

### 29. SMS Not Sending

**Check:**
1. Twilio credentials valid? ✓
2. Phone number format correct? (starts with +) ✓
3. Twilio account has balance? ✓
4. SMS logs show "SENT" status? ✓

### 30. Cron Not Running

**Check:**
1. `CRON_SECRET` set in Vercel? ✓
2. Cron job visible in Vercel dashboard? ✓
3. Recent runs in cron_logs table? ✓
4. Check Vercel function logs

### 31. Timezone Issues

**Check:**
1. Server timezone set to UTC? ✓
2. Tanzania offset (+3) applied correctly? ✓
3. Appointment times display correctly? ✓

---

## Sign-Off Checklist

Before going live, verify:

- [ ] All tests above pass
- [ ] Environment variables configured in production
- [ ] Twilio webhook URL set
- [ ] Database migrations applied
- [ ] Demo data seeded (optional)
- [ ] Error monitoring enabled (Sentry/LogRocket)
- [ ] Analytics enabled (optional)
- [ ] Staff trained on dashboard usage
- [ ] Backup strategy in place
- [ ] SSL certificate valid
- [ ] Domain DNS configured

---

## Post-Launch Monitoring

Monitor daily for first week:

- [ ] Cron jobs running successfully
- [ ] SMS delivery rates > 95%
- [ ] No failed API requests
- [ ] Database connection stable
- [ ] Page load times acceptable
- [ ] Error logs empty
- [ ] User feedback positive

---

## Support Contacts

- **Technical Issues:** Check logs in Vercel dashboard
- **SMS Issues:** Check Twilio console
- **Database Issues:** Check Supabase dashboard
- **General Help:** Refer to README.md and DEPLOY.md
