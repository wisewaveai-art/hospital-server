-- Create Appointments table
create table if not exists appointments (
  id uuid primary key default uuid_generate_v4(),
  patient_user_id uuid references users(id) not null, -- The user who booked
  doctor_id uuid references doctors(id), -- The doctor booked (optional if general checkup?) Let's make it mandatory for now or optional.
  appointment_date timestamp not null,
  reason text,
  status text default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at timestamp default now()
);
