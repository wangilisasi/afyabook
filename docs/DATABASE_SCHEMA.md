# AfyaBook Database Schema Documentation

## Overview

This SQLite database schema powers **AfyaBook**, a clinic appointment system designed for Tanzania. The schema is optimized for:
- Phone-based patient identification (email optional)
- Multi-clinic patient visits
- SMS appointment reminders and confirmations
- Comprehensive audit trails

## Table Structure

### 1. **patients**

Primary entity for patient management. Phone numbers are the main identifier since email penetration is low in Tanzania.

**Key Fields:**
- `id` (UUID) - Primary key
- `phoneNumber` (String, Unique) - E.164 format (e.g., +255712345678)
- `firstName`, `lastName` - Patient name
- `dateOfBirth` (Optional) - For age calculation
- `gender` (Optional) - 'M', 'F', or 'O'
- `language` (Default: 'sw') - 'sw' (Swahili) or 'en' (English)

**Indexes:**
- `phoneNumber` - Fast patient lookup by phone
- `createdAt` - Recent patient queries

**Relations:**
- One-to-Many with `appointments`
- One-to-Many with `smsLogs`

---

### 2. **clinics**

Medical facilities with flexible operating hours stored as JSON.

**Key Fields:**
- `id` (UUID) - Primary key
- `name` - Clinic display name
- `phoneNumber` - Main contact number
- `address` (Optional) - Physical location
- `region` - For regional filtering (e.g., "Dar es Salaam")
- `isActive` (Boolean) - Soft delete support
- `operatingHours` (JSON) - Weekly schedule with time slots
- `timezone` (Default: "Africa/Dar_es_Salaam")

**Operating Hours JSON Structure:**
```json
{
  "monday": {
    "open": "08:00",
    "close": "17:00", 
    "slots": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00"]
  },
  "tuesday": { ... },
  "wednesday": { ... },
  ...
}
```

**Indexes:**
- `region` - Filter clinics by region
- `isActive` - Active clinic queries

**Relations:**
- One-to-Many with `staff`
- One-to-Many with `appointmentSlots`
- One-to-Many with `appointments`
- One-to-Many with `smsLogs`

---

### 3. **staff**

Medical personnel (doctors, nurses, specialists) assigned to clinics.

**Key Fields:**
- `id` (UUID) - Primary key
- `clinicId` (FK) - Linked clinic
- `firstName`, `lastName` - Staff name
- `phoneNumber` - Contact number
- `role` - 'doctor', 'nurse', 'specialist', 'admin'
- `specialization` (Optional) - e.g., 'general', 'pediatrics', 'maternity'
- `licenseNumber` (Optional) - Medical license for compliance
- `isActive` (Boolean) - Employment status

**Indexes:**
- `clinicId` - Staff by clinic
- `role` - Filter by role type
- `isActive` - Active staff queries

**Relations:**
- Many-to-One with `clinics`
- One-to-Many with `appointmentSlots`

---

### 4. **appointment_slots**

Pre-defined time slots that can be booked. Slots are created in advance based on clinic operating hours.

**Key Fields:**
- `id` (UUID) - Primary key
- `clinicId` (FK) - Linked clinic
- `staffId` (FK) - Assigned medical personnel
- `slotDate` (DateTime) - Date only (time stripped)
- `startTime` (String) - "HH:MM" format
- `endTime` (String) - "HH:MM" format
- `isAvailable` (Boolean) - Booking status

**Key Business Logic:**
- When a slot is booked, `isAvailable` is set to `false`
- If an appointment is cancelled, `isAvailable` returns to `true`
- One slot can only have one appointment (enforced by unique constraint)

**Indexes:**
- `clinicId + slotDate` - Find slots by clinic and date
- `staffId + slotDate` - Find slots by staff and date
- `slotDate + isAvailable` - Find available slots by date
- `isAvailable` - Quick availability filter

**Relations:**
- Many-to-One with `clinics`
- Many-to-One with `staff`
- One-to-One with `appointments`

---

### 5. **appointments**

The actual bookings made by patients. Tracks full lifecycle from booking to completion.

**Key Fields:**
- `id` (UUID) - Primary key
- `slotId` (FK, Unique) - Linked slot (1:1 relationship)
- `patientId` (FK) - Booking patient
- `clinicId` (FK) - Clinic where appointment occurs
- `status` (Enum) - Appointment lifecycle state
- `appointmentType` - 'general', 'followup', 'emergency'
- `notes` (Optional) - Visit reason or doctor notes
- `reminderSent` (Boolean) - SMS reminder tracking
- `reminderSentAt` (Optional) - When reminder was sent
- `checkedInAt` (Optional) - Patient arrival timestamp
- `completedAt` (Optional) - Appointment completion
- `cancelledAt` (Optional) - Cancellation timestamp
- `cancellationReason` (Optional) - Why cancelled

**Status Enum Values:**
- `BOOKED` - Initial state when slot reserved
- `CONFIRMED` - Patient confirmed via SMS/call
- `REMINDER_SENT` - Reminder SMS dispatched
- `CHECKED_IN` - Patient arrived at clinic
- `COMPLETED` - Appointment finished
- `CANCELLED` - Cancelled by patient or clinic
- `NO_SHOW` - Patient didn't arrive

**Indexes:**
- `patientId` - Patient appointment history
- `clinicId + status` - Clinic appointment management
- `status` - Filter by status
- `createdAt` - Recent appointments

**Relations:**
- One-to-One with `appointmentSlots`
- Many-to-One with `patients`
- Many-to-One with `clinics`

---

### 6. **sms_logs**

Complete audit trail of every SMS sent. Essential for debugging, cost tracking, and compliance.

**Key Fields:**
- `id` (UUID) - Primary key
- `messageId` (Optional, Unique) - Twilio message SID
- `patientId` (FK, Optional) - Recipient patient
- `clinicId` (FK, Optional) - Sending clinic
- `phoneNumber` - Recipient phone number
- `messageType` (Enum) - Purpose of message
- `messageBody` - Full message content
- `status` (Enum) - Delivery status
- `twilioResponse` (Optional) - Full API response
- `errorCode` (Optional) - Error code if failed
- `errorMessage` (Optional) - Error description
- `sentAt` (Optional) - When message was sent
- `deliveredAt` (Optional) - When delivered to handset
- `costUsd` (Optional) - Cost in USD for tracking

**MessageType Enum:**
- `BOOKING_CONFIRMATION` - Initial booking confirmation
- `REMINDER_24H` - 24-hour reminder
- `REMINDER_1H` - 1-hour reminder
- `CANCELLATION` - Cancellation notification
- `RESCHEDULE` - Reschedule confirmation
- `GENERAL` - General communication
- `CHECK_IN_CONFIRMATION` - Check-in confirmation

**Status Enum:**
- `PENDING` - Queued but not sent
- `SENT` - Accepted by Twilio
- `DELIVERED` - Confirmed delivered
- `FAILED` - Failed to send
- `UNDELIVERED` - Rejected by carrier

**Indexes:**
- `phoneNumber` - Lookup by recipient
- `patientId` - Patient SMS history
- `messageType` - Filter by type
- `status` - Failed message queries
- `createdAt` - Recent SMS
- `sentAt` - Time-based reports

**Relations:**
- Many-to-One with `patients` (nullable, SetNull on delete)
- Many-to-One with `clinics` (nullable, SetNull on delete)

---

## Key Design Decisions

### 1. Phone Number as Primary Patient Identifier

**Rationale:** In Tanzania, mobile phone penetration (~85%) far exceeds email usage. Patients are more likely to have and remember their phone number.

**Implementation:**
- Phone numbers stored in E.164 format (+255XXXXXXXXX)
- Unique constraint ensures no duplicates
- Indexed for fast lookup

### 2. Separate Appointment Slots Table

**Rationale:** Decouples availability from bookings, enabling:
- Pre-scheduled slot generation
- Easy availability checking
- Slot reuse after cancellation

**Implementation:**
- Slots created ahead of time based on operating hours
- `isAvailable` boolean tracks status
- 1:1 relationship with appointments

### 3. JSON for Operating Hours

**Rationale:** Flexible schema for complex weekly schedules without multiple tables.

**Trade-offs:**
- ✅ Flexible: Can store varying hours per day
- ✅ Simple: Single column vs. 7+ columns or join table
- ⚠️ Less queryable: Can't easily query "all clinics open at 8am"

### 4. Comprehensive SMS Logging

**Rationale:** SMS is mission-critical for appointment reminders in low-internet environments.

**Features:**
- Every message tracked with Twilio ID
- Cost tracking for budgeting
- Delivery status monitoring
- Error tracking for debugging

### 5. Soft Deletes

**Implementation:** `isActive` boolean on clinics and staff instead of hard deletes.

**Benefits:**
- Preserves historical appointment data
- Allows reactivation
- Prevents accidental data loss

---

## Sample Data (Seed)

The seed creates:

### Clinic
- **Afya Health Centre** in Dar es Salaam
- Operating hours: Mon-Fri 8am-5pm, Sat 9am-1pm

### Staff (3 members)
1. Dr. John Mbalwa - General Practitioner
2. Dr. Sarah Kweka - Pediatrician
3. Nurse Grace Moshi - General Nurse

### Appointment Slots
- 180 slots (Mon-Fri) × 3 staff × 12 slots/day = 180
- 14 slots (Saturday) × 2 doctors × 7 slots = 14
- **Total: 194 slots**

### Sample Records
- 1 Patient: Maria Juma (+255712345678)
- 1 Booked appointment
- 1 SMS log (Swahili booking confirmation)

---

## Common Queries

### Find available slots for a clinic on a specific date
```sql
SELECT * FROM appointment_slots 
WHERE clinic_id = ? 
  AND slot_date = ? 
  AND is_available = true
ORDER BY start_time;
```

### Get patient appointment history
```sql
SELECT a.*, s.start_time, s.slot_date, st.first_name as doctor_name
FROM appointments a
JOIN appointment_slots s ON a.slot_id = s.id
JOIN staff st ON s.staff_id = st.id
WHERE a.patient_id = ?
ORDER BY s.slot_date DESC;
```

### Check SMS delivery status
```sql
SELECT * FROM sms_logs 
WHERE patient_id = ? 
  AND message_type = 'BOOKING_CONFIRMATION'
ORDER BY created_at DESC;
```

### Find cancelled appointments with reason
```sql
SELECT a.*, p.first_name, p.last_name, p.phone_number
FROM appointments a
JOIN patients p ON a.patient_id = p.id
WHERE a.status = 'CANCELLED'
  AND a.cancelled_at >= date('now', '-7 days');
```

---

## Migration Notes

- All tables use UUID primary keys for global uniqueness
- Foreign keys have appropriate `onDelete` actions:
  - `Cascade`: Child records deleted with parent
  - `Restrict`: Prevents deletion if referenced
  - `SetNull`: Sets FK to null (for audit tables)
- SQLite doesn't enforce foreign keys by default; enable with `PRAGMA foreign_keys = ON;`

---

## Future Considerations

1. **Patient Medical History** - Add `medical_history` table
2. **Clinic Services** - Link clinics to services offered
3. **Insurance** - Track insurance providers and coverage
4. **Waitlist** - Queue system for popular slots
5. **Analytics** - Views for appointment statistics
