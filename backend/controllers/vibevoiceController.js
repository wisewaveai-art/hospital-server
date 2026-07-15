const directDb = require('../utils/directDb');

// Ensure schema supports source
const ensureSourceColumn = async () => {
    try {
        await directDb.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual'`);
    } catch(e) {
        console.warn('Failed to add source column', e.message);
    }
};

exports.bookAppointment = async (req, res) => {
    try {
        await ensureSourceColumn();
        
        // Handle both Custom Tool payload and Webhook payload
        const { 
            action, patient_phone, requested_time, patient_name, // Custom Tool format
            call_id, phone, first_name, appointment_date, department, recording_url, transcript_url // Webhook format
        } = req.body;
        
        const act = action || 'book_appointment';
        const pPhone = phone || patient_phone;
        const pName = first_name || patient_name;
        const rTime = appointment_date || requested_time;
        const dept = department || req.body.department;
        
        if (act !== 'book_appointment' || !pPhone || !rTime) {
            return res.status(400).json({ error: 'Missing required fields (phone or requested_time)' });
        }

        // For webhooks, we might not have organizationId from token. 
        // We will assume a default org for now, or if passed via header.
        const orgId = req.headers['x-organization-id'] || '0001-0000-00001';

        // 1. Find or create patient by phone
        let patient_user_id = null;
        let patientQuery = await directDb.query('SELECT id FROM users WHERE phone = $1 AND role = $2', [pPhone, 'patient']);
        if (patientQuery.rowCount > 0) {
            patient_user_id = patientQuery.rows[0].id;
        } else {
            // Create quick patient
            const insertRes = await directDb.query(
                'INSERT INTO users (organization_id, full_name, phone, role, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [orgId, pName || 'VibeVoice Caller', pPhone, 'patient', 'no-password-vibevoice']
            );
            patient_user_id = insertRes.rows[0].id;
            
            // Create profile
            await directDb.query(
                'INSERT INTO patients (organization_id, user_id, patient_type) VALUES ($1, $2, $3)',
                [orgId, patient_user_id, 'Outpatient']
            );
        }

        // 2. Find a doctor in that department (or default first doctor)
        let doctor_id = null;
        if (dept) {
            let docQuery = await directDb.query(`
                SELECT d.id FROM doctors d 
                JOIN users u ON d.user_id = u.id 
                WHERE d.department ILIKE $1 LIMIT 1
            `, [`%${dept}%`]);
            if (docQuery.rowCount > 0) doctor_id = docQuery.rows[0].id;
        }
        
        if (!doctor_id) {
            let backupDoc = await directDb.query('SELECT id FROM doctors LIMIT 1');
            if (backupDoc.rowCount > 0) doctor_id = backupDoc.rows[0].id;
        }

        // 3. Book it
        const insertApt = await directDb.query(
            'INSERT INTO appointments (organization_id, patient_user_id, doctor_id, appointment_date, reason, status, source) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [orgId, patient_user_id, doctor_id, rTime, 'AI Receptionist Booking', 'scheduled', 'vibevoice']
        );

        res.status(200).json({ success: true, appointment: insertApt.rows[0] });

    } catch (err) {
        console.error('VibeVoice Book Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.cancelAppointment = async (req, res) => {
    try {
        await ensureSourceColumn();
        const { action, appointment_id, patient_phone } = req.body;
        
        if (action !== 'cancel_appointment') {
            return res.status(400).json({ error: 'Invalid action' });
        }

        if (appointment_id) {
            await directDb.query('UPDATE appointments SET status = $1 WHERE id = $2', ['cancelled', appointment_id]);
        } else if (patient_phone) {
            // Cancel latest scheduled appointment for this phone
            const q = `
                UPDATE appointments SET status = 'cancelled' 
                WHERE id = (
                    SELECT a.id FROM appointments a
                    JOIN users u ON a.patient_user_id = u.id
                    WHERE u.phone = $1 AND a.status = 'scheduled'
                    ORDER BY a.appointment_date ASC LIMIT 1
                )
            `;
            await directDb.query(q, [patient_phone]);
        }

        res.status(200).json({ success: true, message: 'Appointment cancelled' });
    } catch (err) {
        console.error('VibeVoice Cancel Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.patientLookup = async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone) {
            return res.status(400).json({ status: 'new_patient' });
        }
        
        let formattedPhone = phone.trim();
        if (!formattedPhone.startsWith('+')) {
            formattedPhone = '+' + formattedPhone;
        }

        const userQuery = await directDb.query('SELECT id, full_name FROM users WHERE phone LIKE $1 AND role = $2', [`%${formattedPhone.replace('+', '')}%`, 'patient']);
        
        if (userQuery.rowCount === 0) {
            return res.json({ status: 'new_patient' });
        }

        const patient = userQuery.rows[0];
        
        const aptQuery = await directDb.query(`
            SELECT a.appointment_date, du.full_name as doctor_name 
            FROM appointments a
            LEFT JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN users du ON d.user_id = du.id
            WHERE a.patient_user_id = $1 AND a.status = 'scheduled' AND a.appointment_date >= NOW()
            ORDER BY a.appointment_date ASC LIMIT 1
        `, [patient.id]);

        if (aptQuery.rowCount === 0) {
            return res.json({
                status: 'found',
                patient_name: patient.full_name,
                upcoming_appointment: null,
                doctor: null
            });
        }

        const apt = aptQuery.rows[0];
        
        // Format appointment date for TTS (e.g. "Today at 2:00 PM" or "Tomorrow at 10:00 AM" or "July 15th at 3:00 PM")
        const dateObj = new Date(apt.appointment_date);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        let dateStr = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        if (dateObj.toDateString() === today.toDateString()) {
            dateStr = 'Today';
        } else if (dateObj.toDateString() === tomorrow.toDateString()) {
            dateStr = 'Tomorrow';
        }
        
        const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        
        return res.json({
            status: 'found',
            patient_name: patient.full_name,
            upcoming_appointment: `${dateStr} at ${timeStr}`,
            doctor: apt.doctor_name ? `Dr. ${apt.doctor_name}` : 'a doctor'
        });

    } catch (err) {
        console.error('VibeVoice Lookup Error:', err);
        return res.json({ status: 'new_patient' });
    }
};
