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
    showRegisterBtn.addEventListener('click', function(event) {
        event.preventDefault();
        loginSection.classList.add('hidden');
        registerSection.classList.remove('hidden');
    });

    // Switch to login view
    showLoginBtn.addEventListener('click', function(event) {
        event.preventDefault();
        registerSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
    });

    // logging in
    document.getElementById('login-form').addEventListener('submit', function(event) {
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
    document.getElementById('register-form').addEventListener('submit', function(event) {
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
        const milesLeft = r.intervalMiles - (vehicle.mileage - r.lastMileage);
        const lastDate = new Date(r.lastDate);
        const monthsLeft = r.intervalMonths - ((today.getFullYear() - lastDate.getFullYear()) * 12 + (today.getMonth() - lastDate.getMonth()));
        if (milesLeft <= 0 || monthsLeft <= 0) alerts.push({ type: 'overdue', service: r.serviceType, milesLeft, monthsLeft });
        else if (milesLeft <= 500 || monthsLeft <= 1) alerts.push({ type: 'soon', service: r.serviceType, milesLeft, monthsLeft });
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
    return JSON.parse(localStorage.getItem('tuneup_vehicles') || '[]'); }
function saveVehicles(v) { 
    localStorage.setItem('tuneup_vehicles', JSON.stringify(v)); }
function getLogs() { 
    return JSON.parse(localStorage.getItem('tuneup_logs') || '[]'); }
function saveLogs(l) { 
    localStorage.setItem('tuneup_logs', JSON.stringify(l)); }
function getReminders() { 
    return JSON.parse(localStorage.getItem('tuneup_reminders') || '[]'); }
function saveReminders(r) { 
    localStorage.setItem('tuneup_reminders', JSON.stringify(r)); }
function generateId() { 
    return '_' + Math.random().toString(36).substr(2, 9); }

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
                statusHtml = `<span style="color:#dc3545;font-weight:bold;">&#9888; ${alerts.find(a=>a.type==='overdue').service} Overdue</span>`;
            } else if (alerts.some(a => a.type === 'soon')) {
                statusHtml = `<span style="color:#fd7e14;font-weight:bold;">&#9889; ${alerts.find(a=>a.type==='soon').service} Due Soon</span>`;
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
                ['year','make','model','vin','plate','mileage'].forEach(f => { const el = document.getElementById(`v-${f}`); if(el) el.value = v[f] || ''; });
                const fuel = document.getElementById('v-fuel'); if(fuel) fuel.value = v.fuelType || '';
                const oilT = document.getElementById('v-oil-type'); if(oilT) oilT.value = v.oilType || '';
                const oilI = document.getElementById('v-oil-interval'); if(oilI) oilI.value = v.oilInterval || '';
            }
        }
        modal.classList.remove('hidden');
    }
 
    document.getElementById('add-vehicle-btn')?.addEventListener('click', () => openModal());
    document.getElementById('modal-cancel')?.addEventListener('click', () => modal.classList.add('hidden'));
    modal?.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
 
    vehicleForm?.addEventListener('submit', function(e) {
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
        if (editId) { const i = vehicles.findIndex(v => v.id === editId); if(i>-1) vehicles[i] = {...vehicles[i],...data}; }
        else { data.id = generateId(); vehicles.push(data); }
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
    if (preselect) { const s = document.getElementById('vehicle'); if(s) s.value = preselect; }
 
    function renderLogs() {
        const logs = getLogs();
        const vehicles = getVehicles();
        const fV = document.getElementById('filter-vehicle')?.value || '';
        const fT = document.getElementById('filter-type')?.value || '';
        const filtered = logs.filter(l => (!fV || l.vehicleId === fV) && (!fT || l.serviceType === fT))
                             .sort((a,b) => new Date(b.date) - new Date(a.date));
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
            window.scrollTo({top:0,behavior:'smooth'});
        }));
    }
 
    document.getElementById('filter-vehicle')?.addEventListener('change', renderLogs);
    document.getElementById('filter-type')?.addEventListener('change', renderLogs);
 
    maintenanceForm.addEventListener('submit', function(e) {
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
            if(i>-1) logs[i] = {...logs[i], vehicleId, date, serviceType, mileage, notes};
            delete this.dataset.editId;
            const sb = this.querySelector('button[type="submit"]'); if(sb) sb.textContent = 'Log Service';
        } else { logs.push({id: generateId(), vehicleId, date, serviceType, mileage, notes}); }
        saveLogs(logs);
        // Update vehicle mileage
        let vehicles = getVehicles();
        const vi = vehicles.findIndex(v => v.id === vehicleId);
        if (vi>-1 && mileage > vehicles[vi].mileage) { vehicles[vi].mileage = mileage; saveVehicles(vehicles); }
        // Update reminder
        let reminders = getReminders();
        const ri = reminders.findIndex(r => r.vehicleId === vehicleId && r.serviceType === serviceType);
        if (ri>-1) { reminders[ri].lastMileage = mileage; reminders[ri].lastDate = date; saveReminders(reminders); }
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
        const alerts = [];

        reminderCard.innerHTML = '';

        vehicles.forEach(v => {
            const vReminders = getVehicleAlerts(v.id);
            vReminders.forEach(r => {
                alerts.push({ vehicle: v, service: r.service, milesLeft: r.milesLeft, monthsLeft: r.monthsLeft, type: r.type });
            });
        });

        if (alerts.length > 0) {
            alerts.sort((a, b) => {
                if (a.type === 'overdue' && b.type === 'soon') return -1;
                if (a.type === 'soon' && b.type === 'overdue') return 1;
                return 0;
            });

            alerts.forEach(alert => {
                const li = document.createElement('li');
                li.innerHTML =
                    '<strong>' + alert.service + '</strong> for <strong>' + 
                    (alert.vehicle ? alert.vehicle.year + ' ' + alert.vehicle.make + ' ' + alert.vehicle.model : 'Unknown Vehicle') +
                    '</strong> — ' + (alert.type === 'overdue' ? 'Overdue' : 'Due Soon') +
                    (alert.type !== 'overdue' && alert.milesLeft > 0 ? ' • ' + alert.milesLeft + ' miles' : '') +
                    (alert.type !== 'overdue' && alert.monthsLeft > 0 ? ' • ' + alert.monthsLeft + ' month' + (alert.monthsLeft !== 1 ? 's' : '') : '');
                reminderCard.appendChild(li);
            });
        } else {
            reminderCard.innerHTML = "<li>All vehicles are up to date! Great job!</li>";
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

// router logic for log and garage ---------
const page = window.location.pathname.split('/').pop() || 'index.html';
if (page === 'garage.html'){
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