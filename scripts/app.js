// ================= CONFIGURATION =================
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbwxkrALkUutlXhVuWULMG4Oa1MfJqcWBCtzpNVwBpniwz0Qhl-ks5EYAw1HfvHd9OIS/exec',
  PROXY_URL: 'https://script.google.com/macros/s/AKfycbyQ9W-dSH8Q1XtL_lS3OBXwu6KRpB5K7zDcKCDNlCLRCHnX1LAuht-b2OKLs6fQcYGFzw/exec',
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
  return JSON.parse(sessionData);
};

function handleLogout() {
  sessionStorage.removeItem('userData');
  localStorage.removeItem('lastActivity');
  safeRedirect('login.html');
}

// ================= REAL-TIME VALIDATION SYSTEM =================
let validationState = {
  trackingNumber: false,
  phone: true,
  itemDescription: false,
  quantity: false,
  price: false,
  collectionPoint: false,
  itemCategory: false,
  files: false
};

function showValidationMessage(text, type = 'error') {
  const messageDiv = document.getElementById('validation-message');
  messageDiv.className = `validation-message ${type}`;
  messageDiv.textContent = text;
  messageDiv.style.display = 'block';

  clearTimeout(messageDiv.timeout);
  messageDiv.timeout = setTimeout(() => {
    messageDiv.style.display = 'none';
  }, type === 'error' ? 8000 : 5000);
}

function validateAllFields() {
  return Object.values(validationState).every(v => v);
}

function updateSubmitButton() {
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.disabled = !validateAllFields();
    submitBtn.textContent = validateAllFields() ? 'Submit Declaration' : 'Complete All Fields';
  }
}

// ================= VALIDATION HANDLERS =================
const Validators = {
  trackingNumber: (value) => /^[A-Z0-9-]{5,}$/i.test(value),
  phone: (value) => /^(673\d{7,}|60\d{9,})$/.test(value),
  itemDescription: (value) => value.length >= 5,
  quantity: (value) => !isNaN(value) && value > 0 && value < 1000,
  price: (value) => !isNaN(value) && value > 0,
  collectionPoint: (value) => !!value,
  itemCategory: (value) => [
    'Accessories/Jewellery', 'Baby Appliances', 'Bag', 'Car Parts/Accessories',
    'Carpets/Mat', 'Clothing', 'Computer Accessories', 'Cordless', 'Decorations',
    'Disposable Pad/Mask', 'Electrical Appliances', 'Fabric', 'Fashion Accessories',
    'Fishing kits/Accessories', 'Footware Shoes/Slippers', 'Game/Console/Board',
    'Hand Tools', 'Handphone Casing', 'Headgear', 'Home Fitting/Furniture',
    'Kitchenware', 'LED/Lamp', 'Matters/Bedding', 'Mix Item', 'Motor Part/Accessories',
    'Others', 'Perfume', 'Phone Accessories', 'Plastic Article', 'RC Parts/Accessories',
    'Rubber', 'Seluar', 'Socks', 'Sport Equipment', 'Stationery', 'Stickers',
    'Storage', 'Telkong', 'Toys', 'Tudong', 'Tumbler', 'Underwear',
    'Watch & Accessories', 'Wire, Adapter & Plug',
    '*Books', '*Cosmetics/Skincare/Bodycare', '*Food Beverage/Drinks',
    '*Gadgets', '*Oil Ointment', '*Supplement'
  ].includes(value),
  files: (files, category) => {
    const starred = ['*Books', '*Cosmetics/Skincare/Bodycare', '*Food Beverage/Drinks',
      '*Gadgets', '*Oil Ointment', '*Supplement'];
    if (starred.includes(category)) {
      return files.length > 0 && files.length <= 3 && 
             files.every(f => f.size <= CONFIG.MAX_FILE_SIZE);
    }
    return true;
  }
};

function handleInputValidation(e) {
  const { id, value } = e.target;
  let isValid = false;
  
  switch(id) {
    case 'trackingNumber':
      isValid = Validators.trackingNumber(value.toUpperCase());
      break;
    case 'itemDescription':
      isValid = Validators.itemDescription(value);
      break;
    case 'quantity':
      isValid = Validators.quantity(parseInt(value));
      break;
    case 'price':
      isValid = Validators.price(parseFloat(value));
      break;
    case 'collectionPoint':
      isValid = Validators.collectionPoint(value);
      break;
    case 'itemCategory':
      isValid = Validators.itemCategory(value);
      if (isValid) {
        const files = Array.from(document.getElementById('fileUpload').files);
        validationState.files = Validators.files(files, value);
      }
      break;
  }

  if (id in validationState) validationState[id] = isValid;
  updateSubmitButton();
}

// ================= FILE HANDLING =================
async function processFiles(files) {
  return Promise.all(files.map(async file => ({
    name: file.name.replace(/[^\w.-]/g, '_'),
    mimeType: file.type,
    data: await readFileAsBase64(file),
    size: file.size
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

function handleFileInput(e) {
  const files = Array.from(e.target.files);
  const category = document.getElementById('itemCategory').value;
  
  try {
    if (!Validators.files(files, category)) {
      throw new Error(
        category.startsWith('*') 
          ? 'Requires 1-3 files (max 5MB each)' 
          : 'File size exceeds 5MB limit'
      );
    }
    validationState.files = true;
    showValidationMessage(`${files.length} valid files selected`, 'success');
  } catch (error) {
    validationState.files = false;
    showValidationMessage(error.message);
    e.target.value = '';
  }
  updateSubmitButton();
}

// ================= SUBMISSION HANDLER =================
async function submitDeclaration(payload) {
  try {
    const response = await fetch(CONFIG.PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `payload=${encodeURIComponent(JSON.stringify(payload))}`
    });

    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Submission failed');
    return result;
  } catch (error) {
    console.error('Submission Error:', error);
    throw new Error('Submission received - confirmation pending');
  }
}

async function handleParcelSubmission(e) {
  e.preventDefault();
  if (!validateAllFields()) return;

  const formData = new FormData(e.target);
  const userData = checkSession();
  
  try {
    const payload = {
      trackingNumber: formData.get('trackingNumber').toUpperCase(),
      phone: userData.phone,
      itemDescription: formData.get('itemDescription'),
      quantity: parseInt(formData.get('quantity')),
      price: parseFloat(formData.get('price')),
      collectionPoint: formData.get('collectionPoint'),
      itemCategory: formData.get('itemCategory'),
      files: await processFiles(formData.getAll('files'))
    };

    const result = await submitDeclaration(payload);
    showValidationMessage(result.message || 'Submission successful!', 'success');
    setTimeout(() => verifySubmission(payload.trackingNumber), 3000);
  } catch (error) {
    showValidationMessage(error.message, error.message.includes('pending') ? 'warning' : 'error');
  }
}

// ================= VERIFICATION SYSTEM =================
async function verifySubmission(trackingNumber) {
  try {
    const url = new URL(CONFIG.PROXY_URL);
    url.searchParams.append('tracking', encodeURIComponent(trackingNumber));
    
    const response = await fetch(url);
    const result = await response.json();
    
    if (result?.exists) {
      showValidationMessage('Parcel verification complete!', 'success');
      setTimeout(() => safeRedirect('dashboard.html'), 2000);
    }
  } catch (error) {
    console.error('Verification Error:', error);
  }
}

// ================= AUTHENTICATION HANDLERS =================
async function callAPI(action, payload) {
  try {
    const response = await fetch(CONFIG.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload })
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleAuth(action, formData) {
  try {
    const result = await callAPI(action, formData);
    if (result.success) {
      if (action === 'processLogin') {
        sessionStorage.setItem('userData', JSON.stringify(result));
        localStorage.setItem('lastActivity', Date.now());
        safeRedirect(result.tempPassword ? 'password-reset.html' : 'dashboard.html');
      } else {
        safeRedirect('login.html');
      }
    } else {
      showValidationMessage(result.error || 'Authentication failed');
    }
  } catch (error) {
    showValidationMessage('Request failed - please try again');
  }
}

// ================= UTILITIES =================
function safeRedirect(path) {
  const allowedPaths = [
    'login.html', 'register.html', 'dashboard.html',
    'forgot-password.html', 'password-reset.html',
    'my-info.html', 'parcel-declaration.html', 'track-parcel.html'
  ];
  
  if (allowedPaths.includes(path)) {
    window.location.href = path;
  }
}

// ================= INITIALIZATION =================
function initParcelDeclaration() {
  const userData = checkSession();
  const phoneField = document.getElementById('phone');
  if (phoneField) {
    phoneField.value = userData?.phone || '';
    phoneField.readOnly = true;
  }

  // Event Listeners
  const form = document.getElementById('declarationForm');
  if (form) {
    form.addEventListener('submit', handleParcelSubmission);
    form.querySelectorAll('input, select').forEach(input => {
      input.addEventListener('input', handleInputValidation);
    });
    document.getElementById('fileUpload').addEventListener('change', handleFileInput);
  }
  updateSubmitButton();
}

document.addEventListener('DOMContentLoaded', () => {
  detectViewMode();
  initParcelDeclaration();
});
