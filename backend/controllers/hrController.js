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
        
        // This is a batch process. For each user, we'd normally calculate based on their base_salary.
        // For simplicity, we'll implement a stub that records the base salaries.
        
        for (const userId of user_ids) {
            // Find base salary first
            const userRes = await directDb.query("SELECT role FROM users WHERE id = $1", [userId]);
            const role = userRes.rows[0]?.role;
            let base_salary = 0;
            
            if (role === 'doctor') {
                const d = await directDb.query("SELECT base_salary, payment_type FROM doctors WHERE user_id = $1", [userId]);
                base_salary = d.rows[0]?.base_salary || 0;
            } else {
                const s = await directDb.query("SELECT base_salary, payment_type FROM staff WHERE user_id = $1", [userId]);
                base_salary = s.rows[0]?.base_salary || 0;
            }

            // Note: If payment_type is 'hourly', this would ideally calculate based on attendance hours logged.
            // For now, we'll store the base_salary directly but this sets up the foundation.

            const insertQuery = `
                INSERT INTO payroll (organization_id, user_id, salary_month, base_salary, net_salary, payment_status)
                VALUES ($1, $2, $3, $4, $4, 'paid')
            `;
            await directDb.query(insertQuery, [orgId, userId, salary_month, base_salary]);
        }

        res.json({ message: 'Payroll processed successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to process payroll' });
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
        
        let dateCondition = "";
        let params = [orgId, orgId];
        
        if (month) {
            dateCondition = "AND DATE_FORMAT(a.date, '%Y-%m') = $3";
            params.push(month);
        }

        const orgIdPlaceholder = month ? "$4" : "$3";
        params.push(orgId);

        const query = `
            SELECT 
                u.id as user_id, 
                u.full_name, 
                u.role, 
                COALESCE(d.base_salary, s.base_salary, 0) as base_salary,
                COALESCE(d.payment_type, s.payment_type, 'monthly') as payment_type,
                SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as days_attended,
                SUM(CASE WHEN a.status = 'Leave' THEN 1 ELSE 0 END) as days_on_leave
            FROM users u
            LEFT JOIN doctors d ON u.id = d.user_id AND d.organization_id = $1
            LEFT JOIN staff s ON u.id = s.user_id AND s.organization_id = $2
            LEFT JOIN attendance a ON u.id = a.user_id ${dateCondition}
            WHERE u.organization_id = ${orgIdPlaceholder} AND u.role IN ('doctor', 'staff', 'nurse')
            GROUP BY u.id, u.full_name, u.role, d.base_salary, s.base_salary, d.payment_type, s.payment_type
            ORDER BY u.full_name ASC
        `;

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
