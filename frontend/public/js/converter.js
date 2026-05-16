import { api } from './api-client.js';
import { formatCurrency } from './main.js';

const CURRENCIES = [
  'USD','EUR','GBP','JPY','CAD','AUD','CHF','SGD','HKD','NOK',
  'SEK','DKK','NZD','MXN','BRL','INR','PLN','CZK','HUF','ZAR',
  'TRY','THB','MYR','IDR','PHP','RON','BGN','ISK','ILS',
];

export function populateCurrencySelect(select, defaultValue) {
  CURRENCIES.forEach(code => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = code;
    if (code === defaultValue) opt.selected = true;
    select.appendChild(opt);
  });
}

export function bindConverter({ sendAmountId, sendCurrencyId, receiveCurrencyId, receiveAmountId,
  feeDisplayId, rateDisplayId, swapBtnId, variableFeeId, fixedFeeId, totalFeeId, rateDetailId,
  deliveryId, timestampId, sendCtaId } = {}) {

  const sendAmount   = document.getElementById(sendAmountId || 'send-amount');
  const sendCurrency = document.getElementById(sendCurrencyId || 'send-currency');
  const recvCurrency = document.getElementById(receiveCurrencyId || 'receive-currency');
  const recvAmount   = document.getElementById(receiveAmountId || 'receive-amount');
  const feeDisplay   = document.getElementById(feeDisplayId || 'fee-display');
  const rateDisplay  = document.getElementById(rateDisplayId || 'rate-display');
  const swapBtn      = document.getElementById(swapBtnId || 'swap-currencies');

  if (!sendAmount || !sendCurrency || !recvCurrency) return;

  populateCurrencySelect(sendCurrency, 'USD');
  populateCurrencySelect(recvCurrency, 'EUR');

  let debounceTimer;
  const update = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchQuote, 350);
  };

  sendAmount.addEventListener('input', update);
  sendCurrency.addEventListener('change', fetchQuote);
  recvCurrency.addEventListener('change', fetchQuote);
  swapBtn?.addEventListener('click', () => {
    const tmp = sendCurrency.value;
    sendCurrency.value = recvCurrency.value;
    recvCurrency.value = tmp;
    fetchQuote();
  });

  fetchQuote();

  async function fetchQuote() {
    const amount = parseFloat(sendAmount.value);
    const from = sendCurrency.value;
    const to = recvCurrency.value;

    if (!amount || amount <= 0) return;

    if (recvAmount) recvAmount.classList.add('skeleton');

    try {
      const q = await api.exchange.quote(from, to, amount);

      if (recvAmount) {
        recvAmount.classList.remove('skeleton');
        recvAmount.value = parseFloat(q.recipient_gets).toFixed(2);
      }
      if (feeDisplay) feeDisplay.textContent = formatCurrency(q.fee, from);
      if (rateDisplay) rateDisplay.textContent = `${parseFloat(q.exchange_rate).toFixed(6)}`;

      const vfEl = document.getElementById(variableFeeId || 'variable-fee-val');
      const ffEl = document.getElementById(fixedFeeId || 'fixed-fee-val');
      const tfEl = document.getElementById(totalFeeId || 'total-fee-val');
      const rdEl = document.getElementById(rateDetailId || 'rate-detail-val');
      const dvEl = document.getElementById(deliveryId || 'delivery-val');
      if (vfEl) vfEl.textContent = formatCurrency(q.fee * 0.7, from);
      if (ffEl) ffEl.textContent = formatCurrency(q.fee * 0.3, from);
      if (tfEl) tfEl.textContent = formatCurrency(q.fee, from);
      if (rdEl) rdEl.textContent = `1 ${from} = ${parseFloat(q.exchange_rate).toFixed(6)} ${to}`;
      const fastCurrencies = ['EUR','GBP','USD','CAD','AUD','NZD','CHF','SEK','NOK','DKK'];
      if (dvEl) dvEl.textContent = fastCurrencies.includes(to) ? 'Within minutes' : '1-2 business days';

      if (timestampId) {
        const tsEl = document.getElementById(timestampId);
        if (tsEl) tsEl.textContent = new Date().toLocaleTimeString();
      }

      if (sendCtaId) {
        const ctaEl = document.getElementById(sendCtaId);
        if (ctaEl) {
          const params = new URLSearchParams({ from, to, amount });
          ctaEl.href = `/send.html?${params}`;
        }
      }

      window.__lastQuote = q;
    } catch (e) {
      if (recvAmount) recvAmount.classList.remove('skeleton');
      console.error('Quote fetch failed:', e);
    }
  }

  return { fetchQuote };
}
