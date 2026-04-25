const directDb = require('../utils/directDb');

// Helper to generate Report ID (LR-YYYY-RUNNING_NUM)
const generateReportId = async (orgId) => {
    const year = new Date().getFullYear();
    const queryStr = 'SELECT COUNT(*) as count FROM lab_reports WHERE organization_id = $1';
    try {
        const { rows } = await directDb.query(queryStr, [orgId]);
        const count = rows[0] ? parseInt(rows[0].count) : 0;
        const num = String(count + 1).padStart(3, '0');
        return `LR-${year}-${num}`;
    } catch(err) {
        return `LR-${year}-001`;
    }
};

// Get All Reports (With optional filters)
exports.getAllReports = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { doctor_id, patient_id, status } = req.query;

        let queryStr = `
            SELECT 
                l.*,
                p.id as _patient_id, pu.full_name as patient_name, pu.gender as patient_gender, pu.phone as patient_phone,
                d.id as _doctor_id, du.full_name as doctor_name
            FROM lab_reports l
            LEFT JOIN patients p ON l.patient_id = p.id
            LEFT JOIN users pu ON p.user_id = pu.id
            LEFT JOIN doctors d ON l.doctor_id = d.id
            LEFT JOIN users du ON d.user_id = du.id
            WHERE l.organization_id = $1
        `;
        const params = [orgId];

        if (doctor_id) {
            params.push(doctor_id);
            queryStr += ` AND l.doctor_id = $${params.length}`;
        }
        if (patient_id) {
            params.push(patient_id);
            queryStr += ` AND l.patient_id = $${params.length}`;
        }
        if (status) {
            params.push(status);
            queryStr += ` AND l.status = $${params.length}`;
        }

        queryStr += ' ORDER BY l.created_at DESC';

        const { rows } = await directDb.query(queryStr, params);
        
        // Emulate Supabase nested structure
        const formatted = rows.map(r => {
            return {
                ...r,
                patients: r._patient_id ? { id: r._patient_id, users: { full_name: r.patient_name, gender: r.patient_gender, phone: r.patient_phone } } : null,
                doctors: r._doctor_id ? { id: r._doctor_id, users: { full_name: r.doctor_name } } : null
            };
        });

        res.json(formatted);
    } catch (err) {
        console.error('Error fetching lab reports:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Create Report
exports.createReport = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const {
            patient_id, doctor_id, test_category, test_name,
            sample_type, department, collection_date, technician_name,
            result_parameters, status, notes
        } = req.body;

        const report_id = await generateReportId(orgId);

        const queryStr = `
            INSERT INTO lab_reports (
                organization_id, report_id, patient_id, doctor_id, test_category, test_name,
                sample_type, department, collection_date, technician_name,
                result_parameters, status, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *
        `;
        const params = [
            orgId, report_id, patient_id, doctor_id || null, test_category, test_name,
            sample_type, department, collection_date || null, technician_name,
            result_parameters ? JSON.stringify(result_parameters) : '[]', status || 'Pending', notes
        ];

        const { rows } = await directDb.query(queryStr, params);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error creating lab report:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

// Update Report
exports.updateReport = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.organizationId;
        const updates = req.body;

        if (updates.result_parameters && typeof updates.result_parameters === 'object') {
            updates.result_parameters = JSON.stringify(updates.result_parameters);
        }

        const columns = Object.keys(updates);
        if (columns.length === 0) return res.json({});

        const values = Object.values(updates);
        const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

        const queryStr = `UPDATE lab_reports SET ${setClause} WHERE id = $${columns.length + 1} AND organization_id = $${columns.length + 2} RETURNING *`;
        const { rows } = await directDb.query(queryStr, [...values, id, orgId]);

        if (rows.length === 0) throw new Error("Update Failed");
        res.json(rows[0]);
    } catch (err) {
        console.error('Error updating lab report:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete Report
exports.deleteReport = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.organizationId;
        await directDb.query('DELETE FROM lab_reports WHERE id = $1 AND organization_id = $2', [id, orgId]);
        res.json({ message: 'Report deleted successfully' });
    } catch (err) {
        console.error('Error deleting lab report:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getMyReports = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { userId } = req.params; // this may be mapped to logged in User UUID string

        // Find patient_id from user_id
        const pQuery = 'SELECT id FROM patients WHERE user_id = $1 AND organization_id = $2 LIMIT 1';
        const { rows: pRows } = await directDb.query(pQuery, [userId, orgId]);

        if (pRows.length === 0) {
            return res.json([]);
        }

        const patientId = pRows[0].id;

        const queryStr = `
            SELECT 
                l.*,
                d.id as _doctor_id, du.full_name as doctor_name
            FROM lab_reports l
            LEFT JOIN doctors d ON l.doctor_id = d.id
            LEFT JOIN users du ON d.user_id = du.id
            WHERE l.patient_id = $1 AND l.organization_id = $2
            ORDER BY l.created_at DESC
        `;
        const { rows } = await directDb.query(queryStr, [patientId, orgId]);

        const formatted = rows.map(r => ({
            ...r,
            doctors: r._doctor_id ? { users: { full_name: r.doctor_name } } : null
        }));

        res.json(formatted);
    } catch (err) {
        console.error('Error fetching my reports:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
