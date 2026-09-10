import { DAY, finite, validateBars } from './engine.mjs';

export const ASSETS = [
  { symbol: 'PETR4', name: 'Petrobras', type: 'stock', sector: 'Petróleo e gás', color: '#74d6a4', free: true },
  { symbol: 'VALE3', name: 'Vale', type: 'stock', sector: 'Mineração', color: '#efce71', free: true },
  { symbol: 'ITUB4', name: 'Itaú Unibanco', type: 'stock', sector: 'Bancos', color: '#ffaf70', free: true },
  { symbol: 'MGLU3', name: 'Magazine Luiza', type: 'stock', sector: 'Varejo', color: '#78b6ff', free: true },
  { symbol: 'HGLG11', name: 'Pátria Log', type: 'fii', sector: 'Logística', color: '#b0a2ff' },
  { symbol: 'MXRF11', name: 'Maxi Renda', type: 'fii', sector: 'Crédito imobiliário', color: '#df9bdf' },
  { symbol: 'KNRI11', name: 'Kinea Renda', type: 'fii', sector: 'Imóveis', color: '#a8c6ff' },
  { symbol: 'BOVA11', name: 'ETF Ibovespa', type: 'etf', sector: 'Índice de ações', color: '#65d3c5' },
  { symbol: 'IVVB11', name: 'ETF S&P 500', type: 'etf', sector: 'Exposição internacional', color: '#82a9ec' },
  { symbol: 'BTCBRL', name: 'Bitcoin', type: 'crypto', sector: 'Cripto • par em reais', color: '#f2b35c', free: true },
  { symbol: 'ETHBRL', name: 'Ethereum', type: 'crypto', sector: 'Cripto • par em reais', color: '#9dafff', free: true },
  { symbol: 'SOLBRL', name: 'Solana', type: 'crypto', sector: 'Cripto • par em reais', color: '#92ddc6', free: true },
  { symbol: 'USDBRL', name: 'Dólar / Real', type: 'fx', sector: 'Câmbio de referência BCB', color: '#a7bbd8', free: true }
];
let seq = 0;
const pending = new Map();
if (typeof window !== 'undefined') window.__atlasReply = (id, data) => {
  const p = pending.get(id); if (!p) return; pending.delete(id); clearTimeout(p.timer);
  if (data.error) p.reject(new Error(data.error));
  else { try { p.resolve(JSON.parse(data.body)); } catch { p.reject(new Error('Resposta inválida da fonte.')); } }
};
export async function requestJson(url, token = '') {
  if (globalThis.AtlasNative) return new Promise((resolve, reject) => {
    const id = `r${++seq}`;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('A fonte excedeu o tempo de resposta.')); }, 30000);
    pending.set(id, { resolve, reject, timer });
    globalThis.AtlasNative.request(id, url, token);
  });
  const response = await fetch(url, { headers: { Accept: 'application/json', ...(token && new URL(url).hostname === 'brapi.dev' ? { Authorization: `Bearer ${token}` } : {}) }, signal: AbortSignal.timeout(20000), credentials: 'omit', redirect: 'error', cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 429 ? 'Limite da fonte atingido. Aguarde antes de atualizar.' : `HTTP ${response.status}: verifique disponibilidade e plano da fonte.`);
  const text = await response.text();
  if (text.length > 3000000) throw new Error('Resposta muito grande.');
  return JSON.parse(text);
}
export const timestamp = x => typeof x === 'number' ? (x < 1e11 ? x * 1000 : x) : Date.parse(x);
export function bcbPoint(p, now = Date.now()) {
  if (!p || typeof p.data !== 'string' || !/^\d{2}\/\d{2}\/\d{4}$/.test(p.data)) throw new Error('Data econômica inválida.');
  const [d, m, y] = p.data.split('/').map(Number), at = Date.UTC(y, m - 1, d);
  const dt = new Date(at);
  if (dt.getUTCDate() !== d || dt.getUTCMonth() !== m - 1 || !Number.isFinite(at) || at > now + 60000) throw new Error('Fonte retornou data futura ou inválida.');
  const value = Number(p.valor);
  if (!Number.isFinite(value)) throw new Error('Indicador econômico inválido.');
  return { value, at, date: p.data, source: 'Banco Central do Brasil' };
}
export function parseBrapi(asset, quoteData, historical, interval, now = Date.now()) {
  const record = quoteData.results?.find(q => q.symbol === asset.symbol);
  const q = record?.data ?? record;
  const hr = historical.results?.find(h => h.symbol === asset.symbol), h = hr?.data ?? hr;
  if (!q || !h || !Array.isArray(h.historicalDataPrice)) throw new Error('A fonte não devolveu histórico para este ativo.');
  if (h.usedInterval && h.usedInterval !== interval) throw new Error('O plano retornou um intervalo diferente do solicitado.');
  const dayKey = time => new Date(time).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const input = h.historicalDataPrice.filter(b => interval === '5m' ? timestamp(b.date) + 300000 <= now : dayKey(timestamp(b.date)) !== dayKey(now));
  const adjusted = interval === '1d' && input.length > 0 && input.every(b => finite(b.adjustedClose) && b.adjustedClose > 0);
  const bars = input.map(b => {
    const factor = adjusted ? b.adjustedClose / b.close : 1;
    return { time: timestamp(b.date), closedAt: timestamp(b.date) + (interval === '5m' ? 300000 : 0),
      open: Number(b.open) * factor, high: Number(b.high) * factor, low: Number(b.low) * factor,
      close: Number(b.close) * factor, volume: Number(b.volume) };
  }).sort((a, b) => a.time - b.time);
  validateBars(bars, now);
  const price = Number(q.regularMarketPrice), quoteAt = timestamp(q.regularMarketTime);
  if (!(price > 0) || !Number.isFinite(quoteAt)) throw new Error('Cotação ou horário ausente.');
  return { ...asset, currency: 'BRL', price, changePct: Number(q.regularMarketChangePercent), quoteAt,
    fetchedAt: now, bars, interval, adjusted, intradayVerified: false, demo: false,
    source: 'brapi • B3', sourceUrl: 'https://brapi.dev/docs/acoes',
    fundamental: { pe: finite(q.priceEarnings) ? q.priceEarnings : null, marketCap: q.marketCap ?? null } };
}
export function parseCrypto(asset, klines, ticker, book, interval, now = Date.now()) {
  if (!Array.isArray(klines) || ticker.symbol !== asset.symbol || book.symbol !== asset.symbol) throw new Error('Resposta de criptoativo inconsistente.');
  const bars = klines.filter(k => Number(k[6]) < now).map(k => ({ time: Number(k[0]), closedAt: Number(k[6]),
    open: Number(k[1]), high: Number(k[2]), low: Number(k[3]), close: Number(k[4]), volume: Number(k[5]) }));
  validateBars(bars, now);
  const price = Number(ticker.lastPrice), bid = Number(book.bidPrice), ask = Number(book.askPrice);
  if (!(price > 0 && bid > 0 && ask >= bid)) throw new Error('Preço ou spread inválido.');
  return { ...asset, price, currency: 'BRL', changePct: Number(ticker.priceChangePercent),
    quoteAt: Number(ticker.closeTime), fetchedAt: now, bars, interval, adjusted: true,
    intradayVerified: true, spreadBps: (ask - bid) / ((ask + bid) / 2) * 10000,
    source: 'Binance • mercado público BRL', sourceUrl: 'https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints', demo: false };
}
export async function loadAsset(asset, mode = 'swing', token = '', transport = requestJson) {
  const now = Date.now(), interval = mode === 'day' ? '5m' : '1d';
  if (asset.type === 'fx') {
    const points = await transport('https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/260?formato=json');
    if (!Array.isArray(points) || !points.length) throw new Error('Câmbio indisponível.');
    const parsed = points.map(p => bcbPoint(p, now)).sort((a, b) => a.at - b.at);
    const end = parsed.at(-1);
    return { ...asset, price: end.value, currency: 'BRL', quoteAt: end.at, fetchedAt: now,
      interval: '1d', referenceOnly: true, bars: [], referenceSeries: parsed, source: 'BCB • SGS 1',
      sourceUrl: 'https://www.bcb.gov.br/estabilidadefinanceira/historicocotacoes', demo: false };
  }
  if (asset.type === 'crypto') {
    const base = 'https://api.binance.com/api/v3/';
    const [bars, quote, book] = await Promise.all([transport(`${base}klines?symbol=${asset.symbol}&interval=${interval}&limit=1000`),
      transport(`${base}ticker/24hr?symbol=${asset.symbol}`), transport(`${base}ticker/bookTicker?symbol=${asset.symbol}`)]);
    return parseCrypto(asset, bars, quote, book, interval, now);
  }
  if (!asset.free && !token) throw new Error('Este ativo exige token e cobertura do seu plano brapi. Configure em Perfil → Fontes.');
  const [quote, historical] = await Promise.all([
    transport(`https://brapi.dev/api/v2/stocks/quote?symbols=${asset.symbol}`, token),
    transport(`https://brapi.dev/api/v2/stocks/historical?symbols=${asset.symbol}&range=${interval === '5m' ? '5d' : '5y'}&interval=${interval}&sortOrder=asc`, token)
  ]);
  const data = parseBrapi(asset, quote, historical, interval, now);
  if (asset.type === 'fii') {
    try {
      const f = await transport(`https://brapi.dev/api/v2/fii/indicators?symbols=${asset.symbol}`, token);
      const v = f.fiis?.find(x => x.symbol === asset.symbol);
      if (v) data.fii = { priceToNav: v.priceToNav, dividendYield12m: v.dividendYield12m,
        navPerShare: v.navPerShare, asOf: v.asOfDate, segment: v.segmentType };
    } catch { data.fundamentalWarning = 'Indicadores patrimoniais não disponíveis no plano ou na fonte.'; }
  }
  return data;
}
export function parseNews(data, now = Date.now()) {
  if (!Array.isArray(data.articles)) throw new Error('Notícias indisponíveis na fonte.');
  return data.articles.flatMap(a => {
    const d = String(a.seendate ?? '').match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    const at = d ? Date.UTC(+d[1], +d[2] - 1, +d[3], +d[4], +d[5], +d[6]) : NaN;
    let url; try { url = new URL(a.url); } catch { return []; }
    if (url.protocol !== 'https:' || url.username || !finite(at) || at > now + 60000 || now - at > 7 * DAY || !a.title) return [];
    const sensitive = /juros|infla|guerra|fiscal|san[çc]|tarifa|interest rate|inflation|\bwar\b|sanction|tariff|central bank/i.test(a.title);
    return [{ title: String(a.title).slice(0, 240), url: url.href, domain: url.hostname, at, sensitive }];
  }).slice(0, 12);
}
export async function loadMacro(transport = requestJson) {
  const now = Date.now(), output = { updatedAt: now, errors: [], news: [] };
  const queries = [['selic', 432, 1], ['ipca', 433, 13], ['usd', 1, 1]];
  const results = await Promise.allSettled(queries.map(([, id, n]) => transport(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${id}/dados/ultimos/${n}?formato=json`)));
  results.forEach((r, j) => {
    const [key] = queries[j];
    try {
      if (r.status !== 'fulfilled') throw r.reason;
      if (!Array.isArray(r.value) || !r.value.length) throw new Error('Sem observações.');
      const points = r.value.map(p => bcbPoint(p, now)).sort((a, b) => a.at - b.at);
      const end = points.at(-1);
      if (now - end.at > (key === 'ipca' ? 70 : 7) * DAY) throw new Error('Indicador desatualizado.');
      output[key] = end;
      if (key === 'ipca' && points.length >= 12) output.ipca12m = (points.slice(-12).reduce((p, v) => p * (1 + v.value / 100), 1) - 1) * 100;
    } catch (e) { output.errors.push(`${key.toUpperCase()}: ${e.message}`); }
  });
  try {
    const query = encodeURIComponent('(Brazil OR Brasil) (economy OR inflation OR fiscal OR juros OR economia)');
    output.news = parseNews(await transport(`https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&format=json&maxrecords=12&sort=datedesc&timespan=24h`), now);
    output.eventRisk = output.news.some(n => n.sensitive && now - n.at < DAY);
  } catch { output.errors.push('Notícias indisponíveis. Consulte as fontes oficiais abaixo.'); }
  return output;
}
