//import
import { validation,ui } from "./utils.js";
const socket = io();
let myId = null;
let activeChatId = null;



document.addEventListener("DOMContentLoaded", () => {
  fetch("/api/profile")
    .then(res => {
      if (res.status === 401) window.location.href = "/";
      return res.json();
    })
    .then(data => {
      if (data.username) {
        myId = data.id;

        socket.emit('join', myId);
        document.getElementById("user-name").innerText = data.username;
        document.getElementById("settings-username").value = data.username;
        document.getElementById("settings-email").value = data.email;

        document.getElementById("profile-username").innerText = data.username;
        document.getElementById("profile-email").innerText = data.email;
        document.getElementById('profile-bio').innerText = data.bio || 'No bio written yet.';

        if (data.role === 'admin') {
          const adminContainer = document.getElementById('admin-panel');
          if (adminContainer) {
            document.getElementById('admin-panel').innerHTML = `
              <a href="/admin-panel">Admin Panel</a>
            `
          }
        }
      }
    })
    .catch(err => console.error("Error: ", err))
})

// socket.on('connect', () => {
//   console.log('Connected to server! Socket ID:', socket.id);
// })

socket.on('new_message', (msg) => {
  // console.log('MESSAGE RECEIVED VIA SOCKET:', msg);
  if (activeChatId && (msg.sender_id === activeChatId || msg.sender_id === myId)) {
    appendMessageToFeed(msg); // display chat
  }
})

function appendMessageToFeed(msg) {
  const feed = document.getElementById('message-feed');
  if (!feed) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `message-bubble ${msg.sender_id === myId ? 'mine' : 'theirs'}`;
  msgDiv.innerHTML = `
    <div class="msg-content">${msg.content}</div>
    <small>${new Date(msg.sent_at).toLocaleTimeString()}</small>
  `;
  feed.appendChild(msgDiv);
  feed.scrollTop = feed.scrollHeight;
}

// show messages
function loadMessages(otherId) {
  fetch(`/api/messages/${otherId}`)
    .then(res => res.json())
    .then(messages => {
      const feed = document.getElementById('message-feed');
      if (!feed) return;
      feed.innerHTML = '';
      messages.forEach(msg => appendMessageToFeed(msg));
    })
    .catch(err => console.error("Load error:", err));
}

// function setupChatArea
function setupChatArea(receiverId, receiverName) {
  activeChatId = receiverId;

  const sectionDialog = document.getElementById('section-dialog');
  sectionDialog.innerHTML = `
    <div class="chat-container">
      <h3>Chat with ${receiverName}</h3>
      <div id="message-feed" style="height: 300px; overflow-y: auto; border: 1px solid #ccc;">
      </div>
      <form id="form-send-message">
        <textarea id="message-for-user" placeholder="Type a message..."minlength="1" maxlength="2048" required></textarea>
        <div class="div-send-message"><button type="submit" id="btn-send-message">Send</button></div>
      </form>
      <div class="div-transcript"><button type="submit" id="btn-transcript">Transcript</button></div>
    </div>
  `;

  loadMessages(receiverId);

  // when form exists, do for it "submit"
  document.getElementById('form-send-message').addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(receiverId);
  })

  document.getElementById('btn-transcript').addEventListener('click', () => {
    let fileName = 'transcript.txt';
    fetch('/get-transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverId })
    })
      .then(async res => {
        if (!res.ok) {
          const ErrData = await res.json().catch(() => ({}));
          throw new Error(ErrData.error || 'Download failed');
        }
        const desposition = res.headers.get('Content-Disposition');
        if (desposition && desposition.includes('filename=')) {
          const fileNameRegExp = /filename[^;=\n]*=((['"]).*?\2|[^;=\n]*)/;
          const matches = fileNameRegExp.exec(desposition);
          if (matches !== 0 && matches[1]) {
            fileName = matches[1].replace(/['"]/g, '');
          }
        }
        return res.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url); // Чистим память за blob-ссылкой
      })
      .catch(err => {
        console.error(err);
        ui.notify(err.message);
      });
  })
}

// func send message
function sendMessage(receiverId) {
  const rawContent = document.getElementById('message-for-user').value;
  const contentRes = validation.isValidMessage(rawContent);
  if (!contentRes.valid) return ui.notify(contentRes.error);

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
      document.getElementById('message-for-user').value = '';
    })
    .catch(err => ui.notify(err.message));
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
    return ui.notify("Invalid username format (3-64 chars, letters/numbers/_ only)");
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
      ui.notify(`Username was updated! Your a new username is ${data.username}`);
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
    return ui.notify("Invalid email. Must be prefix@baza.xyz");
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
      ui.notify(`Success! Your new email is ${data.email}`);
      document.getElementById("modal-change-email").close();
      document.getElementById("modal-settings").close();
    })
    .catch(err => {
      console.error("Fetch error: ", err)
      return ui.notify(`Fetch error`, err.message)
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
    return ui.notify("Passwords incorrect!");
  }

  if (newPassword1 !== newPassword2) {
    return ui.notify("The passwords do not match!");
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
      ui.notify(`${data.message}! Password updated!`)
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
    return ui.notify("Password incorect!");
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
    return ui.notify("Invalid username! Format (3-64 chars, letters/numbers/_ only)");
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
      ui.notify(err.message);
      document.getElementById("section-show-users").innerText = "";
    })
})

const editBioBtn = document.getElementById('edit-bio-btn');
const saveBioBtn = document.getElementById('save-bio-btn');
const cancelBioBtn = document.getElementById('cancel-bio-btn');

const profileBio = document.getElementById('profile-bio');
const bioEditZone = document.getElementById('bio-edit-zone');
const bioTextarea = document.getElementById('bio-textarea');


editBioBtn.addEventListener('click', () => {
  bioTextarea.value = profileBio.textContent === 'No bio written yet.' ? '' : profileBio.textContent;

  profileBio.style.display = 'none';
  editBioBtn.style.display = 'none';
  bioEditZone.style.display = 'block';
})

cancelBioBtn.addEventListener('click', () => {
  bioEditZone.style.display = 'none';
  profileBio.style.display = 'block';
  editBioBtn.style.display = 'block';
});

saveBioBtn.addEventListener('click', () => {
  const bio = bioTextarea.value.trim();

  if (bio.length > 300) {
    return ui.notify('Bio cannot be longer than 300 characters.');
  }

  fetch('/update-bio', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bio })
  })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(res.error || 'Failed to update bio!');
      return data;
    })
    .then(data => {
      profileBio.textContent = bio || 'No bio written yet.';
      ui.notify(data.message || 'Bio successfully updated!');

      bioEditZone.style.display = 'none';
      profileBio.style.display = 'block';
      editBioBtn.style.display = 'block';
    })
    .catch(err => {
      ui.notify(err.error);
    })
})
