// scripts/app.js
// ================= ERROR HANDLING SYSTEM =================
function showError(message, duration = 5000) {
  const errorElement = document.getElementById('error-message') || createErrorElement();
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  
  setTimeout(() => {
    errorElement.style.display = 'none';
  }, duration);
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
      window.location.href = 'login.html';
      return null;
    }
    return userData;
  } catch (error) {
    console.error('Session check error:', error);
    window.location.href = 'login.html';
    return null;
  }
}

function handleLogout() {
  try {
    sessionStorage.removeItem('userData');
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Logout error:', error);
    showError('Failed to logout properly');
  }
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

// ================= SAFE REDIRECT FUNCTION =================
function safeRedirect(path) {
  try {
    const allowedPaths = [
      'login.html',
      'dashboard.html',
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
    showError('Unable to complete navigation');
  }
}

// ================= INITIALIZATION CHECKS =================
document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.includes('login.html')) {
    checkSession();
  }
  
  window.addEventListener('beforeunload', () => {
    const errorElement = document.getElementById('error-message');
    if (errorElement) errorElement.style.display = 'none';
  });
});
