const supabase = require('../supabaseClient');
const { tenantQuery, withOrgData } = require('../utils/tenantQuery');
const bcrypt = require('bcryptjs');
const directDb = require('../utils/directDb');

// Update user role and creating missing profile if needed
exports.updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        const validRoles = ['admin', 'subadmin', 'doctor', 'staff', 'patient', 'vendor'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        // 1. Update User Role (Scoped to tenant if not superadmin)
        const { data: user, error } = await tenantQuery('users', req)
            .update({ role })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // 2. Auto-create profile based on role (injecting organization_id)
        if (role === 'doctor') {
            const { data: existing } = await tenantQuery('doctors', req).select('id').eq('user_id', id).single();
            if (!existing) {
                await tenantQuery('doctors', req).insert([withOrgData({ user_id: id, specialization: 'General' }, req)]);
            }
        } else if (role === 'staff') {
            const { data: existing } = await tenantQuery('staff', req).select('id').eq('user_id', id).single();
            if (!existing) {
                await tenantQuery('staff', req).insert([withOrgData({ user_id: id, designation: 'Staff' }, req)]);
            }
        } else if (role === 'patient') {
            const { data: existing } = await tenantQuery('patients', req).select('id').eq('user_id', id).single();
            if (!existing) {
                await tenantQuery('patients', req).insert([withOrgData({ user_id: id }, req)]);
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
        // 1. Fetch Users
        let query = tenantQuery('users', req)
            .select('id, email, full_name, role, created_at, profile_pic, organization_id')
            .order('created_at', { ascending: false });

        const { data: users, error } = await query;
        if (error) throw error;

        // 2. Fetch Organizations for these users (if any)
        const orgIds = [...new Set(users.map(u => u.organization_id).filter(Boolean))];
        let orgMap = {};
        
        if (orgIds.length > 0) {
            const { data: orgs, error: orgError } = await supabase
                .from('organizations')
                .select('id, name, slug')
                .in('id', orgIds);
            
            if (!orgError && orgs) {
                orgs.forEach(o => { orgMap[o.id] = o; });
            }
        }

        // 3. Merge
        const enrichedUsers = users.map(u => ({
            ...u,
            organizations: orgMap[u.organization_id] || null
        }));

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
        
        const { data: user, error } = await supabase
            .from('users')
            .update({ profile_pic })
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw error;
        res.json({ message: 'Profile picture updated', user });
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
            await directDb.query('INSERT INTO doctors (user_id, organization_id, full_name) VALUES ($1, $2, $3)', [newUser.id, orgId, full_name]);
        } else if (role === 'staff' || role === 'nurse') {
            await directDb.query('INSERT INTO staff (user_id, organization_id, full_name) VALUES ($1, $2, $3)', [newUser.id, orgId, full_name]);
        } else if (role === 'patient') {
            await directDb.query('INSERT INTO patients (user_id, organization_id, full_name) VALUES ($1, $2, $3)', [newUser.id, orgId, full_name]);
        }

        res.status(201).json({ message: 'User created successfully', user: newUser });
    } catch (err) {
        console.error('Error creating user:', err);
        res.status(500).json({ error: 'Server error creating user' });
    }
};
