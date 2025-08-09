const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const path = require('path'); // Ensure you have this imported
const session = require('express-session');
var cors=require('cors');
const app = express();
const port = 3000;



// Middleware
app.use(bodyParser.json());
app.use('/scripts',express.static(path.join(__dirname, 'scripts')));
app.use('/static',express.static(path.join(__dirname, 'static')));
app.use('/templates',express.static(path.join(__dirname, 'templates')));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'process.env.SESSION_SECRET', resave: false, saveUninitialized: true }));
app.use(cors());

// MySQL Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'foodshare'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL database.');
});

// API Endpoints
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname,'templates','home.html'));
});

app.get('/about.html',(req,res)=>{
    res.sendFile(path.join(__dirname,'templates','about.html'));
});

app.get('/contact.html',(req,res)=>{
    res.sendFile(path.join(__dirname,'templates','contact.html'));
});

// Serve login and register pages
app.get('/templates/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'login.html'));
});

app.get('/templates/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'register.html'));
});

// Serve the dashboard pages
app.get('/templates/restaurant_dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'restaurant_dashboard.html'));
});

app.get('/templates/ngo_dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'ngo_dashboard.html'));
});

// Serve add post page
app.get('/templates/addpost.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'addpost.html'));
});

// Registration Endpoint
// Registration Endpoint
app.post('/api/register', (req, res) => {
    const { name, email, password, role, mobile, city, address } = req.body;

    // Add input validation for the role
    if (!['restaurant', 'ngo'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role specified.' });
    }

    // Hash the password before storing
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).send('Error hashing password');

        // Modify the query to include mobile, city, and address
        const query = `INSERT INTO users (name, email, password, role, mobile, city, address) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.query(query, [name, email, hash, role, mobile, city, address], (err, results) => {
            if (err) {
                return res.status(500).send('Error registering user: ' + err);
            }
            // Store user information in session
            req.session.user = { id: results.insertId, email, role, name, mobile, city, address }; // Save relevant info

            // Redirect based on role
            if (role === 'restaurant') {
                res.redirect('/templates/restaurant_dashboard.html');
            } else {
                res.redirect('/templates/ngo_dashboard.html');
            }
        });
    });
});


// Login Endpoint
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], (err, results) => {
        if (err) return res.status(500).send(err);
        if (results.length > 0) {
            // Compare the plain text password with the hashed password
            bcrypt.compare(password, results[0].password, (err, isMatch) => {
                if (err) return res.status(500).send(err);
                if (isMatch) {
                    // Store user information in session with the same fields as in registration
                    req.session.user = {
                        id: results[0].id,
                        email: results[0].email,
                        role: results[0].role,
                        name: results[0].name,
                        mobile: results[0].mobile,
                        city: results[0].city,
                        address: results[0].address
                    }; // Save relevant info
                    
                    // Redirect based on role
                    if (results[0].role === 'restaurant') {
                        res.redirect('/templates/restaurant_dashboard.html');
                    } else {
                        res.redirect('/templates/ngo_dashboard.html');
                    }
                } else {     
                    res.status(401).send('Invalid credentials');
                }
            });
        } else {
            res.status(401).send('Invalid credentials');
        }
    });
});


// Food post addition
// Food post addition
app.post('/api/food/add', (req, res) => {
    const { food_title, meal_quantity, expiry } = req.body;

    // Get the restaurant_id and contact details from the session
    const { id: restaurant_id, mobile, city, address } = req.session.user;

    const contact_details = `Mobile: ${mobile}, City: ${city}, Address: ${address}`;
    console.log(contact_details);

    const query = `INSERT INTO food_posts (restaurant_id, food_title, meal_quantity, expiry, contact_details, status)
                   VALUES (?, ?, ?, ?, ?, "active")`;

    db.query(query, [restaurant_id, food_title, meal_quantity, expiry, contact_details], (err, results) => {
        if (err) return res.status(500).send(err);
        res.redirect('/templates/restaurant_dashboard.html');
    });
});


// Fetch past posts for the logged-in restaurant
app.get('/api/restaurant/posts', (req, res) => {
    const restaurant_id = req.session.user.id; // Assuming the user is logged in and their ID is in session

    const query = 'SELECT * FROM food_posts WHERE restaurant_id = ?';
    db.query(query, [restaurant_id], (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results); // Return both active and expired posts
    });
});


// Endpoint to get available food posts including restaurant name and contact details
app.get('/api/food/available', (req, res) => {
    const ngo_id = req.session.user.id;
    
    // Retrieve the city of the NGO from the database
    const ngoCityQuery = `SELECT city FROM users WHERE id = ?`;
    
    db.query(ngoCityQuery, [ngo_id], (err, ngoResults) => {
        if (err) return res.status(500).send(err);
        
        if (ngoResults.length === 0) {
            return res.status(404).send('NGO not found.');
        }
        
        const ngoCity = ngoResults[0].city;

        // Updated query to select food posts from restaurants in the same city as the NGO
        const foodPostsQuery = `
            SELECT fp.*, u.name AS restaurant_name, u.mobile AS restaurant_mobile, 
                   u.city AS restaurant_city, u.address AS restaurant_address 
            FROM food_posts fp
            JOIN users u ON fp.restaurant_id = u.id
            WHERE fp.expiry > NOW() 
              AND fp.status = "active" 
              AND u.city = ?  -- Filter by city
        `;

        db.query(foodPostsQuery, [ngoCity], (err, results) => {
            if (err) return res.status(500).send(err);
            res.json(results);
        });
    });
});


app.get('/api/restaurant/details', (req, res) => {
    const restaurantId = req.session.user.id; // Assuming session contains the logged-in restaurant ID
    const query = 'SELECT name FROM users WHERE id = ? AND role = "restaurant"';

    db.query(query, [restaurantId], (err, results) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        if (results.length === 0) return res.status(404).json({ error: 'Restaurant not found' });

        res.json(results[0]);  // Return restaurant name
    });
});

app.get('/api/ngo/details', (req, res) => {
    const ngoId = req.session.user.id; // Assuming session contains the logged-in ngo ID
    const query = 'SELECT name FROM users WHERE id = ? AND role = "ngo"';

    db.query(query, [ngoId], (err, results) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        if (results.length === 0) return res.status(404).json({ error: 'ngo not found' });

        res.json(results[0]);  // Return ngo name
    });
});


// Endpoint to mark a post as accepted by the restaurant
app.post('/api/food/mark-accepted/:id', (req, res) => {
    const foodPostId = req.params.id;
    
    // Ensure the post belongs to the logged-in restaurant
    const restaurant_id = req.session.user.id;

    const query = 'UPDATE food_posts SET status = "accepted" WHERE id = ? AND restaurant_id = ?';
    db.query(query, [foodPostId, restaurant_id], (err, result) => {
        if (err) return res.status(500).send('Error updating post status');
        if (result.affectedRows === 0) {
            return res.status(404).send('Post not found or not authorized');
        }
        res.send('Post marked as accepted');
    });
});



// Endpoint to delete a food post by ID
app.delete('/api/food/delete/:id', (req, res) => {
    const foodPostId = req.params.id;
    
    // Ensure the post belongs to the logged-in restaurant
    const restaurant_id = req.session.user.id;

    const query = 'DELETE FROM food_posts WHERE id = ? AND restaurant_id = ?';
    db.query(query, [foodPostId, restaurant_id], (err, result) => {
        if (err) return res.status(500).send('Error deleting post');
        if (result.affectedRows === 0) {
            return res.status(404).send('Post not found or not authorized');
        }
        res.send('Post deleted successfully');
    });
});

// Logout Endpoint
app.get('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Failed to log out.');
        }
        res.redirect('/'); // Redirect to home page after logging out
    });
});



// Automatic post expiration based on time
const query = 'UPDATE food_posts SET status = "expired" WHERE expiry < NOW() AND status = "active"';
db.query(query, (err) => {
    if (err) console.error(err);
});
setInterval(() => {
    const query = 'UPDATE food_posts SET status = "expired" WHERE expiry < NOW() AND status = "active"';
    db.query(query, (err) => {
        if (err) console.error(err);
    });
}, 3600000); // Run every hour


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
