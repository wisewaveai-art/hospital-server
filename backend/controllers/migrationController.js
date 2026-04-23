const { Client } = require('pg');

exports.runMigration = async (req, res) => {
    // Basic security: only allow superadmin or a secret key
    if (req.user?.role !== 'superadmin' && req.headers['x-migration-key'] !== 'wise-secret-123') {
        return res.status(403).json({ error: 'Unauthorized migration attempt' });
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL.replace('db.ihxgsyrkxrnghsxqlxpp.supabase.co', '13.232.227.185'),
    });

    try {
        await client.connect();
        
        // 1. Organizations table
        await client.query(`
            CREATE TABLE IF NOT EXISTS organizations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trialing')),
                logo_url TEXT,
                primary_color TEXT DEFAULT '#6366f1',
                secondary_color TEXT DEFAULT '#4f46e5',
                enabled_modules JSONB DEFAULT '["patients", "doctors", "appointments", "billing", "pharmacy", "staff", "inventory", "lab"]'::jsonb,
                settings JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // 2. Users table Column
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
        `);

        // 3. Default Org
        const orgRes = await client.query(`
            INSERT INTO organizations (name, slug) 
            VALUES ('Wise Health Center', 'main') 
            ON CONFLICT (slug) DO UPDATE SET name = organizations.name
            RETURNING id;
        `);
        const defaultOrgId = orgRes.rows[0].id;

        // 4. Link existing users
        await client.query(`
            UPDATE users SET organization_id = $1 WHERE organization_id IS NULL;
        `, [defaultOrgId]);

        // 5. Billing table (from previous step)
        await client.query(`
            CREATE TABLE IF NOT EXISTS invoices (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                organization_id UUID NOT NULL REFERENCES organizations(id),
                patient_user_id UUID NOT NULL REFERENCES users(id),
                invoice_number TEXT UNIQUE NOT NULL,
                total_amount DECIMAL(10,2) NOT NULL,
                status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
                due_date DATE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS payments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                organization_id UUID NOT NULL REFERENCES organizations(id),
                invoice_id UUID NOT NULL REFERENCES invoices(id),
                amount DECIMAL(10,2) NOT NULL,
                payment_method TEXT,
                payment_date TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // 6. Ensure billing and feature columns exist
        await client.query(`
            ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enabled_modules JSONB DEFAULT '["patients", "doctors", "appointments", "billing", "pharmacy", "staff", "inventory", "lab"]'::jsonb;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
            ALTER TABLE payments ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
        `);

        await client.end();
        res.json({ message: 'Migration completed successfully', defaultOrgId });
    } catch (err) {
        console.error('Migration error:', err);
        if (client) await client.end();
        res.status(500).json({ error: 'Migration failed', details: err.message });
    }
};
