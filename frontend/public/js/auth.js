import { api, TokenStore, ApiError } from './api-client.js';

function showError(formId, message) {
  const el = document.getElementById(formId + '-error');
  if (el) { el.textContent = message; el.classList.remove('hidden'); }
}
function hideError(formId) {
  const el = document.getElementById(formId + '-error');
  if (el) el.classList.add('hidden');
}
function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.classList.toggle('is-loading', loading);
  btn.textContent = loading ? 'Please wait…' : btn.dataset.label;
}

export function initLogin() {
  const form = document.getElementById('login-form');
  if (!form) return;
  const btn = form.querySelector('[type=submit]');
  btn.dataset.label = btn.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError('login-form');
    const email = form.querySelector('[name=email]').value.trim();
    const password = form.querySelector('[name=password]').value;
    setLoading(btn, true);
    try {
      const data = await api.auth.login(email, password);
      TokenStore.set(data.access_token, data.refresh_token);
      const redirect = new URLSearchParams(window.location.search).get('redirect');
      window.location.href = redirect || '/dashboard.html';
    } catch (err) {
      setLoading(btn, false);
      const msg = err instanceof ApiError && err.status === 401
        ? 'Invalid email or password'
        : 'Service unavailable. Please try again.';
      showError('login-form', msg);
    }
  });
}

export function initRegister() {
  const form = document.getElementById('register-form');
  if (!form) return;
  const btn = form.querySelector('[type=submit]');
  btn.dataset.label = btn.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError('register-form');

    const full_name = form.querySelector('[name=full_name]').value.trim();
    const email = form.querySelector('[name=email]').value.trim();
    const password = form.querySelector('[name=password]').value;
    const confirm = form.querySelector('[name=confirm_password]').value;

    if (password !== confirm) {
      showError('register-form', 'Passwords do not match');
      return;
    }
    if (password.length < 8) {
      showError('register-form', 'Password must be at least 8 characters');
      return;
    }

    setLoading(btn, true);
    try {
      await api.auth.register({ full_name, email, password });
      const loginData = await api.auth.login(email, password);
      TokenStore.set(loginData.access_token, loginData.refresh_token);
      window.location.href = '/dashboard.html?welcome=1';
    } catch (err) {
      setLoading(btn, false);
      const msg = err instanceof ApiError && err.status === 400
        ? 'Email already registered'
        : err.message || 'Registration failed. Please try again.';
      showError('register-form', msg);
    }
  });
}
