const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Some endpoints might be public, but we attach user if token exists
        return next();
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        
        // If organization_id is in token, it takes precedence for authenticated sessions
        if (decoded.organization_id && decoded.organization_id !== req.organizationId) {
            req.organizationId = decoded.organization_id;
            const pool = require('../db');
            const tenantPool = await pool.getTenantDb(req.organizationId);
            req.db = tenantPool;
            
            return pool.dbStorage.run(tenantPool, () => {
                next();
            });
        }
        
        next();
    } catch (err) {
        console.error('JWT Verification Error:', err);
        return res.status(401).json({ error: 'Unauthorized' });
    }
};

module.exports = authMiddleware;
