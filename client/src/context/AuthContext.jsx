import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext();
const savedUser = () => { try { return JSON.parse(localStorage.getItem('mockvue_user') || 'null'); } catch { return null; } };
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(savedUser);
  const [token, setToken] = useState(() => localStorage.getItem('mockvue_token'));
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('mockvue_token')));
  const logout = useCallback(() => {
    setUser(null); setToken(null); setLoading(false);
    localStorage.removeItem('mockvue_user'); localStorage.removeItem('mockvue_token');
  }, []);
  useEffect(() => {
    window.addEventListener('mockvue:session-expired', logout);
    const sync = (event) => {
      if (event.key === 'mockvue_token') { setLoading(Boolean(event.newValue)); setUser(null); setToken(event.newValue); }
    };
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('mockvue:session-expired', logout); window.removeEventListener('storage', sync); };
  }, [logout]);
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    const controller = new AbortController();
    api.get('/auth/me', { signal: controller.signal }).then((res) => {
      if (controller.signal.aborted) return;
      setUser(res.user); localStorage.setItem('mockvue_user', JSON.stringify(res.user));
    }).catch((error) => { if (error.status === 401) logout(); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, logout]);
  const saveSession = (res) => {
    localStorage.setItem('mockvue_token', res.token); localStorage.setItem('mockvue_user', JSON.stringify(res.user));
    setUser(res.user); setToken(res.token); setLoading(false); return res;
  };
  const login = async (email, password) => saveSession(await api.post('/auth/login', { email, password }));
  const register = async (data) => saveSession(await api.post('/auth/register', data));
  const updateProfile = async (data) => {
    const res = await api.put('/users/profile', data); setUser(res.user);
    localStorage.setItem('mockvue_user', JSON.stringify(res.user)); return res;
  };
  return <AuthContext.Provider value={{ user, token, loading, isAuthenticated: Boolean(user && token), login, register, logout, updateProfile }}>{children}</AuthContext.Provider>;
};
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requires an AuthProvider');
  return context;
};
export default AuthContext;
