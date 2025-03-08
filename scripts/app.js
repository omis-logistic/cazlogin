// scripts/app.js
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbzsKNVsscPBlWeRw0ERlMn8PN_NxzGXy-9Nyy72iJW-V5YFZPLAZGM8HKwjZuMOtIDh/exec',
  MAX_FILES: 3,
  MAX_FILE_SIZE: 5242880, // 5MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
  SESSION_TIMEOUT: 1800 // 30 minutes
};

// ================= CORE FUNCTIONS =================
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

// ================= API HANDLER =================
async function callAPI(action, payload) {
  try {
    const url = new URL(CONFIG.GAS_URL);
    const params = new URLSearchParams({ action, ...payload });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
      redirect: 'follow',
      mode: 'cors'
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    return {
      success: false,
      message: 'Connection to server failed',
      error: error.message
    };
  }
}

// ================= SESSION MANAGEMENT =================
function checkSession() {
  const sessionData = sessionStorage.getItem('userData');
  const lastActivity = localStorage.getItem('lastActivity');

  if (!sessionData) {
    handleLogout();
    return null;
  }

  if (lastActivity && Date.now() - lastActivity > CONFIG.SESSION_TIMEOUT * 1000) {
    handleLogout();
    return null;
  }

  localStorage.setItem('lastActivity', Date.now());
  const userData = JSON.parse(sessionData);
  
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

// ================= FORM HANDLERS =================
async function handleLogin(event) {
  event.preventDefault();
  const btn = document.getElementById('loginButton');
  const errorElement = document.getElementById('error-message');
  
  try {
    btn.disabled = true;
    errorElement.style.display = 'none';

    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;

    if (!validatePhone(phone)) {
      throw new Error('Invalid phone number format');
    }

    const response = await callAPI('processLogin', { phone, password });

    if (response.success) {
      sessionStorage.setItem('userData', JSON.stringify({
        phone: response.phone,
        email: response.email,
        tempPassword: response.tempPassword
      }));
      
      window.location.href = response.tempPassword ? 
        'password-reset.html' : 'dashboard.html';
    } else {
      throw new Error(response.message || 'Authentication failed');
    }
  } catch (error) {
    errorElement.textContent = error.message;
    errorElement.style.display = 'block';
  } finally {
    btn.disabled = false;
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

// ================= PARCEL DECLARATION =================
async function handleParcelSubmission() {
  try {
    const filesInput = document.getElementById('invoiceFiles');
    const files = await handleFileUpload(filesInput.files);
    if (!files) return;

    const submissionData = {
      trackingNumber: formatTrackingNumber(
        document.getElementById('trackingNumber').value
      ),
      nameOnParcel: document.getElementById('nameOnParcel').value.trim(),
      phoneNumber: document.getElementById('phoneNumber').value.trim(),
      itemDescription: document.getElementById('itemDescription').value.trim(),
      quantity: parseInt(document.getElementById('quantity').value),
      price: parseFloat(document.getElementById('price').value),
      collectionPoint: document.getElementById('collectionPoint').value,
      itemCategory: document.getElementById('itemCategory').value
    };

    const formData = new FormData();
    formData.append('data', JSON.stringify({
      action: 'submitParcelDeclaration',
      ...submissionData
    }));
    
    files.forEach((file, index) => {
      formData.append(`file${index}`, new Blob([file.base64], { type: file.type }), file.name);
    });

    const response = await fetch(CONFIG.GAS_URL, {
      method: 'POST',
      body: formData,
      mode: 'cors'
    });

    const result = await response.json();
    
    if (result.success) {
      alert(`Declaration submitted! Tracking: ${result.trackingNumber}`);
      safeRedirect('dashboard.html');
    } else {
      showError(result.message || 'Submission failed');
    }
  } catch (error) {
    showError(error.message);
  }
}

// ================= VALIDATION UTILITIES =================
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

function validateTrackingNumber(input) {
  const value = input?.value?.trim() || '';
  const isValid = /^[A-Z0-9-]{5,}$/i.test(value);
  showError(isValid ? '' : '5+ chars (letters, numbers, hyphens)', 'trackingNumberError');
  return isValid;
}

// ================= FILE HANDLING =================
async function handleFileUpload(files) {
  if (files.length > CONFIG.MAX_FILES) {
    showError(`Maximum ${CONFIG.MAX_FILES} files allowed`);
    return null;
  }

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

// ================= UI UTILITIES =================
function showError(message, targetId = 'error-message') {
  const errorElement = document.getElementById(targetId) || createErrorElement();
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  
  setTimeout(() => {
    errorElement.style.display = 'none';
  }, 5000);
}

function safeRedirect(path) {
  const allowedPaths = [
    'login.html', 'register.html', 'dashboard.html',
    'forgot-password.html', 'password-reset.html',
    'my-info.html', 'parcel-declaration.html', 'track-parcel.html'
  ];
  
  if (allowedPaths.includes(path)) {
    window.location.href = path;
  } else {
    console.error('Unauthorized redirect attempt:', path);
    showError('Navigation failed. Please try again.');
  }
}

function formatTrackingNumber(trackingNumber) {
  return trackingNumber.replace(/[^A-Z0-9-]/g, '').toUpperCase();
}

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  detectViewMode();
  initValidationListeners();

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
