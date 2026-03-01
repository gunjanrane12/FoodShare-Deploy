require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const path = require('path');
const session = require('express-session');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use('/scripts', express.static(path.join(__dirname, 'scripts')));
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/templates', express.static(path.join(__dirname, 'templates')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'foodshare-local-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: true }
}));

// ─── MySQL Connection (local) ─────────────────────────────────────────────────
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'foodshare'
});

db.connect((err) => {
    if (err) {
        console.error('❌ MySQL connection failed:', err.message);
        console.error('   Make sure MySQL is running and the "foodshare" database exists.');
        console.error('   Run: mysql -u root -p < database.sql');
        process.exit(1);
    }
    console.log('✅ Connected to MySQL (foodshare database).');
});

// ─── Sitemap ──────────────────────────────────────────────────────────────────
app.get('/sitemap.xml', (req, res) => {
    res.header('Content-Type', 'application/xml');
    res.sendFile(path.join(__dirname, 'sitemap.xml'));
});


// ─── Page Routes ──────────────────────────────────────────────────────────────
app.get('/', (req, res) =>
    res.sendFile(path.join(__dirname, 'templates', 'home.html')));

app.get('/about.html', (req, res) =>
    res.sendFile(path.join(__dirname, 'templates', 'about.html')));

app.get('/contact.html', (req, res) =>
    res.sendFile(path.join(__dirname, 'templates', 'contact.html')));

app.get('/templates/login.html', (req, res) =>
    res.sendFile(path.join(__dirname, 'templates', 'login.html')));

app.get('/templates/register.html', (req, res) =>
    res.sendFile(path.join(__dirname, 'templates', 'register.html')));

app.get('/templates/restaurant_dashboard.html', (req, res) =>
    res.sendFile(path.join(__dirname, 'templates', 'restaurant_dashboard.html')));

app.get('/templates/ngo_dashboard.html', (req, res) =>
    res.sendFile(path.join(__dirname, 'templates', 'ngo_dashboard.html')));

app.get('/templates/addpost.html', (req, res) =>
    res.sendFile(path.join(__dirname, 'templates', 'addpost.html')));

// ─── Auth: Register ───────────────────────────────────────────────────────────
app.post('/api/register', (req, res) => {
    const { name, email, password, role, mobile, city, address } = req.body;

    if (!['restaurant', 'ngo'].includes(role))
        return res.status(400).json({ message: 'Invalid role specified.' });

    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).send('Error hashing password');

        const query = `INSERT INTO users (name, email, password, role, mobile, city, address)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.query(query, [name, email, hash, role, mobile, city, address], (err, results) => {
            if (err) return res.status(500).send('Error registering user: ' + err.message);

            req.session.user = { id: results.insertId, email, role, name, mobile, city, address };

            if (role === 'restaurant')
                res.redirect('/templates/restaurant_dashboard.html');
            else
                res.redirect('/templates/ngo_dashboard.html');
        });
    });
});

// ─── Auth: Login ──────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) return res.status(500).send(err.message);
        if (results.length === 0) return res.status(401).send('Invalid credentials');

        bcrypt.compare(password, results[0].password, (err, isMatch) => {
            if (err) return res.status(500).send(err.message);
            if (!isMatch) return res.status(401).send('Invalid credentials');

            req.session.user = {
                id: results[0].id,
                email: results[0].email,
                role: results[0].role,
                name: results[0].name,
                mobile: results[0].mobile,
                city: results[0].city,
                address: results[0].address
            };

            if (results[0].role === 'restaurant')
                res.redirect('/templates/restaurant_dashboard.html');
            else
                res.redirect('/templates/ngo_dashboard.html');
        });
    });
});

// ─── Auth: Logout ─────────────────────────────────────────────────────────────
app.get('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).send('Failed to log out.');
        res.redirect('/');
    });
});

// ─── Session Guard Middleware ─────────────────────────────────────────────────
function requireLogin(req, res, next) {
    if (!req.session.user)
        return res.status(401).json({ error: 'Not logged in. Please login first.' });
    next();
}

// ─── Food API ─────────────────────────────────────────────────────────────────
app.post('/api/food/add', requireLogin, (req, res) => {
    const { food_title, meal_quantity, expiry } = req.body;
    const { id: restaurant_id, mobile, city, address } = req.session.user;
    const contact_details = `Mobile: ${mobile}, City: ${city}, Address: ${address}`;

    const query = `INSERT INTO food_posts (restaurant_id, food_title, meal_quantity, expiry, contact_details, status)
                 VALUES (?, ?, ?, ?, ?, 'active')`;
    db.query(query, [restaurant_id, food_title, meal_quantity, expiry, contact_details], (err) => {
        if (err) return res.status(500).send(err.message);
        res.redirect('/templates/restaurant_dashboard.html');
    });
});

app.get('/api/restaurant/posts', requireLogin, (req, res) => {
    db.query('SELECT * FROM food_posts WHERE restaurant_id = ? ORDER BY expiry DESC',
        [req.session.user.id], (err, results) => {
            if (err) return res.status(500).send(err.message);
            res.json(results);
        });
});

app.get('/api/food/available', requireLogin, (req, res) => {
    const ngo_id = req.session.user.id;
    db.query('SELECT city FROM users WHERE id = ?', [ngo_id], (err, ngoResults) => {
        if (err) return res.status(500).send(err.message);
        if (ngoResults.length === 0) return res.status(404).send('NGO not found.');

        const ngoCity = ngoResults[0].city;
        const foodPostsQuery = `
      SELECT fp.*, u.name AS restaurant_name, u.mobile AS restaurant_mobile,
             u.city AS restaurant_city, u.address AS restaurant_address
      FROM food_posts fp
      JOIN users u ON fp.restaurant_id = u.id
      WHERE fp.expiry > NOW()
        AND fp.status = 'active'
        AND u.city = ?
      ORDER BY fp.expiry ASC
    `;
        db.query(foodPostsQuery, [ngoCity], (err, results) => {
            if (err) return res.status(500).send(err.message);
            res.json(results);
        });
    });
});

app.get('/api/restaurant/details', requireLogin, (req, res) => {
    db.query('SELECT name FROM users WHERE id = ? AND role = "restaurant"',
        [req.session.user.id], (err, results) => {
            if (err) return res.status(500).json({ error: 'Internal server error' });
            if (results.length === 0) return res.status(404).json({ error: 'Restaurant not found' });
            res.json(results[0]);
        });
});

app.get('/api/ngo/details', requireLogin, (req, res) => {
    db.query('SELECT name FROM users WHERE id = ? AND role = "ngo"',
        [req.session.user.id], (err, results) => {
            if (err) return res.status(500).json({ error: 'Internal server error' });
            if (results.length === 0) return res.status(404).json({ error: 'NGO not found' });
            res.json(results[0]);
        });
});

app.post('/api/food/mark-accepted/:id', requireLogin, (req, res) => {
    const { id: restaurant_id } = req.session.user;
    db.query('UPDATE food_posts SET status = "accepted" WHERE id = ? AND restaurant_id = ?',
        [req.params.id, restaurant_id], (err, result) => {
            if (err) return res.status(500).send('Error updating post status');
            if (result.affectedRows === 0)
                return res.status(404).send('Post not found or not authorized');
            res.send('Post marked as accepted');
        });
});

app.delete('/api/food/delete/:id', requireLogin, (req, res) => {
    const { id: restaurant_id } = req.session.user;
    db.query('DELETE FROM food_posts WHERE id = ? AND restaurant_id = ?',
        [req.params.id, restaurant_id], (err, result) => {
            if (err) return res.status(500).send('Error deleting post');
            if (result.affectedRows === 0)
                return res.status(404).send('Post not found or not authorized');
            res.send('Post deleted successfully');
        });
});

// ─── Auto-expire Posts (every hour) ──────────────────────────────────────────
function expirePosts() {
    db.query('UPDATE food_posts SET status = "expired" WHERE expiry < NOW() AND status = "active"',
        (err) => { if (err) console.error('Auto-expire error:', err.message); });
}
expirePosts();
setInterval(expirePosts, 3600000);

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 FoodShare is running at http://localhost:${PORT}`);
    console.log(`   Sitemap: http://localhost:${PORT}/sitemap.xml\n`);
});
