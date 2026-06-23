import { ui } from './utils.js';

document.getElementById('form').addEventListener('submit', (e) =>{
  e.preventDefault();
  const password_1 = document.querySelector('#password-1').value;
  const password_2 = document.querySelector('#password-2').value;
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  fetch('/reset-password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({password_1, password_2, token})
  })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong!');
      }
      return data;
    })
    .then(data => {
      ui.notify(data.message || 'Your password updated successfuly.');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    })
    .catch(err => { ui.notify(err.message, 'error') })
})
