const directDb = require('../utils/directDb');

exports.getTodayAttendance = async (req, res) => {
    try {
        const { userId } = req.query;
        const today = new Date().toISOString().split('T')[0];

        const { rows } = await directDb.query(
            'SELECT * FROM attendance WHERE user_id = $1 AND date = $2',
            [userId, today]
        );

        res.json(rows[0] || null);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.checkIn = async (req, res) => {
    try {
        const { userId, shift } = req.body;
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();
        const orgId = req.organizationId;

        let finalShift = shift;
        if (!finalShift) {
            const userRes = await directDb.query('SELECT assigned_shift FROM users WHERE id = $1', [userId]);
            if (userRes.rows.length > 0) finalShift = userRes.rows[0].assigned_shift;
        }

        // Check if already checked in
        const checkExisting = await directDb.query('SELECT id FROM attendance WHERE user_id = $1 AND date = $2', [userId, today]);
        
        if (checkExisting.rows.length > 0) {
            const attendId = checkExisting.rows[0].id;
            await directDb.query(
                `UPDATE attendance SET check_in_time = $1, status = 'Present', shift = $2 WHERE id = $3`,
                [now, finalShift || null, attendId]
            );
            const { rows } = await directDb.query('SELECT * FROM attendance WHERE id = $1', [attendId]);
            return res.json(rows[0]);
        }

        const attendId = require('crypto').randomUUID();
        await directDb.query(
            `INSERT INTO attendance (id, organization_id, user_id, date, check_in_time, status, shift) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [attendId, orgId, userId, today, now, 'Present', finalShift || null]
        );

        const { rows } = await directDb.query('SELECT * FROM attendance WHERE id = $1', [attendId]);
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.checkOut = async (req, res) => {
    try {
        const { userId } = req.body;
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();

        const { rows: current } = await directDb.query('SELECT id FROM attendance WHERE user_id = $1 AND date = $2', [userId, today]);

        if (current.length === 0) return res.status(404).json({ error: 'No check-in found for today' });

        const attendId = current[0].id;
        await directDb.query(
            'UPDATE attendance SET check_out_time = $1 WHERE id = $2',
            [now, attendId]
        );

        const { rows } = await directDb.query('SELECT * FROM attendance WHERE id = $1', [attendId]);
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getActiveStaff = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const orgId = req.organizationId;

        const { rows } = await directDb.query(`
            SELECT a.*, u.full_name, u.role, u.email
            FROM attendance a
            JOIN users u ON a.user_id = u.id
            WHERE a.date = $1 AND a.status = 'Present' AND a.organization_id = $2
        `, [today, orgId]);

        res.json(rows.map(r => ({ ...r, user: { full_name: r.full_name, role: r.role, email: r.email } })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getAllAttendance = async (req, res) => {
    try {
        const { date } = req.query;
        const orgId = req.organizationId;
        
        let query = `
            SELECT a.*, u.full_name, u.role 
            FROM attendance a 
            JOIN users u ON a.user_id = u.id 
            WHERE a.organization_id = $1
        `;
        let params = [orgId];

        if (date) {
            query += ' AND a.date = $2';
            params.push(date);
        } else {
            query += ' ORDER BY a.date DESC LIMIT 100';
        }

        const { rows } = await directDb.query(query, params);
        res.json(rows.map(r => ({ ...r, user: { full_name: r.full_name, role: r.role } })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.applyLeave = async (req, res) => {
    try {
        const { userId, fromDate, toDate, leaveType, reason } = req.body;
        const orgId = req.organizationId;

        const leaveId = require('crypto').randomUUID();
        await directDb.query(
            `INSERT INTO leave_requests (id, organization_id, user_id, start_date, end_date, leave_type, reason, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [leaveId, orgId, userId, fromDate, toDate, leaveType, reason, 'Pending']
        );
        const { rows } = await directDb.query('SELECT * FROM leave_requests WHERE id = $1', [leaveId]);
        res.json(rows[0]);
    } catch (err) {
        console.error('Error applying leave:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getMyAttendance = async (req, res) => {
    try {
        const { userId } = req.query;
        const { rows: attendance } = await directDb.query(
            'SELECT * FROM attendance WHERE user_id = $1 ORDER BY date DESC LIMIT 30',
            [userId]
        );

        const { rows: leaveRes } = await directDb.query(
            "SELECT count(*) as count FROM leave_requests WHERE user_id = $1 AND status = 'Approved'",
            [userId]
        );

        res.json({
            attendance,
            leavesTaken: leaveRes[0].count || 0,
            leavesTotal: 12
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getAllLeaves = async (req, res) => {
    try {
        const { status } = req.query;
        const orgId = req.organizationId;

        let query = `
            SELECT l.*, u.full_name, u.role 
            FROM leave_requests l 
            JOIN users u ON l.user_id = u.id 
            WHERE l.organization_id = $1
        `;
        let params = [orgId];

        if (status) {
            query += ' AND l.status = $2';
            params.push(status);
        }
        query += ' ORDER BY l.created_at DESC';

        const { rows } = await directDb.query(query, params);
        res.json(rows.map(r => ({ ...r, user: { full_name: r.full_name, role: r.role } })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateLeaveStatus = async (req, res) => {
    try {
        const { id, status } = req.body;
        await directDb.query(
            'UPDATE leave_requests SET status = $1 WHERE id = $2',
            [status, id]
        );
        const { rows } = await directDb.query('SELECT * FROM leave_requests WHERE id = $1', [id]);
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getStaffByRole = async (req, res) => {
    try {
        const { role } = req.query;
        const orgId = req.organizationId;

        let query = 'SELECT * FROM users WHERE organization_id = $1';
        let params = [orgId];

        if (role) {
            query += ' AND role = $2';
            params.push(role);
        } else {
            query += " AND role IN ('doctor', 'nurse', 'staff')";
        }
        query += ' ORDER BY full_name';

        const { rows } = await directDb.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateUserShift = async (req, res) => {
    try {
        const { userId, assigned_shift, shift_start_time, shift_end_time } = req.body;
        await directDb.query(
            'UPDATE users SET assigned_shift = $1, shift_start_time = $2, shift_end_time = $3 WHERE id = $4',
            [assigned_shift, shift_start_time, shift_end_time, userId]
        );
        const { rows } = await directDb.query('SELECT * FROM users WHERE id = $1', [userId]);
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getMyLeaves = async (req, res) => {
    try {
        const { userId } = req.query;
        const { rows } = await directDb.query(
            'SELECT * FROM leave_requests WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getStaffStatusToday = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const today = new Date().toISOString().split('T')[0];

        const queryStr = `
            SELECT u.id, u.full_name, u.role, u.email,
                   a.id as attendance_id, a.check_in_time, a.status
            FROM users u
            LEFT JOIN attendance a ON u.id = a.user_id AND a.date = $1
            WHERE u.organization_id = $2 AND u.role != 'patient'
            ORDER BY u.full_name ASC
        `;
        const { rows } = await directDb.query(queryStr, [today, orgId]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching staff status:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.bulkCheckIn = async (req, res) => {
    try {
        const { userIds } = req.body;
        const orgId = req.organizationId;
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ error: 'userIds array is required' });
        }

        for (const userId of userIds) {
            const check = await directDb.query('SELECT id FROM attendance WHERE user_id = $1 AND date = $2', [userId, today]);
            if (check.rows.length === 0) {
                const attendId = require('crypto').randomUUID();
                await directDb.query(
                    `INSERT INTO attendance (id, organization_id, user_id, date, check_in_time, status) 
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [attendId, orgId, userId, today, now, 'Present']
                );
            }
        }
        res.json({ message: 'Bulk check-in successful' });
    } catch (err) {
        console.error('Error in bulk check-in:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

