-- Advanced Features Schema
-- 1. Billing and Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES public.patients(id),
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'unpaid', -- unpaid, partial, paid
    issued_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    due_date TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES public.invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL
);

-- 2. Maintenance and Housekeeping Tickets
CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
    id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES public.rooms(id),
    raised_by INTEGER REFERENCES public.users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'open', -- open, in_progress, resolved
    priority VARCHAR(50) DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Electronic Health Records (EHR)
CREATE TABLE IF NOT EXISTS public.ehr_records (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES public.patients(id),
    doctor_id INTEGER REFERENCES public.doctors(id),
    notes TEXT,
    allergies TEXT,
    diagnosis TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. E-Prescriptions
CREATE TABLE IF NOT EXISTS public.prescriptions (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES public.patients(id),
    doctor_id INTEGER REFERENCES public.doctors(id),
    appointment_id INTEGER REFERENCES public.appointments(id),
    details JSONB, -- Array of objects: { medicine_name, dosage, frequency, days }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Blood Bank
CREATE TABLE IF NOT EXISTS public.blood_bank (
    id SERIAL PRIMARY KEY,
    blood_group VARCHAR(10) UNIQUE NOT NULL,
    bags_available INTEGER DEFAULT 0
);
