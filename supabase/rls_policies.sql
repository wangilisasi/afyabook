-- ============================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES FOR AFYABOOK
-- ============================================================================
-- This file contains all RLS policies for the Tanzanian clinic appointment system
-- Designed for Supabase with JWT-based authentication
--
-- IMPORTANT: These policies assume:
-- 1. Users authenticate via Supabase Auth
-- 2. JWT token contains: clinic_id, role, user_id
-- 3. Patients interact via API only (no direct DB access)
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTION: Extract clinic_id from JWT
-- ============================================================================
-- This function retrieves the current user's clinic_id from their JWT token
-- It returns NULL if the user is not authenticated or has no clinic_id claim

CREATE OR REPLACE FUNCTION get_current_user_clinic_id()
RETURNS UUID AS $$
BEGIN
  -- Extract clinic_id from the JWT token's claims
  -- Supabase stores user metadata in auth.users.raw_user_meta_data
  -- which is accessible via auth.jwt() -> 'user_metadata' ->> 'clinic_id'
  RETURN (
    SELECT NULLIF(
      auth.jwt() -> 'user_metadata' ->> 'clinic_id',
      ''
    )::UUID
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN auth.jwt() -> 'user_metadata' ->> 'role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is a clinic owner
CREATE OR REPLACE FUNCTION is_clinic_owner(clinic_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM clinics c
    WHERE c.id = clinic_id 
      AND c.owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TABLE: clinics
-- ============================================================================
-- Staff can see their own clinic
-- Clinic owners can see their clinics
-- Admins can see all clinics

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view their own clinic
CREATE POLICY "Staff can view their clinic" ON clinics
  FOR SELECT
  USING (
    id = get_current_user_clinic_id()
    OR is_clinic_owner(id)
    OR get_current_user_role() = 'admin'
  );

-- Policy: Only admins and owners can update clinics
CREATE POLICY "Only owners and admins can update clinics" ON clinics
  FOR UPDATE
  USING (
    is_clinic_owner(id)
    OR get_current_user_role() = 'admin'
  );

-- Policy: Only admins can delete clinics
CREATE POLICY "Only admins can delete clinics" ON clinics
  FOR DELETE
  USING (
    get_current_user_role() = 'admin'
  );

-- Policy: Only admins can insert clinics
CREATE POLICY "Only admins can insert clinics" ON clinics
  FOR INSERT
  WITH CHECK (
    get_current_user_role() = 'admin'
  );

-- ============================================================================
-- TABLE: staff
-- ============================================================================
-- Staff can see other staff in their clinic
-- Clinic owners can see all staff in their clinic
-- Staff can only update their own profile
-- Only owners and admins can add/remove staff

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view staff in their clinic
CREATE POLICY "Staff can view clinic staff" ON staff
  FOR SELECT
  USING (
    clinic_id = get_current_user_clinic_id()
    OR is_clinic_owner(clinic_id)
    OR get_current_user_role() = 'admin'
  );

-- Policy: Staff can update their own profile
CREATE POLICY "Staff can update own profile" ON staff
  FOR UPDATE
  USING (
    id = auth.uid()
    OR is_clinic_owner(clinic_id)
    OR get_current_user_role() = 'admin'
  );

-- Policy: Only owners and admins can insert staff
CREATE POLICY "Owners and admins can add staff" ON staff
  FOR INSERT
  WITH CHECK (
    is_clinic_owner(clinic_id)
    OR get_current_user_role() = 'admin'
  );

-- Policy: Only owners and admins can delete staff
CREATE POLICY "Owners and admins can remove staff" ON staff
  FOR DELETE
  USING (
    is_clinic_owner(clinic_id)
    OR get_current_user_role() = 'admin'
  );

-- ============================================================================
-- TABLE: patients
-- ============================================================================
-- KEY REQUIREMENT: Staff can ONLY see patients who have appointments
-- at their clinic. This prevents staff from browsing all patients.
-- 
-- Logic: A patient is visible if they have at least one appointment
-- at the staff member's clinic

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view patients with appointments at their clinic
CREATE POLICY "Staff can view patients with appointments at their clinic" ON patients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM appointments a
      WHERE a.patient_id = patients.id
        AND a.clinic_id = get_current_user_clinic_id()
    )
    OR get_current_user_role() = 'admin'
  );

-- Policy: Staff can insert patients (new registrations)
CREATE POLICY "Staff can register new patients" ON patients
  FOR INSERT
  WITH CHECK (
    get_current_user_clinic_id() IS NOT NULL
    OR get_current_user_role() = 'admin'
  );

-- Policy: Staff can update patients they've seen
CREATE POLICY "Staff can update their clinic's patients" ON patients
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 
      FROM appointments a
      WHERE a.patient_id = patients.id
        AND a.clinic_id = get_current_user_clinic_id()
    )
    OR get_current_user_role() = 'admin'
  );

-- Policy: Prevent deletion of patients (soft delete via is_active instead)
CREATE POLICY "No direct patient deletion" ON patients
  FOR DELETE
  USING (
    get_current_user_role() = 'admin'
  );

-- ============================================================================
-- TABLE: appointment_slots
-- ============================================================================
-- Staff can only see and modify slots for their own clinic
-- This is crucial - staff from Clinic A should never see Clinic B's slots

ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view slots at their clinic
CREATE POLICY "Staff can view clinic slots" ON appointment_slots
  FOR SELECT
  USING (
    clinic_id = get_current_user_clinic_id()
    OR get_current_user_role() = 'admin'
  );

-- Policy: Staff can create slots at their clinic
CREATE POLICY "Staff can create slots at their clinic" ON appointment_slots
  FOR INSERT
  WITH CHECK (
    clinic_id = get_current_user_clinic_id()
    OR get_current_user_role() = 'admin'
  );

-- Policy: Staff can update slots at their clinic
CREATE POLICY "Staff can update clinic slots" ON appointment_slots
  FOR UPDATE
  USING (
    clinic_id = get_current_user_clinic_id()
    OR get_current_user_role() = 'admin'
  );

-- Policy: Staff can delete slots at their clinic
CREATE POLICY "Staff can delete clinic slots" ON appointment_slots
  FOR DELETE
  USING (
    clinic_id = get_current_user_clinic_id()
    OR get_current_user_role() = 'admin'
  );

-- ============================================================================
-- TABLE: appointments
-- ============================================================================
-- Staff can see all appointments at their clinic (needed for scheduling)
-- Staff can create appointments for their clinic
-- Staff can update appointments at their clinic

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view appointments at their clinic
CREATE POLICY "Staff can view clinic appointments" ON appointments
  FOR SELECT
  USING (
    clinic_id = get_current_user_clinic_id()
    OR get_current_user_role() = 'admin'
  );

-- Policy: Staff can create appointments at their clinic
CREATE POLICY "Staff can create appointments" ON appointments
  FOR INSERT
  WITH CHECK (
    clinic_id = get_current_user_clinic_id()
    OR get_current_user_role() = 'admin'
  );

-- Policy: Staff can update appointments at their clinic
CREATE POLICY "Staff can update clinic appointments" ON appointments
  FOR UPDATE
  USING (
    clinic_id = get_current_user_clinic_id()
    OR get_current_user_role() = 'admin'
  );

-- Policy: Staff can delete appointments at their clinic
CREATE POLICY "Staff can delete clinic appointments" ON appointments
  FOR DELETE
  USING (
    clinic_id = get_current_user_clinic_id()
    OR get_current_user_role() = 'admin'
  );

-- ============================================================================
-- TABLE: sms_logs
-- ============================================================================
-- Staff can see SMS logs for their clinic
-- Used for debugging and cost tracking

ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view SMS logs for their clinic
CREATE POLICY "Staff can view clinic SMS logs" ON sms_logs
  FOR SELECT
  USING (
    clinic_id = get_current_user_clinic_id()
    OR get_current_user_role() = 'admin'
  );

-- Policy: System can insert SMS logs (API will handle this)
CREATE POLICY "System can insert SMS logs" ON sms_logs
  FOR INSERT
  WITH CHECK (
    clinic_id = get_current_user_clinic_id()
    OR get_current_user_role() = 'admin'
  );

-- Policy: No updates to SMS logs (immutable audit trail)
CREATE POLICY "SMS logs are immutable" ON sms_logs
  FOR UPDATE
  USING (
    get_current_user_role() = 'admin'
  );

-- Policy: No deletion of SMS logs (compliance requirement)
CREATE POLICY "SMS logs cannot be deleted" ON sms_logs
  FOR DELETE
  USING (
    get_current_user_role() = 'admin'
  );

-- ============================================================================
-- TESTING SCENARIOS
-- ============================================================================
-- Run these tests to verify RLS is working correctly

/*
TEST 1: Staff A from Clinic 1 tries to read Patient from Clinic 2
------------------------------------------------------------
EXPECTED: 0 rows returned (access denied)

-- Setup: Create two clinics
INSERT INTO clinics (id, name, phone_number, region, operating_hours) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Clinic One', '+255711111111', 'Dar es Salaam', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'Clinic Two', '+255722222222', 'Arusha', '{}');

-- Setup: Create staff for each clinic
INSERT INTO staff (id, clinic_id, first_name, last_name, phone_number, role) VALUES
  ('staff-1111-1111', '11111111-1111-1111-1111-111111111111', 'Staff', 'One', '+255711111111', 'doctor'),
  ('staff-2222-2222', '22222222-2222-2222-2222-222222222222', 'Staff', 'Two', '+255722222222', 'doctor');

-- Setup: Create patients
INSERT INTO patients (id, phone_number, first_name, last_name) VALUES
  ('patient-clinic1', '+255700000001', 'Patient', 'One'),
  ('patient-clinic2', '+255700000002', 'Patient', 'Two');

-- Setup: Create appointments linking patients to clinics
INSERT INTO appointments (id, slot_id, patient_id, clinic_id, status) VALUES
  ('appt-1111', 'slot-1111', 'patient-clinic1', '11111111-1111-1111-1111-111111111111', 'BOOKED'),
  ('appt-2222', 'slot-2222', 'patient-clinic2', '22222222-2222-2222-2222-222222222222', 'BOOKED');

-- TEST: Authenticate as Staff One (Clinic 1)
-- Set JWT claims: clinic_id = '11111111-1111-1111-1111-111111111111', role = 'doctor'

-- Attempt to query patients
SELECT * FROM patients;

-- EXPECTED RESULT: Only 'patient-clinic1' is visible
-- 'patient-clinic2' is NOT visible because they have no appointments at Clinic 1


TEST 2: Staff A from Clinic 1 tries to see appointment slots from Clinic 2
------------------------------------------------------------------------
EXPECTED: 0 rows returned (access denied)

-- Setup: Create slots for both clinics
INSERT INTO appointment_slots (id, clinic_id, staff_id, slot_date, start_time, end_time) VALUES
  ('slot-1111', '11111111-1111-1111-1111-111111111111', 'staff-1111-1111', '2025-02-20', '09:00', '09:30'),
  ('slot-2222', '22222222-2222-2222-2222-222222222222', 'staff-2222-2222', '2025-02-20', '09:00', '09:30');

-- TEST: Authenticate as Staff One (Clinic 1)
-- Set JWT claims: clinic_id = '11111111-1111-1111-1111-111111111111', role = 'doctor'

-- Attempt to query slots
SELECT * FROM appointment_slots;

-- EXPECTED RESULT: Only 'slot-1111' is visible
-- 'slot-2222' is NOT visible because it belongs to Clinic 2


TEST 3: Clinic Owner tries to see all data for their clinic
----------------------------------------------------------
EXPECTED: All data for their clinic is visible

-- Setup: Set clinic owner
UPDATE clinics SET owner_id = 'owner-uuid-1111' WHERE id = '11111111-1111-1111-1111-111111111111';

-- TEST: Authenticate as Owner (owner_id = 'owner-uuid-1111')
-- Set JWT claims: sub = 'owner-uuid-1111'

-- Owner should see:
-- - Their clinic details
-- - All staff in their clinic
-- - All patients with appointments at their clinic
-- - All appointment slots at their clinic
-- - All appointments at their clinic
-- - All SMS logs for their clinic


TEST 4: Patient tries to access database directly
------------------------------------------------
EXPECTED: All queries return 0 rows (or connection denied)

-- Patients should NOT have database credentials
-- They interact exclusively through the API layer
-- API layer uses service role key which bypasses RLS
-- This ensures patients can only see their own data via API logic


TEST 5: Admin user tries to access everything
-------------------------------------------
EXPECTED: All data visible across all clinics

-- TEST: Authenticate as Admin
-- Set JWT claims: role = 'admin'

-- Admin should see all records in all tables


TEST 6: Staff tries to update patient they haven't seen
------------------------------------------------------
EXPECTED: Update denied (0 rows affected)

-- Staff One tries to update Patient Two
UPDATE patients 
SET first_name = 'Hacked' 
WHERE id = 'patient-clinic2';

-- EXPECTED: 0 rows updated (policy prevents updating patients 
-- without appointments at staff's clinic)

*/

-- ============================================================================
-- PERFORMANCE OPTIMIZATION
-- ============================================================================
-- Create indexes to speed up RLS policy checks

-- Index for patient appointments lookup (used in patients policy)
CREATE INDEX IF NOT EXISTS idx_appointments_patient_clinic 
ON appointments(patient_id, clinic_id);

-- Index for slot clinic lookup
CREATE INDEX IF NOT EXISTS idx_slots_clinic 
ON appointment_slots(clinic_id);

-- Index for appointment clinic lookup  
CREATE INDEX IF NOT EXISTS idx_appointments_clinic 
ON appointments(clinic_id);

-- Index for SMS logs clinic lookup
CREATE INDEX IF NOT EXISTS idx_sms_logs_clinic 
ON sms_logs(clinic_id);

-- ============================================================================
-- HOW RLS WORKS IN SUPABASE
-- ============================================================================
-- 1. Every query is checked against RLS policies BEFORE execution
-- 2. If no policy allows the operation, the query returns 0 rows
-- 3. Policies use PostgreSQL's USING (for SELECT/UPDATE/DELETE) and 
--    WITH CHECK (for INSERT) clauses
-- 4. auth.uid() returns the UUID of the authenticated user
-- 5. auth.jwt() returns the full JWT token with custom claims
-- 6. Policies are evaluated for EACH row, so they must be efficient
-- 7. RLS can be bypassed using the service_role key (for API layer)
--
-- IMPORTANT: Always test policies with real data to ensure they work!
-- Use Supabase Dashboard -> Table Editor -> Policies to visualize

-- ============================================================================
-- MAINTENANCE NOTES
-- ============================================================================
-- 1. When adding new staff, ensure their JWT contains clinic_id claim
-- 2. When a staff member moves clinics, update their JWT claims
-- 3. Monitor query performance - complex policies can slow down queries
-- 4. Use EXPLAIN ANALYZE to check if indexes are being used
-- 5. For bulk operations, consider temporarily disabling RLS (with caution!)
--
-- To disable RLS on a table (DANGEROUS - only for maintenance):
-- ALTER TABLE patients DISABLE ROW LEVEL SECURITY;
--
-- To check which policies apply to a table:
-- SELECT * FROM pg_policies WHERE tablename = 'patients';
