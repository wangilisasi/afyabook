# RLS Implementation Guide (Neon PostgreSQL)

This guide explains how Row Level Security (RLS) is implemented in AfyaBook using Neon PostgreSQL.

## Overview

We've implemented database-level Row Level Security to ensure that:
- Staff can only access data from their own clinic
- Patients are only visible to staff who have appointments with them
- All data access is automatically filtered at the database level

## Architecture

```
API Request
    ↓
JWT Authentication (extract clinic_id)
    ↓
RLS Context Injection (set session variables)
    ↓
PostgreSQL Query (filtered by RLS policies)
    ↓
Response (clinic-scoped data only)
```

## Key Components

### 1. Database Policies (`prisma/migrations/20260215000000_add_rls_policies/migration.sql`)

**Tables with RLS Enabled:**
- `clinics` - Staff see only their clinic
- `staff` - Staff see colleagues in their clinic
- `patients` - Staff only see patients with appointments at their clinic
- `appointment_slots` - Clinic-isolated slot management
- `appointments` - Full CRUD limited to staff's clinic
- `sms_logs` - Clinic-scoped SMS history
- `waitlist` - Clinic-specific waitlist
- `cron_logs` - Admin-only access

**Key Security Policy - Patients:**
```sql
-- Staff can ONLY view patients who have appointments at their clinic
CREATE POLICY "Staff can view patients with appointments at their clinic" ON patients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM appointments a
      WHERE a.patient_id = patients.id
        AND a.clinic_id = get_current_user_clinic_id()
    )
    OR is_admin()
  );
```

### 2. Session Variables

RLS uses PostgreSQL session variables to pass user context:
- `app.current_clinic_id` - The authenticated user's clinic UUID
- `app.current_user_role` - User's role (admin, doctor, nurse, etc.)

These are set before each query and automatically cleared afterward.

### 3. Helper Functions (`src/lib/middleware/authorization.ts`)

**`withRLSContext(authContext, fn)`**
Execute database queries with RLS context:
```typescript
const patients = await withRLSContext(
  { userId: '...', userRole: 'doctor', clinicId: '...', isAuthenticated: true },
  () => prisma.patient.findMany()
)
```

**`applyRLS(authContext, queryFn)`**
Simplified version of `withRLSContext`.

**`getRLSPrisma(authContext)`**
Returns a Prisma client proxy that automatically applies RLS to all queries.

### 4. Route Helpers (`src/lib/middleware/rls-route-helpers.ts`)

**`withRLS(handler, options)`**
Higher-order function to protect API routes:
```typescript
export const GET = withRLS(async (request, { auth, db }) => {
  // auth contains authenticated user context
  // db is a Prisma client with automatic RLS
  const patients = await db.patient.findMany()
  return NextResponse.json({ patients })
}, { requiredType: 'clinic', requireClinic: true })
```

## Usage Examples

### Protecting a Clinic API Route

**Before (no RLS):**
```typescript
export async function GET(request: NextRequest) {
  const authResult = requireAuth(request, { requiredType: 'clinic' })
  if (!authResult.success) return authResult.response
  
  // Must manually filter by clinic_id
  const appointments = await prisma.appointment.findMany({
    where: { clinicId: authResult.auth.clinicId }
  })
  
  return NextResponse.json({ appointments })
}
```

**After (with RLS):**
```typescript
import { withRLS } from '@/lib/middleware/rls-route-helpers'

export const GET = withRLS(async (request, { auth, db }) => {
  // RLS automatically filters by clinic
  const appointments = await db.appointment.findMany()
  return NextResponse.json({ appointments })
}, { requiredType: 'clinic', requireClinic: true })
```

### Manual RLS Context (for complex operations)

```typescript
import { applyRLS } from '@/lib/middleware/authorization'

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request)
  
  const result = await applyRLS(
    { 
      userId: auth.userId,
      userRole: auth.role,
      clinicId: auth.clinicId,
      isAuthenticated: true 
    },
    async () => {
      return prisma.$transaction(async (tx) => {
        // All queries in this transaction are RLS-protected
        const patient = await tx.patient.create({ data: {...} })
        const appointment = await tx.appointment.create({ data: {...} })
        return { patient, appointment }
      })
    }
  )
  
  return NextResponse.json(result)
}
```

### Patient-Facing Routes (no RLS needed)

Patient routes that don't need clinic-scoped data should NOT use RLS:
```typescript
// Patient booking an appointment - uses regular Prisma
export async function POST(request: NextRequest) {
  // No RLS wrapper needed for patient-facing APIs
  const appointment = await prisma.appointment.create({...})
  return NextResponse.json({ appointment })
}
```

## Deployment

### 1. Apply RLS Policies

```bash
# Make sure DATABASE_URL is set
export DATABASE_URL="postgresql://user:password@host:port/database"

# Run the deployment script
./scripts/apply-rls.sh
```

Or apply manually with Prisma:
```bash
npx prisma migrate dev --name add_rls_policies
```

### 2. Verify RLS is Enabled

```bash
psql $DATABASE_URL -c "
  SELECT tablename, rowsecurity 
  FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename IN ('clinics', 'staff', 'patients', 'appointment_slots', 'appointments', 'sms_logs', 'waitlist', 'cron_logs');
"
```

Expected output:
```
     tablename      | rowsecurity
--------------------+-------------
 clinics            | t
 staff              | t
 patients           | t
 appointment_slots  | t
 appointments       | t
 sms_logs           | t
 waitlist           | t
 cron_logs          | t
```

### 3. Test RLS Enforcement

```bash
# Connect to database
psql $DATABASE_URL

-- Set context for Clinic A
SET LOCAL app.current_clinic_id = 'clinic-a-uuid';
SET LOCAL app.current_user_role = 'doctor';

-- Query patients - should only show patients with appointments at Clinic A
SELECT * FROM patients;

-- Query appointments - should only show Clinic A's appointments
SELECT * FROM appointments;

-- Reset context
RESET app.current_clinic_id;
RESET app.current_user_role;
```

## Security Checklist

Before deploying to production:

- [ ] RLS enabled on all tables (`rowsecurity = true`)
- [ ] All policies created and active
- [ ] Helper functions installed (`get_current_user_clinic_id`, `is_admin`)
- [ ] Clinic API routes use `withRLS` wrapper
- [ ] JWT tokens include `clinicId` for staff users
- [ ] Tested cross-clinic access (should return 0 rows)
- [ ] Tested same-clinic access (should return data)
- [ ] Patient-facing APIs don't use clinic-scoped RLS
- [ ] Admin users can still access all data
- [ ] Performance indexes created for RLS queries
- [ ] Service role (background jobs, cron) bypass documented

## Testing RLS

### Test 1: Cross-Clinic Data Isolation

```typescript
// Staff from Clinic A tries to access Clinic B's data
const result = await applyRLS(
  { userId: 'staff-a', userRole: 'doctor', clinicId: 'clinic-a-uuid', isAuthenticated: true },
  () => prisma.appointment.findMany({
    where: { clinicId: 'clinic-b-uuid' }  // Trying to access different clinic
  })
)
// Expected: Empty array (RLS blocks access)
```

### Test 2: Patient Visibility

```sql
-- Clinic A has appointments with Patient 1
-- Clinic B has appointments with Patient 2

-- Authenticated as Clinic A staff
SET LOCAL app.current_clinic_id = 'clinic-a-uuid';
SET LOCAL app.current_user_role = 'doctor';

SELECT * FROM patients;
-- Expected: Only Patient 1 is visible

RESET app.current_clinic_id;
RESET app.current_user_role;
```

### Test 3: Admin Override

```typescript
// Admin can see all data
const result = await applyRLS(
  { userId: 'admin-1', userRole: 'admin', isAuthenticated: true },
  () => prisma.appointment.findMany()
)
// Expected: All appointments from all clinics
```

## Performance Considerations

### Indexes for RLS Policies

The migration creates indexes to speed up policy checks:
- `idx_appointments_patient_clinic` - Patient appointment lookups
- `idx_slots_clinic` - Slot clinic filtering
- `idx_appointments_clinic` - Appointment clinic filtering
- `idx_sms_logs_clinic` - SMS log filtering

### Query Performance

RLS policies add a small overhead (typically 1-5ms per query). The impact is minimal with proper indexing.

To check if indexes are being used:
```sql
EXPLAIN ANALYZE SELECT * FROM patients;
-- Look for "Index Scan" or "Bitmap Index Scan"
```

## Troubleshooting

### Issue: No data returned when there should be data

**Cause:** Session variables not set correctly
**Solution:**
```typescript
// Check if context is being set
console.log('Auth context:', auth)
// Should show: { userId, userRole, clinicId, isAuthenticated }
```

### Issue: Can see data from other clinics

**Cause:** RLS not enabled on table or policies not applied
**Solution:**
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'appointments';

-- If rowsecurity is false, re-enable it
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
```

### Issue: Admin can't see all data

**Cause:** Admin role not being recognized
**Solution:**
```typescript
// Ensure role is set to 'admin'
await applyRLS(
  { userId: 'admin-1', userRole: 'admin', isAuthenticated: true },
  () => prisma.appointment.findMany()
)
```

## Migration Notes

### From Non-RLS Setup

If you're migrating from a non-RLS setup:

1. **Backup your database** before applying RLS
2. **Test thoroughly** in a staging environment
3. **Update all clinic routes** to use `withRLS` wrapper
4. **Verify** that patient-facing APIs still work
5. **Monitor** query performance after deployment

### Future: Migration to Supabase

The RLS policies are designed to be compatible with Supabase. When migrating:

1. Export data from Neon
2. Import to Supabase
3. Replace session variable functions with Supabase's `auth.uid()` and `auth.jwt()`
4. Update policies to use Supabase functions
5. See `/var/www/afyabook/supabase/rls_policies.sql` for Supabase-specific policies

## Additional Resources

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Neon PostgreSQL Docs](https://neon.tech/docs/introduction)
- [Prisma Client Extensions](https://www.prisma.io/docs/concepts/components/prisma-client/client-extensions)

## Support

If you encounter issues:
1. Check that all migrations have been applied
2. Verify session variables are being set correctly
3. Test with direct SQL queries first
4. Review the policies in `prisma/migrations/20260215000000_add_rls_policies/migration.sql`
