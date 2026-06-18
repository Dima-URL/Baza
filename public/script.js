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

//  /open modal sing

//  register, send data
const formRegister = document.getElementById("form-register");

formRegister.addEventListener("submit", (e) => {
  e.preventDefault();

  const username = document.getElementById("enter-username").value;
  const email = document.getElementById("enter-email").value;
  const password = document.getElementById("enter-password").value;

  const fullEmail = email + "@baza.xyz";

  // validation
  const clearUsername =  username.trim();
  const clearEmail =  fullEmail.trim();
  const clearPassword =  password.trim();

  fetch("/register", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      username: clearUsername,
      email: clearEmail,
      password: clearPassword
    })
  })
  .then(res => res.json())
  .then(data => {
    alert(data.message || data.error)
    if (data.message) modalRegister.close();
  })
  .catch(error => console.error(`Fetch Error: `, error.message))
})

//  logIn, send data

const formLogIn = document.getElementById("modal-logIn");

formLogIn.addEventListener("submit", (e) => {
  e.preventDefault();

  const emailLogIn = document.getElementById("logIn-email").value;
  const passwordLogIn = document.getElementById("logIn-password").value;

  const clearEmail =  emailLogIn.trim();
  const clearPassword =  passwordLogIn.trim();

  fetch("/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      email: clearEmail,
      password: clearPassword
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.message) {
      alert(data.message);
      window.location.href = "/profile";
    } else {
      alert(data.error);
    }
  })
  .catch(error => console.error("Fetch Error: ", error.message))
})


