

require('dotenv').config();
const express = require('express');
const mysql   = require('mysql2/promise');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const { body, validationResult } = require('express-validator');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

const db = mysql.createPool({
    host:     process.env.DB_HOST || 'localhost',
    port:     Number(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'tuneup',
    waitForConnections: true,
    connectionLimit: 10,
});

// authentication validation
function requireAuth(req, res, next) {
    const header = req.headers['authorization'] || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing authorization header.' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Token invalid or expired.' });
    }
}

function validationErrors(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ errors: errors.array() }); return true; }
    return false;
}

// authentication points vvv

// POST /api/auth/register
app.post('/api/auth/register', [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
], async (req, res) => {
    if (validationErrors(req, res)) return;
    const { name, email, password } = req.body;
    try {
        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length) return res.status(409).json({ error: 'Email already in use.' });

        const password_hash = await bcrypt.hash(password, 12);
        const [result] = await db.query(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
            [name, email, password_hash]
        );
        const token = jwt.sign({ id: result.insertId, email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        res.status(201).json({ token, user: { id: result.insertId, name, email } });
    } catch (err) {
        console.error('[register]', err);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// POST /api/auth/login
app.post('/api/auth/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
], async (req, res) => {
    if (validationErrors(req, res)) return;
    const { email, password } = req.body;
    try {
        const [rows] = await db.query(
            'SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]
        );
        const user = rows[0];
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }
        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
        console.error('[login]', err);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// password reset

// POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', [
    body('email').isEmail().normalizeEmail(),
], async (req, res) => {
    if (validationErrors(req, res)) return;
    const { email } = req.body;
    try {
        const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        const user = rows[0];

        if (user) {
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
            await db.query(
                'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
                [user.id, token, expiresAt]
            );
            console.log(`[Password Reset] Token for ${email}: ${token}`);
            return res.json({ message: 'If that email exists, a reset link has been generated.', token });
        }

        res.json({ message: 'If that email exists, a reset link has been generated.' });
    } catch (err) {
        console.error('[forgot-password]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', [
    body('token').trim().notEmpty().withMessage('Token is required.'),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
], async (req, res) => {
    if (validationErrors(req, res)) return;
    const { token, newPassword } = req.body;
    try {
        const [rows] = await db.query(
            'SELECT id, user_id FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > NOW()',
            [token]
        );
        if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired reset token.' });

        const resetRecord = rows[0];
        const password_hash = await bcrypt.hash(newPassword, 12);

        await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, resetRecord.user_id]);
        await db.query('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [resetRecord.id]);

        res.json({ message: 'Password has been reset successfully.' });
    } catch (err) {
        console.error('[reset-password]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// profile

// GET /api/user/profile
app.get('/api/user/profile', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
        if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
        res.json(rows[0]);
    } catch (err) {
        console.error('[GET profile]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/user/profile
app.put('/api/user/profile', requireAuth, [
    body('name').trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
], async (req, res) => {
    if (validationErrors(req, res)) return;
    const { name, email } = req.body;
    try {
        if (email !== req.user.email) {
            const [conflict] = await db.query('SELECT id FROM users WHERE email = ? AND id <> ?', [email, req.user.id]);
            if (conflict.length) return res.status(409).json({ error: 'Email already in use.' });
        }
        await db.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, req.user.id]);
        const newToken = jwt.sign({ id: req.user.id, email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        res.json({ message: 'Profile updated.', user: { id: req.user.id, name, email }, token: newToken });
    } catch (err) {
        console.error('[PUT profile]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/user/password
app.put('/api/user/password', requireAuth, [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
], async (req, res) => {
    if (validationErrors(req, res)) return;
    const { currentPassword, newPassword } = req.body;
    try {
        const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
        if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
        if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }
        await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(newPassword, 12), req.user.id]);
        res.json({ message: 'Password updated.' });
    } catch (err) {
        console.error('[PUT password]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/user/account
app.delete('/api/user/account', requireAuth, async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = ?', [req.user.id]);
        res.json({ message: 'Account deleted.' });
    } catch (err) {
        console.error('[DELETE account]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// vehicles

// GET /api/vehicles
app.get('/api/vehicles', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM vehicles WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        console.error('[GET vehicles]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/vehicles/:id
app.get('/api/vehicles/:id', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM vehicles WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Vehicle not found.' });
        res.json(rows[0]);
    } catch (err) {
        console.error('[GET vehicle]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/vehicles
app.post('/api/vehicles', requireAuth, [
    body('make').trim().notEmpty(),
    body('model').trim().notEmpty(),
    body('year').isInt({ min: 1900, max: 2100 }),
    body('current_mileage').isInt({ min: 0 }),
], async (req, res) => {
    if (validationErrors(req, res)) return;
    const { make, model, year, vin, license_plate, current_mileage, fuel_type, oil_type, oil_change_interval } = req.body;
    try {
        const [result] = await db.query(
            `INSERT INTO vehicles
             (user_id, make, model, year, vin, license_plate, current_mileage, fuel_type, oil_type, oil_change_interval)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, make, model, year, vin || null, license_plate || null,
             current_mileage, fuel_type || null, oil_type || null, oil_change_interval || null]
        );
        res.status(201).json({ id: result.insertId, message: 'Vehicle added.' });
    } catch (err) {
        console.error('[POST vehicle]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/vehicles/:id
app.put('/api/vehicles/:id', requireAuth, [
    body('make').trim().notEmpty(),
    body('model').trim().notEmpty(),
    body('year').isInt({ min: 1900, max: 2100 }),
    body('current_mileage').isInt({ min: 0 }),
], async (req, res) => {
    if (validationErrors(req, res)) return;
    const { make, model, year, vin, license_plate, current_mileage, fuel_type, oil_type, oil_change_interval } = req.body;
    try {
        const [check] = await db.query('SELECT id FROM vehicles WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (!check[0]) return res.status(404).json({ error: 'Vehicle not found.' });

        await db.query(
            `UPDATE vehicles SET make=?, model=?, year=?, vin=?, license_plate=?,
             current_mileage=?, fuel_type=?, oil_type=?, oil_change_interval=?
             WHERE id = ? AND user_id = ?`,
            [make, model, year, vin || null, license_plate || null,
             current_mileage, fuel_type || null, oil_type || null, oil_change_interval || null,
             req.params.id, req.user.id]
        );
        res.json({ message: 'Vehicle updated.' });
    } catch (err) {
        console.error('[PUT vehicle]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/vehicles/:id
app.delete('/api/vehicles/:id', requireAuth, async (req, res) => {
    try {
        const [check] = await db.query('SELECT id FROM vehicles WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (!check[0]) return res.status(404).json({ error: 'Vehicle not found.' });

        await db.query('DELETE FROM vehicles WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Vehicle deleted.' });
    } catch (err) {
        console.error('[DELETE vehicle]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// maintenance logs

// GET /api/maintenance
app.get('/api/maintenance', requireAuth, async (req, res) => {
    try {
        const vehicleId = req.query.vehicle_id;
        let query = 'SELECT * FROM maintenance_records WHERE user_id = ?';
        const params = [req.user.id];
        if (vehicleId) { query += ' AND vehicle_id = ?'; params.push(vehicleId); }
        query += ' ORDER BY service_date DESC';
        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('[GET maintenance]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/maintenance/:id
app.get('/api/maintenance/:id', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM maintenance_records WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Record not found.' });
        res.json(rows[0]);
    } catch (err) {
        console.error('[GET maintenance/:id]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/maintenance
app.post('/api/maintenance', requireAuth, [
    body('vehicle_id').notEmpty(),
    body('service_type').trim().notEmpty(),
    body('service_date').isDate(),
    body('mileage_at_service').isInt({ min: 0 }),
], async (req, res) => {
    if (validationErrors(req, res)) return;
    const { vehicle_id, service_type, service_date, mileage_at_service, notes } = req.body;
    try {
        const [vCheck] = await db.query('SELECT id FROM vehicles WHERE id = ? AND user_id = ?', [vehicle_id, req.user.id]);
        if (!vCheck[0]) return res.status(403).json({ error: 'Vehicle not found.' });

        const [result] = await db.query(
            `INSERT INTO maintenance_records (vehicle_id, user_id, service_type, service_date, mileage_at_service, notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [vehicle_id, req.user.id, service_type, service_date, mileage_at_service, notes || null]
        );
        res.status(201).json({ id: result.insertId, message: 'Record logged.' });
    } catch (err) {
        console.error('[POST maintenance]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/maintenance/:id
app.put('/api/maintenance/:id', requireAuth, [
    body('service_type').trim().notEmpty(),
    body('service_date').isDate(),
    body('mileage_at_service').isInt({ min: 0 }),
], async (req, res) => {
    if (validationErrors(req, res)) return;
    const { service_type, service_date, mileage_at_service, notes } = req.body;
    try {
        const [check] = await db.query(
            'SELECT id FROM maintenance_records WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        if (!check[0]) return res.status(404).json({ error: 'Record not found.' });

        await db.query(
            `UPDATE maintenance_records
             SET service_type=?, service_date=?, mileage_at_service=?, notes=?
             WHERE id = ? AND user_id = ?`,
            [service_type, service_date, mileage_at_service, notes || null, req.params.id, req.user.id]
        );
        res.json({ message: 'Record updated.' });
    } catch (err) {
        console.error('[PUT maintenance]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/maintenance/:id
app.delete('/api/maintenance/:id', requireAuth, async (req, res) => {
    try {
        const [check] = await db.query(
            'SELECT id FROM maintenance_records WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        if (!check[0]) return res.status(404).json({ error: 'Record not found.' });

        await db.query('DELETE FROM maintenance_records WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Record deleted.' });
    } catch (err) {
        console.error('[DELETE maintenance]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// reminders

// GET /api/reminders
app.get('/api/reminders', requireAuth, async (req, res) => {
    try {
        const vehicleId = req.query.vehicle_id;
        let query = 'SELECT * FROM reminders WHERE user_id = ?';
        const params = [req.user.id];
        if (vehicleId) { query += ' AND vehicle_id = ?'; params.push(vehicleId); }
        query += ' ORDER BY created_at DESC';
        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('[GET reminders]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/reminders/:id
app.get('/api/reminders/:id', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM reminders WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Reminder not found.' });
        res.json(rows[0]);
    } catch (err) {
        console.error('[GET reminders/:id]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/reminders
app.post('/api/reminders', requireAuth, [
    body('vehicle_id').notEmpty(),
    body('service_type').trim().notEmpty(),
    body('reminder_mode').isIn(['miles', 'time', 'either']),
    body('last_service_mileage').isInt({ min: 0 }),
    body('last_service_date').isDate(),
], async (req, res) => {
    if (validationErrors(req, res)) return;
    const { vehicle_id, service_type, reminder_mode, interval_miles, interval_months, last_service_mileage, last_service_date } = req.body;
    try {
        const [vCheck] = await db.query('SELECT id FROM vehicles WHERE id = ? AND user_id = ?', [vehicle_id, req.user.id]);
        if (!vCheck[0]) return res.status(403).json({ error: 'Vehicle not found.' });

        const [result] = await db.query(
            `INSERT INTO reminders
             (vehicle_id, user_id, service_type, reminder_mode, interval_miles, interval_months, last_service_mileage, last_service_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [vehicle_id, req.user.id, service_type, reminder_mode,
             interval_miles || null, interval_months || null,
             last_service_mileage, last_service_date]
        );
        res.status(201).json({ id: result.insertId, message: 'Reminder created.' });
    } catch (err) {
        console.error('[POST reminders]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/reminders/:id
app.put('/api/reminders/:id', requireAuth, [
    body('service_type').trim().notEmpty(),
    body('reminder_mode').isIn(['miles', 'time', 'either']),
    body('last_service_mileage').isInt({ min: 0 }),
    body('last_service_date').isDate(),
], async (req, res) => {
    if (validationErrors(req, res)) return;
    const { service_type, reminder_mode, interval_miles, interval_months, last_service_mileage, last_service_date } = req.body;
    try {
        const [check] = await db.query('SELECT id FROM reminders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (!check[0]) return res.status(404).json({ error: 'Reminder not found.' });

        await db.query(
            `UPDATE reminders
             SET service_type=?, reminder_mode=?, interval_miles=?, interval_months=?,
                 last_service_mileage=?, last_service_date=?
             WHERE id = ? AND user_id = ?`,
            [service_type, reminder_mode, interval_miles || null, interval_months || null,
             last_service_mileage, last_service_date, req.params.id, req.user.id]
        );
        res.json({ message: 'Reminder updated.' });
    } catch (err) {
        console.error('[PUT reminders]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/reminders/:id
app.delete('/api/reminders/:id', requireAuth, async (req, res) => {
    try {
        const [check] = await db.query('SELECT id FROM reminders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (!check[0]) return res.status(404).json({ error: 'Reminder not found.' });

        await db.query('DELETE FROM reminders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Reminder deleted.' });
    } catch (err) {
        console.error('[DELETE reminders]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


app.listen(PORT, () => console.log(`TuneUp API running on port ${PORT}`));
