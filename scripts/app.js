// ================= CONFIGURATION =================
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbwxkrALkUutlXhVuWULMG4Oa1MfJqcWBCtzpNVwBpniwz0Qhl-ks5EYAw1HfvHd9OIS/exec',
  PROXY_URL: 'https://script.google.com/macros/s/AKfycbw0d5OTcj4Z_ZZXGjlVyzBKXOYCUMRx-hl4P2KaiVCjOdLNz7i7yDFen4kK-HZ7DlR7pg/exec',
  SESSION_TIMEOUT: 3600,
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
  MAX_FILES: 3
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

// ================= MESSAGE DISPLAY =================
function showMessage(text, type = 'info') {
  const messageDiv = document.getElementById('message');
  if (!messageDiv) return;

  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
  
  clearTimeout(messageDiv.timeout);
  messageDiv.timeout = setTimeout(() => {
    messageDiv.textContent = '';
    messageDiv.className = 'message';
  }, type === 'error' ? 8000 : 5000);
}

// ================= SESSION MANAGEMENT =================
const checkSession = () => {
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
};

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
async function callAPI(action, payload) {
  try {
    const formData = new FormData();
    
    if (payload.files) {
      payload.files.forEach((file, index) => {
        const blob = new Blob(
          [Uint8Array.from(atob(file.base64), c => c.charCodeAt(0))],
          { type: file.type }
        );
        formData.append(`file${index}`, blob, file.name);
      });
    }

    formData.append('data', JSON.stringify(payload.data));

    const response = await fetch(CONFIG.GAS_URL, {
      method: 'POST',
      body: formData
    });

    return await response.json();
  } catch (error) {
    console.error('API Call Failed:', error);
    return { success: false, message: error.message };
  }
}

// ================= PARCEL DECLARATION HANDLERS =================
async function handleParcelSubmission(e) {
  if (e) e.preventDefault();
  
  try {
    const form = e?.target || document.getElementById('declarationForm');
    const userData = checkSession();
    
    if (!userData?.phone) {
      showError('Session expired - please login again');
      safeRedirect('login.html');
      return;
    }

    const formData = new FormData(form);
    const trackingNumber = formatTrackingNumber(formData.get('trackingNumber'));
    const phone = userData.phone;
    const quantity = formData.get('quantity');
    const price = formData.get('price');
    const itemCategory = formData.get('itemCategory');
    const itemDescription = formData.get('itemDescription').trim();

    // Validate fields
    validateTrackingNumber(trackingNumber);
    validateQuantity(quantity);
    validatePrice(price);
    validateCategory(itemCategory);

    // Process files
    const rawFiles = Array.from(formData.getAll('files') || []);
    const validFiles = rawFiles.filter(file => file.size > 0);
    validateFiles(itemCategory, validFiles);
    const processedFiles = await processFiles(validFiles);

    // Prepare payload
    const payload = {
      trackingNumber,
      phone,
      itemDescription,
      quantity: parseInt(quantity),
      price: parseFloat(price),
      collectionPoint: formData.get('collectionPoint'),
      itemCategory,
      files: processedFiles
    };

    // Submit data
    await submitDeclaration(payload);
    setTimeout(() => verifySubmission(trackingNumber), 3000);
    showMessage('Submission processing...', 'pending');

  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
    console.error('Submission Error:', error);
  }
}

async function submitDeclaration(payload) {
  try {
    const formData = new URLSearchParams();
    formData.append('payload', JSON.stringify(payload));

    await fetch(CONFIG.PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
      mode: 'no-cors'
    });
  } catch (error) {
    console.error('Proxy Submission Error:', error);
    throw new Error('Submission received - confirmation pending');
  }
}

// ================= VERIFICATION SYSTEM =================
async function verifySubmission(trackingNumber) {
  try {
    let retries = 3;
    let result;
    
    while (retries > 0) {
      const response = await fetch(
        `${CONFIG.GAS_URL}?action=verifySubmission&tracking=${encodeURIComponent(trackingNumber)}`
      );
      
      if (response.ok) {
        result = await response.json();
        if (result.verified) break;
      }
      
      retries--;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (result?.verified) {
      showMessage('Submission verified successfully!', 'success');
      setTimeout(() => safeRedirect('dashboard.html'), 2000);
    } else {
      showMessage('Verification pending - check dashboard later', 'pending');
    }
  } catch (error) {
    showMessage('Final verification pending', 'pending');
  }
}

// ================= VALIDATION CORE =================
function validateTrackingNumber(value) {
  const trimmed = String(value).trim();
  if (!/^[A-Z0-9-]{5,}$/i.test(trimmed)) {
    throw new Error('Invalid tracking number format (5+ alphanumeric characters, hyphens allowed)');
  }
}

function validateName(inputElement) {
  const value = inputElement?.value?.trim() || '';
  if (value.length < 2) {
    throw new Error('Minimum 2 characters required');
  }
}

function validateDescription(inputElement) {
  const value = inputElement?.value?.trim() || '';
  if (value.length < 5) {
    throw new Error('Minimum 5 characters required');
  }
}

function validateQuantity(value) {
  const num = Number(value || 0);
  if (!Number.isInteger(num) || num < 1 || num > 999) {
    throw new Error('Valid quantity (1-999) required');
  }
}

function validatePrice(value) {
  const num = Number(value || 0);
  if (isNaN(num) || num < 0 || num > 100000) {
    throw new Error('Valid price (0-100000) required');
  }
}

function validateCollectionPoint(value) {
  if (!value) throw new Error('Please select collection point');
}

function validateCategory(value) {
  const validCategories = [
    'Accessories/Jewellery', 'Baby Appliances', 'Bag', 'Car Parts/Accessories',
    'Carpets/Mat', 'Clothing', 'Computer Accessories', 'Cordless', 'Decorations',
    'Disposable Pad/Mask', 'Electrical Appliances', 'Fabric', 'Fashion Accessories',
    'Fishing kits/Accessories', 'Footware Shoes/Slippers', 'Game/Console/Board',
    'Hand Tools', 'Handphone Casing', 'Headgear', 'Home Fitting/Furniture',
    'Kitchenware', 'LED/Lamp', 'Matters/Bedding', 'Mix Item', 'Motor Part/Accessories',
    'Others', 'Perfume', 'Phone Accessories', 'Plastic Article', 'RC Parts/Accessories',
    'Rubber', 'Seluar', 'Socks', 'Sport Equipment', 'Stationery', 'Stickers',
    'Storage', 'Telkong', 'Toys', 'Tudong', 'Tumbler', 'Underwear',
    'Watch & Accessories', 'Wire, Adapter & Plug', '*Books',
    '*Cosmetics/Skincare/Bodycare', '*Food Beverage/Drinks', '*Gadgets',
    '*Oil Ointment', '*Supplement'
  ];
  
  if (!validCategories.includes(value)) {
    throw new Error('Please select valid item category');
  }
}

function validateFiles(category, files) {
  const starredCategories = [
    '*Books', '*Cosmetics/Skincare/Bodycare', '*Food Beverage/Drinks',
    '*Gadgets', '*Oil Ointment', '*Supplement'
  ];

  if (starredCategories.includes(category)) {
    if (files.length < 1) throw new Error('At least 1 file required');
    if (files.length > 3) throw new Error('Maximum 3 files allowed');
  }

  files.forEach(file => {
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      throw new Error(`File ${file.name} exceeds 5MB limit`);
    }
  });
}

// ================= FILE HANDLING =================
async function processFiles(files) {
  return Promise.all(files.map(async file => ({
    name: file.name.replace(/[^a-z0-9._-]/gi, '_'),
    type: file.type,
    base64: await readFileAsBase64(file)
  })));
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

// ================= FORM VALIDATION INIT =================
function initValidationListeners() {
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    const inputs = form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        try {
          switch(input.name) {
            case 'trackingNumber':
              validateTrackingNumber(input.value);
              break;
            case 'phoneNumber':
            case 'phone':
              validatePhone(input.value);
              break;
            case 'itemDescription':
              validateDescription(input);
              break;
            case 'quantity':
              validateQuantity(input.value);
              break;
            case 'price':
              validatePrice(input.value);
              break;
            case 'collectionPoint':
              validateCollectionPoint(input.value);
              break;
            case 'itemCategory':
              validateCategory(input.value);
              break;
          }
        } catch (error) {
          showError(error.message, `${input.id}Error`);
        }
        
        if (form.id === 'declarationForm') updateSubmitButtonState();
      });
    });

    const fileInputs = form.querySelector('input[type="file"]');
    if (fileInputs) {
      fileInputs.addEventListener('change', function() {
        try {
          const category = form.querySelector('#itemCategory')?.value;
          validateFiles(category, Array.from(this.files));
          if (form.id === 'declarationForm') updateSubmitButtonState();
        } catch (error) {
          showError(error.message, 'filesError');
          this.value = '';
        }
      });
    }
  });
}

// ================= AUTHENTICATION HANDLERS =================
async function handleLogin() {
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;

  try {
    validatePhone(phone);
    if (!password) throw new Error('Please enter password');

    const result = await callAPI('processLogin', { phone, password });
    
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
    showError(error.message);
  }
}

async function handleRegistration() {
  try {
    if (!validateRegistrationForm()) return;

    const formData = {
      phone: document.getElementById('regPhone').value.trim(),
      password: document.getElementById('regPassword').value,
      email: document.getElementById('regEmail').value.trim()
    };

    const result = await callAPI('createAccount', formData);
    
    if (result.success) {
      showMessage('Registration successful! Please login.', 'success');
      setTimeout(() => safeRedirect('login.html'), 1500);
    } else {
      showError(result.message || 'Registration failed');
    }
  } catch (error) {
    showError('Registration failed - please try again');
  }
}

// ================= PASSWORD MANAGEMENT =================
async function handlePasswordRecovery() {
  try {
    const phone = document.getElementById('recoveryPhone').value.trim();
    const email = document.getElementById('recoveryEmail').value.trim();

    validatePhone(phone);
    validateEmail(email);

    const result = await callAPI('initiatePasswordReset', { phone, email });
    
    if (result.success) {
      showMessage('Temporary password sent to email!', 'success');
      setTimeout(() => safeRedirect('login.html'), 2000);
    } else {
      showError(result.message || 'Password recovery failed');
    }
  } catch (error) {
    showError(error.message);
  }
}

async function handlePasswordReset() {
  try {
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmNewPassword').value;
    const userData = JSON.parse(sessionStorage.getItem('userData'));

    validatePassword(newPass);
    if (newPass !== confirmPass) throw new Error('Passwords do not match');

    const result = await callAPI('forcePasswordReset', {
      phone: userData.phone,
      newPassword: newPass
    });

    if (result.success) {
      showMessage('Password updated! Please login.', 'success');
      handleLogout();
    } else {
      showError(result.message || 'Password reset failed');
    }
  } catch (error) {
    showError(error.message);
  }
}

// ================= FORM VALIDATION =================
function validatePhone(phone) {
  if (!/^(673\d{7,}|60\d{9,})$/.test(phone)) {
    throw new Error('Invalid phone format');
  }
}

function validatePassword(password) {
  if (!/^(?=.*[A-Z])(?=.*\d).{6,}$/.test(password)) {
    throw new Error('Password must contain 6+ characters with at least 1 uppercase letter and 1 number');
  }
}

function validateEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email format');
  }
}

function validateRegistrationForm() {
  let isValid = true;
  document.querySelectorAll('.error-message').forEach(el => el.textContent = '');

  try {
    const phone = document.getElementById('regPhone').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPass').value;
    const email = document.getElementById('regEmail').value;
    const confirmEmail = document.getElementById('regConfirmEmail').value;

    validatePhone(phone);
    validatePassword(password);
    validateEmail(email);
    
    if (password !== confirmPassword) throw new Error('Passwords mismatch');
    if (email !== confirmEmail) throw new Error('Emails mismatch');

  } catch (error) {
    showError(error.message);
    isValid = false;
  }

  return isValid;
}

// ================= UTILITIES =================
function safeRedirect(path) {
  try {
    const allowedPaths = [
      'login.html', 'register.html', 'dashboard.html',
      'forgot-password.html', 'password-reset.html',
      'my-info.html', 'parcel-declaration.html', 'track-parcel.html'
    ];
    
    if (!allowedPaths.includes(path)) {
      throw new Error('Unauthorized path');
    }
    
    window.location.href = path;
  } catch (error) {
    showError('Navigation failed. Please try again.');
  }
}

function formatTrackingNumber(trackingNumber) {
  return trackingNumber.replace(/[^A-Z0-9-]/g, '').toUpperCase();
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('ms-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2
  }).format(amount || 0);
}

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  detectViewMode();
  initValidationListeners();

  // Auto-populate phone in declaration form
  const phoneField = document.getElementById('phone');
  if (phoneField) {
    const userData = checkSession();
    phoneField.value = userData?.phone || '';
    phoneField.readOnly = true;
  }

  // Initialize parcel declaration form
  const parcelForm = document.getElementById('declarationForm');
  if (parcelForm) {
    parcelForm.addEventListener('submit', handleParcelSubmission);
    updateSubmitButtonState();
  }

  // Session checks
  const publicPages = ['login.html', 'register.html', 'forgot-password.html'];
  const isPublicPage = publicPages.some(page => window.location.pathname.includes(page));

  if (!isPublicPage) {
    const userData = checkSession();
    if (!userData) return;
    
    if (userData.tempPassword && !window.location.pathname.includes('password-reset.html')) {
      handleLogout();
    }
  }

  // Focus first input
  const firstInput = document.querySelector('input:not([type="hidden"])');
  if (firstInput) firstInput.focus();
});

// ================= DEBUG HELPERS =================
window.debugForm = {
  testSubmission: () => {
    const testPayload = {
      trackingNumber: 'TEST-123',
      phone: '1234567890',
      itemDescription: 'Test Item',
      quantity: '2',
      price: '19.99',
      collectionPoint: 'Rimba',
      itemCategory: 'Clothing',
      files: []
    };
    submitDeclaration(testPayload);
  }
};
