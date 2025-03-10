// ================= CONFIGURATION =================
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbwxkrALkUutlXhVuWULMG4Oa1MfJqcWBCtzpNVwBpniwz0Qhl-ks5EYAw1HfvHd9OIS/exec',
  PROXY_URL: 'https://script.google.com/macros/s/AKfycbw0d5OTcj4Z_ZZXGjlVyzBKXOYCUMRx-hl4P2KaiVCjOdLNz7i7yDFen4kK-HZ7DlR7pg/exec',
  SESSION_TIMEOUT: 3600,
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
  MAX_FILES: 3
};

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  detectViewMode();
  initValidationListeners();
  initParcelValidation();

  const publicPages = ['login.html', 'register.html', 'forgot-password.html'];
  const isPublicPage = publicPages.some(page => window.location.pathname.includes(page));

  if (!isPublicPage) {
    const userData = checkSession();
    if (!userData) return;
    
    // Auto-populate phone in parcel declaration
    const phoneField = document.getElementById('phone');
    if (phoneField) {
      phoneField.value = userData.phone;
      phoneField.readOnly = true;
    }

    if (userData.tempPassword && !window.location.pathname.includes('password-reset.html')) {
      handleLogout();
    }
  }

  window.addEventListener('beforeunload', () => {
    const errorElement = document.getElementById('error-message');
    if (errorElement) errorElement.style.display = 'none';
  });
});

// ================= VIEWPORT MANAGEMENT =================
function detectViewMode() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  document.body.classList.add(isMobile ? 'mobile-view' : 'desktop-view');
  const viewport = document.querySelector('meta[name="viewport"]') || document.createElement('meta');
  viewport.content = isMobile 
    ? 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
    : 'width=1200';
  if (!document.querySelector('meta[name="viewport"]')) document.head.prepend(viewport);
}

// ================= ERROR HANDLING =================
function showError(message, targetId = 'error-message') {
  const errorElement = document.getElementById(targetId) || createErrorElement();
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  setTimeout(() => errorElement.style.display = 'none', 5000);
}

function createErrorElement() {
  const errorDiv = document.createElement('div');
  errorDiv.id = 'error-message';
  errorDiv.className = 'error-message';
  errorDiv.style.cssText = `/* existing styles */`;
  document.body.prepend(errorDiv);
  return errorDiv;
}

// ================= SESSION MANAGEMENT =================
const checkSession = () => {
  const sessionData = sessionStorage.getItem('userData');
  const lastActivity = localStorage.getItem('lastActivity');
  if (!sessionData) { handleLogout(); return null; }
  if (lastActivity && Date.now() - lastActivity > CONFIG.SESSION_TIMEOUT * 1000) { handleLogout(); return null; }
  localStorage.setItem('lastActivity', Date.now());
  const userData = JSON.parse(sessionData);
  if (userData?.tempPassword && !window.location.pathname.includes('password-reset.html')) { handleLogout(); return null; }
  return userData;
};

function handleLogout() {
  sessionStorage.removeItem('userData');
  localStorage.removeItem('lastActivity');
  safeRedirect('login.html');
}

// ================= API HANDLER =================
async function callAPI(action, payload) {
  try {
    const formData = new FormData();
    if (payload.files) {
      payload.files.forEach((file, index) => {
        const blob = new Blob([Uint8Array.from(atob(file.base64), c => c.charCodeAt(0))], { type: file.type });
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
    return { success: false, message: error.message };
  }
}

// ================= PARCEL DECLARATION SYSTEM =================
async function handleParcelSubmission(e) {
  e.preventDefault();
  showMessage('Submitting declaration...', 'pending');
  const form = e.target;
  
  try {
    const userData = checkSession();
    if (!userData?.phone) throw new Error('Session expired');
    
    const formData = new FormData(form);
    const trackingNumber = formData.get('trackingNumber').trim();
    const quantity = formData.get('quantity');
    const price = formData.get('price');
    const itemCategory = formData.get('itemCategory');
    const itemDescription = formData.get('itemDescription').trim();
    const rawFiles = Array.from(formData.getAll('files') || [];
    const validFiles = rawFiles.filter(file => file.size > 0);

    // Validations
    validateTrackingNumber(trackingNumber);
    validateQuantity(quantity);
    validatePrice(price);
    validateItemCategory(itemCategory);
    validateFiles(itemCategory, validFiles);

    // Prepare payload
    const payload = {
      trackingNumber,
      phone: userData.phone,
      itemDescription,
      quantity: parseInt(quantity),
      price: parseFloat(price),
      collectionPoint: formData.get('collectionPoint'),
      itemCategory,
      files: await processFiles(validFiles),
      timestamp: new Date().toISOString()
    };

    // Submit through proxy
    await submitDeclaration(payload);
    setTimeout(() => verifySubmission(trackingNumber), 3000);

  } catch (error) {
    showError(error.message);
    console.error('Submission Error:', error);
  }
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
    throw new Error('Submission received - confirmation pending');
  }
}

// ================= VALIDATION CORE =================
function validateTrackingNumber(value) {
  if (!/^[A-Z0-9-]{5,}$/i.test(value)) throw new Error('Invalid tracking number format');
}

function validateItemCategory(category) {
  const validCategories = [    'Accessories/Jewellery','Baby Appliances','Bag','Car Parts/Accessories','Carpets/Mat','Clothing',
    'Computer Accessories','Cordless','Decorations','Disposable Pad/Mask','Electrical Appliances','Fabric','Fashion Accessories',
    'Fishing kits/Accessories','Footware Shoes/Slippers','Game/Console/Board','Hand Tools','Handphone Casing','Headgear',
    'Home Fitting/Furniture','Kitchenware','LED/Lamp','Matters/Bedding','Mix Item','Motor Part/Accessories','Others','Perfume',
    'Phone Accessories','Plastic Article','RC Parts/Accessories','Rubber','Seluar','Socks','Sport Equipment','Stationery','Stickers',
    'Storage','Telkong','Toys','Tudong','Tumbler','Underwear','Watch & Accessories','Wire, Adapter & Plug'];
  if (!validCategories.includes(category)) throw new Error('Invalid category');
}

function validateFiles(category, files) {
  const starredCategories = ['*Books','*Cosmetics/Skincare/Bodycare','*Food Beverage/Drinks','*Gadgets','*Oil Ointment','*Supplement'];
  if (starredCategories.includes(category)) {
    if (files.length < 1) throw new Error('At least 1 file required');
    if (files.length > 3) throw new Error('Maximum 3 files allowed');
  }
  files.forEach(file => {
    if (file.size > CONFIG.MAX_FILE_SIZE) throw new Error(`File ${file.name} too large`);
  });
}

// ================= FILE PROCESSING =================
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

// ================= VERIFICATION SYSTEM =================
async function verifySubmission(trackingNumber) {
  try {
    let attempts = 0;
    while (attempts < 5) {
      const response = await fetch(`${CONFIG.GAS_URL}?action=verifySubmission&tracking=${encodeURIComponent(trackingNumber)}`);
      if (response.ok) {
        const result = await response.json();
        if (result.verified) {
          showMessage('Parcel verified!', 'success');
          setTimeout(() => safeRedirect('dashboard.html'), 2000);
          return;
        }
      }
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    throw new Error('Verification timeout');
  } catch (error) {
    showError(error.message);
  }
}

// ================= UTILITIES =================
function safeRedirect(path) {
  const allowedPaths = [
      'login.html', 'register.html', 'dashboard.html',
      'forgot-password.html', 'password-reset.html',
      'my-info.html', 'parcel-declaration.html', 'track-parcel.html'
    ];
  if (!allowedPaths.includes(path)) return;
  window.location.href = path;
}

function initParcelValidation() {
  const form = document.getElementById('declarationForm');
  if (form) {
    form.addEventListener('input', (e) => {
      const target = e.target;
      try {
        if (target.name === 'trackingNumber') validateTrackingNumber(target.value);
        if (target.name === 'quantity') validateQuantity(target.value);
        if (target.name === 'price') validatePrice(target.value);
      } catch (error) {
        showError(error.message, 'parcel-error');
      }
    });
  }
}

// ================= AUTHENTICATION CORE =================
function hashPassword(password, salt) {
  const combined = password + salt;
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, combined);
  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

function generateSalt() {
  const randomString = Math.random().toString(36).substring(2) + Date.now().toString(36);
  return Utilities.base64Encode(randomString).substring(0, 16);
}

// ================= USER MANAGEMENT =================
function processLogin(phone, password) {
  const ss = SpreadsheetApp.openById(CONFIG.USERS_SHEET_ID);
  const sheet = ss.getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  const cleanPhone = String(phone).trim().replace(/[^0-9]/g, '');

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const storedPhone = String(row[0]).trim().replace(/[^0-9]/g, '');
    const storedHash = row[1];
    const salt = row[4];

    if (storedPhone === cleanPhone && storedHash === hashPassword(password, salt)) {
      return { 
        success: true, 
        tempPassword: row[5] === true,
        phone: storedPhone, 
        email: row[2] 
      };
    }
  }
  return { success: false, message: 'Invalid credentials' };
}

function createAccount(phone, password, email) {
  const ss = SpreadsheetApp.openById(CONFIG.USERS_SHEET_ID);
  const sheet = ss.getSheetByName('Users');

  try {
    if (sheet.getLastRow() === 0) sheet.appendRow(['Phone', 'Password', 'Email', 'Registration Date', 'Salt', 'TempPasswordFlag']);
    
    const phoneNumbers = sheet.getRange(2, 1, sheet.getLastRow()-1, 1).getValues().flat();
    const trimmedPhone = String(phone).trim().replace(/[^0-9]/g, '');

    if (phoneNumbers.some(existingPhone => String(existingPhone).replace(/[^0-9]/g, '') === trimmedPhone)) {
      throw new Error('Phone number already registered');
    }

    const salt = generateSalt();
    const hashedPassword = hashPassword(password, salt);

    sheet.appendRow([
      trimmedPhone,
      hashedPassword,
      email.toLowerCase().trim(),
      new Date(),
      salt,
      false
    ]);
    
    return { success: true, message: 'Registration successful!' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// ================= PASSWORD MANAGEMENT =================
function updatePassword(data) {
  const ss = SpreadsheetApp.openById(CONFIG.USERS_SHEET_ID);
  const sheet = ss.getSheetByName('Users');
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  if (data.newPassword !== data.confirmPassword) {
    return { success: false, message: 'Password confirmation mismatch' };
  }

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const storedPhone = String(row[0]).replace(/[^0-9]/g, '');
    const storedHash = row[1];
    const salt = row[4];

    if (storedPhone === data.phone && storedHash === hashPassword(data.currentPassword, salt)) {
      const newSalt = generateSalt();
      const newHash = hashPassword(data.newPassword, newSalt);
      
      sheet.getRange(i + 1, 2).setValue(newHash);
      sheet.getRange(i + 1, 5).setValue(newSalt);
      sheet.getRange(i + 1, 6).setValue(false);
      
      return { success: true, message: 'Password updated successfully' };
    }
  }
  return { success: false, message: 'Invalid current password' };
}

function forcePasswordReset(phone, newPassword) {
  const ss = SpreadsheetApp.openById(CONFIG.USERS_SHEET_ID);
  const sheet = ss.getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const storedPhone = String(row[0]).replace(/[^0-9]/g, '');
    const isTemp = row[5] === true;

    if (storedPhone === cleanPhone && isTemp) {
      const salt = generateSalt();
      const newHash = hashPassword(newPassword, salt);
      
      sheet.getRange(i + 1, 2).setValue(newHash);
      sheet.getRange(i + 1, 5).setValue(salt);
      sheet.getRange(i + 1, 6).setValue(false);
      
      return { success: true, message: 'Password reset successfully' };
    }
  }
  return { success: false, message: 'Invalid reset request' };
}

function initiatePasswordReset(phone, email) {
  const ss = SpreadsheetApp.openById(CONFIG.USERS_SHEET_ID);
  const sheet = ss.getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  const cleanEmail = email?.toLowerCase().trim() || '';

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const storedPhone = String(row[0]).replace(/[^0-9]/g, '');
    const storedEmail = row[2]?.toLowerCase().trim() || '';

    if (storedPhone === cleanPhone && storedEmail === cleanEmail) {
      const tempPassword = generateTemporaryPassword();
      const salt = generateSalt();
      const hashedTemp = hashPassword(tempPassword, salt);
      
      sheet.getRange(i + 1, 2).setValue(hashedTemp);
      sheet.getRange(i + 1, 5).setValue(salt);
      sheet.getRange(i + 1, 6).setValue(true);
      
      sendTempPasswordEmail(storedEmail, tempPassword);
      return { success: true, message: 'Temporary password sent to registered email' };
    }
  }
  return { success: false, message: 'No matching account found' };
}

// ================= EMAIL MANAGEMENT ================= 
function updateEmail(data) {
  const ss = SpreadsheetApp.openById(CONFIG.USERS_SHEET_ID);
  const sheet = ss.getSheetByName('Users');
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  if (data.newEmail !== data.confirmEmail) {
    return { success: false, message: 'Email confirmation mismatch' };
  }

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const storedPhone = String(row[0]).replace(/[^0-9]/g, '');
    const storedHash = row[1];
    const salt = row[4];

    if (storedPhone === data.phone && storedHash === hashPassword(data.currentPassword, salt)) {
      sheet.getRange(i + 1, 3).setValue(data.newEmail.toLowerCase().trim());
      return { success: true, message: 'Email updated successfully' };
    }
  }
  return { success: false, message: 'Invalid current password' };
}

// ================= PARCEL SYSTEM (Original Mark 1) =================
function getParcelData(phone) {
  const ss = SpreadsheetApp.openById(CONFIG.TRACKER_SHEET_ID);
  const sheet = ss.getSheetByName('ParcelTracker');
  const data = sheet.getDataRange().getValues();
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');

  return data.filter(row => {
    const rowPhone = String(row[0]).replace(/[^0-9]/g, '');
    return rowPhone === cleanPhone;
  }).map(row => ({
    trackingNumber: (row[1] || 'N/A').toString().trim(),
    status: row[2] || '',
    location: row[3] || '',
    estimatedDelivery: row[4] || ''
  }));
}

function submitParcelDeclaration(data, files = []) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.PARCEL_SHEET_ID);
    const sheet = ss.getSheetByName('V2');
    const timestamp = new Date();

    const rowData = [
      timestamp,
      '',
      data.trackingNumber.trim().toUpperCase(),
      data.nameOnParcel.trim(),
      data.phoneNumber.replace(/[^\d]/g, ''),
      data.itemDescription.trim(),
      Number(data.quantity),
      Number(data.price),
      data.collectionPoint,
      data.itemCategory,
      files.length > 0 ? files.join(', ') : 'N/A'
    ];

    sheet.appendRow(rowData);
    return { success: true, message: 'Parcel declaration submitted!' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// ================= UTILITY FUNCTIONS =================
function generateTemporaryPassword() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase();
}

function sendTempPasswordEmail(email, tempPassword) {
  try {
    MailApp.sendEmail(email,
      'Cahaya Az Zahra Temporary Password',
      `Your temporary password: ${tempPassword}\n\nPlease login and reset immediately.`
    );
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
}

// ================= VALIDATION LISTENERS =================
function initValidationListeners() {
  const forms = {
    'loginForm': validateLoginInputs,
    'registrationForm': validateRegistration,
    'parcelForm': validateParcelFields
  };

  Object.entries(forms).forEach(([formId, validator]) => {
    const form = document.getElementById(formId);
    if (form) {
      form.addEventListener('input', validator);
      form.addEventListener('submit', handleFormSubmission);
    }
  });
}

function validateLoginInputs(e) {
  const target = e.target;
  if (target.id === 'phone') validatePhoneFormat(target.value);
  if (target.id === 'password') validatePasswordComplexity(target.value);
}

function validateRegistration(e) {
  const target = e.target;
  if (target.id === 'regPhone') validatePhoneFormat(target.value);
  if (target.id === 'regPassword') validatePasswordComplexity(target.value);
  if (target.id === 'regEmail') validateEmailFormat(target.value);
}

function validateParcelFields(e) {
  const target = e.target;
  try {
    if (target.name === 'trackingNumber') validateTrackingNumber(target.value);
    if (target.name === 'quantity') validateQuantity(target.value);
    if (target.name === 'price') validatePrice(target.value);
  } catch (error) {
    showError(error.message);
  }
}

// ================= CORS/JSONP HANDLING =================
function handleJsonpRequest(e) {
  const callback = (e.parameter.callback || 'callback').replace(/[^a-zA-Z0-9_]/g, '');
  const action = e.parameter.action || 'processLogin';
  
  try {
    let result;
    switch(action) {
      case 'processLogin':
        result = processLogin(e.parameter.phone, e.parameter.password);
        break;
      case 'createAccount':
        result = createAccount(e.parameter.phone, e.parameter.password, e.parameter.email);
        break;
      case 'getParcelData':
        result = getParcelData(e.parameter.phone);
        break;
      case 'initiatePasswordReset':
        result = initiatePasswordReset(e.parameter.phone, e.parameter.email);
        break;
      case 'updatePassword':
        result = updatePassword({
          phone: e.parameter.phone,
          currentPassword: e.parameter.currentPassword,
          newPassword: e.parameter.newPassword,
          confirmPassword: e.parameter.confirmPassword
        });
        break;
      case 'forcePasswordReset':
        result = forcePasswordReset(e.parameter.phone, e.parameter.newPassword);
        break;
      case 'updateEmail':
        result = updateEmail({
          phone: e.parameter.phone,
          currentPassword: e.parameter.currentPassword,
          newEmail: e.parameter.newEmail,
          confirmEmail: e.parameter.confirmEmail
        });
        break;
      default:
        throw new Error('Invalid action');
    }
    
    return ContentService.createTextOutput(`${callback}(${JSON.stringify(result)})`);
  } catch (error) {
    return createErrorResponse(error, callback);
  }
}

// ================= RATE LIMITING =================
function checkRateLimit(ip, cache) {
  const blocked = cache.get(ip);
  if (blocked === 'blocked') return true;

  let attempts = parseInt(cache.get(ip)) || 0;
  attempts++;
  cache.put(ip, attempts.toString(), 60);

  if (attempts > CONFIG.MAX_LOGIN_ATTEMPTS) {
    cache.put(ip, 'blocked', 60 * CONFIG.RATE_LIMIT_MINUTES);
    return true;
  }
  return false;
}
