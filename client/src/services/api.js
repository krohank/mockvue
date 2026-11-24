import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env?.VITE_API_URL || '/api', timeout: 45000,
  headers: { 'Content-Type': 'application/json' },
});
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mockvue_token');
  if (token) config.headers.Authorization = 'Bearer ' + token;
  return config;
});
api.interceptors.response.use((response) => response.data, (error) => {
  if (axios.isCancel(error)) return Promise.reject(error);
  if (error.response) {
    const body = error.response.data || {};
    if (error.response.status === 401 && !/\/auth\/(login|register)/.test(error.config?.url || '') && error.config?.headers?.Authorization === 'Bearer ' + localStorage.getItem('mockvue_token')) {
      window.dispatchEvent(new Event('mockvue:session-expired'));
    }
    return Promise.reject({
      ...body, status: error.response.status,
      message: body.details?.[0]?.message || body.message || 'This request could not be completed.',
    });
  }
  return Promise.reject({ message: error.code === 'ECONNABORTED'
    ? 'The request timed out. Your work is still here. Please retry.'
    : 'The server is unavailable. Please retry in a moment.' });
});
export default api;
