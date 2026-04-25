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
