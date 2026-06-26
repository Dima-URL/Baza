const link = document.getElementById('link');
document.getElementById('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('enter-email').value.trim();
  fetch('/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
    .then(res => res.json())
    .then(data => {
      link.innerHTML = `<a href='http://127.0.0.1:3000${data.link}'>Link to reset your password</a>`;
    })
})
