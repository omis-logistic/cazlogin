
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxKy9s6gIilX-4zjoL9jAOpQb6_-o83FrsP-7W4XJ-WQDkZFAzkOneM4_vIj9lTch7b/exec';

// Shared authentication functions
function handleLogin() {
  const phone = document.getElementById('phone').value;
  const password = document.getElementById('password').value;

  fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'processLogin',
      phone: phone,
      password: password
    })
  })
  .then(response => response.json())
  .then(data => {
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
      alert(data.message || 'Login failed');
    }
  })
  .catch(error => {
    alert('Error: ' + error.message);
  });
}

// Shared UI functions
function hideAllPages() {
  const pages = document.querySelectorAll('.container');
  pages.forEach(page => page.style.display = 'none');
}
