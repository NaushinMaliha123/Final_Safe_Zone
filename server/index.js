const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Database Connection
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '2210676126abc',
    database: 'smart_safezone',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

console.log('Using MySQL Connection Pool');

// Basic Route
app.get('/', (req, res) => {
    res.send('Smart SafeZone Backend is running');
});

// Example: API to save user info after signup
app.post('/api/users', (req, res) => {
    const { uid, name, email, mobile, userType, gender } = req.body;
    // Use INSERT ... ON DUPLICATE KEY UPDATE to prevent duplicate rows if data already exists
    const sql = `
        INSERT INTO users (uid, name, email, mobile, userType, gender) 
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        name = VALUES(name), 
        mobile = VALUES(mobile), 
        gender = VALUES(gender),
        userType = VALUES(userType)
    `;
    
    db.query(sql, [uid, name, email, mobile || null, userType, gender || 'Not Specified'], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
        }
        res.status(200).json({ message: "User saved/updated in MySQL successfully" });
    });
});

// API to get user details by UID - Changed to POST for security
app.post('/api/get-user', (req, res) => {
    const { uid } = req.body;
    const sql = "SELECT * FROM users WHERE uid = ?";
    
    db.query(sql, [uid], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
        }
        if (result.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.status(200).json(result[0]);
    });
});

// API to update user details by UID
app.put('/api/users/:uid', (req, res) => {
    const { uid } = req.params;
    const { name, mobile, gender } = req.body;
    const sql = "UPDATE users SET name = ?, mobile = ?, gender = ? WHERE uid = ?";
    
    db.query(sql, [name, mobile, gender, uid], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
        }
        res.status(200).json({ message: "Profile updated in MySQL successfully" });
    });
});

// API to delete user details by UID from MySQL database (cleanup of unverified/failed users)
app.delete('/api/users/:uid', (req, res) => {
    const { uid } = req.params;
    const sql = "DELETE FROM users WHERE uid = ?";
    
    db.query(sql, [uid], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error during cleanup" });
        }
        res.status(200).json({ message: "Unverified user cleaned up from MySQL" });
    });
});

// guardian_requests table endpoints
// API to send a guardian request
app.post('/api/guardian-requests', (req, res) => {
    const { student_uid, guardian_phone, relationship } = req.body;
    const sql = "INSERT INTO guardian_requests (student_uid, guardian_phone, relationship) VALUES (?, ?, ?)";
    
    db.query(sql, [student_uid, guardian_phone, relationship], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
        }
        res.status(200).json({ message: "Guardian request sent successfully", requestId: result.insertId });
    });
});

// API to get pending requests for a guardian (matched by phone) - Changed to POST for security
app.post('/api/get-guardian-requests', (req, res) => {
    const { phone } = req.body;
    const sql = `
        SELECT gr.*, u.name as student_name 
        FROM guardian_requests gr 
        JOIN users u ON gr.student_uid = u.uid 
        WHERE gr.guardian_phone = ? AND gr.status = 'pending'
    `;
    
    db.query(sql, [phone], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
        }
        res.status(200).json(result);
    });
});

// API to accept/reject a request
app.put('/api/guardian-requests/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'accepted' or 'rejected'
    const sql = "UPDATE guardian_requests SET status = ? WHERE id = ?";
    
    db.query(sql, [status, id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
        }
        res.status(200).json({ message: `Request ${status} successfully` });
    });
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart SafeZone Backend is running on port ${PORT} and listening on all interfaces`);
});
