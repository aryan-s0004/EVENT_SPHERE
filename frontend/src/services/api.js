import axios from 'axios';
import { clearAuthToken, getAuthToken } from './authStorage';

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

// Support both VITE_API_BASE_URL (local) and VITE_API_URL (Vercel project env)
const rawApiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').trim();
const normalizedApiBaseUrl = rawApiBaseUrl ? trimTrailingSlash(rawApiBaseUrl) : '/api';
const assetBaseUrl = normalizedApiBaseUrl.endsWith('/api')
  ? normalizedApiBaseUrl.slice(0, -4)
  : normalizedApiBaseUrl;


export const resolveAssetUrl = (value) => {
  if (!value) {
    return '';
  }

  if (/^(data:|https?:\/\/)/i.test(value)) {
    return value;
  }

  if (value.startsWith('/')) {
    return `${assetBaseUrl}${value}`;
  }

  return value;
};

export const getErrorMessage = (error, fallbackMessage = 'Something went wrong') =>
  error?.response?.data?.message || fallbackMessage;

export const getErrorCode = (error) => error?.response?.data?.code || '';

const api = axios.create({
  baseURL: normalizedApiBaseUrl,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = getErrorCode(error);

    if (error?.response?.status === 401 && code.startsWith('TOKEN_')) {
      clearAuthToken();
      window.dispatchEvent(new CustomEvent('auth:expired', { detail: { code } }));
    }

    return Promise.reject(error);
  }
);

export default api;
