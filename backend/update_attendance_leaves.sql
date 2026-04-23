-- Add shift column to attendance if not exists
alter table attendance add column if not exists shift text;

-- Create table for leave requests
create table if not exists leave_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) not null,
  from_date date not null,
  to_date date not null,
  leave_type text, -- Sick, Casual, etc.
  reason text,
  status text default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  created_at timestamp with time zone default now()
);

-- Index for querying leaves
create index if not exists idx_leaves_user on leave_requests(user_id);
