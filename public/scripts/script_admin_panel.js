document.addEventListener("DOMContentLoaded", () => {
  loadUsers();

  fetch("/api/profile")
  .then(res => res.json())
  .then(data => {
    document.getElementById("admin-name").innerText = data.username;
  })
  .catch(err => console.error("Error:", err));
})

function appendUsersToFeed(user) {
  const listUsers = document.getElementById('list-users');
  if (!listUsers) return;

  const userDiv = document.createElement('div');
  userDiv.className = 'user';
  userDiv.innerHTML = `
    <span>${user.id}</span> |
    <span>${user.username}</span> |
    <span>${user.email}</span> |
    <span>${user.created_at}</span> |
    <span>${user.role}</span> |
    <span><button class="btn-delete-user" data-username="${user.username}">DELETE</button></span> |
  `
  listUsers.appendChild(userDiv);
  listUsers.scrollTop = listUsers.scrollHeight;
}

function loadUsers() {
  fetch('/api/load-users')
    .then(res => res.json())
    .then(users => {
      const listUsers = document.getElementById('list-users');
      if (!listUsers) return;
      listUsers.innerHTML = '';
      users.forEach(user => appendUsersToFeed(user));
    })
    .catch(err => console.error("Load error:", err));
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-delete-user')) {
    const username = e.target.dataset.username;
    if (confirm(`Delete ${username}`)) {
      fetch('/api/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      }).then(res => location.reload());
    }
  }
})
