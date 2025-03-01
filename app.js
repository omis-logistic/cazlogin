// ================= CONFIGURATION =================
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwjfsbLN5vpDNz6ghqR8VJbHGA1_SMRkj53LSW7ZdqZot16GgMIPHqi8aedi1vkjrnV/exec';
let currentUser = {
  phone: '',
  email: '',
  token: ''
};

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  checkExistingSession();
});

// ================= EVENT LISTENERS =================
function initializeEventListeners() {
  // Login Page
  document.getElementById('loginButton')?.addEventListener('click', handleLogin);
  document.getElementById('showRegistrationButton')?.addEventListener('click', () => showPage('registration-page'));
  document.getElementById('showForgotPasswordButton')?.addEventListener('click', () => showPage('forgot-password-page'));

  // Registration
  document.getElementById('registerButton')?.addEventListener('click', handleRegistration);

  // Password Recovery
  document.getElementById('passwordRecoveryButton')?.addEventListener('click', handlePasswordRecovery);

  // Dashboard
  document.getElementById('dashboardLogoutButton')?.addEventListener('click', handleLogout);
}

// ================= CORE FUNCTIONS =================
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
      showDashboard();
    } else {
      showError('login-error', response.message);
    }
  } catch (error) {
    showError('global-error', 'Connection failed. Try again.');
  } finally {
    hideLoading();
  }
}

async function callBackend(action, data) {
  try {
    const response = await fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, ...data })
    });

    const text = await response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, message: 'Server connection failed' };
  }
}

// ================= UI FUNCTIONS =================
function showPage(pageId) {
  document.querySelectorAll('.container').forEach(page => {
    page.style.display = page.id === pageId ? 'block' : 'none';
  });
}

function showDashboard() {
  showPage('dashboard-page');
  document.getElementById('user-phone').textContent = currentUser.phone;
  document.getElementById('user-email').textContent = currentUser.email;
}

function showError(elementId, message) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = message;
    element.style.display = 'block';
  }
}

function showLoading() {
  document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

// ================= SESSION MANAGEMENT =================
function checkExistingSession() {
  const session = localStorage.getItem('userSession');
  if (session) {
    try {
      currentUser = JSON.parse(session);
      showDashboard();
    } catch {
      localStorage.removeItem('userSession');
    }
  } else {
    showPage('login-page');
  }
}

function handleLogout() {
  localStorage.removeItem('userSession');
  currentUser = { phone: '', email: '', token: '' };
  showPage('login-page');
}
