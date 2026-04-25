const directDb = require('../utils/directDb');

const safeQuery = async (queryStr, params = []) => {
    try {
        const { rows } = await directDb.query(queryStr, params);
        return rows;
    } catch (e) {
        return [];
    }
};

exports.getAdminStats = async (req, res) => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];

        // 1. Total Patients Today (Visits)
        const visitsToday = await safeQuery(
            'SELECT id, patient_type FROM visits WHERE DATE(visit_date) >= $1', 
            [todayStr]
        );
        const opdCount = visitsToday.filter(v => v.patient_type === 'Outpatient').length;
        const ipdCount = visitsToday.filter(v => v.patient_type === 'Inpatient').length;

        // 2. Bed Occupancy
        const rooms = await safeQuery('SELECT status FROM rooms');
        const totalBeds = rooms.length;
        const occupiedBeds = rooms.filter(r => r.status === 'Occupied').length;
        const availableBeds = totalBeds - occupiedBeds;
        const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

        // 3. Staff on Duty (Active today)
        const activeStaff = await safeQuery(`
            SELECT a.id, u.role 
            FROM attendance a 
            LEFT JOIN users u ON a.user_id = u.id 
            WHERE a.date = $1 AND a.status = 'Present'
        `, [todayStr]);
        
        const activeDoctors = activeStaff.filter(s => s.role === 'doctor').length;
        const activeNurses = activeStaff.filter(s => s.role === 'nurse').length;
        const totalActive = activeStaff.length;

        // 4. Operations Today
        const opsToday = await safeQuery(`
            SELECT id, status FROM operations 
            WHERE DATE(operation_date) = $1
        `, [todayStr]);
        
        const opsCompleted = opsToday.filter(o => o.status === 'completed').length;
        const opsScheduled = opsToday.length;

        // 5. Pharmacy Status
        const medicines = await safeQuery('SELECT id, quantity, low_stock_threshold FROM medicines');
        const lowStockItems = medicines.filter(m => m.quantity <= (m.low_stock_threshold || 10)).length;

        res.json({
            patients: {
                total: visitsToday.length,
                ipd: ipdCount,
                opd: opdCount,
                trend: '+5%'
            },
            beds: {
                total: totalBeds,
                occupied: occupiedBeds,
                available: availableBeds,
                rate: occupancyRate
            },
            staff: {
                total: totalActive,
                doctors: activeDoctors,
                nurses: activeNurses
            },
            operations: {
                total: opsScheduled,
                completed: opsCompleted,
                inProgress: opsScheduled - opsCompleted
            },
            pharmacy: {
                lowStock: lowStockItems,
                health: lowStockItems > 5 ? 'Warning' : 'Good'
            },
            revenue: {
                today: "₹0.0k",
                outstanding: "₹0k"
            }
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
