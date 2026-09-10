import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBrapi, parseCrypto, bcbPoint, parseNews, ASSETS, loadAsset, loadMacro } from '../app/src/main/assets/web/src/providers.mjs';
import { DAY } from '../app/src/main/assets/web/src/engine.mjs';
const now = Date.UTC(2026, 8, 10, 15);
test('brapi v2 data wrapper, sorting and adjusted OHLC preserve the price scale', () => {
  const q = { results: [{ symbol: 'PETR4', data: { regularMarketPrice: 20, regularMarketTime: now, regularMarketChangePercent: 1 } }] };
  const h = { results: [{ symbol: 'PETR4', data: { usedInterval: '1d', historicalDataPrice: [
    { date: (now - 2 * DAY) / 1000, open: 38, high: 42, low: 36, close: 40, adjustedClose: 20, volume: 1000 },
    { date: (now - 3 * DAY) / 1000, open: 36, high: 40, low: 34, close: 38, adjustedClose: 19, volume: 1000 }
  ] } }] };
  const s = parseBrapi(ASSETS[0], q, h, '1d', now);
  assert.equal(s.bars[0].close, 19); assert.equal(s.bars[1].open, 19); assert.equal(s.bars[1].high, 21);
  assert.equal(s.adjusted, true); assert.equal(s.intradayVerified, false);
  assert.throws(() => parseBrapi(ASSETS[0], q, h, '5m', now));
});
test('Crypto drops unfinished candle and rejects crossed spread', () => {
  const a = ASSETS.find(a => a.symbol === 'BTCBRL');
  const k = [[now - 600000, '100', '110', '90', '105', '20', now - 300001], [now - 300000, '105', '108', '102', '104', '20', now + 1]];
  const q = { symbol: 'BTCBRL', lastPrice: '105', closeTime: now, priceChangePercent: '2' };
  const b = { symbol: 'BTCBRL', bidPrice: '104', askPrice: '105' };
  const s = parseCrypto(a, k, q, b, '5m', now);
  assert.equal(s.bars.length, 1); assert.equal(s.currency, 'BRL');
  assert.throws(() => parseCrypto(a, k, q, { ...b, bidPrice: '110' }, '5m', now));
});
test('BCB future dates, impossible dates and bad numbers never become current macro', () => {
  assert.equal(bcbPoint({ data: '10/09/2026', valor: '12.5' }, now).value, 12.5);
  assert.throws(() => bcbPoint({ data: '16/09/2026', valor: '14' }, now));
  assert.throws(() => bcbPoint({ data: '31/02/2026', valor: '14' }, now));
  assert.throws(() => bcbPoint({ data: '10/09/2026', valor: 'NaN' }, now));
});
test('News only includes recent HTTPS sources; no unsafe links or future dates', () => {
  const make = (url, seendate) => ({ url, seendate, title: 'Inflação e política fiscal' });
  const news = parseNews({ articles: [make('https://example.com/story', '20260910T140000Z'), make('javascript:alert(1)', '20260910T140000Z'), make('https://example.com/future', '20260916T140000Z')] }, now);
  assert.equal(news.length, 1); assert.equal(news[0].sensitive, true);
});
test('No token: paid asset does not issue a request or silently return demo data', async () => {
  let called = false;
  await assert.rejects(() => loadAsset(ASSETS.find(a => a.symbol === 'BOVA11'), 'swing', '', async () => { called = true; }), /token/);
  assert.equal(called, false);
});
test('Provider outages remain explicit, with no synthetic financial fallback', async () => {
  const m = await loadMacro(async () => { throw new Error('offline'); });
  assert.equal(m.selic, undefined); assert.equal(m.news.length, 0); assert.ok(m.errors.length >= 3);
});
