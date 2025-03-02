// scripts/app.js
// ================= GLOBAL CONFIGURATION =================
const GAS_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

// ================= ERROR HANDLING SYSTEM =================
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
  try {
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    if (!userData) {
      safeRedirect('login.html');
      return null;
    }
    return userData;
  } catch (error) {
    console.error('Session check error:', error);
    safeRedirect('login.html');
    return null;
  }
}

function handleLogout() {
  try {
    sessionStorage.removeItem('userData');
    safeRedirect('login.html');
  } catch (error) {
    console.error('Logout error:', error);
    showError('Failed to logout properly');
  }
}

// ================= NAVIGATION CONTROL =================
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
    
    if (!allowedPaths.includes(path)) {
      throw new Error('Unauthorized redirect path');
    }
    
    window.location.href = path;
  } catch (error) {
    console.error('Redirect error:', error);
    showError('Navigation failed. Please try again.');
  }
}

function showLogin() {
  safeRedirect('login.html');
}

function showRegistration() {
  safeRedirect('register.html');
}

// ================= FORM VALIDATION UTILITIES =================
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

// ================= PASSWORD RECOVERY HANDLER =================
function handlePasswordRecovery() {
  const phone = document.getElementById('recoveryPhone').value;
  const email = document.getElementById('recoveryEmail').value;

  // Clear previous errors
  document.querySelectorAll('.error-message').forEach(el => el.textContent = '');

  // Validate inputs
  let isValid = true;
  if (!validatePhone(phone)) {
    showError('Invalid phone format', 'phoneRecoveryError');
    isValid = false;
  }
  if (!validateEmail(email)) {
    showError('Invalid email format', 'emailRecoveryError');
    isValid = false;
  }
  if (!isValid) return;

  // JSONP implementation
  const callbackName = `jsonp_${Date.now()}`;
  const script = document.createElement('script');
  script.src = `${GAS_URL}?action=initiatePasswordReset&phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}&callback=${callbackName}`;

  window[callbackName] = function(response) {
    delete window[callbackName];
    document.body.removeChild(script);
    
    if (response.success) {
      alert('Temporary password sent! Check your email.');
      safeRedirect('login.html');
    } else {
      showError(response.message || 'Password recovery failed');
    }
  };

  document.body.appendChild(script);
}

// ================= INITIALIZATION & EVENT HANDLERS =================
document.addEventListener('DOMContentLoaded', () => {
  const publicPages = [
    'login.html',
    'register.html',
    'forgot-password.html'
  ];
  
  const isPublicPage = publicPages.some(page => 
    window.location.pathname.includes(page)
  );

  if (!isPublicPage) {
    checkSession();
  }

  window.addEventListener('beforeunload', () => {
    const errorElement = document.getElementById('error-message');
    if (errorElement) errorElement.style.display = 'none';
  });
});
