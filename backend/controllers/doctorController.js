const { tenantQuery, withOrgData } = require('../utils/tenantQuery');

// Get all doctors
exports.getAllDoctors = async (req, res) => {
    try {
        // 1. Fetch all users with role 'doctor'
        const { data: users, error: userError } = await tenantQuery('users', req)
            .select('id, full_name, email, phone, address, gender, organization_id')
            .eq('role', 'doctor')
            .order('full_name', { ascending: true });

        if (userError) throw userError;

        // 2. Fetch doctor profiles for these users
        const userIds = users.map(u => u.id);
        let profilesMap = {};

        if (userIds.length > 0) {
            const { data: profiles, error: profileError } = await tenantQuery('doctors', req)
                .select('id, user_id, specialization, bio, availability, website_url, department, designation')
                .in('user_id', userIds);

            if (!profileError && profiles) {
                profiles.forEach(p => { profilesMap[p.user_id] = p; });
            }
        }

        // 3. Merge profile data into user object (as 'doctors' property to match frontend expectation)
        const enrichedData = users.map(user => {
            // Attach profile array or object. Frontend expects 'doctors' (plural/mixed access) or single object?
            // Previous code returned `doctors(id, ...)` which Supabase usually format as an array [ {} ] or object if 1:1.
            // Let's attach it as an array to be safe with "Array.isArray" checks in frontend, or single object.
            // Existing frontend code: `const docProfile = Array.isArray(user.doctors) ? user.doctors[0] : user.doctors;`
            // so we can attach it as a single object or array. Array is safer for Supabase emulation.
            user.doctors = profilesMap[user.id] ? [profilesMap[user.id]] : [];
            return user;
        });

        res.json(enrichedData);
    } catch (err) {
        console.error('Error fetching doctors:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update Doctor Profile (Updates both users and doctors tables)
exports.updateDoctor = async (req, res) => {
    try {
        const { id } = req.params; // doctors table id? Or user id? Let's assume User ID context usually, but here `id` might be user_id.
        // The previous getAll returns Users. So let's pass User ID here for simplicity or handle it carefully.
        // Let's assume the ID passed in the URL is the USER ID, as that is the primary identifier in the list logic.

        const {
            full_name, email, phone, address, gender,
            department, designation, specialization, bio, availability
        } = req.body;

        // 1. Update Users Table
        const { error: userError } = await supabase
            .from('users')
            .update({ full_name, email, phone, address, gender })
            .eq('id', id);

        if (userError) throw userError;

        // 2. Update Doctors Table
        // We need to match by user_id
        const { error: doctorError } = await supabase
            .from('doctors')
            .update({ department, designation, specialization, bio, availability })
            .eq('user_id', id);

        if (doctorError) throw doctorError;

        res.json({ message: 'Doctor profile updated successfully' });
    } catch (err) {
        console.error('Error updating doctor:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Create Doctor Profile (Admin creates a new user + doctor profile)
// For simplicity, we might just link existing, but Admin usually creates accounts.
// We'll update this to Create User + Create Doctor entry if needed, but for now let's stick to the profile creation if user exists (or enhance if asked).
// The user asked to "modify", so update is priority.
exports.createDoctorProfile = async (req, res) => {
    // Existing implementation logic...
    try {
        const { user_id, specialization, bio, availability, website_url, department, designation } = req.body;

        // Check if profile exists
        const { data: existing } = await supabase
            .from('doctors')
            .select('id')
            .eq('user_id', user_id)
            .single();

        if (existing) {
            return res.status(400).json({ error: 'Profile already exists' });
        }

        const doctorData = withOrgData({ 
            user_id, specialization, bio, availability, website_url, 
            department, designation
        }, req);

        const { data, error } = await tenantQuery('doctors', req)
            .insert([doctorData])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error creating doctor profile:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
