// scripts/app.js
// ================= CONFIGURATION =================
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbxM7Ca32kqLortZI0spNPnXsj3M7W732ZlO6kxgv-l7NrpvaAmXr5wR-JYPKPd6Vjmu/exec', // main backend for JSONP (login, etc.)
  PROXY_URL: 'https://script.google.com/macros/s/AKfycbxOz-YN8meJOUA9Aay3poYKKJVetYTKYM-hoXpUzNxxFchUwW21z1JmfzvWp2IJ4ac8UA/exec', // for CORS POST (parcel submission)
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

// ================= JSONP REQUEST (for login, registration, etc.) =================
function jsonpRequest(action, params) {
  return new Promise((resolve, reject) => {
    const callbackName = `jsonp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const url = new URL(CONFIG.GAS_URL);
    url.searchParams.append('callback', callbackName);
    url.searchParams.append('action', action);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    const script = document.createElement('script');
    script.src = url.toString();
    script.async = true;
    script.crossOrigin = 'anonymous';

    let timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Request timeout'));
    }, 20000);

    function cleanup() {
      clearTimeout(timeoutId);
      delete window[callbackName];
      if (script.parentNode) document.head.removeChild(script);
    }

    window[callbackName] = (response) => {
      cleanup();
      if (response && response.success) {
        resolve(response);
      } else {
        reject(new Error(response?.message || 'Request failed'));
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Network error'));
    };

    document.head.appendChild(script);
  });
}

// ================= PARCEL SUBMISSION (using proxy with CORS) =================
async function submitParcelData(payload) {
  const formData = new FormData();
  formData.append('data', JSON.stringify(payload.data));

  if (payload.files && payload.files.length > 0) {
    for (let i = 0; i < payload.files.length; i++) {
      const file = payload.files[i];
      const blob = base64ToBlob(file.base64, file.type);
      formData.append(`file${i}`, blob, file.name);
    }
  }

  const response = await fetch(CONFIG.PROXY_URL, {
    method: 'POST',
    body: formData,
    mode: 'cors',
    cache: 'no-cache',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message || 'Submission failed');
  }
  return result;
}

// Convert base64 to Blob
function base64ToBlob(base64, mimeType) {
  const byteCharacters = atob(base64);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type: mimeType });
}

// ========== LOADING OVERLAY ==========
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

// ========== SUCCESS MESSAGE ==========
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

// ========== RESET FORM ==========
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

// ========== PARCEL SUBMISSION HANDLER ==========
async function handleParcelSubmission(e) {
  e.preventDefault();
  showLoading(true, "Submitting parcel declaration...");

  try {
    const form = e.target;
    const formData = new FormData(form);
    const userData = checkSession();
    if (!userData?.phone) {
      throw new Error('Session expired. Please login again.');
    }

    // Build payload
    const payload = {
      action: 'submitParcelDeclaration',
      data: {
        trackingNumber: formData.get('trackingNumber')?.trim().toUpperCase() || '',
        nameOnParcel: formData.get('nameOnParcel')?.trim() || '',
        phoneNumber: userData.phone,
        itemDescription: formData.get('itemDescription')?.trim() || '',
        quantity: Number(formData.get('quantity')) || 1,
        price: Number(formData.get('price')) || 0,
        collectionPoint: formData.get('collectionPoint') || '',
        itemCategory: formData.get('itemCategory') || ''
      },
      files: []
    };

    // Validate required fields
    const requiredFields = ['trackingNumber', 'nameOnParcel', 'itemDescription', 'quantity', 'price', 'collectionPoint', 'itemCategory'];
    for (const field of requiredFields) {
      const value = payload.data[field];
      if (field === 'price') {
        if (value === undefined || value === null || isNaN(value)) {
          throw new Error(`Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        }
      } else if (field === 'quantity') {
        if (isNaN(value) || value < 1) {
          throw new Error(`Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        }
      } else if (field === 'itemDescription') {
        if (!value || value.trim().length < 3) {
          throw new Error('Item description must be at least 3 characters');
        }
      } else if (!value) {
        throw new Error(`Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
      }
    }

    // Handle files
    const fileInput = document.getElementById('fileUpload');
    const category = payload.data.itemCategory;
    const starredCategories = [
      '*Books', '*Cosmetics/Skincare/Bodycare', '*Food Beverage/Drinks',
      '*Gadgets', '*Oil Ointment', '*Supplement', '*Others'
    ];

    if (starredCategories.includes(category)) {
      if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        throw new Error('Invoice/document upload is required for this category');
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
        const base64Data = await readFileAsBase64(file);
        payload.files.push({
          name: file.name.replace(/[^a-zA-Z0-9._-]/g, '_'),
          type: file.type,
          base64: base64Data
        });
      }
    }

    // Submit using the unified function
    const result = await submitParcelData(payload);
    
    if (result.success) {
      showSubmissionSuccess(payload.data.trackingNumber);
      resetForm();
      setTimeout(() => verifySubmission(payload.data.trackingNumber), 3000);
    } else {
      throw new Error(result.message || 'Submission failed at server');
    }

  } catch (error) {
    console.error('Submission error:', error);
    let errorMessage = error.message;
    if (error.message.includes('Price must be')) {
      errorMessage = '❌ Price must be 0 or greater. 0 is allowed.';
    } else if (error.message.includes('Item description must be')) {
      errorMessage = '❌ Item description must be at least 3 characters.';
    } else if (error.message.includes('Invoice/document upload')) {
      errorMessage = '❌ Invoice/document upload is required for starred categories.';
    } else if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
      errorMessage = '⚠️ Network connection issue. Please check your internet and try again.';
      saveFormAsDraft(); // Auto-save draft on network failure
    } else if (error.message.includes('Session expired')) {
      errorMessage = '❌ Session expired. Please login again.';
      setTimeout(handleLogout, 2000);
    } else if (error.message.includes('HTTP 5')) {
      errorMessage = '❌ Server error. Please try again later.';
    } else {
      errorMessage = `❌ ${error.message}`;
    }
    showError(errorMessage);
  } finally {
    showLoading(false);
  }
}

function showSubmissionSuccess(trackingNumber) {
  const messageElement = document.getElementById('message') || createMessageElement();
  messageElement.innerHTML = `
    <div style="text-align: center; padding: 20px; position: relative;">
      <button id="closeMessageBtn" style="position: absolute; top: 10px; right: 10px; background: #333; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; font-size: 18px;">×</button>
      <div style="font-size: 48px; color: #00C851;">⏳</div>
      <h3 style="color: #00C851; margin: 10px 0;">Submission is processed!</h3>
      <p style="margin: 10px 0;">Tracking Number: <strong style="color: #d4af37;">${trackingNumber}</strong></p>
      <p style="font-size: 0.9em; color: #aaa; margin-top: 15px;">Click <a href="track-parcel.html" style="color: #00C851;">HERE</a> to check status.</p>
    </div>
  `;
  messageElement.className = 'success';
  messageElement.style.display = 'block';
  document.getElementById('closeMessageBtn').addEventListener('click', () => {
    messageElement.style.display = 'none';
  });
}

function createMessageElement() {
  const div = document.createElement('div');
  div.id = 'message';
  div.className = 'message';
  div.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.95);
    color: white;
    padding: 30px;
    border-radius: 10px;
    z-index: 10000;
    display: none;
    min-width: 350px;
    text-align: center;
    box-shadow: 0 0 20px rgba(0,0,0,0.5);
    border: 2px solid #00C851;
  `;
  document.body.appendChild(div);
  return div;
}

async function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function verifySubmission(trackingNumber) {
  try {
    const url = `${CONFIG.PROXY_URL}?tracking=${encodeURIComponent(trackingNumber)}`;
    const response = await fetch(url, { method: 'GET', cache: 'no-cache' });
    if (response.ok) {
      const result = await response.json();
      if (result.exists) {
        console.log('Verification successful:', result);
      }
    }
  } catch (error) {
    console.warn('Verification check failed:', error);
  }
}

// ========== AUTHENTICATION HANDLERS (using JSONP) ==========
async function handleRegistration() {
  if (!validateRegistrationForm()) return;
  const formData = {
    phone: document.getElementById('regPhone').value.trim(),
    password: document.getElementById('regPassword').value,
    email: document.getElementById('regEmail').value.trim()
  };
  try {
    const result = await jsonpRequest('createAccount', formData);
    alert('Registration successful! Please login.');
    safeRedirect('login.html');
  } catch (error) {
    showError(error.message || 'Registration failed');
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
    const result = await jsonpRequest('initiatePasswordReset', { phone, email });
    alert('Temporary password sent to your email!');
    safeRedirect('login.html');
  } catch (error) {
    showError(error.message || 'Password recovery failed');
  }
}

async function handlePasswordReset() {
  const newPass = document.getElementById('newPassword').value;
  const confirmPass = document.getElementById('confirmNewPassword').value;
  const userData = JSON.parse(sessionStorage.getItem('userData'));
  if (!validatePassword(newPass)) {
    showError('Password must contain 6+ characters with at least 1 uppercase and 1 number');
    return;
  }
  if (newPass !== confirmPass) {
    showError('Passwords do not match');
    return;
  }
  try {
    const result = await jsonpRequest('forcePasswordReset', {
      phone: userData.phone,
      newPassword: newPass
    });
    alert('Password updated successfully! Please login with your new password.');
    handleLogout();
  } catch (error) {
    showError(error.message || 'Password reset failed');
  }
}

// ========== VALIDATION HELPERS ==========
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

// ========== DRAFT SYSTEM ==========
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
      draft.filesInfo = Array.from(files).map(f => ({ name: f.name, size: f.size, type: f.type }));
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
  const drafts = JSON.parse(localStorage.getItem('parcelDrafts') || '[]');
  const draftCount = document.getElementById('draftCount');
  const draftsList = document.getElementById('draftsList');
  if (draftCount) draftCount.textContent = drafts.length;
  if (draftsList && drafts.length > 0) {
    let html = '<div class="drafts-container">';
    drafts.forEach((draft, index) => {
      html += `
        <div class="draft-item">
          <div class="draft-info"><strong>${draft.trackingNumber || 'Untitled'}</strong> <small>${new Date(draft.timestamp).toLocaleDateString()}</small></div>
          <div class="draft-actions">
            <button onclick="loadDraft(${index})" class="small-btn">Load</button>
            <button onclick="deleteDraft(${index})" class="small-btn delete">Delete</button>
          </div>
        </div>
      `;
    });
    html += '</div>';
    draftsList.innerHTML = html;
  } else if (draftsList) {
    draftsList.innerHTML = '<p class="empty-drafts">No saved drafts</p>';
  }
}

window.loadDraft = function(index) {
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
  if (typeof checkCategoryRequirements === 'function') checkCategoryRequirements();
  if (typeof updateSubmitButton === 'function') updateSubmitButton();
  showError('Draft loaded!', 'draft-message');
};

window.deleteDraft = function(index) {
  const drafts = JSON.parse(localStorage.getItem('parcelDrafts') || '[]');
  drafts.splice(index, 1);
  localStorage.setItem('parcelDrafts', JSON.stringify(drafts));
  loadDrafts();
  showError('Draft deleted', 'draft-message');
};

function clearAllValidationErrors() {
  document.querySelectorAll('.validation-message').forEach(el => {
    el.textContent = '';
    el.style.display = 'none';
  });
  document.querySelectorAll('input, select, textarea').forEach(field => {
    field.style.borderColor = '';
    field.parentElement?.classList.remove('invalid', 'valid');
  });
  const fileError = document.getElementById('invoiceFilesError');
  if (fileError) {
    fileError.textContent = 'Optional: Upload invoice/documents if available';
    fileError.style.color = '#888';
    fileError.style.display = 'block';
  }
}

// ========== SAFARI DETECTION ==========
function isSafariBrowser() {
  const ua = navigator.userAgent;
  return /^((?!chrome|android).)*safari/i.test(ua) || /iPad|iPhone|iPod/.test(ua);
}

// ========== REAL-TIME VALIDATION (simplified, kept from original) ==========
function initRealTimeValidation() {
  setTimeout(() => {
    runInitialValidation();
    setupRealTimeValidationListeners();
  }, 100);
}

function runInitialValidation() {
  const fields = [
    { id: 'trackingNumber', type: 'tracking' },
    { id: 'nameOnParcel', type: 'name' },
    { id: 'itemDescription', type: 'description' },
    { id: 'quantity', type: 'quantity' },
    { id: 'price', type: 'price' },
    { id: 'collectionPoint', type: 'select' },
    { id: 'itemCategory', type: 'select' }
  ];
  fields.forEach(f => {
    const el = document.getElementById(f.id);
    if (!el) return;
    let isValid = false, msg = '';
    if (f.type === 'tracking') isValid = /^[A-Za-z0-9\-]{5,}$/.test(el.value);
    else if (f.type === 'name') isValid = el.value.trim().length >= 2;
    else if (f.type === 'description') isValid = el.value.trim().length >= 3;
    else if (f.type === 'quantity') isValid = parseInt(el.value) >= 1 && parseInt(el.value) <= 999;
    else if (f.type === 'price') isValid = parseFloat(el.value) >= 0;
    else if (f.type === 'select') isValid = el.value !== '';
    updateFieldValidationState(el, isValid, msg);
  });
  const cat = document.getElementById('itemCategory')?.value;
  const starred = ['*Books','*Cosmetics/Skincare/Bodycare','*Food Beverage/Drinks','*Gadgets','*Oil Ointment','*Supplement','*Others'];
  if (starred.includes(cat) && (!document.getElementById('fileUpload')?.files.length)) {
    const fileInput = document.getElementById('fileUpload');
    const fileError = document.getElementById('invoiceFilesError');
    if (fileInput && fileError) {
      fileError.textContent = 'Required: At least 1 invoice/document required';
      fileError.style.color = '#ff4444';
      fileInput.style.borderColor = '#ff4444';
      fileInput.parentElement.classList.add('invalid');
    }
  }
  updateSubmitButton();
}

function setupRealTimeValidationListeners() {
  ['trackingNumber','nameOnParcel','itemDescription','quantity','price','collectionPoint','itemCategory'].forEach(id => {
    const field = document.getElementById(id);
    if (field) {
      field.addEventListener('input', () => validateFieldInRealTime(field));
      field.addEventListener('change', () => validateFieldInRealTime(field));
    }
  });
  const fileUpload = document.getElementById('fileUpload');
  if (fileUpload) fileUpload.addEventListener('change', validateFilesInRealTime);
}

function validateFieldInRealTime(field) {
  const value = field.value;
  let isValid = false, msg = '';
  if (field.id === 'trackingNumber') isValid = /^[A-Za-z0-9\-]{5,}$/.test(value);
  else if (field.id === 'nameOnParcel') isValid = value.trim().length >= 2;
  else if (field.id === 'itemDescription') isValid = value.trim().length >= 3;
  else if (field.id === 'quantity') isValid = parseInt(value) >= 1 && parseInt(value) <= 999;
  else if (field.id === 'price') isValid = parseFloat(value) >= 0;
  else if (field.id === 'collectionPoint' || field.id === 'itemCategory') isValid = value !== '';
  updateFieldValidationState(field, isValid, msg);
  updateSubmitButton();
  if (field.id === 'itemCategory') setTimeout(checkCategoryRequirements, 100);
}

function validateFilesInRealTime() {
  const fileInput = document.getElementById('fileUpload');
  const category = document.getElementById('itemCategory')?.value || '';
  const starred = ['*Books','*Cosmetics/Skincare/Bodycare','*Food Beverage/Drinks','*Gadgets','*Oil Ointment','*Supplement','*Others'];
  if (!fileInput) return;
  const errorElement = document.getElementById('invoiceFilesError');
  const parent = fileInput.parentElement;
  parent.classList.remove('valid','invalid');
  if (starred.includes(category)) {
    if (!fileInput.files.length) {
      errorElement.textContent = 'Required: At least 1 invoice/document required';
      errorElement.style.color = '#ff4444';
      parent.classList.add('invalid');
      fileInput.style.borderColor = '#ff4444';
    } else {
      let allValid = true;
      for (let f of fileInput.files) {
        if (!CONFIG.ALLOWED_FILE_TYPES.includes(f.type)) {
          errorElement.textContent = `File "${f.name}" must be JPG, PNG, or PDF`;
          allValid = false; break;
        }
        if (f.size > CONFIG.MAX_FILE_SIZE) {
          errorElement.textContent = `File "${f.name}" exceeds 5MB limit`;
          allValid = false; break;
        }
      }
      if (allValid) {
        errorElement.textContent = `${fileInput.files.length} file(s) selected`;
        errorElement.style.color = '#00C851';
        parent.classList.add('valid');
        fileInput.style.borderColor = '#00C851';
      } else {
        parent.classList.add('invalid');
        fileInput.style.borderColor = '#ff4444';
      }
    }
  } else {
    if (fileInput.files.length) {
      let allValid = true;
      for (let f of fileInput.files) {
        if (!CONFIG.ALLOWED_FILE_TYPES.includes(f.type)) {
          errorElement.textContent = `File "${f.name}" must be JPG, PNG, or PDF`;
          allValid = false; break;
        }
        if (f.size > CONFIG.MAX_FILE_SIZE) {
          errorElement.textContent = `File "${f.name}" exceeds 5MB limit`;
          allValid = false; break;
        }
      }
      if (allValid) {
        errorElement.textContent = `${fileInput.files.length} file(s) selected (optional)`;
        errorElement.style.color = '#888';
        parent.classList.add('valid');
        fileInput.style.borderColor = '#00C851';
      } else {
        parent.classList.add('invalid');
        fileInput.style.borderColor = '#ff4444';
      }
    } else {
      errorElement.textContent = 'Optional: Upload invoice/documents if available';
      errorElement.style.color = '#888';
      fileInput.style.borderColor = '#444';
    }
  }
  updateSubmitButton();
}

function updateFieldValidationState(field, isValid, message) {
  const errorEl = document.getElementById(field.id + 'Error');
  const parent = field.parentElement;
  parent.classList.remove('valid','invalid');
  if (isValid) {
    parent.classList.add('valid');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
      field.style.borderColor = '#444';
    }
  } else {
    parent.classList.add('invalid');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.color = '#ff4444';
      errorEl.style.display = 'block';
      field.style.borderColor = '#ff4444';
    }
  }
  if (errorEl) {
    errorEl.style.background = 'transparent';
    errorEl.style.border = 'none';
    errorEl.style.boxShadow = 'none';
    errorEl.style.padding = '2px 0';
  }
}

function checkCategoryRequirements() {
  const category = document.getElementById('itemCategory')?.value || '';
  const starred = ['*Books','*Cosmetics/Skincare/Bodycare','*Food Beverage/Drinks','*Gadgets','*Oil Ointment','*Supplement','*Others'];
  const fileInput = document.getElementById('fileUpload');
  const fileHelp = document.getElementById('fileHelp');
  const fileRequirement = document.getElementById('fileRequirement');
  if (!fileInput || !fileHelp) return;
  if (starred.includes(category)) {
    if (fileRequirement) { fileRequirement.textContent = 'Required: '; fileRequirement.style.color = '#ff4444'; }
    fileHelp.style.color = '#ff4444'; fileHelp.style.fontWeight = 'bold';
    setTimeout(validateFilesInRealTime, 100);
  } else {
    if (fileRequirement) { fileRequirement.textContent = 'Optional: '; fileRequirement.style.color = '#888'; }
    fileHelp.style.color = '#888'; fileHelp.style.fontWeight = 'normal';
    const errorEl = document.getElementById('invoiceFilesError');
    if (errorEl) errorEl.textContent = 'Optional: Upload invoice/documents if available';
    fileInput.style.borderColor = '#444';
  }
  updateSubmitButton();
}

function updateSubmitButton() {
  const btn = document.getElementById('submitBtn');
  if (!btn) return;
  const fields = ['trackingNumber','nameOnParcel','itemDescription','quantity','price','collectionPoint','itemCategory'];
  let allValid = true;
  fields.forEach(id => {
    const f = document.getElementById(id);
    if (!f || (f.parentElement?.classList.contains('invalid')) || (f.tagName==='SELECT' && !f.value) || (f.type==='number' && f.value==='') || (!f.value.trim())) {
      allValid = false;
    }
  });
  const cat = document.getElementById('itemCategory')?.value;
  const starred = ['*Books','*Cosmetics/Skincare/Bodycare','*Food Beverage/Drinks','*Gadgets','*Oil Ointment','*Supplement','*Others'];
  if (starred.includes(cat)) {
    const files = document.getElementById('fileUpload')?.files;
    if (!files || files.length === 0 || document.getElementById('fileUpload')?.parentElement?.classList.contains('invalid')) {
      allValid = false;
    }
  }
  btn.disabled = !allValid;
  const submitText = document.getElementById('submitText');
  if (submitText) submitText.textContent = allValid ? 'Submit Declaration' : 'Please fix errors above';
  btn.style.background = allValid ? 'linear-gradient(135deg, #d4af37, #b8941f)' : '#555';
  btn.style.cursor = allValid ? 'pointer' : 'not-allowed';
  btn.style.opacity = allValid ? '1' : '0.7';
}

// ========== UTILITIES ==========
function safeRedirect(path) {
  const allowed = ['login.html','register.html','dashboard.html','forgot-password.html','password-reset.html','my-info.html','parcel-declaration.html','track-parcel.html','billing-info.html','invoice.html'];
  if (allowed.includes(path.split('?')[0].split('#')[0])) {
    window.location.href = path;
  } else {
    showError('Navigation failed');
  }
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  detectViewMode();
  const currentPage = window.location.pathname.split('/').pop() || 'login.html';
  const publicPages = ['login.html','register.html','forgot-password.html'];
  if (!publicPages.includes(currentPage)) {
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
      const form = document.getElementById('declarationForm');
      if (form) {
        form.addEventListener('submit', handleParcelSubmission);
      }
      setupCategoryChangeListener();
      initRealTimeValidation();
      checkCategoryRequirements();
      loadDrafts();
    }
  }
  createLoaderElement();
  window.addEventListener('beforeunload', () => {
    const err = document.getElementById('error-message');
    if (err) err.style.display = 'none';
  });
  const firstInput = document.querySelector('input:not([type="hidden"])');
  if (firstInput) firstInput.focus();
});

function setupCategoryChangeListener() {
  const cat = document.getElementById('itemCategory');
  if (cat) cat.addEventListener('change', checkCategoryRequirements);
}

// Expose functions to global scope for HTML event handlers
window.handleLogout = handleLogout;
window.safeRedirect = safeRedirect;
window.handleRegistration = handleRegistration;
window.handlePasswordRecovery = handlePasswordRecovery;
window.handlePasswordReset = handlePasswordReset;
window.loadDrafts = loadDrafts;
window.saveDraft = saveFormAsDraft;
window.toggleDrafts = function() {
  const list = document.getElementById('draftsList');
  if (list) list.style.display = list.style.display === 'none' ? 'block' : 'none';
};
window.showRegistration = () => safeRedirect('register.html');
window.showForgotPassword = () => safeRedirect('forgot-password.html');
window.isSafariBrowser = isSafariBrowser;
