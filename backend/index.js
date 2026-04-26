const express = require('express');
const cors = require('cors');
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

const tenantHandler = require('./middleware/tenantHandler');
const authMiddleware = require('./middleware/authMiddleware');

app.use(tenantHandler);

const authRoutes = require('./routes/auth');
const migrationController = require('./controllers/migrationController');
app.post('/api/migrate', migrationController.runMigration);

app.use('/api/auth', authRoutes);

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
app.use('/api/lab', labRoutes);
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/operations', require('./routes/operationsRoutes'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/ambulances', require('./routes/ambulanceRoutes'));
app.use('/api/diagnostic-labs', require('./routes/diagnosticLabRoutes'));


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
