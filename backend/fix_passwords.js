require('dotenv').config();
const directDb = require('./utils/directDb');
const bcrypt = require('bcryptjs');

async function fixPasswords() {
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('123456', salt);

        // Update doctor1
        await directDb.pool.query("UPDATE users SET password_hash = ? WHERE email = 'doctor1@gmail.com'", [hash]);
        console.log('Reset doctor1 password to 123456');

        // Update patient1
        await directDb.pool.query("UPDATE users SET password_hash = ? WHERE email = 'patient1@gmail.com'", [hash]);
        console.log('Reset patient1 password to 123456');

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
fixPasswords();
