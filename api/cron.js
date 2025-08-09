const mysql = require('mysql2/promise');

let pool;
function getDB() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT || 3306),
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4'
    });
  }
  return pool;
}

module.exports = async (req, res) => {
  const db = getDB();
  await db.query('UPDATE food_posts SET status = "expired" WHERE expiry < NOW() AND status = "active"');
  res.status(200).send('Expired posts updated');
};
