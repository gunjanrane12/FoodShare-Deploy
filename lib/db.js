// lib/db.js
const mysql = require('mysql2/promise');

function createPool() {
    return mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: Number(process.env.DB_PORT || 3306),
        waitForConnections: true,
        connectionLimit: Number(process.env.DB_CONN_LIMIT || 10),
        queueLimit: 0,
        // If your DB requires TLS/CA (Aiven likely does) you may need to add ssl options here.
        // ssl: { ca: process.env.DB_CA } // example
    });
}

// cache on the global object so it survives warm invocations
if (!global.__mysqlPool) {
    global.__mysqlPool = createPool();
}
module.exports = global.__mysqlPool;
