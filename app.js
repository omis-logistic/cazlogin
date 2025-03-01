// ================= CONFIGURATION =================
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzZJFomuSsv-4shW0BaArlf-kvIugE_XBR67E4cGqDgf1_Xu6Dw6HdhIDiT3HJ-T5hz/exec'; // Replace with actual URL

// ================= STATE MANAGEMENT =================
let currentUserPhone = '';
let currentUserEmail = '';

// ================= PAGE NAVIGATION =================
function showPage(pageClass) {
  const pages = document.querySelectorAll('.container');
  pages.forEach(page => {
    page.style.display = 'none';
  });
  const activePage = document.querySelector(`.${pageClass}`);
  if (activePage) {
    activePage.style.display = 'block';
  }
}

// ================= API COMMUNICATION =================
async function callBackend(action, data) {
  try {
    const response = await fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      redirect: 'follow', // Add this line
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...data })
    });
    
    // Handle Google's redirect
    const responseData = await response.text();
    return JSON.parse(responseData);
    
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, message: 'Network error' };
  }
}

// ================= AUTH HANDLERS =================
async function handleLogin(event) {
  event.preventDefault();
  const phone = document.getElementById('phone').value;
  const password = document.getElementById('password').value;

  try {
    const response = await callBackend('processLogin', { phone, password });
    
    if (response.success) {
      currentUserPhone = response.phone;
      currentUserEmail = response.email;
      
      if (response.tempPassword) {
        showPage('password-reset-page');
      } else {
        showPage('dashboard-page');
        showWelcomeModal();
      }
    } else {
      showError('loginError', response.message || 'Invalid credentials');
    }
  } catch (error) {
    showError('loginError', 'Login failed. Please try again.');
  }
}

async function handleRegistration(event) {
  event.preventDefault();
  const phone = document.getElementById('regPhone').value;
  const password = document.getElementById('regPassword').value;
  const email = document.getElementById('regEmail').value;

  if (!validateRegistrationForm()) return;

  try {
    const response = await callBackend('createAccount', { phone, password, email });
    
    if (response.success) {
      showPage('login-page');
      alert('Registration successful! Please login');
    } else {
      showError('registrationError', response.message);
    }
  } catch (error) {
    showError('registrationError', 'Registration failed. Please try again.');
  }
}

// ================= PASSWORD HANDLERS =================
async function handlePasswordRecovery(event) {
  event.preventDefault();
  const phone = document.getElementById('recoveryPhone').value;
  const email = document.getElementById('recoveryEmail').value;

  try {
    const response = await callBackend('initiatePasswordReset', { phone, email });
    
    if (response.success) {
      showPage('login-page');
      alert('Temporary password sent to your email');
    } else {
      showError('recoveryError', response.message);
    }
  } catch (error) {
    showError('recoveryError', 'Password recovery failed');
  }
}

async function handlePasswordReset(event) {
  event.preventDefault();
  const newPassword = document.getElementById('newPasswordReset').value;
  const confirmPassword = document.getElementById('confirmNewPassword').value;

  if (newPassword !== confirmPassword) {
    showError('passwordResetError', 'Passwords do not match');
    return;
  }

  try {
    const response = await callBackend('updatePassword', {
      phone: currentUserPhone,
      newPassword
    });

    if (response.success) {
      alert('Password updated successfully! Please login');
      handleLogout();
    } else {
      showError('passwordResetError', response.message);
    }
  } catch (error) {
    showError('passwordResetError', 'Password reset failed');
  }
}

// ================= PARCEL HANDLERS =================
async function handleParcelSubmission(event) {
  event.preventDefault();
  // Add parcel submission logic here
}

async function loadParcelData() {
  try {
    const response = await callBackend('getParcelData', { phone: currentUserPhone });
    if (response.success) {
      renderTrackingList(response.data);
    }
  } catch (error) {
    console.error('Failed to load parcels:', error);
  }
}

// ================= UTILITY FUNCTIONS =================
function showError(elementId, message) {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
}

function validateRegistrationForm() {
  // Add validation logic here
  return true;
}

function handleLogout() {
  currentUserPhone = '';
  currentUserEmail = '';
  showPage('login-page');
}

function showWelcomeModal() {
  document.getElementById('welcomeModal').style.display = 'block';
}

function closeWelcomeModal() {
  document.getElementById('welcomeModal').style.display = 'none';
}

// ================= INITIALIZE APP =================
document.addEventListener('DOMContentLoaded', () => {
  // Auth Handlers
  document.getElementById('loginButton')?.addEventListener('click', handleLogin);
  document.getElementById('registerButton')?.addEventListener('click', handleRegistration);
  document.getElementById('passwordRecoveryButton')?.addEventListener('click', handlePasswordRecovery);
  document.getElementById('passwordResetButton')?.addEventListener('click', handlePasswordReset);
  
  // Navigation Handlers
  document.getElementById('showRegistrationButton')?.addEventListener('click', () => showPage('registration-page'));
  document.getElementById('showForgotPasswordButton')?.addEventListener('click', () => showPage('forgot-password-page'));
  document.getElementById('showDashboardButton')?.addEventListener('click', () => showPage('dashboard-page'));
  
  // Modal Handlers
  document.getElementById('closeModalButton')?.addEventListener('click', closeWelcomeModal);

  // Initial Page
  showPage('login-page');
});
