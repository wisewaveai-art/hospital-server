-- Create Services table for Hospital Offerings (e.g. Lab Tests, Consultations)
create table if not exists services (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  cost numeric(10, 2) not null,
  status text default 'active' check (status in ('active', 'inactive')), -- active/inactive
  created_at timestamp default now()
);
