// scripts/app.js
// ================= CONFIGURATION =================
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbwGugwXhwMfpfS355u3tsvgFp6HxBbySdaFmU-oWBLFBi_MTOtvuqottLn-g-XxVprV/exec',
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
    formData.append('data', JSON.stringify(payload.data));
    
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

// Helper function for FormData creation
function createFormData(payload) {
  const formData = new FormData();
  formData.append('data', JSON.stringify(payload.data));
  
  if (payload.files) {
    payload.files.forEach((file, index) => {
      const blob = new Blob(
        [Uint8Array.from(atob(file.base64), c => c.charCodeAt(0))],
        { type: file.type }
      );
      formData.append(`file${index}`, blob, file.name);
    });
  }
  
  return formData;
}

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

// ================= PARCEL HANDLERS =================
async function handleParcelSubmission(event) {
  event.preventDefault(); // Add this line
  console.log('[DEBUG] Submission started');
  
  try {
    const filesInput = document.getElementById('invoiceFiles');
    const files = await handleFileUpload(filesInput.files);
    
    // Basic validation check
    if (!checkAllFields()) {
      console.warn('[DEBUG] Validation failed');
      showError('Please fix form errors');
      return;
    }

    // Prepare payload
    const submissionData = {
      data: {
        trackingNumber: document.getElementById('trackingNumber').value.trim(),
        nameOnParcel: document.getElementById('nameOnParcel').value.trim(),
        phoneNumber: document.getElementById('phoneNumber').value.trim(),
        itemDescription: document.getElementById('itemDescription').value.trim(),
        quantity: parseInt(document.getElementById('quantity').value),
        price: parseFloat(document.getElementById('price').value),
        collectionPoint: document.getElementById('collectionPoint').value,
        itemCategory: document.getElementById('itemCategory').value
      },
      files: files
    };

    console.log('[DEBUG] Submission payload:', submissionData);
    
    // Show loading state
    showLoading(true);
    
    // Use callAPI for POST request
    const result = await callAPI('submitParcelDeclaration', submissionData);
    console.log('[DEBUG] API Response:', result);
    
    if (result.success) {
      alert(`Declaration submitted! Tracking: ${result.trackingNumber}`);
      safeRedirect('dashboard.html');
    } else {
      showError(result.message || 'Submission failed');
    }
  } catch (error) {
    console.error('[DEBUG] Submission error:', error);
    showError(error.message);
  } finally {
    showLoading(false);
  }
}

// ================= VALIDATION CORE =================
function validateTrackingNumber(inputElement) {
  const value = inputElement?.value?.trim() || '';
  const isValid = value.length >= 5;
  showError(isValid ? '' : 'Minimum 5 characters required', 'trackingNumberError');
  return isValid;
}

function validateName(inputElement) {
  const value = inputElement?.value?.trim() || '';
  const isValid = value.length >= 2;
  showError(isValid ? '' : 'Minimum 2 characters required', 'nameOnParcelError');
  return isValid;
}

function validateDescription(inputElement) {
  const value = inputElement?.value?.trim() || '';
  const isValid = value.length >= 5;
  showError(isValid ? '' : 'Minimum 5 characters required', 'itemDescriptionError');
  return isValid;
}

function validateQuantity(inputElement) {
  const value = parseInt(inputElement?.value || 0);
  const isValid = !isNaN(value) && value > 0 && value < 1000;
  showError(isValid ? '' : 'Valid quantity (1-999) required', 'quantityError');
  return isValid;
}

function validatePrice(inputElement) {
  const value = parseFloat(inputElement?.value || 0);
  const isValid = !isNaN(value) && value > 0 && value < 100000;
  showError(isValid ? '' : 'Valid price (0-100000) required', 'priceError');
  return isValid;
}

function validateCollectionPoint(selectElement) {
  const value = selectElement?.value || '';
  const isValid = value !== '';
  showError(isValid ? '' : 'Please select collection point', 'collectionPointError');
  return isValid;
}

function validateCategory(selectElement) {
  const value = selectElement?.value || '';
  const isValid = value !== '';
  showError(isValid ? '' : 'Please select item category', 'itemCategoryError');
  if(isValid) checkInvoiceRequirements();
  return isValid;
}

function validateInvoiceFiles() {
  const mandatoryCategories = [
    '* Books', '* Cosmetics/Skincare/Bodycare',
    '* Food Beverage/Drinks', '* Gadgets',
    '* Oil Ointment', '* Supplement'
  ];
  
  const category = document.getElementById('itemCategory')?.value || '';
  const files = document.getElementById('invoiceFiles')?.files || [];
  let isValid = true;
  let errorMessage = '';

  if(files.length > 3) {
    errorMessage = 'Maximum 3 files allowed';
    isValid = false;
  }
  else if(mandatoryCategories.includes(category)) {
    isValid = files.length > 0;
    errorMessage = isValid ? '' : 'At least 1 invoice required';
  }

  showError(errorMessage, 'invoiceFilesError');
  return isValid;
}

function validateParcelPhone(input) {
  const value = input.value.trim();
  const isValid = /^(673\d{7,}|60\d{9,})$/.test(value);
  showError(isValid ? '' : 'Invalid phone number format', 'phoneNumberError');
  return isValid;
}

// ================= VALIDATION UTILITIES =================
function checkAllFields() {
  const validations = [
    validateTrackingNumber(document.getElementById('trackingNumber')),
    validateName(document.getElementById('nameOnParcel')),
    validateParcelPhone(document.getElementById('phoneNumber')),
    validateDescription(document.getElementById('itemDescription')),
    validateQuantity(document.getElementById('quantity')),
    validatePrice(document.getElementById('price')),
    validateCollectionPoint(document.getElementById('collectionPoint')),
    validateCategory(document.getElementById('itemCategory')),
    validateInvoiceFiles()
  ];

  return validations.every(v => v === true);
}

function checkInvoiceRequirements() {
  return validateInvoiceFiles();
}

function updateSubmitButtonState() {
  const submitBtn = document.getElementById('submitBtn');
  if(!submitBtn) return;
  submitBtn.disabled = !checkAllFields();
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

// ================= FORM VALIDATION INIT =================
function initValidationListeners() {
  const parcelForm = document.getElementById('parcel-declaration-form');
  if (parcelForm) {
    const inputs = parcelForm.querySelectorAll('input, select');
    
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        switch(input.id) {
          case 'trackingNumber':
            validateTrackingNumber(input);
            break;
          case 'nameOnParcel':
            validateName(input);
            break;
          case 'phoneNumber':
            validateParcelPhone(input);
            break;
          case 'itemDescription':
            validateDescription(input);
            break;
          case 'quantity':
            validateQuantity(input);
            break;
          case 'price':
            validatePrice(input);
            break;
          case 'collectionPoint':
            validateCollectionPoint(input);
            break;
          case 'itemCategory':
            validateCategory(input);
            break;
        }
        updateSubmitButtonState();
      });
    });

    const fileInput = document.getElementById('invoiceFiles');
    if(fileInput) {
      fileInput.addEventListener('change', () => {
        validateInvoiceFiles();
        updateSubmitButtonState();
      });
    }
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

  try {
    const result = await jsonpRequest('processLogin', { 
      phone: phone.replace(/[^\d]/g, ''),
      password: password
    });
    
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
    console.error('Redirect error:', error);
    showError('Navigation failed. Please try again.');
  }
}

function formatTrackingNumber(trackingNumber) {
  return trackingNumber.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('ms-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2
  }).format(amount || 0);
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
  const form = document.getElementById('parcel-declaration-form');
  if (form) {
    form.addEventListener('submit', handleParcelSubmission);
  }
});
