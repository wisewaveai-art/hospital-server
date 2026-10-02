const directDb = require('../utils/directDb');

// Get all doctors
exports.getAllDoctors = async (req, res) => {
    try {
        const orgId = req.organizationId;
        let userQuery = `
            SELECT u.id, u.full_name, u.email, u.phone, u.address, u.gender, u.organization_id, o.name as org_name 
            FROM users u 
            LEFT JOIN organizations o ON u.organization_id = o.id
            WHERE u.role = $1
        `;
        let userParams = ['doctor'];
        
        if (orgId && req.user?.role !== 'superadmin') {
            userQuery += ' AND u.organization_id = $2';
            userParams.push(orgId);
        }
        
        userQuery += ' ORDER BY u.full_name ASC';

        // 1. Fetch users
        const { rows: users } = await directDb.query(userQuery, userParams);

        if (!users || users.length === 0) {
            return res.json([]);
        }

        // 2. Fetch profiles
        const userIds = users.map(u => u.id);
        const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
        const profileQuery = `SELECT id, user_id, branch_id, specialization, bio, availability, website_url, department, designation, base_salary, payment_type, bank_account_details, created_at as joined_date FROM doctors WHERE user_id IN (${placeholders})`;
        
        const { rows: profiles } = await directDb.query(profileQuery, userIds);

        const profilesMap = {};
        if (profiles) {
            profiles.forEach(p => { profilesMap[p.user_id] = p; });
        }

        // 3. Merge and Filter by Branch if requested
        const { branch_id } = req.query;
        let enrichedData = users.map(user => {
            user.doctors = profilesMap[user.id] ? [profilesMap[user.id]] : [];
            return user;
        });

        if (branch_id) {
            enrichedData = enrichedData.filter(user => 
                user.doctors.length > 0 && 
                (user.doctors[0].branch_id === branch_id || user.doctors[0].branch_id === null)
            );
        }

        console.log('getAllDoctors: enrichedData length =', enrichedData.length);
        res.json(enrichedData);
    } catch (err) {
        console.error('Error fetching doctors:', err);
        res.status(500).json({ error: 'Server error fetching doctors' });
    }
};

// Get Single Doctor Profile
exports.getDoctorProfile = async (req, res) => {
    try {
        const { id } = req.params; // this is user id
        const query = `
            SELECT u.id, u.full_name, u.email, u.phone, u.address, u.gender, u.organization_id, o.name as org_name,
                   d.department, d.designation, d.specialization, d.bio, d.availability, , , d.base_salary, d.payment_type, d.bank_account_details, d.created_at as joined_date
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            LEFT JOIN doctors d ON u.id = d.user_id
            WHERE u.id = $1 AND u.role = 'doctor'
        `;
        const { rows } = await directDb.query(query, [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Doctor not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error('Error fetching doctor profile:', err);
        res.status(500).json({ error: 'Server error fetching doctor profile' });
    }
};

// Update Doctor Profile
exports.updateDoctor = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            full_name, email, phone, address, gender,
            department, designation, specialization, bio, availability,
            base_salary, payment_type, bank_account_details
        } = req.body;

        const orgId = req.organizationId;

        // 1. Update Users Table
        await directDb.query(
            `UPDATE users 
             SET full_name= ?, 
                 email= ?, 
                 phone= ?, 
                 address= ?, 
                 gender= ? 
             WHERE id= ? AND organization_id= ?`,
            [
                full_name,
                email,
                phone,
                address,
                gender,
                id,
                orgId
            ]
        );

        // 2. Check Doctors Table
        const { rows: doctorRows } = await directDb.query(
            `SELECT id 
             FROM doctors 
             WHERE user_id= ? AND organization_id= ?`,
            [id, orgId]
        );

        // 3. Doctor already exists
        if (doctorRows.length > 0) {

            // Update Doctors Table
            const updateResult = await directDb.query(
                `UPDATE doctors 
                 SET department= ?, 
                     designation= ?, 
                     specialization= ?, 
                     bio= ?, 
                     availability= ?, 
                     base_salary= ?, 
                     payment_type= ?, 
                     bank_account_details= ? 
                 WHERE user_id= ? AND organization_id= ?`,
                [
                    department,
                    designation,
                    specialization,
                    bio,
                    availability,
                    base_salary || 0,
                    payment_type || 'monthly',
                    bank_account_details,
                    id,
                    orgId
                ]
            );

            console.log("UPDATE RESULT:", updateResult);

            // Check updated doctor
            const { rows: checkDoctor } = await directDb.query(
                `SELECT * 
                 FROM doctors 
                 WHERE user_id= ? AND organization_id= ?`,
                [id, orgId]
            );

            console.log("DOCTOR AFTER UPDATE:", checkDoctor);
const { rows: dbCheck } = await directDb.query(
    `SELECT DATABASE() AS db_name`
);

console.log("BACKEND DATABASE:", dbCheck);
const { rows: tableCheck } = await directDb.query(
    `SELECT TABLE_SCHEMA, TABLE_NAME
     FROM information_schema.tables
     WHERE TABLE_NAME = 'doctors'`
);

console.log("BACKEND DOCTORS TABLE:", tableCheck);
const { rows: allDoctors } = await directDb.query(
    `SELECT * FROM doctors`
);

console.log("BACKEND ALL DOCTORS:", allDoctors);

            if (checkDoctor.length === 0) {
                throw new Error("Doctor update failed - record not found");
            }

            console.log("Doctor updated");

            return res.json({
                message: 'Doctor profile updated successfully',
                doctor: checkDoctor[0]
            });
        }

        // 4. Doctor does not exist -> Create
        const insertResult = await directDb.query(
            `INSERT INTO doctors (
                user_id,
                organization_id,
                department,
                designation,
                specialization,
                bio,
                availability,
                base_salary,
                payment_type,
                bank_account_details
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                orgId,
                department,
                designation,
                specialization,
                bio,
                availability,
                base_salary || 0,
                payment_type || 'monthly',
                bank_account_details
            ]
        );

        console.log("INSERT RESULT:", insertResult);

        // 5. Check inserted doctor
        const { rows: checkDoctor } = await directDb.query(
            `SELECT * 
             FROM doctors 
             WHERE user_id= ? AND organization_id= ?`,
            [id, orgId]
        );

        console.log("DOCTOR AFTER INSERT:", checkDoctor);

        if (checkDoctor.length === 0) {
            throw new Error("Doctor insert failed - record not found after INSERT");
        }

        console.log("Doctor created");

        return res.json({
            message: 'Doctor profile created successfully',
            doctor: checkDoctor[0]
        });

    } catch (err) {
        console.error('Error updating doctor:', err);

        res.status(500).json({
            error: 'Server error updating doctor profile',
            details: err.message
        });
    }
};
exports.updateDoctor1 = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            full_name, email, phone, address, gender,
            department, designation, specialization, bio, availability,
            base_salary, payment_type, bank_account_details
        } = req.body;

        const orgId = req.organizationId;
        // 1. Update Users Table
        await directDb.query(
            `UPDATE users SET full_name= ?, email= ?, phone= ?, address= ?, gender= ? WHERE id= ? AND organization_id= ?`,
            [full_name, email, phone, address, gender, id, orgId]
        );

        // 2. Update Doctors Table
        await directDb.query(
            `UPDATE doctors SET department= ?, designation= ?, specialization= ?, bio= ?, availability= ?, base_salary= ?, payment_type= ?, bank_account_details= ? WHERE user_id= ? AND organization_id= ?`,
            [department, designation, specialization, bio, availability, base_salary || 0, payment_type || 'monthly', bank_account_details, id, orgId]
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
        const { user_id, specialization, bio, availability, website_url, department, designation, branch_id } = req.body;
        const orgId = req.organizationId;
        const existing = await directDb.query('SELECT id FROM doctors WHERE user_id = ?', [user_id]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Profile already exists' });
        }

        const insertQuery = `
            INSERT INTO doctors (user_id, organization_id, specialization, bio, availability, website_url, department, designation, branch_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) `;
            
        const { rows } = await directDb.query(insertQuery, [
            user_id, orgId, specialization, bio, availability, website_url, department, designation, branch_id
        ]);

        res.json(rows[0]);
    } catch (err) {
        console.error('Error creating doctor profile:', err);
        res.status(500).json({ error: 'Server error creating doctor profile' });
    }
};
