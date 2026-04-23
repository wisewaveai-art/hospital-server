-- Update the user_role enum to include 'subadmin'
-- Note: PostgreSQL doesn't support directly adding values to ENUM inside a transaction block easily in some environments, 
-- but for Supabase SQL Editor, you can try:
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'subadmin';

-- If you are starting fresh or want the full updated definition:
-- drop type if exists user_role cascade;
-- create type user_role as enum ('admin', 'subadmin', 'doctor', 'staff', 'vendor', 'patient');

-- Ensure the users table uses this type (it already does by default if you just altered the type)
