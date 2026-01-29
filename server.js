
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const path = require('path');
const https = require("https");
const fs = require("fs");

const app = express();
app.use(express.static(__dirname));

const port = 3000;      // HTTP
const httpsPort = 3001; // HTTPS

// ----------------------------------------------------
// Middleware
// ----------------------------------------------------
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));


// ----------------------------------------------------
// HTML Routes
// ----------------------------------------------------
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'hospital-promo.html'));
});

app.get('/departments', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dept.html'));
});

app.get('/appointments', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'appointment.html'));
});

app.get('/queue', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});


// ----------------------------------------------------
// Database Connection
// ----------------------------------------------------
const con = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'navya',
    database: 'hospitalDB'
});

con.connect((err) => {
    if (err) throw err;
    console.log("✅ Connected to the hospital database!");
});

// ----------------------------------------------------
// Create Tables (Auto Generate)
// ----------------------------------------------------

// Patients Table
con.query(`
CREATE TABLE IF NOT EXISTS patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    contact VARCHAR(20)
)
`);

// Doctors Table
con.query(`
CREATE TABLE IF NOT EXISTS doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50),
    email VARCHAR(50)
)
`);

// Appointments Table
con.query(`
CREATE TABLE IF NOT EXISTS appointments(
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_name VARCHAR(50) NOT NULL,
    contact VARCHAR(20),
    doctor VARCHAR(50) NOT NULL,
    department VARCHAR(50),
    date DATE NOT NULL
)
`, () => console.log("✅ Appointments table ready"));

// Queue Tokens Table
con.query(`
CREATE TABLE IF NOT EXISTS queue(
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50),
    contact VARCHAR(20),
    department VARCHAR(50),
    doctor_id INT,
    token INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`, () => console.log("✅ Queue table ready"));

// Admin Table
con.query(`
CREATE TABLE IF NOT EXISTS admin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    password VARCHAR(50)
)
`, () => console.log("✅ Admin table ready"));

// ----------------------------------------------------
// PATIENT LOGIN
// /login/patient
// ----------------------------------------------------
app.post('/login/patient', (req, res) => {
    const { identifier } = req.body;

    const sql = `SELECT * FROM appointments WHERE patient_name = ?`;

    con.query(sql, [identifier], (err, results) => {
        if (err) throw err;

        if (results.length === 0) {
            return res.send("❌ No appointments found for this patient.");
        }

        res.json({
            message: "Login successful!",
            patient: identifier,
            appointments: results
        });
    });
});

// ----------------------------------------------------
// APPOINTMENT CREATION (appointment.html)
// /api/appointment/create
// ----------------------------------------------------
app.post('/api/appointment/create', (req, res) => {
    const { name, contact, department, doctor_id, date } = req.body;

    if (!name || !department || !doctor_id || !date) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const doctorNameMap = {
        1: "Dr. DINESH",
        2: "Dr. ZOYA",
        3: "Dr. NAVYA PUJARI",
        4: "Dr. SHASHI",
        5: "Dr. NAVYA KASTURI",
        6: "Dr. Kumar"
    };

    const doctorName = doctorNameMap[doctor_id];

    const sql = `
        INSERT INTO appointments (patient_name, contact, doctor, department, date)
        VALUES (?, ?, ?, ?, ?)
    `;

    con.query(sql, [name, contact, doctorName, department, date], (err, result) => {
        if (err) throw err;

        res.json({
            message: "Appointment booked successfully",
            appointment_id: result.insertId,
            doctor: doctorName
        });
    });
});


// ----------------------------------------------------
// QUEUE TOKEN GENERATION (app.html)
// /api/queue/register
// ----------------------------------------------------
app.post('/api/queue/register', (req, res) => {
    const { name, contact, department, doctor_id } = req.body;

    const token = Math.floor(Math.random() * 900) + 100;

    const sql = `
        INSERT INTO queue (name, contact, department, doctor_id, token)
        VALUES (?, ?, ?, ?, ?)
    `;

    con.query(sql, [name, contact, department, doctor_id, token], (err) => {
        if (err) throw err;

        const position = Math.floor(Math.random() * 10) + 1;
        const eta = position * 5; // minutes

        res.json({
            message: "Token generated",
            token,
            position,
            eta
        });
    });
});

app.post('/login', (req, res) => {
    const { name } = req.body;

    const query = `
        SELECT * FROM appointments
        WHERE LOWER(patient_name) = LOWER(?)
    `;

    con.query(query, [name], (err, results) => {
        if (err) throw err;

        if (results.length === 0) {
            return res.json({ message: "No patient found" });
        }

        res.json({
            message: "Login successful!",
            patient: name,
            appointments: results
        });
    });
});


app.post('/login/doctor', (req, res) => {
    const { identifier } = req.body;

    const doctorName = identifier;

    const appointmentQuery = `
        SELECT patient_name AS patient, contact, date
        FROM appointments
        WHERE LOWER(doctor) = LOWER(?)
    `;

    con.query(appointmentQuery, [doctorName], (err, results) => {
        if (err) throw err;

        res.json({
            doctor: doctorName,
            appointments: results
        });
    });
});

// ----------------------------------------------------
// ADMIN LOGIN — No Password
// /login/admin
// ----------------------------------------------------
app.post('/login/admin', (req, res) => {
    const { identifier } = req.body;

    // Allow ANY admin name (e.g., “admin”)
    const adminName = identifier;

    // Admin sees all appointments
    const sql = `SELECT * FROM appointments`;

    con.query(sql, (err, results) => {
        if (err) throw err;

        res.json({
            admin: adminName,
            appointments: results
        });
    });
});


// ----------------------------------------------------
// HTTPS Server Setup
// ----------------------------------------------------
let httpsOptions = {};

try {
    httpsOptions = {
        key: fs.readFileSync("key.pem"),
        cert: fs.readFileSync("cert.pem")
    };

    https.createServer(httpsOptions, app).listen(httpsPort, () => {
        console.log(`🔐 Secure HTTPS Server running at https://localhost:${httpsPort}`);
    });

} catch (err) {
    console.log("⚠️ HTTPS certificates missing. HTTPS not enabled.");
}


// ----------------------------------------------------
// HTTP Fallback Server
// ----------------------------------------------------
app.listen(port, () => {
    console.log(`🚀 HTTP Server running at http://localhost:${port}`);
});
