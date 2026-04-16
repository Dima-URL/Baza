
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
// ...notify

//   open modal sing
// btn, modal - register
const btnRegister = document.querySelector(".register");
const modalRegister = document.getElementById("modal-register");
const closeModalRegister = document.getElementById('close-modal-register');

btnRegister.addEventListener("click", () => {
  modalRegister.showModal();
})

closeModalRegister.addEventListener("click", () => {
  modalRegister.close();
})

// btn, modal - LogIn
const btnLogIn = document.querySelector(".logIn");
const modalLogIn = document.getElementById("modal-logIn");
const closeModalLogIn = document.getElementById('close-modal-logIn');

btnLogIn.addEventListener("click", () => {
  modalLogIn.showModal();
})

closeModalLogIn.addEventListener("click", () => {
  modalLogIn.close();
})

// import modules
import { validation } from './utils.js';

// register, send data
document.getElementById("form-register").addEventListener("submit", (e) => {
  e.preventDefault();

  const username = document.getElementById("enter-username").value.trim();
  const email = (document.getElementById("enter-email").value + "@baza.xyz").trim().toLowerCase();
  const password = document.getElementById("enter-password").value;

  if (!validation.isValidUsername(username)) {
    return notify("Invalid username format (3-64 chars, letters/numbers/_ only)");
  }

  if (!validation.isValidEmail(email)) {
    return notify("Invalid email. Must be prefix@baza.xyz");
  }

  if (!validation.isValidPassword(password)) {
    return notify("Password must be 8+ chars and include letters, numbers, and symbols");
  }

  fetch("/register", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ username, email, password })
  })
    .then(res => res.json())
    .then(data => {
      // alert(data.message || data.error)
      notify(data.message || data.error)
      if (data.message) modalRegister.close();
    })
    .catch(error => console.error(`Fetch Error: `, error.message))
})

//  logIn
document.getElementById("form-logIn").addEventListener("submit", (e) => {
  e.preventDefault();

  const email = document.getElementById("logIn-email").value.trim().toLowerCase();
  const password = document.getElementById("logIn-password").value;

  if (!validation.isValidEmail(email) || !validation.isValidPassword(password)) {
    return notify("Invalid email or password!");
  }

  fetch("/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ email, password })
  })
  .then(async res => {
    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || "Invalid email or password!");
    }
    return data;
  })
  .then(data => {
    if (data.message) {
      window.location.href = "/profile";
    }
  })
  .catch(error => {
    notify(error.message, true)
    console.error("Login Error: ", error.message)
  })
})
