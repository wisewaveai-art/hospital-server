const directDb = require('../utils/directDb');

exports.getEmployees = async (req, res) => {
    try {
        const orgId = req.organizationId;

        // Fetch all doctors and staff
        const doctorsQuery = `
            SELECT d.id, u.full_name, u.email, u.phone, 'doctor' as role_type, d.base_salary, d.payment_type, d.bank_account_details, d.designation, d.department 
            FROM doctors d 
            JOIN users u ON d.user_id = u.id 
            WHERE d.organization_id = $1
        `;
        const staffQuery = `
            SELECT s.id, u.full_name, u.email, u.phone, 'staff' as role_type, s.base_salary, s.payment_type, s.bank_account_details, s.designation, u.department 
            FROM staff s 
            JOIN users u ON s.user_id = u.id 
            WHERE s.organization_id = $1
        `;

        const [doctors, staff] = await Promise.all([
            directDb.query(doctorsQuery, [orgId]),
            directDb.query(staffQuery, [orgId])
        ]);

        res.json([...doctors.rows, ...staff.rows]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch employees' });
    }
};

exports.getPayrollHistory = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const query = `
            SELECT p.*, u.full_name, u.role 
            FROM payroll p 
            JOIN users u ON p.user_id = u.id 
            WHERE p.organization_id = $1 
            ORDER BY p.salary_month DESC, p.created_at DESC
        `;
        const { rows } = await directDb.query(query, [orgId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch payroll history' });
    }
};

exports.processPayroll = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { user_ids, salary_month } = req.body;

        const processed = [];
        const skipped = [];

        for (const userId of user_ids) {

            // 1. Check user exists
            const userRes = await directDb.query("SELECT id, role, full_name FROM users WHERE id = $1", [userId]);

            // User not found -> skip
            if (!userRes.rows.length) {
                skipped.push({ user_id: userId, reason: "User not found" });
                continue;
            }

            const user = userRes.rows[0];
            const role = user.role;

            let base_salary = 0;

            // 2. Get salary
            if (role === "doctor") {
                const d = await directDb.query("SELECT base_salary, payment_type FROM doctors WHERE user_id = $1", [userId]);
                base_salary = d.rows[0]?.base_salary || 0;
            } else {
                const s = await directDb.query(
                    "SELECT base_salary, payment_type FROM staff WHERE user_id = $1",
                    [userId]
                );

                base_salary = s.rows[0]?.base_salary || 0;
            }

            // 3. Insert payroll
            const insertQuery = `INSERT INTO payroll ( organization_id,user_id,salary_month,base_salary, net_salary, payment_status) VALUES ($1, $2, $3, $4, $5, 'paid')`;

            await directDb.query(insertQuery, [orgId, userId, salary_month, base_salary, base_salary]);

            processed.push({ user_id: userId, name: user.full_name, base_salary });
        }

        res.json({ message: "Payroll processing completed", processed_count: processed.length, skipped_count: skipped.length, processed, skipped });

    } catch (err) {
        console.error(err);

        res.status(500).json({ error: "Failed to process payroll", message: err.message });
    }
};

exports.getLeaveRequests = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const query = `
            SELECT lr.*, u.full_name, u.role, u.department 
            FROM leave_requests lr 
            JOIN users u ON lr.user_id = u.id 
            WHERE lr.organization_id = $1 
            ORDER BY lr.created_at DESC
        `;
        const { rows } = await directDb.query(query, [orgId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch leave requests' });
    }
};

exports.updateLeaveStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const approved_by = req.user.id;

        await directDb.query(
            "UPDATE leave_requests SET status = $1, approved_by = $2 WHERE id = $3",
            [status, approved_by, id]
        );
        res.json({ message: 'Leave status updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update leave status' });
    }
};

exports.updateEmployeeSalary = async (req, res) => {
    try {
        const { id } = req.params;
        const { base_salary, payment_type, role_type } = req.body;

        if (role_type === 'doctor') {
            await directDb.query(
                "UPDATE doctors SET base_salary = $1, payment_type = $2 WHERE id = $3",
                [base_salary, payment_type, id]
            );
        } else {
            await directDb.query(
                "UPDATE staff SET base_salary = $1, payment_type = $2 WHERE id = $3",
                [base_salary, payment_type, id]
            );
        }
        res.json({ message: 'Salary updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update salary' });
    }
};

exports.getAttendanceSummary = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { month } = req.query; // YYYY-MM

        const query = `
            SELECT 
                u.id as user_id, 
                u.full_name, 
                u.role, 
                COALESCE(d.base_salary, s.base_salary, 0) as base_salary,
                COALESCE(d.payment_type, s.payment_type, 'monthly') as payment_type,
                (SELECT COUNT(*) FROM attendance att 
                 WHERE att.user_id = u.id 
                 AND att.status = 'Present' 
                 ${month ? "AND DATE_FORMAT(att.date, '%Y-%m') = $1" : ""}
                ) as days_attended,
                (SELECT COUNT(*) FROM leave_requests lr 
                 WHERE lr.user_id = u.id 
                 AND lr.status = 'Approved'
                 ${month ? "AND (DATE_FORMAT(lr.start_date, '%Y-%m') = $2 OR DATE_FORMAT(lr.end_date, '%Y-%m') = $3)" : ""}
                ) as days_on_leave
            FROM users u
            LEFT JOIN doctors d ON u.id = d.user_id
            LEFT JOIN staff s ON u.id = s.user_id
            WHERE u.organization_id = $4 AND u.role IN ('doctor', 'staff', 'nurse')
            GROUP BY u.id, u.full_name, u.role, d.base_salary, s.base_salary, d.payment_type, s.payment_type
            ORDER BY u.full_name ASC
        `;

        const params = month ? [month, month, month, orgId] : ['', '', '', orgId];
        const { rows } = await directDb.query(query, params);

        const summary = rows.map(row => {
            let estimated_salary = 0;
            const salary = parseFloat(row.base_salary) || 0;
            const days = parseInt(row.days_attended) || 0;

            if (row.payment_type === 'hourly') {
                estimated_salary = salary * days * 8; // assuming 8 hours per day
            } else {
                // Monthly
                estimated_salary = (salary / 30) * days; // rough pro-rata
            }

            return {
                ...row,
                estimated_salary: estimated_salary.toFixed(2)
            };
        });

        res.json(summary);
    } catch (err) {
        console.error('Error fetching attendance summary:', err);
        res.status(500).json({ error: 'Failed to fetch attendance summary' });
    }
};
