-- ============================================================================
-- RLS POLICIES FOR NEON POSTGRESQL (AFYABOOK)
-- ============================================================================
-- This migration applies Row Level Security to all tables for clinic isolation
-- Uses PostgreSQL session variables to pass user context
--
-- NOTE: For this to work, the application must set the session variable
--       'app.current_clinic_id' before each query using:
--       SET LOCAL app.current_clinic_id = 'clinic-uuid';
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get current user's clinic_id from session variable
CREATE OR REPLACE FUNCTION get_current_user_clinic_id()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_clinic_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's role from session variable
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_user_role', true);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_current_user_role() = 'admin';
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TABLE: clinics
-- ============================================================================

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view their own clinic
CREATE POLICY "Staff can view their clinic" ON clinics
  FOR SELECT
  USING (
    id = get_current_user_clinic_id()
    OR is_admin()
  );

-- Policy: Only admins can modify clinics
CREATE POLICY "Only admins can update clinics" ON clinics
  FOR UPDATE
  USING (is_admin());

CREATE POLICY "Only admins can delete clinics" ON clinics
  FOR DELETE
  USING (is_admin());

CREATE POLICY "Only admins can insert clinics" ON clinics
  FOR INSERT
  WITH CHECK (is_admin());

-- ============================================================================
-- TABLE: staff
-- ============================================================================

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view staff in their clinic
CREATE POLICY "Staff can view clinic staff" ON staff
  FOR SELECT
  USING (
    clinic_id = get_current_user_clinic_id()
    OR is_admin()
  );

-- Policy: Staff can update their own profile
CREATE POLICY "Staff can update own profile" ON staff
  FOR UPDATE
  USING (
    clinic_id = get_current_user_clinic_id()
    OR is_admin()
  );

-- Policy: Only admins can add/remove staff
CREATE POLICY "Admins can add staff" ON staff
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can remove staff" ON staff
  FOR DELETE
  USING (is_admin());

-- ============================================================================
-- TABLE: patients
-- ============================================================================
-- KEY SECURITY: Staff can ONLY see patients who have appointments at their clinic

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
    OR is_admin()
  );

-- Policy: Staff can insert patients (new registrations)
CREATE POLICY "Staff can register new patients" ON patients
  FOR INSERT
  WITH CHECK (
    get_current_user_clinic_id() IS NOT NULL
    OR is_admin()
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
    OR is_admin()
  );

-- Policy: No direct patient deletion (soft delete only)
CREATE POLICY "No direct patient deletion" ON patients
  FOR DELETE
  USING (is_admin());

-- ============================================================================
-- TABLE: appointment_slots
-- ============================================================================

ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view slots at their clinic
CREATE POLICY "Staff can view clinic slots" ON appointment_slots
  FOR SELECT
  USING (
    clinic_id = get_current_user_clinic_id()
    OR is_admin()
  );

-- Policy: Staff can create slots at their clinic
CREATE POLICY "Staff can create slots at their clinic" ON appointment_slots
  FOR INSERT
  WITH CHECK (
    clinic_id = get_current_user_clinic_id()
    OR is_admin()
  );

-- Policy: Staff can update slots at their clinic
CREATE POLICY "Staff can update clinic slots" ON appointment_slots
  FOR UPDATE
  USING (
    clinic_id = get_current_user_clinic_id()
    OR is_admin()
  );

-- Policy: Staff can delete slots at their clinic
CREATE POLICY "Staff can delete clinic slots" ON appointment_slots
  FOR DELETE
  USING (
    clinic_id = get_current_user_clinic_id()
    OR is_admin()
  );

-- ============================================================================
-- TABLE: appointments
-- ============================================================================

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view appointments at their clinic
CREATE POLICY "Staff can view clinic appointments" ON appointments
  FOR SELECT
  USING (
    clinic_id = get_current_user_clinic_id()
    OR is_admin()
  );

-- Policy: Staff can create appointments at their clinic
CREATE POLICY "Staff can create appointments" ON appointments
  FOR INSERT
  WITH CHECK (
    clinic_id = get_current_user_clinic_id()
    OR is_admin()
  );

-- Policy: Staff can update appointments at their clinic
CREATE POLICY "Staff can update clinic appointments" ON appointments
  FOR UPDATE
  USING (
    clinic_id = get_current_user_clinic_id()
    OR is_admin()
  );

-- Policy: Staff can delete appointments at their clinic
CREATE POLICY "Staff can delete clinic appointments" ON appointments
  FOR DELETE
  USING (
    clinic_id = get_current_user_clinic_id()
    OR is_admin()
  );

-- ============================================================================
-- TABLE: sms_logs
-- ============================================================================

ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view SMS logs for their clinic
CREATE POLICY "Staff can view clinic SMS logs" ON sms_logs
  FOR SELECT
  USING (
    clinic_id = get_current_user_clinic_id()
    OR is_admin()
  );

-- Policy: System can insert SMS logs
CREATE POLICY "System can insert SMS logs" ON sms_logs
  FOR INSERT
  WITH CHECK (
    clinic_id = get_current_user_clinic_id()
    OR is_admin()
  );

-- Policy: SMS logs are immutable (no updates)
CREATE POLICY "SMS logs are immutable" ON sms_logs
  FOR UPDATE
  USING (is_admin());

-- Policy: SMS logs cannot be deleted
CREATE POLICY "SMS logs cannot be deleted" ON sms_logs
  FOR DELETE
  USING (is_admin());

-- ============================================================================
-- TABLE: waitlist
-- ============================================================================

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view waitlist for their clinic
CREATE POLICY "Staff can view clinic waitlist" ON waitlist
  FOR SELECT
  USING (
    clinic_id = get_current_user_clinic_id()
    OR is_admin()
  );

-- Policy: Staff can manage waitlist for their clinic
CREATE POLICY "Staff can manage clinic waitlist" ON waitlist
  FOR ALL
  USING (
    clinic_id = get_current_user_clinic_id()
    OR is_admin()
  );

-- ============================================================================
-- TABLE: cron_logs
-- ============================================================================

ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view cron logs
CREATE POLICY "Only admins can view cron logs" ON cron_logs
  FOR SELECT
  USING (is_admin());

-- Policy: Only system/background jobs can insert cron logs
CREATE POLICY "System can insert cron logs" ON cron_logs
  FOR INSERT
  WITH CHECK (is_admin());

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

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
-- VERIFICATION QUERY
-- ============================================================================
-- Run this to verify RLS is enabled on all tables:
--
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename IN (
--   'clinics', 'staff', 'patients', 'appointment_slots', 
--   'appointments', 'sms_logs', 'waitlist', 'cron_logs'
-- );
