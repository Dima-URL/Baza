export const validation = {
  isValidUsername: (username) => /^\w{3,64}$/.test(username.trim()),

  isValidEmail: (email) => /^[a-zA-Z0-9._]{3,128}@baza\.xyz$/.test(email.trim().toLowerCase()),

  isValidPassword: (password) => {
    if (password.length < 8 || password.length > 128) return false;
    return [
      /[a-zA-Z]/.test(password),
      /[0-9]/.test(password),
      /[\p{P}\p{S}]/u.test(password)
    ].every(Boolean);
  },

  isValidMessage: (message) => {
    if (typeof message !== 'string') return { valid: false, error: 'Invalid type message!' };
    const value = message.trim();
    if (value.length < 1 || value.length > 2048) return {
      valid: false, error: 'Message empty or too long!'
    };
    return { valid: true, value };
  }
};

export const ui = {
  notify: (message, isError = false) => {
    const toast = document.getElementById('notify-global');
    const textElement = document.getElementById('notify-text');
    const closeBtn = document.getElementById('notify-close');

    if (!toast || !textElement) {
      console.error("Notification elements not found in DOM");
      return;
    }

    // Сброс состояния
    if (toast.open) toast.close();

    toast.dataset.type = isError ? 'error' : 'success';
    textElement.innerText = message;

    // Один обработчик на закрытие
    if (closeBtn && !closeBtn.onclick) {
      closeBtn.onclick = () => toast.close();
    }

    toast.showModal(); // Используем show(), чтобы не блокировать страницу (backdrop)

    // Авто-закрытие через 5 секунд
    setTimeout(() => {
      if (toast.open) toast.close();
    }, 5000);
  }
};
