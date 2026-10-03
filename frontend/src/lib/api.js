import axios from 'axios';

const TOKEN_KEY = 'hrms_token';

// localStorage can throw in private mode, so wrap every access
export const tokenStorage = {
  get() {
    try {
      return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  timeout: 20000,
});

// Attach the JWT to every request
api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/*
 * On success we return the API envelope: { success, message, data, meta }
 * On failure we throw an Error with the server's message, so pages can simply do toast.error(err.message)
 */
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || (error.code === 'ERR_NETWORK' ? 'Cannot reach the server' : error.message);

    const isLoginCall = error.config?.url?.includes('/auth/login');
    if (status === 401 && !isLoginCall && typeof window !== 'undefined') {
      tokenStorage.clear();
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    }

    const err = new Error(message);
    err.status = status;
    err.errors = error.response?.data?.errors; // field errors from validation
    return Promise.reject(err);
  }
);

export default api;
