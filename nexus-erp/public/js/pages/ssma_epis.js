// ============================================================
// SSMA · EPIs por colaborador (NR-6) — entrega + controle de validade (CA).
// Injetado na página SSMA (#ssmaEpis). Consome /api/ssma/epis[/alertas].
// EPI vencido é passivo de segurança/legal → a validade vira alerta.
// ============================================================

const _EPI_COR = { 'Vencido': '#dc2626', 'A vencer': '#d97706', 'Válido': '#16a34a', 'Sem validade': '#64748b' }

// Render puro (testável) do painel de EPIs (alertas + tabela).
function _ssmaEpisHTML(alertas, lista) {
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const a = alertas || { vencidos: 0, a_vencer: 0, total: 0 }
  const rows = (lista || []).map(e => `
    <tr>
      <td style="font-size:12px;font-weight:600">${esc(e.colaborador_nome || '—')}</td>
      <td style="font-size:12px">${esc(e.epi)}</td>
      <td style="font-size:12px">${esc(e.ca || '—')}</td>
      <td style="font-size:12px;white-space:nowrap">${esc(e.validade || '—')}</td>
      <td><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${_EPI_COR[e.situacao] || '#64748b'}22;color:${_EPI_COR[e.situacao] || '#64748b'}">${esc(e.situacao)}</span></td>
    </tr>`).join('')
  const kpi = (t, v, c) => `<div class="ss-kpi" style="border-left:4px solid ${c}">
    <div class="ss-kpi-val" style="color:${c}">${v}</div><div class="ss-kpi-lbl">${t}</div></div>`
  return `
    <div class="ss-card" style="margin-top:16px">
      <div class="ss-card-head">
        <div class="ss-card-title"><i class="fas fa-vest" style="color:#0ea5e9"></i>EPIs por colaborador · NR-6</div>
        <button class="btn btn-primary btn-sm" onclick="ssmaAbrirNovoEpi()"><i class="fas fa-plus"></i> Registrar entrega</button>
      </div>
      <div style="padding:12px 16px">
        <div class="ss-kpi-grid" style="margin-bottom:14px">
          ${kpi('EPIs vencidos', a.vencidos || 0, (a.vencidos ? '#dc2626' : '#16a34a'))}
          ${kpi('A vencer (30d)', a.a_vencer || 0, (a.a_vencer ? '#d97706' : '#16a34a'))}
          ${kpi('Total de entregas', (lista || []).length, '#0ea5e9')}
        </div>
        ${(a.vencidos || 0) > 0 ? `<div class="ss-alert danger" style="margin-bottom:12px">
          <i class="fas fa-triangle-exclamation" style="color:#dc2626;margin-top:2px"></i>
          <div><div style="font-weight:700;color:#dc2626">${a.vencidos} EPI(s) vencido(s) em uso</div>
          <div style="font-size:12px;color:var(--text-secondary)">NR-6: substituição imediata do EPI danificado ou fora do prazo de validade.</div></div>
        </div>` : ''}
        ${(lista || []).length ? `<div class="ss-table-wrap"><table class="ss-table">
          <thead><tr><th>Colaborador</th><th>EPI</th><th>CA</th><th>Validade</th><th>Situação</th></tr></thead>
          <tbody>${rows}</tbody></table></div>`
          : `<div style="text-align:center;padding:24px;color:var(--text-muted)"><i class="fas fa-vest" style="font-size:24px;color:#0ea5e9;display:block;margin-bottom:6px"></i>Nenhuma entrega de EPI registrada</div>`}
      </div>
    </div>`
}

async function _carregarSsmaEpis() {
  const box = document.getElementById('ssmaEpis')
  if (!box || typeof apiAuth !== 'function') return
  try {
    const [alertas, lista] = await Promise.all([
      apiAuth('/api/ssma/epis/alertas'),
      apiAuth('/api/ssma/epis'),
    ])
    box.innerHTML = _ssmaEpisHTML(alertas, lista)
  } catch (e) { box.style.display = 'none' }
}

// Modal de registro: carrega colaboradores do tenant e envia a entrega.
async function ssmaAbrirNovoEpi() {
  if (typeof openModal !== 'function') return
  let colabs = []
  try { colabs = await apiAuth('/api/colaboradores') } catch (e) { colabs = [] }
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const opts = (colabs || []).map(c => `<option value="${c.id}">${esc(c.nome)}${c.cargo ? ' — ' + esc(c.cargo) : ''}</option>`).join('')
  openModal('Registrar entrega de EPI (NR-6)', `
    <div class="form-group">
      <label>Colaborador *</label>
      <select class="form-control" id="epi-colab">${opts || '<option value="">Nenhum colaborador cadastrado</option>'}</select>
    </div>
    <div class="form-row">
      <div class="form-group"><label>EPI *</label><input class="form-control" id="epi-nome" placeholder="Ex.: Capacete classe B"></div>
      <div class="form-group"><label>CA</label><input class="form-control" id="epi-ca" placeholder="Certificado de Aprovação"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Data de entrega</label><input class="form-control" type="date" id="epi-data" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="form-group"><label>Validade (CA/vida útil)</label><input class="form-control" type="date" id="epi-validade"></div>
    </div>
    <div class="form-group"><label>Quantidade</label><input class="form-control" type="number" id="epi-qtd" value="1" min="1"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="ssmaSalvarEpi()"><i class="fas fa-save"></i> Registrar</button>
  `)
}

async function ssmaSalvarEpi() {
  const g = id => document.getElementById(id)
  const body = {
    colaborador_id: g('epi-colab')?.value,
    epi: g('epi-nome')?.value?.trim(),
    ca: g('epi-ca')?.value?.trim() || null,
    data_entrega: g('epi-data')?.value || null,
    validade: g('epi-validade')?.value || null,
    quantidade: parseInt(g('epi-qtd')?.value) || 1,
  }
  if (!body.colaborador_id || !body.epi) {
    if (typeof showToast === 'function') showToast('Informe o colaborador e o EPI', 'warning')
    return
  }
  try {
    await apiAuth('/api/ssma/epis', { method: 'POST', body })
    if (typeof showToast === 'function') showToast('Entrega de EPI registrada', 'success')
    if (typeof closeModal === 'function') closeModal()
    _carregarSsmaEpis()
  } catch (e) {
    if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Falha ao registrar EPI', 'error')
  }
}

window._ssmaEpisHTML = _ssmaEpisHTML
window._carregarSsmaEpis = _carregarSsmaEpis
window.ssmaAbrirNovoEpi = ssmaAbrirNovoEpi
window.ssmaSalvarEpi = ssmaSalvarEpi
