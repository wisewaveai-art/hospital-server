-- Add new columns to patients table
ALTER TABLE patients ADD COLUMN IF NOT EXISTS allergies TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS chronic_diseases TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS current_medications TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_provider VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_number VARCHAR(100);

-- Add new columns to patient_visits for consultation hub
ALTER TABLE patient_visits ADD COLUMN IF NOT EXISTS secondary_diagnosis TEXT;
ALTER TABLE patient_visits ADD COLUMN IF NOT EXISTS investigation_orders JSON;
ALTER TABLE patient_visits ADD COLUMN IF NOT EXISTS referral_to VARCHAR(100);
