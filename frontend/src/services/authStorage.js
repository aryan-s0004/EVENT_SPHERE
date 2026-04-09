const TOKEN_KEY = 'token';

const getSessionStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage;
};

const migrateLegacyToken = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  const sessionStorage = getSessionStorage();
  if (!sessionStorage) {
    return '';
  }

  const sessionToken = sessionStorage.getItem(TOKEN_KEY);
  if (sessionToken) {
    return sessionToken;
  }

  const legacyToken = window.localStorage.getItem(TOKEN_KEY);
  if (legacyToken) {
    sessionStorage.setItem(TOKEN_KEY, legacyToken);
    window.localStorage.removeItem(TOKEN_KEY);
  }

  return legacyToken || '';
};

export const getAuthToken = () => {
  try {
    return migrateLegacyToken();
  } catch {
    return '';
  }
};

export const setAuthToken = (token) => {
  try {
    const sessionStorage = getSessionStorage();
    if (!sessionStorage) {
      return;
    }

    sessionStorage.setItem(TOKEN_KEY, token);
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage failures and allow the in-memory session to continue.
  }
};

export const clearAuthToken = () => {
  try {
    const sessionStorage = getSessionStorage();
    sessionStorage?.removeItem(TOKEN_KEY);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage failures during logout/expiry cleanup.
  }
};
