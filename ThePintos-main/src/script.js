const API = 'http://localhost:3000/api';

// token stuff
function getToken() {
    return localStorage.getItem('authToken');
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
    };
}

// skeleton api function
async function apiFetch(path, options = {}) {
    try {
        const res = await fetch(`${API}${path}`, {
            ...options,
            headers: { ...authHeaders(), ...(options.headers || {}) }
        });
        const data = res.headers.get('content-type')?.includes('application/json')
            ? await res.json()
            : {};
        return { ok: res.ok, status: res.status, data };
    } catch {
        return { ok: false, status: 0, data: {} };
    }
}

const page = window.location.pathname.split('/').pop() || 'index.html';

if (!localStorage.getItem('loggedInUser') && page !== 'login.html') {
    window.location.href = 'login.html';
}
if (page === 'login.html') {
    document.querySelectorAll('.other-btn').forEach(btn => btn.classList.add('hidden'));
}

// local storage insurance
function getVehicles()  { return JSON.parse(localStorage.getItem('tuneup_vehicles')  || '[]'); }
function saveVehicles(v){ localStorage.setItem('tuneup_vehicles',  JSON.stringify(v)); }
function getLogs()      { return JSON.parse(localStorage.getItem('tuneup_logs')      || '[]'); }
function saveLogs(l)    { localStorage.setItem('tuneup_logs',      JSON.stringify(l)); }
function getReminders() { return JSON.parse(localStorage.getItem('tuneup_reminders') || '[]'); }
function saveReminders(r){ localStorage.setItem('tuneup_reminders', JSON.stringify(r)); }
function generateId()   { return '_' + Math.random().toString(36).substr(2, 9); }

// sort of class definitions within a function for the API to have the same model as what's being displayed
function apiVehicleToLocal(v) {
    return {
        id:          String(v.id),
        make:        v.make,
        model:       v.model,
        year:        v.year,
        vin:         v.vin         || '',
        plate:       v.license_plate || '',
        mileage:     v.current_mileage,
        fuelType:    v.fuel_type   || '',
        oilType:     v.oil_type    || '',
        oilInterval: v.oil_change_interval || 5000,
    };
}

function localVehicleToApi(v) {
    return {
        make:               v.make,
        model:              v.model,
        year:               Number(v.year),
        vin:                v.vin         || null,
        license_plate:      v.plate       || null,
        current_mileage:    Number(v.mileage),
        fuel_type:          v.fuelType    || null,
        oil_type:           v.oilType     || null,
        oil_change_interval: Number(v.oilInterval) || null,
    };
}

function apiLogToLocal(l) {
    return {
        id:          String(l.id),
        vehicleId:   String(l.vehicle_id),
        serviceType: l.service_type,
        date:        l.service_date,
        mileage:     l.mileage_at_service,
        notes:       l.notes || '',
    };
}

function localLogToApi(l) {
    return {
        vehicle_id:         l.vehicleId,
        service_type:       l.serviceType,
        service_date:       l.date,
        mileage_at_service: Number(l.mileage),
        notes:              l.notes || null,
    };
}

function apiReminderToLocal(r) {
    return {
        id:           String(r.id),
        vehicleId:    String(r.vehicle_id),
        serviceType:  r.service_type,
        reminderMode: r.reminder_mode,
        intervalMiles:  r.interval_miles  || 0,
        intervalMonths: r.interval_months || 0,
        lastMileage:  r.last_service_mileage,
        lastDate:     r.last_service_date,
    };
}

function localReminderToApi(r) {
    return {
        vehicle_id:           r.vehicleId,
        service_type:         r.serviceType,
        reminder_mode:        r.reminderMode,
        interval_miles:       Number(r.intervalMiles)  || null,
        interval_months:      Number(r.intervalMonths) || null,
        last_service_mileage: Number(r.lastMileage),
        last_service_date:    r.lastDate,
    };
}

// sync functions for proper rendering
async function syncVehicles() {
    const { ok, data } = await apiFetch('/vehicles');
    if (ok && Array.isArray(data)) {
        const local = data.map(apiVehicleToLocal);
        saveVehicles(local);
        return local;
    }
    return getVehicles();
}

async function syncLogs() {
    const { ok, data } = await apiFetch('/maintenance');
    if (ok && Array.isArray(data)) {
        const local = data.map(apiLogToLocal);
        saveLogs(local);
        return local;
    }
    return getLogs();
}

async function syncReminders() {
    const { ok, data } = await apiFetch('/reminders');
    if (ok && Array.isArray(data)) {
        const local = data.map(apiReminderToLocal);
        saveReminders(local);
        return local;
    }
    return getReminders();
}

// logging in and registration
const loginSection    = document.getElementById('login-section');
const registerSection = document.getElementById('register-section');
const notifier        = document.getElementById('notifier');
let isLoggedIn        = !!localStorage.getItem('loggedInUser');

if (loginSection && registerSection) {
    // toggle
    document.getElementById('show-register')?.addEventListener('click', e => {
        e.preventDefault();
        loginSection.classList.add('hidden');
        registerSection.classList.remove('hidden');
    });
    document.getElementById('show-login')?.addEventListener('click', e => {
        e.preventDefault();
        registerSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
    });

    // login
    document.getElementById('login-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        const email    = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();
        if (!email || !password) { alert('Please enter both email and password.'); return; }

        const { ok, status, data } = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        if (ok) {
            // if api outputs properly, store token and the loggedinuser state
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('loggedInUser', data.user.email);
            localStorage.setItem('registeredUser', JSON.stringify(data.user));
            isLoggedIn = true;
            if (notifier) notifier.innerText = 'Logged in!';
            setTimeout(() => { window.location.href = 'index.html'; }, 500);
            return;
        }

        if (status === 0) {
            // localstorage incase server does not function
            const savedUser = JSON.parse(localStorage.getItem('registeredUser') || 'null');
            if (savedUser && email === savedUser.email && password === savedUser.password) {
                localStorage.setItem('loggedInUser', email);
                isLoggedIn = true;
                if (notifier) notifier.innerText = 'Logged in (offline)!';
                setTimeout(() => { window.location.href = 'index.html'; }, 500);
            } else {
                alert('Invalid email or password.');
            }
            return;
        }

        alert(data.error || 'Invalid email or password.');
    });

    // registration
    document.getElementById('register-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        const name     = document.getElementById('reg-name').value.trim();
        const email    = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value.trim();
        if (!name || !email || !password) { alert('Please fill in all fields.'); return; }

        const { ok, status, data } = await apiFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        });

        if (ok) {
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('loggedInUser', data.user.email);
            localStorage.setItem('registeredUser', JSON.stringify(data.user));
            alert('Account created successfully!');
            window.location.href = 'index.html';
            return;
        }

        if (status === 0) {
            localStorage.setItem('registeredUser', JSON.stringify({ name, email, password }));
            localStorage.setItem('loggedInUser', email);
            alert('Account created (offline mode)!');
            window.location.href = 'index.html';
            return;
        }

        if (status === 409) { alert('An account with that email already exists.'); return; }
        alert(data.error || 'Registration failed.');
    });

    // forgot password
    const forgotSection = document.getElementById('forgot-section');
    const resetSection  = document.getElementById('reset-section');

    function showOnly(section) {
        [loginSection, registerSection, forgotSection, resetSection].forEach(s => {
            if (s) s.classList.add('hidden');
        });
        if (section) section.classList.remove('hidden');
    }

    document.getElementById('show-forgot')?.addEventListener('click', e => {
        e.preventDefault();
        showOnly(forgotSection);
    });

    document.getElementById('back-to-login')?.addEventListener('click', e => {
        e.preventDefault();
        showOnly(loginSection);
    });

    document.getElementById('back-to-login-2')?.addEventListener('click', e => {
        e.preventDefault();
        showOnly(loginSection);
    });

    document.getElementById('forgot-form')?.addEventListener('submit', async function (e) {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value.trim();
        if (!email) { alert('Please enter your email.'); return; }

        const { ok, data } = await apiFetch('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });

        if (ok && data.token) {
            document.getElementById('reset-token').value = data.token;
            document.getElementById('reset-token-display').textContent =
                'A reset token has been generated. It has been auto-filled below.';
            showOnly(resetSection);
        } else if (ok) {
            alert('If that email is registered, a reset token has been sent.');
            showOnly(loginSection);
        } else {
            alert('Could not reach server. Please try again.');
        }
    });

    document.getElementById('reset-form')?.addEventListener('submit', async function (e) {
        e.preventDefault();
        const token      = document.getElementById('reset-token').value.trim();
        const newPass    = document.getElementById('reset-password').value;
        const confirmPass = document.getElementById('reset-confirm').value;

        if (!token) { alert('Reset token is required.'); return; }
        if (newPass.length < 8) { alert('Password must be at least 8 characters.'); return; }
        if (newPass !== confirmPass) { alert('Passwords do not match.'); return; }

        const { ok, status, data } = await apiFetch('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, newPassword: newPass })
        });

        if (ok) {
            alert('Password has been reset! You can now log in with your new password.');
            showOnly(loginSection);
        } else if (status === 400) {
            alert(data.error || 'Invalid or expired reset token.');
        } else {
            alert('Could not reach server. Please try again.');
        }
    });
}

// alert logic local
function getVehicleAlerts(vehicleId) {
    const vehicle = getVehicles().find(v => v.id === vehicleId);
    if (!vehicle) return [];
    const today = new Date();

    return getReminders().filter(r => r.vehicleId === vehicleId).reduce((alerts, r) => {
        const mode      = r.reminderMode || 'either';
        const usesMiles  = (mode === 'miles'  || mode === 'either') && Number(r.intervalMiles)  > 0;
        const usesMonths = (mode === 'time'   || mode === 'either') && Number(r.intervalMonths) > 0;

        const milesLeft = usesMiles
            ? Number(r.intervalMiles) - (Number(vehicle.mileage) - Number(r.lastMileage))
            : null;

        const lastDate = new Date(r.lastDate);
        const monthsPassed = (today.getFullYear() - lastDate.getFullYear()) * 12
            + (today.getMonth() - lastDate.getMonth());
        const monthsLeft = usesMonths ? Number(r.intervalMonths) - monthsPassed : null;

        let overdue = false, dueSoon = false;
        if (mode === 'miles') {
            overdue  = usesMiles && milesLeft <= 0;
            dueSoon  = !overdue && usesMiles && milesLeft <= 5000;
        } else if (mode === 'time') {
            overdue  = usesMonths && monthsLeft <= 0;
            dueSoon  = !overdue && usesMonths && monthsLeft <= 6;
        } else {
            overdue  = (usesMiles && milesLeft <= 0) || (usesMonths && monthsLeft <= 0);
            dueSoon  = !overdue && ((usesMiles && milesLeft <= 5000) || (usesMonths && monthsLeft <= 6));
        }

        if (overdue) alerts.push({ type: 'overdue', service: r.serviceType, milesLeft, monthsLeft });
        else if (dueSoon) alerts.push({ type: 'soon',    service: r.serviceType, milesLeft, monthsLeft });
        return alerts;
    }, []);
}

// vehicle select population
function populateVehicleSelects() {
    const vehicles = getVehicles();
    document.querySelectorAll('.vehicle-select').forEach(sel => {
        const cur = sel.value;
        sel.innerHTML = '<option value="">Choose a Vehicle</option>';
        vehicles.forEach(v => {
            const o = document.createElement('option');
            o.value = v.id;
            o.textContent = `${v.year} ${v.make} ${v.model}`;
            sel.appendChild(o);
        });
        if (cur) sel.value = cur;
    });
}

// garage
async function initGarage() {
    const vehicleGrid = document.getElementById('vehicle-grid');
    const modal       = document.getElementById('vehicle-modal');
    const modalTitle  = document.getElementById('modal-title');
    const vehicleForm = document.getElementById('vehicle-form');
    if (!vehicleGrid) return;

    // pull data and sync
    await syncVehicles();
    await syncReminders();

    function renderGarage() {
        const vehicles = getVehicles();
        vehicleGrid.innerHTML = '';
        if (vehicles.length === 0) {
            vehicleGrid.innerHTML = '<p>No vehicles added yet. Click <strong>+ Add New Vehicle</strong> to get started.</p>';
            return;
        }
        vehicles.forEach(v => {
            const alerts = getVehicleAlerts(v.id);
            let statusHtml = '<span style="color:#28a745;font-weight:bold;">&#10003; Up to Date</span>';
            if (alerts.some(a => a.type === 'overdue')) {
                statusHtml = `<span style="color:#dc3545;font-weight:bold;">&#9888; ${alerts.find(a => a.type === 'overdue').service} Overdue</span>`;
            } else if (alerts.some(a => a.type === 'soon')) {
                statusHtml = `<span style="color:#fd7e14;font-weight:bold;">&#9889; ${alerts.find(a => a.type === 'soon').service} Due Soon</span>`;
            }
            const card = document.createElement('div');
            card.className = 'vehicle-card';
            card.innerHTML = `
                <div class="vehicle-icon">&#128663;</div>
                <h3>${v.year} ${v.make} ${v.model}</h3>
                <ul class="vehicle-stats">
                    <li><strong>VIN:</strong> ${v.vin || '&mdash;'}</li>
                    <li><strong>License Plate:</strong> ${v.plate || '&mdash;'}</li>
                    <li><strong>Current Mileage:</strong> ${Number(v.mileage).toLocaleString()}</li>
                    <li><strong>Fuel Type:</strong> ${v.fuelType || '&mdash;'}</li>
                    <li><strong>Oil Type:</strong> ${v.oilType || '&mdash;'}</li>
                    <li><strong>Status:</strong> ${statusHtml}</li>
                </ul>
                <div class="card-actions">
                    <a href="log.html?vehicle=${v.id}" class="btn">Log Service</a>
                    <button class="btn btn-secondary edit-btn"   data-id="${v.id}">Edit</button>
                    <button class="btn btn-danger   delete-btn"  data-id="${v.id}">Delete</button>
                </div>`;
            vehicleGrid.appendChild(card);
        });

        vehicleGrid.querySelectorAll('.edit-btn').forEach(btn =>
            btn.addEventListener('click', () => openModal(btn.dataset.id)));

        vehicleGrid.querySelectorAll('.delete-btn').forEach(btn =>
            btn.addEventListener('click', () => deleteVehicle(btn.dataset.id)));
    }

    async function deleteVehicle(id) {
        if (!confirm('Delete this vehicle and all its records?')) return;

        const { ok, status } = await apiFetch(`/vehicles/${id}`, { method: 'DELETE' });
        if (ok || status === 0) {
            // remove from cache
            saveVehicles(getVehicles().filter(v => v.id !== id));
            saveLogs(getLogs().filter(l => l.vehicleId !== id));
            saveReminders(getReminders().filter(r => r.vehicleId !== id));
            renderGarage();
        } else {
            alert('Could not delete vehicle. Please try again.');
        }
    }

    function openModal(vehicleId = null) {
        vehicleForm.reset();
        vehicleForm.dataset.editId = vehicleId || '';
        if (modalTitle) modalTitle.textContent = vehicleId ? 'Edit Vehicle' : 'Add New Vehicle';
        if (vehicleId) {
            const v = getVehicles().find(v => v.id === vehicleId);
            if (v) {
                ['year','make','model','vin','plate','mileage'].forEach(f => {
                    const el = document.getElementById(`v-${f}`); if (el) el.value = v[f] || '';
                });
                const fuel = document.getElementById('v-fuel');         if (fuel) fuel.value = v.fuelType   || '';
                const oilT = document.getElementById('v-oil-type');     if (oilT) oilT.value = v.oilType    || '';
                const oilI = document.getElementById('v-oil-interval'); if (oilI) oilI.value = v.oilInterval|| '';
            }
        }
        modal.classList.remove('hidden');
    }

    document.getElementById('add-vehicle-btn')?.addEventListener('click', () => openModal());
    document.getElementById('modal-cancel')?.addEventListener('click', () => modal.classList.add('hidden'));
    modal?.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

    vehicleForm?.addEventListener('submit', async function (e) {
        e.preventDefault();
        const editId = this.dataset.editId;
        const data = {
            year:        document.getElementById('v-year').value,
            make:        document.getElementById('v-make').value,
            model:       document.getElementById('v-model').value,
            vin:         document.getElementById('v-vin').value,
            plate:       document.getElementById('v-plate').value,
            mileage:     parseInt(document.getElementById('v-mileage').value),
            fuelType:    document.getElementById('v-fuel').value,
            oilType:     document.getElementById('v-oil-type').value,
            oilInterval: parseInt(document.getElementById('v-oil-interval').value) || 5000,
        };

        if (editId) {
            // edit
            const { ok, status, res: apiRes } = await apiFetch(`/vehicles/${editId}`, {
                method: 'PUT',
                body: JSON.stringify(localVehicleToApi(data))
            });
            const vehicles = getVehicles();
            const i = vehicles.findIndex(v => v.id === editId);
            if (ok) {
                if (i > -1) vehicles[i] = { ...vehicles[i], ...data };
            } else if (status === 0 && i > -1) {
                vehicles[i] = { ...vehicles[i], ...data };
            } else {
                alert('Could not update vehicle.'); return;
            }
            saveVehicles(vehicles);
        } else {
            // create
            const { ok, status, data: resData } = await apiFetch('/vehicles', {
                method: 'POST',
                body: JSON.stringify(localVehicleToApi(data))
            });

            let newId;
            if (ok) {
                newId = String(resData.id);
            } else if (status === 0) {
                newId = generateId(); // offline fallback
            } else {
                alert('Could not add vehicle.'); return;
            }

            const vehicles = getVehicles();
            data.id = newId;
            vehicles.push(data);
            saveVehicles(vehicles);

            // autogenerates oil change reminder
            if (data.oilInterval && Number(data.oilInterval) > 0) {
                const reminderData = {
                    id:           generateId(),
                    vehicleId:    newId,
                    serviceType:  'Oil Change',
                    reminderMode: 'miles',
                    intervalMiles:  Number(data.oilInterval),
                    intervalMonths: 0,
                    lastMileage:  Number(data.mileage) || 0,
                    lastDate:     new Date().toISOString().split('T')[0]
                };
                await apiFetch('/reminders', {
                    method: 'POST',
                    body: JSON.stringify(localReminderToApi(reminderData))
                });
                const reminders = getReminders();
                reminders.push(reminderData);
                saveReminders(reminders);
            }
        }

        modal.classList.add('hidden');
        renderGarage();
    });

    renderGarage();
}

// maintenance log
async function initLog() {
    const maintenanceForm = document.getElementById('maintenance-form');
    const serviceList     = document.getElementById('service-list');
    if (!maintenanceForm || !serviceList) return;

    await syncVehicles();
    await syncLogs();
    populateVehicleSelects();

    const preselect = new URLSearchParams(window.location.search).get('vehicle');
    if (preselect) { const s = document.getElementById('vehicle'); if (s) s.value = preselect; }

    function renderLogs() {
        const logs     = getLogs();
        const vehicles = getVehicles();
        const fV = document.getElementById('filter-vehicle')?.value || '';
        const fT = document.getElementById('filter-type')?.value    || '';
        const filtered = logs
            .filter(l => (!fV || l.vehicleId === fV) && (!fT || l.serviceType === fT))
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        serviceList.innerHTML = '';
        if (filtered.length === 0) {
            serviceList.innerHTML = '<li style="color:#666;padding:10px;">No service records found.</li>';
            return;
        }
        filtered.forEach(log => {
            const v  = vehicles.find(v => v.id === log.vehicleId);
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="log-entry-row">
                    <div>
                        <strong>${log.date}</strong> | <strong>${v ? `${v.year} ${v.make} ${v.model}` : 'Unknown'}</strong><br>
                        Service: ${log.serviceType}<br>
                        Mileage: ${Number(log.mileage).toLocaleString()} miles
                        ${log.notes ? `<br><em>Notes: ${log.notes}</em>` : ''}
                    </div>
                    <div class="log-entry-actions">
                        <button class="btn btn-secondary edit-log-btn"   data-id="${log.id}">Edit</button>
                        <button class="btn btn-danger   delete-log-btn"  data-id="${log.id}">Delete</button>
                    </div>
                </div>`;
            serviceList.appendChild(li);
        });

        serviceList.querySelectorAll('.delete-log-btn').forEach(btn =>
            btn.addEventListener('click', () => deleteLog(btn.dataset.id)));

        serviceList.querySelectorAll('.edit-log-btn').forEach(btn =>
            btn.addEventListener('click', () => {
                const log = getLogs().find(l => l.id === btn.dataset.id);
                if (!log) return;
                document.getElementById('vehicle').value      = log.vehicleId;
                document.getElementById('date').value         = log.date;
                document.getElementById('service-type').value = log.serviceType;
                document.getElementById('mileage').value      = log.mileage;
                document.getElementById('notes').value        = log.notes || '';
                maintenanceForm.dataset.editId = log.id;
                const sb = maintenanceForm.querySelector('button[type="submit"]');
                if (sb) sb.textContent = 'Update Record';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }));
    }

    async function deleteLog(id) {
        if (!confirm('Delete this service record?')) return;
        const { ok, status } = await apiFetch(`/maintenance/${id}`, { method: 'DELETE' });
        if (ok || status === 0) {
            saveLogs(getLogs().filter(l => l.id !== id));
            renderLogs();
        } else {
            alert('Could not delete record. Please try again.');
        }
    }

    document.getElementById('filter-vehicle')?.addEventListener('change', renderLogs);
    document.getElementById('filter-type')?.addEventListener('change', renderLogs);

    const defaultReminderSettings = {
        'Oil Change':            { reminderMode: 'miles',  intervalMiles: 5000,  intervalMonths: 0  },
        'Tire Rotation':         { reminderMode: 'miles',  intervalMiles: 6000,  intervalMonths: 0  },
        'Tire Replacement':      { reminderMode: 'miles',  intervalMiles: 50000, intervalMonths: 0  },
        'Brake Pad Replacement': { reminderMode: 'miles',  intervalMiles: 30000, intervalMonths: 0  },
        'Brake Inspection':      { reminderMode: 'either', intervalMiles: 12000, intervalMonths: 12 },
        'Fluid Check':           { reminderMode: 'either', intervalMiles: 5000,  intervalMonths: 6  },
        'State Inspection':      { reminderMode: 'time',   intervalMiles: 0,     intervalMonths: 12 },
        'Air Filter':            { reminderMode: 'miles',  intervalMiles: 15000, intervalMonths: 0  },
        'Battery Replacement':   { reminderMode: 'time',   intervalMiles: 0,     intervalMonths: 36 },
        'Transmission Service':  { reminderMode: 'miles',  intervalMiles: 30000, intervalMonths: 0  },
        'Coolant Flush':         { reminderMode: 'time',   intervalMiles: 0,     intervalMonths: 24 },
        'Other':                 { reminderMode: 'either', intervalMiles: 5000,  intervalMonths: 6  },
    };

    maintenanceForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const vehicleId   = document.getElementById('vehicle').value;
        const date        = document.getElementById('date').value;
        const serviceType = document.getElementById('service-type').value;
        const mileage     = parseInt(document.getElementById('mileage').value);
        const notes       = document.getElementById('notes').value;
        if (!vehicleId || !date || !serviceType || !mileage) {
            alert('Please fill in all required fields.'); return;
        }

        const editId = this.dataset.editId;
        const logPayload = { vehicleId, date, serviceType, mileage, notes };

        if (editId) {
            // edit log
            const { ok, status } = await apiFetch(`/maintenance/${editId}`, {
                method: 'PUT',
                body: JSON.stringify(localLogToApi(logPayload))
            });
            let logs = getLogs();
            const i  = logs.findIndex(l => l.id === editId);
            if (ok || status === 0) {
                if (i > -1) logs[i] = { ...logs[i], ...logPayload };
            } else { alert('Could not update record.'); return; }
            saveLogs(logs);
            delete this.dataset.editId;
            const sb = this.querySelector('button[type="submit"]'); if (sb) sb.textContent = 'Log Service';
        } else {
            // new log
            const { ok, status, data: resData } = await apiFetch('/maintenance', {
                method: 'POST',
                body: JSON.stringify(localLogToApi(logPayload))
            });
            let newId;
            if (ok)          newId = String(resData.id);
            else if (status === 0) newId = generateId();
            else { alert('Could not log service.'); return; }

            const logs = getLogs();
            logs.push({ id: newId, ...logPayload });
            saveLogs(logs);
        }

        // update vehicle mileage if newer
        const vehicles = getVehicles();
        const vi = vehicles.findIndex(v => v.id === vehicleId);
        if (vi > -1 && mileage > vehicles[vi].mileage) {
            vehicles[vi].mileage = mileage;
            saveVehicles(vehicles);
            await apiFetch(`/vehicles/${vehicleId}`, {
                method: 'PUT',
                body: JSON.stringify(localVehicleToApi(vehicles[vi]))
            });
        }

        // update or auto-create reminder
        const reminders = getReminders();
        const ri = reminders.findIndex(r => r.vehicleId === vehicleId && r.serviceType === serviceType);
        if (ri > -1) {
            reminders[ri].lastMileage = mileage;
            reminders[ri].lastDate    = date;
            await apiFetch(`/reminders/${reminders[ri].id}`, {
                method: 'PUT',
                body: JSON.stringify(localReminderToApi(reminders[ri]))
            });
            saveReminders(reminders);
        } else {
            const defaults = defaultReminderSettings[serviceType] || defaultReminderSettings['Other'];
            const newReminder = {
                id: generateId(), vehicleId, serviceType,
                reminderMode:   defaults.reminderMode,
                intervalMiles:  defaults.intervalMiles,
                intervalMonths: defaults.intervalMonths,
                lastMileage: mileage, lastDate: date
            };
            const { ok, data: rd } = await apiFetch('/reminders', {
                method: 'POST',
                body: JSON.stringify(localReminderToApi(newReminder))
            });
            if (ok) newReminder.id = String(rd.id);
            reminders.push(newReminder);
            saveReminders(reminders);
        }

        this.reset();
        renderLogs();
        alert('Service logged successfully!');
    });

    renderLogs();
}

// dashboard
async function initDashboard() {
    // sync upon load so its consistent with the server
    await syncVehicles();
    await syncLogs();
    await syncReminders();

    const reminderCard = document.getElementById('reminderCard');
    const recent       = document.getElementById('recentActivity');
    const garageCard   = document.getElementById('garageCard');

    // alerts
    if (reminderCard) {
        const vehicles     = getVehicles();
        const overdueAlerts = [];
        const soonAlerts    = [];

        vehicles.forEach(v => {
            getVehicleAlerts(v.id).forEach(r => {
                const entry = { vehicle: v, service: r.service, milesLeft: r.milesLeft, monthsLeft: r.monthsLeft, type: r.type };
                if (r.type === 'overdue') overdueAlerts.push(entry);
                else if (r.type === 'soon') soonAlerts.push(entry);
            });
        });

        function makeAlertText(alert) {
            if (alert.type === 'overdue') {
                if (alert.milesLeft !== null && alert.milesLeft <= 0)
                    return 'Overdue by ' + Math.abs(alert.milesLeft) + ' miles';
                if (alert.monthsLeft !== null && alert.monthsLeft <= 0)
                    return 'Overdue by ' + Math.abs(alert.monthsLeft) + ' month' + (Math.abs(alert.monthsLeft) !== 1 ? 's' : '');
                return 'Overdue';
            }
            const parts = [];
            if (alert.milesLeft  !== null && alert.milesLeft  > 0) parts.push(alert.milesLeft + ' miles left');
            if (alert.monthsLeft !== null && alert.monthsLeft > 0) parts.push(alert.monthsLeft + ' month' + (alert.monthsLeft !== 1 ? 's' : '') + ' left');
            return parts.length ? parts.join(' • ') : 'Coming up soon';
        }

        reminderCard.innerHTML = '';

        const overdueHeader = document.createElement('li');
        overdueHeader.innerHTML = '<strong style="color:#dc3545;">Overdue</strong>';
        reminderCard.appendChild(overdueHeader);
        if (overdueAlerts.length === 0) {
            reminderCard.innerHTML += '<li>No overdue services.</li>';
        } else {
            overdueAlerts.forEach(a => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${a.service}</strong> for <strong>${a.vehicle ? `${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}` : 'Unknown'}</strong><br>${makeAlertText(a)}`;
                reminderCard.appendChild(li);
            });
        }

        const soonHeader = document.createElement('li');
        soonHeader.innerHTML = '<strong style="color:#fd7e14;">Coming Up</strong>';
        reminderCard.appendChild(soonHeader);
        if (soonAlerts.length === 0) {
            reminderCard.innerHTML += '<li>Nothing coming up right now.</li>';
        } else {
            soonAlerts.forEach(a => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${a.service}</strong> for <strong>${a.vehicle ? `${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}` : 'Unknown'}</strong><br>${makeAlertText(a)}`;
                reminderCard.appendChild(li);
            });
        }
    }

    
    if (recent) {
        const logs     = getLogs().sort((a, b) => new Date(b.date) - new Date(a.date));
        const vehicles = getVehicles();
        recent.innerHTML = '';
        if (logs.length > 0) {
            logs.slice(0, 5).forEach(log => {
                const v  = vehicles.find(v => v.id === log.vehicleId);
                const li = document.createElement('li');
                li.innerHTML = `<strong>${log.serviceType}</strong> for <strong>${v ? `${v.year} ${v.make} ${v.model}` : 'Unknown'}</strong> on ${log.date}`;
                recent.appendChild(li);
            });
        } else {
            recent.innerHTML = '<li>No recent activity.</li>';
        }
    }

    // garage glance
    if (garageCard) {
        const vehicles = getVehicles();
        garageCard.innerHTML = vehicles.length > 0
            ? `<p><strong>${vehicles.length}</strong> vehicle${vehicles.length > 1 ? 's' : ''} in your garage</p>`
            : '<p>Your garage is empty. Add a vehicle to get started!</p>';
    }
}

// reminder rendering and api calls
async function initReminders() {
    const reminderForm = document.getElementById('reminder-form');
    const reminderList = document.getElementById('reminder-list');
    if (!reminderForm || !reminderList) return;

    await syncVehicles();
    await syncReminders();
    populateVehicleSelects();

    const vehicleSelect  = document.getElementById('vehicle');
    const vehicleInfoBox = document.getElementById('reminder-vehicle-info');
    const vehicleDetails = document.getElementById('reminder-vehicle-details');
    const logPreview     = document.getElementById('reminder-log-preview');

    function renderReminderReference(vehicleId) {
        const vehicle = getVehicles().find(v => v.id === vehicleId);
        const logs    = getLogs()
            .filter(l => l.vehicleId === vehicleId)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        if (!vehicle) { vehicleInfoBox.style.display = 'none'; return; }
        vehicleInfoBox.style.display = 'block';
        vehicleDetails.innerHTML = `
            <p><strong>Vehicle:</strong> ${vehicle.year} ${vehicle.make} ${vehicle.model}</p>
            <p><strong>Current Mileage:</strong> ${Number(vehicle.mileage).toLocaleString()}</p>
            <p><strong>VIN:</strong> ${vehicle.vin || '&mdash;'}</p>
            <p><strong>Oil Interval:</strong> ${vehicle.oilInterval ? Number(vehicle.oilInterval).toLocaleString() + ' miles' : '&mdash;'}</p>`;
        logPreview.innerHTML = logs.length === 0
            ? '<li>No service logs for this vehicle yet.</li>'
            : logs.map(l => `<li><strong>${l.date}</strong> - ${l.serviceType}<br>Mileage: ${Number(l.mileage).toLocaleString()}${l.notes ? `<br><em>${l.notes}</em>` : ''}</li>`).join('');
    }

    vehicleSelect?.addEventListener('change', function () { renderReminderReference(this.value); });
    document.getElementById('filter-vehicle')?.addEventListener('change', renderReminders);
    document.getElementById('filter-type')?.addEventListener('change',    renderReminders);

    function resetReminderForm() {
        reminderForm.reset();
        delete reminderForm.dataset.editId;
        const sb = reminderForm.querySelector('button[type="submit"]');
        if (sb) sb.textContent = 'Create Reminder';
        vehicleInfoBox.style.display = 'none';
        vehicleDetails.innerHTML = '';
        logPreview.innerHTML     = '';
        populateVehicleSelects();
    }

    function renderReminders() {
        const reminders     = getReminders();
        const vehicles      = getVehicles();
        const filterVehicle = document.getElementById('filter-vehicle')?.value || '';
        const filterType    = document.getElementById('filter-type')?.value    || '';

        const filtered = reminders.filter(r =>
            (!filterVehicle || r.vehicleId === filterVehicle) &&
            (!filterType    || r.serviceType === filterType));

        reminderList.innerHTML = '';
        if (filtered.length === 0) {
            reminderList.innerHTML = '<li style="color:#666;padding:10px;">No reminders match this filter.</li>';
            return;
        }

        filtered.forEach(r => {
            const v  = vehicles.find(v => v.id === r.vehicleId);
            const li = document.createElement('li');
            li.innerHTML = `
                <strong>${r.serviceType}</strong> for
                <strong>${v ? `${v.year} ${v.make} ${v.model}` : 'Unknown Vehicle'}</strong><br>
                Reminder Type: ${r.reminderMode === 'miles' ? 'Mileage only' : r.reminderMode === 'time' ? 'Time only' : 'Whichever comes first'}<br>
                Mileage Interval: ${r.intervalMiles ? r.intervalMiles.toLocaleString() + ' miles' : 'Not set'}<br>
                Time Interval: ${r.intervalMonths ? r.intervalMonths + ' month' + (r.intervalMonths !== 1 ? 's' : '') : 'Not set'}<br>
                Last Service Mileage: ${Number(r.lastMileage).toLocaleString()}<br>
                Last Service Date: ${r.lastDate}
                <div class="reminder-actions">
                    <button class="btn btn-secondary edit-reminder"   data-id="${r.id}">Edit</button>
                    <button class="btn btn-danger   delete-reminder"  data-id="${r.id}">Delete</button>
                </div>`;
            reminderList.appendChild(li);
        });

        document.querySelectorAll('.delete-reminder').forEach(btn =>
            btn.addEventListener('click', () => deleteReminder(btn.dataset.id)));

        document.querySelectorAll('.edit-reminder').forEach(btn =>
            btn.addEventListener('click', () => {
                const r = getReminders().find(r => r.id === btn.dataset.id);
                if (!r) return;
                document.getElementById('vehicle').value           = r.vehicleId;
                document.getElementById('reminder-service').value  = r.serviceType;
                document.getElementById('reminder-mode').value     = r.reminderMode || 'either';
                document.getElementById('interval-miles').value    = r.intervalMiles  || '';
                document.getElementById('interval-months').value   = r.intervalMonths || '';
                document.getElementById('last-mileage').value      = r.lastMileage;
                document.getElementById('last-date').value         = r.lastDate;
                reminderForm.dataset.editId = r.id;
                const sb = reminderForm.querySelector('button[type="submit"]');
                if (sb) sb.textContent = 'Update Reminder';
                renderReminderReference(r.vehicleId);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }));
    }

    async function deleteReminder(id) {
        if (!confirm('Delete this reminder?')) return;
        const { ok, status } = await apiFetch(`/reminders/${id}`, { method: 'DELETE' });
        if (ok || status === 0) {
            saveReminders(getReminders().filter(r => r.id !== id));
            renderReminders();
        } else {
            alert('Could not delete reminder. Please try again.');
        }
    }

    reminderForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const vehicleId     = document.getElementById('vehicle').value;
        const serviceType   = document.getElementById('reminder-service').value;
        const reminderMode  = document.getElementById('reminder-mode').value;
        const intervalMiles = parseInt(document.getElementById('interval-miles').value)  || 0;
        const intervalMonths= parseInt(document.getElementById('interval-months').value) || 0;
        const lastMileage   = parseInt(document.getElementById('last-mileage').value);
        const lastDate      = document.getElementById('last-date').value;

        if (!vehicleId || !serviceType || !lastDate || isNaN(lastMileage)) {
            alert('Please fill in all required fields.'); return;
        }
        if (reminderMode === 'miles'  && intervalMiles === 0)  { alert('Enter a mileage interval.'); return; }
        if (reminderMode === 'time'   && intervalMonths === 0) { alert('Enter a month interval.');   return; }
        if (reminderMode === 'either' && intervalMiles === 0 && intervalMonths === 0) {
            alert('Enter at least one interval.'); return;
        }

        const payload = { vehicleId, serviceType, reminderMode, intervalMiles, intervalMonths, lastMileage, lastDate };
        const editId  = reminderForm.dataset.editId;

        if (editId) {
            const { ok, status } = await apiFetch(`/reminders/${editId}`, {
                method: 'PUT',
                body: JSON.stringify(localReminderToApi(payload))
            });
            const reminders = getReminders();
            const i = reminders.findIndex(r => r.id === editId);
            if ((ok || status === 0) && i > -1) {
                reminders[i] = { ...reminders[i], ...payload };
                saveReminders(reminders);
            } else if (!ok) { alert('Could not update reminder.'); return; }
        } else {
            const { ok, status, data: rd } = await apiFetch('/reminders', {
                method: 'POST',
                body: JSON.stringify(localReminderToApi(payload))
            });
            let newId;
            if (ok)          newId = String(rd.id);
            else if (status === 0) newId = generateId();
            else { alert('Could not save reminder.'); return; }

            const reminders = getReminders();
            reminders.push({ id: newId, ...payload });
            saveReminders(reminders);
        }

        resetReminderForm();
        renderReminders();
        alert(editId ? 'Reminder updated successfully!' : 'Reminder saved successfully!');
    });

    renderReminders();
}


// login/logout toggle
function logoutUser() {
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('authToken');
    window.location.href = 'login.html';
}

function authBtnChange() {
    const btn = document.getElementById('auth-btn');
    if (!btn) return;
    if (isLoggedIn) {
        btn.innerText = 'Logout';
        btn.onclick   = logoutUser;
    } else {
        btn.innerText = 'Login';
        btn.onclick   = () => window.location.href = 'login.html';
    }
}

// page routing logic for rendering
if      (page === 'garage.html')    { initGarage();    authBtnChange(); }
else if (page === 'log.html')       { initLog();        authBtnChange(); }
else if (page === 'index.html')     { initDashboard(); authBtnChange(); }
else if (page === 'reminders.html') { initReminders();  authBtnChange(); }