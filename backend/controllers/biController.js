const directDb = require('../utils/directDb');

const safeQuery = async (queryStr, params = []) => {
    try {
        const { rows } = await directDb.query(queryStr, params);
        return rows;
    } catch (e) {
        console.error("BI Query Error:", e);
        return [];
    }
};

exports.getGeneralAnalytics = async (req, res) => {
    try {
        const orgId = req.organizationId;

        // 1. User distribution by role
        const roleDistribution = await safeQuery(
            'SELECT role, COUNT(*) as count FROM users WHERE organization_id = $1 GROUP BY role',
            [orgId]
        );

        // 2. Patient demographics (if available, else by patient_type)
        const patientDistribution = await safeQuery(
            'SELECT patient_type, COUNT(*) as count FROM visits WHERE organization_id = $1 GROUP BY patient_type',
            [orgId]
        );

        // 3. Monthly patient visits trend (last 6 months)
        const visitsTrend = await safeQuery(`
            SELECT DATE_FORMAT(visit_date, '%Y-%m') as month, COUNT(*) as count 
            FROM visits 
            WHERE organization_id = $1 
            GROUP BY month 
            ORDER BY month DESC 
            LIMIT 6
        `, [orgId]);

        // 4. Department distribution
        const departmentDistribution = await safeQuery(
            'SELECT department, COUNT(*) as count FROM users WHERE organization_id = $1 AND role IN ("doctor", "nurse", "staff") GROUP BY department',
            [orgId]
        );

        res.json({
            roles: roleDistribution,
            patients: patientDistribution,
            visitsTrend: visitsTrend.reverse(),
            departments: departmentDistribution
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getStockAnalytics = async (req, res) => {
    try {
        const orgId = req.organizationId;

        // 1. Stock levels distribution
        const stockLevels = await safeQuery(
            'SELECT name, quantity, low_stock_threshold FROM medicines WHERE organization_id = $1',
            [orgId]
        );

        // 2. Out of stock vs Low stock vs Healthy
        let outOfStock = 0;
        let lowStock = 0;
        let healthy = 0;

        stockLevels.forEach(m => {
            if (m.quantity <= 0) outOfStock++;
            else if (m.quantity <= (m.low_stock_threshold || 10)) lowStock++;
            else healthy++;
        });

        // 3. Category distribution
        const categoryDistribution = await safeQuery(`
            SELECT c.name as category, COUNT(m.id) as count 
            FROM medicines m 
            JOIN categories c ON m.category_id = c.id 
            WHERE m.organization_id = $1 
            GROUP BY c.name
        `, [orgId]);

        res.json({
            status: { outOfStock, lowStock, healthy },
            categories: categoryDistribution,
            details: stockLevels.slice(0, 50) // top 50 items
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getFinancialAnalytics = async (req, res) => {
    try {
        const orgId = req.organizationId;

        // 1. Monthly revenue trend
        const revenueTrend = await safeQuery(`
            SELECT DATE_FORMAT(payment_date, '%Y-%m') as month, SUM(amount_paid) as total 
            FROM bill_payments 
            WHERE organization_id = $1 
            GROUP BY month 
            ORDER BY month DESC 
            LIMIT 6
        `, [orgId]);

        // 2. Monthly expense trend
        const expenseTrend = await safeQuery(`
            SELECT DATE_FORMAT(expense_date, '%Y-%m') as month, SUM(amount) as total 
            FROM expenses 
            WHERE organization_id = $1 
            GROUP BY month 
            ORDER BY month DESC 
            LIMIT 6
        `, [orgId]);

        // 3. Expense by category
        const expenseByCategory = await safeQuery(
            'SELECT category, SUM(amount) as total FROM expenses WHERE organization_id = $1 GROUP BY category',
            [orgId]
        );

        // 4. Payroll totals (part of expenses)
        const payrollSummary = await safeQuery(
            'SELECT salary_month as month, SUM(net_salary) as total FROM payroll WHERE organization_id = $1 GROUP BY month ORDER BY month DESC LIMIT 6',
            [orgId]
        );

        res.json({
            revenueTrend: revenueTrend.reverse(),
            expenseTrend: expenseTrend.reverse(),
            expenseByCategory,
            payrollSummary
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.addExpense = async (req, res) => {
    try {
        const { category, description, amount, expense_date, payment_method, status } = req.body;
        const orgId = req.organizationId;

        const id = require('crypto').randomUUID();
        await directDb.query(`
            INSERT INTO expenses (id, organization_id, category, description, amount, expense_date, payment_method, status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [id, orgId, category, description, amount, expense_date, payment_method, status || 'Paid']);

        const { rows } = await directDb.query('SELECT * FROM expenses WHERE id = $1', [id]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
