const supabase = require('../supabaseClient');

/**
 * Middleware to handle organization/tenant detection
 * Supports:
 * 1. Subdomain-based: org1.wisehospital.com
 * 2. Header-based (for dev/mobile): x-organization-id
 */
const tenantHandler = async (req, res, next) => {
    try {
        let organizationId = req.headers['x-organization-id'];
        let slug = req.headers['x-organization-slug'];

        if (!slug) {
            // Check subdomain
            const host = req.get('host');
            const parts = host.split('.');
            if (parts.length > 2 && !host.includes('localhost') && !host.includes('127.0.0.1')) {
                slug = parts[0];
            }
        }

        if (slug) {
            const { data: org, error } = await supabase
                .from('organizations')
                .select('id')
                .eq('slug', slug)
                .single();

            if (org) {
                organizationId = org.id;
            }
        }

        req.organizationId = organizationId;
        next();
    } catch (err) {
        console.error('Tenant Handler Error:', err);
        next();
    }
};

module.exports = tenantHandler;
