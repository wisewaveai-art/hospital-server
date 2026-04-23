-- Add site builder columns to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS home_hero_title text DEFAULT 'Wise Hospital';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS home_hero_subtitle text DEFAULT 'Advanced Healthcare Management System';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS home_hero_image text DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS home_bg_gradient text DEFAULT 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';

-- JSONB for flexible sections
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS home_features jsonb DEFAULT '[]';
-- Example: [{"title": "Feature 1", "description": "Desc", "icon": "star"}]

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS home_about_title text DEFAULT 'About Us';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS home_about_content text DEFAULT 'We provide the best care.';

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_email text DEFAULT 'admin@hospital.com';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_phone text DEFAULT '+1234567890';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_address text DEFAULT '123 Health St';

-- Configuration for login/register pages
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS login_bg_image text DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS register_bg_image text DEFAULT '';
