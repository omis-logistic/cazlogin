// Replace all google.script.run with:
const API_URL = 'https://script.google.com/macros/s/AKfycbzZJFomuSsv-4shW0BaArlf-kvIugE_XBR67E4cGqDgf1_Xu6Dw6HdhIDiT3HJ-T5hz/exec';

async function callBackend(action, data) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action, ...data})
    });
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    return {success: false, message: 'Network error'};
  }
}

// Modified login example
async function handleLogin() {
  const phone = document.getElementById('phone').value;
  const password = document.getElementById('password').value;

  const response = await callBackend('processLogin', {phone, password});
  if (response.success) {
    // Handle successful login
  }
}
