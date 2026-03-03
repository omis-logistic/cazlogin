// scripts/app.js – Version 3
// ================= CONFIGURATION =================
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbxKHsB5a3lWG-Jul22-f-8FmfGBJmz4Kkmtxjr7Xjidk6skJ2103LsoO-p_2JpQ4Ie6/exec',   // Main backend (unchanged)
  PROXY_URL: 'https://script.google.com/macros/s/AKfycbyaIj08vEuC_6GHD17TeM3jEnEQ6vpKDVzesR8TAZMgKzzhc32XvCzl5hFbrHjF5aZ5hw/exec', // Proxy for submissions
  SESSION_TIMEOUT: 3600,
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
  MAX_FILES: 3
};

// ================= HELPER: TRACKING NUMBER CLEANING & TRIMMING =================
function cleanTrackingNumber(rawTracking) {
  if (!rawTracking) return '';
  let cleaned = rawTracking.trim().toUpperCase();
  const spxIndex = cleaned.indexOf('SPXLM');
  if (spxIndex !== -1) {
    cleaned = cleaned.substring(0, spxIndex);
  }
  return cleaned;
}

// New: trim tracking number from "SPXLM" onwards (case‑insensitive)
function trimTrackingNumber(tracking) {
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
    console.log('No session data found');
    return null;
  }

  if (lastActivity && Date.now() - lastActivity > CONFIG.SESSION_TIMEOUT * 1000) {
    console.log('Session expired');
    sessionStorage.clear();
    localStorage.removeItem('lastActivity');
    return null;
  }

  try {
    const userData = JSON.parse(sessionData);
    localStorage.setItem('lastActivity', Date.now());
    
    if (userData?.tempPassword && !window.location.pathname.includes('password-reset.html')) {
      console.log('Temp password detected but not on reset page');
      return null;
    }

    return userData;
  } catch (error) {
    console.error('Error parsing session data:', error);
    sessionStorage.clear();
    localStorage.removeItem('lastActivity');
    return null;
  }
};

function handleLogout() {
  console.log('Logging out...');
  sessionStorage.clear();
  localStorage.removeItem('lastActivity');
  if (!window.location.pathname.includes('login.html')) {
    window.location.href = 'login.html?logout=' + Date.now();
  }
}

// ================= API HANDLER (kept for non‑submission calls) =================
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
  if (textElement) {
    textElement.textContent = message;
  }

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

  const confetti = document.createElement('div');
  confetti.className = 'confetti-effect';
  document.body.appendChild(confetti);
  setTimeout(() => confetti.remove(), 3000);
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
    if (typeof runInitialValidation === 'function') {
      runInitialValidation();
    }
    if (typeof checkCategoryRequirements === 'function') {
      checkCategoryRequirements();
    }
  }, 100);
}

// ================= NEW SIMPLIFIED SUBMISSION (USES PROXY, NO USER ID) =================
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

    // Get files
    const fileInput = document.getElementById('fileUpload');
    const files = fileInput ? Array.from(fileInput.files) : [];

    // Validate files (category‑based – already done in real‑time validation)
    const category = formData.get('itemCategory');
    const starredCategories = [
      '*Books', '*Cosmetics/Skincare/Bodycare', '*Food Beverage/Drinks',
      '*Gadgets', '*Oil Ointment', '*Supplement', '*Others'
    ];
    if (starredCategories.includes(category) && files.length === 0) {
      throw new Error('Invoice/document upload is required for this category');
    }

    // Process files to base64
    const processedFiles = await Promise.all(
      files.map(async file => ({
        name: file.name.replace(/[^a-zA-Z0-9._-]/g, '_'),
        type: file.type,
        data: await readFileAsBase64(file)
      }))
    );

    // Trim tracking number
    const rawTracking = formData.get('trackingNumber').trim().toUpperCase();
    const trimmedTracking = trimTrackingNumber(rawTracking);

    const payload = {
      trackingNumber: trimmedTracking,
      nameOnParcel: formData.get('nameOnParcel').trim(),
      phone: userData.phone,
      // userId deliberately omitted – column B stays empty
      itemDescription: formData.get('itemDescription').trim(),
      quantity: Number(formData.get('quantity')) || 1,
      price: Number(formData.get('price')) || 0,
      collectionPoint: formData.get('collectionPoint'),
      itemCategory: category,
      files: processedFiles,
      remark: formData.get('remarks')?.trim() || ''
    };

    // Send to proxy
    const response = await fetch(CONFIG.PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: `payload=${encodeURIComponent(JSON.stringify(payload))}`
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Submission failed at server');
    }

    // Success
    showSuccessMessage();
    resetForm();

    // Optional verification
    setTimeout(() => {
      verifySubmission(trimmedTracking);
    }, 3000);

  } catch (error) {
    console.error('Submission error:', error);
    let errorMessage = error.message;
    if (errorMessage.includes('Invoice/document upload')) {
      errorMessage = '❌ Invoice/document upload is required for starred categories.';
    } else if (errorMessage.includes('Network') || errorMessage.includes('Failed to fetch')) {
      errorMessage = '⚠️ Network connection issue. Please check your internet and try again.';
    } else if (errorMessage.includes('Session expired')) {
      errorMessage = '❌ Session expired. Please login again.';
      setTimeout(() => handleLogout(), 2000);
    } else {
      errorMessage = `❌ ${errorMessage}`;
    }
    showError(errorMessage);
  } finally {
    showLoading(false);
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ================= VERIFICATION =================
async function verifySubmission(trackingNumber) {
  try {
    const response = await fetch(`${CONFIG.PROXY_URL}?tracking=${encodeURIComponent(trackingNumber)}`);
    const result = await response.json();
    if (result.exists) {
      console.log('Verification successful:', result);
    }
  } catch (error) {
    console.warn('Verification check failed:', error.message);
  }
}

// ================= PENDING TRACKING LOGIC (from Version 2) =================
function handleTrackingNumberFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const tracking = urlParams.get('tracking');
  if (tracking) {
    sessionStorage.setItem('pendingTracking', tracking);
    sessionStorage.setItem('pendingRedirect', 'parcel-declaration.html');
  }
  return tracking;
}

function processPendingTracking() {
  const pendingTracking = sessionStorage.getItem('pendingTracking');
  const pendingRedirect = sessionStorage.getItem('pendingRedirect');
  if (pendingTracking && pendingRedirect === 'parcel-declaration.html') {
    sessionStorage.removeItem('pendingTracking');
    sessionStorage.removeItem('pendingRedirect');
    sessionStorage.setItem('prefillTracking', pendingTracking);
    safeRedirect('parcel-declaration.html');
    return true;
  }
  return false;
}

// ================= VALIDATION CORE (Version 1, kept intact) =================
// ================= REAL-TIME VALIDATION SYSTEM =================
function initRealTimeValidation() {
  console.log('Initializing real-time validation...');
  setTimeout(() => {
    console.log('Running initial page load validation...');
    runInitialValidation();
    setupRealTimeValidationListeners();
  }, 100);
}

function runInitialValidation() {
  console.log('Running initial validation for all fields...');
  const fieldsToValidate = [
    { id: 'trackingNumber', name: 'Tracking Number', type: 'tracking' },
    { id: 'nameOnParcel', name: 'Name on Parcel', type: 'name' },
    { id: 'itemDescription', name: 'Item Description', type: 'description' },
    { id: 'quantity', name: 'Quantity', type: 'quantity' },
    { id: 'price', name: 'Price', type: 'price' },
    { id: 'collectionPoint', name: 'Collection Point', type: 'select' },
    { id: 'itemCategory', name: 'Item Category', type: 'select' }
  ];
  
  fieldsToValidate.forEach(field => {
    const fieldElement = document.getElementById(field.id);
    const errorElement = document.getElementById(field.id + 'Error') || createErrorMessageElement(field.id);
    if (!fieldElement) return;
    
    let isValid = false;
    let message = '';
    
    switch(field.type) {
      case 'tracking':
        isValid = validateTrackingNumberOnLoad(fieldElement.value);
        message = isValid ? '' : 'Minimum 5 alphanumeric characters or hyphens';
        break;
      case 'name':
        isValid = validateNameOnLoad(fieldElement.value);
        message = isValid ? '' : 'Minimum 2 characters required';
        break;
      case 'description':
        isValid = validateDescriptionOnLoad(fieldElement.value);
        message = isValid ? '' : 'Minimum 3 characters required';
        break;
      case 'quantity':
        isValid = validateQuantityOnLoad(fieldElement.value);
        message = isValid ? '' : 'Must be between 1 and 999';
        break;
      case 'price':
        isValid = validatePriceOnLoad(fieldElement.value);
        message = isValid ? '' : 'Price must be 0 or greater (0 is allowed)';
        break;
      case 'select':
        isValid = validateSelectOnLoad(fieldElement.value);
        message = isValid ? '' : 'Please select an option';
        break;
    }
    
    updateFieldValidationState(fieldElement, isValid, message);
  });
  
  // Validate files if required
  const category = document.getElementById('itemCategory')?.value || '';
  const starredCategories = [
    '*Books', '*Cosmetics/Skincare/Bodycare', '*Food Beverage/Drinks',
    '*Gadgets', '*Oil Ointment', '*Supplement', '*Others'
  ];
  if (starredCategories.includes(category)) {
    const files = document.getElementById('fileUpload')?.files || [];
    if (files.length === 0) {
      const fileInput = document.getElementById('fileUpload');
      const fileError = document.getElementById('invoiceFilesError') || createErrorMessageElement('invoiceFiles');
      if (fileInput && fileError) {
        fileError.textContent = 'Required: At least 1 invoice/document required';
        fileError.style.color = '#ff4444';
        fileError.style.display = 'block';
        fileInput.style.borderColor = '#ff4444';
        fileInput.parentElement.classList.add('invalid');
      }
    }
  }
  
  updateSubmitButton();
  return true;
}

function validateTrackingNumberOnLoad(value) {
  return value && /^[A-Za-z0-9\-]{5,}$/.test(value.trim());
}
function validateNameOnLoad(value) {
  return value && value.trim().length >= 2;
}
function validateDescriptionOnLoad(value) {
  return value && value.trim().length >= 3;
}
function validateQuantityOnLoad(value) {
  const num = parseInt(value);
  return !isNaN(num) && num >= 1 && num <= 999;
}
function validatePriceOnLoad(value) {
  if (value === '') return false;
  const num = parseFloat(value);
  return !isNaN(num) && num >= 0;
}
function validateSelectOnLoad(value) {
  return value && value !== '';
}

function createErrorMessageElement(fieldId) {
  const errorSpan = document.createElement('span');
  errorSpan.id = fieldId + 'Error';
  errorSpan.className = 'validation-message';
  const fieldElement = document.getElementById(fieldId);
  const parent = fieldElement?.parentElement;
  if (fieldElement && parent) {
    parent.appendChild(errorSpan);
  }
  return errorSpan;
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
  if (errorElement) {
    errorElement.style.backgroundColor = 'transparent';
    errorElement.style.border = 'none';
    errorElement.style.boxShadow = 'none';
    errorElement.style.padding = '2px 0';
  }
}

function setupRealTimeValidationListeners() {
  console.log('Setting up real-time validation listeners...');
  const fields = [
    'trackingNumber', 'nameOnParcel', 'itemDescription',
    'quantity', 'price', 'collectionPoint', 'itemCategory'
  ];
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
      isValid = validateTrackingNumberOnLoad(value);
      message = isValid ? '' : 'Minimum 5 alphanumeric characters or hyphens';
      break;
    case 'nameOnParcel':
      isValid = validateNameOnLoad(value);
      message = isValid ? '' : 'Minimum 2 characters required';
      break;
    case 'itemDescription':
      isValid = validateDescriptionOnLoad(value);
      message = isValid ? '' : 'Minimum 3 characters required';
      break;
    case 'quantity':
      isValid = validateQuantityOnLoad(value);
      message = isValid ? '' : 'Must be between 1 and 999';
      break;
    case 'price':
      isValid = validatePriceOnLoad(value);
      message = isValid ? '' : 'Price must be 0 or greater (0 is allowed)';
      break;
    case 'collectionPoint':
    case 'itemCategory':
      isValid = validateSelectOnLoad(value);
      message = isValid ? '' : 'Please select an option';
      break;
  }
  updateFieldValidationState(field, isValid, message);
  updateSubmitButton();
  if (field.id === 'itemCategory') {
    setTimeout(() => checkCategoryRequirements(), 100);
  }
}

function validateFilesInRealTime() {
  const fileInput = document.getElementById('fileUpload');
  const category = document.getElementById('itemCategory')?.value || '';
  const starredCategories = [
    '*Books', '*Cosmetics/Skincare/Bodycare', '*Food Beverage/Drinks',
    '*Gadgets', '*Oil Ointment', '*Supplement', '*Others'
  ];
  if (!fileInput) return;
  const errorElement = document.getElementById('invoiceFilesError') || createErrorMessageElement('invoiceFiles');
  const parent = fileInput.parentElement;
  parent.classList.remove('valid', 'invalid');
  if (starredCategories.includes(category)) {
    const files = fileInput.files;
    if (files.length === 0) {
      errorElement.textContent = 'Required: At least 1 invoice/document required';
      errorElement.style.color = '#ff4444';
      errorElement.style.display = 'block';
      parent.classList.add('invalid');
      fileInput.style.borderColor = '#ff4444';
    } else {
      let allValid = true;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
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
        parent.classList.add('valid');
        fileInput.style.borderColor = '#00C851';
      } else {
        errorElement.style.color = '#ff4444';
        parent.classList.add('invalid');
        fileInput.style.borderColor = '#ff4444';
      }
    }
  } else {
    const files = fileInput.files;
    if (files.length > 0) {
      let allValid = true;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
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
        errorElement.textContent = `${files.length} file(s) selected (optional)`;
        errorElement.style.color = '#888';
        parent.classList.add('valid');
        fileInput.style.borderColor = '#00C851';
      } else {
        errorElement.style.color = '#ff4444';
        parent.classList.add('invalid');
        fileInput.style.borderColor = '#ff4444';
      }
    } else {
      errorElement.textContent = 'Optional: Upload invoice/documents if available';
      errorElement.style.color = '#888';
      errorElement.style.display = 'block';
      fileInput.style.borderColor = '#444';
    }
  }
  updateSubmitButton();
}

function checkCategoryRequirements() {
  const category = document.getElementById('itemCategory')?.value || '';
  const starredCategories = [
    '*Books', '*Cosmetics/Skincare/Bodycare', '*Food Beverage/Drinks',
    '*Gadgets', '*Oil Ointment', '*Supplement', '*Others'
  ];
  const fileInput = document.getElementById('fileUpload');
  const fileHelp = document.getElementById('fileHelp');
  const fileRequirement = document.getElementById('fileRequirement');
  if (!fileInput || !fileHelp) return;
  if (starredCategories.includes(category)) {
    if (fileRequirement) {
      fileRequirement.textContent = 'Required: ';
      fileRequirement.style.color = '#ff4444';
    }
    fileHelp.style.color = '#ff4444';
    fileHelp.style.fontWeight = 'bold';
    setTimeout(() => validateFilesInRealTime(), 100);
  } else {
    if (fileRequirement) {
      fileRequirement.textContent = 'Optional: ';
      fileRequirement.style.color = '#888';
    }
    fileHelp.style.color = '#888';
    fileHelp.style.fontWeight = 'normal';
    const errorElement = document.getElementById('invoiceFilesError');
    const parent = fileInput.parentElement;
    if (errorElement) {
      errorElement.textContent = 'Optional: Upload invoice/documents if available';
      errorElement.style.color = '#888';
    }
    parent.classList.remove('invalid');
    fileInput.style.borderColor = '#444';
  }
  updateSubmitButton();
}

function updateSubmitButton() {
  const submitBtn = document.getElementById('submitBtn');
  if (!submitBtn) return;
  const fields = [
    'trackingNumber', 'nameOnParcel', 'itemDescription',
    'quantity', 'price', 'collectionPoint', 'itemCategory'
  ];
  let allValid = true;
  fields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    const parent = field?.parentElement;
    if (!field) { allValid = false; return; }
    if (parent && parent.classList.contains('invalid')) { allValid = false; return; }
    if (field.tagName === 'SELECT') {
      if (!field.value) allValid = false;
    } else if (field.type === 'number') {
      if (field.value === '') allValid = false;
    } else {
      if (!field.value.trim()) allValid = false;
    }
  });
  const category = document.getElementById('itemCategory')?.value || '';
  const starredCategories = [
    '*Books', '*Cosmetics/Skincare/Bodycare', '*Food Beverage/Drinks',
    '*Gadgets', '*Oil Ointment', '*Supplement', '*Others'
  ];
  if (starredCategories.includes(category)) {
    const files = document.getElementById('fileUpload')?.files || [];
    const fileParent = document.getElementById('fileUpload')?.parentElement;
    if (files.length === 0 || (fileParent && fileParent.classList.contains('invalid'))) {
      allValid = false;
    }
  }
  submitBtn.disabled = !allValid;
  const submitText = document.getElementById('submitText');
  if (submitText) {
    submitText.textContent = allValid ? 'Submit Declaration' : 'Please fix errors above';
  }
  if (allValid) {
    submitBtn.style.background = 'linear-gradient(135deg, #d4af37, #b8941f)';
    submitBtn.style.cursor = 'pointer';
    submitBtn.style.opacity = '1';
  } else {
    submitBtn.style.background = '#555';
    submitBtn.style.cursor = 'not-allowed';
    submitBtn.style.opacity = '0.7';
  }
}

// ================= DRAFT SYSTEM =================
function saveFormAsDraft() {
  try {
    const form = document.getElementById('declarationForm');
    if (!form) return;
    const formData = new FormData(form);
    const draft = {};
    for (let [key, value] of formData.entries()) {
      if (key !== 'files') draft[key] = value;
    }
    const files = document.getElementById('fileUpload')?.files || [];
    if (files.length > 0) {
      draft.filesCount = files.length;
      draft.filesInfo = Array.from(files).map(file => ({
        name: file.name, size: file.size, type: file.type
      }));
    }
    draft.timestamp = new Date().toISOString();
    draft.id = 'draft_' + Date.now();
    const drafts = JSON.parse(localStorage.getItem('parcelDrafts') || '[]');
    drafts.push(draft);
    localStorage.setItem('parcelDrafts', JSON.stringify(drafts));
    showError('Draft saved successfully!', 'draft-message');
  } catch (error) {
    console.error('Failed to save draft:', error);
    showError('Failed to save draft');
  }
}

function loadDrafts() {
  try {
    const drafts = JSON.parse(localStorage.getItem('parcelDrafts') || '[]');
    const draftCount = document.getElementById('draftCount');
    const draftsList = document.getElementById('draftsList');
    if (draftCount) draftCount.textContent = drafts.length;
    if (draftsList && drafts.length > 0) {
      let html = '<div class="drafts-container">';
      drafts.forEach((draft, index) => {
        html += `
          <div class="draft-item">
            <div class="draft-info">
              <strong>${draft.trackingNumber || 'Untitled'}</strong>
              <small>${new Date(draft.timestamp).toLocaleDateString()}</small>
            </div>
            <div class="draft-actions">
              <button onclick="loadDraftFromList(${index})" class="small-btn">Load</button>
              <button onclick="deleteDraft(${index})" class="small-btn delete">Delete</button>
            </div>
          </div>
        `;
      });
      html += '</div>';
      draftsList.innerHTML = html;
    }
  } catch (error) {
    console.error('Failed to load drafts:', error);
  }
}

function loadDraftFromList(index) {
  try {
    const drafts = JSON.parse(localStorage.getItem('parcelDrafts') || '[]');
    const draft = drafts[index];
    if (!draft) return;
    clearAllValidationErrors();
    Object.keys(draft).forEach(key => {
      if (!['timestamp','id','filesCount','filesInfo'].includes(key)) {
        const field = document.getElementById(key);
        if (field) field.value = draft[key];
      }
    });
    checkCategoryRequirements();
    updateSubmitButton();
    showError('Draft loaded!', 'draft-message');
  } catch (error) {
    console.error('Failed to load draft:', error);
    showError('Failed to load draft');
  }
}

function deleteDraft(index) {
  try {
    const drafts = JSON.parse(localStorage.getItem('parcelDrafts') || '[]');
    drafts.splice(index, 1);
    localStorage.setItem('parcelDrafts', JSON.stringify(drafts));
    loadDrafts();
    showError('Draft deleted', 'draft-message');
  } catch (error) {
    console.error('Failed to delete draft:', error);
    showError('Failed to delete draft');
  }
}

function clearAllValidationErrors() {
  document.querySelectorAll('.validation-message').forEach(el => {
    el.textContent = ''; el.style.display = 'none';
  });
  document.querySelectorAll('input, select, textarea').forEach(field => {
    field.style.borderColor = '';
    field.parentElement.classList.remove('invalid','valid');
  });
  const fileError = document.getElementById('invoiceFilesError');
  if (fileError) {
    fileError.textContent = 'Optional: Upload invoice/documents if available';
    fileError.style.color = '#888'; fileError.style.display = 'block';
  }
}

function toggleDrafts() {
  const list = document.getElementById('draftsList');
  if (list) list.style.display = list.style.display === 'none' ? 'block' : 'none';
}

// ================= SAFARI DETECTION =================
function isSafariBrowser() {
  const ua = navigator.userAgent;
  return /^((?!chrome|android).)*safari/i.test(ua) || /iPad|iPhone|iPod/.test(ua);
}
function safariFileReaderPolyfill() {
  if (typeof FileReader === 'undefined') return false;
  const originalAddEventListener = FileReader.prototype.addEventListener;
  FileReader.prototype.addEventListener = function(type, listener, options) {
    if (type === 'load' || type === 'error') this['on' + type] = listener;
    return originalAddEventListener.call(this, type, listener, options);
  };
  return true;
}
function safariFetchEnhancement() {
  const originalFetch = window.fetch;
  window.fetch = function(resource, init) {
    const enhancedInit = init || {};
    enhancedInit.headers = { ...enhancedInit.headers, 'Accept': 'application/json, text/javascript, */*', 'X-Requested-With': 'XMLHttpRequest' };
    enhancedInit.cache = 'no-store';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    enhancedInit.signal = controller.signal;
    return originalFetch(resource, enhancedInit).then(response => {
      clearTimeout(timeoutId);
      return response;
    }).catch(error => {
      clearTimeout(timeoutId);
      throw error;
    });
  };
}

// ================= LOGIN PAGE INITIALIZATION =================
function initLoginPage() {
  if (!window.location.pathname.includes('login.html')) return;
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('logout')) {
    sessionStorage.clear();
    localStorage.removeItem('lastActivity');
  }
  const phoneInput = document.getElementById('phone');
  if (phoneInput) phoneInput.focus();
}

// ================= UTILITIES =================
function safeRedirect(path) {
  try {
    const basePath = path.split('?')[0].split('#')[0];
    const allowedPaths = [
      'login.html', 'register.html', 'dashboard.html',
      'forgot-password.html', 'password-reset.html',
      'my-info.html', 'parcel-declaration.html', 'track-parcel.html',
      'billing-info.html', 'invoice.html'
    ];
    if (!allowedPaths.includes(basePath)) throw new Error('Unauthorized path');
    window.location.href = path;
  } catch (error) {
    console.error('Redirect error:', error);
    showError('Navigation failed. Please try again.');
  }
}

function formatTrackingNumber(trackingNumber) {
  return trackingNumber.replace(/[^A-Z0-9-]/g, '').toUpperCase();
}
function formatCurrency(amount) {
  return new Intl.NumberFormat('ms-MY', { style: 'currency', currency: 'MYR', minimumFractionDigits: 2 }).format(amount || 0);
}
function formatDate(dateString) {
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' };
  return new Date(dateString).toLocaleDateString('en-MY', options);
}

// ================= MAIN INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  detectViewMode();
  
  const currentPage = window.location.pathname.split('/').pop() || 'login.html';
  const publicPages = ['login.html', 'register.html', 'forgot-password.html'];
  const isPublicPage = publicPages.includes(currentPage);
  
  if (!isPublicPage) {
    const userData = checkSession();
    if (!userData) {
      handleLogout();
      return;
    }
    if (currentPage === 'parcel-declaration.html') {
      const phoneField = document.getElementById('phone');
      if (phoneField) {
        phoneField.value = userData.phone || '';
        phoneField.readOnly = true;
      }
      setupFormSubmission();
      setupCategoryChangeListener();
      initValidationListeners();
      checkCategoryRequirements();
      initRealTimeValidation();
      loadDrafts();

      // Prefill tracking from session or URL
      const prefillTracking = sessionStorage.getItem('prefillTracking');
      const urlParams = new URLSearchParams(window.location.search);
      const urlTracking = urlParams.get('tracking');
      let trackingToUse = prefillTracking || urlTracking;
      if (trackingToUse) {
        const trackingInput = document.getElementById('trackingNumber');
        if (trackingInput) {
          trackingInput.value = trackingToUse;
          trackingInput.readOnly = true;
          trackingInput.style.backgroundColor = '#2a2a2a';
          trackingInput.style.color = '#888';
          trackingInput.title = "Tracking number from login link - cannot be modified";
          sessionStorage.removeItem('prefillTracking');
        }
      }
      if (urlTracking) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    }
  }
  
  createLoaderElement();
  if (currentPage === 'login.html') initLoginPage();
  
  window.addEventListener('beforeunload', () => {
    const errorElement = document.getElementById('error-message');
    if (errorElement) errorElement.style.display = 'none';
  });
  
  const firstInput = document.querySelector('input:not([type="hidden"])');
  if (firstInput) firstInput.focus();
});

function setupFormSubmission() {
  const form = document.getElementById('declarationForm');
  if (!form) return;
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);
  newForm.addEventListener('submit', handleParcelSubmission);
  newForm.addEventListener('input', e => { validateFieldInRealTime(e.target); updateSubmitButton(); });
  const fileInput = newForm.querySelector('#fileUpload');
  if (fileInput) fileInput.addEventListener('change', () => { validateFilesInRealTime(); updateSubmitButton(); });
}

function setupCategoryChangeListener() {
  const categorySelect = document.getElementById('itemCategory');
  if (categorySelect) categorySelect.addEventListener('change', checkCategoryRequirements);
}

function initValidationListeners() {
  // Already handled by real-time validation; kept for compatibility
}

// ================= AUTHENTICATION HANDLERS (kept from Version 1) =================
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

// ================= EXPORT FUNCTIONS FOR HTML =================
window.handleLogout = handleLogout;
window.safeRedirect = safeRedirect;
window.handleRegistration = handleRegistration;
window.handlePasswordRecovery = handlePasswordRecovery;
window.handlePasswordReset = handlePasswordReset;
window.loadDrafts = loadDrafts;
window.loadDraftFromList = loadDraftFromList;
window.deleteDraft = deleteDraft;
window.toggleDrafts = toggleDrafts;
window.saveFormAsDraft = saveFormAsDraft;
window.clearAllValidationErrors = clearAllValidationErrors;
window.showRegistration = () => safeRedirect('register.html');
window.showForgotPassword = () => safeRedirect('forgot-password.html');
window.isSafariBrowser = isSafariBrowser;
window.safariFileReaderPolyfill = safariFileReaderPolyfill;
window.safariFetchEnhancement = safariFetchEnhancement;
