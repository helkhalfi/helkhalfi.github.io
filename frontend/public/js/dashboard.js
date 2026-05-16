import { api } from './api-client.js';
import { formatCurrency, formatDate } from './main.js';

const STATUS_CLASS = {
  pending:    'badge--pending',
  processing: 'badge--processing',
  completed:  'badge--completed',
  failed:     'badge--failed',
  cancelled:  'badge--cancelled',
};

export async function initDashboard() {
  const welcome = new URLSearchParams(window.location.search).get('welcome');
  if (welcome) {
    const banner = document.getElementById('welcome-banner');
    if (banner) banner.classList.remove('hidden');
  }

  await Promise.all([loadAccounts(), loadTransfers()]);
}

async function loadAccounts() {
  try {
    const accounts = await api.accounts.list();
    const container = document.getElementById('balance-cards');
    if (!container) return;
    container.innerHTML = '';
    accounts.forEach((acc, i) => {
      const card = document.createElement('div');
      card.className = `balance-card${i === 0 ? ' balance-card--primary' : ''}`;
      card.innerHTML = `
        <div class="balance-card__currency">${acc.currency}</div>
        <div class="balance-card__amount">${formatCurrency(acc.balance, acc.currency)}</div>
        <div class="balance-card__label">${acc.is_primary ? 'Primary account' : 'Account'}</div>
      `;
      container.appendChild(card);
    });
  } catch (e) {
    console.error('Failed to load accounts:', e);
  }
}

async function loadTransfers() {
  try {
    const data = await api.transfers.list({ page_size: 10 });
    const tbody = document.getElementById('transfers-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!data.items.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:2rem">No transfers yet. <a href="/send.html">Send money →</a></td></tr>`;
      return;
    }

    data.items.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code style="font-size:0.8rem">${t.reference}</code></td>
        <td>${t.recipient_name}</td>
        <td>${formatCurrency(t.source_amount, t.source_currency)} → ${formatCurrency(t.target_amount, t.target_currency)}</td>
        <td><span class="badge ${STATUS_CLASS[t.status] || ''}">${t.status}</span></td>
        <td>${formatDate(t.created_at)}</td>
        <td><a href="/track.html?ref=${t.reference}" class="btn btn--ghost btn--sm">Track</a></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error('Failed to load transfers:', e);
  }
}
