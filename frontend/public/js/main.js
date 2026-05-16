import { api, TokenStore, ApiError } from './api-client.js';

export function formatCurrency(amount, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function requireAuth() {
  const token = TokenStore.getAccess();
  if (!token) {
    const redirect = encodeURIComponent(window.location.pathname);
    window.location.href = `/login.html?redirect=${redirect}`;
    return false;
  }
  return true;
}

export async function initNav() {
  const token = TokenStore.getAccess();
  const navAnon = document.getElementById('nav-anon');
  const navUser = document.getElementById('nav-user');

  if (!token) {
    if (navAnon) navAnon.classList.remove('hidden');
    if (navUser) navUser.classList.add('hidden');
    setupMobileNav();
    highlightCurrentPage();
    return;
  }

  try {
    const user = await api.auth.me();
    if (navAnon) navAnon.classList.add('hidden');
    if (navUser) navUser.classList.remove('hidden');

    const initials = user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const avatarEl = document.getElementById('nav-avatar-initials');
    if (avatarEl) avatarEl.textContent = initials;

    const nameEl = document.getElementById('nav-dropdown-name');
    const emailEl = document.getElementById('nav-dropdown-email');
    if (nameEl) nameEl.textContent = user.full_name;
    if (emailEl) emailEl.textContent = user.email;

    try {
      const accounts = await api.accounts.list();
      const primary = accounts.find(a => a.is_primary) || accounts[0];
      if (primary) {
        const balEl = document.getElementById('nav-balance-amount');
        if (balEl) balEl.textContent = formatCurrency(primary.balance, primary.currency);
      }
    } catch { /* ignore */ }
  } catch {
    if (navAnon) navAnon.classList.remove('hidden');
    if (navUser) navUser.classList.add('hidden');
  }

  const avatarBtn = document.getElementById('nav-avatar-btn');
  const dropdown = document.getElementById('nav-dropdown');
  avatarBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const hidden = dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden', !hidden);
    avatarBtn.setAttribute('aria-expanded', String(hidden));
  });
  document.addEventListener('click', () => {
    dropdown?.classList.add('hidden');
    avatarBtn?.setAttribute('aria-expanded', 'false');
  });

  document.getElementById('nav-logout')?.addEventListener('click', async () => {
    try { await api.auth.logout(); } catch { /* ignore */ }
    TokenStore.clear();
    window.location.href = '/login.html';
  });

  setupMobileNav();
  highlightCurrentPage();
}

function setupMobileNav() {
  const hamburger = document.getElementById('nav-hamburger');
  const mobileMenu = document.getElementById('nav-mobile-menu');
  hamburger?.addEventListener('click', function () {
    const expanded = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', String(!expanded));
    mobileMenu?.classList.toggle('hidden', expanded);
    document.body.classList.toggle('nav-open', !expanded);
  });
}

function highlightCurrentPage() {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__link, .nav__mobile-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === current || (current === '' && href === 'index.html')) {
      link.classList.add('nav__link--active');
      link.setAttribute('aria-current', 'page');
    }
  });
}

export { api, TokenStore, ApiError };
