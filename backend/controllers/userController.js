const supabase = require('../supabaseClient');
const { tenantQuery, withOrgData } = require('../utils/tenantQuery');

// Update user role and creating missing profile if needed
exports.updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        const validRoles = ['admin', 'subadmin', 'doctor', 'staff', 'patient', 'vendor'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        // 1. Update User Role (Scoped to tenant if not superadmin)
        const { data: user, error } = await tenantQuery('users', req)
            .update({ role })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // 2. Auto-create profile based on role (injecting organization_id)
        if (role === 'doctor') {
            const { data: existing } = await tenantQuery('doctors', req).select('id').eq('user_id', id).single();
            if (!existing) {
                await tenantQuery('doctors', req).insert([withOrgData({ user_id: id, specialization: 'General' }, req)]);
            }
        } else if (role === 'staff') {
            const { data: existing } = await tenantQuery('staff', req).select('id').eq('user_id', id).single();
            if (!existing) {
                await tenantQuery('staff', req).insert([withOrgData({ user_id: id, designation: 'Staff' }, req)]);
            }
        } else if (role === 'patient') {
            const { data: existing } = await tenantQuery('patients', req).select('id').eq('user_id', id).single();
            if (!existing) {
                await tenantQuery('patients', req).insert([withOrgData({ user_id: id }, req)]);
            }
        }

        res.json({ message: 'Role updated and profile ensured', user });
    } catch (err) {
        console.error('Error updating role:', err);
        res.status(500).json({ error: 'Server error updating role' });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        // 1. Fetch Users
        let query = tenantQuery('users', req)
            .select('id, email, full_name, role, created_at, profile_pic, organization_id')
            .order('created_at', { ascending: false });

        const { data: users, error } = await query;
        if (error) throw error;

        // 2. Fetch Organizations for these users (if any)
        const orgIds = [...new Set(users.map(u => u.organization_id).filter(Boolean))];
        let orgMap = {};
        
        if (orgIds.length > 0) {
            const { data: orgs, error: orgError } = await supabase
                .from('organizations')
                .select('id, name, slug')
                .in('id', orgIds);
            
            if (!orgError && orgs) {
                orgs.forEach(o => { orgMap[o.id] = o; });
            }
        }

        // 3. Merge
        const enrichedUsers = users.map(u => ({
            ...u,
            organizations: orgMap[u.organization_id] || null
        }));

        res.json(enrichedUsers);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Server error fetching users' });
    }
};

exports.updateProfilePic = async (req, res) => {
    try {
        const { id } = req.params;
        const { profile_pic } = req.body;
        
        const { data: user, error } = await supabase
            .from('users')
            .update({ profile_pic })
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw error;
        res.json({ message: 'Profile picture updated', user });
    } catch(err) {
        console.error('Error updating profile pic:', err);
        res.status(500).json({ error: 'Server error updating profile pic' });
    }
};
