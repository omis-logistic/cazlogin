// scripts/app.js – Version 1 frontend adapted to Version 2 submission
// ================= CONFIGURATION =================
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbzAg82Zo4O4GQBmXC-xpYYJnWLZwR5MO_xcpn6qRvJHGVyu7_tjU-3NAAnRJtgRMlUM/exec',   // your main backend (Version 2)
  PROXY_URL: 'https://script.google.com/macros/s/AKfycbyLEcUrIt4QNMXiQCRtW1x_9CtJAo_mNLDnC-NnTO9UBvkPKMBlQJK9ViZUTJHWb8XRsA/exec', // Version 2 proxy
  SESSION_TIMEOUT: 3600,
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
  MAX_FILES: 3
};

// ================= HELPER: TRACKING NUMBER TRIMMING =================
function trimTrackingNumber(tracking) {
  if (!tracking) return '';
  return tracking.replace(/SPXLM.*/i, '');
}

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
  
  if (typeof message === 'string' && message.includes('success')) {
    errorElement.style.background = '#00C851dd';
    errorElement.textContent = message.replace('success', '').trim();
  } else {
    errorElement.style.background = '#ff4444dd';
    errorElement.textContent = message;
  }
  
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
  sessionStorage.clear();
  localStorage.removeItem('lastActivity');
  safeRedirect('login.html');
}

// ================= API HANDLER (for login, password reset, etc.) =================
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

function showLoading(show = true, message = 'Processing...') {
  const loader = document.getElementById('loadingOverlay');
  if (!loader) return;

  const textElement = loader.querySelector('.loading-text');
  if (textElement) textElement.textContent = message;

  loader.style.display = show ? 'flex' : 'none';
  
  if (show) {
    setTimeout(() => {
      if (loader.style.display === 'flex' && textElement) {
        textElement.textContent = message + ' This may take a while...';
      }
    }, 3000);
  }
}

function createLoaderElement() {
  const overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text">Processing Submission...</div>
  `;
  
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.85);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    flex-direction: column;
    gap: 1rem;
  `;
  
  const text = overlay.querySelector('.loading-text');
  if (text) {
    text.style.color = 'var(--gold)';
    text.style.fontSize = '1.2rem';
  }
  
  document.body.appendChild(overlay);
  return overlay;
}

function showSuccessMessage() {
  const messageElement = document.getElementById('message');
  if (!messageElement) return;

  messageElement.textContent = 'Data is processed!';
  messageElement.className = 'success';
  messageElement.style.display = 'block';
  messageElement.style.animation = 'slideIn 0.5s ease-out';
  
  setTimeout(() => {
    messageElement.style.animation = 'fadeOut 1s ease 2s forwards';
  }, 2000);
}

function resetForm() {
  const form = document.getElementById('declarationForm');
  if (!form) return;

  form.querySelectorAll('input:not(#phone), select, textarea').forEach(field => {
    if (field.type === 'file') {
      field.value = null;
    } else if (field.tagName === 'SELECT') {
      field.selectedIndex = 0;
    } else {
      field.value = '';
    }
  });

  const phoneField = document.getElementById('phone');
  if (phoneField) {
    phoneField.style.backgroundColor = '#2a2a2a';
    phoneField.style.color = '#ffffff';
  }

  setTimeout(() => {
    if (typeof runInitialValidation === 'function') runInitialValidation();
    if (typeof checkCategoryRequirements === 'function') checkCategoryRequirements();
  }, 100);
}

// ================= FILE READING =================
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// ================= VERSION 2 SUBMISSION (SINGLE, HONEST) =================
async function submitParcelData(payload) {
  const response = await fetch(CONFIG.PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: `payload=${encodeURIComponent(JSON.stringify(payload))}`,
    mode: 'cors',
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
  }

  // The proxy always returns JSON (even on error)
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || result.message || 'Unknown server error');
  }
  return result;
}

// ================= PARCEL SUBMISSION HANDLER (UPDATED) =================
async function handleParcelSubmission(e) {
  e.preventDefault();
  const form = e.target;
  showLoading(true, "Submitting parcel declaration...");

  try {
    const formData = new FormData(form);
    const userData = checkSession();
    
    if (!userData?.phone) {
      throw new Error('Session expired. Please login again.');
    }

    // Process files – always required in Version 2
    const fileInput = document.getElementById('fileUpload');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      throw new Error('Invoice/document upload is required');
    }

    const files = Array.from(fileInput.files);
    if (files.length > CONFIG.MAX_FILES) {
      throw new Error(`Maximum ${CONFIG.MAX_FILES} files allowed`);
    }

    for (const file of files) {
      if (file.size > CONFIG.MAX_FILE_SIZE) {
        throw new Error(`File "${file.name}" exceeds 5MB limit`);
      }
      if (!CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
        throw new Error(`File "${file.name}" must be JPG, PNG, or PDF`);
      }
    }

    const processedFiles = await Promise.all(
      files.map(async file => ({
        name: file.name.replace(/[^a-zA-Z0-9._-]/g, '_'),
        type: file.type,
        data: await readFileAsBase64(file)
      }))
    );

    // Trim tracking number (backend also trims, but we do it here for consistency)
    const rawTracking = formData.get('trackingNumber').trim().toUpperCase();
    const trimmedTracking = trimTrackingNumber(rawTracking);

    // Build payload exactly as Version 2 proxy expects
    const payload = {
      trackingNumber: trimmedTracking,
      nameOnParcel: formData.get('nameOnParcel')?.trim() || '',
      phone: userData.phone,                           // from session
      userId: userData.userID || '',                    // from session (Version 2 login)
      itemDescription: formData.get('itemDescription')?.trim() || '',
      quantity: Number(formData.get('quantity')) || 1,
      price: Number(formData.get('price')) || 0,
      itemCategory: formData.get('itemCategory') || '',
      collectionPoint: formData.get('collectionPoint') || '',
      remark: '',                                       // optional, not in Version 1 form
      files: processedFiles
    };

    // Submit using the new Version 2 method
    const result = await submitParcelData(payload);

    // Success
    showSuccessMessage();
    resetForm();

    // Optional verification (same as Version 1)
    setTimeout(() => {
      verifySubmission(trimmedTracking);
    }, 3000);

  } catch (error) {
    console.error('Submission error:', error);
    
    let errorMessage = error.message;
    if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
      errorMessage = '⚠️ Network connection issue. Please check your internet and try again.';
    } else if (error.message.includes('timeout')) {
      errorMessage = '⚠️ Submission timeout. Please try again.';
    } else if (error.message.includes('Session expired')) {
      errorMessage = '❌ Session expired. Please login again.';
      setTimeout(handleLogout, 2000);
    } else {
      errorMessage = `❌ ${error.message}`;
    }
    
    showError(errorMessage);

    // Offer to save draft for network errors
    if (error.message.includes('Network') || error.message.includes('timeout') || error.message.includes('Failed to fetch')) {
      setTimeout(() => {
        if (confirm('Would you like to save this form as a draft?')) {
          saveFormAsDraft();
        }
      }, 1000);
    }

  } finally {
    showLoading(false);
  }
}

// ================= VERIFICATION (unchanged) =================
async function verifySubmission(trackingNumber) {
  try {
    const verificationURL = `${CONFIG.PROXY_URL}?tracking=${encodeURIComponent(trackingNumber)}`;
    const response = await fetch(verificationURL, { method: 'GET', cache: 'no-cache' });
    
    if (response.ok) {
      const result = await response.json();
      if (result.exists) {
        console.log('Verification successful:', result);
        const messageElement = document.getElementById('message');
        if (messageElement) {
          messageElement.innerHTML += `
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #00C851;">
              <p style="color: #00C851; font-size: 0.9em;">✓ Verified in system: ${trackingNumber}</p>
            </div>
          `;
        }
      }
    }
  } catch (error) {
    console.warn('Verification check failed:', error.message);
  }
}

// ================= VALIDATION FUNCTIONS (all from Version 1) =================
// ... (keep all validation functions exactly as they were) ...
function validateTrackingNumberInput(inputElement) {
  const value = inputElement.value.trim().toUpperCase();
  const isValid = /^[A-Z0-9-]{5,}$/i.test(value);
  showError(isValid ? '' : 'Invalid tracking format (5+ alphanum/-)', 'trackingError');
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
  const isValid = value.length >= 3;
  showError(isValid ? '' : 'Minimum 3 characters required', 'itemDescriptionError');
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
  const isValid = !isNaN(value) && value >= 0 && value < 100000;
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
  if(isValid) checkCategoryRequirements();
  return isValid;
}

function validateFilesInRealTime() {
  const fileInput = document.getElementById('fileUpload');
  const files = fileInput?.files || [];
  const errorElement = document.getElementById('invoiceFilesError');
  if (!errorElement) return;
  
  if (files.length === 0) {
    errorElement.textContent = 'Required: At least 1 invoice/document required';
    errorElement.style.color = '#ff4444';
    errorElement.style.display = 'block';
    fileInput.style.borderColor = '#ff4444';
    fileInput.parentElement.classList.add('invalid');
  } else {
    let allValid = true;
    for (const file of files) {
      if (!CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
        errorElement.textContent = `File "${file.name}" must be JPG, PNG, or PDF`;
        allValid = false;
        break;
      }
      if (file.size > CONFIG.MAX_FILE_SIZE) {
        errorElement.textContent = `File "${file.name}" exceeds 5MB limit`;
        allValid = false;
        break;
      }
    }
    if (allValid) {
      errorElement.textContent = `${files.length} file(s) selected`;
      errorElement.style.color = '#00C851';
      fileInput.style.borderColor = '#00C851';
      fileInput.parentElement.classList.add('valid');
    } else {
      errorElement.style.color = '#ff4444';
      fileInput.style.borderColor = '#ff4444';
      fileInput.parentElement.classList.add('invalid');
    }
  }
  updateSubmitButton();
}

// ... (all other validation helpers from Version 1 remain) ...

// ================= DRAFT SYSTEM (unchanged) =================
function saveFormAsDraft() {
  try {
    const form = document.getElementById('declarationForm');
    const formData = new FormData(form);
    const draft = {};
    
    for (let [key, value] of formData.entries()) {
      if (key !== 'files') draft[key] = value;
    }
    
    const files = document.getElementById('fileUpload')?.files || [];
    if (files.length > 0) {
      draft.filesCount = files.length;
      draft.filesInfo = Array.from(files).map(file => ({
        name: file.name,
        size: file.size,
        type: file.type
      }));
    }
    
    draft.timestamp = new Date().toISOString();
    draft.id = 'draft_' + Date.now();
    
    const drafts = JSON.parse(localStorage.getItem('parcelDrafts') || '[]');
    drafts.push(draft);
    localStorage.setItem('parcelDrafts', JSON.stringify(drafts));
    
    showError('Draft saved successfully!', 'draft-message');
    loadDrafts();
  } catch (error) {
    console.error('Failed to save draft:', error);
    showError('Failed to save draft');
  }
}

function loadDrafts() { /* ... unchanged ... */ }
function loadDraft(index) { /* ... unchanged ... */ }
function deleteDraft(index) { /* ... unchanged ... */ }

// ========== REAL-TIME VALIDATION SYSTEM (unchanged) ==========
function initRealTimeValidation() {
  console.log('Initializing real-time validation...');
  setTimeout(() => {
    runInitialValidation();
    setupRealTimeValidationListeners();
  }, 100);
}

function runInitialValidation() {
  const fieldsToValidate = [
    { id: 'trackingNumber', type: 'tracking' },
    { id: 'nameOnParcel', type: 'name' },
    { id: 'itemDescription', type: 'description' },
    { id: 'quantity', type: 'quantity' },
    { id: 'price', type: 'price' },
    { id: 'collectionPoint', type: 'select' },
    { id: 'itemCategory', type: 'select' }
  ];
  
  fieldsToValidate.forEach(field => {
    const fieldElement = document.getElementById(field.id);
    const errorElement = document.getElementById(field.id + 'Error') || createErrorMessageElement(field.id);
    if (!fieldElement) return;
    
    let isValid = false;
    let message = '';
    
    switch(field.type) {
      case 'tracking':
        isValid = /^[A-Za-z0-9\-]{5,}$/.test(fieldElement.value.trim());
        message = isValid ? '' : 'Minimum 5 alphanumeric characters or hyphens';
        break;
      case 'name':
        isValid = fieldElement.value.trim().length >= 2;
        message = isValid ? '' : 'Minimum 2 characters required';
        break;
      case 'description':
        isValid = fieldElement.value.trim().length >= 3;
        message = isValid ? '' : 'Minimum 3 characters required';
        break;
      case 'quantity':
        const q = parseInt(fieldElement.value);
        isValid = !isNaN(q) && q >= 1 && q <= 999;
        message = isValid ? '' : 'Must be between 1 and 999';
        break;
      case 'price':
        const p = parseFloat(fieldElement.value);
        isValid = !isNaN(p) && p >= 0;
        message = isValid ? '' : 'Price must be 0 or greater (0 is allowed)';
        break;
      case 'select':
        isValid = fieldElement.value !== '';
        message = isValid ? '' : 'Please select an option';
        break;
    }
    
    updateFieldValidationState(fieldElement, isValid, message);
  });
  
  // File validation
  validateFilesInRealTime();
  updateSubmitButton();
}

function updateFieldValidationState(fieldElement, isValid, message) {
  const errorElement = document.getElementById(fieldElement.id + 'Error');
  const parent = fieldElement.parentElement;
  
  parent.classList.remove('valid', 'invalid');
  
  if (isValid) {
    parent.classList.add('valid');
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.style.display = 'none';
      fieldElement.style.borderColor = '#444';
    }
  } else {
    parent.classList.add('invalid');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.color = '#ff4444';
      errorElement.style.display = 'block';
      fieldElement.style.borderColor = '#ff4444';
    }
  }
}

function setupRealTimeValidationListeners() {
  const fields = ['trackingNumber', 'nameOnParcel', 'itemDescription', 'quantity', 'price', 'collectionPoint', 'itemCategory'];
  
  fields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', () => validateFieldInRealTime(field));
      field.addEventListener('change', () => validateFieldInRealTime(field));
      if (field.tagName === 'SELECT') {
        field.addEventListener('change', () => {
          validateFieldInRealTime(field);
          checkCategoryRequirements();
        });
      }
    }
  });
  
  const fileUpload = document.getElementById('fileUpload');
  if (fileUpload) {
    fileUpload.addEventListener('change', validateFilesInRealTime);
  }
}

function validateFieldInRealTime(field) {
  const value = field.value;
  let isValid = false;
  let message = '';
  
  switch(field.id) {
    case 'trackingNumber':
      isValid = /^[A-Za-z0-9\-]{5,}$/.test(value.trim());
      message = isValid ? '' : 'Minimum 5 alphanumeric characters or hyphens';
      break;
    case 'nameOnParcel':
      isValid = value.trim().length >= 2;
      message = isValid ? '' : 'Minimum 2 characters required';
      break;
    case 'itemDescription':
      isValid = value.trim().length >= 3;
      message = isValid ? '' : 'Minimum 3 characters required';
      break;
    case 'quantity':
      const q = parseInt(value);
      isValid = !isNaN(q) && q >= 1 && q <= 999;
      message = isValid ? '' : 'Must be between 1 and 999';
      break;
    case 'price':
      const p = parseFloat(value);
      isValid = !isNaN(p) && p >= 0;
      message = isValid ? '' : 'Price must be 0 or greater (0 is allowed)';
      break;
    case 'collectionPoint':
    case 'itemCategory':
      isValid = value !== '';
      message = isValid ? '' : 'Please select an option';
      break;
  }
  
  updateFieldValidationState(field, isValid, message);
  updateSubmitButton();
  
  if (field.id === 'itemCategory') {
    setTimeout(() => checkCategoryRequirements(), 100);
  }
}

function checkCategoryRequirements() {
  const fileInput = document.getElementById('fileUpload');
  const fileHelp = document.getElementById('fileHelp');
  const fileRequirement = document.getElementById('fileRequirement');
  
  if (!fileInput || !fileHelp) return;
  
  // In Version 2, files are always required
  if (fileRequirement) {
    fileRequirement.textContent = 'Required: ';
    fileRequirement.style.color = '#ff4444';
  }
  fileHelp.style.color = '#ff4444';
  fileHelp.style.fontWeight = 'bold';
  fileInput.required = true;
  
  setTimeout(() => validateFilesInRealTime(), 100);
}

function updateSubmitButton() {
  const submitBtn = document.getElementById('submitBtn');
  if (!submitBtn) return;
  
  const fields = ['trackingNumber', 'nameOnParcel', 'itemDescription', 'quantity', 'price', 'collectionPoint', 'itemCategory'];
  let allValid = true;
  
  fields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    const parent = field?.parentElement;
    if (!field || (parent && parent.classList.contains('invalid')) || 
        (field.tagName === 'SELECT' && !field.value) ||
        (field.type !== 'select' && !field.value.trim())) {
      allValid = false;
    }
  });
  
  const files = document.getElementById('fileUpload')?.files || [];
  if (files.length === 0) allValid = false;
  
  submitBtn.disabled = !allValid;
  
  const submitText = document.getElementById('submitText');
  if (submitText) {
    submitText.textContent = allValid ? 'Submit Declaration' : 'Please fix errors above';
  }
  
  submitBtn.style.background = allValid ? 'linear-gradient(135deg, #d4af37, #b8941f)' : '#555';
  submitBtn.style.cursor = allValid ? 'pointer' : 'not-allowed';
  submitBtn.style.opacity = allValid ? '1' : '0.7';
}

function createErrorMessageElement(fieldId) {
  const errorSpan = document.createElement('span');
  errorSpan.id = fieldId + 'Error';
  errorSpan.className = 'validation-message';
  
  const fieldElement = document.getElementById(fieldId);
  if (fieldElement && fieldElement.parentElement) {
    fieldElement.parentElement.appendChild(errorSpan);
  }
  return errorSpan;
}

// ================= AUTHENTICATION HANDLERS (unchanged) =================
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

function validatePhone(phone) {
  return /^(673\d{7,}|60\d{9,})$/.test(phone);
}

function validatePassword(password) {
  return /^(?=.*[A-Z])(?=.*\d).{6,}$/.test(password);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
  const basePath = path.split('?')[0].split('#')[0];
  const allowedPaths = [
    'login.html', 'register.html', 'dashboard.html',
    'forgot-password.html', 'password-reset.html',
    'my-info.html', 'parcel-declaration.html', 'track-parcel.html',
    'billing-info.html', 'invoice.html'
  ];
  
  if (!allowedPaths.includes(basePath)) {
    console.error('Unauthorized path');
    showError('Navigation failed. Please try again.');
    return;
  }
  
  window.location.href = path;
}

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  detectViewMode();
  
  const currentPage = window.location.pathname.split('/').pop() || 'login.html';
  const publicPages = ['login.html', 'register.html', 'forgot-password.html'];
  const isPublicPage = publicPages.includes(currentPage);
  
  if (!isPublicPage) {
    const userData = checkSession();
    if (!userData) return;
    
    if (userData.tempPassword && !window.location.pathname.includes('password-reset.html')) {
      handleLogout();
    }
  }
  
  createLoaderElement();
  
  if (currentPage === 'login.html') {
    initLoginPage();
  }
  
  if (currentPage === 'parcel-declaration.html') {
    const phoneField = document.getElementById('phone');
    const userData = checkSession();
    if (userData?.phone) {
      phoneField.value = userData.phone;
      phoneField.readOnly = true;
    }
    
    setupFormSubmission();
    setupCategoryChangeListener();
    initValidationListeners();
    checkCategoryRequirements();
    initRealTimeValidation();
    loadDrafts();
    
    // Prefill tracking from session if available
    const prefillTracking = sessionStorage.getItem('prefillTracking');
    if (prefillTracking) {
      document.getElementById('trackingNumber').value = prefillTracking;
      sessionStorage.removeItem('prefillTracking');
    }
  }
  
  window.addEventListener('beforeunload', () => {
    const errorElement = document.getElementById('error-message');
    if (errorElement) errorElement.style.display = 'none';
  });
  
  const firstInput = document.querySelector('input:not([type="hidden"])');
  if (firstInput) firstInput.focus();
});

function initLoginPage() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('logout')) {
    sessionStorage.clear();
    localStorage.removeItem('lastActivity');
  }
}

function setupFormSubmission() {
  const form = document.getElementById('declarationForm');
  if (!form) return;
  
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);
  
  newForm.addEventListener('submit', handleParcelSubmission);
}

function setupCategoryChangeListener() {
  const categorySelect = document.getElementById('itemCategory');
  if (categorySelect) {
    categorySelect.addEventListener('change', checkCategoryRequirements);
  }
}

function initValidationListeners() {
  // Already handled by real-time validation; kept for compatibility
}

// ================= EXPORT FUNCTIONS =================
window.handleLogout = handleLogout;
window.safeRedirect = safeRedirect;
window.handleRegistration = handleRegistration;
window.handlePasswordRecovery = handlePasswordRecovery;
window.handlePasswordReset = handlePasswordReset;
window.loadDrafts = loadDrafts;
window.loadDraft = loadDraft;
window.deleteDraft = deleteDraft;
window.showRegistration = () => safeRedirect('register.html');
window.showForgotPassword = () => safeRedirect('forgot-password.html');
window.saveDraft = saveFormAsDraft;
window.toggleDrafts = function() {
  const list = document.getElementById('draftsList');
  if (list) list.style.display = list.style.display === 'none' ? 'block' : 'none';
};
