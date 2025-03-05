// scripts/app.js
// ================= CONFIGURATION =================
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbyF2DlAkt2EosKzpjZ3P312uauckf1VtZTieCUqloE9wDlL-GvtfuebHJ-f_AWDTCcT/exec',
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
  const currentTime = Date.now();

  // Immediate validation checks
  if (!sessionData) {
    handleLogout();
    return null;
  }

  // Parse session data
  let userData;
  try {
    userData = JSON.parse(sessionData);
    if (!userData?.phone || typeof userData.phone !== 'string') {
      throw new Error('Invalid session format');
    }
  } catch (e) {
    console.error('Session parse error:', e);
    handleLogout();
    return null;
  }

  // Validate phone format
  if (!userData.phone.match(/^(673\d{7}|60\d{8,9})$/)) {
    console.error('Invalid phone in session:', userData.phone);
    handleLogout();
    return null;
  }

  // Check session timeout
  if (lastActivity && (currentTime - parseInt(lastActivity)) > CONFIG.SESSION_TIMEOUT * 1000) {
    handleLogout();
    return null;
  }

  // Temp password handling
  if (userData.tempPassword && !window.location.pathname.endsWith('password-reset.html')) {
    safeRedirect('password-reset.html');
    return null;
  }

  // Renew activity timestamp
  localStorage.setItem('lastActivity', currentTime.toString());

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
  const callbackName = `jsonp_${Date.now()}`;
  const script = document.createElement('script');
  const params = new URLSearchParams({
    action: action,
    callback: callbackName,
    ...payload
  });

  try {
    script.src = `${CONFIG.GAS_URL}?${params}`;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timed out'));
      }, 15000);

      window[callbackName] = (response) => {
        clearTimeout(timeout);
        delete window[callbackName];
        document.body.removeChild(script);
        
        if (!response) {
          reject(new Error('Empty response from server'));
          return;
        }
        
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.message || 'API request failed'));
        }
      };

      document.body.appendChild(script);
    });
  } catch (error) {
    console.error('API Error:', error);
    showError(error.message || 'Network error');
    throw error;
  }
}

// ================= AUTHENTICATION HANDLERS =================
async function handleLogin() {
  const phoneInput = document.getElementById('phone');
  const passwordInput = document.getElementById('password');
  const phone = phoneInput.value.trim();
  const password = passwordInput.value;

  try {
    // Clear previous errors
    phoneInput.classList.remove('error');
    passwordInput.classList.remove('error');
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');

    // Validation
    if (!validatePhone(phone)) throw new Error('Invalid phone number format');
    if (!password) throw new Error('Please enter your password');

    // API call
    const response = await callAPI('processLogin', { phone, password });

    // Handle response
    sessionStorage.setItem('userData', JSON.stringify(response));
    localStorage.setItem('lastActivity', Date.now().toString());

    if (response.tempPassword) {
      safeRedirect('password-reset.html');
    } else {
      safeRedirect('dashboard.html');
    }

  } catch (error) {
    showError(error.message);
    passwordInput.classList.add('error');
  }
}

async function handleRegistration() {
  const form = document.forms['registrationForm'];
  try {
    if (!validateRegistrationForm()) return;

    const response = await callAPI('createAccount', {
      phone: form.regPhone.value.trim(),
      password: form.regPassword.value,
      email: form.regEmail.value.trim()
    });

    alert('Registration successful! Please login.');
    safeRedirect('login.html');

  } catch (error) {
    showError(error.message);
  }
}

// ================= PASSWORD MANAGEMENT =================
async function handlePasswordRecovery() {
  const form = document.forms['recoveryForm'];
  try {
    const response = await callAPI('initiatePasswordReset', {
      phone: form.recoveryPhone.value.trim(),
      email: form.recoveryEmail.value.trim()
    });

    alert('Temporary password sent to registered email!');
    safeRedirect('login.html');

  } catch (error) {
    showError(error.message);
  }
}

async function handlePasswordReset() {
  const form = document.forms['resetForm'];
  const submitBtn = document.getElementById('resetBtn');
  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="loader"></div> Processing...';

    const userData = checkSession();
    if (!userData) throw new Error('Session expired');

    // Validate inputs
    if (form.newPassword.value !== form.confirmNewPassword.value) {
      throw new Error('Passwords do not match');
    }
    if (!validatePassword(form.newPassword.value)) {
      throw new Error('Password requires 6+ chars with 1 uppercase and 1 number');
    }

    // API call
    const response = await callAPI('forcePasswordReset', {
      phone: userData.phone,
      newPassword: form.newPassword.value
    });

    alert('Password updated successfully! Please login.');
    handleLogout();

  } catch (error) {
    showError(error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Reset Password';
  }
}

// ================= FORM VALIDATION =================
function validatePhone(phone) {
  return /^(673\d{7}|60\d{8,9})$/.test(phone);
}

function validatePassword(password) {
  return /^(?=.*[A-Z])(?=.*\d).{6,}$/.test(password);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateRegistrationForm() {
  const form = document.forms['registrationForm'];
  let isValid = true;

  // Clear errors
  document.querySelectorAll('.error-message').forEach(el => el.textContent = '');

  // Phone validation
  if (!validatePhone(form.regPhone.value)) {
    document.getElementById('phoneError').textContent = 'Invalid phone format';
    isValid = false;
  }

  // Password validation
  if (!validatePassword(form.regPassword.value)) {
    document.getElementById('passError').textContent = '6+ chars, 1 uppercase, 1 number';
    isValid = false;
  }

  // Password match
  if (form.regPassword.value !== form.regConfirmPass.value) {
    document.getElementById('confirmPassError').textContent = 'Passwords mismatch';
    isValid = false;
  }

  // Email validation
  if (!validateEmail(form.regEmail.value)) {
    document.getElementById('emailError').textContent = 'Invalid email format';
    isValid = false;
  }

  // Email match
  if (form.regEmail.value !== form.regConfirmEmail.value) {
    document.getElementById('confirmEmailError').textContent = 'Emails mismatch';
    isValid = false;
  }

  return isValid;
}

// ================= NAVIGATION & UTILITIES =================
function safeRedirect(path) {
  const allowedPaths = [
    'login.html', 'register.html', 'dashboard.html',
    'forgot-password.html', 'password-reset.html',
    'my-info.html', 'parcel-declaration.html', 'track-parcel.html'
  ];

  if (allowedPaths.includes(path)) {
    window.location.href = path;
  } else {
    console.error('Attempted redirect to unauthorized path:', path);
  }
}

// ================= FILE HANDLING =================
async function handleFileUpload(fileInput) {
  const files = Array.from(fileInput.files);
  const uploads = [];
  
  for (const file of files) {
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      throw new Error(`File ${file.name} exceeds 5MB limit`);
    }
    
    if (!CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
      throw new Error(`Invalid file type for ${file.name}`);
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

  // Session check for protected pages
  const publicPages = ['login.html', 'register.html', 'forgot-password.html'];
  const isPublicPage = publicPages.some(page => 
    window.location.pathname.endsWith(page)
  );

  if (!isPublicPage) {
    const userData = checkSession();
    if (!userData) return;

    // Handle temp password redirect
    if (userData.tempPassword && !window.location.pathname.endsWith('password-reset.html')) {
      handleLogout();
    }
  }

  // Auto-focus first input
  const firstInput = document.querySelector('form input:not([type="hidden"])');
  if (firstInput) firstInput.focus();

  // Error cleanup
  window.addEventListener('beforeunload', () => {
    const errorElement = document.getElementById('error-message');
    if (errorElement) errorElement.style.display = 'none';
  });
});
