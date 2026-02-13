-- ============================================================================
-- AFYABOOK SEED DATA
-- Demo clinic with sample data for testing
-- ============================================================================

-- ============================================================================
-- DEMO CLINIC
-- ============================================================================

INSERT INTO clinics (id, name, phone_number, address, region, is_active, operating_hours, timezone)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Demo Medical Center',
  '+255123456789',
  '123 Health Street, Dar es Salaam',
  'Dar es Salaam',
  true,
  '{
    "monday": {"open": "08:00", "close": "17:00", "slots": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]},
    "tuesday": {"open": "08:00", "close": "17:00", "slots": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]},
    "wednesday": {"open": "08:00", "close": "17:00", "slots": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]},
    "thursday": {"open": "08:00", "close": "17:00", "slots": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]},
    "friday": {"open": "08:00", "close": "17:00", "slots": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]},
    "saturday": {"open": "09:00", "close": "13:00", "slots": ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30"]},
    "sunday": {"open": null, "close": null, "slots": []}
  }',
  'Africa/Dar_es_Salaam'
);

-- ============================================================================
-- DEMO STAFF
-- ============================================================================

INSERT INTO staff (id, clinic_id, first_name, last_name, phone_number, role, specialization, license_number, is_active)
VALUES 
  (
    '550e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440000',
    'John',
    'Masanja',
    '+255987654321',
    'doctor',
    'general',
    'MD-TZ-12345',
    true
  ),
  (
    '550e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440000',
    'Sarah',
    'Joseph',
    '+255987654322',
    'nurse',
    'maternity',
    'RN-TZ-67890',
    true
  );

-- ============================================================================
-- DEMO PATIENTS
-- ============================================================================

INSERT INTO patients (id, phone_number, first_name, last_name, date_of_birth, gender, language)
VALUES 
  (
    '550e8400-e29b-41d4-a716-446655440010',
    '+255712345678',
    'Juma',
    'Abdallah',
    '1985-03-15',
    'M',
    'sw'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440011',
    '+255723456789',
    'Maria',
    'John',
    '1990-07-22',
    'F',
    'sw'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440012',
    '+255734567890',
    'David',
    'Mushi',
    '1978-11-05',
    'M',
    'en'
  );

-- ============================================================================
-- DEMO SLOTS (Next 7 days)
-- ============================================================================

-- Create slots for today and next 6 days
DO $$
DECLARE
  current_date_val DATE := CURRENT_DATE;
  slot_date DATE;
  slot_times TEXT[] := ARRAY['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'];
  slot_time TEXT;
  end_time TEXT;
  slot_id UUID;
BEGIN
  FOR i IN 0..6 LOOP
    slot_date := current_date_val + i;
    
    -- Skip Sundays
    IF EXTRACT(DOW FROM slot_date) = 0 THEN
      CONTINUE;
    END IF;
    
    -- Saturday has limited hours
    IF EXTRACT(DOW FROM slot_date) = 6 THEN
      slot_times := ARRAY['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];
    ELSE
      slot_times := ARRAY['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'];
    END IF;
    
    FOREACH slot_time IN ARRAY slot_times
    LOOP
      -- Calculate end time (30 minutes later)
      end_time := (slot_time::TIME + INTERVAL '30 minutes')::TEXT;
      
      -- Create slot for Dr. Masanja
      INSERT INTO appointment_slots (id, clinic_id, staff_id, slot_date, start_time, end_time, is_available)
      VALUES (
        uuid_generate_v4(),
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
        slot_date,
        slot_time,
        end_time,
        true
      );
      
      -- Create slot for Nurse Sarah (only morning)
      IF slot_time < '12:00' THEN
        INSERT INTO appointment_slots (id, clinic_id, staff_id, slot_date, start_time, end_time, is_available)
        VALUES (
          uuid_generate_v4(),
          '550e8400-e29b-41d4-a716-446655440000',
          '550e8400-e29b-41d4-a716-446655440002',
          slot_date,
          slot_time,
          end_time,
          true
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- DEMO APPOINTMENTS
-- ============================================================================

-- Book some appointments for today and tomorrow
DO $$
DECLARE
  slot_1_id UUID;
  slot_2_id UUID;
  slot_3_id UUID;
BEGIN
  -- Get available slots for today
  SELECT id INTO slot_1_id
  FROM appointment_slots
  WHERE clinic_id = '550e8400-e29b-41d4-a716-446655440000'
    AND slot_date = CURRENT_DATE
    AND start_time = '09:00'
    AND is_available = true
  LIMIT 1;
  
  SELECT id INTO slot_2_id
  FROM appointment_slots
  WHERE clinic_id = '550e8400-e29b-41d4-a716-446655440000'
    AND slot_date = CURRENT_DATE
    AND start_time = '10:30'
    AND is_available = true
  LIMIT 1;
  
  SELECT id INTO slot_3_id
  FROM appointment_slots
  WHERE clinic_id = '550e8400-e29b-41d4-a716-446655440000'
    AND slot_date = CURRENT_DATE + 1
    AND start_time = '14:00'
    AND is_available = true
  LIMIT 1;
  
  -- Book appointments
  IF slot_1_id IS NOT NULL THEN
    INSERT INTO appointments (id, slot_id, patient_id, clinic_id, status, appointment_type, notes, created_at)
    VALUES (
      uuid_generate_v4(),
      slot_1_id,
      '550e8400-e29b-41d4-a716-446655440010',
      '550e8400-e29b-41d4-a716-446655440000',
      'CONFIRMED',
      'general',
      'Regular checkup',
      NOW()
    );
  END IF;
  
  IF slot_2_id IS NOT NULL THEN
    INSERT INTO appointments (id, slot_id, patient_id, clinic_id, status, appointment_type, notes, created_at)
    VALUES (
      uuid_generate_v4(),
      slot_2_id,
      '550e8400-e29b-41d4-a716-446655440011',
      '550e8400-e29b-41d4-a716-446655440000',
      'BOOKED',
      'followup',
      'Post-natal followup',
      NOW()
    );
  END IF;
  
  IF slot_3_id IS NOT NULL THEN
    INSERT INTO appointments (id, slot_id, patient_id, clinic_id, status, appointment_type, notes, created_at)
    VALUES (
      uuid_generate_v4(),
      slot_3_id,
      '550e8400-e29b-41d4-a716-446655440012',
      '550e8400-e29b-41d4-a716-446655440000',
      'BOOKED',
      'general',
      'Blood pressure monitoring',
      NOW()
    );
  END IF;
END $$;

-- ============================================================================
-- DEMO SMS LOGS
-- ============================================================================

INSERT INTO sms_logs (id, patient_id, clinic_id, phone_number, message_type, message_body, status, sent_at, cost_usd, created_at)
VALUES 
  (
    uuid_generate_v4(),
    '550e8400-e29b-41d4-a716-446655440010',
    '550e8400-e29b-41d4-a716-446655440000',
    '+255712345678',
    'BOOKING_CONFIRMATION',
    'Habari Juma, umefanikiwa kuhudumu 2024-01-15 saa 9:00 AM na Dr. John Masanja.',
    'DELIVERED',
    NOW() - INTERVAL '2 hours',
    0.02,
    NOW() - INTERVAL '2 hours'
  ),
  (
    uuid_generate_v4(),
    '550e8400-e29b-41d4-a716-446655440011',
    '550e8400-e29b-41d4-a716-446655440000',
    '+255723456789',
    'BOOKING_CONFIRMATION',
    'Habari Maria, umefanikiwa kuhudumu 2024-01-15 saa 10:30 AM na Nurse Sarah Joseph.',
    'DELIVERED',
    NOW() - INTERVAL '1 hour',
    0.02,
    NOW() - INTERVAL '1 hour'
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify data was inserted
SELECT 'Clinics: ' || COUNT(*)::TEXT as count FROM clinics
UNION ALL
SELECT 'Staff: ' || COUNT(*)::TEXT FROM staff
UNION ALL
SELECT 'Patients: ' || COUNT(*)::TEXT FROM patients
UNION ALL
SELECT 'Slots: ' || COUNT(*)::TEXT FROM appointment_slots
UNION ALL
SELECT 'Appointments: ' || COUNT(*)::TEXT FROM appointments
UNION ALL
SELECT 'SMS Logs: ' || COUNT(*)::TEXT FROM sms_logs;
