const supabase = require('../supabaseClient');

exports.getTodayAttendance = async (req, res) => {
    try {
        const { userId } = req.query;
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .eq('date', today)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is 'not found'
        res.json(data || null);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.checkIn = async (req, res) => {
    try {
        const { userId, shift } = req.body;
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();

        let finalShift = shift;
        if (!finalShift) {
            const { data: user } = await supabase.from('users').select('assigned_shift').eq('id', userId).single();
            if (user) finalShift = user.assigned_shift;
        }

        const { data, error } = await supabase
            .from('attendance')
            .upsert({
                user_id: userId,
                date: today,
                check_in_time: now,
                status: 'Present',
                shift: finalShift || null
            }, { onConflict: 'user_id, date' })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.checkOut = async (req, res) => {
    try {
        const { userId } = req.body;
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();

        // Find record first
        const { data: current } = await supabase.from('attendance').select('id').eq('user_id', userId).eq('date', today).single();

        if (!current) return res.status(404).json({ error: 'No check-in found for today' });

        const { data, error } = await supabase
            .from('attendance')
            .update({ check_out_time: now })
            .eq('id', current.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getActiveStaff = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        // Fetch users who are present today (check_in not null, check_out null?)
        // Or simply status = 'Present'

        const { data, error } = await supabase
            .from('attendance')
            .select(`
                *,
                user:user_id (full_name, role, email)
            `)
            .eq('date', today)
            .eq('status', 'Present');

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getAllAttendance = async (req, res) => {
    try {
        const { date } = req.query;
        let query = supabase.from('attendance').select('*, user:user_id(full_name, role)');

        if (date) {
            query = query.eq('date', date);
        } else {
            query = query.order('date', { ascending: false }).limit(100);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.applyLeave = async (req, res) => {
    try {
        const { userId, fromDate, toDate, leaveType, reason } = req.body;
        const { data, error } = await supabase.from('leave_requests')
            .insert([{ user_id: userId, from_date: fromDate, to_date: toDate, leave_type: leaveType, reason }])
            .select().single();
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error applying leave:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getMyAttendance = async (req, res) => {
    try {
        const { userId } = req.query;
        // Get last 30 records
        const { data: attendance, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(30);

        if (error) throw error;

        // Get approved leaves count
        const { count } = await supabase
            .from('leave_requests')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'Approved');

        res.json({
            attendance,
            leavesTaken: count || 0,
            leavesTotal: 12 // Hardcoded quota for now
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getAllLeaves = async (req, res) => {
    try {
        const { status } = req.query;
        let query = supabase.from('leave_requests').select('*, user:user_id(full_name, role)');
        if (status) query = query.eq('status', status);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateLeaveStatus = async (req, res) => {
    try {
        const { id, status } = req.body;
        const { data, error } = await supabase.from('leave_requests').update({ status }).eq('id', id).select();
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getStaffByRole = async (req, res) => {
    try {
        const { role } = req.query;
        let query = supabase.from('users').select('*');
        if (role) {
            query = query.eq('role', role);
        } else {
            query = query.in('role', ['doctor', 'nurse', 'staff']);
        }

        const { data, error } = await query.order('full_name');
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateUserShift = async (req, res) => {
    try {
        const { userId, assigned_shift, shift_start_time, shift_end_time } = req.body;
        const { data, error } = await supabase.from('users')
            .update({ assigned_shift, shift_start_time, shift_end_time })
            .eq('id', userId)
            .select();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getMyLeaves = async (req, res) => {
    try {
        const { userId } = req.query;
        const { data, error } = await supabase.from('leave_requests')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
