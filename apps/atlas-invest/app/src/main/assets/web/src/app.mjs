import { VERSION, QUESTIONS, PROFILES, assessProfile, analyze, finite, ema } from './engine.mjs';
import { ASSETS, loadAsset, loadMacro } from './providers.mjs';
import { demoMarket } from './demo.mjs';
import { newWallet, validWallet, openPaper, closePaper, walletRisk } from './paper.mjs';

const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const number = (v, digits = 2) => finite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
const money = v => finite(v) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
const date = v => finite(v) ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : 'Sem data';
const pct = v => finite(v) ? `${v > 0 ? '+' : ''}${number(v)}%` : '—';
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(`atlas.${key}`)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(`atlas.${key}`, JSON.stringify(value)); } catch { toast('Não foi possível salvar neste dispositivo.'); } };
const icons = {
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 7-7M12 3v2M3 12h2M12 19v2M19 12h2"/>',
  chart: '<path d="M4 3v17h17M8 15l4-5 4 2 5-7"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>',
  wallet: '<path d="M3 6a2 2 0 0 1 2-2h14v4H5a2 2 0 0 1-2-2v13h18V8h-2M21 12h-6v4h6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  refresh: '<path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/>',
  star: '<path d="m12 3 3 6 6.5 1-4.8 4.7 1.1 6.5L12 18l-5.8 3.2 1.1-6.5L2.5 10 6 9z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  alert: '<path d="m12 3 10 18H2zM12 9v5M12 17v1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 10v7M12 6v1"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  brain: '<path d="M12 4c-3-3-7 0-6 3-4 0-5 6-1 8-2 4 4 8 7 4V4m0 0c3-3 7 0 6 3 4 0 5 6 1 8 2 4-4 8-7 4M7 10l5 2 5-2M6 16l6-1 6 1"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  book: '<path d="M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2z"/>'
};
const icon = (id, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[id] ?? icons.info}</svg>`;
const btn = (label, action, style = '', disabled = false) => `<button type="button" class="btn ${style}" data-action="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;
const chip = (text, cls = '') => `<span class="pill ${cls}"><span class="dot"></span>${text}</span>`;
const note = (text, cls = '', id = 'info') => `<div class="note ${cls}">${icon(id)}<div>${text}</div></div>`;
const list = (items, kind) => `<ul class="reason-list ${kind}">${items.map(x => `<li>${icon(kind === 'positive' ? 'check' : 'alert')}${esc(x)}</li>`).join('')}</ul>`;
let profile = read('profile', null);
try { if (profile) profile = { ...assessProfile(profile.answers, profile.assessedAt), assessedAt: profile.assessedAt }; } catch { profile = null; }
let storedWallet = read('wallet', null);
if (!validWallet(storedWallet)) storedWallet = newWallet();
const prefs = read('settings', {});
const state = {
  page: 'radar', mode: 'swing', filter: 'all', query: '', selected: 'PETR4', demo: false,
  market: {}, macro: {}, busy: false, progress: '', profile, wallet: storedWallet,
  favorites: read('favorites', ['PETR4', 'VALE3', 'BTCBRL']), questionnaire: false,
  step: 0, answers: {}, fib: true, formError: '', resetPending: false,
  settings: { riskPct: .5, feeBps: 10, slippageBps: 5, fixedFee: 0, ...prefs },
  exercises: read('exercises', []), token: '', showSources: false
};
for (const key of ['riskPct', 'feeBps', 'slippageBps', 'fixedFee']) if (!finite(state.settings[key]) || state.settings[key] < 0) state.settings[key] = key === 'riskPct' ? .5 : key === 'feeBps' ? 10 : key === 'slippageBps' ? 5 : 0;
state.settings.riskPct = Math.min(1, Math.max(.05, state.settings.riskPct));
if (!Array.isArray(state.favorites)) state.favorites = [];
if (!Array.isArray(state.exercises)) state.exercises = [];
const computed = new Map(), jobs = new Set();
let worker;
try {
  worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    computed.set(data.key, data); jobs.delete(data.key);
    if (['radar', 'analysis'].includes(state.page)) render();
  };
  worker.onerror = () => { jobs.clear(); worker = null; toast('A IA local não iniciou neste WebView. Atualize o Android System WebView.'); };
} catch { worker = null; }

function calcKey(s) { return `${s.symbol}:${s.fetchedAt}:${state.mode}:${JSON.stringify(state.settings)}:${state.profile?.level}:${state.wallet.initialCapital}`; }
function queueCompute(snapshot) {
  if (!snapshot?.bars?.length || snapshot.bars.length < 120 || snapshot.referenceOnly || !worker) return;
  const key = calcKey(snapshot); if (computed.has(key) || jobs.has(key)) return;
  jobs.add(key);
  worker.postMessage({ key, bars: snapshot.bars, options: { ...state.settings,
    riskPct: Math.min(state.settings.riskPct, state.profile?.maxRiskPct ?? .25),
    capital: state.wallet.initialCapital, assetPct: snapshot.type === 'crypto' ? 5 : state.profile?.maxAssetPct ?? 5,
    step: snapshot.type === 'crypto' ? .00001 : 1, horizon: state.mode === 'day' ? 6 : state.mode === 'position' ? 40 : 10,
    modelHorizon: state.mode === 'day' ? 3 : state.mode === 'position' ? 20 : 5 } });
}
function analysisFor(s) {
  const cached = s ? computed.get(calcKey(s)) : null;
  return analyze(s, { profile: state.profile, mode: state.mode, macro: state.macro,
    ...state.settings, model: cached?.model, backtest: cached?.bt,
    capital: state.wallet.initialCapital, cash: state.wallet.cash,
    ...walletRisk(state.wallet), existingNotional: state.wallet.positions.filter(p => p.symbol === s?.symbol).reduce((v, p) => v + p.paid, 0) });
}
function toast(text) {
  const t = $('#toast'); t.textContent = text; t.classList.add('visible');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('visible'), 5500);
}
function nav(page) { state.page = page; state.formError = ''; render(); window.scrollTo(0, 0); }
function modeButtons() {
  return `<div class="segmented" role="group" aria-label="Horizonte de análise">${[['swing', 'Swing trade'], ['day', 'Day trade'], ['position', 'Longo prazo']].map(([key, label]) => `<button data-mode="${key}" class="${state.mode === key ? 'active' : ''}" aria-pressed="${state.mode === key}">${label}</button>`).join('')}</div>`;
}
function title(h, p, right = '') { return `<div class="page-title"><div><div class="eyebrow" style="margin-bottom:10px">SEU PRÓXIMO MOVIMENTO</div><h1>${h}</h1><p>${p}</p></div>${right}</div>`; }
function metric(label, value, detail, color = '') { return `<div class="metric-card"><span class="eyebrow">${label}</span><b class="number ${color}">${value}</b><small>${detail}</small></div>`; }
function changeColor(x) { return x >= 0 ? 'green' : 'red'; }
function sourceLabel(s) { return s?.demo ? '<span class="test-tag">DADOS FICTÍCIOS</span>' : `<span class="eyebrow" style="letter-spacing:.3px">${esc(s?.source ?? 'Sem cotação')}</span>`; }
function spark(bars, color = 'var(--green)') {
  if (!bars?.length) return `<svg class="spark" viewBox="0 0 260 48"><path d="M0 32H260" fill="none" stroke="#324556" stroke-dasharray="4 5"/></svg>`;
  const b = bars.slice(-35), low = Math.min(...b.map(x => x.close)), high = Math.max(...b.map(x => x.close)), range = high - low || 1;
  const coords = b.map((x, j) => `${j / (b.length - 1) * 260},${43 - (x.close - low) / range * 37}`);
  return `<svg class="spark" viewBox="0 0 260 48" preserveAspectRatio="none" aria-hidden="true"><path d="M${coords.join(' L')}" fill="none" stroke="${color}" stroke-width="1.6"/></svg>`;
}
function chart(s, i) {
  if (!s?.bars?.length) return `<div class="empty">${icon('chart')}<h3>O gráfico começa nos dados</h3><p>Atualize este ativo para visualizar os candles e os indicadores calculados.</p></div>`;
  const size = 62, bars = s.bars.slice(-size), offset = s.bars.length - bars.length;
  const min = Math.min(...bars.map(b => b.low)) * .99, max = Math.max(...bars.map(b => b.high)) * 1.01;
  const y = v => 210 - (v - min) / (max - min) * 185, x = j => 8 + j / (bars.length - 1) * 520;
  const values = s.bars.map(b => b.close), fast = ema(values, 21).slice(-size), slow = ema(values, 55).slice(-size);
  const line = (series, color) => `<path d="${series.flatMap((v, j) => finite(v) ? [`${j ? 'L' : 'M'}${x(j)} ${y(v)}`] : []).join(' ')}" fill="none" stroke="${color}" stroke-width="1.25"/>`;
  const fib = state.fib && i?.fibonacci ? i.fibonacci.levels.filter(l => l.price > min && l.price < max).map(l => `<path d="M6 ${y(l.price)}H535" stroke="#887552" stroke-dasharray="4 5" opacity=".7"/><text x="7" y="${y(l.price) - 4}" style="fill:#cab285;font-size:8px">Fib ${number(l.ratio * 100, 1)}%</text>`).join('') : '';
  const trend = (l, color) => {
    if (!l) return '';
    const start = Math.max(l.a.index, offset), from = l.a.price + l.slope * (start - l.a.index);
    return `<path d="M${x(start - offset)} ${y(from)}L${x(bars.length - 1)} ${y(l.projected)}" stroke="${color}" stroke-dasharray="5 3" stroke-width="1.5"/>`;
  };
  return `<svg class="chart" viewBox="0 0 615 240" role="img" aria-label="Gráfico de candles com médias de 21 e 55 períodos, linhas de tendência e retrações de Fibonacci"><defs><clipPath id="plot"><rect x="3" y="12" width="534" height="201"/></clipPath></defs>
    ${[0, 1, 2, 3, 4].map(n => { const price = min + n / 4 * (max - min); return `<path d="M4 ${y(price)}H537" stroke="#2a3b48" stroke-width=".5"/><text x="544" y="${y(price) + 3}">${number(price, price > 10000 ? 0 : 2)}</text>`; }).join('')}
    <g clip-path="url(#plot)">${fib}${bars.map((b, j) => { const color = b.close >= b.open ? '#51e3ac' : '#e68291'; return `<path d="M${x(j)} ${y(b.high)}V${y(b.low)}" stroke="${color}" stroke-width="1"/><rect x="${x(j) - 2.3}" y="${Math.min(y(b.open), y(b.close))}" width="4.6" height="${Math.max(1, Math.abs(y(b.open) - y(b.close)))}" rx=".5" fill="${color}"/>`; }).join('')}
    ${line(fast, '#f3c57b')}${line(slow, '#90b1f9')}${trend(i?.lines?.lta, '#5be6bd')}${trend(i?.lines?.ltb, '#ffa0ac')}</g>
    ${[0, 20, 40, 61].filter(j => bars[j]).map(j => `<text x="${x(j)}" y="233">${esc(new Date(bars[j].time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }))}</text>`).join('')}
  </svg><div class="chart-legend"><span class="amber"><i class="line-marker"></i>MME 21</span><span class="blue"><i class="line-marker"></i>MME 55</span><span class="green"><i class="line-marker"></i>LTA / LTB confirmadas</span><span>${s.interval === '5m' ? '5 minutos' : 'Diário'} • ${s.bars.length} candles</span></div>`;
}
function assetCard(asset) {
  const s = state.market[asset.symbol], a = analysisFor(s), favorite = state.favorites.includes(asset.symbol);
  return `<article class="card asset-card" role="button" tabindex="0" data-asset="${asset.symbol}" aria-label="Analisar ${asset.symbol}">
    <div class="asset-top"><div class="asset-id"><div class="asset-logo" style="--asset:${asset.color}">${asset.type === 'crypto' ? asset.symbol.slice(0, 1) : asset.symbol.slice(0, 2)}</div><div><strong>${asset.symbol.replace('BRL', '/BRL')}</strong><small>${asset.name}</small></div></div>
      <button aria-label="${favorite ? 'Remover' : 'Adicionar'} ${asset.symbol} ${favorite ? 'dos' : 'aos'} favoritos" class="favorite" style="background:none;border:0;padding:5px;color:${favorite ? 'var(--amber)' : 'var(--muted)'}" data-favorite="${asset.symbol}">${icon('star')}</button></div>
    <div class="price-row"><strong class="price number">${money(s?.price)}</strong><span class="small number ${changeColor(s?.changePct)}">${pct(s?.changePct)}</span></div>
    ${spark(s?.bars, s?.changePct < 0 ? 'var(--red)' : 'var(--green)')}
    <div class="asset-bottom"><span class="${a.eligible ? 'green' : s?.demo ? 'amber' : 'muted'}"><span class="dot"></span> ${s?.error ? 'Fonte indisponível' : s?.referenceOnly ? 'Referência de câmbio' : a.status}</span><span class="score-text">${s?.bars?.length ? `<b>${a.score}</b>/100 confluência` : 'Dados não carregados'}</span></div>
  </article>`;
}
function radar() {
  const m = state.macro, eligible = Object.values(state.market).filter(s => analysisFor(s).eligible).length;
  const rankings = new Map(ASSETS.map(asset => [asset.symbol, analysisFor(state.market[asset.symbol])]));
  const cards = ASSETS.filter(a => (state.filter === 'all' || state.filter === 'fav' ? state.filter !== 'fav' || state.favorites.includes(a.symbol) : a.type === state.filter) && `${a.symbol} ${a.name}`.toLowerCase().includes(state.query.toLowerCase()))
    .sort((a, b) => Number(rankings.get(b.symbol).eligible) - Number(rankings.get(a.symbol).eligible) || rankings.get(b.symbol).score - rankings.get(a.symbol).score);
  return `<section class="hero"><div><div class="eyebrow">INTELIGÊNCIA PARA DECIDIR</div><h1>Mais contexto.<br><em>Menos impulso.</em></h1><p>Encontre sinais, entenda os cenários e preserve seu capital. Cada decisão começa pelo risco que você pode assumir.</p><div class="hero-actions">${btn(`${icon('refresh')} Atualizar mercado`, 'refresh', 'primary', state.busy)}${btn(`${icon('shield')} ${state.profile ? 'Meu perfil' : 'Descobrir meu perfil'}`, 'profile', 'ghost')}</div></div><div class="orbit">${icon('radar')}<b></b></div></section>
    <div class="regime-row">${metric('SELIC META', state.demo ? '—' : m.selic ? `${number(m.selic.value)}%` : '—', state.demo ? 'Sem economia simulada' : m.selic ? `${m.selic.date} • ao ano` : 'Banco Central • atualizar')}${metric('INFLAÇÃO • IPCA', state.demo ? '—' : finite(m.ipca12m) ? `${number(m.ipca12m)}%` : '—', state.demo ? 'Consulte dados atuais' : m.ipca ? `12 meses • base ${m.ipca.date}` : 'Acumulado de 12 meses')}${metric('SEU LIMITE POR OPERAÇÃO', `${number(Math.min(state.settings.riskPct, state.profile?.maxRiskPct ?? .25))}%`, state.profile?.name ?? 'Conclua seu perfil', 'green')}${metric('ENTRADAS PARA ESTUDO', state.demo ? 'Demo' : String(eligible).padStart(2, '0'), state.demo ? 'Nenhum sinal real emitido' : 'Dentro dos filtros de risco')}</div>
    ${!state.profile ? note(`<strong>Seu perfil vem primeiro.</strong><p>Um questionário sobre objetivos, conhecimento, patrimônio e capacidade de perda define os limites do radar.</p>`, '', 'shield') : ''}
    <div class="section-heading"><div><h2>Radar de oportunidades</h2><p>Confluência técnica, dados e adequação ao seu perfil.</p></div><span class="pill muted desktop-only">${icon('brain')} IA local</span></div>
    <div class="toolbar">${modeButtons()}<label class="search">${icon('search')}<input id="search" aria-label="Buscar ativo" placeholder="Buscar ativo ou empresa" value="${esc(state.query)}"></label></div>
    <div class="chips" role="group" aria-label="Tipo de ativo">${[['all', 'Todos'], ['fav', 'Favoritos'], ['stock', 'Ações'], ['fii', 'FIIs'], ['etf', 'ETFs'], ['crypto', 'Cripto'], ['fx', 'Moedas']].map(([key, value]) => `<button data-filter="${key}" class="${state.filter === key ? 'active' : ''}" aria-pressed="${state.filter === key}">${value}</button>`).join('')}</div>
    <div class="cards">${cards.map(assetCard).join('')}</div>${!cards.length ? '<div class="empty"><h3>Nenhum ativo encontrado</h3><p>Altere a busca ou o filtro.</p></div>' : ''}
    ${note(`<strong>Aguardar também é uma decisão.</strong><p>Os sinais podem divergir. O Atlas só destaca uma entrada quando dados, risco e validação atendem aos filtros. Confluência não representa chance de lucro.</p>`, '', 'shield')}
    ${!state.demo ? `<div class="row-toggle"><span class="muted small">Quer conhecer o app sem cotação?</span>${btn('Explorar demonstração', 'demo', 'ghost')}</div>` : ''}`;
}
function analysisPage() {
  const asset = ASSETS.find(a => a.symbol === state.selected) ?? ASSETS[0], s = state.market[asset.symbol], a = analysisFor(s), i = a.indicators;
  const cached = s ? computed.get(calcKey(s)) : null, model = cached?.model, bt = cached?.bt;
  const busy = s && jobs.has(calcKey(s));
  const p = a.illustrativePlan;
  const ind = (label, value, cls = '') => `<div class="indicator"><span>${label}</span><b class="number ${cls}">${value}</b></div>`;
  return `${title('Olhe além do preço.', 'Os motivos do sinal e os limites da análise.', btn(icon('refresh'), 'refresh-selected', 'icon-btn', state.busy))}
    <label class="small muted">Ativo em análise<select id="asset-select" style="margin:7px 0 14px">${ASSETS.map(x => `<option value="${x.symbol}" ${x.symbol === asset.symbol ? 'selected' : ''}>${x.symbol} • ${x.name}</option>`).join('')}</select></label>${modeButtons()}
    <div class="grid-two"><div class="stack"><section class="card"><div class="split"><div class="asset-id"><div class="asset-logo" style="--asset:${asset.color}">${asset.symbol.slice(0, 2)}</div><div><strong>${asset.symbol}</strong><small>${esc(asset.name)} • ${esc(asset.sector)}</small></div></div>${sourceLabel(s)}</div>
      <div class="analysis-price number">${money(s?.price)}<small class="${changeColor(s?.changePct)}">${pct(s?.changePct)}</small></div>
      <p class="legend-text">${s ? `Cotação: ${date(s.quoteAt)} • horário de Brasília` : 'Sem cotação. Atualize o ativo para iniciar.'}</p><div class="spacer"></div>${chart(s, i)}
      <div class="row-toggle"><span class="muted small">Retrações de Fibonacci</span>${btn(state.fib ? 'Visíveis' : 'Ocultas', 'fib', 'ghost')}</div>
      <div class="indicators">${ind('RSI · 14', number(i?.rsi, 1))}${ind('MACD · histograma', number(i?.macd?.histogram, 3))}${ind('ATR · 14', money(i?.atr))}${ind('Volume / média', finite(i?.volumeRatio) ? `${number(i.volumeRatio)}×` : '—')}${ind('Tendência', i?.trend ?? '—', i?.trend === 'Alta' ? 'green' : '')}${ind('Spread · bps', number(s?.spreadBps))}</div>
      <p class="legend-text">Candles concluídos. LTA = linha de tendência de alta; LTB = linha de tendência de baixa. A análise usa dados até o último candle disponível.</p>
    </section>
    <section class="card"><div class="split"><h3>Teste no passado, com custos</h3>${icon('chart', 'green')}</div>
      ${busy ? '<p class="small muted" style="margin-top:15px">Calculando a validação em segundo plano…</p>' : bt?.available ? `<div class="stats"><div><small>Resultado da estratégia</small><b class="${changeColor(bt.netReturnPct)} number">${pct(bt.netReturnPct)}</b></div><div><small>Comprar e manter · 100% alocado</small><b class="number">${pct(bt.buyHoldPct)}</b></div><div><small>Maior queda do patrimônio</small><b class="red number">${number(bt.maxDrawdownPct)}%</b></div><div><small>Operações concluídas</small><b class="number">${bt.trades}</b></div></div><p class="small muted">${date(bt.from).slice(0, 10)} a ${date(bt.to).slice(0, 10)} • Expectativa por operação: ${money(bt.expectancy)}</p><details><summary>Ver método e limitações</summary><p class="legend-text">${esc(bt.note)} A estratégia fixa usa MME 21/55, RSI, MACD e volume; o plano atual acrescenta outros filtros. Este teste não valida o sistema inteiro, nem demonstra lucro futuro.</p></details>` : `<p class="small muted" style="margin-top:16px">${esc(bt?.reason ?? cached?.error ?? 'Atualize um histórico suficiente para simular a estratégia. A fonte pode limitar a janela do seu plano.')}</p>`}
    </section>
    ${asset.type === 'fii' ? `<section class="card"><h3>Leia o FII além do gráfico</h3><div class="indicators">${ind('P/VP', number(s?.fii?.priceToNav))}${ind('DY · 12 meses', finite(s?.fii?.dividendYield12m) ? `${number(s.fii.dividendYield12m * 100)}%` : '—')}${ind('Valor patrimonial/cota', money(s?.fii?.navPerShare))}</div><p class="legend-text">Base: ${esc(s?.fii?.asOf ?? 'não disponível')}. DY passado não garante distribuições futuras; P/VP baixo não comprova desconto atrativo.</p>${list(['Examinar vacância, concentração de inquilinos ou devedores, endividamento e recorrência da renda.', 'A análise fundamentalista e os relatórios completos ainda exigem consulta externa.'], 'caution')}</section>` : ''}
    </div><div class="stack"><section class="card"><div class="split"><h3>Leitura do Atlas</h3>${icon('brain', 'green')}</div><div class="gauge-row"><div class="gauge" style="--score:${a.score}"><div>${a.score}<small>CONFLUÊNCIA</small></div></div><div>${chip(a.status, a.eligible ? 'green' : 'amber')}<p class="legend-text">Índice de 0 a 100.<br>Não é chance de acerto.</p></div></div>
      ${a.blockers.length ? `<h3 class="small red">Por que aguardar</h3>${list(a.blockers, 'block')}` : ''}
      ${a.reasons.length ? `<div class="divider"></div><h3 class="small green">O que sustenta a leitura</h3>${list(a.reasons, 'positive')}` : ''}
      <details ${a.reasons.length ? '' : 'open'}><summary>Riscos e sinais contrários</summary>${list(a.cautions, 'caution')}</details>
    </section>
    <section class="card"><div class="split"><h3>IA estatística local</h3><span class="pill muted">Experimental</span></div>
      ${model?.available ? `<div class="risk-number">${number(model.score, 0)}<span class="muted" style="font-size:13px"> / 100</span></div><p class="small muted">${model.description}</p><div class="divider"></div><p class="small">${model.samples} amostras de treino · ${model.testSamples} previsões fora do treino</p><p class="legend-text">Brier do modelo: ${number(model.brier, 3)} • referência: ${number(model.baselineBrier, 3)}. Menor é melhor. Horizonte: ${model.horizon} candles.</p>${note(model.evidence ? 'Melhoria observada nesta janela; precisa se sustentar em outros ativos e períodos.' : 'Evidência insuficiente para elevar o peso da IA no sinal.', '', 'brain')}` : `<p class="small muted" style="margin-top:16px">${busy ? 'Treinando e validando sem usar informação futura…' : esc(model?.reason ?? 'A IA exige ao menos 220 candles. Seus dados de perfil ficam no dispositivo.')}</p>`}
    </section>
    <section class="card"><h3>${a.eligible ? 'Plano para estudar uma entrada' : 'Cenário matemático'}</h3><p class="legend-text">${a.eligible ? 'Revise a tese e o preço antes de qualquer decisão.' : 'Cálculo ilustrativo. Entrada não habilitada pelos filtros.'}</p>
      ${p ? `<div class="plan-grid"><div><small>Referência</small><b class="number">${money(p.entry)}</b></div><div><small>Stop hipotético</small><b class="number red">${money(p.stop)}</b></div><div><small>Alvo hipotético</small><b class="number green">${money(p.target)}</b></div></div><div class="stats"><div><small>Perda estimada no stop</small><b class="number">${money(p.riskAmount)}</b></div><div><small>Retorno / risco após custos</small><b class="number">${number(p.rr)} : 1</b></div></div><p class="small muted">${number(p.quantity, asset.type === 'crypto' ? 5 : 0)} unidades • Exposição ${money(p.notional)}<br>Custo estimado ida e volta até o alvo: ${money(p.roundTripCost)}</p>` : '<p class="small muted" style="margin:18px 0">Conclua o perfil e carregue dados válidos para calcular os limites.</p>'}
      <div class="spacer"></div>${btn(`${icon('wallet')} Simular esta entrada`, 'paper-open', 'primary wide', !a.eligible)}<p class="legend-text">Apenas registro simulado. Stop não garante execução nem limita a perda em gaps. Alvo fixo é cenário, não previsão de preço.</p>
    </section></div></div>`;
}
function macroPage() {
  const m = state.macro;
  return `${title('Contexto muda o jogo.', 'Economia, notícias e pontos de atenção.', btn(icon('refresh'), 'refresh-macro', 'icon-btn', state.busy))}
    ${state.demo ? note('A demonstração usa preços fictícios. Os indicadores econômicos abaixo só aparecem após uma consulta real.', 'amber') : ''}
    <div class="regime-row">${metric('SELIC META', m.selic ? `${number(m.selic.value)}%` : '—', m.selic ? `${m.selic.date} • ao ano` : 'Fonte não consultada')}${metric('IPCA • ÚLTIMO MÊS', m.ipca ? `${number(m.ipca.value)}%` : '—', m.ipca?.date ?? 'Fonte não consultada')}${metric('IPCA • 12 MESES', finite(m.ipca12m) ? `${number(m.ipca12m)}%` : '—', 'Composição dos 12 meses')}${metric('DÓLAR • REFERÊNCIA', money(m.usd?.value), m.usd?.date ?? 'Cotação BCB, não executável')}</div>
    <div class="grid-two"><div class="stack"><section class="card"><div class="split"><h3>No radar econômico e político</h3>${chip('Fontes externas')}</div><p class="legend-text">Manchetes agregadas pelo GDELT. A marcação de atenção usa palavras-chave; não confirma impacto ou causalidade. Abra a fonte original.</p>
      ${m.news?.length ? m.news.map(n => `<article class="news"><div class="eyebrow">${esc(n.domain)} • ${date(n.at)}${n.sensitive ? ' • tema sensível' : ''}</div><a href="${esc(n.url)}" rel="noopener noreferrer">${esc(n.title)} ↗</a></article>`).join('') : `<div class="empty" style="margin-top:18px">${icon('globe')}<h3>Informação tem que ter fonte</h3><p>Atualize para consultar notícias. Na ausência de uma fonte disponível, o Atlas não inventa manchetes ou eventos.</p>${btn('Consultar notícias e indicadores', 'refresh-macro', 'primary', state.busy)}</div>`}
      ${m.errors?.length ? `<details><summary>Disponibilidade das fontes</summary>${list(m.errors, 'caution')}</details>` : ''}
    </section><section class="card"><h3>Como o contexto entra na decisão</h3>${list(['Juros: afetam custo de capital e atratividade relativa de renda fixa, ações e FIIs.', 'Inflação: altera poder de compra, margens e expectativas de juros.', 'Câmbio: afeta empresas exportadoras, importadoras e ativos no exterior.', 'Política fiscal, sanções, conflitos e mudanças regulatórias: podem ampliar a volatilidade e invalidar uma tese.'], 'caution')}<p class="legend-text">São relações econômicas gerais. A direção e a intensidade do efeito dependem do ativo, das expectativas e do que já está no preço.</p></section></div>
    <div class="stack"><section class="card"><h3>Agenda e fontes oficiais</h3><p class="legend-text">Verifique decisões do Copom, inflação, resultados e comunicados antes de operar. Nesta versão, a agenda futura é consultada nos links oficiais.</p>
      <div class="source-links"><a href="https://www.bcb.gov.br/controleinflacao/copom">Banco Central • Copom ${icon('arrow')}</a><a href="https://www.ibge.gov.br/calendario-de-divulgacoes.html">IBGE • calendário ${icon('arrow')}</a><a href="https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm">Federal Reserve • FOMC ${icon('arrow')}</a><a href="https://www.b3.com.br/pt_br/">B3 • mercado e comunicados ${icon('arrow')}</a><a href="https://www.gov.br/cvm/pt-br">CVM • comunicados ${icon('arrow')}</a></div>
    </section><section class="card"><h3>Antes do trade, compare alternativas</h3>${list(['Sem reserva ou com dívidas caras: priorize liquidez e revisão do custo das dívidas.', 'Perfil conservador: estude renda fixa compatível com liquidez, emissor, prazo e garantias de cada produto.', 'Para renda com FIIs: examine vacância, concentração, crédito e recorrência dos rendimentos.', 'Para crescimento: considere diversificação e custos de ETFs, além do risco dos mercados subjacentes.'], 'positive')}<p class="legend-text">Triagem educacional. O Atlas ainda não compara títulos de renda fixa individualmente nem substitui uma avaliação profissional.</p></section></div></div>`;
}
function paperPage() {
  const w = state.wallet, realized = w.closed.reduce((s, p) => s + p.pnl, 0), risk = walletRisk(w);
  return `${title('Treine antes de arriscar.', 'Uma carteira de estudo. Nenhuma ordem é enviada.', chip('100% simulado', 'green'))}
    <div class="regime-row">${metric('CAPITAL INICIAL', money(w.initialCapital), 'Valor escolhido por você')}${metric('CAIXA SIMULADO', money(w.cash), 'Disponível após entradas')}${metric('RESULTADO REALIZADO', money(realized), 'Após custos • sem tributos', changeColor(realized))}${metric('RISCO EM ABERTO', money(risk.openRisk), 'Perda estimada se atingir stops', 'amber')}</div>
    ${note('A carteira registra entradas aprovadas pelo radar. As saídas são manuais e exigem cotação recente. Os stops são referências: não há execução, monitoramento em segundo plano ou encerramento automático.', '', 'wallet')}
    <div class="grid-two"><div class="stack"><section class="card"><div class="split"><h3>Posições em estudo <span class="badge-count">${w.positions.length}</span></h3>${btn('Radar', 'radar', 'ghost')}</div>
      ${w.positions.length ? `<div class="table-wrap"><table><thead><tr><th>Ativo</th><th>Quantidade</th><th>Entrada</th><th>Stop</th><th>Ação</th></tr></thead><tbody>${w.positions.map(p => `<tr><td>${esc(p.symbol)}</td><td>${number(p.quantity, p.type === 'crypto' ? 5 : 0)}</td><td>${money(p.entry)}</td><td class="red">${money(p.stop)}</td><td><button class="btn" data-close="${esc(p.id)}">Atualizar e encerrar</button></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty" style="margin-top:18px">${icon('wallet')}<h3>Disciplina também se treina.</h3><p>Quando uma análise atender aos filtros, use “Simular esta entrada”. Você também pode estudar cenários no exercício livre abaixo.</p>${btn('Explorar o radar', 'radar', 'primary')}</div>`}
    </section><section class="card"><div class="split"><h3>Diário de operações</h3>${btn(`${icon('download')} CSV`, 'export', 'ghost')}</div>
      ${w.closed.length ? `<div class="table-wrap"><table><thead><tr><th>Ativo</th><th>Entrada</th><th>Saída</th><th>Resultado</th></tr></thead><tbody>${w.closed.map(p => `<tr><td>${esc(p.symbol)}</td><td>${money(p.entry)}</td><td>${money(p.exit)}</td><td class="${changeColor(p.pnl)}">${money(p.pnl)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="small muted" style="margin-top:20px">Nenhuma operação encerrada. O histórico fica salvo neste dispositivo.</p>'}
    </section><section class="card"><h3>Exercício livre de resultado</h3><p class="legend-text">Você escolhe preços hipotéticos para aprender o efeito dos custos. Este exercício não emite sinais e não altera a carteira do radar.</p>
      <form id="exercise-form"><div class="form-grid"><label>Ativo ou nome do exercício<input name="symbol" maxlength="25" value="EXERCÍCIO" required></label><label>Quantidade<input name="quantity" type="number" min="0.00001" max="10000000" step="any" value="100" required></label><label>Preço de entrada · R$<input name="entry" type="number" min="0.01" max="10000000" step="any" value="30" required></label><label>Preço de saída · R$<input name="exit" type="number" min="0.01" max="10000000" step="any" value="31.5" required></label><label class="full">Comentário sobre a tese<input name="thesis" maxlength="180" placeholder="O que sustenta a hipótese? O que a invalidaria?"></label></div><button class="btn primary wide" type="submit">Calcular e registrar exercício</button></form>
      ${state.exercises.length ? `<div class="divider"></div>${state.exercises.slice(-5).reverse().map(e => `<div class="news"><div class="split"><strong class="small">${esc(e.symbol)}</strong><strong class="number ${changeColor(e.pnl)}">${money(e.pnl)}</strong></div><p class="legend-text">${number(e.quantity, 3)} × ${money(e.entry)} → ${money(e.exit)} • custos ${money(e.cost)}<br>${esc(e.thesis)}</p><span class="test-tag">EXERCÍCIO MANUAL • SEM COTAÇÃO REAL</span></div>`).join('')}` : ''}
    </section></div><div class="stack"><section class="card"><h3>Seu plano de risco</h3><form id="risk-form"><div class="form-grid"><label class="full">Capital simulado · R$<input type="number" name="capital" value="${w.initialCapital}" min="100" max="100000000" step="100" ${w.positions.length || w.closed.length ? 'disabled' : ''} required></label><label class="full">Risco solicitado por operação · %<input name="riskPct" type="number" step="0.05" min="0.05" max="1" value="${state.settings.riskPct}" required></label><label>Taxas por lado · bps<input type="number" name="feeBps" min="0" max="200" step="1" value="${state.settings.feeBps}" required></label><label>Deslizamento/lado · bps<input type="number" name="slippageBps" min="0" max="200" step="1" value="${state.settings.slippageBps}" required></label><label class="full">Tarifa fixa por ordem · R$<input name="fixedFee" type="number" min="0" max="1000" step=".01" value="${state.settings.fixedFee}" required></label></div><button type="submit" class="btn primary wide">Salvar limites</button></form><p class="legend-text">1 bp = 0,01%. Insira taxas e deslizamento estimados para seu mercado; não são taxas confirmadas de uma corretora. Tributos não incluídos.</p>
      <div class="divider"></div><p class="small muted">Limite efetivo por operação: <strong class="green">${number(Math.min(state.settings.riskPct, state.profile?.maxRiskPct ?? .25))}%</strong><br>Limite agregado: ${number(state.profile?.maxPortfolioRiskPct ?? .75)}%<br>Limite diário de perdas: ${number(state.profile?.maxDailyLossPct ?? .5)}%</p><p class="legend-text">Aumentar o valor solicitado não ultrapassa o limite permitido pelo perfil. Sem alavancagem; no máximo uma posição por ativo.</p>
    </section><section class="card"><h3>Revisão da decisão</h3>${list(['Qual hipótese motivou a operação?', 'Qual evento invalidaria essa hipótese?', 'O tamanho respeita o risco total da carteira?', 'Havia notícia, baixa liquidez ou gap?', 'O resultado veio da disciplina ou do acaso?'], 'positive')}</section></div></div>`;
}
function questionnaire() {
  const offset = state.step * 3, group = QUESTIONS.slice(offset, offset + 3);
  return `<section class="card"><div class="split"><h3>Conheça seu perfil</h3><span class="small muted">Etapa ${state.step + 1} de 4</span></div><div class="profile-steps">${[0, 1, 2, 3].map(j => `<i class="${j <= state.step ? 'active' : ''}"></i>`).join('')}</div><p class="small muted">Responda sobre sua situação real. O perfil considera tanto disposição quanto capacidade financeira para correr riscos.</p><form id="profile-form">
    ${group.map(([id, q, options], j) => `<fieldset class="question"><legend>${offset + j + 1}. ${q}</legend>${options.map((o, k) => `<label><input type="radio" name="${id}" value="${k}" ${state.answers[id] === k ? 'checked' : ''} required><span>${o}</span></label>`).join('')}</fieldset>`).join('')}
    ${state.formError ? `<p class="error-inline">${esc(state.formError)}</p>` : ''}<div class="split">${btn(state.step ? 'Voltar' : 'Cancelar', 'profile-back', 'ghost')}<button type="submit" class="btn primary">${state.step === 3 ? 'Concluir meu perfil' : 'Continuar'} ${icon('arrow')}</button></div></form></section>`;
}
function profilePage() {
  const p = state.profile;
  return `${title('O melhor plano respeita você.', 'Objetivos, conhecimento e capacidade de absorver perdas.')}
    <div class="grid-two"><div class="stack">${state.questionnaire ? questionnaire() : p ? `<section class="card profile-head"><div class="split"><div class="eyebrow">SEU PERFIL INICIAL</div>${icon('shield', 'green')}</div><div class="profile-level">${p.name}</div><p class="small muted">Avaliado em ${date(p.assessedAt)}. Refaça quando sua situação mudar; a revisão anual é uma política interna deste app.</p><div class="stats"><div><small>Limite por operação</small><b class="green">${number(p.maxRiskPct)}%</b></div><div><small>Exposição máxima por ativo</small><b>${p.maxAssetPct}%</b></div></div>${list(p.reasons, 'caution')}${note(p.tradeAllowed ? 'O perfil admite estudar renda variável, sujeito aos demais filtros. Isso não certifica a adequação de um ativo específico.' : 'Neste momento, o app prioriza reserva, liquidez e aprendizagem. O risco escolhido não pode ignorar a capacidade de perda.', '', 'shield')}<div class="spacer"></div>${btn('Reavaliar perfil', 'start-profile', 'primary')}</section>` : `<section class="card profile-head"><div class="profile-intro">${icon('shield')}<div><h2>Antes de escolher o ativo,<br>entenda seus limites.</h2><p class="small muted" style="margin-top:13px">12 perguntas sobre objetivos, horizonte, reserva, dívidas, renda, patrimônio, experiência e comportamento diante de perdas.</p></div></div><div class="spacer"></div>${btn('Começar avaliação • 3 minutos', 'start-profile', 'primary wide')}<p class="legend-text">Sem CPF, senha bancária ou conexão com corretora. Suas respostas ficam neste dispositivo.</p></section>`}
    <section class="card"><h3>Fontes de mercado</h3><p class="small muted" style="margin-top:12px">Ações, FIIs e ETFs: brapi. Criptoativos: dados públicos de pares em reais da Binance. Economia e câmbio: Banco Central. Manchetes: GDELT.</p>
      <form id="source-form"><label style="margin-top:18px">Token brapi · opcional<input name="token" type="password" autocomplete="off" value="" placeholder="Cole seu token para esta sessão" maxlength="500"></label><p class="form-help">${state.token ? 'Token configurado nesta sessão. ' : ''}O token é enviado somente à brapi e fica apenas na memória do app; será necessário informá-lo ao reabrir. Nunca informe senha de corretora.</p><div class="hero-actions"><button type="submit" class="btn primary">Usar token nesta sessão</button>${btn('Limpar token', 'clear-token', 'ghost')}</div></form>
      <div class="source-links"><a href="https://brapi.dev/dashboard">Obter token e verificar plano ${icon('arrow')}</a><a href="https://brapi.dev/docs/acoes">Cobertura e histórico brapi ${icon('arrow')}</a></div><p class="legend-text">Os quatro ativos de teste são PETR4, VALE3, ITUB4 e MGLU3. Cobertura, limite do histórico, atraso e recursos dependem da fonte e do plano. B3 intradiária não verificada bloqueia day trade.</p>
    </section><section class="card"><h3>Privacidade e dados</h3><p class="small muted" style="margin:12px 0">Perfil, preferências, exercícios e carteira simulada ficam no aparelho. As fontes recebem consultas de tickers e dados técnicos da conexão, como IP. Nenhuma resposta do questionário é enviada a serviços de IA.</p>${btn(state.resetPending ? 'Confirmar: apagar os dados locais' : 'Apagar meus dados deste aparelho', state.resetPending ? 'reset-confirm' : 'reset', 'ghost')}<p class="legend-text">A exclusão é local e remove perfil, carteira e exercícios. Não altera dados de serviços externos.</p></section></div>
    <div class="stack"><section class="card"><h3>O que o Atlas sabe fazer</h3>${list(['Calcular indicadores a partir de candles disponíveis.', 'Combinar sinais e expor os motivos para aguardar.', 'Treinar regressão logística local e testar cronologicamente.', 'Estimar quantidade, custos e exposição sem alavancagem.', 'Consultar preços, contexto e manchetes com fonte.'], 'positive')}<div class="divider"></div><h3>Limites desta versão</h3>${list(['IA experimental; não comprovada como estratégia lucrativa.', 'Sem recomendação financeira profissional certificada.', 'Sem ordens, conexão de conta, alertas em segundo plano ou cálculo tributário.', 'Análise fundamentalista parcial; longo prazo permanece como triagem.', 'Notícias classificadas por tema; sem previsão automática de efeitos políticos.'], 'caution')}</section>
    <section class="card"><h3>Indicadores, em linguagem clara</h3><dl class="glossary"><dt>LTA / LTB</dt><dd>Linhas ligando fundos ascendentes ou topos descendentes confirmados. Não são barreiras garantidas para o preço.</dd><dt>Fibonacci</dt><dd>Retrações de 23,6%, 38,2%, 50%, 61,8% e 78,6% do movimento recente. Servem como referências de atenção.</dd><dt>RSI e MACD</dt><dd>Leituras de força e ritmo do preço. Podem dar sinais falsos ou permanecer extremos.</dd><dt>ATR e Bollinger</dt><dd>Medidas de amplitude e dispersão. A volatilidade ajuda a dimensionar a operação, sem prever direção.</dd><dt>Validação fora do treino</dt><dd>O modelo aprende com dados anteriores e é avaliado em períodos posteriores que ainda não conhecia.</dd></dl></section>
    <section class="card"><h3>Atlas Invest <span class="muted">${VERSION}</span></h3><p class="legend-text">Versão inicial para estudo. O questionário é uma avaliação interna, não certificação de suitability. Serviços profissionais de análise e recomendação dependem do enquadramento regulatório aplicável.</p><div class="source-links"><a href="https://conteudo.cvm.gov.br/legislacao/resolucoes/resol030.html">CVM 30 • perfil do investidor ${icon('arrow')}</a><a href="https://conteudo.cvm.gov.br/legislacao/resolucoes/resol020.html">CVM 20 • atividade de analista ${icon('arrow')}</a></div></section></div></div>`;
}
function render() {
  const html = state.page === 'radar' ? radar() : state.page === 'analysis' ? analysisPage() : state.page === 'macro' ? macroPage() : state.page === 'paper' ? paperPage() : profilePage();
  $('#app').innerHTML = `<div class="app-shell"><header class="topbar"><a class="brand" href="#" data-nav="radar" aria-label="Atlas Invest, início"><img src="icon.svg" alt=""><div><div class="brand-name">atlas<span> invest</span></div><small class="muted">CLAREZA PARA SEU CAPITAL</small></div></a><div class="top-right"><button class="pill ${state.profile ? 'green' : ''}" data-nav="profile">${icon('shield')}${state.profile?.name ?? 'Seu perfil'}</button><button class="avatar" aria-label="Abrir perfil" data-nav="profile">${icon('user')}</button></div></header>
    ${state.demo ? `<div class="banner"><span><strong>MODO DEMONSTRAÇÃO</strong> • Preços e gráficos fictícios. Nenhuma sugestão real.</span><button data-action="live">Sair da demo</button></div>` : ''}
    ${state.busy ? `<div class="loading-line" role="progressbar" aria-label="Consultando dados"></div><p class="small muted" style="margin-bottom:16px" role="status">${esc(state.progress)}</p>` : ''}
    <main id="main">${html}</main><p class="footer-note">Atlas Invest ${VERSION} • Análise experimental para estudo. Investir e fazer trade envolve perdas, inclusive superiores ao risco estimado em gaps. Confluência, IA e resultados passados não garantem lucro. Confira fontes, custos e adequação antes de decidir.</p></div>
    <nav class="bottom-nav" aria-label="Navegação principal">${[['radar', 'radar', 'Radar'], ['analysis', 'chart', 'Análise'], ['macro', 'globe', 'Cenário'], ['paper', 'wallet', 'Simulador'], ['profile', 'user', 'Perfil']].map(([id, ic, label]) => `<button data-nav="${id}" class="${state.page === id ? 'active' : ''}" ${state.page === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></button>`).join('')}</nav>`;
}

async function refresh(selectedOnly = false) {
  if (state.busy) return;
  if (state.demo) { state.demo = false; state.market = {}; computed.clear(); }
  state.busy = true; state.progress = 'Consultando fontes de mercado…'; render();
  const assets = selectedOnly ? ASSETS.filter(a => a.symbol === state.selected) : ASSETS;
  let loaded = 0;
  // Sequential assets bound rate use; each provider uses at most three requests concurrently.
  for (const asset of assets) {
    state.progress = `Consultando ${asset.symbol}… ${loaded + 1}/${assets.length}`;
    if (['radar', 'analysis'].includes(state.page)) render();
    try {
      const s = await loadAsset(asset, state.mode, state.token);
      state.market[asset.symbol] = s; queueCompute(s);
    } catch (e) { state.market[asset.symbol] = { ...asset, error: e.message, bars: [], fetchedAt: Date.now() }; }
    loaded++;
  }
  if (!selectedOnly) { state.progress = 'Consultando economia e notícias…'; if (['radar', 'macro'].includes(state.page)) render(); state.macro = await loadMacro(); }
  state.busy = false; state.progress = '';
  if (['radar', 'analysis', 'macro'].includes(state.page)) render();
  const valid = assets.filter(a => state.market[a.symbol]?.price).length;
  toast(`${valid} de ${assets.length} ativos retornaram cotação. A leitura verifica também horário, histórico e risco.`);
}
async function refreshMacro() {
  if (state.busy) return;
  state.busy = true; state.progress = 'Consultando Banco Central e notícias…'; render();
  state.macro = await loadMacro(); state.busy = false; if (['radar', 'macro'].includes(state.page)) render();
  toast(state.macro.errors.length ? 'Consulta concluída com limitações. Veja a disponibilidade das fontes.' : 'Contexto atualizado com as datas informadas pelas fontes.');
}
function csvExport() {
  const rows = [['tipo', 'ativo', 'quantidade', 'entrada', 'saida', 'resultado_brl', 'data'],
    ...state.wallet.closed.map(p => ['simulado_por_radar', p.symbol, p.quantity, p.entry, p.exit, p.pnl, new Date(p.closedAt).toISOString()]),
    ...state.exercises.map(p => ['exercicio_manual', p.symbol, p.quantity, p.entry, p.exit, p.pnl, new Date(p.at).toISOString()])];
  // Formula injection protection for spreadsheet consumers.
  const cell = value => { let s = String(value ?? ''); if (/^[=+@\-]/.test(s) && !finite(value)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
  const csv = '\ufeff' + rows.map(r => r.map(cell).join(';')).join('\r\n');
  if (globalThis.AtlasNative?.saveCsv) { globalThis.AtlasNative.saveCsv(csv); toast('Escolha onde salvar o diário.'); return; }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'atlas-diario.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('Diário preparado para download.');
}

document.addEventListener('click', async event => {
  const target = event.target.closest('button,a,[data-asset]'); if (!target) return;
  if (target.dataset.nav) { event.preventDefault(); nav(target.dataset.nav); return; }
  if (target.dataset.favorite) { const symbol = target.dataset.favorite; state.favorites = state.favorites.includes(symbol) ? state.favorites.filter(x => x !== symbol) : [...state.favorites, symbol]; save('favorites', state.favorites); render(); return; }
  if (target.dataset.asset) { state.selected = target.dataset.asset; queueCompute(state.market[state.selected]); nav('analysis'); return; }
  if (target.dataset.filter) { state.filter = target.dataset.filter; render(); return; }
  if (target.dataset.mode) {
    if (state.busy) { toast('Aguarde a consulta antes de trocar o horizonte.'); return; }
    state.mode = target.dataset.mode;
    if (state.demo) state.market = demoMarket(state.mode);
    Object.values(state.market).forEach(queueCompute); render();
    if (!state.demo) toast('Horizonte alterado. Atualize os dados para usar o intervalo correspondente.');
    return;
  }
  if (target.dataset.close) {
    if (state.busy) return;
    const p = state.wallet.positions.find(p => p.id === target.dataset.close);
    try {
      target.disabled = true;
      const asset = ASSETS.find(a => a.symbol === p.symbol);
      const snapshot = await loadAsset(asset, p.mode, state.token);
      state.wallet = closePaper(state.wallet, p.id, snapshot); save('wallet', state.wallet); render(); toast('Posição simulada encerrada com a cotação consultada.');
    } catch (e) { toast(e.message); target.disabled = false; }
    return;
  }
  const action = target.dataset.action;
  if (!action) return;
  if (['profile', 'radar'].includes(action)) { nav(action); return; }
  if (action === 'refresh') await refresh();
  if (action === 'refresh-selected') await refresh(true);
  if (action === 'refresh-macro') await refreshMacro();
  if (action === 'demo') {
    if (state.busy) { toast('Aguarde a consulta em andamento.'); return; }
    state.demo = true; state.market = demoMarket(state.mode); Object.values(state.market).forEach(queueCompute); render(); toast('Demonstração ativada. Todos os preços e gráficos são fictícios.');
  }
  if (action === 'live') {
    state.demo = false; state.market = {}; render(); toast('Demonstração encerrada. Atualize as fontes para consultar dados de mercado.');
  }
  if (action === 'start-profile') { state.questionnaire = true; state.step = 0; state.answers = { ...(state.profile?.answers ?? {}) }; render(); }
  if (action === 'profile-back') { if (state.step > 0) state.step--; else state.questionnaire = false; render(); }
  if (action === 'fib') { state.fib = !state.fib; render(); }
  if (action === 'clear-token') { state.token = ''; toast('Token removido desta sessão.'); render(); }
  if (action === 'reset') { state.resetPending = true; render(); }
  if (action === 'reset-confirm') {
    for (const key of ['profile', 'wallet', 'settings', 'favorites', 'exercises']) localStorage.removeItem(`atlas.${key}`);
    state.profile = null; state.wallet = newWallet(); state.favorites = []; state.exercises = [];
    state.answers = {}; state.token = ''; state.questionnaire = false; state.resetPending = false;
    state.settings = { riskPct: .5, feeBps: 10, slippageBps: 5, fixedFee: 0 }; computed.clear(); render(); toast('Dados locais apagados.');
  }
  if (action === 'paper-open') {
    try { const s = state.market[state.selected]; state.wallet = openPaper(state.wallet, s, analysisFor(s)); save('wallet', state.wallet); nav('paper'); toast('Entrada registrada na carteira simulada. Nenhuma ordem enviada.'); }
    catch (e) { toast(e.message); }
  }
  if (action === 'export') csvExport();
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-asset]')) { e.preventDefault(); e.target.click(); } });
document.addEventListener('input', e => {
  if (e.target.id === 'search') {
    state.query = e.target.value;
    const pos = e.target.selectionStart; render(); const input = $('#search'); input.focus(); input.setSelectionRange(pos, pos);
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'asset-select') { state.selected = e.target.value; queueCompute(state.market[state.selected]); render(); }
  if (e.target.closest('#profile-form')) state.answers[e.target.name] = Number(e.target.value);
});
document.addEventListener('submit', event => {
  event.preventDefault(); const form = event.target, data = new FormData(form);
  try {
    if (form.id === 'profile-form') {
      for (const [id] of QUESTIONS.slice(state.step * 3, state.step * 3 + 3)) {
        if (!data.has(id)) throw new Error('Responda todas as perguntas desta etapa.');
        state.answers[id] = Number(data.get(id));
      }
      if (state.step < 3) state.step++;
      else { state.profile = assessProfile(state.answers); save('profile', state.profile); state.questionnaire = false; Object.values(state.market).forEach(queueCompute); toast(`Perfil ${state.profile.name.toLowerCase()} definido. Os limites já foram aplicados.`); }
      render(); window.scrollTo(0, 0);
    }
    if (form.id === 'source-form') {
      const token = String(data.get('token') ?? '').trim();
      if (!/^[A-Za-z0-9_.-]{5,500}$/.test(token)) throw new Error('Verifique o token brapi. Use apenas o token, sem o prefixo Bearer.');
      state.token = token; form.reset(); toast('Token definido para esta sessão. Atualize o mercado para consultar os ativos.');
    }
    if (form.id === 'risk-form') {
      const settings = Object.fromEntries(['riskPct', 'feeBps', 'slippageBps', 'fixedFee'].map(k => [k, Number(data.get(k))]));
      if (!Object.values(settings).every(finite) || settings.riskPct < .05 || settings.riskPct > 1 || settings.feeBps < 0 || settings.feeBps > 200 || settings.slippageBps < 0 || settings.slippageBps > 200 || settings.fixedFee < 0 || settings.fixedFee > 1000) throw new Error('Informe limites e custos válidos.');
      state.settings = settings; save('settings', settings);
      if (!state.wallet.positions.length && !state.wallet.closed.length) {
        const capital = Number(data.get('capital')); if (!finite(capital) || capital < 100 || capital > 100000000) throw new Error('Capital inválido.');
        state.wallet = { ...newWallet(), initialCapital: capital, cash: capital }; save('wallet', state.wallet);
      }
      Object.values(state.market).forEach(queueCompute); render(); toast('Limites salvos. O risco efetivo respeita seu perfil.');
    }
    if (form.id === 'exercise-form') {
      const entry = Number(data.get('entry')), exit = Number(data.get('exit')), quantity = Number(data.get('quantity'));
      if (![entry, exit, quantity].every(v => finite(v) && v > 0 && v <= 10000000)) throw new Error('Preços e quantidade devem ser positivos.');
      const rate = (state.settings.feeBps + state.settings.slippageBps) / 10000;
      const cost = (entry + exit) * quantity * rate + state.settings.fixedFee * 2;
      const pnl = (exit - entry) * quantity - cost;
      const item = { symbol: String(data.get('symbol')).slice(0, 25), entry, exit, quantity, cost, pnl, thesis: String(data.get('thesis')).slice(0, 180), at: Date.now() };
      state.exercises.push(item); save('exercises', state.exercises); render(); toast(`Exercício registrado: ${money(pnl)} após custos, antes de tributos.`);
    }
  } catch (e) { toast(e.message); }
});
window.atlasBack = () => { if (state.questionnaire) { state.questionnaire = false; render(); return true; } if (state.page !== 'radar') { nav('radar'); return true; } return false; };
render();
