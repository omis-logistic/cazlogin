// ================= CONFIGURATION =================
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwPlfcv39zu5wdGNb4knmzqL7i_FKrilQTjeMgQShj7SscT9Oj58NDxTK1IIPR0Uog/exec';
let currentUser = {
  phone: '',
  email: '',
  token: ''
};

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  checkExistingSession();
  showPage('login-page');
});

// ================= EVENT MANAGEMENT =================
function initializeEventListeners() {
  // Auth Buttons
  document.getElementById('loginButton')?.addEventListener('click', handleLogin);
  document.getElementById('registerButton')?.addEventListener('click', handleRegistration);
  document.getElementById('passwordRecoveryButton')?.addEventListener('click', handlePasswordRecovery);
  document.getElementById('changePasswordButton')?.addEventListener('click', handlePasswordChange);
  document.getElementById('changeEmailButton')?.addEventListener('click', handleEmailChange);
  
  // Navigation
  document.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const page = button.dataset.action.replace('show-', '');
      showPage(page);
    });
  });

  // Logout Buttons
  document.querySelectorAll('[data-action="logout"]').forEach(button => {
    button.addEventListener('click', handleLogout);
  });
}

// ================= AUTH HANDLERS =================
async function handleLogin(event) {
  event.preventDefault();
  showLoading();
  
  try {
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    
    const response = await callBackend('processLogin', { phone, password });
    
    if (response.success) {
      currentUser = {
        phone: response.phone,
        email: response.email,
        token: response.token
      };
      localStorage.setItem('userSession', JSON.stringify(currentUser));
      response.tempPassword ? showPage('password-reset-page') : showDashboard();
    } else {
      showError('login-error', response.message || 'Login failed');
    }
  } catch (error) {
    showError('global-error', 'Connection error. Please try again.');
  } finally {
    hideLoading();
  }
}

async function handleRegistration(event) {
  event.preventDefault();
  showLoading();
  
  try {
    const phone = document.getElementById('regPhone').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPass = document.getElementById('regConfirmPass').value;
    const email = document.getElementById('regEmail').value.trim();
    const confirmEmail = document.getElementById('regConfirmEmail').value.trim();

    if (!validatePhone(phone)) throw new Error('Invalid phone format');
    if (password !== confirmPass) throw new Error('Passwords do not match');
    if (!validatePassword(password)) throw new Error('Password requirements not met');
    if (email !== confirmEmail) throw new Error('Emails do not match');
    if (!validateEmail(email)) throw new Error('Invalid email format');

    const response = await callBackend('createAccount', { phone, password, email });
    
    if (response.success) {
      showPage('login-page');
      showSuccess('Registration successful! Please login');
    } else {
      throw new Error(response.message || 'Registration failed');
    }
  } catch (error) {
    showError('registration-error', error.message);
  } finally {
    hideLoading();
  }
}

async function handlePasswordRecovery(event) {
  event.preventDefault();
  showLoading();

  try {
    const phone = document.getElementById('recoveryPhone').value.trim();
    const email = document.getElementById('recoveryEmail').value.trim();

    if (!phone || !email) throw new Error('Both fields are required');
    
    const response = await callBackend('initiatePasswordReset', { phone, email });
    
    if (response.success) {
      showSuccess('Password reset instructions sent to email');
      showPage('login-page');
    } else {
      throw new Error(response.message || 'Password reset failed');
    }
  } catch (error) {
    showError('recoveryStatus', error.message);
  } finally {
    hideLoading();
  }
}

// ================= USER ACTIONS =================
async function handlePasswordChange(event) {
  event.preventDefault();
  showLoading();

  try {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('repeatNewPassword').value;

    if (newPassword !== confirmPassword) throw new Error('Passwords do not match');
    if (!validatePassword(newPassword)) throw new Error('Password requirements not met');

    const response = await callBackend('updateUserInfo', {
      phone: currentUser.phone,
      token: currentUser.token,
      currentPassword,
      newPassword
    });

    if (response.success) {
      showSuccess('Password updated successfully');
      clearPasswordFields();
    } else {
      throw new Error(response.message || 'Password update failed');
    }
  } catch (error) {
    showError('currentPasswordError', error.message);
  } finally {
    hideLoading();
  }
}

async function handleEmailChange(event) {
  event.preventDefault();
  showLoading();

  try {
    const password = document.getElementById('verifyPassword').value;
    const newEmail = document.getElementById('newEmail').value.trim();
    const confirmEmail = document.getElementById('repeatNewEmail').value.trim();

    if (newEmail !== confirmEmail) throw new Error('Emails do not match');
    if (!validateEmail(newEmail)) throw new Error('Invalid email format');

    const response = await callBackend('updateUserInfo', {
      phone: currentUser.phone,
      token: currentUser.token,
      currentPassword: password,
      newEmail
    });

    if (response.success) {
      currentUser.email = newEmail;
      localStorage.setItem('userSession', JSON.stringify(currentUser));
      showSuccess('Email updated successfully');
      document.getElementById('currentEmail').textContent = newEmail;
    } else {
      throw new Error(response.message || 'Email update failed');
    }
  } catch (error) {
    showError('verifyPasswordError', error.message);
  } finally {
    hideLoading();
  }
}

// ================= API COMMUNICATION =================
async function callBackend(action, data) {
  try {
    const url = new URL(GAS_WEBAPP_URL);
    url.searchParams.set('cache', Date.now());

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, message: 'Network error' };
  }
}

// ================= UI MANAGEMENT =================
function showPage(pageId) {
  document.querySelectorAll('.container').forEach(page => {
    page.style.display = page.id === pageId ? 'block' : 'none';
  });
}

function showDashboard() {
  showPage('dashboard-page');
  document.getElementById('user-phone').textContent = currentUser.phone;
  document.getElementById('user-email').textContent = currentUser.email;
  loadParcelData();
}

function showError(elementId, message) {
  const container = document.getElementById(elementId);
  if (container) {
    container.textContent = message;
    container.style.display = 'block';
    setTimeout(() => container.style.display = 'none', 5000);
  }
}

function showSuccess(message) {
  const successElement = document.getElementById('success-message');
  successElement.textContent = message;
  successElement.style.display = 'block';
  setTimeout(() => successElement.style.display = 'none', 5000);
}

function showLoading() {
  document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

// ================= UTILITIES =================
function validatePhone(phone) {
  return /^(673\d{7}|60\d{9,})$/.test(phone);
}

function validatePassword(password) {
  return /^(?=.*[A-Z])(?=.*\d).{6,}$/.test(password);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function checkExistingSession() {
  const session = localStorage.getItem('userSession');
  if (session) {
    try {
      currentUser = JSON.parse(session);
      showDashboard();
    } catch {
      localStorage.removeItem('userSession');
    }
  }
}

function handleLogout() {
  localStorage.removeItem('userSession');
  currentUser = { phone: '', email: '', token: '' };
  showPage('login-page');
  clearPasswordFields();
}

function clearPasswordFields() {
  document.querySelectorAll('input[type="password"]').forEach(field => {
    field.value = '';
  });
}

async function loadParcelData() {
  try {
    const response = await callBackend('getParcelData', {
      phone: currentUser.phone,
      token: currentUser.token
    });

    if (response.success) {
      renderParcelList(response.data);
    }
  } catch (error) {
    showError('parcel-error', 'Failed to load parcel data');
  }
}

function renderParcelList(parcels) {
  const container = document.getElementById('trackingList');
  container.innerHTML = '';
  
  parcels.forEach(parcel => {
    const element = document.createElement('div');
    element.className = 'tracking-item';
    element.innerHTML = `
      <div>${parcel.trackingNumber}</div>
      <div>${parcel.status}</div>
    `;
    container.appendChild(element);
  });
}
