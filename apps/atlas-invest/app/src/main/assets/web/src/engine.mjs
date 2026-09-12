export const VERSION = '0.1.0';
export const DAY = 86400000;
export const PROFILES = ['Conservador', 'Moderado', 'Arrojado'];
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
export const last = a => a.at(-1);
export const finite = x => typeof x === 'number' && Number.isFinite(x);
export const QUESTIONS = [
  ['goal', 'Qual é o objetivo principal?', ['Preservar meu dinheiro', 'Receber renda recorrente', 'Crescer no longo prazo', 'Especular com capital que posso perder']],
  ['horizon', 'Quando você pode precisar deste dinheiro?', ['Em até 6 meses', 'Entre 6 meses e 2 anos', 'Entre 2 e 5 anos', 'Depois de 5 anos']],
  ['reserve', 'Sua reserva cobre quantos meses de despesas?', ['Ainda não tenho reserva', 'Menos de 3 meses', 'De 3 a 6 meses', 'Mais de 6 meses']],
  ['debt', 'Como estão suas dívidas?', ['Dívidas caras ou em atraso', 'Parcelas comprometem boa parte da renda', 'Dívidas controladas', 'Sem dívidas relevantes']],
  ['income', 'Sua renda regular cobre as despesas?', ['Não cobre', 'Cobre, mas sem sobra', 'Sobra até 20% por mês', 'Sobra mais de 20% por mês']],
  ['wealth', 'Quanto do seu patrimônio será destinado a este capital?', ['Mais de 50%', 'De 25% a 50%', 'De 10% a 25%', 'Até 10%']],
  ['experience', 'Que experiência prática você tem?', ['Nunca investi', 'Poupança e renda fixa', 'Ações ou FIIs há pelo menos 1 ano', 'Trade ou cripto há pelo menos 2 anos']],
  ['frequency', 'Com que frequência você operou no último ano?', ['Nenhuma vez', 'Poucas vezes', 'Mensalmente', 'Semanalmente, com registro de resultados']],
  ['loss', 'Que queda neste capital você conseguiria suportar?', ['Até 2%', 'Até 5%', 'Até 10%', 'Até 20% ou mais']],
  ['reaction', 'Se o investimento cair 10%, como você agiria?', ['Preciso retirar o dinheiro', 'Venderia por desconforto', 'Reavaliaria a tese e os limites', 'Seguiria um plano de risco previamente definido']],
  ['knowledge', 'Qual frase descreve um stop corretamente?', ['Impede qualquer prejuízo', 'Garante a venda no preço exato', 'Pode executar pior em gaps ou baixa liquidez', 'Recupera automaticamente as perdas']],
  ['time', 'Quanto tempo diário você pode dedicar?', ['Menos de 15 minutos', '15 a 30 minutos', '30 a 60 minutos', 'Mais de 1 hora com atenção ao mercado']]
];

export function assessProfile(answers, now = Date.now()) {
  if (!answers || QUESTIONS.some(([id]) => !Number.isInteger(answers[id]) || answers[id] < 0 || answers[id] > 3))
    throw new Error('Responda todas as perguntas para concluir seu perfil.');
  const a = answers;
  const knowledge = a.knowledge === 2;
  const capacity = Math.min(a.reserve, a.debt, a.income, a.wealth);
  const score = (a.goal + a.horizon + a.experience + a.frequency + a.loss + a.reaction + a.time + (knowledge ? 3 : 0)) / 24;
  let level = score >= .76 ? 2 : score >= .4 ? 1 : 0;
  if (capacity < 2 || a.horizon === 0 || a.loss === 0 || !knowledge) level = 0;
  if (a.experience < 2) level = Math.min(level, 1);
  const reasons = [];
  if (a.reserve < 2) reasons.push('Formar reserva de emergência antes de expor capital a operações.');
  if (a.debt < 2) reasons.push('Rever dívidas e comprometimento da renda.');
  if (a.income < 2) reasons.push('Pouca folga mensal limita a capacidade de absorver perdas.');
  if (a.horizon === 0) reasons.push('Necessidade de liquidez em até seis meses.');
  if (!knowledge) reasons.push('Stop reduz a exposição, mas não garante o preço de saída.');
  if (a.experience < 2) reasons.push('Construir experiência na carteira simulada.');
  return { version: 1, answers: { ...a }, level, name: PROFILES[level], capacity,
    tradeAllowed: capacity >= 2 && a.horizon > 0 && knowledge && a.experience >= 2 && level > 0,
    dayAllowed: level === 2 && capacity === 3 && a.experience === 3 && a.frequency === 3 && a.time === 3,
    maxRiskPct: [.25, .5, 1][level], maxAssetPct: [5, 10, 15][level],
    maxPortfolioRiskPct: [.75, 1.5, 3][level], maxDailyLossPct: [.5, 1, 2][level],
    drawdownTolerancePct: [2, 5, 10, 20][a.loss], reasons, assessedAt: now };
}

export function sma(values, n) {
  return values.map((_, i) => i < n - 1 ? null : mean(values.slice(i - n + 1, i + 1)));
}
export function ema(values, n) {
  const out = Array(values.length).fill(null);
  if (values.length < n) return out;
  out[n - 1] = mean(values.slice(0, n));
  for (let i = n; i < values.length; i++) out[i] = values[i] * (2 / (n + 1)) + out[i - 1] * (1 - 2 / (n + 1));
  return out;
}
export function rsi(values, n = 14) {
  if (values.length <= n) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) { const d = values[i] - values[i - 1]; gain += Math.max(d, 0); loss += Math.max(-d, 0); }
  gain /= n; loss /= n;
  for (let i = n + 1; i < values.length; i++) { const d = values[i] - values[i - 1]; gain = (gain * (n - 1) + Math.max(d, 0)) / n; loss = (loss * (n - 1) + Math.max(-d, 0)) / n; }
  return gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}
export function atr(bars, n = 14) {
  if (bars.length <= n) return null;
  const tr = bars.slice(1).map((b, j) => Math.max(b.high - b.low, Math.abs(b.high - bars[j].close), Math.abs(b.low - bars[j].close)));
  let v = mean(tr.slice(0, n));
  for (let i = n; i < tr.length; i++) v = (v * (n - 1) + tr[i]) / n;
  return v;
}
export function macd(values) {
  const fast = ema(values, 12), slow = ema(values, 26);
  const line = values.map((_, i) => slow[i] === null ? null : fast[i] - slow[i]).filter(finite);
  const signal = last(ema(line, 9));
  return { line: last(line) ?? null, signal: signal ?? null, histogram: finite(signal) ? last(line) - signal : null };
}
export function pivots(bars, side = 3) {
  const highs = [], lows = [];
  for (let i = side; i < bars.length - side; i++) {
    const window = bars.slice(i - side, i + side + 1);
    if (window.every((b, j) => j === side || b.high < bars[i].high)) highs.push({ index: i, price: bars[i].high });
    if (window.every((b, j) => j === side || b.low > bars[i].low)) lows.push({ index: i, price: bars[i].low });
  }
  return { highs, lows };
}
export function trendLines(bars) {
  const p = pivots(bars);
  const line = (points, up) => {
    if (points.length < 2) return null;
    const [a, b] = points.slice(-2), slope = (b.price - a.price) / (b.index - a.index);
    if ((up && slope <= 0) || (!up && slope >= 0)) return null;
    const projected = a.price + slope * (bars.length - 1 - a.index);
    const respected = bars.slice(b.index + 1).every((c, i) => up ? c.close >= b.price + slope * (i + 1) : c.close <= b.price + slope * (i + 1));
    return { a, b, slope, projected, respected };
  };
  return { lta: line(p.lows, true), ltb: line(p.highs, false), pivots: p };
}
export function fibonacci(bars) {
  const recent = bars.slice(-80);
  if (recent.length < 10) return null;
  const hi = Math.max(...recent.map(b => b.high)), lo = Math.min(...recent.map(b => b.low));
  const hiIndex = recent.findLastIndex(b => b.high === hi), loIndex = recent.findLastIndex(b => b.low === lo);
  const up = hiIndex > loIndex, span = hi - lo;
  return { high: hi, low: lo, direction: up ? 'alta' : 'baixa', levels: [.236, .382, .5, .618, .786].map(ratio => ({ ratio, price: up ? hi - span * ratio : lo + span * ratio })) };
}
export function indicators(bars) {
  if (bars.length < 60) return null;
  const closes = bars.map(b => b.close), price = last(closes), ma21 = last(ema(closes, 21)), ma55 = last(ema(closes, 55));
  const center = mean(closes.slice(-20)), sd = Math.sqrt(mean(closes.slice(-20).map(c => (c - center) ** 2)));
  const prevVol = mean(bars.slice(-21, -1).map(b => b.volume));
  const recent = bars.slice(-20), support = Math.min(...recent.map(b => b.low)), resistance = Math.max(...recent.map(b => b.high));
  const changes = closes.slice(-30).map((c, i, a) => i ? Math.log(c / a[i - 1]) : null).filter(finite);
  const cmean = mean(changes);
  return { price, ma21, ma55, rsi: rsi(closes), atr: atr(bars), macd: macd(closes),
    bollinger: { upper: center + 2 * sd, middle: center, lower: center - 2 * sd },
    volumeRatio: prevVol > 0 ? last(bars).volume / prevVol : null,
    turnover: mean(bars.slice(-20).map(b => b.close * b.volume)), support, resistance,
    volatilityPerBar: Math.sqrt(mean(changes.map(c => (c - cmean) ** 2))) * 100,
    trend: price > ma21 && ma21 > ma55 ? 'Alta' : price < ma21 && ma21 < ma55 ? 'Baixa' : 'Lateral',
    fibonacci: fibonacci(bars), lines: trendLines(bars) };
}

export function validateBars(bars, now = Date.now()) {
  if (!Array.isArray(bars)) throw new Error('Histórico ausente.');
  let previous = 0;
  for (const b of bars) {
    if (!['time', 'open', 'high', 'low', 'close', 'volume'].every(k => finite(b[k]))) throw new Error('Histórico contém valores inválidos.');
    if (b.time <= previous || b.time > now + 60000) throw new Error('Histórico fora de ordem, duplicado ou com data futura.');
    if (b.open <= 0 || b.close <= 0 || b.low <= 0 || b.volume < 0 || b.high < Math.max(b.open, b.close, b.low) || b.low > Math.min(b.open, b.close)) throw new Error('Candle inconsistente.');
    previous = b.time;
  }
  return true;
}

export function quality(snapshot, mode, now = Date.now()) {
  const errors = [], warnings = [];
  if (!snapshot) return { valid: false, errors: ['Atualize a fonte para analisar este ativo.'], warnings };
  if (snapshot.demo) errors.push('Dados fictícios: apenas demonstração.');
  if (snapshot.referenceOnly) errors.push('Cotação de referência: não é preço para trade.');
  if (snapshot.error) errors.push(snapshot.error);
  try { validateBars(snapshot.bars, now); } catch (e) { errors.push(e.message); }
  if (!snapshot.bars || snapshot.bars.length < 90) errors.push('São necessários ao menos 90 candles válidos.');
  const maxAge = mode === 'day' ? 2 * 60000 : 4 * DAY;
  if (!finite(snapshot.quoteAt) || now - snapshot.quoteAt > maxAge || snapshot.quoteAt > now + 60000) errors.push('Cotação ausente, antiga ou com horário futuro.');
  const finalBar = snapshot.bars?.at(-1);
  if (!finalBar || now - (finalBar.closedAt ?? finalBar.time) > (mode === 'day' ? 6 * 60000 : 5 * DAY)) errors.push('Último candle está desatualizado.');
  if (mode === 'day' && (snapshot.interval !== '5m' || !snapshot.intradayVerified)) errors.push('Day trade exige candles de 5 minutos e atualização intradiária verificável.');
  if (mode !== 'day' && snapshot.interval !== '1d') errors.push('Este horizonte exige candles diários.');
  if (!snapshot.adjusted && snapshot.type !== 'crypto') warnings.push('Retornos sem ajuste integral de proventos; simulação não inclui renda distribuída.');
  if (snapshot.type !== 'crypto') warnings.push('Cotações da B3 podem ter atraso. Confirme o preço na corretora.');
  return { valid: errors.length === 0, errors, warnings };
}

export function positionSize({ capital, entry, stop, target, riskPct, assetPct, feeBps = 10, slippageBps = 5, fixedFee = 0, step = 1, cash = capital, remainingRisk = Infinity, existingNotional = 0 }) {
  const nums = [capital, entry, stop, target, riskPct, assetPct, feeBps, slippageBps, fixedFee, step, cash, existingNotional];
  if (nums.some(v => !finite(v)) || capital <= 0 || entry <= 0 || stop <= 0 || stop >= entry || target <= entry || riskPct <= 0 || riskPct > 1 || assetPct <= 0 || assetPct > 15 || step <= 0 || feeBps < 0 || slippageBps < 0 || fixedFee < 0 || cash <= 0 || existingNotional < 0) return null;
  if (!(remainingRisk > 0)) return null;
  const cost = (feeBps + slippageBps) / 10000;
  const lossUnit = entry - stop + (entry + stop) * cost;
  const budget = Math.min(capital * riskPct / 100, remainingRisk);
  const concentration = Math.max(0, capital * assetPct / 100 - existingNotional);
  const raw = Math.min((budget - 2 * fixedFee) / lossUnit, (Math.min(cash, concentration) - fixedFee) / (entry * (1 + cost)));
  const quantity = Math.max(0, Math.floor((raw + 1e-10) / step) * step);
  if (quantity <= 0) return null;
  const loss = quantity * lossUnit + 2 * fixedFee;
  const gain = quantity * (target - entry - (entry + target) * cost) - 2 * fixedFee;
  return { quantity, notional: quantity * entry, cashNeeded: quantity * entry * (1 + cost) + fixedFee,
    riskAmount: loss, riskPct: loss / capital * 100, estimatedGain: gain, rr: gain / loss,
    roundTripCost: quantity * (entry + target) * cost + 2 * fixedFee,
    entry, stop, target, feeBps, slippageBps, fixedFee };
}

export function analyze(snapshot, { profile, mode = 'swing', riskPct = .5, capital = 10000, macro = {}, model, backtest, now = Date.now(), feeBps = 10, slippageBps = 5, fixedFee = 0, cash = capital, openRisk = 0, existingNotional = 0, dailyPnl = 0 } = {}) {
  const q = quality(snapshot, mode, now), blockers = [...q.errors], cautions = [...q.warnings];
  const safeBars = (() => { try { validateBars(snapshot?.bars, now); return snapshot.bars; } catch { return []; } })();
  const i = indicators(safeBars), reasons = [];
  if (!profile) blockers.push('Conclua seu perfil de investidor.');
  else {
    if (profile.version !== 1 || now - profile.assessedAt > 365 * DAY || profile.assessedAt > now + 60000) blockers.push('Revise seu perfil; a avaliação está desatualizada.');
    if (!profile.tradeAllowed) blockers.push('Seu perfil prioriza reserva, liquidez e aprendizagem.');
    if (mode === 'day' && !profile.dayAllowed) blockers.push('Day trade incompatível com sua experiência, capacidade ou tempo disponível.');
    if (snapshot?.type === 'crypto' && profile.level < 2) blockers.push('Criptoativos exigem o perfil arrojado nesta versão.');
    if (dailyPnl <= -capital * profile.maxDailyLossPct / 100) blockers.push('Limite diário de perda atingido na simulação.');
  }
  let score = 0;
  const add = (points, message) => { score += points; reasons.push(message); };
  if (i) {
    if (i.trend === 'Alta') add(25, 'Preço acima das médias de 21 e 55 períodos; tendência de alta.');
    else cautions.push(`Tendência ${i.trend.toLowerCase()}; aguarde alinhamento de preço e médias.`);
    if (i.rsi >= 45 && i.rsi <= 68) add(15, `RSI ${i.rsi.toFixed(1)}: força sem leitura extrema.`);
    else cautions.push(`RSI ${i.rsi.toFixed(1)}: força fraca ou esticada.`);
    if (i.macd.histogram > 0) add(10, 'MACD acima da linha de sinal.');
    if (i.volumeRatio >= 1.1) add(15, 'Volume acima da média recente.');
    else cautions.push('Volume ainda não confirma a movimentação.');
    if (i.lines.lta?.respected) add(5, 'LTA sustentada por dois fundos confirmados.');
    const nearFib = i.fibonacci?.levels.some(l => Math.abs(l.price - i.price) <= .6 * i.atr);
    if (nearFib) add(5, 'Preço próximo de uma retração de Fibonacci; referência, sem garantia de reversão.');
    if (i.turnover < (mode === 'day' ? 100000 : 1000000)) blockers.push('Liquidez insuficiente para o filtro desta versão.');
    if (i.atr / i.price > .08) blockers.push('Volatilidade acima do limite de 8% por candle.');
    if (snapshot?.spreadBps > 40) blockers.push('Spread acima do limite de 40 pontos-base.');
  }
  if (model?.available && model.evidence && model.score > 55) add(10, 'Modelo local apresentou melhoria no Brier score fora do treino.');
  else cautions.push('IA experimental: sem evidência fora da amostra suficiente para reforçar o sinal.');
  if (backtest?.trades >= 20 && backtest.expectancy > 0 && backtest.netReturnPct > backtest.buyHoldPct) add(15, 'Estratégia superou comprar e manter nesta janela, após os custos informados.');
  else cautions.push('Backtest não comprovou vantagem nesta janela após custos.');
  if (!macro.selic || !macro.ipca) cautions.push('Contexto econômico incompleto; não assumido favorável.');
  if (macro.selic?.value >= 12 && snapshot?.type === 'fii') cautions.push('Juros nominais elevados: compare renda fixa e examine risco de crédito, vacância e renda do FII.');
  if (macro.eventRisk) { score -= 15; cautions.push('Notícia recente com tema econômico ou político sensível. Consulte a fonte antes de operar.'); }
  if (snapshot?.type === 'fii' && mode === 'day') blockers.push('FIIs não são elegíveis para day trade nesta versão.');
  if (mode === 'position') blockers.push('Longo prazo exige análise fundamentalista completa; o radar técnico serve apenas como triagem.');
  let plan = null;
  if (i && profile && finite(snapshot?.price) && snapshot.price > 0) {
    const entry = snapshot.price;
    if (Math.abs(entry - i.price) > 1.5 * i.atr) blockers.push('Preço atual se afastou do último candle; atualize a análise.');
    const stop = Math.min(entry - 2 * i.atr, i.support - .2 * i.atr);
    const target = entry + 2.5 * (entry - stop);
    plan = positionSize({ capital, entry, stop, target, riskPct: Math.min(riskPct, profile.maxRiskPct),
      assetPct: snapshot.type === 'crypto' ? Math.min(5, profile.maxAssetPct) : profile.maxAssetPct,
      step: snapshot.type === 'crypto' ? .00001 : 1, feeBps, slippageBps, fixedFee, cash,
      remainingRisk: capital * profile.maxPortfolioRiskPct / 100 - openRisk, existingNotional });
    if (!plan) blockers.push('Capital, concentração ou risco agregado não permitem nova posição.');
    else if (plan.rr < 1.8) blockers.push('Relação retorno/risco insuficiente após custos.');
  }
  score = Math.round(clamp(score, 0, 100));
  const evidence = backtest?.trades >= 20 && backtest.expectancy > 0 && backtest.netReturnPct > backtest.buyHoldPct && backtest.maxDrawdownPct <= (profile?.drawdownTolerancePct ?? 0);
  if (!evidence) blockers.push('Falta validação histórica suficiente ou compatível com sua tolerância a perdas.');
  const eligible = !blockers.length && score >= 70 && i?.trend === 'Alta';
  const status = snapshot?.demo ? 'Demonstração' : eligible ? 'Estudar entrada' : blockers.length ? 'Aguardar' : 'Observar';
  return { score, status, eligible, plan: blockers.length ? null : plan, illustrativePlan: plan, indicators: i,
    blockers: [...new Set(blockers)], cautions: [...new Set(cautions)], reasons, quality: q,
    disclaimer: 'Confluência não é probabilidade de lucro. Stop e alvo são cenários; perdas podem ultrapassar o valor estimado.' };
}
