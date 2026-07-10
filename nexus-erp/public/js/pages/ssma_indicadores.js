// ============================================================
// SSMA · Indicadores HSE reais (TF/TG/dias sem acidente) do servidor.
// Injetado na página SSMA (#ssmaIndicadores). Consome /api/ssma/indicadores.
// ============================================================

// Render puro (testável) do painel de indicadores.
function _ssmaIndicadoresHTML(d) {
  if (!d) return ''
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const kpi = (t, v, sub, c) => `<div class="stat-card" style="flex:1;min-width:140px">
    <div class="stat-label">${t}</div>
    <div class="stat-value" style="color:${c || '#0f172a'}">${v}</div>
    ${sub ? `<div style="font-size:11px;color:var(--text-muted)">${sub}</div>` : ''}
  </div>`
  const dias = d.dias_sem_acidente == null ? '—' : d.dias_sem_acidente
  const corDias = d.dias_sem_acidente == null ? '#0f172a' : (d.dias_sem_acidente >= 30 ? '#16a34a' : '#d97706')
  const cats = (d.por_gravidade || []).map(g => `<span style="font-size:11px;margin-right:10px">${esc(g.gravidade)}: <b>${g.qtd}</b></span>`).join('')
  return `
    <div style="margin-bottom:6px;font-size:12px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em"><i class="fas fa-shield-heart"></i> Indicadores HSE (ano) · NBR 14280</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">
      ${kpi('Dias sem acidente', dias, d.ultimo_acidente ? 'último em ' + esc(d.ultimo_acidente) : 'nenhum registrado', corDias)}
      ${kpi('Taxa de Frequência (TF)', d.tf == null ? '—' : d.tf, 'acid. c/ afast. × 1M/HHT', (d.tf ? '#dc2626' : '#16a34a'))}
      ${kpi('Taxa de Gravidade (TG)', d.tg == null ? '—' : d.tg, 'dias perdidos × 1M/HHT', (d.tg ? '#dc2626' : '#16a34a'))}
      ${kpi('Com afastamento', d.com_afastamento || 0, (d.dias_perdidos || 0) + ' dia(s) perdido(s)', (d.com_afastamento ? '#d97706' : '#16a34a'))}
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">
      ${d.total || 0} ocorrência(s) · ${cats || 'sem classificação'}
      ${d.tf == null ? ' · <span style="color:#d97706">informe as horas-homem (HHT) para TF/TG</span>' : ''}
    </div>`
}

async function _carregarSsmaIndicadores() {
  const box = document.getElementById('ssmaIndicadores')
  if (!box || typeof apiAuth !== 'function') return
  try { box.innerHTML = _ssmaIndicadoresHTML(await apiAuth('/api/ssma/indicadores')) }
  catch (e) { box.style.display = 'none' }
}

window._ssmaIndicadoresHTML = _ssmaIndicadoresHTML
window._carregarSsmaIndicadores = _carregarSsmaIndicadores
