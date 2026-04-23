-- Add medical_reports column to visits table for storing URLs (Cloudinary)
alter table visits 
  add column if not exists medical_reports text[]; -- Array of strings (URLs)

-- Ensure doctors table is ready for querying patients treated by them (already done via joins)
