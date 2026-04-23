-- Add Contact Number to Rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS contact_number TEXT;

-- Update Room Allocations to include Guest details and Notes
ALTER TABLE room_allocations ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE room_allocations ADD COLUMN IF NOT EXISTS guest_contact TEXT;
ALTER TABLE room_allocations ADD COLUMN IF NOT EXISTS check_in_notes TEXT;

-- Ensure relationship is clear (already references patients(id))
-- No extra SQL needed for "linked with inpatient" as patient_id already exists.
