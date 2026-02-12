# Supabase Row Level Security (RLS) Policies

This document explains the RLS security policies for AfyaBook when using Supabase as the backend.

## What is Row Level Security (RLS)?

RLS is a PostgreSQL feature that **automatically filters** database queries based on the current user. Think of it as a "WHERE clause" that's automatically added to every query.

### How It Works:

```
Staff queries: SELECT * FROM patients
                ↓
RLS Policy adds: WHERE EXISTS (
                    SELECT 1 FROM appointments 
                    WHERE appointments.patient_id = patients.id
                    AND appointments.clinic_id = 'staff-clinic-id'
                  )
                ↓
Result: Only patients with appointments at staff's clinic
```

## Policy Overview

### Table: `clinics`
- ✅ Staff can view their assigned clinic
- ✅ Clinic owners can view their clinics
- ✅ Admins can view all clinics
- ❌ Staff cannot see other clinics' details

### Table: `staff`
- ✅ Staff can view colleagues in their clinic
- ✅ Staff can update their own profile
- ✅ Owners/admins can manage all staff

### Table: `patients` ⭐ KEY POLICY
- ✅ Staff can view patients **who have appointments** at their clinic
- ✅ Staff can register new patients
- ✅ Staff can update their clinic's patients
- ❌ Staff **cannot browse all patients** (privacy protection)

**Why this matters:** Without this, a staff member could query `SELECT * FROM patients` and see every patient in the entire database!

### Table: `appointment_slots`
- ✅ Staff can only see/modify slots for their clinic
- ❌ Staff **cannot see other clinics' schedules** (competitive isolation)

### Table: `appointments`
- ✅ Staff can see all appointments at their clinic (needed for scheduling)
- ✅ Full CRUD operations for their clinic only

### Table: `sms_logs`
- ✅ Staff can view SMS logs for their clinic
- ✅ Immutable audit trail (no updates/deletions except by admin)

## Helper Functions

### `get_current_user_clinic_id()`
Extracts `clinic_id` from the JWT token's user_metadata:

```sql
-- Inside a policy
WHERE clinic_id = get_current_user_clinic_id()
```

**JWT Structure:**
```json
{
  "sub": "user-uuid",
  "role": "authenticated",
  "user_metadata": {
    "clinic_id": "clinic-uuid-123",
    "role": "doctor"
  }
}
```

### `is_clinic_owner(clinic_id UUID)`
Checks if the current user owns a specific clinic.

### `get_current_user_role()`
Returns the user's role from JWT (admin, doctor, nurse, etc.)

## Applying the Policies

### Step 1: Enable RLS on Tables

Run this SQL in Supabase SQL Editor:

```sql
-- Enable RLS on all tables
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
```

### Step 2: Create Helper Functions

Run the helper function definitions from `rls_policies.sql`.

### Step 3: Create Policies

Run each policy definition from `rls_policies.sql`.

## Testing Scenarios

### Scenario 1: Cross-Clinic Data Access (SHOULD FAIL)

**Setup:**
- Staff A works at Clinic 1
- Patient B has only visited Clinic 2

**Test:**
```sql
-- Authenticate as Staff A (clinic_id = 'clinic-1')
SELECT * FROM patients WHERE id = 'patient-b';
```

**Expected Result:** 0 rows (access denied)

**Why:** Patient B has no appointments at Clinic 1, so Staff A cannot see them.

### Scenario 2: Same-Clinic Data Access (SHOULD SUCCEED)

**Setup:**
- Staff A works at Clinic 1
- Patient C has an appointment at Clinic 1

**Test:**
```sql
-- Authenticate as Staff A (clinic_id = 'clinic-1')
SELECT * FROM patients WHERE id = 'patient-c';
```

**Expected Result:** 1 row with patient data

**Why:** Patient C has an appointment at Clinic 1, so Staff A can see them.

### Scenario 3: Slot Visibility (SHOULD BE ISOLATED)

**Setup:**
- Clinic 1 has slots on Monday at 9:00
- Clinic 2 has slots on Monday at 9:00

**Test:**
```sql
-- Authenticate as Staff from Clinic 1
SELECT * FROM appointment_slots WHERE slot_date = '2025-02-20';
```

**Expected Result:** Only Clinic 1's slots

**Why:** RLS automatically filters: `WHERE clinic_id = 'clinic-1'`

## How JWT Claims Work

When a user logs in via Supabase Auth, you set custom claims:

```typescript
// After user login
const { data, error } = await supabase.auth.updateUser({
  data: {
    clinic_id: user.clinic_id,
    role: user.role
  }
})
```

These claims are included in the JWT and accessible via:
- `auth.uid()` - User's UUID
- `auth.jwt() -> 'user_metadata' ->> 'clinic_id'` - Custom clinic ID
- `auth.jwt() -> 'user_metadata' ->> 'role'` - User role

## API vs Direct Database Access

### Patient Access (Via API Only)

**Patients NEVER connect directly to the database.**

Instead:
1. Patient calls your API endpoint
2. API uses **service_role key** (bypasses RLS)
3. API applies its own logic to filter data
4. Patient only sees their own data

```typescript
// API endpoint (using service_role key)
app.get('/api/patient/appointments', async (req, res) => {
  const patientId = req.user.id // From JWT
  
  // RLS is bypassed with service_role, so we manually filter
  const appointments = await supabase
    .from('appointments')
    .select('*')
    .eq('patient_id', patientId) // Manual filter
    
  res.json(appointments)
})
```

### Staff Access (Direct Database)

**Staff connect directly to Supabase** using their JWT token.

```typescript
// Staff client-side code
const supabase = createClient(url, anon_key, {
  auth: { persistSession: true }
})

// This query automatically filters by RLS
const { data } = await supabase
  .from('patients')
  .select('*')
// Only returns patients with appointments at staff's clinic
```

## Security Checklist

- [ ] RLS enabled on all tables
- [ ] All policies created
- [ ] Helper functions installed
- [ ] JWT claims configured for users
- [ ] Service role key secured (never exposed to client)
- [ ] Tested cross-clinic access (should fail)
- [ ] Tested same-clinic access (should succeed)
- [ ] Patients only access via API
- [ ] Indexes created for performance

## Common Issues

### Issue 1: "No rows returned" when rows exist

**Cause:** RLS policy is filtering out all rows.

**Solution:** Check JWT claims are set correctly:
```sql
-- Debug: Check current user's claims
SELECT auth.jwt();
```

### Issue 2: Slow queries with RLS

**Cause:** Complex policies scanning many rows.

**Solution:** Ensure indexes exist:
```sql
-- Check if index is being used
EXPLAIN ANALYZE SELECT * FROM patients;
```

### Issue 3: Patients can see all data

**Cause:** Using anon_key instead of service_role in API.

**Solution:** API should use service_role key:
```typescript
const supabase = createClient(url, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})
```

## Switching from Neon to Supabase

If you want to migrate from Neon PostgreSQL to Supabase:

1. **Export data from Neon:**
   ```bash
   pg_dump $DATABASE_URL > backup.sql
   ```

2. **Import to Supabase:**
   ```bash
   psql $SUPABASE_URL < backup.sql
   ```

3. **Enable RLS on all tables**

4. **Create policies** (use this file)

5. **Update client code:**
   - Remove `@prisma/adapter-neon`
   - Install `@supabase/supabase-js`
   - Replace Prisma client with Supabase client

6. **Configure JWT claims** for staff users

## Performance Notes

RLS policies add overhead to queries. Monitor:
- Query execution time
- Index usage
- Policy complexity

**Optimization tips:**
- Use simple comparisons in policies
- Create indexes on filtered columns
- Avoid subqueries when possible
- Test with real data volumes

## Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [RLS Best Practices](https://supabase.com/docs/learn/auth-deep-dive/auth-row-level-security)
