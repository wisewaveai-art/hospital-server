const { tenantQuery, withOrgData } = require('../utils/tenantQuery');

// Get all staff (Users with role 'staff' or 'subadmin' or 'doctor')
exports.getAllStaff = async (req, res) => {
    try {
        const { data, error } = await tenantQuery('users', req)
            .select('id, full_name, role, email, phone, staff(designation, shift_start, shift_end, joined_date)')
            .eq('role', 'staff')
            .order('full_name', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching staff:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Create Staff Profile (link user to staff table)
exports.createStaffProfile = async (req, res) => {
    try {
        const staffData = withOrgData({ user_id, designation, shift_start, shift_end }, req);

        const { data, error } = await tenantQuery('staff', req)
            .insert([staffData])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error creating staff profile:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
