/**
 * pages/alertas.js — Central de Alertas
 * Feed único e acionável: contas vencidas/a vencer, entregas atrasadas e
 * retenção LGPD pendente, ordenados por severidade. Dados 100% do servidor.
 */
const SEV_COR = { alta: '#dc2626', media: '#d97706', baixa: '#2563eb' };
const SEV_LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const MOD_ICON = { Financeiro: 'file-invoice-dollar', Compras: 'truck', LGPD: 'user-shield', Contratos: 'file-contract' };

async function renderAlertas() {
  const main = document.getElementById('mainContent') || document.getElementById('main');
  if (!main) return;
  if (typeof apiAuth !== 'function') { main.innerHTML = '<p style="padding:40px">Central indisponível offline.</p>'; return; }

  const dias = window._alertasDias || 7;
  main.innerHTML = `
    <div class="page-header"><h2><i class="fas fa-bell" style="color:var(--fa-teal);margin-right:10px"></i>Central de Alertas</h2>
      <p>Pendências acionáveis dos módulos, reunidas e priorizadas.</p></div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px">
      <label style="font-size:12px;color:var(--text-muted)">Janela de vencimento:</label>
      <select class="form-control" style="width:auto" onchange="window._alertasDias=parseInt(this.value);renderAlertas()">
        ${[7, 15, 30, 60].map(n => `<option value="${n}" ${n === dias ? 'selected' : ''}>${n} dias</option>`).join('')}
      </select>
    </div>
    <div id="alertas_resumo" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"></div>
    <div id="alertas_lista" class="info-card" style="padding:16px"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>`;

  try {
    const data = await apiAuth(`/api/alertas?dias=${dias}`);
    const { resumo, alertas } = data;
    document.getElementById('alertas_resumo').innerHTML = [
      ['Total', resumo.total, 'var(--text)'],
      ['Alta', resumo.alta, SEV_COR.alta],
      ['Média', resumo.media, SEV_COR.media],
    ].map(([k, v, cor]) => `
      <div class="info-card" style="padding:14px 20px;min-width:110px;text-align:center">
        <div style="font-size:26px;font-weight:700;color:${cor}">${v}</div>
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">${k}</div>
      </div>`).join('');

    const lista = document.getElementById('alertas_lista');
    if (!alertas.length) { lista.innerHTML = '<p style="font-size:13px;color:#16a34a"><i class="fas fa-check-circle"></i> Nenhuma pendência. Tudo em dia.</p>'; return; }
    lista.innerHTML = alertas.map(a => `
      <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 8px;border-left:3px solid ${SEV_COR[a.severidade] || '#999'};margin-bottom:8px;background:var(--bg-subtle,rgba(0,0,0,0.02))">
        <i class="fas fa-${MOD_ICON[a.modulo] || 'exclamation-circle'}" style="color:${SEV_COR[a.severidade]};margin-top:3px"></i>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600">${a.titulo}</div>
          <div style="font-size:12px;color:var(--text-muted)">${a.descricao || ''}</div>
        </div>
        <div style="text-align:right;white-space:nowrap">
          <span style="font-size:10px;font-weight:700;color:#fff;background:${SEV_COR[a.severidade]};padding:2px 7px;border-radius:10px">${SEV_LABEL[a.severidade] || a.severidade}</span>
          ${a.valor != null ? `<div style="font-size:12px;margin-top:4px">${a.modulo === 'Financeiro' && typeof fmt === 'function' ? fmt(a.valor) : a.valor}</div>` : ''}
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${a.modulo}</div>
        </div>
      </div>`).join('');
  } catch (e) {
    document.getElementById('alertas_lista').innerHTML = `<div style="color:#dc2626;font-size:13px">${e.message}</div>`;
  }
}

window.renderAlertas = renderAlertas;
