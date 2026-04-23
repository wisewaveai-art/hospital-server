const supabase = require('../supabaseClient');

/**
 * Creates a tenant-aware Supabase query builder using a Proxy.
 * Intercepts 'select', 'update', and 'delete' calls to automatically append organization filters.
 * 
 * @param {string} table - Table name
 * @param {object} req - Express Request object
 * @returns {object} Proxy-wrapped Supabase query builder
 */
const tenantQuery = (table, req) => {
    const builder = supabase.from(table);

    return new Proxy(builder, {
        get(target, prop) {
            const original = target[prop];
            
            // Intercept data-fetching/modifying methods that return a FilterBuilder
            if (typeof original === 'function' && ['select', 'update', 'delete', 'upsert'].includes(prop)) {
                return (...args) => {
                    let nextBuilder = original.apply(target, args);

                    // Superadmin bypass: see everything
                    if (req.user && req.user.role === 'superadmin') {
                        return nextBuilder;
                    }

                    // Enforce organization isolation
                    const orgId = req.organizationId || '00000000-0000-0000-0000-000000000000';
                    
                    // Note: some tables might not have organization_id. 
                    // In a production app, we would check the schema or a whitelist here.
                    // For this HMS, all core tables are guaranteed to have it.
                    return nextBuilder.eq('organization_id', orgId);
                };
            }
            
            // Return other properties/methods as-is (e.g. insert, or properties)
            return typeof original === 'function' ? original.bind(target) : original;
        }
    });
};

/**
 * Automatically injects organization_id into insert data
 * @param {object|array} data - Data to insert
 * @param {object} req - Express Request object
 */
const withOrgData = (data, req) => {
    // Superadmins might not have an organizationId, but they usually create data FOR an organization.
    // If organizationId is missing, we don't inject it (let it stay null or use a default).
    if (!req.organizationId) return data;
    
    if (Array.isArray(data)) {
        return data.map(item => ({ 
            ...item, 
            organization_id: item.organization_id || req.organizationId 
        }));
    }
    return { ...data, organization_id: data.organization_id || req.organizationId };
};

module.exports = { tenantQuery, withOrgData };
