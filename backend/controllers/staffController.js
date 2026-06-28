const directDb = require('../utils/directDb');

// Get all staff (Users with role 'staff' or 'subadmin' or 'doctor' if needed)
exports.getAllStaff = async (req, res) => {
    try {
        const orgId = req.organizationId;
        let queryStr = `
            SELECT u.id, u.full_name, u.role, u.email, u.phone, 
                   s.designation, s.shift_start, s.shift_end, s.joined_date
            FROM users u
            LEFT JOIN staff s ON u.id = s.user_id
            WHERE u.role = 'staff'
        `;
        let params = [];

        if (orgId && req.user?.role !== 'superadmin') {
            queryStr += ' AND u.organization_id = $1';
            params.push(orgId);
        }

        queryStr += ' ORDER BY u.full_name ASC';

        const { rows } = await directDb.query(queryStr, params);

        if (!rows) {
            return res.json([]);
        }

        // Format to match old structure expecting `{ staff: [{ designation, shift_start... }] }`
        const formattedData = rows.map(row => {
            const { designation, shift_start, shift_end, joined_date, ...userObj } = row;
            return {
                ...userObj,
                staff: [{
                    designation, 
                    shift_start, 
                    shift_end, 
                    joined_date
                }]
            };
        });

        res.json(formattedData);
    } catch (err) {
        console.error('Error fetching staff:', err);
        res.status(500).json({ error: 'Server error querying staff' });
    }
};

// Create Staff Profile (link user to staff table)
exports.createStaffProfile = async (req, res) => {
    try {
        const { user_id, designation, shift_start, shift_end } = req.body;
        const orgId = req.organizationId;

        const existing = await directDb.query('SELECT id FROM staff WHERE user_id = $1', [user_id]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Profile already exists' });
        }

        const insertQuery = `
            INSERT INTO staff (user_id, organization_id, designation, shift_start, shift_end, joined_date) 
            VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *
        `;
        const { rows } = await directDb.query(insertQuery, [user_id, orgId, designation, shift_start, shift_end]);

        res.json(rows[0]);
    } catch (err) {
        console.error('Error creating staff profile:', err);
        res.status(500).json({ error: 'Server error creating staff' });
    }
};

// Get a single staff profile
exports.getStaffProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.organizationId;
        
        let queryStr = `
            SELECT u.id, u.full_name, u.email, u.phone, u.address, u.gender, u.organization_id, o.name as org_name,
                   s.designation, s.shift_start, s.shift_end, s.joined_date, s.base_salary, s.payment_type, s.bank_account_details
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            LEFT JOIN staff s ON u.id = s.user_id
            WHERE u.id = $1 AND (u.role = 'staff' OR u.role = 'subadmin')
        `;
        
        // Enforce tenant boundary if not superadmin
        let params = [id];
        if (orgId && req.user?.role !== 'superadmin') {
            queryStr += ' AND u.organization_id = $2';
            params.push(orgId);
        }

        const { rows } = await directDb.query(queryStr, params);

        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Staff not found' });
        }
        
        const row = rows[0];
        const { designation, shift_start, shift_end, joined_date, base_salary, payment_type, bank_account_details, ...userObj } = row;
        
        res.json({
            ...userObj,
            staff: [{
                designation, shift_start, shift_end, joined_date, base_salary, payment_type, bank_account_details
            }]
        });
    } catch (err) {
        console.error('Error fetching staff profile:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update Staff Profile
exports.updateStaffProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, email, phone, address, gender, designation, shift_start, shift_end, base_salary, payment_type, bank_account_details } = req.body;
        
        const orgId = req.organizationId;
        
        await directDb.query('BEGIN');
        
        // Update users table
        await directDb.query(
            'UPDATE users SET full_name = $1, email = $2, phone = $3, address = $4, gender = $5 WHERE id = $6',
            [full_name, email, phone, address, gender, id]
        );
        
        // Check if staff profile exists
        const { rows: existing } = await directDb.query('SELECT id FROM staff WHERE user_id = $1', [id]);
        
        if (existing && existing.length > 0) {
            // Update existing
            await directDb.query(
                'UPDATE staff SET designation = $1, shift_start = $2, shift_end = $3, base_salary = $4, payment_type = $5, bank_account_details = $6 WHERE user_id = $7',
                [designation, shift_start, shift_end, base_salary || 0, payment_type || 'monthly', bank_account_details, id]
            );
        } else {
            // Insert new
            await directDb.query(
                'INSERT INTO staff (user_id, organization_id, designation, shift_start, shift_end, base_salary, payment_type, bank_account_details, joined_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())',
                [id, orgId, designation, shift_start, shift_end, base_salary || 0, payment_type || 'monthly', bank_account_details]
            );
        }
        
        await directDb.query('COMMIT');
        res.json({ success: true, message: 'Staff profile updated' });
    } catch (err) {
        await directDb.query('ROLLBACK');
        console.error('Error updating staff profile:', err);
        res.status(500).json({ error: 'Server error updating profile' });
    }
};
