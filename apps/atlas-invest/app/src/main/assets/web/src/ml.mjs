import { mean, ema, rsi, clamp, last } from './engine.mjs';

// Deterministic, regularized logistic model. No LLM; no remote personal data.
export function features(bars, at) {
  if (at < 59) return null;
  const w = bars.slice(0, at + 1), c = w.map(b => b.close), p = last(c);
  const ma21 = last(ema(c, 21)), ma55 = last(ema(c, 55));
  const vol = mean(w.slice(-21, -1).map(b => b.volume));
  const returns = c.slice(-20).map((x, i, a) => i ? Math.log(x / a[i - 1]) : 0);
  return [clamp((p / ma21 - 1) * 20, -3, 3), clamp((ma21 / ma55 - 1) * 20, -3, 3),
    (rsi(c) - 50) / 25, clamp((p / c.at(-6) - 1) * 20, -3, 3),
    clamp(vol > 0 ? last(w).volume / vol - 1 : 0, -2, 3),
    clamp(Math.sqrt(mean(returns.map(r => r * r))) * 40, 0, 3)];
}
function fit(samples) {
  const w = Array(7).fill(0);
  for (let epoch = 0; epoch < 130; epoch++) {
    const g = Array(7).fill(0);
    for (const s of samples) {
      const x = [1, ...s.x], p = 1 / (1 + Math.exp(-clamp(x.reduce((v, n, i) => v + n * w[i], 0), -25, 25)));
      x.forEach((n, i) => g[i] += (p - s.y) * n);
    }
    w.forEach((_, i) => w[i] -= .09 * (g[i] / samples.length + (i ? .04 * w[i] : 0)));
  }
  return w;
}
function predict(w, x) { return 1 / (1 + Math.exp(-clamp([1, ...x].reduce((v, n, i) => v + n * w[i], 0), -25, 25))); }
export function walkForwardModel(bars, { horizon = 5, costBps = 30 } = {}) {
  if (bars.length < 220) return { available: false, reason: 'Histórico mínimo da IA: 220 candles. O plano da fonte pode limitar a janela.' };
  if (![3, 5, 20].includes(horizon) || costBps < 0 || costBps > 1000) throw new Error('Parâmetros inválidos do modelo.');
  const rows = [];
  for (let i = 60; i < bars.length - horizon; i++) {
    const netReturn = bars[i + horizon].close / bars[i + 1].open - 1 - costBps / 10000;
    rows.push({ at: i, labelEnd: i + horizon, x: features(bars, i), y: netReturn > 0 ? 1 : 0 });
  }
  const firstTest = Math.max(150, Math.floor(bars.length * .65));
  const predictions = [];
  for (let t = firstTest; t < bars.length - horizon; t += horizon) {
    // All training labels end BEFORE the feature date under evaluation (embargo).
    const train = rows.filter(r => r.labelEnd < t);
    const test = rows.find(r => r.at === t);
    if (!test || train.length < 60) continue;
    predictions.push({ at: t, time: bars[t].time, trainEnd: last(train).labelEnd,
      p: predict(fit(train), test.x), y: test.y, baseline: mean(train.map(r => r.y)) });
  }
  const train = rows.filter(r => r.labelEnd < bars.length - 1);
  const brier = mean(predictions.map(r => (r.p - r.y) ** 2)), baselineBrier = mean(predictions.map(r => (r.baseline - r.y) ** 2));
  const score = predict(fit(train), features(bars, bars.length - 1)) * 100;
  return { available: true, score, horizon, samples: train.length, testSamples: predictions.length,
    brier, baselineBrier, evidence: predictions.length >= 30 && brier < baselineBrier * .95,
    predictions, description: 'Regressão logística com regularização e validação cronológica. Escore experimental, não calibrado como chance de lucro.' };
}
