// people can't access pages without logging in first.
if (!localStorage.getItem('loggedInUser') && window.location.pathname.split('/').pop() !== 'login.html') {
    window.location.href = 'login.html';
}
if (window.location.pathname.split('/').pop() === "login.html") {
    document.querySelectorAll(".other-btn").forEach(btn => {
        btn.classList.add("hidden");
    });
}
// Authentication Toggle Logic
const loginSection = document.getElementById('login-section');
const registerSection = document.getElementById('register-section');
const showRegisterBtn = document.getElementById('show-register');
const showLoginBtn = document.getElementById('show-login');
let isLoggedIn = !!localStorage.getItem('loggedInUser');
const notifier = document.getElementById('notifier');

// check page before running logic
if (loginSection && registerSection) {
    // Switch to register view
    showRegisterBtn.addEventListener('click', function (event) {
        event.preventDefault();
        loginSection.classList.add('hidden');
        registerSection.classList.remove('hidden');
    });

    // Switch to login view
    showLoginBtn.addEventListener('click', function (event) {
        event.preventDefault();
        registerSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
    });

    // logging in
    document.getElementById('login-form').addEventListener('submit', function (event) {
        event.preventDefault();

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();

        if (!email || !password) {
            alert("Please enter both email and password.");
            return;
        }

        const savedUser = JSON.parse(localStorage.getItem('registeredUser'));

        if (savedUser) {
            if (email === savedUser.email && password === savedUser.password) {
                localStorage.setItem('loggedInUser', email);
                isLoggedIn = true;
                notifier.innerText = "Logged in!"
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 500)
            } else {
                alert("Invalid email or password.");
            }
        } else {

            localStorage.setItem('loggedInUser', email);
            isLoggedIn = true;
            notifier.innerText = "Logged in!"
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 500)
        }
    });

    // registering the user
    document.getElementById('register-form').addEventListener('submit', function (event) {
        event.preventDefault();

        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value.trim();

        if (!name || !email || !password) {
            alert("Please fill in all fields.");
            return;
        }

        const user = {
            name: name,
            email: email,
            password: password
        };

        localStorage.setItem('registeredUser', JSON.stringify(user));
        localStorage.setItem('loggedInUser', email);

        alert("Account created successfully!");
        window.location.href = 'index.html';
    });
}

// alert logic

function getVehicleAlerts(vehicleId) {
    const vehicle = getVehicles().find(v => v.id === vehicleId);
    if (!vehicle) return [];

    const today = new Date();

    return getReminders().filter(r => r.vehicleId === vehicleId).reduce((alerts, r) => {
        const mode = r.reminderMode || 'either';

        const usesMiles = (mode === 'miles' || mode === 'either') && Number(r.intervalMiles) > 0;
        const usesMonths = (mode === 'time' || mode === 'either') && Number(r.intervalMonths) > 0;

        const milesLeft = usesMiles
            ? Number(r.intervalMiles) - (Number(vehicle.mileage) - Number(r.lastMileage))
            : null;

        const lastDate = new Date(r.lastDate);
        const monthsPassed =
            (today.getFullYear() - lastDate.getFullYear()) * 12 +
            (today.getMonth() - lastDate.getMonth());

        const monthsLeft = usesMonths
            ? Number(r.intervalMonths) - monthsPassed
            : null;

        let overdue = false;
        let dueSoon = false;

        if (mode === 'miles') {
            overdue = usesMiles && milesLeft <= 0;
            dueSoon = !overdue && usesMiles && milesLeft <= 5000;
        } else if (mode === 'time') {
            overdue = usesMonths && monthsLeft <= 0;
            dueSoon = !overdue && usesMonths && monthsLeft <= 6;
        } else {
            overdue =
                (usesMiles && milesLeft <= 0) ||
                (usesMonths && monthsLeft <= 0);

            dueSoon =
                !overdue && (
                    (usesMiles && milesLeft <= 5000) ||
                    (usesMonths && monthsLeft <= 6)
                );
        }

        if (overdue) {
            alerts.push({
                type: 'overdue',
                service: r.serviceType,
                milesLeft,
                monthsLeft
            });
        } else if (dueSoon) {
            alerts.push({
                type: 'soon',
                service: r.serviceType,
                milesLeft,
                monthsLeft
            });
        }

        return alerts;
    }, []);
}

// garage logics

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

function getVehicles() {
    return JSON.parse(localStorage.getItem('tuneup_vehicles') || '[]');
}
function saveVehicles(v) {
    localStorage.setItem('tuneup_vehicles', JSON.stringify(v));
}
function getLogs() {
    return JSON.parse(localStorage.getItem('tuneup_logs') || '[]');
}
function saveLogs(l) {
    localStorage.setItem('tuneup_logs', JSON.stringify(l));
}
function getReminders() {
    return JSON.parse(localStorage.getItem('tuneup_reminders') || '[]');
}
function saveReminders(r) {
    localStorage.setItem('tuneup_reminders', JSON.stringify(r));
}
function generateId() {
    return '_' + Math.random().toString(36).substr(2, 9);
}

function initGarage() {
    const vehicleGrid = document.getElementById('vehicle-grid');
    const modal = document.getElementById('vehicle-modal');
    const modalTitle = document.getElementById('modal-title');
    const vehicleForm = document.getElementById('vehicle-form');
    if (!vehicleGrid) return;

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
                    <button class="btn btn-secondary edit-btn" data-id="${v.id}">Edit</button>
                    <button class="btn btn-danger delete-btn" data-id="${v.id}">Delete</button>
                </div>`;
            vehicleGrid.appendChild(card);
        });
        vehicleGrid.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => openModal(btn.dataset.id)));
        vehicleGrid.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => {
            if (confirm('Delete this vehicle and all its records?')) {
                saveVehicles(getVehicles().filter(v => v.id !== btn.dataset.id));
                saveLogs(getLogs().filter(l => l.vehicleId !== btn.dataset.id));
                saveReminders(getReminders().filter(r => r.vehicleId !== btn.dataset.id));
                renderGarage();
            }
        }));
    }

    function openModal(vehicleId = null) {
        vehicleForm.reset();
        vehicleForm.dataset.editId = vehicleId || '';
        if (modalTitle) modalTitle.textContent = vehicleId ? 'Edit Vehicle' : 'Add New Vehicle';
        if (vehicleId) {
            const v = getVehicles().find(v => v.id === vehicleId);
            if (v) {
                ['year', 'make', 'model', 'vin', 'plate', 'mileage'].forEach(f => { const el = document.getElementById(`v-${f}`); if (el) el.value = v[f] || ''; });
                const fuel = document.getElementById('v-fuel'); if (fuel) fuel.value = v.fuelType || '';
                const oilT = document.getElementById('v-oil-type'); if (oilT) oilT.value = v.oilType || '';
                const oilI = document.getElementById('v-oil-interval'); if (oilI) oilI.value = v.oilInterval || '';
            }
        }
        modal.classList.remove('hidden');
    }

    document.getElementById('add-vehicle-btn')?.addEventListener('click', () => openModal());
    document.getElementById('modal-cancel')?.addEventListener('click', () => modal.classList.add('hidden'));
    modal?.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

    vehicleForm?.addEventListener('submit', function (e) {
        e.preventDefault();
        const vehicles = getVehicles();
        const editId = this.dataset.editId;
        const data = {
            year: document.getElementById('v-year').value,
            make: document.getElementById('v-make').value,
            model: document.getElementById('v-model').value,
            vin: document.getElementById('v-vin').value,
            plate: document.getElementById('v-plate').value,
            mileage: parseInt(document.getElementById('v-mileage').value),
            fuelType: document.getElementById('v-fuel').value,
            oilType: document.getElementById('v-oil-type').value,
            oilInterval: parseInt(document.getElementById('v-oil-interval').value) || 5000,
        };
        if (editId) {
            const i = vehicles.findIndex(v => v.id === editId);
            if (i > -1) vehicles[i] = { ...vehicles[i], ...data };
        } else {
            data.id = generateId();
            vehicles.push(data);

            // auto-create oil change reminder from vehicle oil interval
            if (data.oilInterval && Number(data.oilInterval) > 0) {
                const reminders = getReminders();
                const alreadyHasOilReminder = reminders.some(r =>
                    r.vehicleId === data.id && r.serviceType === 'Oil Change'
                );

                if (!alreadyHasOilReminder) {
                    const today = new Date().toISOString().split('T')[0];

                    reminders.push({
                        id: generateId(),
                        vehicleId: data.id,
                        serviceType: 'Oil Change',
                        reminderMode: 'miles',
                        intervalMiles: Number(data.oilInterval),
                        intervalMonths: 0,
                        lastMileage: Number(data.mileage) || 0,
                        lastDate: today
                    });

                    saveReminders(reminders);
                }
            }
        }
        saveVehicles(vehicles);
        saveVehicles(vehicles);
        modal.classList.add('hidden');
        renderGarage();
    });

    renderGarage();
}

// log service logic

function initLog() {
    const maintenanceForm = document.getElementById('maintenance-form');
    const serviceList = document.getElementById('service-list');
    if (!maintenanceForm || !serviceList) return;
    populateVehicleSelects();

    const preselect = new URLSearchParams(window.location.search).get('vehicle');
    if (preselect) { const s = document.getElementById('vehicle'); if (s) s.value = preselect; }

    function renderLogs() {
        const logs = getLogs();
        const vehicles = getVehicles();
        const fV = document.getElementById('filter-vehicle')?.value || '';
        const fT = document.getElementById('filter-type')?.value || '';
        const filtered = logs.filter(l => (!fV || l.vehicleId === fV) && (!fT || l.serviceType === fT))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        serviceList.innerHTML = '';
        if (filtered.length === 0) { serviceList.innerHTML = '<li style="color:#666;padding:10px;">No service records found.</li>'; return; }
        filtered.forEach(log => {
            const v = vehicles.find(v => v.id === log.vehicleId);
            const li = document.createElement('li');
            li.innerHTML = `<div class="log-entry-row"><div><strong>${log.date}</strong> | <strong>${v ? `${v.year} ${v.make} ${v.model}` : 'Unknown'}</strong><br>Service: ${log.serviceType}<br>Mileage: ${Number(log.mileage).toLocaleString()} miles${log.notes ? `<br><em>Notes: ${log.notes}</em>` : ''}</div><div class="log-entry-actions"><button class="btn btn-secondary edit-log-btn" data-id="${log.id}">Edit</button><button class="btn btn-danger delete-log-btn" data-id="${log.id}">Delete</button></div></div>`;
            serviceList.appendChild(li);
        });
        serviceList.querySelectorAll('.delete-log-btn').forEach(btn => btn.addEventListener('click', () => {
            if (confirm('Delete this service record?')) { saveLogs(getLogs().filter(l => l.id !== btn.dataset.id)); renderLogs(); }
        }));
        serviceList.querySelectorAll('.edit-log-btn').forEach(btn => btn.addEventListener('click', () => {
            const log = getLogs().find(l => l.id === btn.dataset.id);
            if (!log) return;
            document.getElementById('vehicle').value = log.vehicleId;
            document.getElementById('date').value = log.date;
            document.getElementById('service-type').value = log.serviceType;
            document.getElementById('mileage').value = log.mileage;
            document.getElementById('notes').value = log.notes || '';
            maintenanceForm.dataset.editId = log.id;
            const sb = maintenanceForm.querySelector('button[type="submit"]');
            if (sb) sb.textContent = 'Update Record';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }));
    }

    document.getElementById('filter-vehicle')?.addEventListener('change', renderLogs);
    document.getElementById('filter-type')?.addEventListener('change', renderLogs);

    maintenanceForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const vehicleId = document.getElementById('vehicle').value;
        const date = document.getElementById('date').value;
        const serviceType = document.getElementById('service-type').value;
        const mileage = parseInt(document.getElementById('mileage').value);
        const notes = document.getElementById('notes').value;
        if (!vehicleId || !date || !serviceType || !mileage) { alert('Please fill in all required fields.'); return; }
        let logs = getLogs();
        const editId = this.dataset.editId;
        if (editId) {
            const i = logs.findIndex(l => l.id === editId);
            if (i > -1) logs[i] = { ...logs[i], vehicleId, date, serviceType, mileage, notes };
            delete this.dataset.editId;
            const sb = this.querySelector('button[type="submit"]'); if (sb) sb.textContent = 'Log Service';
        } else { logs.push({ id: generateId(), vehicleId, date, serviceType, mileage, notes }); }
        saveLogs(logs);
        // Update vehicle mileage
        let vehicles = getVehicles();
        const vi = vehicles.findIndex(v => v.id === vehicleId);
        if (vi > -1 && mileage > vehicles[vi].mileage) { vehicles[vi].mileage = mileage; saveVehicles(vehicles); }
        // Update or auto-create reminder
        let reminders = getReminders();
        const ri = reminders.findIndex(r => r.vehicleId === vehicleId && r.serviceType === serviceType);

        const defaultReminderSettings = {
            "Oil Change": { reminderMode: "miles", intervalMiles: 5000, intervalMonths: 0 },
            "Tire Rotation": { reminderMode: "miles", intervalMiles: 6000, intervalMonths: 0 },
            "Tire Replacement": { reminderMode: "miles", intervalMiles: 50000, intervalMonths: 0 },
            "Brake Pad Replacement": { reminderMode: "miles", intervalMiles: 30000, intervalMonths: 0 },
            "Brake Inspection": { reminderMode: "either", intervalMiles: 12000, intervalMonths: 12 },
            "Fluid Check": { reminderMode: "either", intervalMiles: 5000, intervalMonths: 6 },
            "State Inspection": { reminderMode: "time", intervalMiles: 0, intervalMonths: 12 },
            "Air Filter": { reminderMode: "miles", intervalMiles: 15000, intervalMonths: 0 },
            "Battery Replacement": { reminderMode: "time", intervalMiles: 0, intervalMonths: 36 },
            "Transmission Service": { reminderMode: "miles", intervalMiles: 30000, intervalMonths: 0 },
            "Coolant Flush": { reminderMode: "time", intervalMiles: 0, intervalMonths: 24 },
            "Other": { reminderMode: "either", intervalMiles: 5000, intervalMonths: 6 }
        };

        if (ri > -1) {
            reminders[ri].lastMileage = mileage;
            reminders[ri].lastDate = date;
            saveReminders(reminders);
        } else {
            const defaults = defaultReminderSettings[serviceType] || defaultReminderSettings["Other"];

            reminders.push({
                id: generateId(),
                vehicleId,
                serviceType,
                reminderMode: defaults.reminderMode,
                intervalMiles: defaults.intervalMiles,
                intervalMonths: defaults.intervalMonths,
                lastMileage: mileage,
                lastDate: date
            });

            saveReminders(reminders);
        }
        this.reset();
        renderLogs();
        alert('Service logged successfully!');
    });

    renderLogs();
}

// dashboard logic

function initDashboard() {

    const reminderCard = document.getElementById('reminderCard');
    const recent = document.getElementById('recentActivity');
    const garageCard = document.getElementById('garageCard');


    // maintenance reminder card
    if (reminderCard) {
        const vehicles = getVehicles();
        const overdueAlerts = [];
        const soonAlerts = [];

        reminderCard.innerHTML = '';

        vehicles.forEach(v => {
            const vReminders = getVehicleAlerts(v.id);
            vReminders.forEach(r => {
                const alertData = {
                    vehicle: v,
                    service: r.service,
                    milesLeft: r.milesLeft,
                    monthsLeft: r.monthsLeft,
                    type: r.type
                };

                if (r.type === 'overdue') {
                    overdueAlerts.push(alertData);
                } else if (r.type === 'soon') {
                    soonAlerts.push(alertData);
                }
            });
        });

        function makeAlertText(alert) {
            if (alert.type === 'overdue') {
                if (alert.milesLeft !== null && alert.milesLeft <= 0) {
                    return 'Overdue by ' + Math.abs(alert.milesLeft) + ' miles';
                } else if (alert.monthsLeft !== null && alert.monthsLeft <= 0) {
                    return 'Overdue by ' + Math.abs(alert.monthsLeft) + ' month' + (Math.abs(alert.monthsLeft) !== 1 ? 's' : '');
                } else {
                    return 'Overdue';
                }
            } else {
                const parts = [];
                if (alert.milesLeft !== null && alert.milesLeft > 0) {
                    parts.push(alert.milesLeft + ' miles left');
                }
                if (alert.monthsLeft !== null && alert.monthsLeft > 0) {
                    parts.push(alert.monthsLeft + ' month' + (alert.monthsLeft !== 1 ? 's' : '') + ' left');
                }
                return parts.length ? parts.join(' • ') : 'Coming up soon';
            }
        }

        // OVERDUE SECTION
        const overdueHeader = document.createElement('li');
        overdueHeader.innerHTML = '<strong style="color:#dc3545;">Overdue</strong>';
        reminderCard.appendChild(overdueHeader);

        if (overdueAlerts.length === 0) {
            const li = document.createElement('li');
            li.innerHTML = 'No overdue services.';
            reminderCard.appendChild(li);
        } else {
            overdueAlerts.forEach(alert => {
                const li = document.createElement('li');
                li.innerHTML =
                    '<strong>' + alert.service + '</strong> for <strong>' +
                    (alert.vehicle ? alert.vehicle.year + ' ' + alert.vehicle.make + ' ' + alert.vehicle.model : 'Unknown Vehicle') +
                    '</strong><br>' + makeAlertText(alert);
                reminderCard.appendChild(li);
            });
        }

        // COMING UP SECTION
        const soonHeader = document.createElement('li');
        soonHeader.innerHTML = '<strong style="color:#fd7e14;">Coming Up</strong>';
        reminderCard.appendChild(soonHeader);

        if (soonAlerts.length === 0) {
            const li = document.createElement('li');
            li.innerHTML = 'Nothing coming up right now.';
            reminderCard.appendChild(li);
        } else {
            soonAlerts.forEach(alert => {
                const li = document.createElement('li');
                li.innerHTML =
                    '<strong>' + alert.service + '</strong> for <strong>' +
                    (alert.vehicle ? alert.vehicle.year + ' ' + alert.vehicle.make + ' ' + alert.vehicle.model : 'Unknown Vehicle') +
                    '</strong><br>' + makeAlertText(alert);
                reminderCard.appendChild(li);
            });
        }
    }
    // recent activity card
    if (recent) {
        const logs = getLogs();
        const vehicles = getVehicles();

        recent.innerHTML = '';

        if (logs.length > 0) {
            logs.sort((a, b) => new Date(b.date) - new Date(a.date));

            logs.slice(0, 5).forEach(log => {
                const v = vehicles.find(v => v.id === log.vehicleId);
                const li = document.createElement('li');

                li.innerHTML =
                    '<strong>' + log.serviceType + '</strong> for <strong>' +
                    (v ? v.year + ' ' + v.make + ' ' + v.model : 'Unknown Vehicle') +
                    '</strong> on ' + log.date;

                recent.appendChild(li);
            });
        } else {
            recent.innerHTML = '<li>No recent activity.</li>';
        }
    }

    // garage summary card
    if (garageCard) {
        const vehicles = getVehicles();

        if (vehicles.length > 0) {
            garageCard.innerHTML =
                '<p><strong>' + vehicles.length + '</strong> vehicle' +
                (vehicles.length > 1 ? 's' : '') +
                ' in your garage</p>';
        } else {
            garageCard.innerHTML =
                '<p>Your garage is empty. Add a vehicle to get started!</p>';
        }
    }
}

function logoutUser() {
    localStorage.removeItem('loggedInUser');
    window.location.href = 'login.html';
}

function authBtnChange() {
    const btn = document.getElementById('auth-btn');
    if (!btn) return;

    if (isLoggedIn) {
        btn.innerText = "Logout";
        btn.onclick = logoutUser;
    } else {
        btn.innerText = "Login";
        btn.onclick = () => window.location.href = "login.html";
    }
}

function initReminders() {
    const reminderForm = document.getElementById('reminder-form');
    const reminderList = document.getElementById('reminder-list');
    if (!reminderForm || !reminderList) return;

    populateVehicleSelects();

    const vehicleSelect = document.getElementById('vehicle');
    const vehicleInfoBox = document.getElementById('reminder-vehicle-info');
    const vehicleDetails = document.getElementById('reminder-vehicle-details');
    const logPreview = document.getElementById('reminder-log-preview');

    function renderReminderReference(vehicleId) {
        const vehicle = getVehicles().find(v => v.id === vehicleId);
        const logs = getLogs()
            .filter(l => l.vehicleId === vehicleId)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        if (!vehicle) {
            vehicleInfoBox.style.display = 'none';
            vehicleDetails.innerHTML = '';
            logPreview.innerHTML = '';
            return;
        }

        vehicleInfoBox.style.display = 'block';

        vehicleDetails.innerHTML = `
            <p><strong>Vehicle:</strong> ${vehicle.year} ${vehicle.make} ${vehicle.model}</p>
            <p><strong>Current Mileage:</strong> ${Number(vehicle.mileage).toLocaleString()}</p>
            <p><strong>VIN:</strong> ${vehicle.vin || '&mdash;'}</p>
            <p><strong>Oil Interval:</strong> ${vehicle.oilInterval ? Number(vehicle.oilInterval).toLocaleString() + ' miles' : '&mdash;'}</p>
        `;

        logPreview.innerHTML = '';

        if (logs.length === 0) {
            logPreview.innerHTML = '<li>No service logs for this vehicle yet.</li>';
            return;
        }

        logs.forEach(log => {
            const li = document.createElement('li');
            li.innerHTML = `
                <strong>${log.date}</strong> - ${log.serviceType}<br>
                Mileage: ${Number(log.mileage).toLocaleString()}${log.notes ? `<br><em>${log.notes}</em>` : ''}
            `;
            logPreview.appendChild(li);
        });
    }

    vehicleSelect?.addEventListener('change', function () {
        renderReminderReference(this.value);
    });

    document.getElementById('filter-vehicle')?.addEventListener('change', renderReminders);
    document.getElementById('filter-type')?.addEventListener('change', renderReminders);

    function resetReminderForm() {
        reminderForm.reset();
        delete reminderForm.dataset.editId;
        const submitBtn = reminderForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Save Dashboard Reminder';
        vehicleInfoBox.style.display = 'none';
        vehicleDetails.innerHTML = '';
        logPreview.innerHTML = '';
        populateVehicleSelects();
    }

    function renderReminders() {
        const reminders = getReminders();
        const vehicles = getVehicles();
        const filterVehicle = document.getElementById('filter-vehicle')?.value || '';
        const filterType = document.getElementById('filter-type')?.value || '';

        reminderList.innerHTML = '';

        const filtered = reminders.filter(r => {
            const matchesVehicle = !filterVehicle || r.vehicleId === filterVehicle;
            const matchesType = !filterType || r.serviceType === filterType;
            return matchesVehicle && matchesType;
        });

        if (filtered.length === 0) {
            reminderList.innerHTML = '<li style="color:#666;padding:10px;">No reminders match this filter.</li>';
            return;
        }

        filtered.forEach(r => {
            const v = vehicles.find(v => v.id === r.vehicleId);
            const li = document.createElement('li');
            li.innerHTML = `
            <strong>${r.serviceType}</strong> for
            <strong>${v ? `${v.year} ${v.make} ${v.model}` : 'Unknown Vehicle'}</strong><br>
            Reminder Type: ${r.reminderMode === 'miles' ? 'Mileage only' :
                    r.reminderMode === 'time' ? 'Time only' :
                        'Whichever comes first'
                }<br>
            Mileage Interval: ${r.intervalMiles ? r.intervalMiles.toLocaleString() + ' miles' : 'Not set'}<br>
            Time Interval: ${r.intervalMonths ? r.intervalMonths + ' month' + (r.intervalMonths !== 1 ? 's' : '') : 'Not set'}<br>
            Last Service Mileage: ${Number(r.lastMileage).toLocaleString()}<br>
            Last Service Date: ${r.lastDate}
            <div class="reminder-actions">
                <button class="btn btn-secondary edit-reminder" data-id="${r.id}">Edit</button>
                <button class="btn btn-danger delete-reminder" data-id="${r.id}">Delete</button>
            </div>
        `;
            reminderList.appendChild(li);
        });

        document.querySelectorAll('.delete-reminder').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Delete this reminder?')) {
                    const updated = getReminders().filter(r => r.id !== btn.dataset.id);
                    saveReminders(updated);
                    renderReminders();
                }
            });
        });

        document.querySelectorAll('.edit-reminder').forEach(btn => {
            btn.addEventListener('click', () => {
                const reminder = getReminders().find(r => r.id === btn.dataset.id);
                if (!reminder) return;

                document.getElementById('vehicle').value = reminder.vehicleId;
                document.getElementById('reminder-service').value = reminder.serviceType;
                document.getElementById('reminder-mode').value = reminder.reminderMode || 'either';
                document.getElementById('interval-miles').value = reminder.intervalMiles || '';
                document.getElementById('interval-months').value = reminder.intervalMonths || '';
                document.getElementById('last-mileage').value = reminder.lastMileage;
                document.getElementById('last-date').value = reminder.lastDate;

                reminderForm.dataset.editId = reminder.id;

                const submitBtn = reminderForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.textContent = 'Update Reminder';

                renderReminderReference(reminder.vehicleId);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    reminderForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const vehicleId = document.getElementById('vehicle').value;
        const serviceType = document.getElementById('reminder-service').value;
        const reminderMode = document.getElementById('reminder-mode').value;
        const intervalMiles = parseInt(document.getElementById('interval-miles').value) || 0;
        const intervalMonths = parseInt(document.getElementById('interval-months').value) || 0;
        const lastMileage = parseInt(document.getElementById('last-mileage').value);
        const lastDate = document.getElementById('last-date').value;

        if (!vehicleId || !serviceType || !lastDate || isNaN(lastMileage)) {
            alert('Please fill in all required fields.');
            return;
        }

        if (reminderMode === 'miles' && intervalMiles === 0) {
            alert('Enter a mileage interval for a mileage-based reminder.');
            return;
        }

        if (reminderMode === 'time' && intervalMonths === 0) {
            alert('Enter a month interval for a time-based reminder.');
            return;
        }

        if (reminderMode === 'either' && intervalMiles === 0 && intervalMonths === 0) {
            alert('Enter a mileage interval, a time interval, or both.');
            return;
        }

        const reminders = getReminders();
        const editId = reminderForm.dataset.editId;

        if (editId) {
            const index = reminders.findIndex(r => r.id === editId);
            if (index > -1) {
                reminders[index] = {
                    ...reminders[index],
                    vehicleId,
                    serviceType,
                    reminderMode,
                    intervalMiles,
                    intervalMonths,
                    lastMileage,
                    lastDate
                };
            }
        } else {
            reminders.push({
                id: generateId(),
                vehicleId,
                serviceType,
                reminderMode,
                intervalMiles,
                intervalMonths,
                lastMileage,
                lastDate
            });
        }

        saveReminders(reminders);
        resetReminderForm();
        renderReminders();
        alert(editId ? 'Reminder updated successfully!' : 'Reminder saved successfully!');
    });

    renderReminders();
}

// router logic for log and garage ---------
const page = window.location.pathname.split('/').pop() || 'index.html';
if (page === 'garage.html') {
    initGarage();
    authBtnChange();
    console.log(isLoggedIn);
}
if (page === 'log.html') {
    initLog();
    authBtnChange();
}
if (page === 'index.html') {
    initDashboard();
    authBtnChange();
}

if (page === 'reminders.html') {
    initReminders();
    authBtnChange();
} 