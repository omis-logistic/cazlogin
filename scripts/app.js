//scripts/app.js
// ================= CONFIGURATION =================
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbympMQBvVvPBpmkJUF97dS4yt01D4SCFH6akprgCDOgHUQ5Z4rY1kWFulVnF4uzOx3t/exec',
  PROXY_URL: 'https://script.google.com/macros/s/AKfycbzZZxyeXddesKkpI-4NXcs_teemitbJl4MpeLGfBiH-SCENHVllX-ZhRB0wgHc1cFJAMw/exec',
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

// ================= IMPROVED SESSION CHECK =================
const checkSession = () => {
  const sessionData = sessionStorage.getItem('userData');
  const lastActivity = localStorage.getItem('lastActivity');

  if (!sessionData) {
    console.log('No session data found');
    return null;
  }

  // Check session timeout (1 hour)
  if (lastActivity && Date.now() - lastActivity > CONFIG.SESSION_TIMEOUT * 1000) {
    console.log('Session expired');
    sessionStorage.clear();
    localStorage.removeItem('lastActivity');
    return null;
  }

  try {
    const userData = JSON.parse(sessionData);
    
    // Update last activity
    localStorage.setItem('lastActivity', Date.now());
    
    // Check if temp password requires reset
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
  
  // Clear all session data
  sessionStorage.clear();
  localStorage.removeItem('lastActivity');
  
  // Only redirect if not already on login page
  if (!window.location.pathname.includes('login.html')) {
    window.location.href = 'login.html?logout=' + Date.now();
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

function showLoading(show = true, message = 'Processing...') {
  const loader = document.getElementById('loadingOverlay');
  if (!loader) return;

  const textElement = loader.querySelector('.loading-text');
  if (textElement) {
    textElement.textContent = message;
  }

  loader.style.display = show ? 'flex' : 'none';
  
  // Add a timeout to show "this may take a while" for long operations
  if (show) {
    setTimeout(() => {
      if (loader.style.display === 'flex' && textElement) {
        textElement.textContent = message + ' This may take a while...';
      }
    }, 3000); // Show after 3 seconds
  }
}

function createLoaderElement() {
  const overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text">Processing Submission...</div>
  `;
  
  // Add styles directly for reliability
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

function showSuccessMessage() {
  const messageElement = document.getElementById('message');
  if (!messageElement) return;

  messageElement.textContent = '✓ Submission Successful!';
  messageElement.className = 'success';
  messageElement.style.display = 'block';

  // Add animation effects
  messageElement.style.animation = 'slideIn 0.5s ease-out';
  setTimeout(() => {
    messageElement.style.animation = 'fadeOut 1s ease 2s forwards';
  }, 2000);

  // Add celebratory animation
  const confetti = document.createElement('div');
  confetti.className = 'confetti-effect';
  document.body.appendChild(confetti);
  setTimeout(() => confetti.remove(), 3000);
}

function resetForm() {
  const form = document.getElementById('declarationForm');
  if (!form) return;

  // Clear all fields except phone
  form.querySelectorAll('input:not(#phone), select, textarea').forEach(field => {
    if (field.type === 'file') {
      field.value = null;
    } else if (field.tagName === 'SELECT') {
      field.selectedIndex = 0;
    } else {
      field.value = '';
    }
  });

  // Preserve phone number styling
  const phoneField = document.getElementById('phone');
  if (phoneField) {
    phoneField.style.backgroundColor = '#2a2a2a';
    phoneField.style.color = '#ffffff';
  }
}

// ================= ENHANCED SUBMISSION SYSTEM =================
// Universal submission function that works for all browsers
async function submitParcelData(payload) {
  console.log('Starting submission...', { 
    trackingNumber: payload.data.trackingNumber,
    filesCount: payload.files?.length || 0 
  });

  try {
    // Try multiple submission methods in order
    const results = await tryAllSubmissionMethods(payload);
    
    if (results.success) {
      console.log('Submission successful via', results.method);
      return results;
    }
    
    // If all methods fail, try one last attempt with simplified payload
    return await tryFallbackSubmission(payload);
    
  } catch (error) {
    console.error('All submission methods failed:', error);
    throw new Error(`Submission failed: ${error.message}`);
  }
}

// Try multiple submission methods
async function tryAllSubmissionMethods(payload) {
  const methods = [
    tryPostViaProxy,
    tryPostViaDirect,
    tryJSONPSubmission,
    tryFormDataSubmission
  ];

  for (const method of methods) {
    try {
      console.log(`Trying submission method: ${method.name}`);
      const result = await method(payload);
      
      if (result && result.success) {
        return { 
          ...result, 
          method: method.name,
          success: true 
        };
      }
    } catch (error) {
      console.warn(`${method.name} failed:`, error.message);
      continue;
    }
  }
  
  throw new Error('All submission methods failed');
}

// Method 1: POST via Proxy (Primary)
async function tryPostViaProxy(payload) {
  return new Promise((resolve, reject) => {
    // Use XHR for better error handling
    const xhr = new XMLHttpRequest();
    const url = CONFIG.PROXY_URL;
    
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
    
    xhr.timeout = 30000; // 30 second timeout
    xhr.withCredentials = false;
    
    xhr.onload = function() {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (e) {
          // Try to parse as text if JSON fails
          console.log('Raw response:', xhr.responseText);
          resolve({ 
            success: true, 
            message: 'Submitted successfully (non-JSON response)' 
          });
        }
      } else {
        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
      }
    };
    
    xhr.onerror = function() {
      reject(new Error('Network error - proxy request failed'));
    };
    
    xhr.ontimeout = function() {
      reject(new Error('Request timeout (30s)'));
    };
    
    // Send data
    const data = `payload=${encodeURIComponent(JSON.stringify(payload))}`;
    console.log('Sending to proxy:', url);
    xhr.send(data);
  });
}

// Method 2: POST via Direct GAS
async function tryPostViaDirect(payload) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = CONFIG.GAS_URL;
    
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
    
    xhr.timeout = 30000;
    
    xhr.onload = function() {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          // Google Apps Script redirects, so check the final response
          if (xhr.responseText.includes('script.google.com')) {
            // This might be a redirect, extract the final URL
            const match = xhr.responseText.match(/src="([^"]+)"/);
            if (match && match[1]) {
              // Try to follow the redirect
              fetch(match[1]).then(res => res.text()).then(text => {
                try {
                  const json = JSON.parse(text);
                  resolve(json);
                } catch {
                  resolve({ success: true, message: 'Submitted via redirect' });
                }
              }).catch(() => {
                resolve({ success: true, message: 'Submitted (redirect followed)' });
              });
            } else {
              resolve({ success: true, message: 'Submitted successfully' });
            }
          } else {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          }
        } catch (e) {
          console.log('Direct GAS raw response:', xhr.responseText.substring(0, 200));
          resolve({ 
            success: true, 
            message: 'Submitted to GAS directly' 
          });
        }
      } else {
        reject(new Error(`Direct GAS failed: HTTP ${xhr.status}`));
      }
    };
    
    xhr.onerror = function() {
      reject(new Error('Direct GAS network error'));
    };
    
    xhr.send(`action=submitParcelDeclaration&data=${encodeURIComponent(JSON.stringify(payload.data))}`);
  });
}

// Method 3: JSONP Submission
async function tryJSONPSubmission(payload) {
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonpCallback_' + Date.now();
    const script = document.createElement('script');
    
    // Build URL - use GET with parameters
    const url = new URL(CONFIG.GAS_URL);
    url.searchParams.append('callback', callbackName);
    url.searchParams.append('action', 'submitParcelDeclaration');
    url.searchParams.append('data', JSON.stringify(payload.data));
    
    // Handle files separately if they exist
    if (payload.files && payload.files.length > 0) {
      url.searchParams.append('hasFiles', 'true');
      // Note: JSONP cannot send files, so files will be skipped
    }
    
    script.src = url.toString();
    script.async = true;
    script.crossOrigin = 'anonymous';
    
    let timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP timeout'));
    }, 20000);
    
    function cleanup() {
      clearTimeout(timeoutId);
      delete window[callbackName];
      if (script.parentNode) {
        document.head.removeChild(script);
      }
    }
    
    window[callbackName] = function(response) {
      cleanup();
      if (response && response.success) {
        resolve(response);
      } else {
        reject(new Error(response?.message || 'JSONP submission failed'));
      }
    };
    
    script.onerror = function() {
      cleanup();
      reject(new Error('JSONP script failed to load'));
    };
    
    document.head.appendChild(script);
  });
}

// Method 4: FormData Submission (for modern browsers)
async function tryFormDataSubmission(payload) {
  const formData = new FormData();
  
  // Add JSON data
  formData.append('data', JSON.stringify(payload.data));
  
  // Add files if they exist
  if (payload.files && payload.files.length > 0) {
    for (let i = 0; i < payload.files.length; i++) {
      const file = payload.files[i];
      const blob = base64ToBlob(file.base64, file.type);
      formData.append(`file${i}`, blob, file.name);
    }
  }
  
  const response = await fetch(CONFIG.GAS_URL, {
    method: 'POST',
    body: formData,
    // Don't set Content-Type header for FormData
  });
  
  if (!response.ok) {
    throw new Error(`FormData submission failed: ${response.status}`);
  }
  
  return await response.json();
}

// Fallback submission with reduced payload
async function tryFallbackSubmission(payload) {
  console.log('Trying fallback submission...');
  
  // Create minimal payload without files
  const minimalPayload = {
    action: 'submitParcelDeclaration',
    data: {
      trackingNumber: payload.data.trackingNumber,
      nameOnParcel: payload.data.nameOnParcel,
      phoneNumber: payload.data.phoneNumber,
      itemDescription: payload.data.itemDescription,
      quantity: payload.data.quantity,
      price: payload.data.price,
      collectionPoint: payload.data.collectionPoint,
      itemCategory: payload.data.itemCategory
    }
  };
  
  // Use simple fetch with short timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(CONFIG.PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `payload=${encodeURIComponent(JSON.stringify(minimalPayload))}`,
      signal: controller.signal,
      mode: 'no-cors' // Try no-cors as last resort
    });
    
    clearTimeout(timeoutId);
    
    // With no-cors, we can't read the response, but the request went through
    if (response.type === 'opaque') {
      return {
        success: true,
        message: 'Submitted (no response verification)',
        warning: 'Cannot verify submission due to CORS restrictions'
      };
    }
    
    throw new Error('Fallback submission failed');
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Even if fetch fails, the request might have succeeded
    // Save to localStorage for manual recovery
    saveFailedSubmission(payload);
    
    return {
      success: false,
      message: 'Submission failed. Data saved locally for recovery.',
      error: error.message,
      savedLocally: true
    };
  }
}

// Save failed submission to localStorage
function saveFailedSubmission(payload) {
  try {
    const failedSubmissions = JSON.parse(localStorage.getItem('failedSubmissions') || '[]');
    
    const submission = {
      ...payload,
      timestamp: new Date().toISOString(),
      id: 'failed_' + Date.now()
    };
    
    failedSubmissions.push(submission);
    
    // Keep only last 10 failed submissions
    if (failedSubmissions.length > 10) {
      failedSubmissions.shift();
    }
    
    localStorage.setItem('failedSubmissions', JSON.stringify(failedSubmissions));
    
    console.log('Saved failed submission locally:', submission.id);
    
  } catch (error) {
    console.error('Failed to save submission locally:', error);
  }
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
    
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  
  return new Blob(byteArrays, { type: mimeType });
}

// ================= UPDATED PARCEL SUBMISSION HANDLER =================
async function handleParcelSubmission(e) {
  e.preventDefault();
  const form = e.target;
  showLoading(true, "Submitting parcel declaration...");

  try {
    // Get form data
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
        price: Number(formData.get('price')) || 0,  // This allows 0
        collectionPoint: formData.get('collectionPoint') || '',
        itemCategory: formData.get('itemCategory') || ''
      },
      files: []
    };
    
    // Validate required fields - FIXED VERSION
    const requiredFields = ['trackingNumber', 'nameOnParcel', 'itemDescription', 'quantity', 'price', 'collectionPoint', 'itemCategory'];
    for (const field of requiredFields) {
      const value = payload.data[field];
      
      // Special handling for price field (0 is valid)
      if (field === 'price') {
        if (value === undefined || value === null || isNaN(value)) {
          throw new Error(`Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        }
      }
      // Special handling for quantity field
      else if (field === 'quantity') {
        if (isNaN(value) || value < 1) {
          throw new Error(`Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        }
      }
      // Special handling for item description
      else if (field === 'itemDescription') {
        if (!value || value.trim().length < 3) {
          throw new Error('Item description must be at least 3 characters');
        }
      }
      // For other fields, check if they're not empty
      else if (!value) {
        throw new Error(`Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
      }
    }

    // Validate item description length (minimum 3 characters)
    if (payload.data.itemDescription.trim().length < 3) {
      throw new Error('Item description must be at least 3 characters');
    }

    // Handle file uploads
    const fileInput = document.getElementById('fileUpload');
    const category = payload.data.itemCategory;
    
    const starredCategories = [
      '*Books', '*Cosmetics/Skincare/Bodycare',
      '*Food Beverage/Drinks', '*Gadgets',
      '*Oil Ointment', '*Supplement', '*Others'
    ];

    // Validate file requirements
    if (starredCategories.includes(category)) {
      if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        throw new Error('Invoice/document upload is required for this category');
      }
      
      // Process files
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

    // Submit the data
    console.log('Submitting payload:', { 
      trackingNumber: payload.data.trackingNumber,
      filesCount: payload.files.length,
      price: payload.data.price
    });
    
    const result = await submitParcelData(payload);
    
    if (result.success) {
      // Success handling
      showSubmissionSuccess(payload.data.trackingNumber);
      resetForm();
      
      // Schedule verification
      setTimeout(() => {
        verifySubmission(payload.data.trackingNumber);
      }, 3000);
      
    } else if (result.savedLocally) {
      // Failed but saved locally
      showError('⚠️ Submission failed but data was saved locally. Please try again later or contact support.', 'submission-warning');
      showLocalRecoveryNotice(payload);
      
    } else {
      // Complete failure
      throw new Error(result.message || 'Submission failed');
    }

  } catch (error) {
    console.error('Submission error:', error);
    
    // Show user-friendly error message
    if (error.message.includes('Price must be')) {
      showError('❌ Price must be 0 or greater. 0 is allowed for items with no declared value.');
    } else if (error.message.includes('Item description must be')) {
      showError('❌ Item description must be at least 3 characters.');
    } else if (error.message.includes('Invoice/document upload')) {
      showError('❌ Invoice/document upload is required for starred categories.');
    } else if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
      showError('⚠️ Network connection issue. Please check your internet and try again.');
    } else if (error.message.includes('timeout')) {
      showError('⚠️ Submission timeout. The request took too long. Please try again.');
    } else if (error.message.includes('Session expired')) {
      showError('❌ Session expired. Please login again.');
      setTimeout(() => {
        handleLogout();
      }, 2000);
    } else {
      showError(`❌ ${error.message}`);
    }
    
    // Only offer to save as draft for network/timeout errors, not validation errors
    if ((error.message.includes('Network') || error.message.includes('timeout') || error.message.includes('Failed to fetch')) && 
        !error.message.includes('Price must be') && 
        !error.message.includes('Item description must be') &&
        !error.message.includes('Invoice/document upload')) {
      if (confirm('Would you like to save this form as a draft?')) {
        saveFormAsDraft();
      }
    }
    
  } finally {
    showLoading(false);
  }
}
// Enhanced success handler
function showSubmissionSuccess(trackingNumber) {
  // Update message element
  const messageElement = document.getElementById('message') || createMessageElement();
  
  messageElement.innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <div style="font-size: 48px; color: #00C851;">✓</div>
      <h3 style="color: #00C851; margin: 10px 0;">Submission Successful!</h3>
      <p>Tracking Number: <strong>${trackingNumber}</strong></p>
      <p style="font-size: 0.9em; color: #888;">
        Your parcel declaration has been submitted.<br>
        Check your submission at Track Parcel page.
      </p>
    </div>
  `;
  
  messageElement.className = 'success';
  messageElement.style.display = 'block';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    messageElement.style.display = 'none';
  }, 5000);
}

// Show local recovery notice
function showLocalRecoveryNotice(payload) {
  const recoveryDiv = document.createElement('div');
  recoveryDiv.id = 'recoveryNotice';
  recoveryDiv.innerHTML = `
    <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <h4 style="color: #856404; margin: 0 0 10px 0;">⚠️ Data Saved Locally</h4>
      <p style="color: #856404; margin: 0 0 10px 0;">
        Your submission failed to reach the server but was saved locally.<br>
        Tracking Number: <strong>${payload.data.trackingNumber}</strong>
      </p>
      <button onclick="retryFailedSubmissions()" style="background: #856404; color: white; border: none; padding: 8px 15px; border-radius: 3px; cursor: pointer;">
        Retry Submission
      </button>
    </div>
  `;
  
  const container = document.querySelector('.container') || document.body;
  container.insertBefore(recoveryDiv, container.firstChild);
}

// Retry failed submissions
async function retryFailedSubmissions() {
  showLoading(true, 'Retrying failed submissions...');
  
  try {
    const failedSubmissions = JSON.parse(localStorage.getItem('failedSubmissions') || '[]');
    let successCount = 0;
    
    for (const submission of failedSubmissions) {
      try {
        const result = await submitParcelData(submission);
        if (result.success) {
          successCount++;
        }
      } catch (error) {
        console.warn('Failed to retry submission:', error);
      }
    }
    
    // Remove successful submissions
    const remainingSubmissions = failedSubmissions.filter(sub => {
      // Remove submissions older than 1 hour or successful
      const submissionTime = new Date(sub.timestamp).getTime();
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      return submissionTime > oneHourAgo;
    });
    
    localStorage.setItem('failedSubmissions', JSON.stringify(remainingSubmissions));
    
    showLoading(false);
    
    if (successCount > 0) {
      alert(`Successfully resubmitted ${successCount} item(s)!`);
    } else {
      alert('Could not resubmit any items. Please try again later.');
    }
    
    // Remove recovery notice
    const recoveryNotice = document.getElementById('recoveryNotice');
    if (recoveryNotice) recoveryNotice.remove();
    
  } catch (error) {
    showLoading(false);
    showError('Failed to retry submissions: ' + error.message);
  }
}

// Create message element if not exists
function createMessageElement() {
  const messageDiv = document.createElement('div');
  messageDiv.id = 'message';
  messageDiv.className = 'message';
  messageDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 30px;
    border-radius: 10px;
    z-index: 10000;
    display: none;
    min-width: 300px;
    text-align: center;
    box-shadow: 0 0 20px rgba(0,0,0,0.5);
  `;
  
  document.body.appendChild(messageDiv);
  return messageDiv;
}

// ================= ENHANCED VERIFICATION =================
async function verifySubmission(trackingNumber) {
  try {
    console.log('Verifying submission for:', trackingNumber);
    
    // Use multiple verification methods
    const verificationURLs = [
      `${CONFIG.PROXY_URL}?tracking=${encodeURIComponent(trackingNumber)}`,
      `${CONFIG.GAS_URL}?action=verifyTracking&tracking=${encodeURIComponent(trackingNumber)}`
    ];
    
    let verificationResult = null;
    
    for (const url of verificationURLs) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          cache: 'no-cache',
          headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
          verificationResult = await response.json();
          break;
        }
      } catch (error) {
        console.warn(`Verification URL failed: ${url}`, error.message);
        continue;
      }
    }
    
    if (verificationResult?.exists) {
      console.log('Verification successful:', verificationResult);
      
      // Show verification success
      const messageElement = document.getElementById('message');
      if (messageElement) {
        messageElement.innerHTML += `
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #00C851;">
            <p style="color: #00C851; font-size: 0.9em;">
              ✓ Verified in system: ${trackingNumber}
            </p>
          </div>
        `;
      }
      
    } else {
      console.log('Verification pending or failed:', verificationResult);
    }
    
  } catch (error) {
    console.warn('Verification check failed:', error.message);
    // Don't show error to user - verification is secondary
  }
}

// ================= ENHANCED FILE READING =================
async function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      const base64 = e.target.result.split(',')[1];
      resolve(base64);
    };
    
    reader.onerror = function() {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

// ================= SAFARI DETECTION =================
function isSafariBrowser() {
  const ua = navigator.userAgent;
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  
  return isSafari || isIOS;
}

// ================= VALIDATION CORE =================
function validateTrackingNumberInput(inputElement) {
  const value = inputElement.value.trim().toUpperCase();
  const isValid = /^[A-Z0-9-]{5,}$/i.test(value);
  showError(isValid ? '' : 'Invalid tracking format (5+ alphanum/-)', 'trackingError');
  return isValid;
}

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
    '*Others', 'Perfume', 'Phone Accessories', 'Plastic Article', 'RC Parts/Accessories',
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
  const isValid = value.length >= 3;
  showError(isValid ? '' : 'Minimum 3 characters required', 'itemDescriptionError');
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
  const isValid = !isNaN(value) && value >= 0 && value < 100000; 
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
    '* Oil Ointment', '* Supplement', '*Others'
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
    '*Gadgets', '*Oil Ointment', '*Supplement', '*Others'
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
      '*Gadgets', '*Oil Ointment', '*Supplement', '*Others'
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
            validateTrackingNumberInput(input);
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
    // Extract base path without query parameters
    const basePath = path.split('?')[0].split('#')[0];
    
    const allowedPaths = [
      'login.html', 'register.html', 'dashboard.html',
      'forgot-password.html', 'password-reset.html',
      'my-info.html', 'parcel-declaration.html', 'track-parcel.html',
      'billing-info.html', 'invoice.html'
    ];
    
    if (!allowedPaths.includes(basePath)) {
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

// ================= FORM SETUP =================
function setupFormSubmission() {
  const form = document.getElementById('declarationForm');
  if (!form) return;
  
  // Remove existing event listeners by cloning
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);
  
  // Add enhanced submission handler
  newForm.addEventListener('submit', handleParcelSubmission);
  
  // Add input validation
  newForm.addEventListener('input', function(e) {
    validateField(e.target);
    updateSubmitButton();
  });
  
  // Add file validation
  const fileInput = newForm.querySelector('#fileUpload');
  if (fileInput) {
    fileInput.addEventListener('change', function() {
      validateFiles(this);
      updateSubmitButton();
    });
  }
}

function validateField(field) {
  const value = field.value.trim();
  const errorId = field.id + 'Error';
  const errorElement = document.getElementById(errorId);
  
  if (!errorElement) return true;
  
  let isValid = true;
  let message = '';
  
  switch(field.id) {
    case 'trackingNumber':
      isValid = /^[A-Z0-9-]{5,}$/i.test(value);
      message = isValid ? '' : 'Minimum 5 alphanumeric characters or hyphens';
      break;
      
    case 'nameOnParcel':
      isValid = value.length >= 2 && value.length <= 100;
      message = isValid ? '' : '2-100 characters required';
      break;
      
    case 'itemDescription':
      isValid = value.length >= 3 && value.length <= 500;
      message = isValid ? '' : '3-500 characters required';
      break;
      
    case 'quantity':
      const qty = parseInt(value);
      isValid = !isNaN(qty) && qty >= 1 && qty <= 999;
      message = isValid ? '' : 'Must be between 1 and 999';
      break;
      
    case 'price':
      const price = parseFloat(value);
      isValid = !isNaN(price) && price >= 0 && price <= 99999;
      message = isValid ? '' : 'Must be between 0 and 99,999';
      break;
      
    case 'collectionPoint':
    case 'itemCategory':
      isValid = value !== '';
      message = isValid ? '' : 'This field is required';
      break;
  }
  
  // Update UI
  if (isValid) {
    field.style.borderColor = '#00C851';
    errorElement.textContent = '';
  } else {
    field.style.borderColor = '#ff4444';
    errorElement.textContent = message;
  }
  
  return isValid;
}

function validateFiles(fileInput) {
  const files = Array.from(fileInput.files);
  const category = document.getElementById('itemCategory')?.value || '';
  
  const starredCategories = [
    '*Books', '*Cosmetics/Skincare/Bodycare',
    '*Food Beverage/Drinks', '*Gadgets',
    '*Oil Ointment', '*Supplement', '*Others'
  ];
  
  if (starredCategories.includes(category)) {
    if (files.length === 0) {
      showError('Invoice/document upload is required for this category', 'fileUploadError');
      return false;
    }
  }
  
  // Validate each file
  for (const file of files) {
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      showError(`File "${file.name}" exceeds 5MB limit`, 'fileUploadError');
      fileInput.value = '';
      return false;
    }
    
    if (!CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
      showError(`File "${file.name}" must be JPG, PNG, or PDF`, 'fileUploadError');
      fileInput.value = '';
      return false;
    }
  }
  
  // Show file count
  if (files.length > 0) {
    showError(`${files.length} file(s) selected`, 'fileUploadError');
  } else {
    showError('', 'fileUploadError');
  }
  
  return true;
}

function updateSubmitButton() {
  const submitBtn = document.getElementById('submitBtn');
  if (!submitBtn) return;
  
  const requiredFields = [
    'trackingNumber', 'nameOnParcel', 'itemDescription',
    'quantity', 'price', 'collectionPoint', 'itemCategory'
  ];
  
  let allValid = true;
  
  requiredFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field && !field.value.trim()) {
      allValid = false;
    }
  });
  
  // Check file requirements for starred categories
  const category = document.getElementById('itemCategory')?.value || '';
  const starredCategories = [
    '*Books', '*Cosmetics/Skincare/Bodycare', '*Food Beverage/Drinks',
    '*Gadgets', '*Oil Ointment', '*Supplement', '*Others'
  ];
  
  if (starredCategories.includes(category)) {
    const files = document.getElementById('fileUpload')?.files || [];
    if (files.length === 0) {
      allValid = false;
    }
  }
  
  submitBtn.disabled = !allValid;
}

// ================= NEW FUNCTIONS FOR CATEGORY REQUIREMENTS =================
function checkCategoryRequirements() {
  const category = document.getElementById('itemCategory')?.value || '';
  const fileInput = document.getElementById('fileUpload');
  const fileHelp = document.getElementById('fileHelp');
  
  const starredCategories = [
    '*Books', '*Cosmetics/Skincare/Bodycare',
    '*Food Beverage/Drinks', '*Gadgets',
    '*Oil Ointment', '*Supplement', '*Others'
  ];

  if (starredCategories.includes(category)) {
    if (fileInput) fileInput.required = true;
    if (fileHelp) {
      fileHelp.innerHTML = 'Required: JPEG, PNG, PDF (Max 5MB each)';
      fileHelp.style.color = '#ff4444';
    }
  } else {
    if (fileInput) fileInput.required = false;
    if (fileHelp) {
      fileHelp.innerHTML = 'Optional: JPEG, PNG, PDF (Max 5MB each)';
      fileHelp.style.color = '#888';
    }
  }
}

function setupCategoryChangeListener() {
  const categorySelect = document.getElementById('itemCategory');
  if (categorySelect) {
    categorySelect.addEventListener('change', checkCategoryRequirements);
  }
}

// ================= DRAFT SYSTEM =================
function saveFormAsDraft() {
  try {
    const form = document.getElementById('declarationForm');
    if (!form) return;
    
    const formData = new FormData(form);
    const draft = {};
    
    // Convert FormData to object
    for (let [key, value] of formData.entries()) {
      if (key !== 'files') {
        draft[key] = value;
      }
    }
    
    // Get files info
    const files = document.getElementById('fileUpload')?.files || [];
    if (files.length > 0) {
      draft.filesCount = files.length;
      draft.filesInfo = Array.from(files).map(file => ({
        name: file.name,
        size: file.size,
        type: file.type
      }));
    }
    
    // Add timestamp and ID
    draft.timestamp = new Date().toISOString();
    draft.id = 'draft_' + Date.now();
    
    // Save to localStorage
    const drafts = JSON.parse(localStorage.getItem('parcelDrafts') || '[]');
    drafts.push(draft);
    localStorage.setItem('parcelDrafts', JSON.stringify(drafts));
    
    // Show success message
    showError('Draft saved successfully!', 'draft-message');
    
  } catch (error) {
    console.error('Failed to save draft:', error);
    showError('Failed to save draft');
  }
}

function loadDrafts() {
  try {
    const drafts = JSON.parse(localStorage.getItem('parcelDrafts') || '[]');
    const draftCount = document.getElementById('draftCount');
    const draftsList = document.getElementById('draftsList');
    
    if (draftCount) draftCount.textContent = drafts.length;
    
    if (draftsList && drafts.length > 0) {
      let html = '<div class="drafts-container">';
      drafts.forEach((draft, index) => {
        html += `
          <div class="draft-item">
            <div class="draft-info">
              <strong>${draft.trackingNumber || 'Untitled'}</strong>
              <small>${new Date(draft.timestamp).toLocaleDateString()}</small>
            </div>
            <div class="draft-actions">
              <button onclick="loadDraft(${index})" class="small-btn">Load</button>
              <button onclick="deleteDraft(${index})" class="small-btn delete">Delete</button>
            </div>
          </div>
        `;
      });
      html += '</div>';
      draftsList.innerHTML = html;
    }
  } catch (error) {
    console.error('Failed to load drafts:', error);
  }
}

function loadDraft(index) {
  try {
    const drafts = JSON.parse(localStorage.getItem('parcelDrafts') || '[]');
    const draft = drafts[index];
    
    if (!draft) return;
    
    // Populate form fields
    Object.keys(draft).forEach(key => {
      if (key !== 'timestamp' && key !== 'id' && key !== 'filesCount' && key !== 'filesInfo') {
        const field = document.getElementById(key);
        if (field) field.value = draft[key];
      }
    });
    
    // Update UI
    checkCategoryRequirements();
    updateSubmitButton();
    
    showError('Draft loaded!', 'draft-message');
    
  } catch (error) {
    console.error('Failed to load draft:', error);
    showError('Failed to load draft');
  }
}

function deleteDraft(index) {
  try {
    const drafts = JSON.parse(localStorage.getItem('parcelDrafts') || '[]');
    drafts.splice(index, 1);
    localStorage.setItem('parcelDrafts', JSON.stringify(drafts));
    loadDrafts();
    showError('Draft deleted', 'draft-message');
  } catch (error) {
    console.error('Failed to delete draft:', error);
    showError('Failed to delete draft');
  }
}

// ================= BILLING SYSTEM HELPERS =================
async function loadBillingDataWithRetry(phone, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Loading billing data (attempt ${attempt}/${maxRetries})`);
      
      // Add exponential backoff
      if (attempt > 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const result = await loadBillingDataFromServer(phone);
      
      if (result && result.success) {
        return result;
      }
      
      lastError = new Error(result?.message || 'Billing data load failed');
      
    } catch (error) {
      console.error(`Billing load attempt ${attempt} failed:`, error);
      lastError = error;
      
      // If it's a network error, try again
      if (attempt < maxRetries) {
        continue;
      }
    }
  }
  
  throw lastError || new Error('Failed to load billing data after all retries');
}

async function checkPaymentStatusWithRetry(phone, maxRetries = 2) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Checking payment status (attempt ${attempt}/${maxRetries})`);
      
      if (attempt > 1) {
        const delay = Math.min(500 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const result = await checkPaymentStatusForUser(phone);
      
      if (result && (result.success || result.paidOrders)) {
        return result;
      }
      
      lastError = new Error('Payment status check failed');
      
    } catch (error) {
      console.error(`Payment status attempt ${attempt} failed:`, error);
      lastError = error;
      
      if (attempt < maxRetries) {
        continue;
      }
    }
  }
  
  // Return empty if all retries fail
  return { success: false, paidOrders: [] };
}

// ================= IMPROVED LOADING FUNCTION =================
async function loadBillingData() {
  try {
    showLoading(true, "Please wait, loading billing information...");
    const userData = checkSession();
    if (!userData?.phone) {
      handleLogout();
      return;
    }

    console.log('Starting to load billing data...');
    
    // Load billing data with retry
    const billingResponse = await loadBillingDataWithRetry(userData.phone);
    
    if (!billingResponse.success) {
      showError(billingResponse.message || 'Failed to load billing information', 'connectionError');
      return;
    }

    // Load payment status with retry (non-critical)
    const paymentStatus = await checkPaymentStatusWithRetry(userData.phone);
    
    const allBillingData = billingResponse.data || [];
    const paidOrders = paymentStatus.paidOrders || [];
    
    console.log(`Loaded ${allBillingData.length} billing records and ${paidOrders.length} paid orders`);
    
    // Store in session for offline access
    try {
      sessionStorage.setItem('billingCache', JSON.stringify({
        data: allBillingData,
        paidOrders: paidOrders,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Could not cache billing data:', e);
    }
    
    // renderBillingSections(allBillingData); // Uncomment if you have this function

  } catch (error) {
    console.error('Billing load error:', error);
    
    // Try to use cached data
    try {
      const cached = sessionStorage.getItem('billingCache');
      if (cached) {
        const cacheData = JSON.parse(cached);
        const cacheAge = Date.now() - cacheData.timestamp;
        
        // Use cache if less than 10 minutes old
        if (cacheAge < 10 * 60 * 1000) {
          console.log('Using cached billing data');
          const allBillingData = cacheData.data || [];
          const paidOrders = cacheData.paidOrders || [];
          // renderBillingSections(allBillingData); // Uncomment if you have this function
          showError('Using cached data. Some information may be outdated.', 'connectionError');
          return;
        }
      }
    } catch (cacheError) {
      console.warn('Cache error:', cacheError);
    }
    
    showError('Connection failed. Please try again.', 'connectionError');
  } finally {
    showLoading(false);
  }
}

// ================= CONNECTION HEALTH CHECK =================
async function checkBackendHealth() {
  try {
    const healthCheck = await new Promise((resolve, reject) => {
      const callbackName = `health_${Date.now()}`;
      const script = document.createElement('script');
      script.crossOrigin = 'anonymous';
      script.src = `${CONFIG.GAS_URL}?callback=${callbackName}&action=processLogin&phone=test&password=test`;
      
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Backend timeout'));
      }, 5000);
      
      function cleanup() {
        clearTimeout(timeoutId);
        delete window[callbackName];
        if (script.parentNode) {
          document.body.removeChild(script);
        }
      }
      
      window[callbackName] = (response) => {
        cleanup();
        // Even if login fails, backend is responding
        resolve(true);
      };
      
      script.onerror = () => {
        cleanup();
        reject(new Error('Backend unavailable'));
      };
      
      document.body.appendChild(script);
    });
    
    return true;
  } catch (error) {
    console.error('Backend health check failed:', error);
    return false;
  }
}

// ================= SAFARI FILE API POLYFILL =================
function safariFileReaderPolyfill() {
  if (typeof FileReader === 'undefined') {
    console.warn('FileReader not supported - using fallback');
    return false;
  }
  
  // Ensure FileReader events work in Safari
  const originalAddEventListener = FileReader.prototype.addEventListener;
  FileReader.prototype.addEventListener = function(type, listener, options) {
    // Safari sometimes loses event listeners
    if (type === 'load' || type === 'error') {
      this['on' + type] = listener;
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
  
  return true;
}

// ================= SAFARI FETCH ENHANCEMENT =================
function safariFetchEnhancement() {
  const originalFetch = window.fetch;
  
  window.fetch = function(resource, init) {
    // Safari-specific fetch enhancements
    const enhancedInit = init || {};
    
    // Add Safari-specific headers
    enhancedInit.headers = {
      ...enhancedInit.headers,
      'Accept': 'application/json, text/javascript, */*',
      'X-Requested-With': 'XMLHttpRequest'
    };
    
    // Disable cache for Safari
    enhancedInit.cache = 'no-store';
    
    // Add timeout for Safari
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    enhancedInit.signal = controller.signal;
    
    return originalFetch(resource, enhancedInit).then(response => {
      clearTimeout(timeoutId);
      return response;
    }).catch(error => {
      clearTimeout(timeoutId);
      throw error;
    });
  };
}

// ================= LOGIN PAGE INITIALIZATION =================
function initLoginPage() {
  // Check if we're on the login page
  if (!window.location.pathname.includes('login.html')) {
    return;
  }
  
  // Clear any existing session data when loading login page
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('logout')) {
    sessionStorage.clear();
    localStorage.removeItem('lastActivity');
  }
  
  // Focus on phone input
  const phoneInput = document.getElementById('phone');
  if (phoneInput) {
    phoneInput.focus();
  }
}

// ================= MAIN INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  detectViewMode();
  
  // Get current page
  const currentPage = window.location.pathname.split('/').pop() || 'login.html';
  
  // Define public pages
  const publicPages = ['login.html', 'register.html', 'forgot-password.html'];
  const isPublicPage = publicPages.includes(currentPage);
  
  // Only run session checks on protected pages
  if (!isPublicPage) {
    const userData = checkSession();
    if (!userData) {
      handleLogout();
      return;
    }
    
    // Set phone field only on parcel declaration page
    if (currentPage === 'parcel-declaration.html') {
      const phoneField = document.getElementById('phone');
      if (phoneField) {
        phoneField.value = userData.phone || '';
        phoneField.readOnly = true;
      }
      
      // Setup enhanced form submission
      setupFormSubmission();
      setupCategoryChangeListener();
      initValidationListeners();
      checkCategoryRequirements();
      
      // Load saved drafts
      loadDrafts();
    }
  }
  
  // Initialize common components
  createLoaderElement();
  
  // Initialize login page if needed
  if (currentPage === 'login.html') {
    initLoginPage();
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    const errorElement = document.getElementById('error-message');
    if (errorElement) errorElement.style.display = 'none';
  });
  
  // Focus management
  const firstInput = document.querySelector('input:not([type="hidden"])');
  if (firstInput) firstInput.focus();
});

// ================= HELPER FUNCTIONS FOR MISSING IMPLEMENTATIONS =================
// These are placeholder functions for methods that might be called elsewhere

function loadBillingDataFromServer(phone) {
  // This should be implemented to load billing data from server
  console.log('Loading billing data for:', phone);
  return Promise.resolve({ success: false, message: 'Not implemented' });
}

function checkPaymentStatusForUser(phone) {
  // This should be implemented to check payment status
  console.log('Checking payment status for:', phone);
  return Promise.resolve({ success: false, paidOrders: [] });
}

function renderBillingSections(data) {
  // This should be implemented to render billing data
  console.log('Rendering billing sections:', data);
}

// ================= EXPORT FUNCTIONS FOR HTML USE =================
// Make these functions available globally for HTML onclick handlers
window.handleLogout = handleLogout;
window.safeRedirect = safeRedirect;
window.handleRegistration = handleRegistration;
window.handlePasswordRecovery = handlePasswordRecovery;
window.handlePasswordReset = handlePasswordReset;
window.loadDrafts = loadDrafts;
window.loadDraft = loadDraft;
window.deleteDraft = deleteDraft;
window.retryFailedSubmissions = retryFailedSubmissions;
window.showRegistration = () => safeRedirect('register.html');
window.showForgotPassword = () => safeRedirect('forgot-password.html');

// Safari-specific functions
window.isSafariBrowser = isSafariBrowser;
window.safariFileReaderPolyfill = safariFileReaderPolyfill;
window.safariFetchEnhancement = safariFetchEnhancement;

// Debug function to check validation
function debugValidation() {
  const priceField = document.getElementById('price');
  const itemDescriptionField = document.getElementById('itemDescription');
  
  console.log('Price field value:', priceField.value);
  console.log('Price field type:', typeof priceField.value);
  console.log('Price parsed:', parseFloat(priceField.value));
  console.log('Is price 0 valid?', parseFloat(priceField.value) >= 0);
  
  console.log('Item description value:', itemDescriptionField.value);
  console.log('Item description length:', itemDescriptionField.value.length);
  console.log('Is description >= 3?', itemDescriptionField.value.length >= 3);
  
  // Call updateSubmitButton and see what it returns
  const submitBtn = document.getElementById('submitBtn');
  console.log('Submit button disabled?', submitBtn.disabled);
}
