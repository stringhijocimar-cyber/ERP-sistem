import { indicators, last, mean, validateBars, clamp } from './engine.mjs';

export function exitFill(bar, stop, target) {
  if (bar.open <= stop) return { price: bar.open, why: 'Gap abaixo do stop' };
  if (bar.low <= stop) return { price: stop, why: 'Stop (prioridade se alvo também tocado)' };
  if (bar.high >= target) return { price: target, why: 'Alvo' };
  return null;
}
// Fixed strategy evaluated on the final chronological 35%, never tuned on this test window.
export function backtest(bars, { horizon = 10, feeBps = 10, slippageBps = 5, fixedFee = 0, capital = 10000, riskPct = .5, assetPct = 10, step = 1 } = {}) {
  validateBars(bars);
  if (bars.length < 120) return { available: false, trades: 0, reason: 'Backtest exige ao menos 120 candles.' };
  if (![horizon, feeBps, slippageBps, fixedFee, capital, riskPct, assetPct, step].every(Number.isFinite) || horizon < 1 || feeBps < 0 || slippageBps < 0 || fixedFee < 0 || capital <= 0 || riskPct <= 0 || riskPct > 1 || assetPct <= 0 || assetPct > 15 || step <= 0) throw new Error('Custos ou parâmetros de simulação inválidos.');
  const start = Math.max(60, Math.floor(bars.length * .65));
  const trades = [], curve = [{ time: bars[start].time, equity: capital }];
  let cash = capital, pos = null, peak = capital, dd = 0;
  const slip = slippageBps / 10000, fee = feeBps / 10000;
  for (let t = start + 1; t < bars.length; t++) {
    if (!pos) {
      const signal = indicators(bars.slice(0, t));
      if (signal?.trend === 'Alta' && signal.rsi >= 45 && signal.rsi <= 68 && signal.macd.histogram > 0 && signal.volumeRatio >= 1.1) {
        const entry = bars[t].open * (1 + slip), stop = entry - 2 * signal.atr, target = entry + 4 * signal.atr;
        const costUnit = entry - stop + (entry + stop) * fee + stop * slip;
        const qty = Math.floor(Math.max(0, Math.min((cash * riskPct / 100 - 2 * fixedFee) / costUnit,
          (cash * assetPct / 100 - fixedFee) / (entry * (1 + fee)))) / step) * step;
        if (qty > 0 && stop > 0) {
          const paid = qty * entry * (1 + fee) + fixedFee;
          cash -= paid; pos = { entry, stop, target, qty, paid, opened: t, signalAt: t - 1 };
        }
      }
    }
    if (pos) {
      let exit = exitFill(bars[t], pos.stop, pos.target);
      if (!exit && (t - pos.opened >= horizon || t === bars.length - 1)) exit = { price: bars[t].close, why: 'Prazo ou fim da janela' };
      if (exit) {
        const received = pos.qty * exit.price * (1 - slip) * (1 - fee) - fixedFee;
        cash += received;
        trades.push({ ...pos, closed: t, signalTime: bars[pos.signalAt].time, entryTime: bars[pos.opened].time,
          exitTime: bars[t].time, exitPrice: exit.price * (1 - slip), pnl: received - pos.paid, why: exit.why });
        pos = null;
      }
    }
    const equity = cash + (pos ? pos.qty * bars[t].close * (1 - slip) * (1 - fee) - fixedFee : 0);
    peak = Math.max(peak, equity); dd = Math.max(dd, (peak - equity) / peak * 100);
    curve.push({ time: bars[t].time, equity });
  }
  const wins = trades.filter(t => t.pnl > 0), losses = trades.filter(t => t.pnl < 0);
  const first = bars[start + 1], final = last(bars);
  const bhQty = Math.floor(Math.max(0, (capital - fixedFee) / (first.open * (1 + slip) * (1 + fee))) / step) * step;
  const bhCost = bhQty ? bhQty * first.open * (1 + slip) * (1 + fee) + fixedFee : 0;
  const bhEnd = capital - bhCost + (bhQty ? bhQty * final.close * (1 - slip) * (1 - fee) - fixedFee : 0);
  // Passive benchmark uses 100% allocation, unlike the risk-capped strategy. Explicit in UI/docs.
  return { available: true, trades: trades.length, records: trades, curve, from: first.time, to: final.time,
    netReturnPct: (cash / capital - 1) * 100, netPnl: cash - capital, buyHoldPct: (bhEnd / capital - 1) * 100,
    maxDrawdownPct: dd, winRate: trades.length ? wins.length / trades.length * 100 : null,
    expectancy: trades.length ? mean(trades.map(t => t.pnl)) : 0,
    profitFactor: losses.length ? wins.reduce((s, t) => s + t.pnl, 0) / -losses.reduce((s, t) => s + t.pnl, 0) : null,
    note: 'Janela final de 35%; sinal no fechamento anterior, entrada na abertura seguinte. Stop tem prioridade em candle ambíguo. Comprar e manter usa 100% do capital; estratégia usa limite por ativo. Sem tributos ou proventos.' };
}
