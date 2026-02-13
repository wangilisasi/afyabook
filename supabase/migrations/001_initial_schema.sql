-- ============================================================================
-- AFYABOOK INITIAL SCHEMA
-- Tanzanian Clinic Appointment System
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Appointment status enum
CREATE TYPE appointment_status AS ENUM (
  'BOOKED',        -- Initial state when slot is reserved
  'CONFIRMED',     -- Patient confirmed via SMS/call
  'REMINDER_SENT', -- Reminder SMS dispatched
  'CHECKED_IN',    -- Patient arrived at clinic
  'COMPLETED',     -- Appointment finished successfully
  'CANCELLED',     -- Cancelled by patient or clinic
  'NO_SHOW'        -- Patient didn't show up
);

-- SMS type enum
CREATE TYPE sms_type AS ENUM (
  'BOOKING_CONFIRMATION',
  'REMINDER_24H',
  'REMINDER_1H',
  'CANCELLATION',
  'RESCHEDULE',
  'GENERAL',
  'CHECK_IN_CONFIRMATION'
);

-- SMS status enum
CREATE TYPE sms_status AS ENUM (
  'PENDING',
  'SENT',
  'DELIVERED',
  'FAILED',
  'UNDELIVERED'
);

-- Cron status enum
CREATE TYPE cron_status AS ENUM (
  'RUNNING',
  'SUCCESS',
  'PARTIAL',
  'FAILED',
  'TIMEOUT'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Patients table
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('M', 'F', 'O')),
  language TEXT DEFAULT 'sw' CHECK (language IN ('sw', 'en')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clinics table
CREATE TABLE clinics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  address TEXT,
  region TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  operating_hours TEXT NOT NULL, -- JSON string
  timezone TEXT DEFAULT 'Africa/Dar_es_Salaam',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff table
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  role TEXT NOT NULL,
  specialization TEXT,
  license_number TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointment slots table
CREATE TABLE appointment_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments table
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_id UUID UNIQUE NOT NULL REFERENCES appointment_slots(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  status appointment_status DEFAULT 'BOOKED',
  appointment_type TEXT DEFAULT 'general',
  notes TEXT,
  -- Legacy reminder fields
  reminder_sent BOOLEAN DEFAULT FALSE,
  reminder_sent_at TIMESTAMPTZ,
  -- New reminder system
  reminder_24h_sent BOOLEAN DEFAULT FALSE,
  reminder_24h_sent_at TIMESTAMPTZ,
  reminder_24h_failed BOOLEAN DEFAULT FALSE,
  reminder_24h_error TEXT,
  reminder_same_day_sent BOOLEAN DEFAULT FALSE,
  reminder_same_day_sent_at TIMESTAMPTZ,
  reminder_same_day_failed BOOLEAN DEFAULT FALSE,
  reminder_same_day_error TEXT,
  checked_in_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SMS logs table
CREATE TABLE sms_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id TEXT UNIQUE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  message_type sms_type NOT NULL,
  message_body TEXT NOT NULL,
  status sms_status DEFAULT 'PENDING',
  twilio_response TEXT,
  error_code TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cost_usd FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cron logs table
CREATE TABLE cron_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status cron_status DEFAULT 'RUNNING',
  appointments_checked INTEGER DEFAULT 0,
  reminders_sent INTEGER DEFAULT 0,
  reminders_failed INTEGER DEFAULT 0,
  retries_attempted INTEGER DEFAULT 0,
  error_message TEXT,
  error_stack TEXT,
  duration_ms INTEGER,
  request_id TEXT,
  triggered_by TEXT DEFAULT 'cron',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Patients indexes
CREATE INDEX idx_patients_phone ON patients(phone_number);
CREATE INDEX idx_patients_created_at ON patients(created_at);

-- Clinics indexes
CREATE INDEX idx_clinics_region ON clinics(region);
CREATE INDEX idx_clinics_is_active ON clinics(is_active);

-- Staff indexes
CREATE INDEX idx_staff_clinic_id ON staff(clinic_id);
CREATE INDEX idx_staff_role ON staff(role);
CREATE INDEX idx_staff_is_active ON staff(is_active);

-- Slots indexes
CREATE INDEX idx_slots_clinic_date ON appointment_slots(clinic_id, slot_date);
CREATE INDEX idx_slots_staff_date ON appointment_slots(staff_id, slot_date);
CREATE INDEX idx_slots_date_available ON appointment_slots(slot_date, is_available);
CREATE INDEX idx_slots_is_available ON appointment_slots(is_available);

-- Appointments indexes
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_clinic_status ON appointments(clinic_id, status);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_created_at ON appointments(created_at);
CREATE INDEX idx_appointments_reminder_24h ON appointments(reminder_24h_sent, reminder_24h_failed);
CREATE INDEX idx_appointments_reminder_same_day ON appointments(reminder_same_day_sent, reminder_same_day_failed);

-- SMS logs indexes
CREATE INDEX idx_sms_logs_phone ON sms_logs(phone_number);
CREATE INDEX idx_sms_logs_patient_id ON sms_logs(patient_id);
CREATE INDEX idx_sms_logs_message_type ON sms_logs(message_type);
CREATE INDEX idx_sms_logs_status ON sms_logs(status);
CREATE INDEX idx_sms_logs_created_at ON sms_logs(created_at);
CREATE INDEX idx_sms_logs_sent_at ON sms_logs(sent_at);

-- Cron logs indexes
CREATE INDEX idx_cron_logs_job_name_started_at ON cron_logs(job_name, started_at);
CREATE INDEX idx_cron_logs_status ON cron_logs(status);
CREATE INDEX idx_cron_logs_created_at ON cron_logs(created_at);
CREATE INDEX idx_cron_logs_started_at ON cron_logs(started_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;

-- Patients: Allow all operations (patients can be looked up by phone)
CREATE POLICY patients_all ON patients FOR ALL USING (true) WITH CHECK (true);

-- Clinics: Allow all (clinic data is generally public)
CREATE POLICY clinics_all ON clinics FOR ALL USING (true) WITH CHECK (true);

-- Staff: Can only access their own clinic's staff
CREATE POLICY staff_clinic_isolation ON staff FOR ALL USING (
  clinic_id IN (
    SELECT clinic_id FROM staff WHERE id = auth.uid()
  )
) WITH CHECK (
  clinic_id IN (
    SELECT clinic_id FROM staff WHERE id = auth.uid()
  )
);

-- Appointment slots: Can only access their own clinic's slots
CREATE POLICY slots_clinic_isolation ON appointment_slots FOR ALL USING (
  clinic_id IN (
    SELECT clinic_id FROM staff WHERE id = auth.uid()
  )
) WITH CHECK (
  clinic_id IN (
    SELECT clinic_id FROM staff WHERE id = auth.uid()
  )
);

-- Appointments: Can only access their own clinic's appointments
CREATE POLICY appointments_clinic_isolation ON appointments FOR ALL USING (
  clinic_id IN (
    SELECT clinic_id FROM staff WHERE id = auth.uid()
  )
) WITH CHECK (
  clinic_id IN (
    SELECT clinic_id FROM staff WHERE id = auth.uid()
  )
);

-- SMS logs: Can only access their own clinic's SMS logs
CREATE POLICY sms_logs_clinic_isolation ON sms_logs FOR ALL USING (
  clinic_id IN (
    SELECT clinic_id FROM staff WHERE id = auth.uid()
  )
) WITH CHECK (
  clinic_id IN (
    SELECT clinic_id FROM staff WHERE id = auth.uid()
  )
);

-- Cron logs: Allow all (for system monitoring)
CREATE POLICY cron_logs_all ON cron_logs FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamps trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON clinics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to mark slot as unavailable when booked
CREATE OR REPLACE FUNCTION mark_slot_unavailable()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE appointment_slots 
  SET is_available = FALSE 
  WHERE id = NEW.slot_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appointment_booked AFTER INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION mark_slot_unavailable();

-- Trigger to mark slot as available when cancelled
CREATE OR REPLACE FUNCTION mark_slot_available()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED' THEN
    UPDATE appointment_slots 
    SET is_available = TRUE 
    WHERE id = NEW.slot_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appointment_cancelled AFTER UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION mark_slot_available();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Today's appointments view
CREATE OR REPLACE VIEW today_appointments AS
SELECT 
  a.id,
  a.status,
  a.appointment_type,
  a.notes,
  a.checked_in_at,
  a.completed_at,
  p.id as patient_id,
  p.first_name as patient_first_name,
  p.last_name as patient_last_name,
  p.phone_number as patient_phone,
  s.id as slot_id,
  s.start_time,
  s.end_time,
  st.id as staff_id,
  st.first_name as staff_first_name,
  st.last_name as staff_last_name,
  st.role as staff_role,
  c.id as clinic_id,
  c.name as clinic_name
FROM appointments a
JOIN patients p ON a.patient_id = p.id
JOIN appointment_slots s ON a.slot_id = s.id
JOIN staff st ON s.staff_id = st.id
JOIN clinics c ON a.clinic_id = c.id
WHERE s.slot_date = CURRENT_DATE;

-- Appointment statistics view
CREATE OR REPLACE VIEW appointment_stats AS
SELECT 
  clinic_id,
  DATE(slot_date) as date,
  COUNT(*) as total_appointments,
  COUNT(*) FILTER (WHERE status = 'BOOKED') as booked_count,
  COUNT(*) FILTER (WHERE status = 'CONFIRMED') as confirmed_count,
  COUNT(*) FILTER (WHERE status = 'CHECKED_IN') as checked_in_count,
  COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_count,
  COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled_count,
  COUNT(*) FILTER (WHERE status = 'NO_SHOW') as no_show_count
FROM appointments a
JOIN appointment_slots s ON a.slot_id = s.id
GROUP BY clinic_id, DATE(slot_date);

-- ============================================================================
-- COMPLETION
-- ============================================================================

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;
