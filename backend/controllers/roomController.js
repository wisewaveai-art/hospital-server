const directDb = require('../utils/directDb');

// Get all rooms (with current active allocation if any)
exports.getAllRooms = async (req, res) => {
    try {
        const orgId = req.organizationId;
        
        // Fetch rooms and their active allocations in a single query or separate
        const { rows: rooms } = await directDb.query(
            'SELECT *, room_type as type, price_per_day as charge_per_day FROM rooms WHERE organization_id = $1 ORDER BY room_number ASC',
            [orgId]
        );

        const { rows: allocations } = await directDb.query(`
            SELECT ra.*, u.full_name as patient_name, u.phone as patient_phone
            FROM room_allocations ra
            JOIN patients p ON ra.patient_id = p.id
            JOIN users u ON p.user_id = u.id
            WHERE ra.organization_id = $1 AND ra.status = 'active'
        `, [orgId]);

        const enrichedRooms = rooms.map(room => {
            const activeAllocation = allocations.find(a => a.room_id === room.id);
            return {
                ...room,
                active_allocation: activeAllocation ? {
                    ...activeAllocation,
                    patients: { users: { full_name: activeAllocation.patient_name, phone: activeAllocation.patient_phone } }
                } : null
            };
        });

        res.json(enrichedRooms);
    } catch (err) {
        console.error('Error fetching rooms:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Add new room
exports.addRoom = async (req, res) => {
    try {
        const { room_number, type, charge_per_day, status, contact_number } = req.body;
        const orgId = req.organizationId;

        const { rows: existing } = await directDb.query(
            'SELECT id FROM rooms WHERE room_number = $1 AND organization_id = $2',
            [room_number, orgId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Room number already exists' });
        }

        await directDb.query(
            `INSERT INTO rooms (organization_id, room_number, room_type, price_per_day, status) 
             VALUES ($1, $2, $3, $4, $5)`,
            [orgId, room_number, type, charge_per_day, status || 'available']
        );

        const { rows } = await directDb.query(
            'SELECT *, room_type as type, price_per_day as charge_per_day FROM rooms WHERE room_number = $1 AND organization_id = $2',
            [room_number, orgId]
        );

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error adding room:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

// Update room
exports.updateRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.organizationId;
        const { room_number, type, charge_per_day, status } = req.body;

        await directDb.query(
            `UPDATE rooms SET room_number = $1, room_type = $2, price_per_day = $3, status = $4 WHERE id = $5 AND organization_id = $6`,
            [room_number, type, charge_per_day, status, id, orgId]
        );

        const { rows } = await directDb.query(
            'SELECT *, room_type as type, price_per_day as charge_per_day FROM rooms WHERE id = $1 AND organization_id = $2',
            [id, orgId]
        );

        res.json(rows[0]);
    } catch (err) {
        console.error('Error updating room:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Allocate Room (Check In)
exports.allocateRoom = async (req, res) => {
    try {
        const { room_id, patient_id, guest_name, guest_contact, notes } = req.body;
        const orgId = req.organizationId;

        const { rows: roomRows } = await directDb.query('SELECT status FROM rooms WHERE id = $1 AND organization_id = $2', [room_id, orgId]);
        if (roomRows.length === 0) throw new Error('Room not found');
        if (roomRows[0].status === 'Occupied') return res.status(400).json({ error: 'Room is already occupied' });

        await directDb.query(
            `INSERT INTO room_allocations (organization_id, room_id, patient_id, status, admission_date, guest_name, guest_contact, notes) 
             VALUES ($1, $2, $3, 'active', NOW(), $4, $5, $6)`,
            [orgId, room_id, patient_id, guest_name, guest_contact, notes]
        );

        await directDb.query('UPDATE rooms SET status = $1 WHERE id = $2 AND organization_id = $3', ['Occupied', room_id, orgId]);

        const { rows: allocation } = await directDb.query(
            'SELECT * FROM room_allocations WHERE room_id = $1 AND status = $2 AND organization_id = $3',
            [room_id, 'active', orgId]
        );

        res.status(201).json(allocation[0]);
    } catch (err) {
        console.error('Error allocating room:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

// Discharge Room (Check Out)
exports.dischargeRoom = async (req, res) => {
    try {
        const { room_id, allocation_id } = req.body;
        const orgId = req.organizationId;

        let targetAllocId = allocation_id;

        if (!targetAllocId && room_id) {
            const { rows } = await directDb.query(
                'SELECT id FROM room_allocations WHERE room_id = $1 AND status = $2 AND organization_id = $3',
                [room_id, 'active', orgId]
            );
            if (rows.length > 0) targetAllocId = rows[0].id;
        }

        if (!targetAllocId) return res.status(404).json({ error: 'No active allocation found' });

        await directDb.query(
            'UPDATE room_allocations SET status = $1, discharge_date = NOW() WHERE id = $2 AND organization_id = $3',
            ['discharged', targetAllocId, orgId]
        );

        await directDb.query('UPDATE rooms SET status = $1 WHERE id = $2 AND organization_id = $3', ['Available', room_id, orgId]);

        res.json({ message: 'Discharged successfully' });
    } catch (err) {
        console.error('Error discharging room:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get Room History
exports.getRoomHistory = async (req, res) => {
    try {
        const { id } = req.params; // Room ID
        const orgId = req.organizationId;
        const { rows } = await directDb.query(`
            SELECT ra.*, u.full_name, u.phone, u.email
            FROM room_allocations ra
            JOIN patients p ON ra.patient_id = p.id
            JOIN users u ON p.user_id = u.id
            WHERE ra.room_id = $1 AND ra.organization_id = $2
            ORDER BY ra.admission_date DESC
        `, [id, orgId]);

        res.json(rows.map(r => ({
            ...r,
            patients: { users: { full_name: r.full_name, phone: r.phone, email: r.email } }
        })));
    } catch (err) {
        console.error('Error fetching room history:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete room
exports.deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.organizationId;
        await directDb.query('DELETE FROM rooms WHERE id = $1 AND organization_id = $2', [id, orgId]);
        res.json({ message: 'Room deleted successfully' });
    } catch (err) {
        console.error('Error deleting room:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
