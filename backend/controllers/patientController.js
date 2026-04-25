const directDb = require('../utils/directDb');

const safeQuery = async (queryStr, params = []) => {
    try {
        const { rows } = await directDb.query(queryStr, params);
        return rows;
    } catch (e) {
        console.warn("Table unmigrated or safeQuery fail:", e.message);
        return [];
    }
};

exports.getAllPatients = async (req, res) => {
    try {
        const orgId = req.organizationId;
        let queryStr = `
            SELECT u.id, u.full_name, u.email, u.phone, u.address, u.created_at, u.organization_id, 
                   p.id as patient_profile_id, p.blood_group, p.dob, p.medical_history, p.emergency_contact, p.patient_type, p.assigned_doctor_id, 
                   doc.full_name as doctor_name
            FROM users u
            LEFT JOIN patients p ON u.id = p.user_id
            LEFT JOIN users doc ON p.assigned_doctor_id = doc.id
            WHERE u.role = 'patient'
        `;
        let params = [];

        if (orgId && req.user?.role !== 'superadmin') {
            queryStr += ' AND u.organization_id = $1';
            params.push(orgId);
        }
        queryStr += ' ORDER BY u.created_at DESC';

        const rows = await safeQuery(queryStr, params);

        const enrichedData = rows.map(row => {
            const { patient_profile_id, blood_group, dob, medical_history, emergency_contact, patient_type, assigned_doctor_id, doctor_name, ...userObj } = row;
            return {
                ...userObj,
                patients: [{
                    id: patient_profile_id, blood_group, dob, medical_history, emergency_contact, patient_type, assigned_doctor_id,
                    assigned_doctor: { full_name: doctor_name || 'Unknown' }
                }]
            };
        });

        res.json(enrichedData);
    } catch (err) {
        console.error('Error fetching patients:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.createPatientProfile = async (req, res) => res.json({});
exports.getPatientDetails = async (req, res) => res.json({});
exports.updatePatient = async (req, res) => res.json({});
exports.deletePatient = async (req, res) => res.json({});
exports.addVisitRecord = async (req, res) => res.json({});
exports.addPrescription = async (req, res) => res.json({});
exports.getPatientIdByUserId = async (req, res) => res.json({});
