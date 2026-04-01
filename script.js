// Authentication Toggle Logic
const loginSection = document.getElementById('login-section');
const registerSection = document.getElementById('register-section');
const showRegisterBtn = document.getElementById('show-register');
const showLoginBtn = document.getElementById('show-login');

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

    // Mock login
    document.getElementById('login-form').addEventListener('submit', function(event) {
        event.preventDefault();
        alert("Login simulated succsessfully, return to dashboard..");
        window.location.href = 'index.html'; // returns user to dashboard
    });

    // Mock user registration
    document.getElementById('register-form').addEventListener('submit', function(event) {
        event.preventDefault();
        alert("Account created! You can now log in.");
        registerSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
    });
}

// Garage logic

const addVehicleBtn = document.getElementById('add-vehicle-btn');

// Ensure user on garage page
if(addVehicleBtn) {
    addVehicleBtn.addEventListener('click', function() {
        const newVehicle = prompt("Enter the Year, Make, and Model of your new vehicle.")

        if (newVehicle) {
            alert(newVehicle + " has been added! **DEMO ONLY**");
            // Temporary demo
        }
    });
}

// Service Log Form Logic
const maintenanceForm = document.getElementById('maintenance-form');
const serviceList = document.getElementById('service-list');

// Ensure form exists on current page
if (maintenanceForm && serviceList) {
    maintenanceForm.addEventListener('submit', function(event) {
        event.preventDefault();

        // capture values
        const vehicle = document.getElementById('vehicle').value;
        const date = document.getElementById('date').value;
        const serviceType = document.getElementById('service-type').value;
        const mileage = document.getElementById('mileage').value;

        // Create new list item
        const newRecord = document.createElement('li');

        // Format output
        newRecord.innerHTML = `
            <strong>${date}</strong | <strong>${vehicle}</strong><br>
            Service: ${serviceType} <br>
            Mileage: ${mileage} miles
        `;

        // Add to top of list
        serviceList.insertBefore(newRecord, serviceList.firstChild);

        // Inform user of success
        alert("Service logged successfully!");
        maintenanceForm.reset();
    });
}