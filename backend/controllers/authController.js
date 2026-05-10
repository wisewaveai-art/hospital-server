const supabase = require('../supabaseClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';

const directDb = require('../utils/directDb');

exports.register = async (req, res) => {
    try {
        const { email, password, full_name, organization_name, organization_slug } = req.body;

        if (!email || !password || !full_name || !organization_name || !organization_slug) {
            return res.status(400).json({ error: 'All fields including organization details are required' });
        }

        // 1. Check if user already exists (Direct DB)
        const userCheck = await directDb.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        // 2. Check if slug is taken (Direct DB)
        const slugCheck = await directDb.query('SELECT id FROM organizations WHERE slug = $1', [organization_slug]);
        if (slugCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Organization slug is already taken. Please choose another.' });
        }

        // 3. Create Organization (Direct DB - Main Pool)
        const [orgResult] = await directDb.pool.query(
            'INSERT INTO organizations (name, slug) VALUES (?, ?)',
            [organization_name, organization_slug]
        );
        
        // Find the newly created org to get its UUID
        const [orgRows] = await directDb.pool.query('SELECT * FROM organizations WHERE slug = ?', [organization_slug]);
        const newOrg = orgRows[0];

        // --- NEW: Auto-provision the private database immediately ---
        const tenantPool = await require('../db').getTenantDb(newOrg.id);

        // 4. Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // 5. Check if first user ever (for superadmin)
        const [countRows] = await directDb.pool.query('SELECT count(*) as count FROM users');
        const count = parseInt(countRows[0].count);
        const role = (count === 0) ? 'superadmin' : 'admin';

        // 6. Insert user (Direct DB - Main Pool)
        await directDb.pool.query(
            'INSERT INTO users (email, password_hash, full_name, role, organization_id) VALUES (?, ?, ?, ?, ?)',
            [email, password_hash, full_name, role, newOrg.id]
        );
        
        const [userRows] = await directDb.pool.query('SELECT * FROM users WHERE email = ?', [email]);
        const newUser = userRows[0];

        // 7. Create JWT
        const token = jwt.sign(
            { 
                id: newUser.id, 
                role: newUser.role, 
                email: newUser.email, 
                organization_id: newOrg.id,
                org_slug: newOrg.slug
            },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.status(201).json({
            message: 'Organization and Admin registered successfully',
            user: {
                id: newUser.id,
                email: newUser.email,
                role: newUser.role,
                full_name: newUser.full_name,
                organization_id: newOrg.id
            },
            token
        });

    } catch (err) {
        console.error('Registration Error:', err);
        res.status(500).json({ error: 'Server error during registration', details: err.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const [rows] = await directDb.pool.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (rows.length === 0) {
            console.log(`Login attempt failed: user not found for ${email}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = rows[0];

        // Fetch organization separately from the supervisor table
        let organization = null;
        if (user.organization_id) {
            const [orgRows] = await directDb.pool.query('SELECT name, slug FROM organizations WHERE id = ?', [user.organization_id]);
            if (orgRows.length > 0) {
                organization = orgRows[0];
            }
        }

        console.log('User found:', user.email, 'Role:', user.role, 'Org:', organization?.slug);

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            console.log(`Login attempt failed: password mismatch for ${email}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Create JWT
        const token = jwt.sign(
            { 
                id: user.id, 
                role: user.role, 
                email: user.email, 
                organization_id: user.organization_id,
                org_slug: organization?.slug
            },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                full_name: user.full_name,
                profile_pic: user.profile_pic
            },
            token
        });

    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ error: 'Server error during login' });
    }
};
