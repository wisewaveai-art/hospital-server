-- Create Visits table if not exists (History/Reports)
create table if not exists visits (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references patients(id),
  doctor_id uuid references doctors(id),
  visit_date timestamp default now(),
  complaint text,
  diagnosis text,
  notes text,
  created_at timestamp default now()
);

-- Create Prescriptions table (Linking Visits to Medicines)
create table if not exists prescriptions (
  id uuid primary key default uuid_generate_v4(),
  visit_id uuid references visits(id),
  medicine_id uuid references medicines(id),
  dosage text, -- e.g., "1-0-1 after food"
  duration text, -- e.g., "5 days"
  quantity integer, -- Quantity to deduct from stock?
  created_at timestamp default now()
);
