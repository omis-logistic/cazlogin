// scripts/app.js
// ================= CONFIGURATION =================
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
  SESSION_TIMEOUT: 3600 // 1 hour in seconds
};

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
function checkSession() {
  const sessionData = sessionStorage.getItem('userData');
  const lastActivity = localStorage.getItem('lastActivity');

  if (!sessionData || 
      (lastActivity && Date.now() - lastActivity > CONFIG.SESSION_TIMEOUT * 1000)) {
    handleLogout();
    return null;
  }

  localStorage.setItem('lastActivity', Date.now());
  const userData = JSON.parse(sessionData);
  
  if (userData.tempPassword && !window.location.pathname.includes('password-reset.html')) {
    safeRedirect('password-reset.html');
  }
  
  return userData;
}

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
async function callAPI(action, payload = {}) {
  try {
    const isGetRequest = ['getParcelData', 'processLogin'].includes(action);
    
    if (isGetRequest) {
      const params = new URLSearchParams({...payload, action});
      const response = await fetch(`${CONFIG.GAS_URL}?${params}`);
      return await response.json();
    } else {
      const response = await fetch(CONFIG.GAS_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action, ...payload})
      });
      return await response.json();
    }
  } catch (error) {
    showError(`API Error: ${error.message}`);
    return { success: false, message: 'Network error' };
  }
}

// ================= VIEW TOGGLE SYSTEM =================
function initViewToggle() {
  const savedView = localStorage.getItem('viewMode') || 'mobile';
  document.body.classList.add(`${savedView}-view`);
  
  const toggleHTML = `
    <div class="view-toggle">
      <button onclick="switchView('mobile')" class="${savedView === 'mobile' ? 'active' : ''}">📱 Mobile</button>
      <button onclick="switchView('desktop')" class="${savedView === 'desktop' ? 'active' : ''}">🖥 Desktop</button>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', toggleHTML);
}

function switchView(mode) {
  document.body.classList.remove('mobile-view', 'desktop-view');
  document.body.classList.add(`${mode}-view`);
  localStorage.setItem('viewMode', mode);
  
  document.querySelectorAll('.view-toggle button').forEach(btn => {
    btn.classList.remove('active');
    if(btn.textContent.includes(mode.charAt(0).toUpperCase())) {
      btn.classList.add('active');
    }
  });
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

// ================= NAVIGATION & UTILITIES =================
function safeRedirect(path) {
  try {
    const allowedPaths = [
      'login.html', 'register.html', 'dashboard.html',
      'forgot-password.html', 'password-reset.html',
      'my-info.html', 'parcel-declaration.html', 'track-parcel.html'
    ];
    
    if (!allowedPaths.includes(path)) throw new Error('Unauthorized path');
    window.location.href = path;
  } catch (error) {
    console.error('Redirect error:', error);
    showError('Navigation failed. Please try again.');
  }
}

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  // Viewport meta tag for responsiveness
  const meta = document.createElement('meta');
  meta.name = 'viewport';
  meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=1';
  document.head.appendChild(meta);

  // Initialize view toggle
  initViewToggle();

  // Session check
  const publicPages = ['login.html', 'register.html', 'forgot-password.html'];
  const isPublicPage = publicPages.some(page => 
    window.location.pathname.includes(page)
  );

  if (!isPublicPage) {
    const userData = checkSession();
    if (userData?.tempPassword && !window.location.pathname.includes('password-reset.html')) {
      safeRedirect('password-reset.html');
    }
  }

  // Cleanup errors on navigation
  window.addEventListener('beforeunload', () => {
    const errorElement = document.getElementById('error-message');
    if (errorElement) errorElement.style.display = 'none';
  });
});
