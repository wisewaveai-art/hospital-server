-- Add gender to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender text check (gender in ('Male', 'Female', 'Other'));

-- Add department and designation to doctors table
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS designation text;
