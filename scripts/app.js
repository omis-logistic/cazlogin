// ================= CONFIGURATION =================
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycby1UA-MIEf7PeQlg98UfmPMlhgR_UNnx-stW-og9oEFC5sY4MbqojzJaxUx80cnvjML/exec',
  PROXY_URL: 'https://script.google.com/macros/s/AKfycbyhy1T0tgI8UTfECzBmzt2Ilbq6wrlOrtRZVpI72CLOexlNdXzU63pQAHqW1aVOp2abwQ/exec',
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
  
  // Special handling for success-like messages
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

// ================= PARCEL DECLARATION HANDLER =================
async function handleParcelSubmission(e) {
  e.preventDefault();
  const form = e.target;
  showError('Processing submission...', 'status-message');

  try {
    // Validate user session first
    const userData = checkSession();
    if (!userData?.phone) {
      showError('Session expired - please login again');
      safeRedirect('login.html');
      return;
    }

    // Collect form data
    const formData = new FormData(form);
    const trackingNumber = formData.get('trackingNumber').trim().toUpperCase();
    console.log('Verifying tracking:', trackingNumber);
    if (typeof trackingNumber !== 'string') {
      throw new Error('Invalid tracking number format');
    }
    const phone = userData.phone; // From session
    const quantity = parseInt(formData.get('quantity'));
    const price = parseFloat(formData.get('price'));
    const itemCategory = formData.get('itemCategory');
    const itemDescription = formData.get('itemDescription').trim();

    // Validate core fields
    validateTrackingNumber(trackingNumber);
    validateItemCategory(itemCategory);
    validateQuantity(quantity);
    validatePrice(price);

    // Process files
    const rawFiles = Array.from(formData.getAll('files') || []);
    const validFiles = rawFiles.filter(file => file.size > 0);
    validateFiles(itemCategory, validFiles);
    const processedFiles = await processFiles(validFiles);

    // Build payload
    const payload = {
      trackingNumber,
      phone,
      itemDescription,
      quantity,
      price,
      collectionPoint: formData.get('collectionPoint'),
      itemCategory,
      files: processedFiles
    };

    // Submit declaration
    const result = await submitDeclaration(payload);
    
    if (result.success) {
      showError('Submission received! Verifying...', 'status-message success');
      setTimeout(() => verifySubmission(trackingNumber), 3000);
    } else {
      showError(result.message || 'Submission requires verification');
      setTimeout(() => verifySubmission(trackingNumber), 5000);
    }

  } catch (error) {
    console.warn('Submission flow:', error.message);
    showError('Submission received - confirmation pending');
    
    // If we have trackingNumber, attempt verification
    if (trackingNumber) {
      setTimeout(() => verifySubmission(trackingNumber), 5000);
    }
  }
}

// ================= VALIDATION CORE =================
// New function for input element validation
function validateTrackingNumberInput(inputElement) {
  const value = inputElement.value.trim().toUpperCase();
  const isValid = /^[A-Z0-9-]{5,}$/i.test(value);
  showError(isValid ? '' : 'Invalid tracking format (5+ alphanum/-)', 'trackingError');
  return isValid;
}

// Keep existing submission validation
function validateTrackingNumber(value) {
  if (!/^[A-Z0-9-]{5,}$/i.test(value)) {
    throw new Error('Invalid tracking number format');
  }
}

function validateItemCategory(category) {
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
    'Watch & Accessories', 'Wire, Adapter & Plug',
    '*Books', '*Cosmetics/Skincare/Bodycare', '*Food Beverage/Drinks',
    '*Gadgets', '*Oil Ointment', '*Supplement'
  ];
  
  if (!validCategories.includes(category)) {
    throw new Error('Please select a valid item category');
  }
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

// ================= FILE HANDLING =================
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
      throw new Error(`${file.name} exceeds ${CONFIG.MAX_FILE_SIZE/1024/1024}MB limit`);
    }
  });
}

function handleFileSelection(input) {
  try {
    const files = Array.from(input.files);
    const category = document.getElementById('itemCategory').value;
    
    // Validate against starred categories
    const starredCategories = [
      '*Books', '*Cosmetics/Skincare/Bodycare', '*Food Beverage/Drinks',
      '*Gadgets', '*Oil Ointment', '*Supplement'
    ];
    
    if (starredCategories.includes(category)) {
      if (files.length < 1) throw new Error('At least 1 file required');
      if (files.length > 3) throw new Error('Max 3 files allowed');
    }

    // Validate individual files
    files.forEach(file => {
      if (file.size > CONFIG.MAX_FILE_SIZE) {
        throw new Error(`${file.name} exceeds 5MB`);
      }
    });

    showError(`${files.length} valid files selected`, 'status-message success');
    
  } catch (error) {
    showError(error.message);
    input.value = '';
  }
}

// ================= SUBMISSION HANDLER =================
async function submitDeclaration(payload) {
  try {
    const formBody = `payload=${encodeURIComponent(JSON.stringify(payload))}`;
    
    const response = await fetch(CONFIG.PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded' // Remove charset parameter
      },
      body: formBody
    });

    // Handle potential empty response
    const textResponse = await response.text();
    const result = textResponse ? JSON.parse(textResponse) : {};

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Submission confirmation pending');
    }

    return result;

  } catch (error) {
    console.warn('Submission notice:', error.message);
    // Special case handling for successful submission without confirmation
    if (error.message.includes('pending')) {
      return { success: true, message: error.message };
    }
    throw error;
  }
}

// ================= VERIFICATION SYSTEM =================
async function verifySubmission(trackingNumber) {
  try {
    // Add safety check
    if (typeof trackingNumber !== 'string') {
      throw new Error('Invalid tracking number');
    }
    
    const encodedTracking = encodeURIComponent(trackingNumber);
    const verificationURL = `${CONFIG.PROXY_URL}?tracking=${encodedTracking}`;

    const response = await fetch(verificationURL, {
      method: 'GET',
      cache: 'no-cache'
    });

    // 4. Handle empty responses
    if (!response.ok) throw new Error('Verification service unavailable');
    
    // 5. Parse response
    const result = await response.json();
    
    if (result.exists) {
      showError('Parcel verification complete!', 'status-message success');
      setTimeout(() => safeRedirect('dashboard.html'), 1500);
    } else if (result.error) {
      showError(result.error);
    } else {
      showError('Verification pending - check back later');
    }

  } catch (error) {
    console.warn('Verification check:', error.message);
    showError('Confirmation delayed - check back later');
  }
}

// ================= FORM VALIDATION UTILITIES =================
function checkAllFields() {
  const validations = [
    validateTrackingNumberInput(document.getElementById('trackingNumber')),
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

// ================= FORM INITIALIZATION =================
function initValidationListeners() {
  const parcelForm = document.getElementById('parcel-declaration-form');
  if (parcelForm) {
    const inputs = parcelForm.querySelectorAll('input, select');
    
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        switch(input.id) {
          case 'trackingNumber':
            validateTrackingNumberInput(input); // Use new input validation
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
  return trackingNumber.replace(/[^A-Z0-9-]/g, '').toUpperCase();
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
  detectViewMode();
  initValidationListeners();
  
  // Initialize parcel declaration form
  const parcelForm = document.getElementById('declarationForm');
  if (parcelForm) {
    parcelForm.addEventListener('submit', handleParcelSubmission);
    const phoneField = document.getElementById('phone');
    if (phoneField) {
      const userData = checkSession();
      phoneField.value = userData?.phone || '';
      phoneField.readOnly = true;
    }
  }

  // Session checks
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

// ================= DEBUG UTILITIES =================
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
