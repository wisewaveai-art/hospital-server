require('dotenv').config();
const directDb = require('./utils/directDb');

async function fixUser() {
    try {
        const { rows } = await directDb.query("SELECT * FROM users WHERE email = 'patien1@gmail.com'");
        console.log('Found user:', rows);
        
        if (rows.length > 0) {
            const res = await directDb.query("UPDATE users SET email = 'patient1@gmail.com', full_name = 'Patient One' WHERE email = 'patien1@gmail.com'");
            console.log('Update result:', res);
            
            const { rows: updatedRows } = await directDb.query("SELECT * FROM users WHERE email = 'patient1@gmail.com'");
            console.log('Updated user:', updatedRows);
        } else {
            console.log('User not found!');
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
fixUser();
