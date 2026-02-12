# Understanding Row Level Security (RLS)

## What is RLS?

**Row Level Security (RLS)** is a database feature that automatically filters which rows a user can see or modify. Think of it as an invisible security guard that checks every database query before it executes.

## The Simple Analogy

Imagine a hospital with multiple clinics:

**Without RLS:**
- A doctor at Clinic A can walk into Clinic B's filing cabinet
- They can open any patient's file, even from other clinics
- Anyone with database access sees everything

**With RLS:**
- Doctor A can only access Clinic A's filing cabinet
- They can only see patients who have appointments at Clinic A
- The "security guard" automatically blocks access to other clinics' data

## How RLS Works

### 1. The Problem It Solves

When you run a database query like:
```sql
SELECT * FROM patients
```

Normally, this returns **ALL patients** in the database.

With RLS, the database automatically adds a filter:
```sql
SELECT * FROM patients
WHERE clinic_id = 'current-user-clinic-id'  -- Added automatically!
```

### 2. Where the Filter Comes From

RLS policies use information from the user's **JWT token** (authentication token):

```json
{
  "user_id": "uuid-123",
  "clinic_id": "clinic-456",
  "role": "doctor"
}
```

The policy reads these values and applies them as filters.

## Real-World Example: Clinic System

### Scenario: Cross-Clinic Data Protection

**The Setup:**
- Dr. John works at **Afya Health Centre** (Clinic A)
- Maria is a patient who only visits **Amani Clinic** (Clinic B)
- Dr. John has database access

**Without RLS (DANGEROUS):**
```sql
-- Dr. John runs this query
SELECT * FROM patients WHERE name = 'Maria';
-- Result: All Maria's data visible!
```

**With RLS (SECURE):**
```sql
-- Dr. John runs the same query
SELECT * FROM patients WHERE name = 'Maria';

-- RLS automatically adds:
-- AND EXISTS (
--   SELECT 1 FROM appointments 
--   WHERE appointments.patient_id = patients.id
--   AND appointments.clinic_id = 'afya-health-centre'
-- )

-- Result: 0 rows (Maria never visited Clinic A)
```

## How Policies Are Written

### Basic Structure

```sql
CREATE POLICY "policy_name" ON table_name
  FOR operation  -- SELECT, INSERT, UPDATE, DELETE
  USING (condition);  -- When can they access?
```

### Example Policy

```sql
-- Staff can only see slots at their clinic
CREATE POLICY "Staff can view clinic slots" ON appointment_slots
  FOR SELECT
  USING (
    clinic_id = get_current_user_clinic_id()
  );
```

### What Happens Behind the Scenes

**User Query:**
```sql
SELECT * FROM appointment_slots WHERE date = '2025-02-20'
```

**Database Actually Runs:**
```sql
SELECT * FROM appointment_slots 
WHERE date = '2025-02-20'
  AND clinic_id = 'current-user-clinic-id'  -- Added by RLS!
```

## Types of RLS Policies

### 1. SELECT Policies (Read Access)
Control who can see which rows:

```sql
-- Staff see only their clinic's patients
CREATE POLICY "Staff view patients" ON patients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM appointments 
      WHERE appointments.patient_id = patients.id
      AND appointments.clinic_id = get_current_user_clinic_id()
    )
  );
```

### 2. INSERT Policies (Create Access)
Control who can create new rows:

```sql
-- Staff can only create slots at their clinic
CREATE POLICY "Staff create slots" ON appointment_slots
  FOR INSERT
  WITH CHECK (
    clinic_id = get_current_user_clinic_id()
  );
```

**Note:** `WITH CHECK` validates the new row meets the condition.

### 3. UPDATE Policies (Modify Access)
Control who can update existing rows:

```sql
-- Staff can update appointments at their clinic
CREATE POLICY "Staff update appointments" ON appointments
  FOR UPDATE
  USING (
    clinic_id = get_current_user_clinic_id()
  );
```

### 4. DELETE Policies (Remove Access)
Control who can delete rows:

```sql
-- Only admins can delete SMS logs
CREATE POLICY "Admin delete logs" ON sms_logs
  FOR DELETE
  USING (
    get_current_user_role() = 'admin'
  );
```

## Key Concepts

### 1. Enable RLS First

Before policies work, you must enable RLS on the table:

```sql
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
```

Without this, anyone can query all rows!

### 2. Default Deny

Once RLS is enabled:
- **No one** can access any rows by default
- You must explicitly create policies to allow access
- This is "secure by default"

### 3. Helper Functions

RLS policies often use helper functions to get user info:

```sql
-- Get current user's clinic from JWT
CREATE FUNCTION get_current_user_clinic_id() 
RETURNS UUID AS $$
  RETURN auth.jwt() -> 'user_metadata' ->> 'clinic_id';
END;
$$ LANGUAGE plpgsql;
```

### 4. JWT Claims

When a user logs in, they get a JWT token with custom data:

```json
{
  "sub": "user-uuid",
  "email": "doctor@clinic.com",
  "user_metadata": {
    "clinic_id": "clinic-uuid-123",
    "role": "doctor",
    "permissions": ["read", "write"]
  }
}
```

RLS policies read these values to determine access.

## Common RLS Patterns

### Pattern 1: Simple Ownership

```sql
-- Users can only see their own rows
CREATE POLICY "Own data only" ON todos
  FOR SELECT
  USING (user_id = auth.uid());
```

### Pattern 2: Team/Organization Access

```sql
-- Team members see all team data
CREATE POLICY "Team access" ON projects
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members 
      WHERE user_id = auth.uid()
    )
  );
```

### Pattern 3: Role-Based Access

```sql
-- Admins see everything, users see own data
CREATE POLICY "Role-based" ON documents
  FOR SELECT
  USING (
    auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
    OR owner_id = auth.uid()
  );
```

### Pattern 4: Complex Relationships

```sql
-- See data related to your appointments (like our patient policy)
CREATE POLICY "Related data" ON patients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM appointments
      WHERE appointments.patient_id = patients.id
      AND appointments.clinic_id = get_current_user_clinic_id()
    )
  );
```

## RLS in Different Databases

### PostgreSQL (Supabase)
- ✅ Native RLS support
- ✅ Uses `CREATE POLICY`
- ✅ Can use custom functions
- ✅ Very flexible

### SQLite
- ❌ No native RLS
- Workaround: Application-level filtering
- Or use: Middleware (like we did with Prisma)

### MySQL
- ✅ RLS available in Enterprise Edition
- ❌ Not in Community Edition
- Workaround: Views with user filters

### SQL Server
- ✅ Native RLS support
- ✅ Uses `CREATE SECURITY POLICY`
- ✅ Integrated with Active Directory

## RLS vs Application-Level Security

| Feature | RLS (Database) | Middleware (Application) |
|---------|----------------|-------------------------|
| **Enforcement** | Database level | Application level |
| **Cannot be bypassed** | ✅ Yes | ❌ No (if API is compromised) |
| **Performance** | ⚡ Fast (indexes work) | ⚡ Fast |
| **Flexibility** | 📝 SQL-based | 📝 Code-based |
| **Debugging** | 🔍 Harder | 🔍 Easier |
| **Complexity** | 📚 SQL knowledge needed | 💻 Programming needed |

**Best Practice:** Use BOTH!
- RLS as the safety net (last line of defense)
- Application-level for better error messages and UX

## Testing RLS Policies

### 1. Test as Different Users

```sql
-- Set JWT claims for testing
SET LOCAL "request.jwt.claims" = '{"clinic_id": "clinic-a"}';

-- Run query
SELECT * FROM patients;
-- Should only see Clinic A patients
```

### 2. Test Edge Cases

```sql
-- Test: User with no clinic_id
SET LOCAL "request.jwt.claims" = '{}';
SELECT * FROM appointment_slots;
-- Should return 0 rows

-- Test: Admin user
SET LOCAL "request.jwt.claims" = '{"role": "admin"}';
SELECT * FROM appointment_slots;
-- Should return all rows
```

### 3. Verify Performance

```sql
-- Check if RLS uses indexes
EXPLAIN ANALYZE SELECT * FROM patients;
-- Look for "Index Scan" not "Seq Scan"
```

## Common RLS Mistakes

### ❌ Mistake 1: No Policy for INSERT

```sql
-- Bad: Only SELECT policy
CREATE POLICY "read" ON patients FOR SELECT USING (...);

-- User tries to insert
INSERT INTO patients (...) VALUES (...);
-- ERROR: No policy allows this!
```

**Fix:** Create INSERT policy
```sql
CREATE POLICY "insert" ON patients 
  FOR INSERT WITH CHECK (clinic_id = get_current_user_clinic_id());
```

### ❌ Mistake 2: Policies Are Too Restrictive

```sql
-- Bad: Staff can't see anything
CREATE POLICY "restrictive" ON patients
  FOR SELECT USING (1 = 0);  -- Always false!
```

**Fix:** Test policies with real data

### ❌ Mistake 3: Expensive Subqueries

```sql
-- Bad: Slow on large tables
CREATE POLICY "slow" ON patients
  FOR SELECT USING (
    (SELECT COUNT(*) FROM appointments WHERE ...) > 0
  );
```

**Fix:** Use EXISTS instead
```sql
CREATE POLICY "fast" ON patients
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM appointments WHERE ...)
  );
```

### ❌ Mistake 4: Forgetting to Enable RLS

```sql
-- Bad: Table created, policies created, but...
-- SELECT * FROM patients; -- Returns ALL rows!

-- Fix:
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
```

## When to Use RLS

### ✅ Use RLS When:
- Multi-tenant applications (SaaS)
- Strict data isolation required
- Different users see different data
- Compliance requirements (HIPAA, GDPR)
- API directly exposes database

### ❌ Don't Need RLS When:
- Single-tenant application
- All users see same data
- Database only accessed by backend
- Simple CRUD without user filtering

## RLS in AfyaBook

### Our Implementation Strategy

**For Supabase:**
- ✅ Use native PostgreSQL RLS policies
- ✅ JWT contains `clinic_id` and `role`
- ✅ Staff isolated to their clinic
- ✅ Patients only visible via appointments

**For Neon:**
- ❌ No native RLS
- ✅ Use Prisma middleware instead
- ✅ Same security rules, implemented in code
- ✅ Authorization context passed with each query

### Why Both Approaches?

**Supabase RLS:**
- Database-enforced security
- Cannot be bypassed by API bugs
- Great for direct database access

**Prisma Middleware:**
- Works with any PostgreSQL provider
- Easier to debug and test
- More flexible for complex logic

## Summary

**RLS is your database bodyguard:**
- Sits between user queries and data
- Automatically filters based on user identity
- Prevents accidental data leaks
- Enforces security at the lowest level

**Key Takeaway:**
Without RLS: `SELECT * FROM patients` = All patients visible
With RLS: `SELECT * FROM patients` = Only authorized patients visible

**The best part?** Users don't even know RLS exists—it just works silently in the background!
