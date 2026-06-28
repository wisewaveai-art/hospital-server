const bcrypt = require('bcryptjs');
const directDb = require('../utils/directDb');
const sendEmail = require('../utils/emailSender');

// Update user role and creating missing profile if needed
exports.updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        const orgId = req.organizationId;

        const validRoles = ['admin', 'subadmin', 'doctor', 'staff', 'patient', 'vendor', 'nurse', 'pharmacy'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        // 1. Update User Role
        const updateQuery = `UPDATE users SET role = $1 WHERE id = $2`;
        await directDb.query(updateQuery, [role, id]);
        const { rows } = await directDb.query('SELECT * FROM users WHERE id = $1', [id]);
        
        if (!rows.length) throw new Error('User not found');
        const user = rows[0];

        // 2. Auto-create profile based on role (injecting organization_id)
        if (role === 'doctor') {
            const { rowCount } = await directDb.query('SELECT id FROM doctors WHERE user_id = $1', [id]);
            if (rowCount === 0) {
                await directDb.query('INSERT INTO doctors (user_id, organization_id, full_name) VALUES ($1, $2, $3)', [id, orgId, user.full_name]);
            }
        } else if (role === 'staff' || role === 'nurse' || role === 'pharmacy') {
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
        
        await directDb.query(
            'UPDATE users SET profile_pic = $1 WHERE id = $2',
            [profile_pic, id]
        );
        const { rows } = await directDb.query('SELECT * FROM users WHERE id = $1', [id]);
            
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

        const validRoles = ['admin', 'subadmin', 'doctor', 'staff', 'patient', 'vendor', 'nurse', 'pharmacy'];
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

        // Insert new user into MAIN database (for global login)
        const userId = require('crypto').randomUUID();
        await directDb.pool.query(
            'INSERT INTO users (id, email, password_hash, full_name, role, organization_id) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, email, password_hash, full_name, role, orgId]
        );

        // Insert new user into TENANT database (for local foreign keys)
        // If main DB and tenant DB are the same (no multi-tenant), we use INSERT IGNORE
        await directDb.query(
            'INSERT IGNORE INTO users (id, email, password_hash, full_name, role, organization_id) VALUES ($1, $2, $3, $4, $5, $6)',
            [userId, email, password_hash, full_name, role, orgId]
        );

        const { rows } = await directDb.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (rows.length === 0) {
            throw new Error('Failed to create user');
        }

        const newUser = rows[0];

        // Ensure secondary profile creation (doctor, staff, etc.)
        if (role === 'doctor') {
            await directDb.query('INSERT INTO doctors (user_id, organization_id) VALUES ($1, $2)', [newUser.id, orgId]);
        } else if (role === 'staff' || role === 'nurse' || role === 'pharmacy') {
            await directDb.query('INSERT INTO staff (user_id, organization_id) VALUES ($1, $2)', [newUser.id, orgId]);
        } else if (role === 'patient') {
            await directDb.query('INSERT INTO patients (user_id, organization_id, patient_type) VALUES ($1, $2, $3)', [newUser.id, orgId, 'Outpatient']);
        }

        // Send email with credentials
        try {
            await sendEmail(
                email,
                'Your Wise Hospital Account Credentials',
                `<h2>Welcome to Wise Hospital</h2>
                 <p>Hello ${full_name},</p>
                 <p>Your account has been created successfully. Below are your login credentials:</p>
                 <p><strong>Email:</strong> ${email}</p>
                 <p><strong>Password:</strong> ${password}</p>
                 <p><strong>Role:</strong> ${role}</p>
                 <p>Please log in and change your password as soon as possible.</p>`
            );
        } catch (emailErr) {
            console.error('User created but failed to send email:', emailErr);
            return res.status(201).json({ message: 'User created successfully, but failed to send credentials email', user: newUser });
        }

        res.status(201).json({ message: 'User created successfully', user: newUser });
    } catch (err) {
        console.error('Error creating user:', err);
        res.status(500).json({ error: 'Server error creating user' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.organizationId || (req.user && req.user.organization_id);

        // Security check: Only delete users within the same organization unless superadmin
        if (req.user && req.user.role !== 'superadmin') {
            const userCheck = await directDb.query('SELECT organization_id FROM users WHERE id = $1', [id]);
            if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });
            if (userCheck.rows[0].organization_id !== orgId) {
                return res.status(403).json({ error: 'Unauthorized to delete this user' });
            }
        }

        const { rowCount } = await directDb.query('DELETE FROM users WHERE id = $1', [id]);
        
        if (rowCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ error: 'Server error deleting user' });
    }
};

