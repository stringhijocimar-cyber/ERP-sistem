import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessProfile, QUESTIONS, ema, rsi, atr, macd, validateBars, positionSize, quality, analyze, finite, DAY } from '../app/src/main/assets/web/src/engine.mjs';
import { ASSETS } from '../app/src/main/assets/web/src/providers.mjs';
import { demoSnapshot } from '../app/src/main/assets/web/src/demo.mjs';
import { exitFill, backtest } from '../app/src/main/assets/web/src/backtest.mjs';
import { features, walkForwardModel } from '../app/src/main/assets/web/src/ml.mjs';
import { newWallet, openPaper, closePaper, walletRisk } from '../app/src/main/assets/web/src/paper.mjs';

const strong = Object.fromEntries(QUESTIONS.map(([key]) => [key, key === 'knowledge' ? 2 : 3]));
const p = assessProfile(strong);
const snapshot = demoSnapshot(ASSETS[0]);

test('Profile cannot complete with missing, fractional or out-of-range answers', () => {
  assert.throws(() => assessProfile({}));
  assert.throws(() => assessProfile({ ...strong, goal: 8 }));
  assert.throws(() => assessProfile({ ...strong, goal: .5 }));
});
test('Capacity veto overrides high willingness; wrong stop knowledge forbids trade', () => {
  assert.equal(p.level, 2); assert.equal(p.dayAllowed, true);
  for (const key of ['reserve', 'debt', 'income', 'wealth', 'horizon']) {
    const low = assessProfile({ ...strong, [key]: 0 }); assert.equal(low.level, 0); assert.equal(low.tradeAllowed, false);
  }
  assert.equal(assessProfile({ ...strong, knowledge: 1 }).tradeAllowed, false);
  assert.equal(assessProfile({ ...strong, time: 0 }).dayAllowed, false);
});
test('EMA seeds with SMA; RSI handles flat, rising and falling markets', () => {
  assert.deepEqual(ema([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
  assert.equal(rsi(Array(30).fill(50)), 50);
  assert.equal(rsi(Array.from({ length: 30 }, (_, i) => i + 1)), 100);
  assert.equal(rsi(Array.from({ length: 30 }, (_, i) => 50 - i)), 0);
  assert.equal(macd(Array(60).fill(20)).histogram, 0);
});
test('ATR includes overnight gaps, not only intrabar amplitude', () => {
  const b = Array.from({ length: 16 }, (_, i) => ({ high: 11, low: 9, close: 10, open: 10 }));
  b[15] = { high: 21, low: 19, close: 20, open: 20 };
  assert.ok(Math.abs(atr(b) - (2 * 13 + 11) / 14) < 1e-10);
});
test('Bad OHLC, duplicates, unsorted candles and future dates are rejected', () => {
  const good = snapshot.bars;
  assert.equal(validateBars(good), true);
  assert.throws(() => validateBars([...good, good.at(-1)]));
  assert.throws(() => validateBars([{ ...good[0], high: 0 }]));
  assert.throws(() => validateBars([{ ...good[0], time: Date.now() + DAY }]));
  assert.throws(() => validateBars([{ ...good[0], close: NaN }]));
});
test('No real entry from demo, stale data, missing profile or unverified intraday', () => {
  const opts = { profile: p, backtest: { trades: 50, expectancy: 4, netReturnPct: 12, buyHoldPct: 4, maxDrawdownPct: 2 } };
  assert.equal(analyze(snapshot, opts).eligible, false);
  assert.equal(analyze(snapshot, opts).plan, null);
  const live = { ...snapshot, demo: false, quoteAt: Date.now(), fetchedAt: Date.now() };
  assert.equal(analyze(live).eligible, false);
  assert.equal(quality({ ...live, quoteAt: Date.now() - 7 * DAY }, 'swing').valid, false);
  assert.equal(quality({ ...live, quoteAt: Date.now() + DAY }, 'swing').valid, false);
  assert.equal(quality({ ...live, interval: '5m', intradayVerified: false }, 'day').valid, false);
  assert.ok(analyze(live, { ...opts, profile: { ...p, assessedAt: Date.now() - 400 * DAY } }).blockers.some(x => x.includes('desatualizada')));
});
test('Sizing respects costs, capital, risk budget, concentration and fractional precision', () => {
  const base = { capital: 10000, entry: 100, stop: 95, target: 115, riskPct: .5, assetPct: 10, feeBps: 10, slippageBps: 5, fixedFee: 1 };
  const plan = positionSize(base);
  assert.ok(plan.cashNeeded <= 1000); assert.ok(plan.riskAmount <= 50); assert.ok(plan.quantity === Math.floor(plan.quantity));
  assert.ok(plan.rr < (115 - 100) / 5);
  assert.equal(positionSize({ ...base, stop: 100 }), null);
  assert.equal(positionSize({ ...base, stop: 101 }), null);
  assert.equal(positionSize({ ...base, riskPct: 2 }), null);
  assert.equal(positionSize({ ...base, remainingRisk: 0 }), null);
  assert.equal(positionSize({ ...base, existingNotional: 1000 }), null);
  const small = positionSize({ ...base, capital: 100, entry: 500000, stop: 480000, target: 550000, fixedFee: 0, step: .00001 });
  assert.ok(small === null || small.riskAmount <= .5);
});
test('Stop gaps and ambiguous candles fill conservatively', () => {
  assert.equal(exitFill({ open: 90, low: 88, high: 120 }, 95, 115).price, 90);
  assert.equal(exitFill({ open: 100, low: 94, high: 120 }, 95, 115).price, 95);
  assert.equal(exitFill({ open: 118, low: 116, high: 120 }, 95, 115).price, 115);
});
test('Walk-forward labels are strictly older than each test sample, and features ignore future bars', () => {
  const bars = snapshot.bars.slice(-330);
  const model = walkForwardModel(bars);
  assert.equal(model.available, true); assert.ok(model.testSamples > 0);
  for (const row of model.predictions) assert.ok(row.trainEnd < row.at);
  const modified = bars.map((b, i) => i > 200 ? { ...b, close: b.close * 5 } : b);
  assert.deepEqual(features(bars, 200), features(modified, 200));
  const a = model.predictions[0], b = walkForwardModel(bars.map((v, i) => i > a.at + 5 ? { ...v, close: v.close * 4 } : v)).predictions[0];
  assert.equal(a.p, b.p);
});
test('Backtest trades enter AFTER their signal; costs reduce net outcome', () => {
  const zero = backtest(snapshot.bars, { feeBps: 0, slippageBps: 0 });
  const cost = backtest(snapshot.bars, { feeBps: 30, slippageBps: 10 });
  assert.equal(zero.available, true); assert.ok(zero.trades > 0);
  for (const t of zero.records) assert.ok(t.entryTime > t.signalTime && t.exitTime >= t.entryTime);
  assert.ok(cost.buyHoldPct < zero.buyHoldPct);
  assert.ok(finite(cost.maxDrawdownPct));
});
test('Paper accounting: cash, fees, aggregate risk and realized losses are conserved', () => {
  const live = { ...snapshot, demo: false, price: 100, quoteAt: Date.now(), fetchedAt: Date.now() };
  const plan = positionSize({ capital: 10000, entry: 100, stop: 95, target: 115, riskPct: .5, assetPct: 10 });
  const opened = openPaper(newWallet(), live, { eligible: true, plan });
  assert.equal(opened.positions.length, 1);
  assert.ok(Math.abs(opened.cash + opened.positions[0].paid - 10000) < 1e-9);
  assert.equal(walletRisk(opened).openRisk, plan.riskAmount);
  assert.throws(() => openPaper(opened, live, { eligible: true, plan }));
  assert.throws(() => closePaper(opened, opened.positions[0].id, { ...live, demo: true }));
  assert.throws(() => closePaper(opened, opened.positions[0].id, { ...live, quoteAt: Date.now() - 900000 }));
  const closed = closePaper(opened, opened.positions[0].id, { ...live, price: 95 });
  assert.equal(closed.positions.length, 0);
  assert.ok(Math.abs(closed.cash - 10000 - closed.closed[0].pnl) < 1e-9);
  assert.ok(walletRisk(closed).dailyPnl < 0);
});
test('Daily loss, open risk and insufficient validation veto recommendations', () => {
  const live = { ...snapshot, demo: false, quoteAt: Date.now() };
  assert.ok(analyze(live, { profile: p, dailyPnl: -500 }).blockers.some(x => x.includes('Limite diário')));
  assert.ok(analyze(live, { profile: p, openRisk: 9999 }).blockers.some(x => x.includes('risco agregado')));
  assert.ok(analyze(live, { profile: p }).blockers.some(x => x.includes('validação histórica')));
});
