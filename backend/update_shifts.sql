-- Add shift details to users table
alter table users add column if not exists assigned_shift text; -- e.g., 'Morning', 'Night', 'Rotational'
alter table users add column if not exists shift_start_time time;
alter table users add column if not exists shift_end_time time;

-- Optional: Comments/Notes on shift
alter table users add column if not exists shift_notes text;
