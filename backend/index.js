const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const dns = require('dns');

// Manual DNS lookup patch to bypass local DNS ENOTFOUND for Supabase
const originalLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  if (hostname === 'ihxgsyrkxrnghsxqlxpp.supabase.co') {
    const cb = typeof options === 'function' ? options : callback;
    const opts = typeof options === 'object' ? options : {};
    
    if (opts.all) {
      return cb(null, [{ address: '104.18.38.10', family: 4 }]);
    }
    return cb(null, '104.18.38.10', 4);
  }
  return originalLookup(hostname, options, callback);
};

// OVERRIDE LOCAL DNS: The local router/ISP is failing to resolve the Supabase domain (returning NXDOMAIN).
// We are forcing the Node.js process to use Google and Cloudflare Public DNS to fix the ENOTFOUND fetch errors.
require('dns').setServers(['8.8.8.8', '1.1.1.1']);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.originalUrl}`);
    next();
});

const tenantHandler = require('./middleware/tenantHandler');
const authMiddleware = require('./middleware/authMiddleware');

app.use(tenantHandler);

const authRoutes = require('./routes/auth');
const migrationController = require('./controllers/migrationController');
app.post('/api/migrate', migrationController.runMigration);

app.use('/api/auth', authRoutes);
app.use('/api/vibevoice', require('./routes/vibevoice')); // Open webhook

app.use(authMiddleware);
app.get('/', (req, res) => {
    res.send('Hospital Management System API is running (SaaS Mode)');
});

const userRoutes = require('./routes/users');
// ... other routes ...
const organizationRoutes = require('./routes/organizations'); // I'll create this next
const medicineRoutes = require('./routes/medicines');
const categoryRoutes = require('./routes/categories');
const patientRoutes = require('./routes/patients');
const staffRoutes = require('./routes/staff');
const doctorRoutes = require('./routes/doctors');
const instrumentRoutes = require('./routes/instruments');
const roomRoutes = require('./routes/rooms');
const serviceRoutes = require('./routes/services');
const appointmentRoutes = require('./routes/appointments');
const branchRoutes = require('./routes/branches');
const labRoutes = require('./routes/labRoutes');

app.use('/api/organizations', require('./routes/organizations'));
// app.use('/api/auth', authRoutes); // Moved before authMiddleware
app.use('/api/users', userRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/instruments', instrumentRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/operations', require('./routes/operationsRoutes'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/ambulances', require('./routes/ambulanceRoutes'));
app.use('/api/diagnostic-labs', require('./routes/diagnosticLabRoutes'));
app.use('/api/bi', require('./routes/biRoutes'));
app.use('/api/vitals', require('./routes/vitalsRoutes'));


const hrRoutes = require('./routes/hr');
app.use('/api/hr', hrRoutes);

// ── Auto-migrate: ensure is_active column exists on startup ──────────────────
(async () => {
    try {
        const mysql = require('mysql2/promise');
        const setupConn = await mysql.createConnection({
            host: process.env.DATABASE_HOST || 'localhost',
            port: Number(process.env.DATABASE_PORT || '3306'),
            user: process.env.DATABASE_USER || 'root',
            password: process.env.DATABASE_PASSWORD || '',
            database: process.env.DATABASE_NAME || 'wisehospital',
        });
        try {
            await setupConn.query(
                `ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE`
            );
            await setupConn.query(
                `UPDATE users SET is_active = TRUE WHERE is_active IS NULL`
            );
            console.log('[Migration] Added is_active column to users table.');
        } catch (e) {
            // Column likely already exists — that's fine
            if (!e.message.includes('Duplicate column')) {
                console.warn('[Migration] is_active column note:', e.message);
            }
        }
        await setupConn.end();
    } catch (err) {
        console.error('[Migration] Auto-migration failed (non-fatal):', err.message);
    }
})();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
