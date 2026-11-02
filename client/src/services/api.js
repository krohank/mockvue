import axios from 'axios';
import { local, KEYS } from '../lib/storage';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 45_000, // AI evaluation can take a while
});

api.interceptors.request.use((config) => {
  const token = local.get(KEYS.token);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const AUTH_ENDPOINTS = ['/auth/login', '/auth/register'];

/**
 * Errors are normalised to { message, status, data } so pages can render
 * them directly. A 401 from any authenticated endpoint means the session is
 * no longer valid; AuthContext listens for this event and signs out.
 */
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      const url = error.config?.url || '';
      if (status === 401 && !AUTH_ENDPOINTS.some((p) => url.includes(p))) {
        window.dispatchEvent(new CustomEvent('mockvue:session-expired', { detail: data?.message }));
      }
      return Promise.reject({
        status,
        data,
        message: data?.message || `Request failed (${status}).`,
      });
    }
    if (error.code === 'ECONNABORTED') {
      return Promise.reject({ status: 0, message: 'The server took too long to respond. Please try again.' });
    }
    return Promise.reject({
      status: 0,
      message: 'Cannot reach the MockVue server. Check your connection and that the API is running.',
    });
  }
);

export default api;
