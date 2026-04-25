const directDb = require('../utils/directDb');

// Get all doctors
exports.getAllDoctors = async (req, res) => {
    try {
        const orgId = req.organizationId;
        let userQuery = 'SELECT id, full_name, email, phone, address, gender, organization_id FROM users WHERE role = $1';
        let userParams = ['doctor'];
        
        if (orgId && req.user?.role !== 'superadmin') {
            userQuery += ' AND organization_id = $2';
            userParams.push(orgId);
        }
        
        userQuery += ' ORDER BY full_name ASC';

        // 1. Fetch users
        const { rows: users } = await directDb.query(userQuery, userParams);

        if (!users || users.length === 0) {
            return res.json([]);
        }

        // 2. Fetch profiles
        const userIds = users.map(u => u.id);
        const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
        const profileQuery = `SELECT id, user_id, specialization, bio, availability, website_url, department, designation FROM doctors WHERE user_id IN (${placeholders})`;
        
        const { rows: profiles } = await directDb.query(profileQuery, userIds);

        const profilesMap = {};
        if (profiles) {
            profiles.forEach(p => { profilesMap[p.user_id] = p; });
        }

        // 3. Merge
        const enrichedData = users.map(user => {
            user.doctors = profilesMap[user.id] ? [profilesMap[user.id]] : [];
            return user;
        });

        res.json(enrichedData);
    } catch (err) {
        console.error('Error fetching doctors:', err);
        res.status(500).json({ error: 'Server error fetching doctors' });
    }
};

// Update Doctor Profile
exports.updateDoctor = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            full_name, email, phone, address, gender,
            department, designation, specialization, bio, availability
        } = req.body;

        // 1. Update Users Table
        await directDb.query(
            'UPDATE users SET full_name=$1, email=$2, phone=$3, address=$4, gender=$5 WHERE id=$6',
            [full_name, email, phone, address, gender, id]
        );

        // 2. Update Doctors Table
        await directDb.query(
            'UPDATE doctors SET department=$1, designation=$2, specialization=$3, bio=$4, availability=$5 WHERE user_id=$6',
            [department, designation, specialization, bio, availability, id]
        );

        res.json({ message: 'Doctor profile updated successfully' });
    } catch (err) {
        console.error('Error updating doctor:', err);
        res.status(500).json({ error: 'Server error updating doctor profile' });
    }
};

// Create Doctor Profile
exports.createDoctorProfile = async (req, res) => {
    try {
        const { user_id, specialization, bio, availability, website_url, department, designation } = req.body;
        const orgId = req.organizationId;

        const existing = await directDb.query('SELECT id FROM doctors WHERE user_id = $1', [user_id]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Profile already exists' });
        }

        const insertQuery = `
            INSERT INTO doctors (user_id, organization_id, specialization, bio, availability, website_url, department, designation) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `;
        const { rows } = await directDb.query(insertQuery, [
            user_id, orgId, specialization, bio, availability, website_url, department, designation
        ]);

        res.json(rows[0]);
    } catch (err) {
        console.error('Error creating doctor profile:', err);
        res.status(500).json({ error: 'Server error creating doctor profile' });
    }
};
