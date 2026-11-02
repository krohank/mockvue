import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { local, KEYS } from '../lib/storage';

const AuthContext = createContext(null);

/**
 * status: 'checking'      — token present, verifying with the server
 *         'authenticated' — verified (or optimistically restored from cache)
 *         'anonymous'     — signed out
 */
export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => local.get(KEYS.token));
  const [user, setUser] = useState(() => local.get(KEYS.user));
  const [status, setStatus] = useState(() => {
    if (!local.get(KEYS.token)) return 'anonymous';
    return local.get(KEYS.user) ? 'authenticated' : 'checking';
  });
  const [sessionNotice, setSessionNotice] = useState(null);

  const persist = useCallback((nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    if (nextToken) {
      local.set(KEYS.token, nextToken);
      local.set(KEYS.user, nextUser);
      setStatus('authenticated');
    } else {
      local.remove(KEYS.token);
      local.remove(KEYS.user);
      setStatus('anonymous');
    }
  }, []);

  const logout = useCallback(
    (notice = null) => {
      persist(null, null);
      setSessionNotice(notice);
    },
    [persist]
  );

  // Verify a stored session on boot.
  useEffect(() => {
    if (!local.get(KEYS.token)) return;
    let cancelled = false;
    api
      .get('/auth/me')
      .then((res) => {
        if (cancelled || !res?.user) return;
        setUser(res.user);
        local.set(KEYS.user, res.user);
        setStatus('authenticated');
      })
      .catch((err) => {
        if (cancelled) return;
        // 401 is handled by the session-expired listener; keep the cached
        // session when the server is merely unreachable.
        if (err.status !== 401 && !local.get(KEYS.user)) setStatus('anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onExpired = (e) => {
      if (!local.get(KEYS.token)) return;
      logout(e.detail || 'Your session has ended. Please sign in again.');
    };
    window.addEventListener('mockvue:session-expired', onExpired);
    return () => window.removeEventListener('mockvue:session-expired', onExpired);
  }, [logout]);

  const login = useCallback(
    async (email, password) => {
      const res = await api.post('/auth/login', { email, password });
      persist(res.token, res.user);
      setSessionNotice(null);
      return res;
    },
    [persist]
  );

  const register = useCallback(
    async (payload) => {
      const res = await api.post('/auth/register', payload);
      persist(res.token, res.user);
      setSessionNotice(null);
      return res;
    },
    [persist]
  );

  const updateProfile = useCallback(async (payload) => {
    const res = await api.put('/users/profile', payload);
    if (res.user) {
      setUser(res.user);
      local.set(KEYS.user, res.user);
    }
    return res;
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      status,
      isAuthenticated: status === 'authenticated' && Boolean(token),
      sessionNotice,
      clearSessionNotice: () => setSessionNotice(null),
      login,
      register,
      logout,
      updateProfile,
    }),
    [user, token, status, sessionNotice, login, register, logout, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
