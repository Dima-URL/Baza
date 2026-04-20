//import
import { validation } from "./utils.js";

document.addEventListener("DOMContentLoaded", () => {
  fetch("/api/profile")
    .then(res => {
      if (res.status === 401) window.location.href = "/";
      return res.json();
    })
    .then(data => {
      if (data.username) {
        document.getElementById("user-name").innerText = data.username;
        document.getElementById("settings-username").value = data.username;
        document.getElementById("settings-email").value = data.email;
      }
    })
    .catch(err => console.error("Error: ", err))
})


// notify...
function notify(message, isError = false) {
  const toast = document.getElementById('notify-global');
  const textElement = document.getElementById('notify-text');

  // Если уже открыт — сначала закроем (чтобы сбросить состояние)
  if (toast.open) toast.close();

  toast.style.borderLeftColor = isError ? '#d93025' : '#2ecc71';
  textElement.innerText = message;

  // ВАЖНО: вызываем как модалку, чтобы пробиться наверх
  toast.showModal();
}

function closeNotify() {
  document.getElementById('notify-global').close();
}

document.getElementById('notify-close').addEventListener("click", closeNotify);

// show messages
function loadMessages(otherId) {
  fetch(`/api/messages/${otherId}`)
    .then(res => res.json())
    .then(messages => {
      const feed = document.getElementById('message-feed');
      feed.innerHTML = '';
      messages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message-bubble';
        msgDiv.innerHTML = `
          <div class="msg-content">${msg.content}</div>
          <small class="msg-time">${new Date(msg.sent_at).toLocaleTimeString()}</small>
        `
        feed.appendChild(msgDiv);
        // separate messages 
        const isMine = msg.sender_id === window.currentUserId;
        msgDiv.className = `message-bubble ${isMine ? 'mine' : 'theirs'}`;
      });
      feed.scrollTop = feed.scrollHeight;
    })
    .catch(err => console.error("Load error:", err));
}

// function setupChatArea
function setupChatArea(receiverId, receiverName) {
  const sectionDialog = document.getElementById('section-dialog');
  sectionDialog.innerHTML = `
    <div class="chat-container">
      <h3>Chat with ${receiverName}</h3>
      <div id="message-feed" style="height: 300px; overflow-y: auto; border: 1px solid #ccc;">
      </div>
      <form id="form-send-message">
        <textarea id="message-for-user" placeholder="Type a message..."minlength="1" maxlength="2048" required></textarea>
        <button type="submit">Send</button>
      </form>
    </div>
  `;

  loadMessages(receiverId);

  // when form exists, do for it "submit"
  document.getElementById('form-send-message').addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(receiverId);
  })
}

// func send message
function sendMessage(receiverId) {
  const rawContent = document.getElementById('message-for-user').value;
  const contentRes = validation.isValidMessage(rawContent);
  if (!contentRes.valid) return notify(contentRes.error);

  fetch('/api/send-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiver_id: receiverId, content: contentRes.value })
  })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Failed!");
      return data;
    })
    .then(data => {
      notify(data.message);
      document.getElementById('message-for-user').value = '';
    })
    .catch(err => notify(err.message));
}


// logout ..
document.getElementById("logout-btn").addEventListener("click", () => {
  fetch("/logout", {method: "POST"})
  .then(() => window.location.href = "/")
  .catch(err => console.error("Logout error: ", err))
})
// .. logout

const settingsBtn = document.getElementById("settings-btn");

settingsBtn.addEventListener("click", () => {
  document.getElementById("modal-settings").showModal();
})

const closeModalSettings = document.getElementById('close-modal');
const modalSettings = document.getElementById("modal-settings");

closeModalSettings.addEventListener("click", () => {
  document.getElementById("modal-settings").close();
})

// change username
document.getElementById("change-username-btn").addEventListener("click", () => {
  document.getElementById("modal-change-username").showModal();
})

document.getElementById("close-modal-changeUsername").addEventListener("click", () => {
  document.getElementById("modal-change-username").close();
})

document.getElementById("form-change-username").addEventListener("submit", (e) => {
  e.preventDefault();

  let username = document.getElementById("input-change-username").value;

  if (!validation.isValidUsername(username)) {
    return notify("Invalid username format (3-64 chars, letters/numbers/_ only)");
  }

  fetch("/change-username", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username })
  })
    .then(res => {
      if (!res.ok) throw new Error("Update failed!");
      return res.json();
    })
    .then(data => {
      document.getElementById("user-name").innerText = data.username;
      notify(`Username was updated! Your a new username is ${data.username}`);
      document.getElementById("modal-change-username").close();
      document.getElementById("modal-settings").close();
    })
    .catch(err => console.error("Fetch error: ", err))
})

// change email
document.getElementById("change-email-btn").addEventListener("click", () => {
  document.getElementById("modal-change-email").showModal();
})

document.getElementById("close-modal-changeEmail").addEventListener("click", () => {
  document.getElementById("modal-change-email").close();
})

document.getElementById("form-change-email").addEventListener("submit", (e) => {
  e.preventDefault();

  let email = document.getElementById("input-change-email").value;

  if (!validation.isValidEmail(email)) {
    return notify("Invalid email. Must be prefix@baza.xyz");
  }

  fetch("/change-email", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Failed!");
      return data;
    })
    .then(data => {
      notify(`Email was updated! Your new email is ${data.email}`);
      document.getElementById("modal-change-email").close();
      document.getElementById("modal-settings").close();
    })
    .catch(err => {
      console.error("Fetch error: ", err)
      return notify(`Fetch error`, err.message)
    })
})

// change password
document.getElementById("change-password-btn").addEventListener("click", () => {
  document.getElementById("modal-change-password").showModal();
})

document.getElementById("close-modal-changePassword").addEventListener("click", () => {
  document.getElementById("modal-change-password").close();
})

document.getElementById("form-change-password").addEventListener("submit", (e) => {
  e.preventDefault();
  const currPassword = document.getElementById("current-password").value;
  const newPassword1 = document.getElementById("input-change-password-1").value;
  const newPassword2 = document.getElementById("input-change-password-2").value;

  if (!validation.isValidPassword(currPassword) ||
      !validation.isValidPassword(newPassword1) ||
      !validation.isValidPassword(newPassword2)) {
    return notify("Passwords incorrect!");
  }

  if (newPassword1 !== newPassword2) {
    return notify("The passwords do not match!");
  }

  fetch("/change-password", {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ currPassword, newPassword1, newPassword2 })
  })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Failed!");
      return data;
    })
    .then(data => {
      notify(`${data.message}! Password updated!`)
      document.getElementById("modal-change-password").close();
      document.getElementById("modal-settings").close();

      document.getElementById("current-password").value = "";
      document.getElementById("input-change-password-1").value = "";
      document.getElementById("input-change-password-2").value = "";
    })
    .catch(err => console.error("Fetch error! ", err.message));
})

// delete account
document.getElementById("delete-account-btn").addEventListener("click", () => {
  document.getElementById("modal-delete-account").showModal();
})

document.getElementById("close-modal-delete-account").addEventListener("click", () => {
  document.getElementById("modal-delete-account").close();
})

document.getElementById("form-delete-account").addEventListener("submit", (e) => {
  e.preventDefault();

  const password = document.getElementById("delete-confirm-password").value;

  if (!validation.isValidPassword(password)) {
    return notify("Password incorect!");
  }

  fetch("/delete-account", {
    method: "DELETE",
    headers: { "Content-Type": "application/json"},
    body: JSON.stringify({ password })
  })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Failed!")
      return data;
    })
    .then(data => {
      window.location.href = "/"
    })
    .catch(err => console.error(`Error: ${err.message}`))
})

// search users
document.getElementById("search-user-btn").addEventListener("click", () => {
  const username = document.getElementById("input-search-users").value;

  if (!validation.isValidUsername(username)) {
    return notify("Invalid username! Format (3-64 chars, letters/numbers/_ only)");
  }

  fetch("/api/search-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username })
  })
    .then(async res => {
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.message || "Failed!");
      return data;
    })
    .then(data => {
      const showBox = document.getElementById("section-show-users");
      showBox.innerHTML = `
        <div>
          <span>Found: <strong>${data.username}</strong></span>
          <button id="btn-open-chat">Message</button>
        </div>
      `

      document.getElementById('btn-open-chat').addEventListener('click', () => {
        setupChatArea(data.id, data.username);
      })
    })
    .catch(err => {
      notify(err.message);
      document.getElementById("section-show-users").innerText = "";
    })
})
