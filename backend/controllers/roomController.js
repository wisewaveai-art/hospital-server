const supabase = require('../supabaseClient');

// Get all rooms (with current active allocation if any)
exports.getAllRooms = async (req, res) => {
    try {
        const { data: rooms, error } = await supabase
            .from('rooms')
            .select(`
                *,
                room_allocations!left (
                    id, patient_id, admission_date, status, notes, guest_name, guest_contact,
                    patients (
                        users:users!patients_user_id_fkey (full_name, phone)
                    )
                )
            `)
            .order('room_number', { ascending: true });

        if (error) throw error;

        // Filter allocations to only show the 'active' one in the list
        const enrichedRooms = rooms.map(room => {
            const activeAllocation = room.room_allocations?.find(a => a.status === 'active');
            return {
                ...room,
                active_allocation: activeAllocation || null,
                room_allocations: undefined // Remove the array to avoid clutter
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

        // Check if room number exists
        const { data: existing } = await supabase
            .from('rooms')
            .select('id')
            .eq('room_number', room_number)
            .single();

        if (existing) {
            return res.status(400).json({ error: 'Room number already exists' });
        }

        const payload = {
            room_number,
            type,
            price_per_day: charge_per_day,
            status,
            contact_number
        };
        console.log('Processed Room Payload:', payload);

        const { data, error } = await supabase
            .from('rooms')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        console.error('Error adding room:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

// Update room
exports.updateRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const { charge_per_day, ...otherUpdates } = req.body;

        const updates = {
            ...otherUpdates,
            ...(charge_per_day && { price_per_day: charge_per_day })
        };

        const { data, error } = await supabase
            .from('rooms')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error updating room:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Allocate Room (Check In)
exports.allocateRoom = async (req, res) => {
    try {
        const { room_id, patient_id, guest_name, guest_contact, notes } = req.body;

        // 1. Check if room is available
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('status')
            .eq('id', room_id)
            .single();

        if (roomError || !room) throw new Error('Room not found');
        if (room.status === 'Occupied') return res.status(400).json({ error: 'Room is already occupied' });

        // 2. Create Allocation
        const { data: allocation, error: allocError } = await supabase
            .from('room_allocations')
            .insert([{
                room_id,
                patient_id,
                guest_name,
                guest_contact,
                notes: notes, // Check-in notes
                status: 'active',
                admission_date: new Date()
            }])
            .select()
            .single();

        if (allocError) throw allocError;

        // 3. Update Room Status
        await supabase.from('rooms').update({ status: 'Occupied' }).eq('id', room_id);

        res.status(201).json(allocation);
    } catch (err) {
        console.error('Error allocating room:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

// Discharge Room (Check Out)
exports.dischargeRoom = async (req, res) => {
    try {
        const { room_id, allocation_id } = req.body; // Can pass either. If room_id, find active allocation.

        let targetAllocId = allocation_id;

        if (!targetAllocId && room_id) {
            const { data: active } = await supabase
                .from('room_allocations')
                .select('id')
                .eq('room_id', room_id)
                .eq('status', 'active')
                .single();
            if (active) targetAllocId = active.id;
        }

        if (!targetAllocId) return res.status(404).json({ error: 'No active allocation found' });

        // 1. Update Allocation
        const { error: allocError } = await supabase
            .from('room_allocations')
            .update({
                status: 'discharged',
                discharge_date: new Date()
            })
            .eq('id', targetAllocId);

        if (allocError) throw allocError;

        // 2. Update Room Status
        await supabase.from('rooms').update({ status: 'Available' }).eq('id', room_id); // Or 'Cleaning' if preferred

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
        const { data, error } = await supabase
            .from('room_allocations')
            .select(`
                *,
                patients (
                    users:users!patients_user_id_fkey (full_name, phone, email)
                )
            `)
            .eq('room_id', id)
            .order('admission_date', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching room history:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete room
exports.deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('rooms')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ message: 'Room deleted successfully' });
    } catch (err) {
        console.error('Error deleting room:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
