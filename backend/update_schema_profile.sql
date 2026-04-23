-- Run this in Supabase SQL Editor to add profile picture support
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_pic TEXT;
