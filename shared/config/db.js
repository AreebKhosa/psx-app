const { Pool } = require('pg');
const env = require('./env');

// Configure PostgreSQL connection pool
const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.isProduction ? { rejectUnauthorized: false } : false,
    max: 20, // Max concurrent connections in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// Pool error handling
pool.on('error', (err) => {
    console.error('[DB] Unexpected idle client error:', err.message);
});

/**
 * Execute a SQL query with parameters
 * @param {string} text - SQL query string
 * @param {Array} params - Array of parameter values
 */
const query = async (text, params) => {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (!env.isProduction) {
        console.log(`[DB Query] ${duration}ms | rows: ${res.rowCount} | query: ${text.slice(0, 80)}...`);
    }
    return res;
};

/**
 * Get a client from the pool for transactions
 */
const getClient = async () => {
    const client = await pool.connect();
    return client;
};

module.exports = {
    pool,
    query,
    getClient,
};