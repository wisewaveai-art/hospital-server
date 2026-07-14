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

exports.bookAppointment = async (req, res) => {
    try {
        const { patient_user_id, doctor_id, appointment_date, reason, branch_id } = req.body;
        const orgId = req.organizationId;

        // Add source column if missing
        try {
            await directDb.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual'`);
        } catch(e) {}

        await directDb.query(
            'INSERT INTO appointments (organization_id, patient_user_id, doctor_id, appointment_date, reason, status, source) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [orgId, patient_user_id, doctor_id, appointment_date, reason, 'scheduled', 'manual']
        );

        const { rows } = await directDb.query(
            'SELECT * FROM appointments WHERE patient_user_id = $1 AND appointment_date = $2 AND organization_id = $3',
            [patient_user_id, appointment_date, orgId]
        );
        const apt = rows[0];

        // --- VIBEVOICE OUTBOUND TRIGGER ---
        try {
            const vvKeyRes = await directDb.query("SELECT value FROM settings WHERE organization_id = $1 AND key_name = 'vibevoice_api_key'", [orgId]);
            const vvWfRes = await directDb.query("SELECT value FROM settings WHERE organization_id = $1 AND key_name = 'vibevoice_workflow_id'", [orgId]);
            
            if (vvKeyRes.rowCount > 0 && vvWfRes.rowCount > 0 && vvKeyRes.rows[0].value && vvWfRes.rows[0].value) {
                const apiKey = vvKeyRes.rows[0].value;
                const wfId = vvWfRes.rows[0].value;
                
                // Get Patient Phone
                const pRes = await directDb.query('SELECT full_name, phone FROM users WHERE id = $1', [patient_user_id]);
                const docRes = await directDb.query('SELECT u.full_name FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1', [doctor_id]);
                
                if (pRes.rowCount > 0 && pRes.rows[0].phone) {
                    const phone = pRes.rows[0].phone;
                    const patientName = pRes.rows[0].full_name;
                    const docName = docRes.rowCount > 0 ? docRes.rows[0].full_name : 'the doctor';

                    // Send to VibeVoice via native fetch
                    fetch(`https://modelvoice.wisecrestsolutions.com/api/v1/public/agent/workflow/${wfId}`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            to_number: phone,
                            variables: {
                                patient_name: patientName,
                                appointment_time: appointment_date,
                                doctor_name: docName,
                                appointment_id: apt.id
                            }
                        })
                    }).catch(e => console.error('VibeVoice trigger failed:', e));
                }
            }
        } catch(vvErr) {
            console.error('VibeVoice integration error:', vvErr);
        }
        // ----------------------------------

        res.status(201).json(apt);
    } catch (err) {
        console.error('Error booking appointment:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getMyAppointments = async (req, res) => {
    try {
        const { userId } = req.params; 
        const orgId = req.organizationId;

        let queryStr = `
            SELECT a.*, 
                   d.id as doc_id, d.specialization, 
                   u.full_name as doctor_name
            FROM appointments a
            LEFT JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN users u ON d.user_id = u.id
            WHERE a.patient_user_id = $1 AND a.organization_id = $2
            ORDER BY a.appointment_date ASC
        `;
        
        const rows = await safeQuery(queryStr, [userId, orgId]);

        const formatted = rows.map(r => {
            const { doc_id, specialization, doctor_name, ...app } = r;
            return {
                ...app,
                doctors: doc_id ? { id: doc_id, specialization, users: { full_name: doctor_name } } : null
            };
        });

        res.json(formatted);
    } catch (err) {
        console.error('Error fetching appointments:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getAllAppointments = async (req, res) => {
    try {
        const orgId = req.organizationId;
        let queryStr = `
            SELECT a.*, 
                   p.full_name as patient_name,
                   d.id as doc_profile_id,
                   u.full_name as doctor_name
            FROM appointments a
            LEFT JOIN users p ON a.patient_user_id = p.id
            LEFT JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN users u ON d.user_id = u.id
            WHERE a.organization_id = $1
            ORDER BY a.appointment_date DESC
        `;
        
        const rows = await safeQuery(queryStr, [orgId]);

        const formatted = rows.map(r => {
            const { patient_name, doc_profile_id, doctor_name, ...app } = r;
            return {
                ...app,
                users: patient_name ? { full_name: patient_name } : null,
                doctors: doc_profile_id ? { users: { full_name: doctor_name } } : null
            };
        });

        res.json(formatted);
    } catch (err) {
        console.error('Error fetching all appointments:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        // Add a check to ensure the status column exists, if it doesn't we might need an alter table, but let's assume it exists or we can just try to update.
        // Wait, if status column doesn't exist, this will crash. Let's add the column if it doesn't exist.
        try {
            await directDb.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Scheduled'`);
        } catch(e) {}
        
        await directDb.query('UPDATE appointments SET status = $1 WHERE id = $2', [status, id]);
        res.json({ message: 'Status updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getDoctorAppointments = async (req, res) => {
    try {
        const { userId } = req.params;

        const docRes = await directDb.query('SELECT id FROM doctors WHERE user_id = $1', [userId]);
        if (docRes.rowCount === 0) {
            return res.json([]);
        }
        
        const doctorId = docRes.rows[0].id;

        const orgId = req.organizationId;
        let queryStr = `
            SELECT a.*, 
                   p.full_name, p.email, p.phone
            FROM appointments a
            LEFT JOIN users p ON a.patient_user_id = p.id
            WHERE a.doctor_id = $1 AND a.organization_id = $2
            ORDER BY a.appointment_date ASC
        `;
        
        const rows = await safeQuery(queryStr, [doctorId, orgId]);

        const formatted = rows.map(r => {
            const { full_name, email, phone, ...app } = r;
            return {
                ...app,
                patient: full_name ? { full_name, email, phone } : null
            };
        });

        res.json(formatted);
    } catch (err) {
        console.error('Error fetching doctor appointments:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getAvailableSlots = async (req, res) => {
    try {
        const { date, orgId = '0001-0000-00001' } = req.query; // default org for open API
        if (!date) return res.status(400).json({ error: 'Date is required (YYYY-MM-DD)' });

        // 1. Fetch Config
        const confRes = await directDb.query("SELECT value FROM settings WHERE organization_id = $1 AND key_name = 'appointment_config'", [orgId]);
        let config = {
            slotDurationMins: 30,
            morningStart: '10:00',
            morningEnd: '12:00',
            afternoonStart: '13:00',
            afternoonEnd: '20:00',
            allowFutureDays: 7
        };
        
        if (confRes.rowCount > 0 && confRes.rows[0].value) {
            try {
                const dbConf = typeof confRes.rows[0].value === 'string' ? JSON.parse(confRes.rows[0].value) : confRes.rows[0].value;
                config = { ...config, ...dbConf };
            } catch(e) {}
        }

        // Check if date is within allowed future days
        const targetDate = new Date(date);
        targetDate.setHours(0,0,0,0);
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const diffDays = Math.round((targetDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0 || diffDays > config.allowFutureDays) {
            return res.json({ date, config, availableSlots: [], message: 'Date out of allowed booking range' });
        }

        // 2. Fetch booked appointments for that date
        const bookedRes = await directDb.query(`
            SELECT appointment_date FROM appointments 
            WHERE organization_id = $1 AND DATE(appointment_date) = $2 AND status != 'cancelled'
        `, [orgId, date]);
        const bookedTimes = bookedRes.rows.map(r => new Date(r.appointment_date).getTime());

        // 3. Generate slots based on config
        const generateSlots = (startStr, endStr) => {
            const slots = [];
            let current = new Date(`${date}T${startStr}:00`);
            const end = new Date(`${date}T${endStr}:00`);
            
            while (current < end) {
                const timeMs = current.getTime();
                // Check if booked or in the past
                if (!bookedTimes.includes(timeMs) && timeMs > Date.now()) {
                    slots.push(new Date(current).toISOString());
                }
                current.setMinutes(current.getMinutes() + config.slotDurationMins);
            }
            return slots;
        };

        const morningSlots = generateSlots(config.morningStart, config.morningEnd);
        const afternoonSlots = generateSlots(config.afternoonStart, config.afternoonEnd);
        const availableSlots = [...morningSlots, ...afternoonSlots];

        res.json({ date, availableSlots, config });
    } catch (err) {
        console.error('Error fetching slots:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
