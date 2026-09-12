import { finite } from './engine.mjs';

export const newWallet = () => ({ version: 1, initialCapital: 10000, cash: 10000, positions: [], closed: [] });
export function validWallet(w) {
  return w?.version === 1 && finite(w.initialCapital) && w.initialCapital > 0 && finite(w.cash) && w.cash >= 0 &&
    Array.isArray(w.positions) && Array.isArray(w.closed) && [...w.positions, ...w.closed].every(p =>
      typeof p.symbol === 'string' && finite(p.quantity) && p.quantity > 0 && finite(p.entry) && p.entry > 0 && finite(p.paid) && p.paid > 0 && finite(p.stop) && p.stop > 0 && p.stop < p.entry);
}
export function openPaper(wallet, snapshot, analysis, now = Date.now()) {
  if (!validWallet(wallet)) throw new Error('Carteira inválida.');
  if (!analysis.eligible || !analysis.plan || snapshot.demo || snapshot.referenceOnly) throw new Error('A análise não permite simular uma nova entrada.');
  if (!finite(snapshot.fetchedAt) || !finite(snapshot.quoteAt) || Math.abs(now - snapshot.fetchedAt) > 2 * 60000 || now - snapshot.quoteAt > 2 * 60000 || snapshot.quoteAt > now + 60000) throw new Error('Atualize uma cotação de até dois minutos antes de simular.');
  if (wallet.positions.some(p => p.symbol === snapshot.symbol)) throw new Error('Você já tem uma posição simulada neste ativo.');
  const p = analysis.plan;
  if (!(p.cashNeeded > 0) || p.cashNeeded > wallet.cash) throw new Error('Saldo simulado insuficiente.');
  const pos = { id: `${now}-${snapshot.symbol}`, symbol: snapshot.symbol, name: snapshot.name, type: snapshot.type,
    quantity: p.quantity, entry: p.entry, stop: p.stop, target: p.target, paid: p.cashNeeded,
    riskAmount: p.riskAmount, feeBps: p.feeBps, slippageBps: p.slippageBps, fixedFee: p.fixedFee,
    openedAt: now, quoteAt: snapshot.quoteAt, source: snapshot.source, mode: snapshot.interval === '5m' ? 'day' : 'swing' };
  return { ...wallet, cash: wallet.cash - p.cashNeeded, positions: [...wallet.positions, pos] };
}
export function closePaper(wallet, id, snapshot, now = Date.now()) {
  if (!validWallet(wallet)) throw new Error('Carteira inválida.');
  const p = wallet.positions.find(p => p.id === id);
  if (!p || !snapshot || snapshot.symbol !== p.symbol || snapshot.demo || snapshot.referenceOnly || !finite(snapshot.price) || snapshot.price <= 0 ||
      !finite(snapshot.fetchedAt) || now - snapshot.fetchedAt > 2 * 60000 || snapshot.fetchedAt > now + 60000 ||
      !finite(snapshot.quoteAt) || now - snapshot.quoteAt > 2 * 60000 || snapshot.quoteAt > now + 60000) throw new Error('Atualize uma cotação recente e real antes de encerrar a simulação.');
  const cost = (p.feeBps + p.slippageBps) / 10000;
  const received = p.quantity * snapshot.price * (1 - cost) - p.fixedFee;
  return { ...wallet, cash: wallet.cash + received, positions: wallet.positions.filter(x => x.id !== id),
    closed: [...wallet.closed, { ...p, closedAt: now, exit: snapshot.price, received, pnl: received - p.paid }] };
}
export function walletRisk(wallet, now = Date.now()) {
  const date = new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return { openRisk: wallet.positions.reduce((s, p) => s + p.riskAmount, 0),
    dailyPnl: wallet.closed.filter(p => new Date(p.closedAt).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) === date).reduce((s, p) => s + Math.min(0, p.pnl), 0) };
}
