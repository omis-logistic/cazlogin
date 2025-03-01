// ================= CONFIGURATION =================
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwOwz2oa1pYV62nMGGOVLxSDw1fO8Ae1EbL8eWPPrtdqVYr2Rh9egZwPfRYO1slOFvS/exec'; // Replace with actual URL
let currentUser = {
  phone: '',
  email: '',
  token: ''
};

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  showPage('login-page');
  checkExistingSession();
});

// ================= EVENT MANAGEMENT =================
function initializeEventListeners() {
  // Auth Handlers
  addListener('[data-action="login"]', handleLogin);
  addListener('[data-action="register"]', handleRegistration);
  addListener('[data-action="forgot-password"]', handlePasswordRecovery);
  
  // Navigation
  addListener('[data-action="show-login"]', () => showPage('login-page'));
  addListener('[data-action="show-register"]', () => showPage('registration-page'));
  addListener('[data-action="show-dashboard"]', () => showPage('dashboard-page'));
  
  // Parcel Handling
  addListener('[data-action="submit-parcel"]', handleParcelSubmission);
  
  // User Actions
  addListener('[data-action="logout"]', handleLogout);
  addListener('[data-action="update-password"]', handlePasswordReset);
}

function addListener(selector, handler) {
  document.querySelector(selector)?.addEventListener('click', handler);
}

// ================= AUTH HANDLERS =================
async function handleLogin(event) {
  event.preventDefault();
  showLoading();
  
  try {
    const response = await callBackend('processLogin', {
      phone: getValue('phone'),
      password: getValue('password')
    });

    if (response.success) {
      localStorage.setItem('userSession', JSON.stringify(response));
      window.location.href = '#dashboard';
    } else {
      showError('login-error', response.message);
    }
  } catch (error) {
    showError('global-error', 'Connection failed. Try again later.');
  } finally {
    hideLoading();
  }
}

// ================= EVENT LISTENERS =================
function initializeEventListeners() {
  // Explicit button bindings
  document.getElementById('passwordRecoveryButton')?.addEventListener('click', handlePasswordRecovery);
  document.getElementById('registerButton')?.addEventListener('click', handleRegistration);
  document.getElementById('loginButton')?.addEventListener('click', handleLogin);
  
  // Page navigation
  document.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', () => {
      showPage(button.dataset.action.replace('show-', ''));
    });
  });
}

// ================= API COMMUNICATION =================
async function callBackend(action, data) {
  try {
    // Add timestamp to bypass cache
    const url = new URL(GAS_WEBAPP_URL);
    url.searchParams.set('t', Date.now());

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
  document.querySelectorAll('.page').forEach(page => {
    page.style.display = page.id === pageId ? 'block' : 'none';
  });
}

function showDashboard() {
  showPage('dashboard-page');
  loadUserData();
  loadParcelData();
}

function showError(containerId, message) {
  const container = document.getElementById(containerId);
  if (container) {
    container.textContent = message;
    container.style.display = 'block';
  }
}

function showSuccess(message) {
  const successModal = document.getElementById('success-message');
  successModal.textContent = message;
  successModal.style.display = 'block';
  setTimeout(() => successModal.style.display = 'none', 3000);
}

function showLoading() {
  document.getElementById('loading').style.display = 'block';
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

// ================= DATA MANAGEMENT =================
function loadUserData() {
  document.getElementById('user-phone').textContent = currentUser.phone;
  document.getElementById('user-email').textContent = currentUser.email;
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
    showError('parcel-error', 'Failed to load parcels');
  }
}

// ================= UTILITIES =================
function getValue(elementId) {
  return document.getElementById(elementId)?.value.trim();
}

function validateRegistration(phone, password, email) {
  const phoneRegex = /^(673\d{7,}|60\d{9,})$/;
  const passRegex = /^(?=.*[A-Z])(?=.*\d).{6,}$/;
  
  if (!phoneRegex.test(phone)) {
    showError('registration-error', 'Invalid phone format');
    return false;
  }
  
  if (!passRegex.test(password)) {
    showError('registration-error', 'Password must contain 6+ characters with 1 uppercase and 1 number');
    return false;
  }
  
  if (!validateEmail(email)) {
    showError('registration-error', 'Invalid email format');
    return false;
  }
  
  return true;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ================= SESSION MANAGEMENT =================
function checkExistingSession() {
  const storedSession = localStorage.getItem('userSession');
  if (storedSession) {
    currentUser = JSON.parse(storedSession);
    showDashboard();
  }
}

function handleLogout() {
  localStorage.removeItem('userSession');
  currentUser = { phone: '', email: '', token: '' };
  showPage('login-page');
}
