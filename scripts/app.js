// scripts/app.js
// ================= CONFIGURATION =================
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbysh-cRUOClg40_RlcXqUbLp7GhHBusu4g05mTleMJ7LlKBKtP0bAvUMoiFNvSRHarb/exec',
  SESSION_TIMEOUT: 3600, // 1 hour in seconds
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'application/pdf']
};

// ================= VIEWPORT MANAGEMENT =================
function detectViewMode() {
  const isMobile = (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
  
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
  const userData = JSON.parse(sessionData);
  
  // Force password reset if using temporary password
  if (userData?.tempPassword && !window.location.pathname.includes('password-reset.html')) {
    handleLogout();
    return null;
  }

  return userData;
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
    const formData = new FormData();
    
    if (payload.filesBase64 && payload.filesBase64.length > 0) {
      payload.filesBase64.forEach((file, index) => {
        const byteArray = Uint8Array.from(atob(file.base64), c => c.charCodeAt(0));
        const blob = new Blob([byteArray], { 
          type: file.type || 'application/octet-stream'
        });
        formData.append(`file${index}`, blob, file.name);
      });
    }

    // Add main data payload
    formData.append('data', JSON.stringify({
      action: action,
      ...payload,
      filesBase64: undefined // Remove files from JSON payload
    }));

    const response = await fetch(CONFIG.GAS_URL, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    showError(error.message || 'Network error');
    return { success: false, message: error.message };
  }
}
// ================= AUTHENTICATION HANDLERS =================
async function handleLogin() {
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;

  if (!validatePhone(phone)) {
    showError('Invalid phone number format');
    return;
  }

  if (!password) {
    showError('Please enter your password');
    return;
  }

  try {
    const result = await callAPI('processLogin', { phone, password }, 'GET');
    
    if (result.success) {
      sessionStorage.setItem('userData', JSON.stringify(result));
      localStorage.setItem('lastActivity', Date.now());
      
      if (result.tempPassword) {
        safeRedirect('password-reset.html');
      } else {
        safeRedirect('dashboard.html');
      }
    } else {
      showError(result.message || 'Authentication failed');
    }
  } catch (error) {
    showError('Login failed - please try again');
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

// ================= PASSWORD MANAGEMENT =================
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
    
    if (!allowedPaths.includes(path)) {
      throw new Error('Unauthorized path');
    }
    
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

// ================= FILE HANDLING =================
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

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  detectViewMode();

  // Session management
  const publicPages = ['login.html', 'register.html', 'forgot-password.html'];
  const isPublicPage = publicPages.some(page => 
    window.location.pathname.includes(page)
  );

  if (!isPublicPage) {
    const userData = checkSession();
    if (!userData) return;
    
    // Handle temporary password state
    if (userData.tempPassword && !window.location.pathname.includes('password-reset.html')) {
      handleLogout();
    }
  }

  // Error cleanup
  window.addEventListener('beforeunload', () => {
    const errorElement = document.getElementById('error-message');
    if (errorElement) errorElement.style.display = 'none';
  });

  // Auto-focus first input
  const firstInput = document.querySelector('input:not([type="hidden"])');
  if (firstInput) firstInput.focus();
});

/* styles/main.css */
/* ======== BASE STYLES ======== */
:root {
  --dark-bg: #1a1a1a;
  --gold: #c5a047;
  --text-light: #ffffff;
  --hover-gold: #d4af37;
  --error-red: #ff4444;
  --success-green: #00C851;
  --modal-bg: #1a1a1a;
  --section-bg: rgba(255,255,255,0.05);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-text-size-adjust: 100%;
}

body {
  font-family: 'Arial', sans-serif;
  background-color: var(--dark-bg);
  color: var(--text-light);
  line-height: 1.6;
  min-height: 100vh;
  position: relative;
}

/* ======== COMMON COMPONENTS ======== */
.container {
  background: rgba(0, 0, 0, 0.7);
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 0 20px var(--gold);
  margin: 1rem auto;
}

h1, h2, h3 {
  color: var(--gold);
  margin-bottom: 1.5rem;
}

.input-group {
  margin-bottom: 1.5rem;
}

input, select, button {
  width: 100%;
  padding: 0.8rem;
  margin: 0.5rem 0;
  border: 1px solid var(--gold);
  border-radius: 5px;
  transition: all 0.3s ease;
}

button {
  background-color: var(--gold);
  color: var(--dark-bg);
  font-weight: bold;
  cursor: pointer;
}

button:hover {
  opacity: 0.9;
}

.error-message {
  color: var(--error-red);
  font-size: 0.9em;
  min-height: 1.2em;
}

/* ======== MOBILE FIRST STYLES ======== */
body.mobile-view {
  padding: 0.5rem !important;
  font-size: 16px !important;
  display: block !important;
}

body.mobile-view .container {
  width: 95% !important;
  max-width: 100% !important;
  padding: 1rem !important;
  margin: 0.5rem auto !important;
}

body.mobile-view input,
body.mobile-view button,
body.mobile-view select {
  font-size: 16px !important;
  padding: 12px !important;
  min-height: 44px;
}

body.mobile-view .thumbnail {
  margin: 15px 0 !important;
  padding: 15px !important;
}

/* ======== DESKTOP OVERRIDES ======== */
body.desktop-view {
  padding: 2rem;
  font-size: 14px;
}

body.desktop-view .container {
  max-width: 1200px;
  padding: 2rem;
}

/* ======== MODAL STYLES ======== */
.welcome-modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.9);
  z-index: 9999;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.welcome-content {
  background-color: var(--modal-bg);
  margin: 2% auto;
  padding: 2rem;
  border: 2px solid var(--gold);
  border-radius: 10px;
  max-width: 800px;
  position: relative;
  max-height: 90vh;
}

body.mobile-view .welcome-content {
  width: 95% !important;
  margin: 10px auto !important;
  padding: 15px !important;
}

/* ======== RESPONSIVE DESIGN ======== */
@media screen and (max-width: 768px) {
  body {
    font-size: 16px;
  }
  
  h1 {
    font-size: 1.5rem;
  }

  .container {
    padding: 1rem;
  }

  button {
    min-height: 44px;
  }
}

@media screen and (min-width: 769px) {
  .thumbnail {
    width: 30%;
    display: inline-block;
    margin: 1rem;
  }
}

/* ======== UTILITY CLASSES ======== */
.gold-text {
  color: var(--gold) !important;
}

.text-important {
  color: var(--gold);
  font-weight: bold;
}

.mobile-only {
  display: none !important;
}

.desktop-only {
  display: block !important;
}

body.mobile-view .mobile-only {
  display: block !important;
}

body.mobile-view .desktop-only {
  display: none !important;
}

/* ======== ANIMATIONS ======== */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { 
    opacity: 0;
    transform: translateY(20px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}
