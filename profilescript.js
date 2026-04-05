const API = 'http://localhost:3000/api';

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `show ${type}`;
  setTimeout(() => { t.className = ''; }, 3200);
}

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// logout nav
const loginNav = document.getElementById('login-nav');
if (loginNav) {
  loginNav.textContent = 'Logout';
  loginNav.href = '#';
  loginNav.onclick = e => {
    e.preventDefault();
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('registeredUser');
    window.location.href = 'login.html';
  };
}

// load current data
const storedUser = JSON.parse(localStorage.getItem('registeredUser') || '{}');
const loggedInEmail = localStorage.getItem('loggedInUser') || '';

const nameField  = document.getElementById('p-name');
const emailField = document.getElementById('p-email');
const avatarEl   = document.getElementById('avatar-initials');
const displayNameEl  = document.getElementById('display-name');
const displayEmailEl = document.getElementById('display-email');

function populateProfile(user) {
  const name  = user.name  || '';
  const email = user.email || loggedInEmail;
  nameField.value  = name;
  emailField.value = email;
  avatarEl.textContent       = getInitials(name || email);
  displayNameEl.textContent  = name  || email;
  displayEmailEl.textContent = email;
}

// backend api call but fallsback on localstorage if needed
async function loadProfile() {
  try {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API}/user/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Not ok');
    const data = await res.json();
    populateProfile(data);
    localStorage.setItem('registeredUser', JSON.stringify(data));
  } catch {
    populateProfile(storedUser);
  }
}

loadProfile();

// reset profile
document.getElementById('reset-profile-btn').addEventListener('click', () => {
  populateProfile(storedUser);
});

// profile update
document.getElementById('profile-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name  = nameField.value.trim();
  const email = emailField.value.trim();

  if (!name || !email) {
    showToast('Name and email are required.', 'error'); return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Please enter a valid email.', 'error'); return;
  }

  try {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API}/user/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, email })
    });

    if (res.status === 409) { showToast('That email is already in use.', 'error'); return; }
    if (!res.ok) throw new Error('Server error');

    // update localstorage
    const updated = { ...storedUser, name, email };
    localStorage.setItem('registeredUser', JSON.stringify(updated));
    localStorage.setItem('loggedInUser', email);

    populateProfile(updated);
    showToast('Profile updated successfully!');
  } catch {
    // dev stuff with localstorage
    const updated = { ...storedUser, name, email };
    localStorage.setItem('registeredUser', JSON.stringify(updated));
    localStorage.setItem('loggedInUser', email);
    populateProfile(updated);
    showToast('Profile updated (offline mode).');
  }
});

// password strength bar
const newPassInput  = document.getElementById('p-new');
const strengthFill  = document.getElementById('strength-fill');
const strengthLabel = document.getElementById('strength-label');

newPassInput.addEventListener('input', () => {
  const val = newPassInput.value;
  let score = 0;
  if (val.length >= 8)  score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  const levels = [
    { pct: '0%',   color: '#e2e8f0', label: '' },
    { pct: '25%',  color: '#e53e3e', label: 'Weak' },
    { pct: '50%',  color: '#dd6b20', label: 'Fair' },
    { pct: '75%',  color: '#d69e2e', label: 'Good' },
    { pct: '100%', color: '#38a169', label: 'Strong' },
  ];
  const lv = levels[score] || levels[0];
  strengthFill.style.width    = val ? lv.pct   : '0%';
  strengthFill.style.background = lv.color;
  strengthLabel.textContent   = val ? lv.label : '';
});

// change password
document.getElementById('password-form').addEventListener('submit', async e => {
  e.preventDefault();
  const current = document.getElementById('p-current').value;
  const newPass = newPassInput.value;
  const confirm = document.getElementById('p-confirm').value;

  if (!current || !newPass || !confirm) {
    showToast('All password fields are required.', 'error'); return;
  }
  if (newPass.length < 8) {
    showToast('New password must be at least 8 characters.', 'error'); return;
  }
  if (newPass !== confirm) {
    showToast('New passwords do not match.', 'error'); return;
  }

  try {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API}/user/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword: current, newPassword: newPass })
    });

    if (res.status === 401) { showToast('Current password is incorrect.', 'error'); return; }
    if (!res.ok) throw new Error('Server error');

    document.getElementById('password-form').reset();
    strengthFill.style.width = '0%';
    strengthLabel.textContent = '';
    showToast('Password changed successfully!');
  } catch {
    showToast('Could not reach server. Password not changed.', 'error');
  }
});

// delete acc
document.getElementById('open-delete-modal').addEventListener('click', () => {
  document.getElementById('delete-modal').classList.remove('hidden');
});

document.getElementById('cancel-delete').addEventListener('click', () => {
  document.getElementById('delete-modal').classList.add('hidden');
  document.getElementById('confirm-email-input').value = '';
});

document.getElementById('confirm-delete').addEventListener('click', async () => {
  const typed = document.getElementById('confirm-email-input').value.trim();
  const currentEmail = emailField.value.trim() || loggedInEmail;

  if (typed !== currentEmail) {
    showToast('Email does not match. Account not deleted.', 'error'); return;
  }

  try {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API}/user/account`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Server error');
  } catch {
    // could add local cleanup here too even if the api is down
  }

  localStorage.removeItem('loggedInUser');
  localStorage.removeItem('registeredUser');
  localStorage.removeItem('authToken');
  window.location.href = 'login.html';
});