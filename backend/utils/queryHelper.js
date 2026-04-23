/**
 * Appends organization filter to a Supabase query if applicable
 * @param {object} query - Supabase query builder object
 * @param {object} req - Express request object containing organizationId
 */
const withOrg = (query, req) => {
    // Superadmin sees everything unless an organizationId is explicitly provided in some context
    // For now, superadmin is global.
    if (req.user && req.user.role === 'superadmin') {
        return query;
    }

    if (req.organizationId) {
        return query.eq('organization_id', req.organizationId);
    }
    
    // If no org context, returning query as is might lead to data leaks or empty sets 
    // depending on the table. For strict multi-tenancy, we might want to throw error 
    // or return an empty result if organizationId is missing for non-superadmins.
    return query;
};

module.exports = { withOrg };
