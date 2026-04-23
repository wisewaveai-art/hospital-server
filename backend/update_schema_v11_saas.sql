-- 1. Create Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, -- Used for subdomains
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trialing')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Update Users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
-- Ensure superadmin role exists in check constraint if any, or just handle in code.
-- Usually role is TEXT.

-- 3. Add organization_id to ALL relevant tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
            'patients', 'doctors', 'appointments', 'rooms', 'medicines', 
            'attendance', 'room_allocations', 'staff', 'lab_tests', 
            'operations', 'services', 'instruments', 'categories', 'inventory',
            'room_constraints'
        )
    LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id)', t);
    END LOOP;
END $$;

-- 4. Initial Data: Create a 'Main' organization
DO $$
DECLARE
    default_org_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM organizations) THEN
        INSERT INTO organizations (name, slug) 
        VALUES ('Wise Health Center', 'main') 
        RETURNING id INTO default_org_id;
        
        -- Link existing data to the main organization
        UPDATE users SET organization_id = default_org_id WHERE organization_id IS NULL;
        UPDATE patients SET organization_id = default_org_id WHERE organization_id IS NULL;
        UPDATE doctors SET organization_id = default_org_id WHERE organization_id IS NULL;
        UPDATE appointments SET organization_id = default_org_id WHERE organization_id IS NULL;
        UPDATE medicines SET organization_id = default_org_id WHERE organization_id IS NULL;
        UPDATE rooms SET organization_id = default_org_id WHERE organization_id IS NULL;
        UPDATE staff SET organization_id = default_org_id WHERE organization_id IS NULL;
    END IF;
END $$;

-- 5. Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_patients_org ON patients(organization_id);
CREATE INDEX IF NOT EXISTS idx_appointments_org ON appointments(organization_id);
