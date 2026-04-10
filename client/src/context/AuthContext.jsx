import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { clearAuthToken, getAuthToken, setAuthToken } from '../services/authStorage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      api.get('/auth/profile')
        .then(r => setUser(r.data.user))
        .catch(() => clearAuthToken())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleExpiredSession = () => {
      clearAuthToken();
      setUser(null);
    };

    window.addEventListener('auth:expired', handleExpiredSession);
    return () => window.removeEventListener('auth:expired', handleExpiredSession);
  }, []);

  const login = (token, userData) => {
    setAuthToken(token);
    setUser(userData);
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
