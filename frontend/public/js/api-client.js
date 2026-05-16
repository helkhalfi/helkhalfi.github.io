const API_BASE = '/api/v1';
const ACCESS_KEY = 'ss_access_token';
const REFRESH_KEY = 'ss_refresh_token';

export const TokenStore = {
  getAccess:  () => localStorage.getItem(ACCESS_KEY),
  setAccess:  (t) => localStorage.setItem(ACCESS_KEY, t),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setRefresh: (t) => localStorage.setItem(REFRESH_KEY, t),
  set: (access, refresh) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(code, message, status, raw) {
    super(message);
    this.code = code;
    this.status = status;
    this.raw = raw;
  }
}

let isRefreshing = false;
let refreshQueue = [];

async function doRefresh() {
  const refreshToken = TokenStore.getRefresh();
  if (!refreshToken) {
    TokenStore.clear();
    window.location.href = '/login.html';
    throw new ApiError('no_refresh_token', 'Session expired', 401, null);
  }
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    TokenStore.clear();
    window.location.href = '/login.html';
    throw new ApiError('refresh_failed', 'Session expired', 401, null);
  }
  const data = await res.json();
  TokenStore.setAccess(data.access_token);
  return data.access_token;
}

export async function apiFetch(path, options = {}) {
  const {
    method = 'GET',
    body,
    auth = true,
    idempotencyKey,
    retrying = false,
    formData = false,
  } = options;

  const headers = {};
  if (!formData) headers['Content-Type'] = 'application/json';
  headers['Accept'] = 'application/json';

  if (auth) {
    const token = TokenStore.getAccess();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;

  const init = {
    method,
    headers,
    body: formData ? body : body ? JSON.stringify(body) : undefined,
  };

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError('network_error', 'Network request failed', null, null);
  }

  if (res.status === 401 && auth && !retrying) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject, path, options });
      });
    }
    isRefreshing = true;
    try {
      await doRefresh();
      const pending = refreshQueue.splice(0);
      isRefreshing = false;
      await Promise.all(pending.map(({ resolve, reject, path: p, options: o }) =>
        apiFetch(p, { ...o, retrying: true }).then(resolve).catch(reject)
      ));
      return apiFetch(path, { ...options, retrying: true });
    } catch (e) {
      isRefreshing = false;
      refreshQueue.splice(0).forEach(({ reject }) => reject(e));
      throw e;
    }
  }

  const ct = res.headers.get('Content-Type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = typeof data === 'object' ? (data?.detail || JSON.stringify(data)) : data;
    throw new ApiError(data?.code || 'api_error', msg, res.status, data);
  }
  return data;
}

export const api = {
  auth: {
    register: (body) => apiFetch('/auth/register', { method: 'POST', body, auth: false }),
    login: (email, password) => apiFetch('/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ username: email, password }),
      formData: true,
      auth: false,
    }),
    refresh: doRefresh,
    logout: () => apiFetch('/auth/logout', { method: 'POST' }),
    me: () => apiFetch('/auth/me'),
  },
  accounts: {
    list: () => apiFetch('/accounts'),
    balance: (id) => apiFetch(`/accounts/${id}/balance`),
    create: (currency) => apiFetch('/accounts', { method: 'POST', body: { currency } }),
  },
  transfers: {
    create: (body) => apiFetch('/transfers', {
      method: 'POST',
      body,
      idempotencyKey: crypto.randomUUID(),
    }),
    list: (params = {}) => apiFetch(`/transfers?${new URLSearchParams(params)}`),
    get: (reference) => apiFetch(`/transfers/${reference}`),
  },
  exchange: {
    rates: (base = 'USD') => apiFetch(`/exchange/rates?base=${base}`, { auth: false }),
    quote: (from, to, amount) =>
      apiFetch(`/exchange/quote?from=${from}&to=${to}&amount=${amount}`, { auth: false }),
  },
};
