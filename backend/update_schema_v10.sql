-- Change assigned_doctor_id to reference users table directly
alter table patients drop constraint if exists patients_assigned_doctor_id_fkey;
alter table patients add constraint patients_assigned_doctor_id_fkey foreign key (assigned_doctor_id) references users(id);

-- Also update visits table if needed (optional but good for consistency, though visits usually link to doctor profile for specialization history)
-- For now, we will stick to patients table as requested.
