const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const path = require('path');
const cors = require('cors');
const { getIronSession } = require('iron-session');

const app = express();

// ===== Middleware =====
app.use(bodyParser.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

import { readFileSync } from "fs";
import { join } from "path";

export default function handler(req, res) {
  const html = readFileSync(join(process.cwd(), "public/templates/index.html"), "utf8");
  res.setHeader("Content-Type", "text/html");
  res.send(html);
}

// ===== MySQL Pool (serverless-friendly) =====
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
      charset: 'utf8mb4',
      // Uncomment & set CA cert if your provider (like Aiven) requires TLS
      // ssl: { ca: process.env.DB_CA }
    });
  }
  return pool;
}

// ===== Iron-session config =====
const sessionOptions = {
  password: process.env.SESSION_PASSWORD, // must be 32+ chars
  cookieName: 'foodshare_session',
  cookieOptions: { secure: process.env.NODE_ENV === 'production' },
};

async function getSession(req, res) {
  return getIronSession(req, res, sessionOptions);
}

// ===== Routes =====

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/templates/home.html'));
});
app.get('/about.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/templates/about.html'));
});
app.get('/contact.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/templates/contact.html'));
});
app.get('/templates/:page', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/templates', req.params.page));
});

// Registration
app.post('/api/register', async (req, res) => {
  const { name, email, password, role, mobile, city, address } = req.body;
  if (!['restaurant', 'ngo'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role specified.' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const db = getDB();
    const [result] = await db.query(
      `INSERT INTO users (name, email, password, role, mobile, city, address) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email, hash, role, mobile, city, address]
    );

    const session = await getSession(req, res);
    session.user = { id: result.insertId, email, role, name, mobile, city, address };
    await session.save();

    res.redirect(role === 'restaurant' ? '/templates/restaurant_dashboard.html' : '/templates/ngo_dashboard.html');
  } catch (err) {
    res.status(500).send('Error registering user: ' + err);
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const db = getDB();
  const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

  if (users.length === 0) return res.status(401).send('Invalid credentials');

  const match = await bcrypt.compare(password, users[0].password);
  if (!match) return res.status(401).send('Invalid credentials');

  const session = await getSession(req, res);
  const u = users[0];
  session.user = {
    id: u.id, email: u.email, role: u.role,
    name: u.name, mobile: u.mobile, city: u.city, address: u.address
  };
  await session.save();

  res.redirect(u.role === 'restaurant' ? '/templates/restaurant_dashboard.html' : '/templates/ngo_dashboard.html');
});

// Add food post
app.post('/api/food/add', async (req, res) => {
  const { food_title, meal_quantity, expiry } = req.body;
  const session = await getSession(req, res);
  if (!session.user) return res.status(401).send('Not logged in');

  const { id: restaurant_id, mobile, city, address } = session.user;
  const contact_details = `Mobile: ${mobile}, City: ${city}, Address: ${address}`;

  const db = getDB();
  await db.query(
    `INSERT INTO food_posts (restaurant_id, food_title, meal_quantity, expiry, contact_details, status)
     VALUES (?, ?, ?, ?, ?, "active")`,
    [restaurant_id, food_title, meal_quantity, expiry, contact_details]
  );

  res.redirect('/templates/restaurant_dashboard.html');
});

// Get restaurant's posts
app.get('/api/restaurant/posts', async (req, res) => {
  const session = await getSession(req, res);
  if (!session.user) return res.status(401).send('Not logged in');

  const db = getDB();
  const [rows] = await db.query('SELECT * FROM food_posts WHERE restaurant_id = ?', [session.user.id]);
  res.json(rows);
});

// Get available food for NGO
app.get('/api/food/available', async (req, res) => {
  const session = await getSession(req, res);
  if (!session.user) return res.status(401).send('Not logged in');

  const db = getDB();
  const [ngoData] = await db.query('SELECT city FROM users WHERE id = ?', [session.user.id]);
  if (ngoData.length === 0) return res.status(404).send('NGO not found');

  const ngoCity = ngoData[0].city;
  const [posts] = await db.query(
    `SELECT fp.*, u.name AS restaurant_name, u.mobile AS restaurant_mobile, 
            u.city AS restaurant_city, u.address AS restaurant_address 
     FROM food_posts fp
     JOIN users u ON fp.restaurant_id = u.id
     WHERE fp.expiry > NOW() 
       AND fp.status = "active" 
       AND u.city = ?`,
    [ngoCity]
  );

  res.json(posts);
});

// Accept post
app.post('/api/food/mark-accepted/:id', async (req, res) => {
  const session = await getSession(req, res);
  if (!session.user) return res.status(401).send('Not logged in');

  const db = getDB();
  const [result] = await db.query(
    'UPDATE food_posts SET status = "accepted" WHERE id = ? AND restaurant_id = ?',
    [req.params.id, session.user.id]
  );

  if (result.affectedRows === 0) return res.status(404).send('Post not found or not authorized');
  res.send('Post marked as accepted');
});

// Delete post
app.delete('/api/food/delete/:id', async (req, res) => {
  const session = await getSession(req, res);
  if (!session.user) return res.status(401).send('Not logged in');

  const db = getDB();
  const [result] = await db.query(
    'DELETE FROM food_posts WHERE id = ? AND restaurant_id = ?',
    [req.params.id, session.user.id]
  );

  if (result.affectedRows === 0) return res.status(404).send('Post not found or not authorized');
  res.send('Post deleted successfully');
});

// Logout
app.get('/api/logout', async (req, res) => {
  const session = await getSession(req, res);
  await session.destroy();
  res.redirect('/');
});

// ===== Export for Vercel =====
module.exports = app;
