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
    const cleanMessage = message.trim();
    if (cleanMessage.length < 1 || cleanMessage.length > 2048) return false;
    return true;
  }

};
