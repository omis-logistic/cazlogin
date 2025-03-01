// ================= CONFIGURATION =================
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwOAmAvpFeTakSItOF2x-RUqktdtp5OB_v0wv3TVJGAlCkigry-tYu-v8nqHRJMqUue/exec';
let currentUser = {
  phone: '',
  email: '',
  token: ''
};

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  checkExistingSession();
  showPage('login-page');
});

// ================= EVENT MANAGEMENT =================
function initializeEventListeners() {
  // Auth Section
  document.getElementById('loginButton').addEventListener('click', handleLogin);
  document.getElementById('registerButton').addEventListener('click', handleRegistration);
  document.getElementById('passwordRecoveryButton').addEventListener('click', handlePasswordRecovery);
  
  // User Actions
  document.getElementById('changePasswordButton').addEventListener('click', handlePasswordChange);
  document.getElementById('changeEmailButton').addEventListener('click', handleEmailChange);
  document.getElementById('submitParcelButton').addEventListener('click', handleParcelSubmission);
  
  // Navigation
  document.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', handleNavigation);
  });

  // File Handling
  document.getElementById('invoiceFiles').addEventListener('change', handleFileUpload);

  // Modals
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', handleModal);
  });
}

// ================= CORE HANDLERS =================
async function handleLogin(event) {
  event.preventDefault();
  showLoading();
  
  try {
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;

    // Basic validation
    if (!phone || !password) {
      throw new Error('Please fill in all fields');
    }

    // Make login request
    const response = await callBackend('processLogin', { 
      phone: sanitizePhone(phone),
      password 
    });

    if (!response.success) {
      throw new Error(response.message || 'Login failed');
    }

    // Store session data
    const sessionData = {
      phone: response.phone,
      email: response.email,
      token: response.token
    };
    localStorage.setItem('userSession', JSON.stringify(sessionData));

    // ▼▼▼ ADDED TOKEN VERIFICATION ▼▼▼
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    // Verify token storage
    const storedSession = JSON.parse(localStorage.getItem('userSession'));
    if (!storedSession?.token) {
      throw new Error('Session initialization failed');
    }

    // Handle temp password redirect
    if (response.tempPassword) {
      showPage('password-reset-page');
    } else {
      showDashboard();
      showWelcomeModal();
    }

  } catch (error) {
    console.error('Login error:', error);
    showError('login-error', error.message);
    handleLogout(); // Clear invalid session
  } finally {
    hideLoading();
  }
}

// Add this helper function if missing
function sanitizePhone(phone) {
  return phone.replace(/[^\d]/g, '').slice(-10);
}

async function handleRegistration(event) {
  event.preventDefault();
  showLoading();
  
  try {
    const phone = document.getElementById('regPhone').value.trim();
    const password = document.getElementById('regPassword').value;
    const email = document.getElementById('regEmail').value.trim();

    // Client-side validation
    if (!validatePhone(phone)) throw new Error('Invalid phone format');
    if (!validatePassword(password)) throw new Error('Password must contain 6+ characters with at least 1 uppercase and 1 number');
    if (!validateEmail(email)) throw new Error('Invalid email format');

    const response = await callBackend('createAccount', { phone, password, email });
    
    if (response.success) {
      showPage('login-page');
      showSuccess('Registration successful! Please login');
    } else {
      throw new Error(response.message || 'Registration failed');
    }
  } catch (error) {
    showError('registration-error', error.message);
  } finally {
    hideLoading();
  }
}

// ================= PARCEL MANAGEMENT =================
async function handleParcelSubmission(event) {
  event.preventDefault();
  showLoading();

  try {
    const files = await processUploadedFiles();
    const parcelData = {
      trackingNumber: document.getElementById('trackingNumber').value.trim(),
      phoneNumber: currentUser.phone,
      itemDescription: document.getElementById('itemDescription').value.trim(),
      quantity: parseInt(document.getElementById('quantity').value),
      price: parseFloat(document.getElementById('price').value),
      itemCategory: document.getElementById('itemCategory').value
    };

    const response = await callBackend('submitParcelDeclaration', {
      token: currentUser.token,
      phone: currentUser.phone,
      data: JSON.stringify(parcelData),
      filesBase64: JSON.stringify(files)
    });

    if (response.success) {
      showDashboard();
      showSuccess(`Parcel submitted! ID: ${response.submissionId}`);
    }
  } catch (error) {
    showError('parcel-error', error.message);
  } finally {
    hideLoading();
  }
}

// ================= FILE HANDLING =================
async function processUploadedFiles() {
  const fileInput = document.getElementById('invoiceFiles');
  const files = Array.from(fileInput.files);
  const processedFiles = [];

  for (const file of files) {
    const base64 = await readFileAsBase64(file);
    processedFiles.push({
      name: file.name,
      type: file.type,
      base64: base64.split(',')[1] // Remove data URL prefix
    });
  }

  return processedFiles;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ================= SESSION MANAGEMENT =================
function checkExistingSession() {
  const session = localStorage.getItem('userSession');
  if (session) {
    try {
      currentUser = JSON.parse(session);
      validateSessionWithBackend();
    } catch {
      handleLogout();
    }
  }
}

async function validateSessionWithBackend() {
  try {
    const response = await callBackend('validateSession', currentUser);
    if (response.success) {
      showDashboard();
    } else {
      handleLogout();
    }
  } catch {
    handleLogout();
  }
}

function handleLogout() {
  localStorage.removeItem('userSession');
  currentUser = { phone: '', email: '', token: '' };
  clearFormFields();
  showPage('login-page');
}

// ================= API COMMUNICATION =================
async function callBackend(action, data) {
  try {
    const formData = new FormData();
    formData.append('action', action);
    
    // Stringify nested objects
    for (const [key, value] of Object.entries(data)) {
      formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
    }

    const response = await fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    
    // Enhanced error diagnostics
    if (!result.success) {
      console.error('Backend Error:', {
        action,
        inputData: data,
        error: result.message,
        rawResponse: result
      });
      throw new Error(result.message || `Action ${action} failed`);
    }

    return result;
    
  } catch (error) {
    console.error('Network Error:', {
      action,
      error: error.message,
      stack: error.stack
    });
    throw new Error('Connection failed. Check network and try again.');
  }
}

// ================= UI MANAGEMENT =================
function showPage(pageId) {
  document.querySelectorAll('.container').forEach(page => {
    page.style.display = page.id === pageId ? 'block' : 'none';
  });
  
  if (pageId === 'dashboard-page') {
    updateUserInfoDisplay();
    loadParcelData();
  }
}

function showDashboard() {
  showPage('dashboard-page');
  document.getElementById('user-phone').textContent = currentUser.phone;
  document.getElementById('user-email').textContent = currentUser.email;
}

function updateUserInfoDisplay() {
  document.getElementById('infoPhone').value = currentUser.phone;
  document.getElementById('currentEmail').textContent = currentUser.email;
}

function showError(elementId, message) {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    setTimeout(() => errorElement.style.display = 'none', 5000);
  }
}

function showSuccess(message) {
  const successElement = document.createElement('div');
  successElement.className = 'global-success';
  successElement.textContent = message;
  document.body.appendChild(successElement);
  setTimeout(() => successElement.remove(), 3000);
}

function showLoading() {
  document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

// ================= PARCEL TRACKING =================
async function loadParcelData() {
  try {
    const response = await callBackend('getParcelData', {
      phone: currentUser.phone,
      token: currentUser.token
    });

    if (response.success) {
      renderParcelList(response.data);
    }
  } catch (error) {
    showError('parcel-error', 'Failed to load parcel data');
  }
}

function renderParcelList(parcels) {
  const container = document.getElementById('trackingList');
  container.innerHTML = '';

  parcels.forEach(parcel => {
    const element = document.createElement('div');
    element.className = 'parcel-item';
    element.innerHTML = `
      <div class="parcel-number">${parcel.trackingNumber}</div>
      <div class="parcel-status ${parcel.status.toLowerCase()}">${parcel.status}</div>
      <div class="parcel-date">${new Date(parcel.declarationDate).toLocaleDateString()}</div>
      <button class="parcel-detail-btn" data-id="${parcel.trackingNumber}">Details</button>
    `;
    container.appendChild(element);
  });

  // Add click handlers for detail buttons
  document.querySelectorAll('.parcel-detail-btn').forEach(btn => {
    btn.addEventListener('click', showParcelDetails);
  });
}

// ================= UTILITIES =================
function validatePhone(phone) {
  return /^(673\d{7}|60\d{8,10})$/.test(phone);
}

function validatePassword(password) {
  return /^(?=.*[A-Z])(?=.*\d).{6,}$/.test(password);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clearFormFields() {
  document.querySelectorAll('input, textarea').forEach(field => {
    if (field.type !== 'button') field.value = '';
  });
}

function handleNavigation(event) {
  event.preventDefault();
  const targetPage = event.target.dataset.action.replace('show-', '') + '-page';
  showPage(targetPage);
}

function showWelcomeModal() {
  document.getElementById('welcomeModal').style.display = 'block';
}

// ================= MODAL HANDLING =================
function handleModal(event) {
  const modalId = event.target.dataset.modal;
  if (modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'block';
  }
}

// Close modal when clicking outside
window.onclick = function(event) {
  if (event.target.className === 'modal') {
    event.target.style.display = 'none';
  }
}

// ================= PASSWORD MANAGEMENT =================
async function handlePasswordChange(event) {
  event.preventDefault();
  showLoading();

  try {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('repeatNewPassword').value;

    if (newPassword !== confirmPassword) throw new Error('Passwords do not match');
    if (!validatePassword(newPassword)) throw new Error('Password does not meet requirements');

    const response = await callBackend('updateUserInfo', {
      phone: currentUser.phone,
      token: currentUser.token,
      currentPassword,
      newPassword
    });

    if (response.success) {
      showSuccess('Password updated successfully');
      clearFormFields();
    }
  } catch (error) {
    showError('password-change-error', error.message);
  } finally {
    hideLoading();
  }
}

// ================= PASSWORD RECOVERY =================
async function handlePasswordRecovery(event) {
  event.preventDefault();
  showLoading();

  try {
    const phone = document.getElementById('recoveryPhone').value.trim();
    const email = document.getElementById('recoveryEmail').value.trim();

    if (!validatePhone(phone)) throw new Error('Invalid phone format');
    if (!validateEmail(email)) throw new Error('Invalid email format');

    const response = await callBackend('initiatePasswordReset', { phone, email });
    
    if (response.success) {
      showSuccess('Temporary password sent to your email');
      showPage('login-page');
    }
  } catch (error) {
    showError('recovery-error', error.message);
  } finally {
    hideLoading();
  }
}

// ================= EMAIL MANAGEMENT =================
async function handleEmailChange(event) {
  event.preventDefault();
  showLoading();

  try {
    const password = document.getElementById('verifyPassword').value;
    const newEmail = document.getElementById('newEmail').value.trim();
    const confirmEmail = document.getElementById('repeatNewEmail').value.trim();

    if (newEmail !== confirmEmail) throw new Error('Emails do not match');
    if (!validateEmail(newEmail)) throw new Error('Invalid email format');

    const response = await callBackend('updateUserInfo', {
      phone: currentUser.phone,
      token: currentUser.token,
      currentPassword: password,
      newEmail
    });

    if (response.success) {
      currentUser.email = newEmail;
      localStorage.setItem('userSession', JSON.stringify(currentUser));
      updateUserInfoDisplay();
      showSuccess('Email updated successfully');
    }
  } catch (error) {
    showError('email-change-error', error.message);
  } finally {
    hideLoading();
  }
}

// ================= INITIALIZATION COMPLETION =================
// Initialize any remaining components
document.querySelectorAll('[data-modal-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.modal').style.display = 'none';
  });
});
