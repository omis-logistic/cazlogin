// scripts/app.js
// ================= SHARED APPLICATION FUNCTIONS =================

// Error handling system
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

// Session management
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

// Form validation utilities
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

// ================= REGISTRATION FUNCTIONS =================
function validateRegistrationForm() {
  const phone = document.getElementById('regPhone').value;
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPass').value;
  const email = document.getElementById('regEmail').value;
  const confirmEmail = document.getElementById('regConfirmEmail').value;

  let isValid = true;

  // Phone validation
  if (!validatePhone(phone)) {
    document.getElementById('phoneError').textContent = 'Invalid phone format';
    isValid = false;
  }

  // Password validation
  if (!validatePassword(password)) {
    document.getElementById('passError').textContent = '6+ chars, 1 uppercase, 1 number';
    isValid = false;
  }

  // Password match
  if (password !== confirmPassword) {
    document.getElementById('confirmPassError').textContent = 'Passwords mismatch';
    isValid = false;
  }

  // Email validation
  if (!validateEmail(email)) {
    document.getElementById('emailError').textContent = 'Invalid email format';
    isValid = false;
  }

  // Email match
  if (email !== confirmEmail) {
    document.getElementById('confirmEmailError').textContent = 'Emails mismatch';
    isValid = false;
  }

  return isValid;
}

function handleRegistration() {
  if (!validateRegistrationForm()) return;
  
  // Get form data
  const formData = {
    phone: document.getElementById('regPhone').value,
    password: document.getElementById('regPassword').value,
    email: document.getElementById('regEmail').value
  };

  // Call GAS endpoint
  fetch(GAS_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      action: 'createAccount',
      ...formData
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      alert('Registration successful!');
      window.location.href = 'login.html';
    } else {
      showError(data.message);
    }
  })
  .catch(error => showError('Registration failed: ' + error.message));
}

// Parcel system utilities
function formatTrackingNumber(trackingNumber) {
  return trackingNumber.replace(/\s/g, '').toUpperCase();
}

function validateTrackingNumber(trackingNumber) {
  return /^[A-Z0-9]{10,}$/i.test(trackingNumber);
}

// Currency formatting
function formatCurrency(amount) {
  return new Intl.NumberFormat('ms-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2
  }).format(amount);
}

// Date formatting
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

// Safe redirect function
function safeRedirect(path) {
  try {
    if (typeof path !== 'string') throw new Error('Invalid path');
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

// Initialization checks
document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.includes('login.html')) {
    checkSession();
  }
  
  // Clear error messages on page change
  window.addEventListener('beforeunload', () => {
    const errorElement = document.getElementById('error-message');
    if (errorElement) errorElement.style.display = 'none';
  });
});
