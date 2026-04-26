const directDb = require('../utils/directDb');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

exports.getPatientPrediction = async (req, res) => {
    try {
        const { patientId } = req.params;
        const orgId = req.organizationId;
        const role = req.user?.role;

        if (role !== 'admin' && role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // 1. Fetch Patient Profile
        const patientRes = await directDb.query(`
            SELECT p.*, u.full_name, u.gender, u.dob 
            FROM patients p 
            JOIN users u ON p.user_id = u.id 
            WHERE p.id = $1 AND p.organization_id = $2
        `, [patientId, orgId]);

        if (patientRes.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
        const patient = patientRes.rows[0];

        // 2. Fetch Visits
        const visitsRes = await directDb.query(`
            SELECT * FROM patient_visits WHERE patient_id = $1 ORDER BY visit_date DESC
        `, [patientId]);
        const visits = visitsRes.rows;

        // 3. Fetch Lab Reports
        const labsRes = await directDb.query(`
            SELECT * FROM lab_reports WHERE patient_id = $1 ORDER BY created_at DESC
        `, [patientId]);
        const labs = labsRes.rows;

        // 4. Fetch Prescriptions
        const medsRes = await directDb.query(`
            SELECT pr.*, m.name as medicine_name 
            FROM prescriptions pr 
            JOIN medicines m ON pr.medicine_id = m.id 
            WHERE pr.visit_id IN (SELECT id FROM patient_visits WHERE patient_id = $1)
        `, [patientId]);
        const meds = medsRes.rows;

        // 5. Construct AI Payload
        const symptoms = visits.map(v => v.complaint).filter(Boolean).join('. ');
        const patient_age = patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : 30;
        const patient_gender = patient.gender || 'Unknown';
        const medical_history = patient.medical_history || 'None';
        
        const current_meds = meds.map(m => `${m.medicine_name} (${m.dosage})`);
        
        // Call AI Service - Diagnosis Suggestion
        let diagnosisResponse;
        try {
            const diagRes = await fetch(`${AI_SERVICE_URL}/diagnosis/differential`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symptoms: symptoms.split('. '),
                    patient_age,
                    patient_gender
                })
            });
            diagnosisResponse = await diagRes.json();
        } catch (e) {
            diagnosisResponse = "AI Diagnosis service currently unavailable.";
        }

        // Call AI Service - CDSS (Clinical Decision Support)
        let cdssResponse;
        try {
            const cdssRes = await fetch(`${AI_SERVICE_URL}/cdss/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient_history: medical_history + '. Previous diagnosis: ' + visits.map(v => v.diagnosis).join(', '),
                    current_meds: meds.map(m => m.medicine_name),
                    vitals: {} 
                })
            });
            cdssResponse = await cdssRes.json();
        } catch (e) {
            cdssResponse = "AI CDSS service currently unavailable.";
        }

        res.json({
            patient_summary: {
                name: patient.full_name,
                age: patient_age,
                gender: patient_gender
            },
            ai_diagnosis: diagnosisResponse,
            ai_safety_alerts: cdssResponse,
            data_points_analyzed: {
                visits: visits.length,
                reports: labs.length,
                meds: meds.length
            }
        });

    } catch (err) {
        console.error('AI Prediction Error:', err);
        res.status(500).json({ error: 'AI Analysis failed' });
    }
};
