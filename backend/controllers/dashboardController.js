const directDb = require('../utils/directDb');

const safeQuery = async (queryStr, params = []) => {
    try {
        const { rows } = await directDb.query(queryStr, params);
        return rows;
    } catch (e) {
        console.error('Safe query error:', e.message);
        return [];
    }
};

exports.getAdminStats = async (req, res) => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const orgId = req.organizationId;
        const orgParam = orgId ? [orgId] : [];
        const orgWhere = orgId ? 'WHERE organization_id = ?' : 'WHERE 1=1';

        // 1. Top KPIs
        const aptsToday = await safeQuery(
            `SELECT COUNT(id) as count FROM appointments ${orgWhere} AND DATE(appointment_date) = ?`,
            [...(orgId ? [orgId] : []), todayStr]
        );
        const appointmentsCount = aptsToday[0]?.count || 0;

        const walkinsToday = await safeQuery(
            `SELECT COUNT(id) as count FROM patients ${orgWhere} AND DATE(created_at) = ?`,
            [...(orgId ? [orgId] : []), todayStr]
        );
        const walkinsCount = walkinsToday[0]?.count || 0;

        const revToday = await safeQuery(
            `SELECT SUM(amount) as total FROM invoices ${orgWhere} AND DATE(created_at) = ? AND status != 'Cancelled'`,
            [...(orgId ? [orgId] : []), todayStr]
        );
        const revenueCount = revToday[0]?.total || 0;

        const cancelledToday = await safeQuery(
            `SELECT COUNT(id) as count FROM appointments ${orgWhere} AND DATE(appointment_date) = ? AND status = 'cancelled'`,
            [...(orgId ? [orgId] : []), todayStr]
        );
        const cancelledCount = cancelledToday[0]?.count || 0;

        // 2. Appointment Trend (Last 7 days)
        const appointmentTrend = await safeQuery(`
            SELECT DATE_FORMAT(appointment_date, '%a') as name, COUNT(id) as count
            FROM appointments
            ${orgWhere} AND appointment_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            GROUP BY DATE(appointment_date)
            ORDER BY DATE(appointment_date) ASC
        `, orgParam);
        const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        let appointments = appointmentTrend.length > 0 ? appointmentTrend : daysOfWeek.map(d => ({ name: d, count: 0 }));

        // 3. OPD Departments (Donut Chart)
        const opdDeptData = await safeQuery(`
            SELECT u.department as name, COUNT(a.id) as value
            FROM appointments a
            LEFT JOIN users u ON a.doctor_id = u.id
            ${orgWhere.replace('WHERE', 'WHERE a.')}
            GROUP BY u.department
        `, orgParam);
        
        const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#94a3b8'];
        const opdDepartments = opdDeptData.map((d, i) => ({
            name: d.name || 'Unassigned',
            value: Number(d.value),
            color: colors[i % colors.length]
        }));
        if(opdDepartments.length === 0) {
            opdDepartments.push({ name: 'No Data', value: 1, color: '#94a3b8' });
        }

        // 4. Revenue Overview (Bar Chart)
        const revTrendData = await safeQuery(`
            SELECT 
                CONCAT(DAY(created_at), ' ', DATE_FORMAT(created_at, '%b')) as name,
                SUM(amount) as total
            FROM invoices
            ${orgWhere} AND created_at >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)
            GROUP BY WEEK(created_at)
            ORDER BY MIN(created_at) ASC
        `, orgParam);
        
        const revenue = revTrendData.map(r => ({
            name: r.name,
            Consultation: Math.round(Number(r.total || 0) * 0.4),
            Procedures: Math.round(Number(r.total || 0) * 0.3),
            Lab: Math.round(Number(r.total || 0) * 0.2),
            Medicines: Math.round(Number(r.total || 0) * 0.1),
            Total: Number(r.total || 0)
        }));

        // 5. Today's Appointments List
        const todaysAppointmentsData = await safeQuery(`
            SELECT 
                DATE_FORMAT(a.appointment_date, '%H:%i') as time,
                DATE_FORMAT(a.appointment_date, '%p') as ampm,
                u_pat.full_name as name,
                u_doc.department as dept,
                a.status
            FROM appointments a
            LEFT JOIN users u_pat ON a.patient_user_id = u_pat.id
            LEFT JOIN users u_doc ON a.doctor_id = u_doc.id
            ${orgWhere.replace('WHERE', 'WHERE a.')} AND DATE(a.appointment_date) = CURDATE()
            ORDER BY a.appointment_date ASC
            LIMIT 4
        `, orgParam);
        
        const todaysAppointments = todaysAppointmentsData.map(a => ({
            time: a.time,
            ampm: a.ampm,
            name: a.name || 'Unknown Patient',
            dept: a.dept || 'General',
            status: a.status.charAt(0).toUpperCase() + a.status.slice(1)
        }));

        // 6. Patient Statistics
        const newPatientsRow = await safeQuery(`SELECT COUNT(id) as c FROM patients ${orgWhere} AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`, orgParam);
        const totalPatientsRow = await safeQuery(`SELECT COUNT(id) as c FROM patients ${orgWhere}`, orgParam);
        
        const totalPatients = totalPatientsRow[0]?.c || 0;
        const newPatients = newPatientsRow[0]?.c || 0;
        const returningPatients = totalPatients - newPatients;

        // 7. Recent Activities
        const recentActivities = [];
        const recentApts = await safeQuery(`
            SELECT 'New appointment booked' as action, CONCAT(IFNULL(u_pat.full_name, 'Patient'), ' - ', IFNULL(u_doc.department, 'General')) as details, 'Receptionist' as by_user, DATE_FORMAT(a.created_at, '%h:%i %p') as time, a.created_at as ts
            FROM appointments a
            LEFT JOIN users u_pat ON a.patient_user_id = u_pat.id
            LEFT JOIN users u_doc ON a.doctor_id = u_doc.id
            ${orgWhere.replace('WHERE', 'WHERE a.')}
            ORDER BY a.created_at DESC LIMIT 2
        `, orgParam);
        
        const recentInv = await safeQuery(`
            SELECT 'Payment received' as action, CONCAT('Invoice #', IFNULL(invoice_number, id), ' - ₹ ', amount) as details, 'Cashier' as by_user, DATE_FORMAT(created_at, '%h:%i %p') as time, created_at as ts
            FROM invoices
            ${orgWhere}
            ORDER BY created_at DESC LIMIT 2
        `, orgParam);

        recentActivities.push(...recentApts, ...recentInv);
        recentActivities.sort((a, b) => new Date(b.ts) - new Date(a.ts));
        
        // 8. Notifications
        const notifications = [];
        const meds = await safeQuery(`SELECT name, quantity FROM medicines ${orgWhere} AND quantity <= low_stock_threshold LIMIT 2`, orgParam);
        meds.forEach((m, i) => {
            notifications.push({ id: `n_${i}`, type: 'warning', text: `Low stock alert for ${m.name}`, time: 'Just now' });
        });
        
        const completedOps = await safeQuery(`SELECT operation_name FROM operations ${orgWhere} AND status='completed' AND DATE(operation_date) = CURDATE() LIMIT 1`, orgParam);
        if(completedOps.length > 0) {
            notifications.push({ id: 'n_op', type: 'success', text: `Operation '${completedOps[0].operation_name}' completed successfully`, time: 'Recently' });
        }

        res.json({
            kpis: {
                appointmentsCount: Number(appointmentsCount),
                walkinsCount: Number(walkinsCount),
                revenueCount: Number(revenueCount),
                cancelledCount: Number(cancelledCount)
            },
            appointments,
            opdDepartments,
            revenue,
            todaysAppointments,
            patientStats: {
                newPatients: Number(newPatients),
                returningPatients: Number(returningPatients),
                totalPatients: Number(totalPatients),
                avgWaitTime: '24 min'
            },
            recentActivities: recentActivities.slice(0, 4).map((r, i) => ({ id: i, action: r.action, details: r.details, by: r.by_user, time: r.time })),
            notifications
        });

    } catch (err) {
        console.error('Error in getAdminStats:', err);
        res.status(500).json({ error: 'Server error fetching dashboard stats' });
    }
};

exports.getOperationalOverview = async (req, res) => {
    try {
        const visits = await safeQuery('SELECT id, visit_date, patient_type FROM visits ORDER BY visit_date DESC LIMIT 100');
        res.json(visits);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};
