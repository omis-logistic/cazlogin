// ================= CONFIGURATION =================
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzxZPJxUyBaN_-mprEBVQM-3yGrnJ6iYAwIDp5VbLwJPYCRIF9k2UXX1lMSoWfOapxv/exec'; // Must end with /exec
let currentUser = null;

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  checkSession();
});

// ================= EVENT BINDING =================
function bindEvents() {
  // Login
  document.getElementById('loginButton').addEventListener('click', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('phone').value;
    const password = document.getElementById('password').value;
    
    showLoading();
    const response = await nuclearFetch('processLogin', { phone, password });
    
    if (response.success) {
      currentUser = response;
      localStorage.setItem('userSession', JSON.stringify(response));
      window.location.href = '#dashboard';
    } else {
      alert('Login failed: ' + (response.message || 'Unknown error'));
    }
    hideLoading();
  });

  // Registration
  document.getElementById('registerButton').addEventListener('click', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('regPhone').value;
    const password = document.getElementById('regPassword').value;
    const email = document.getElementById('regEmail').value;

    showLoading();
    const response = await nuclearFetch('createAccount', { phone, password, email });
    alert(response.success ? 'Registration successful!' : 'Error: ' + response.message);
    hideLoading();
  });

  // Password Reset
  document.getElementById('passwordRecoveryButton').addEventListener('click', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('recoveryPhone').value;
    const email = document.getElementById('recoveryEmail').value;

    showLoading();
    const response = await nuclearFetch('initiatePasswordReset', { phone, email });
    alert(response.success ? 'Check your email for reset instructions' : 'Error: ' + response.message);
    hideLoading();
  });

  // Logout
  document.getElementById('logoutButton').addEventListener('click', () => {
    localStorage.removeItem('userSession');
    window.location.href = '#login';
  });
}

// ================= NUCLEAR FETCH =================
async function nuclearFetch(action, data) {
  try {
    const response = await fetch(`${GAS_URL}?t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, ...data })
    });
    return await response.json();
  } catch (error) {
    return { success: false, message: 'Connection failed' };
  }
}

// ================= SESSION MANAGEMENT =================
function checkSession() {
  const session = localStorage.getItem('userSession');
  if (session) {
    currentUser = JSON.parse(session);
    window.location.href = '#dashboard';
  }
}

// ================= UI HELPERS =================
function showLoading() {
  document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}
