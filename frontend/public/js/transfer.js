import { api, ApiError } from './api-client.js';
import { formatCurrency } from './main.js';
import { populateCurrencySelect } from './converter.js';

const IBAN_CURRENCIES = new Set(['EUR','GBP','CHF','SEK','NOK','DKK','PLN','CZK','HUF','BGN','RON','ISK']);

export function initTransferFlow() {
  const state = {
    currentStep: 1,
    quote: null,
    sendAmount: 1000,
    fromCurrency: 'USD',
    toCurrency: 'EUR',
    recipientName: '',
    recipientEmail: '',
    bankName: '',
    ibanOrRouting: '',
    accountNumber: '',
    accountType: 'checking',
    paymentMethod: 'bank',
    reference: generateRef(),
  };

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('from'))   state.fromCurrency = urlParams.get('from').toUpperCase();
  if (urlParams.get('to'))     state.toCurrency   = urlParams.get('to').toUpperCase();
  if (urlParams.get('amount')) state.sendAmount    = parseFloat(urlParams.get('amount'));

  populateCurrencySelect(document.getElementById('s1-send-currency'), state.fromCurrency);
  populateCurrencySelect(document.getElementById('s1-recv-currency'), state.toCurrency);

  const sendAmountInput = document.getElementById('s1-send-amount');
  if (sendAmountInput) sendAmountInput.value = state.sendAmount;

  updateStepIndicator(state.currentStep);

  const stepPanels = document.querySelectorAll('.step-panel');
  showStep(state.currentStep, stepPanels);

  let debounce;
  const onQuoteUpdate = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => fetchQuote(state), 350);
  };

  document.getElementById('s1-send-amount')?.addEventListener('input', () => {
    state.sendAmount = parseFloat(document.getElementById('s1-send-amount').value) || 0;
    onQuoteUpdate();
  });
  document.getElementById('s1-send-currency')?.addEventListener('change', () => {
    state.fromCurrency = document.getElementById('s1-send-currency').value;
    onQuoteUpdate();
  });
  document.getElementById('s1-recv-currency')?.addEventListener('change', () => {
    state.toCurrency = document.getElementById('s1-recv-currency').value;
    onQuoteUpdate();
  });
  document.getElementById('s1-swap')?.addEventListener('click', () => {
    [state.fromCurrency, state.toCurrency] = [state.toCurrency, state.fromCurrency];
    document.getElementById('s1-send-currency').value = state.fromCurrency;
    document.getElementById('s1-recv-currency').value = state.toCurrency;
    fetchQuote(state);
  });

  document.getElementById('s1-continue')?.addEventListener('click', () => {
    if (!state.quote || state.sendAmount <= 0) {
      showStepError('s1-error', 'Please enter a valid amount');
      return;
    }
    goToStep(2, state, stepPanels);
  });

  document.querySelectorAll('.step-back').forEach(btn => {
    btn.addEventListener('click', () => {
      goToStep(parseInt(btn.dataset.prev), state, stepPanels);
    });
  });

  document.getElementById('s2-continue')?.addEventListener('click', () => {
    if (!validateRecipient(state)) return;
    goToStep(3, state, stepPanels);
  });

  document.querySelectorAll('input[name=payment-method]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.paymentMethod = radio.value;
      document.getElementById('bank-instructions')?.classList.toggle('hidden', radio.value !== 'bank');
      document.getElementById('card-form')?.classList.toggle('hidden', radio.value !== 'card');
    });
  });

  document.getElementById('s3-continue')?.addEventListener('click', () => {
    goToStep(4, state, stepPanels);
    populateReview(state);
  });

  document.getElementById('confirm-transfer')?.addEventListener('click', () => submitTransfer(state));

  document.getElementById('pay-reference').textContent = state.reference;

  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.copy || btn.previousElementSibling?.textContent?.trim() || '');
      btn.innerHTML = '<i class="fa-solid fa-check"></i>';
      setTimeout(() => { btn.innerHTML = '<i class="fa-regular fa-copy"></i>'; }, 1500);
    });
  });

  fetchQuote(state);
}

async function fetchQuote(state) {
  if (!state.sendAmount || state.sendAmount <= 0) return;
  try {
    const q = await api.exchange.quote(state.fromCurrency, state.toCurrency, state.sendAmount);
    state.quote = q;
    document.getElementById('s1-recv-amount').value = parseFloat(q.recipient_gets).toFixed(2);
    const bar = document.getElementById('s1-summary-bar');
    if (bar) {
      document.getElementById('s1-send-val').textContent = formatCurrency(state.sendAmount, state.fromCurrency);
      document.getElementById('s1-recv-val').textContent = formatCurrency(q.recipient_gets, state.toCurrency);
      document.getElementById('s1-fee-val').textContent  = formatCurrency(q.fee, state.fromCurrency);
    }
  } catch (e) {
    console.error('Quote error:', e);
  }
}

function validateRecipient(state) {
  let valid = true;
  const name = document.getElementById('r-fullname')?.value.trim();
  if (!name) { markInvalid('r-fullname', 'Full name is required'); valid = false; }
  else { markValid('r-fullname'); state.recipientName = name; }

  state.recipientEmail = document.getElementById('r-email')?.value.trim() || '';
  state.bankName = document.getElementById('r-bank')?.value.trim() || '';

  if (IBAN_CURRENCIES.has(state.toCurrency)) {
    const iban = document.getElementById('r-iban')?.value.trim();
    if (!iban) { markInvalid('r-iban', 'IBAN is required'); valid = false; }
    else { markValid('r-iban'); state.ibanOrRouting = iban; }
  } else {
    const routing = document.getElementById('r-routing')?.value.trim();
    state.ibanOrRouting = routing || '';
    state.accountNumber = document.getElementById('r-account')?.value.trim() || '';
    state.accountType   = document.querySelector('input[name=accountType]:checked')?.value || 'checking';
  }
  return valid;
}

function markInvalid(id, msg) {
  const el = document.getElementById(id);
  if (el) el.classList.add('is-invalid');
  const err = document.getElementById(id + '-err');
  if (err) err.textContent = msg;
}
function markValid(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('is-invalid');
  const err = document.getElementById(id + '-err');
  if (err) err.textContent = '';
}

function populateReview(state) {
  const q = state.quote;
  if (!q) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('rv-send',     formatCurrency(state.sendAmount, state.fromCurrency));
  set('rv-fee',      formatCurrency(q.fee, state.fromCurrency));
  set('rv-rate',     `1 ${state.fromCurrency} = ${parseFloat(q.exchange_rate).toFixed(6)} ${state.toCurrency}`);
  set('rv-recv',     formatCurrency(q.recipient_gets, state.toCurrency));
  set('rv-delivery', 'Within 24 hours');
  set('rv-name',     state.recipientName);
  set('rv-bank',     state.bankName || '—');
  set('rv-account',  state.ibanOrRouting || state.accountNumber || '—');
  set('rv-ref',      state.reference);
  set('review-send-amount', formatCurrency(state.sendAmount, state.fromCurrency));
  set('review-recv-amount', formatCurrency(q.recipient_gets, state.toCurrency));
  set('review-from-currency', state.fromCurrency);
  set('review-to-currency',   state.toCurrency);
}

async function submitTransfer(state) {
  const agreed = document.getElementById('terms-agree')?.checked;
  if (!agreed) {
    document.getElementById('terms-error').textContent = 'Please accept the terms';
    return;
  }
  const btn = document.getElementById('confirm-transfer');
  btn.disabled = true;
  btn.textContent = 'Processing…';

  try {
    const transfer = await api.transfers.create({
      recipient_name: state.recipientName,
      recipient_email: state.recipientEmail || undefined,
      source_currency: state.fromCurrency,
      target_currency: state.toCurrency,
      source_amount: state.sendAmount,
    });

    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('is-active'));
    const success = document.getElementById('success-screen');
    if (success) {
      success.classList.remove('hidden');
      const refEl = document.getElementById('success-ref');
      if (refEl) refEl.textContent = transfer.reference;
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Confirm & send';
    const errEl = document.getElementById('terms-error');
    if (errEl) errEl.textContent = e.message || 'Transfer failed. Please try again.';
  }
}

function goToStep(n, state, panels) {
  state.currentStep = n;
  showStep(n, panels);
  updateStepIndicator(n);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showStep(n, panels) {
  panels.forEach((p, i) => p.classList.toggle('is-active', i + 1 === n));
}

function updateStepIndicator(current) {
  document.querySelectorAll('.step-dot').forEach(dot => {
    const n = parseInt(dot.dataset.step);
    dot.classList.remove('is-active', 'is-complete', 'is-upcoming');
    if (n < current) dot.classList.add('is-complete');
    else if (n === current) dot.classList.add('is-active');
    else dot.classList.add('is-upcoming');
  });
  const bar = document.getElementById('step-progress-bar');
  if (bar) bar.style.width = `${(current - 1) / 3 * 100}%`;
}

function showStepError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function generateRef() {
  return 'SW-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}
