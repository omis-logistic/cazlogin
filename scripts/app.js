// ================= CONFIGURATION =================
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbx-D4xEl1acTaA00wD-T9Az6cNotyBkR3lFHos7cSA8N1GaPmqkwnZq96hj2lSwDoGo/exec',
  SESSION_TIMEOUT: 3600, // 1 hour
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
  MAX_FILES: 3
};

// ================= VIEWPORT MANAGEMENT =================
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

  if (!sessionData) {
    handleLogout();
    return null;
  }

  if (lastActivity && Date.now() - lastActivity > CONFIG.SESSION_TIMEOUT * 1000) {
    handleLogout();
    return null;
  }

  localStorage.setItem('lastActivity', Date.now().toString());
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

// ================= API HANDLERS =================
function jsonpRequest(action, params) {
  return new Promise((resolve, reject) => {
    const callbackName = `jsonp_${Date.now()}`;
    const script = document.createElement('script');
    
    const urlParams = new URLSearchParams({
      ...params,
      action: action,
      callback: callbackName
    });
    
    window[callbackName] = response => {
      delete window[callbackName];
      document.body.removeChild(script);
      resolve(response);
    };

    script.src = `${CONFIG.GAS_URL}?${urlParams}`;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

async function callAPI(action, payload) {
  try {
    const formData = new FormData();
    
    // Properly structure the data with action
    const requestData = {
      action: action,
      data: payload.data
    };
    formData.append('data', JSON.stringify(requestData));

    if (payload.files) {
      payload.files.forEach((file, index) => {
        const blob = new Blob(
          [Uint8Array.from(atob(file.base64), c => c.charCodeAt(0))],
          { type: file.type }
        );
        formData.append(`file${index}`, blob, file.name);
      });
    }

    const response = await fetch(CONFIG.GAS_URL, {
      method: 'POST',
      body: formData,
      redirect: 'follow'
    });

    return await response.json();
  } catch (error) {
    console.error('API Call Failed:', error);
    return { success: false, message: error.message };
  }
}

// ================= AUTHENTICATION HANDLERS =================
async function handleLogin() {
  const phoneInput = document.getElementById('phone');
  const passwordInput = document.getElementById('password');
  
  if (!phoneInput || !passwordInput) {
    showError('System error - form not loaded');
    return;
  }

  const phone = phoneInput.value.trim();
  const password = passwordInput.value;

  if (!validatePhone(phone)) {
    showError('Invalid phone format (673/60 prefix required)');
    return;
  }

  try {
    const result = await jsonpRequest('processLogin', {
      phone: phone.replace(/[^\d]/g, ''),
      password: password
    });
    
    if (result.success) {
      sessionStorage.setItem('userData', JSON.stringify({
        phone: result.phone,
        email: result.email,
        tempPassword: result.tempPassword
      }));
      localStorage.setItem('lastActivity', Date.now());
      
      safeRedirect(result.tempPassword ? 'password-reset.html' : 'dashboard.html');
    } else {
      showError(result.message || 'Authentication failed');
    }
  } catch (error) {
    showError('Login failed - please try again');
  }
}

async function handleRegistration() {
  const regPhone = document.getElementById('regPhone');
  const regPassword = document.getElementById('regPassword');
  const regEmail = document.getElementById('regEmail');
  
  if (!regPhone || !regPassword || !regEmail) {
    showError('System error - form not loaded');
    return;
  }

  if (!validateRegistrationForm()) return;

  try {
    const result = await jsonpRequest('createAccount', {
      phone: regPhone.value.trim(),
      password: regPassword.value,
      email: regEmail.value.trim()
    });
    
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
  const recoveryPhone = document.getElementById('recoveryPhone');
  const recoveryEmail = document.getElementById('recoveryEmail');
  
  if (!recoveryPhone || !recoveryEmail) {
    showError('System error - form not loaded');
    return;
  }

  const phone = recoveryPhone.value.trim();
  const email = recoveryEmail.value.trim();

  try {
    const result = await jsonpRequest('initiatePasswordReset', { phone, email });
    
    if (result.success) {
      alert('Temporary password sent to your email!');
      safeRedirect('login.html');
    } else {
      showError(result.message || 'Recovery failed');
    }
  } catch (error) {
    showError('Password recovery failed');
  }
}

async function handlePasswordReset() {
  const newPass = document.getElementById('newPassword');
  const confirmPass = document.getElementById('confirmNewPassword');
  
  if (!newPass || !confirmPass) {
    showError('System error - form not loaded');
    return;
  }

  const userData = checkSession();
  if (!userData) return;

  if (newPass.value !== confirmPass.value) {
    showError('Passwords do not match');
    return;
  }

  try {
    const result = await jsonpRequest('forcePasswordReset', {
      phone: userData.phone,
      newPassword: newPass.value
    });

    if (result.success) {
      alert('Password updated! Please login.');
      handleLogout();
    } else {
      showError(result.message || 'Password reset failed');
    }
  } catch (error) {
    showError('Password reset failed');
  }
}

// ================= PARCEL HANDLERS =================
async function handleParcelSubmission(event) {
  event.preventDefault();
  console.log('[Frontend] Submission started'); // Add logging
  
  try {
    const files = await handleFileUpload(document.getElementById('invoiceFiles').files);
    if (!files) return;

    // Add basic validation
    if (!checkAllFields()) {
      showError('Please fill all required fields correctly');
      return;
    }

    const payload = {
  data: {
    action: 'submitParcelDeclaration', // Add action here
    data: { // Nest parcel data under 'data' property
      trackingNumber: document.getElementById('trackingNumber').value.trim(),
      nameOnParcel: document.getElementById('nameOnParcel').value.trim(),
      phoneNumber: document.getElementById('phoneNumber').value.trim(),
      itemDescription: document.getElementById('itemDescription').value.trim(),
      quantity: parseInt(document.getElementById('quantity').value),
      price: parseFloat(document.getElementById('price').value),
      collectionPoint: document.getElementById('collectionPoint').value,
      itemCategory: document.getElementById('itemCategory').value
    }
  },
  files: files
};

    console.log('[Frontend] Sending payload:', payload); // Debug log
    
    const result = await callAPI('submitParcelDeclaration', payload);
    
    if (result.success) {
      alert(`Submitted! Tracking: ${result.trackingNumber}`);
      document.getElementById('parcel-declaration-form').reset();
    } else {
      showError(result.message || 'Submission failed');
    }
  } catch (error) {
    showError('Submission error - please try again');
    console.error('[Frontend Error]', error);
  }
}

// ================= VALIDATION UTILITIES =================
function validatePhone(phone) {
  return /^(673\d{7,}|60\d{9,})$/.test(phone);
}

function validatePassword(password) {
  return /^(?=.*[A-Z])(?=.*\d).{6,}$/.test(password);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateTrackingNumber(input) {
  const value = input?.value?.trim() || '';
  return value.length >= 5;
}

function validateInvoiceFiles() {
  const category = document.getElementById('itemCategory')?.value || '';
  const files = document.getElementById('invoiceFiles')?.files || [];
  
  const requiresInvoice = [
    '* Books', '* Cosmetics/Skincare/Bodycare',
    '* Food Beverage/Drinks', '* Gadgets',
    '* Oil Ointment', '* Supplement'
  ].includes(category);

  return !requiresInvoice || files.length > 0;
}

function checkAllFields() {
  return [
    validateTrackingNumber(document.getElementById('trackingNumber')),
    document.getElementById('nameOnParcel')?.value?.trim()?.length >= 2,
    validatePhone(document.getElementById('phoneNumber')?.value),
    document.getElementById('itemDescription')?.value?.trim()?.length >= 5,
    Number.isInteger(parseInt(document.getElementById('quantity')?.value)),
    !isNaN(parseFloat(document.getElementById('price')?.value)),
    document.getElementById('collectionPoint')?.value,
    document.getElementById('itemCategory')?.value,
    validateInvoiceFiles()
  ].every(Boolean);
}

// ================= FILE HANDLING =================
async function handleFileUpload(files) {
  if (!files || files.length === 0) return [];
  
  if (files.length > CONFIG.MAX_FILES) {
    showError(`Maximum ${CONFIG.MAX_FILES} files allowed`);
    return null;
  }

  const uploads = [];
  for (const file of files) {
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      showError(`${file.name} exceeds 5MB limit`);
      return null;
    }
    
    if (!CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
      showError(`${file.name} has invalid file type`);
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
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ================= UTILITIES =================
function safeRedirect(path) {
  try {
    if (!path || window.location.pathname.endsWith(path)) return;
    
    const allowedPaths = [
      'login.html', 'register.html', 'dashboard.html',
      'forgot-password.html', 'password-reset.html'
    ];
    
    if (!allowedPaths.includes(path.replace('/', ''))) {
      throw new Error('Invalid redirect path');
    }
    
    window.location.href = path;
  } catch (error) {
    console.error('Redirect error:', error);
    window.location.href = 'login.html';
  }
}

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  detectViewMode();
  
  // Session check for protected pages
  if (!window.location.pathname.includes('login.html') && 
      !window.location.pathname.includes('register.html')) {
    const userData = checkSession();
    if (!userData) return;
  }

  // Form initialization
  const phoneField = document.getElementById('phoneNumber');
  if (phoneField) {
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    phoneField.value = userData?.phone || '';
    phoneField.readOnly = true;
  }

  // Event listeners
  document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
  document.getElementById('registerBtn')?.addEventListener('click', handleRegistration);
  document.getElementById('forgotBtn')?.addEventListener('click', handlePasswordRecovery);
  document.getElementById('resetBtn')?.addEventListener('click', handlePasswordReset);
  document.getElementById('parcel-declaration-form')?.addEventListener('submit', handleParcelSubmission);

  // Validation listeners
  if (document.getElementById('parcel-declaration-form')) {
    initValidationListeners();
  }
});

function initValidationListeners() {
  const inputs = [
    'trackingNumber', 'nameOnParcel', 'phoneNumber', 
    'itemDescription', 'quantity', 'price',
    'collectionPoint', 'itemCategory', 'invoiceFiles'
  ];

  inputs.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('input', updateSubmitButtonState);
    }
  });
}

function updateSubmitButtonState() {
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.disabled = !checkAllFields();
  }
}
