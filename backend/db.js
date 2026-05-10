require('dotenv').config();
const mysql = require('mysql2/promise');
const { AsyncLocalStorage } = require('async_hooks');

const dbStorage = new AsyncLocalStorage();

function getEnv(key, fallback = '') {
  const val = process.env[key];
  return typeof val === 'string' ? val.replace(/[\r\n]+/g, '').trim() : fallback;
}

const pools = {};
const mainDbName = getEnv('DATABASE_NAME', 'wisehospital');

const mainPool = mysql.createPool({
  host: getEnv('DATABASE_HOST', '127.0.0.1'),
  port: Number(getEnv('DATABASE_PORT', '3306')),
  user: getEnv('DATABASE_USER', 'root'),
  password: getEnv('DATABASE_PASSWORD', ''),
  database: mainDbName,
  waitForConnections: true,
  connectionLimit: 100,
  queueLimit: 0,
});

const DEFAULT_ORG_ID = '0001-0000-00001';

async function getTenantDb(orgId) {
  // If no orgId or it is the default, use main pool
  if (!orgId || orgId === DEFAULT_ORG_ID) {
    return mainPool;
  }

  // 1. Check if we already have this pool in cache
  const cacheKey = orgId;
  if (pools[cacheKey]) {
    return pools[cacheKey];
  }

  try {
    // 2. Query the "Supervisor" table (organizations) to find the db_name
    const [orgs] = await mainPool.query(`SELECT db_name FROM organizations WHERE id = ?`, [orgId]);
    
    let dbName;
    if (orgs.length > 0 && orgs[0].db_name) {
      dbName = orgs[0].db_name;
    } else {
      // Fallback: Use automatic naming if no specific db_name is set
      dbName = `hospital_${orgId.replace(/-/g, '_')}`;
    }

    // 3. Check if the database exists
    const [dbCheck] = await mainPool.query(`SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`, [dbName]);

    if (dbCheck.length > 0) {
      // Database exists, create pool
      const pool = mysql.createPool({
        host: getEnv('DATABASE_HOST', '127.0.0.1'),
        port: Number(getEnv('DATABASE_PORT', '3306')),
        user: getEnv('DATABASE_USER', 'root'),
        password: getEnv('DATABASE_PASSWORD', ''),
        database: dbName,
        connectionLimit: 50
      });
      pools[cacheKey] = pool;
      return pool;
    }

    // 4. It's a new organization -> Auto-provision
    console.log(`🚀 Supervisor: Provisioning new isolated database [${dbName}] for organization: ${orgId}`);
    await mainPool.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    
    // Update the supervisor table with the new db_name
    await mainPool.query(`UPDATE organizations SET db_name = ? WHERE id = ?`, [dbName, orgId]);

    const newPool = mysql.createPool({
      host: getEnv('DATABASE_HOST', '127.0.0.1'),
      port: Number(getEnv('DATABASE_PORT', '3306')),
      user: getEnv('DATABASE_USER', 'root'),
      password: getEnv('DATABASE_PASSWORD', ''),
      database: dbName,
      multipleStatements: true,
      connectionLimit: 50
    });

    // Synchronize schema
    const schemaPath = path.join(__dirname, '..', 'mariadb_schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await newPool.query(sql);
      console.log(`✅ Schema initialized for ${dbName}`);
    }
    
    pools[cacheKey] = newPool;
    return newPool;
  } catch (err) {
    console.error(`❌ Supervisor Error for org ${orgId}:`, err.message);
    return mainPool;
  }
}

// Export a proxy or a function to get the current connection
// For legacy code that uses 'pool.query', we'll export the mainPool as default but provide getTenantDb
// Test connection and sync schema for main DB on startup
mainPool.getConnection()
  .then(async conn => {
    console.log('✅ Connected to MariaDB (Main Pool)');
    
    try {
        const schemaPath = path.join(__dirname, '..', 'mariadb_schema.sql');
        if (fs.existsSync(schemaPath)) {
            const sql = fs.readFileSync(schemaPath, 'utf8');
            await conn.query(sql);
            console.log('✅ Main Schema synchronized successfully.');
        }
    } catch (err) {
        console.error('❌ Main Schema sync error:', err.message);
    }
    
    conn.release();
  })
  .catch(err => {
    console.error('❌ MariaDB connection error:', err.message);
    process.exit(1);
  });

mainPool.getTenantDb = getTenantDb;
mainPool.dbStorage = dbStorage;
module.exports = mainPool;

