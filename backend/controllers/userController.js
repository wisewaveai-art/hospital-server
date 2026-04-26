const bcrypt = require('bcryptjs');
const directDb = require('../utils/directDb');

// Update user role and creating missing profile if needed
exports.updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        const orgId = req.organizationId;

        const validRoles = ['admin', 'subadmin', 'doctor', 'staff', 'patient', 'vendor', 'nurse'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        // 1. Update User Role
        const updateQuery = `UPDATE users SET role = $1 WHERE id = $2 RETURNING *`;
        const { rows } = await directDb.query(updateQuery, [role, id]);
        
        if (!rows.length) throw new Error('User not found');
        const user = rows[0];

        // 2. Auto-create profile based on role (injecting organization_id)
        if (role === 'doctor') {
            const { rowCount } = await directDb.query('SELECT id FROM doctors WHERE user_id = $1', [id]);
            if (rowCount === 0) {
                await directDb.query('INSERT INTO doctors (user_id, organization_id, full_name) VALUES ($1, $2, $3)', [id, orgId, user.full_name]);
            }
        } else if (role === 'staff' || role === 'nurse') {
            const { rowCount } = await directDb.query('SELECT id FROM staff WHERE user_id = $1', [id]);
            if (rowCount === 0) {
                await directDb.query('INSERT INTO staff (user_id, organization_id, full_name, designation) VALUES ($1, $2, $3, $4)', [id, orgId, user.full_name, role]);
            }
        } else if (role === 'patient') {
            const { rows } = await directDb.query('SELECT id FROM patients WHERE user_id = $1', [id]);
            if (rows.length === 0) {
                await directDb.query('INSERT INTO patients (user_id, organization_id, patient_type) VALUES ($1, $2, $3)', [id, orgId, 'Outpatient']);
            }
        }

        res.json({ message: 'Role updated and profile ensured', user });
    } catch (err) {
        console.error('Error updating role:', err);
        res.status(500).json({ error: 'Server error updating role' });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const orgId = req.organizationId;
        let queryStr = `
            SELECT u.id, u.email, u.full_name, u.role, u.created_at, u.profile_pic, u.organization_id, o.name as org_name, o.slug as org_slug
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            WHERE 1=1
        `;
        let params = [];

        if (orgId && req.user?.role !== 'superadmin') {
            queryStr += ' AND u.organization_id = $1';
            params.push(orgId);
        }
        
        queryStr += ' ORDER BY u.created_at DESC';

        const { rows } = await directDb.query(queryStr, params);

        const enrichedUsers = rows.map(u => {
            const { org_name, org_slug, ...userData } = u;
            return {
                ...userData,
                organizations: org_name ? { id: u.organization_id, name: org_name, slug: org_slug } : null
            };
        });

        res.json(enrichedUsers);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Server error fetching users' });
    }
};

exports.updateProfilePic = async (req, res) => {
    try {
        const { id } = req.params;
        const { profile_pic } = req.body;
        
        const { rows } = await directDb.query(
            'UPDATE users SET profile_pic = $1 WHERE id = $2 RETURNING *',
            [profile_pic, id]
        );
            
        res.json({ message: 'Profile picture updated', user: rows[0] });
    } catch(err) {
        console.error('Error updating profile pic:', err);
        res.status(500).json({ error: 'Server error updating profile pic' });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { full_name, email, password, role } = req.body;
        
        if (!full_name || !email || !password || !role) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const validRoles = ['admin', 'subadmin', 'doctor', 'staff', 'patient', 'vendor', 'nurse'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        // Check if email taken
        const emailCheck = await directDb.query('SELECT id FROM users WHERE email = $1', [email]);
        if (emailCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Get organization from the admin who is creating this user
        const orgId = req.organizationId || (req.user && req.user.organization_id);

        // Insert new user
        const insertUser = await directDb.query(
            'INSERT INTO users (email, password_hash, full_name, role, organization_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [email, password_hash, full_name, role, orgId]
        );

        if (!insertUser.rows || insertUser.rows.length === 0) {
            throw new Error('Failed to create user');
        }

        const newUser = insertUser.rows[0];

        // Ensure secondary profile creation (doctor, staff, etc.)
        if (role === 'doctor') {
            await directDb.query('INSERT INTO doctors (user_id, organization_id) VALUES ($1, $2)', [newUser.id, orgId]);
        } else if (role === 'staff' || role === 'nurse') {
            await directDb.query('INSERT INTO staff (user_id, organization_id) VALUES ($1, $2)', [newUser.id, orgId]);
        } else if (role === 'patient') {
            await directDb.query('INSERT INTO patients (user_id, organization_id, patient_type) VALUES ($1, $2, $3)', [newUser.id, orgId, 'Outpatient']);
        }

        res.status(201).json({ message: 'User created successfully', user: newUser });
    } catch (err) {
        console.error('Error creating user:', err);
        res.status(500).json({ error: 'Server error creating user' });
    }
};
