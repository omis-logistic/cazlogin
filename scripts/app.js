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
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  document.body.classList.add(isMobile ? 'mobile-view' : 'desktop-view');
  const viewport = document.querySelector('meta[name="viewport"]') || document.createElement('meta');
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

// ================= PARCEL DECLARATION SYSTEM =================
async function handleParcelSubmission(e) {
  e.preventDefault();
  const form = e.target;
  showMessage('Submitting declaration...', 'pending');

  try {
    const formData = new FormData(form);
    const userData = checkSession();
    
    if (!userData?.phone) {
      showError('Session expired - please login again');
      safeRedirect('login.html');
      return;
    }

    // Extract and validate data
    const trackingNumber = formData.get('trackingNumber').trim();
    const phone = userData.phone;
    const quantity = formData.get('quantity');
    const price = formData.get('price');
    const itemCategory = formData.get('itemCategory');
    const itemDescription = formData.get('itemDescription').trim();

    // Validations
    validateTrackingNumber(trackingNumber);
    validatePhone(phone);
    validateQuantity(quantity);
    validatePrice(price);
    validateItemCategory(itemCategory);

    // File handling
    const rawFiles = Array.from(formData.getAll('files') || [];
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
      files: processedFiles,
      timestamp: new Date().toISOString()
    };

    // Submit declaration
    await submitDeclaration(payload);
    setTimeout(() => verifySubmission(trackingNumber), 3000);

  } catch (error) {
    showError(error.message);
    console.error('Submission Error:', error);
  }
}

function validateTrackingNumber(value) {
  if (!value || !/^[A-Z0-9-]{5,}$/i.test(value)) {
    throw new Error('Invalid tracking number format (5+ alphanumeric characters, hyphens allowed)');
  }
}

function validateItemCategory(category) {
  const validCategories = [
    'Accessories/Jewellery', 'Baby Appliances', 'Bag', 'Car Parts/Accessories',
    'Clothing', 'Electrical Appliances', '*Books', '*Cosmetics/Skincare/Bodycare',
    '*Food Beverage/Drinks', '*Gadgets', '*Oil Ointment', '*Supplement'
  ];
  
  if (!validCategories.includes(category)) {
    throw new Error('Please select a valid item category');
  }
}

async function processFiles(files) {
  return Promise.all(files.map(async file => ({
    name: file.name.replace(/[^a-z0-9._-]/gi, '_'),
    mimeType: file.type,
    data: await toBase64(file),
    size: file.size
  })));
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

async function submitDeclaration(payload) {
  try {
    const response = await fetch(CONFIG.PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Server error');
    return await response.json();
  } catch (error) {
    console.error('Proxy Submission Error:', error);
    throw new Error('Submission received - confirmation pending');
  }
}

async function verifySubmission(trackingNumber) {
  try {
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      const response = await fetch(`${CONFIG.GAS_URL}?action=verifySubmission&tracking=${encodeURIComponent(trackingNumber)}`);
      if (response.ok) {
        const result = await response.json();
        if (result.verified) {
          showMessage('Parcel verified successfully!', 'success');
          setTimeout(() => safeRedirect('dashboard.html'), 2000);
          return;
        }
      }
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    throw new Error('Verification timeout - check dashboard later');
  } catch (error) {
    showError(error.message);
  }
}

// ================= VALIDATION CORE =================
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

// ================= FORM VALIDATION =================
function initValidationListeners() {
  // Existing form validation
  const parcelForm = document.getElementById('parcel-declaration-form');
  if (parcelForm) {
    const inputs = parcelForm.querySelectorAll('input, select');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        switch(input.id) {
          case 'trackingNumber':
            validateTrackingNumber(input.value);
            break;
          case 'quantity':
            validateQuantity(input.value);
            break;
          case 'price':
            validatePrice(input.value);
            break;
        }
        updateSubmitButtonState();
      });
    });
  }

  // New parcel declaration validation
  const decForm = document.getElementById('declarationForm');
  if (decForm) {
    decForm.addEventListener('input', (e) => {
      const target = e.target;
      try {
        if (target.name === 'trackingNumber') validateTrackingNumber(target.value);
        if (target.name === 'quantity') validateQuantity(target.value);
        if (target.name === 'price') validatePrice(target.value);
      } catch (error) {
        showError(error.message);
      }
    });
  }
}

// ================= UTILITIES =================
function safeRedirect(path) {
  const allowedPaths = [
    'login.html', 'register.html', 'dashboard.html',
    'password-reset.html', 'parcel-declaration.html'
  ];
  
  if (allowedPaths.includes(path)) {
    window.location.href = path;
  } else {
    showError('Navigation to unauthorized path blocked');
  }
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
    if (userData) {
      phoneField.value = userData.phone;
      phoneField.readOnly = true;
    }
  }

  // Initialize parcel form submission
  const decForm = document.getElementById('declarationForm');
  if (decForm) {
    decForm.addEventListener('submit', handleParcelSubmission);
  }

  // Existing session checks
  const publicPages = ['login.html', 'register.html', 'forgot-password.html'];
  const isPublicPage = publicPages.some(page => 
    window.location.pathname.includes(page)
  );

  if (!isPublicPage && !checkSession()) {
    safeRedirect('login.html');
  }
});
