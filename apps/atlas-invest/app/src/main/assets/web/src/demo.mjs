import { ASSETS } from './providers.mjs';
import { DAY } from './engine.mjs';

// Synthetic fixtures are OPT-IN. Never used when a live request fails.
export function demoSnapshot(asset, mode = 'swing') {
  let seed = [...asset.symbol].reduce((s, c) => s + c.charCodeAt(0), 97);
  const random = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
  let price = { PETR4: 31, VALE3: 57, ITUB4: 32, MGLU3: 8, HGLG11: 151, MXRF11: 10, KNRI11: 140, BOVA11: 110, IVVB11: 330, BTCBRL: 370000, ETHBRL: 15000, SOLBRL: 700, USDBRL: 5.2 }[asset.symbol] ?? 45;
  const n = 700, span = mode === 'day' ? 300000 : DAY;
  const end = Math.floor(Date.now() / span) * span - span;
  const bars = [];
  for (let k = 0; k < n; k++) {
    const open = price * (1 + (random() - .5) * .005);
    const change = (random() - .46) * .035 + Math.sin(k / 18) * .003;
    const close = open * (1 + change);
    bars.push({ time: end - (n - 1 - k) * span, closedAt: end - (n - 1 - k) * span + span - 1,
      open, close, high: Math.max(open, close) * (1 + random() * .012), low: Math.min(open, close) * (1 - random() * .012),
      volume: (asset.type === 'crypto' ? 350 : 2800000) * (.6 + random()) });
    price = close;
  }
  return { ...asset, demo: true, currency: 'BRL', bars, price, interval: mode === 'day' ? '5m' : '1d',
    quoteAt: end, fetchedAt: Date.now(), adjusted: false, intradayVerified: false,
    source: 'Série fictícia • sem valor de investimento', sourceUrl: '',
    changePct: (bars.at(-1).close / bars.at(-2).close - 1) * 100,
    ...(asset.type === 'fx' ? { referenceOnly: true } : {}) };
}
export function demoMarket(mode) { return Object.fromEntries(ASSETS.map(a => [a.symbol, demoSnapshot(a, mode)])); }
