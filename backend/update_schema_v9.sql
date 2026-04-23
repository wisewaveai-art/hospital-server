-- Add current status columns to patients table
alter table patients 
  add column if not exists patient_type text default 'Outpatient' check (patient_type in ('Inpatient', 'Outpatient')),
  add column if not exists assigned_doctor_id uuid references doctors(id);

-- This allows us to track the *current* main doctor and status of the patient outside of individual visit records.
