const { Client } = require('pg');
require('dotenv').config();

async function fixSchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Connected to DB');

        // Check if organizations table exists
        const orgTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'organizations'
            );
        `);

        if (!orgTableCheck.rows[0].exists) {
            console.log('Creating organizations table...');
            await client.query(`
                CREATE TABLE IF NOT EXISTS organizations (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name TEXT NOT NULL,
                    slug TEXT UNIQUE NOT NULL,
                    status TEXT DEFAULT 'active',
                    logo_url TEXT,
                    primary_color TEXT DEFAULT '#6366f1',
                    secondary_color TEXT DEFAULT '#4f46e5',
                    settings JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );
            `);
        }

        console.log('Ensuring organization_id exists in users table...');
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
        `);

        console.log('Ensuring default organization exists...');
        const res = await client.query(`
            INSERT INTO organizations (name, slug) 
            VALUES ('Wise Hospital Management', 'main') 
            ON CONFLICT (slug) DO UPDATE SET name = organizations.name
            RETURNING id;
        `);
        
        const defaultOrgId = res.rows[0].id;
        console.log('Default Org ID:', defaultOrgId);

        console.log('Linking existing users to default org...');
        await client.query(`
            UPDATE users SET organization_id = $1 WHERE organization_id IS NULL;
        `, [defaultOrgId]);

        console.log('Schema fix completed successfully!');
    } catch (err) {
        console.error('Error fixing schema:', err);
    } finally {
        await client.end();
    }
}

fixSchema();
