/**
 * pages/bi.js — Dashboard BI (KPIs gerenciais consolidados)
 * Exposição financeira, governança do gate, homologação de fornecedores,
 * taxa de entrega e alertas por severidade. Dados 100% do servidor.
 */
async function renderBI() {
  const main = document.getElementById('mainContent') || document.getElementById('main');
  if (!main) return;
  if (typeof apiAuth !== 'function') { main.innerHTML = '<p style="padding:40px">Painel indisponível offline.</p>'; return; }
  const money = v => typeof fmt === 'function' ? fmt(v) : ('R$ ' + (v || 0).toLocaleString('pt-BR'));

  main.innerHTML = `
    <div class="page-header"><h2><i class="fas fa-chart-line" style="color:var(--fa-teal);margin-right:10px"></i>Dashboard BI</h2>
      <p>Indicadores gerenciais consolidados — financeiro, gate, fornecedores e entregas.</p></div>
    <div id="bi_body"><i class="fas fa-spinner fa-spin"></i> Carregando KPIs...</div>`;

  try {
    const k = await apiAuth('/api/bi?dias=30');
    const card = (titulo, valor, sub, cor) => `
      <div class="info-card" style="padding:16px;min-width:170px;flex:1">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">${titulo}</div>
        <div style="font-size:22px;font-weight:700;color:${cor || 'var(--text)'};margin-top:4px">${valor}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${sub || ''}</div>
      </div>`;
    const bar = (label, pct, cor) => `
      <div style="margin:6px 0">
        <div style="display:flex;justify-content:space-between;font-size:11px"><span>${label}</span><span>${pct}%</span></div>
        <div style="height:7px;background:rgba(0,0,0,.08);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${Math.min(pct, 100)}%;background:${cor}"></div></div>
      </div>`;

    const f = k.financeiro, g = k.gate, fo = k.fornecedores, c = k.compras, al = k.alertas;
    const statusRows = fo.por_status.map(s => `<span style="font-size:11px;background:rgba(0,0,0,.05);padding:2px 8px;border-radius:10px;margin-right:6px">${s.status}: <b>${s.n}</b></span>`).join('');

    document.getElementById('bi_body').innerHTML = `
      <h3 style="font-size:14px;margin:6px 0 8px"><i class="fas fa-file-invoice-dollar"></i> Exposição financeira</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px">
        ${card('A pagar', money(f.a_pagar_valor), `${f.a_pagar_qtd} conta(s)`, '#2563eb')}
        ${card('Vencido', money(f.vencido_valor), `${f.vencido_qtd} em atraso`, '#dc2626')}
        ${card('A vencer (' + k.dias + 'd)', money(f.a_vencer_valor), `${f.a_vencer_qtd} conta(s)`, '#d97706')}
        ${card('Pago', money(f.pago_valor), 'acumulado', '#16a34a')}
      </div>

      <div style="display:flex;gap:18px;flex-wrap:wrap">
        <div class="info-card" style="padding:16px;flex:1;min-width:260px">
          <h3 style="font-size:14px;margin:0 0 8px"><i class="fas fa-shield-halved"></i> Governança do gate</h3>
          ${bar('Taxa de bloqueio', Math.round(g.taxa_bloqueio * 100), g.taxa_bloqueio > 0.3 ? '#dc2626' : '#16a34a')}
          <div style="font-size:12px;color:var(--text-muted);margin-top:6px">${g.bloqueios} bloqueio(s) · ${g.liberados} liberado(s)</div>
        </div>
        <div class="info-card" style="padding:16px;flex:1;min-width:260px">
          <h3 style="font-size:14px;margin:0 0 8px"><i class="fas fa-truck"></i> Entregas (pedidos)</h3>
          ${bar('Taxa de entrega', c.pc_entregues_pct, '#16a34a')}
          <div style="font-size:12px;color:var(--text-muted);margin-top:6px">${c.pc_entregues}/${c.pc_total} entregues · valor ativo ${money(c.pc_valor_ativo)}</div>
        </div>
      </div>

      <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:18px">
        <div class="info-card" style="padding:16px;flex:1;min-width:260px">
          <h3 style="font-size:14px;margin:0 0 8px"><i class="fas fa-handshake"></i> Fornecedores</h3>
          <div style="font-size:22px;font-weight:700">${fo.ativos} <span style="font-size:12px;color:var(--text-muted);font-weight:400">ativos · score médio ${fo.score_medio}</span></div>
          <div style="margin-top:8px">${statusRows || '—'}</div>
        </div>
        <div class="info-card" style="padding:16px;flex:1;min-width:260px">
          <h3 style="font-size:14px;margin:0 0 8px"><i class="fas fa-bell"></i> Alertas abertos</h3>
          <div style="display:flex;gap:16px;align-items:baseline">
            <div><span style="font-size:26px;font-weight:700;color:#dc2626">${al.alta}</span> <span style="font-size:11px">alta</span></div>
            <div><span style="font-size:26px;font-weight:700;color:#d97706">${al.media}</span> <span style="font-size:11px">média</span></div>
            <div><span style="font-size:18px;font-weight:600">${al.total}</span> <span style="font-size:11px">total</span></div>
          </div>
          <a href="#" onclick="navigate('alertas')" style="font-size:12px;display:inline-block;margin-top:8px">Ver central de alertas →</a>
        </div>
      </div>
      <div id="bi_fluxo" style="margin-top:18px"></div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:16px">Gerado em ${new Date(k.gerado_em).toLocaleString('pt-BR')}</div>`;
    renderFluxoCaixa(money);
  } catch (e) {
    document.getElementById('bi_body').innerHTML = `<div style="color:#dc2626;font-size:13px">${e.message}</div>`;
  }
}

// Bloco de fluxo de caixa (saídas) — comparativo semanal planejado × realizado.
async function renderFluxoCaixa(money) {
  const box = document.getElementById('bi_fluxo');
  if (!box) return;
  try {
    const fx = await apiAuth('/api/fluxo-caixa?semanas=8');
    const sd = v => `<span style="color:${v > 0 ? '#dc2626' : (v < 0 ? '#16a34a' : 'var(--text-muted)')}">${v > 0 ? '+' : ''}${money(v)}</span>`;
    const linhas = fx.semanas.map(s => `
      <tr>
        <td style="padding:5px 8px">${s.inicio}</td>
        <td style="padding:5px 8px;text-align:right">${money(s.planejado)}</td>
        <td style="padding:5px 8px;text-align:right">${money(s.realizado)}</td>
        <td style="padding:5px 8px;text-align:right">${sd(s.desvio)}</td>
      </tr>`).join('');
    const top = fx.por_contrato.slice(0, 5).map(c => `
      <tr><td style="padding:4px 8px">${c.contrato}</td>
        <td style="padding:4px 8px;text-align:right">${money(c.planejado)}</td>
        <td style="padding:4px 8px;text-align:right">${money(c.realizado)}</td>
        <td style="padding:4px 8px;text-align:right">${sd(c.desvio)}</td></tr>`).join('');
    box.innerHTML = `
      <div class="info-card" style="padding:16px">
        <h3 style="font-size:14px;margin:0 0 8px"><i class="fas fa-money-bill-trend-up"></i> Fluxo de caixa (saídas) — planejado × realizado</h3>
        <div style="display:flex;gap:24px;flex-wrap:wrap">
          <div style="flex:1;min-width:300px">
            <table class="table" style="width:100%;font-size:12px;border-collapse:collapse">
              <thead><tr style="color:var(--text-muted);text-align:left">
                <th style="padding:5px 8px">Semana</th><th style="padding:5px 8px;text-align:right">Planejado</th>
                <th style="padding:5px 8px;text-align:right">Realizado</th><th style="padding:5px 8px;text-align:right">Desvio</th>
              </tr></thead><tbody>${linhas}</tbody>
            </table>
          </div>
          <div style="flex:1;min-width:300px">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">Maiores desvios por contrato</div>
            <table class="table" style="width:100%;font-size:12px;border-collapse:collapse">
              <thead><tr style="color:var(--text-muted);text-align:left">
                <th style="padding:4px 8px">Contrato</th><th style="padding:4px 8px;text-align:right">Plan.</th>
                <th style="padding:4px 8px;text-align:right">Real.</th><th style="padding:4px 8px;text-align:right">Desvio</th>
              </tr></thead><tbody>${top || '<tr><td style="padding:6px 8px;color:var(--text-muted)" colspan="4">Sem movimento na janela.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </div>`;
  } catch (e) {
    box.innerHTML = `<div style="color:#dc2626;font-size:12px">Fluxo de caixa indisponível: ${e.message}</div>`;
  }
}

window.renderBI = renderBI;
