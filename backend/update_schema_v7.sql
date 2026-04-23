-- Add new columns to visits table
alter table visits 
  add column if not exists next_visit_date timestamp,
  add column if not exists patient_type text check (patient_type in ('Inpatient', 'Outpatient')),
  alter column visit_date type timestamp,
  alter column visit_date set default now();

-- Ensure doctor_id is nullable if just a record? No, usually linked to a doctor.
-- User wants "Doctor who treated", so doctor_id is important.
