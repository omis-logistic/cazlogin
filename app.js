// ================= CONFIGURATION =================
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbygbS8ul2oZNRVkCHm41Dd9tYIDkhOoO-MzQYE4WyYT9o-03AMGfX4NFyDTqMEhkdm7/exec';
let currentUser = {
  phone: '',
  email: '',
  token: ''
};

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', async () => {
  initializeEventListeners();
  await checkExistingSession();
  if (!currentUser.token) showPage('login-page');
});

// ================= EVENT MANAGEMENT =================
function initializeEventListeners() {
  // Auth Buttons
  document.getElementById('loginButton')?.addEventListener('click', handleLogin);
  document.getElementById('registerButton')?.addEventListener('click', handleRegistration);
  document.getElementById('passwordRecoveryButton')?.addEventListener('click', handlePasswordRecovery);
  document.getElementById('changePasswordButton')?.addEventListener('click', handlePasswordChange);
  document.getElementById('changeEmailButton')?.addEventListener('click', handleEmailChange);
  document.getElementById('submitParcelButton')?.addEventListener('click', handleParcelSubmission);
  
  // Navigation Buttons
  document.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const targetPage = button.dataset.action.replace('show-', '') + '-page';
      showPage(targetPage);
    });
  });

  // Logout Buttons
  document.querySelectorAll('[data-action="logout"]').forEach(button => {
    button.addEventListener('click', handleLogout);
  });

  // Dashboard Buttons
  document.getElementById('backToDashboardButton')?.addEventListener('click', () => showPage('dashboard-page'));
  document.getElementById('refreshTrackingButton')?.addEventListener('click', loadParcelData);
}

// ================= AUTH HANDLERS =================
async function handleLogin(event) {
  event.preventDefault();
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
      showError('login-error', response.message);
    }
  } catch (error) {
    showError('global-error', 'Connection error. Please try again.');
  }
}

async function handleRegistration(event) {
  event.preventDefault();
  try {
    const phone = document.getElementById('regPhone').value.trim();
    const password = document.getElementById('regPassword').value;
    const email = document.getElementById('regEmail').value.trim();

    if (!validatePhone(phone)) throw new Error('Invalid phone format');
    if (!validatePassword(password)) throw new Error('Password requirements not met');
    if (!validateEmail(email)) throw new Error('Invalid email format');

    const response = await callBackend('createAccount', { phone, password, email });
    
    response.success ? showPage('login-page') : showError('registration-error', response.message);
    if (response.success) showSuccess('Registration successful! Please login');
  } catch (error) {
    showError('registration-error', error.message);
  }
}

// ================= PASSWORD MANAGEMENT =================
async function handlePasswordRecovery(event) {
  event.preventDefault();
  try {
    const phone = document.getElementById('recoveryPhone').value.trim();
    const email = document.getElementById('recoveryEmail').value.trim();

    const response = await callBackend('initiatePasswordReset', { phone, email });
    
    response.success ? showPage('login-page') : showError('recoveryStatus', response.message);
    if (response.success) showSuccess('Password reset instructions sent to email');
  } catch (error) {
    showError('recoveryStatus', error.message);
  }
}

async function handlePasswordChange(event) {
  event.preventDefault();
  try {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;

    if (!validatePassword(newPassword)) throw new Error('Password requirements not met');

    const response = await callBackend('updateUserInfo', {
      phone: currentUser.phone,
      token: currentUser.token,
      currentPassword,
      newPassword
    });

    response.success ? showSuccess('Password updated') : showError('currentPasswordError', response.message);
  } catch (error) {
    showError('currentPasswordError', error.message);
  }
}

// ================= PARCEL HANDLING =================
async function handleParcelSubmission(event) {
  event.preventDefault();
  try {
    const formData = {
      trackingNumber: document.getElementById('trackingNumber').value,
      phoneNumber: currentUser.phone,
      itemDescription: document.getElementById('itemDescription').value,
      quantity: document.getElementById('quantity').value,
      price: document.getElementById('price').value,
      itemCategory: document.getElementById('itemCategory').value
    };

    const files = document.getElementById('invoiceFiles').files;
    const filesBase64 = await processFiles(files);

    const response = await callBackend('submitParcelDeclaration', {
      data: formData,
      filesBase64,
      token: currentUser.token
    });

    response.success ? showDashboard() : showError('parcel-error', response.message);
  } catch (error) {
    showError('parcel-error', error.message);
  }
}

// ================= API COMMUNICATION =================
async function callBackend(action, data) {
  showLoading();
  try {
    const response = await fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, message: 'Network error' };
  } finally {
    hideLoading();
  }
}

// ================= UI MANAGEMENT =================
function showPage(pageId) {
  document.querySelectorAll('.container').forEach(page => {
    page.style.display = page.id === pageId ? 'block' : 'none';
  });
  if (pageId === 'dashboard-page') loadParcelData();
}

function showDashboard() {
  document.getElementById('user-phone').textContent = currentUser.phone;
  document.getElementById('user-email').textContent = currentUser.email;
  showPage('dashboard-page');
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
  const successElement = document.createElement('div');
  successElement.className = 'success-message';
  successElement.textContent = message;
  document.body.appendChild(successElement);
  setTimeout(() => successElement.remove(), 3000);
}

// ================= SESSION MANAGEMENT =================
async function checkExistingSession() {
  const session = localStorage.getItem('userSession');
  if (!session) return;

  try {
    currentUser = JSON.parse(session);
    const response = await callBackend('validateSession', {
      phone: currentUser.phone,
      token: currentUser.token
    });

    if (!response.success) throw new Error('Session expired');
    showDashboard();
  } catch (error) {
    handleLogout();
    showError('global-error', 'Session expired. Please login again.');
  }
}

function handleLogout() {
  localStorage.removeItem('userSession');
  currentUser = { phone: '', email: '', token: '' };
  document.querySelectorAll('input').forEach(input => input.value = '');
  showPage('login-page');
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

async function processFiles(files) {
  return Promise.all(Array.from(files).map(file => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({
        name: file.name,
        type: file.type,
        base64: e.target.result.split(',')[1]
      });
      reader.readAsDataURL(file);
    });
  }));
}

async function loadParcelData() {
  try {
    const response = await callBackend('getParcelData', {
      phone: currentUser.phone,
      token: currentUser.token
    });

    if (response.success) {
      const container = document.getElementById('trackingList');
      container.innerHTML = response.data.map(parcel => `
        <div class="parcel-item">
          <div>${parcel.trackingNumber}</div>
          <div>${parcel.status}</div>
          <div>${new Date(parcel.lastUpdate).toLocaleDateString()}</div>
        </div>
      `).join('');
    }
  } catch (error) {
    showError('parcel-error', 'Failed to load parcels');
  }
}

function showLoading() {
  document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}
