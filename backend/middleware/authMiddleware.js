const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';

const authMiddleware = (req, res, next) => {
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
        if (decoded.organization_id) {
            req.organizationId = decoded.organization_id;
        }
        
        next();
    } catch (err) {
        console.error('JWT Verification Error:', err);
        return res.status(401).json({ error: 'Unauthorized' });
    }
};

module.exports = authMiddleware;
