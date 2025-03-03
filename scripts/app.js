// scripts/app.js
// ================= CONFIGURATION =================
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbxfQ-PznE_LA5bpTJhJau3EvDi935IQLb57DMQGSE3GRxGMT_aB0g5afZBEdfoRXrRv/exec',
  SESSION_TIMEOUT: 3600 // 1 hour in seconds
};

// ================= VIEWPORT MANAGEMENT =================
function detectViewMode() {
  const isMobile = (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) // iPad detection
  );
  
  const bodyClass = isMobile ? 'mobile-view' : 'desktop-view';
  document.body.classList.add(bodyClass);
  
  const viewport = document.querySelector('meta[name="viewport"]') || document.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = isMobile 
    ? 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
    : 'width=1200';
  
  if (!document.querySelector('meta[name="viewport"]')) {
    document.head.prepend(viewport);
  }
}

// ================= ERROR HANDLING =================
function showError(message, targetId = 'error-message') {
  const errorElement = document.getElementById(targetId) || createErrorElement();
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  
  setTimeout(() => {
    errorElement.style.display = 'none';
  }, 5000);
}

function createErrorElement() {
  const errorDiv = document.createElement('div');
  errorDiv.id = 'error-message';
  errorDiv.className = 'error-message';
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 15px;
    background: #ff4444dd;
    color: white;
    border-radius: 5px;
    z-index: 1000;
    display: none;
  `;
  document.body.prepend(errorDiv);
  return errorDiv;
}

// ================= SESSION MANAGEMENT =================
function checkSession() {
  const sessionData = sessionStorage.getItem('userData');
  const lastActivity = localStorage.getItem('lastActivity');

  if (!sessionData || 
      (lastActivity && Date.now() - lastActivity > CONFIG.SESSION_TIMEOUT * 1000)) {
    handleLogout();
    return null;
  }

  localStorage.setItem('lastActivity', Date.now());
  return JSON.parse(sessionData);
}

function handleLogout() {
  try {
    sessionStorage.removeItem('userData');
    localStorage.removeItem('lastActivity');
    safeRedirect('login.html');
  } catch (error) {
    console.error('Logout error:', error);
    showError('Failed to logout properly');
  }
}

// ================= API HANDLER =================
async function callAPI(action, payload = {}) {
  try {
    const isGetRequest = ['getParcelData', 'processLogin'].includes(action);
    
    if (isGetRequest) {
      const params = new URLSearchParams({...payload, action});
      const response = await fetch(`${CONFIG.GAS_URL}?${params}`);
      return await response.json();
    } else {
      const response = await fetch(CONFIG.GAS_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action, ...payload})
      });
      return await response.json();
    }
  } catch (error) {
    showError(`API Error: ${error.message}`);
    return { success: false, message: 'Network error' };
  }
}

// ================= AUTHENTICATION HANDLERS =================
async function handleLogin() {
  const phone = document.getElementById('phone').value;
  const password = document.getElementById('password').value;
  
  if (!phone || !password) {
    showError('Please fill in all fields');
    return;
  }

  const result = await callAPI('processLogin', { phone, password });
  
  if (result.success) {
    sessionStorage.setItem('userData', JSON.stringify(result));
    localStorage.setItem('lastActivity', Date.now());
    safeRedirect(result.tempPassword ? 'password-reset.html' : 'dashboard.html');
  } else {
    showError(result.message);
  }
}

async function handleRegistration() {
  if (!validateRegistrationForm()) return;

  const formData = {
    phone: document.getElementById('regPhone').value,
    password: document.getElementById('regPassword').value,
    email: document.getElementById('regEmail').value
  };

  const result = await callAPI('createAccount', formData);
  
  if (result.success) {
    alert('Registration successful! Please login.');
    safeRedirect('login.html');
  } else {
    showError(result.message);
  }
}

async function updateUserPassword(currentPassword, newPassword, confirmPassword) {
  const userData = JSON.parse(sessionStorage.getItem('userData'));
  return await callAPI('updatePassword', {
    phone: userData.phone,
    currentPassword: currentPassword,
    newPassword: newPassword,
    confirmPassword: confirmPassword
  });
}

async function updateUserEmail(currentPassword, newEmail, confirmEmail) {
  const userData = JSON.parse(sessionStorage.getItem('userData'));
  return await callAPI('updateEmail', {
    phone: userData.phone,
    currentPassword: currentPassword,
    newEmail: newEmail,
    confirmEmail: confirmEmail
  });
}

// ================= PASSWORD MANAGEMENT =================
async function handlePasswordRecovery() {
  const phone = document.getElementById('recoveryPhone').value.trim();
  const email = document.getElementById('recoveryEmail').value.trim();
  
  if (!validatePhone(phone)) {
    showError('Invalid phone format', 'phoneRecoveryError');
    return;
  }
  
  if (!validateEmail(email)) {
    showError('Invalid email format', 'emailRecoveryError');
    return;
  }

  const result = await callAPI('initiatePasswordReset', { phone, email });
  
  if (result.success) {
    alert('Temporary password sent to your email!');
    safeRedirect('login.html');
  } else {
    showError(result.message);
  }
}

async function handlePasswordReset() {
  const newPass = document.getElementById('newPassword').value;
  const confirmPass = document.getElementById('confirmNewPassword').value;
  const userData = JSON.parse(sessionStorage.getItem('userData'));

  if (!validatePassword(newPass)) {
    showError('Invalid password format', 'newPasswordError');
    return;
  }

  if (newPass !== confirmPass) {
    showError('Passwords do not match', 'confirmPasswordError');
    return;
  }

  const result = await callAPI('updatePassword', {
    phone: userData.phone,
    newPassword: newPass
  });

  if (result.success) {
    handleLogout();
    alert('Password updated successfully!');
  } else {
    showError(result.message);
  }
}

// ================= FORM VALIDATION =================
function validatePhone(phone) {
  const regex = /^(673\d{7,}|60\d{9,})$/;
  return regex.test(phone);
}

function validatePassword(password) {
  const regex = /^(?=.*[A-Z])(?=.*\d).{6,}$/;
  return regex.test(password);
}

function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validateRegistrationForm() {
  const phone = document.getElementById('regPhone').value;
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPass').value;
  const email = document.getElementById('regEmail').value;
  const confirmEmail = document.getElementById('regConfirmEmail').value;

  let isValid = true;
  document.querySelectorAll('.error-message').forEach(el => el.textContent = '');

  if (!validatePhone(phone)) {
    document.getElementById('phoneError').textContent = 'Invalid phone format';
    isValid = false;
  }

  if (!validatePassword(password)) {
    document.getElementById('passError').textContent = '6+ chars, 1 uppercase, 1 number';
    isValid = false;
  }

  if (password !== confirmPassword) {
    document.getElementById('confirmPassError').textContent = 'Passwords mismatch';
    isValid = false;
  }

  if (!validateEmail(email)) {
    document.getElementById('emailError').textContent = 'Invalid email format';
    isValid = false;
  }

  if (email !== confirmEmail) {
    document.getElementById('confirmEmailError').textContent = 'Emails mismatch';
    isValid = false;
  }

  return isValid;
}

// ================= NAVIGATION & UTILITIES =================
function safeRedirect(path) {
  try {
    const allowedPaths = [
      'login.html',
      'register.html',
      'dashboard.html',
      'forgot-password.html',
      'password-reset.html',
      'my-info.html',
      'parcel-declaration.html',
      'track-parcel.html'
    ];
    
    if (!allowedPaths.includes(path)) throw new Error('Unauthorized path');
    window.location.href = path;
  } catch (error) {
    console.error('Redirect error:', error);
    showError('Navigation failed. Please try again.');
  }
}

function formatTrackingNumber(trackingNumber) {
  return trackingNumber.replace(/\s/g, '').toUpperCase();
}

function validateTrackingNumber(trackingNumber) {
  return /^[A-Z0-9]{10,}$/i.test(trackingNumber);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('ms-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2
  }).format(amount);
}

function formatDate(dateString) {
  const options = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Singapore'
  };
  return new Date(dateString).toLocaleDateString('en-MY', options);
}

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  // Auto-detect view mode
  detectViewMode();

  // Session management
  const publicPages = ['login.html', 'register.html', 'forgot-password.html'];
  const isPublicPage = publicPages.some(page => 
    window.location.pathname.includes(page)
  );

  if (!isPublicPage) {
    const userData = checkSession();
    if (userData?.tempPassword && !window.location.pathname.includes('password-reset.html')) {
      safeRedirect('password-reset.html');
    }
  }

  // Error cleanup
  window.addEventListener('beforeunload', () => {
    const errorElement = document.getElementById('error-message');
    if (errorElement) errorElement.style.display = 'none';
  });
});
