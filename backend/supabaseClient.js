// Dummy supabase client to prevent require errors during migration
// All controllers importing this need to be migrated to use pool from db.js

const supabase = {
    from: (table) => {
        console.warn(`[WARN] Supabase called for table ${table}. This needs to be migrated to MariaDB.`);
        return {
            select: () => ({ eq: () => ({ single: async () => ({ data: null, error: 'Migrate to MariaDB' }) }) }),
            insert: () => ({ select: () => ({ single: async () => ({ data: null, error: 'Migrate to MariaDB' }) }) }),
            update: () => ({ eq: async () => ({ data: null, error: 'Migrate to MariaDB' }) }),
            delete: () => ({ eq: async () => ({ data: null, error: 'Migrate to MariaDB' }) })
        };
    }
};

module.exports = supabase;
