// scripts/app.js
const GAS_URL = 'https://script.google.com/macros/s/AKfycbz5fYBlIdyuodrGcoBTBsu8I4tHI-ViXOjHBPQwiJVA8sgiLpkNbERyNwcKOZeRmiXP/exec'; // Replace with your actual URL

// ========== AUTHENTICATION SYSTEM ==========
async function handleLogin() {
  const phone = document.getElementById('phone').value;
  const password = document.getElementById('password').value;

  if (!phone || !password) {
    showError('Please fill in all fields');
    return;
  }

  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        action: 'processLogin',
        phone: phone,
        password: password
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      sessionStorage.setItem('userData', JSON.stringify({
        phone: data.phone,
        email: data.email,
        tempPassword: data.tempPassword
      }));
      
      window.location.href = data.tempPassword 
        ? 'password-reset.html' 
        : 'dashboard.html';
    } else {
      showError(data.message || 'Login failed');
    }
  } catch (error) {
    console.error('Login Error:', error);
    showError(`Login failed: ${error.message}`);
    checkNetworkError(error);
  }
}

// ========== ERROR HANDLING ==========
function showError(message) {
  const errorElement = document.getElementById('error-message') || createErrorElement();
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
  errorDiv.style.display = 'none';
  document.body.prepend(errorDiv);
  return errorDiv;
}

function checkNetworkError(error) {
  if (error.message.includes('Failed to fetch')) {
    showError('Network error - check internet connection');
    return true;
  }
  return false;
}

// ========== SESSION MANAGEMENT ==========
function checkSession() {
  const userData = JSON.parse(sessionStorage.getItem('userData'));
  if (!userData) window.location.href = 'login.html';
  return userData;
}

function handleLogout() {
  sessionStorage.removeItem('userData');
  window.location.href = 'login.html';
}
