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
