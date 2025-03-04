// scripts/app.js
/* ================= CONFIGURATION ================= */
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbwM1Ulc32chPaYLmHaS5adfdaucLxnmJDWAWjXA1T7Hsj6-DXpU_9sX9dfpI3_HV6g/exec',
  SESSION_TIMEOUT: 3600, // 1 hour in seconds
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'application/pdf']
};

/* ================= VIEWPORT MANAGEMENT ================= */
function detectViewMode() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  document.body.classList.add(isMobile ? 'mobile-view' : 'desktop-view');
  
  const viewport = document.querySelector('meta[name="viewport"]') || document.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = isMobile 
    ? 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
    : 'width=1200';
  
  if (!document.querySelector('meta[name="viewport"]')) {
    document.head.prepend(viewport);
  }
}

/* ================= ERROR HANDLING ================= */
function clearErrors() {
  document.querySelectorAll('.error-message').forEach(el => {
    el.textContent = '';
    el.style.display = 'none';
  });
}

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

/* ================= SESSION MANAGEMENT ================= */
function checkSession() {
  const sessionData = sessionStorage.getItem('userData');
  return sessionData ? JSON.parse(sessionData) : null;
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

/* ================= API HANDLER ================= */
async function callAPI(action, payload = {}) {
  try {
    const formData = new FormData();
    
    if (payload.files && payload.files.length > 0) {
      formData.append('data', JSON.stringify({
        action: action,
        ...payload,
        files: undefined
      }));

      payload.files.forEach((file, index) => {
        formData.append(`file${index}`, file, file.name);
      });

      const response = await fetch(CONFIG.GAS_URL, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    }

    const response = await fetch(CONFIG.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'API request failed');
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    showError(error.message || 'Network error');
    return { 
      success: false, 
      message: error.message,
      errorType: error.name || 'APIConnectionError'
    };
  }
}

/* ================= AUTHENTICATION HANDLERS ================= */
async function handleLogin() {
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;

  try {
    const result = await callAPI('processLogin', { phone, password });
    
    if (result.success) {
      // Store raw API response (assuming it contains phone number)
      sessionStorage.setItem('userData', JSON.stringify(result));
      
      // Simple redirect without additional checks
      if (result.tempPassword) {
        window.location.href = 'password-reset.html';
      } else {
        window.location.href = 'dashboard.html';
      }
    } else {
      alert(result.message || 'Login failed');
    }
  } catch (error) {
    alert('Login error: ' + error.message);
  }
}

async function handleRegistration() {
  if (!validateRegistrationForm()) return;

  const formData = {
    phone: document.getElementById('regPhone').value.trim(),
    password: document.getElementById('regPassword').value,
    email: document.getElementById('regEmail').value.trim()
  };

  try {
    const result = await callAPI('createAccount', formData);
    
    if (result.success) {
      alert('Registration successful! Please login.');
      safeRedirect('login.html');
    } else {
      showError(result.message || 'Registration failed');
    }
  } catch (error) {
    showError('Registration failed - please try again');
  }
}

/* ================= PASSWORD MANAGEMENT ================= */
async function handlePasswordRecovery() {
  const phone = document.getElementById('recoveryPhone').value.trim();
  const email = document.getElementById('recoveryEmail').value.trim();

  if (!validatePhone(phone) || !validateEmail(email)) {
    showError('Please check your inputs');
    return;
  }

  try {
    const result = await callAPI('initiatePasswordReset', { phone, email });
    
    if (result.success) {
      alert('Temporary password sent to your email!');
      safeRedirect('login.html');
    } else {
      showError(result.message || 'Password recovery failed');
    }
  } catch (error) {
    showError('Password recovery failed - please try again');
  }
}

async function handlePasswordReset() {
  const newPass = document.getElementById('newPassword').value;
  const confirmPass = document.getElementById('confirmNewPassword').value;
  const userData = JSON.parse(sessionStorage.getItem('userData'));

  if (!validatePassword(newPass)) {
    showError('Password must contain 6+ characters with at least 1 uppercase letter and 1 number');
    return;
  }

  if (newPass !== confirmPass) {
    showError('Passwords do not match');
    return;
  }

  try {
    const result = await callAPI('forcePasswordReset', {
      phone: userData.phone,
      newPassword: newPass
    });

    if (result.success) {
      alert('Password updated successfully! Please login with your new password.');
      handleLogout();
    } else {
      showError(result.message || 'Password reset failed');
    }
  } catch (error) {
    showError('Password reset failed - please try again');
  }
}

/* ================= FORM VALIDATION ================= */
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
  let isValid = true;
  document.querySelectorAll('.error-message').forEach(el => el.textContent = '');

  const elements = {
    phone: document.getElementById('regPhone'),
    password: document.getElementById('regPassword'),
    confirmPassword: document.getElementById('regConfirmPass'),
    email: document.getElementById('regEmail'),
    confirmEmail: document.getElementById('regConfirmEmail')
  };

  if (!validatePhone(elements.phone.value)) {
    document.getElementById('phoneError').textContent = 'Invalid phone format';
    isValid = false;
  }

  if (!validatePassword(elements.password.value)) {
    document.getElementById('passError').textContent = '6+ chars, 1 uppercase, 1 number';
    isValid = false;
  }

  if (elements.password.value !== elements.confirmPassword.value) {
    document.getElementById('confirmPassError').textContent = 'Passwords mismatch';
    isValid = false;
  }

  if (!validateEmail(elements.email.value)) {
    document.getElementById('emailError').textContent = 'Invalid email format';
    isValid = false;
  }

  if (elements.email.value !== elements.confirmEmail.value) {
    document.getElementById('confirmEmailError').textContent = 'Emails mismatch';
    isValid = false;
  }

  return isValid;
}

/* ================= NAVIGATION & UTILITIES ================= */
function safeRedirect(path) {
  try {
    const allowedPaths = [
      'login.html', 'register.html', 'dashboard.html',
      'forgot-password.html', 'password-reset.html',
      'my-info.html', 'parcel-declaration.html', 'track-parcel.html'
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
    timeZone: 'Asia/Kuching'
  };
  return new Date(dateString).toLocaleDateString('en-MY', options);
}

/* ================= UTILITIES ================= */
function getCurrentUserPhone() {
  const userData = checkSession();
  return userData?.phone || null;
}

/* ================= FILE HANDLING ================= */
async function handleFileUpload(files) {
  const uploads = [];
  
  for (const file of files) {
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      showError(`File ${file.name} exceeds 5MB limit`);
      return null;
    }
    
    if (!CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
      showError(`Invalid file type for ${file.name}`);
      return null;
    }

    uploads.push({
      name: file.name,
      type: file.type,
      base64: await readFileAsBase64(file)
    });
  }
  
  return uploads;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

/* ================= INITIALIZATION ================= */
document.addEventListener('DOMContentLoaded', () => {
  detectViewMode();

  const publicPages = ['login.html', 'register.html', 'forgot-password.html'];
  const isPublicPage = publicPages.some(page => 
    window.location.pathname.includes(page)
  );

  if (!isPublicPage) {
    const userData = checkSession();
    if (!userData) return;
    
    if (userData.tempPassword && !window.location.pathname.includes('password-reset.html')) {
      handleLogout();
    }
  }

  window.addEventListener('beforeunload', () => {
    const errorElement = document.getElementById('error-message');
    if (errorElement) errorElement.style.display = 'none';
  });

  const firstInput = document.querySelector('input:not([type="hidden"])');
  if (firstInput) firstInput.focus();
});
