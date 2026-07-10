// ============================================================
// SSMA · CAT / eSocial S-2210 (Lei 8.213/91) — emissão a partir do incidente
// com afastamento, com prazo legal e payload S-2210.
// Injetado na página SSMA (#ssmaCat). Consome /api/ssma/cat[...].
// ============================================================

const _CAT_COR = {
  'Pendente': '#d97706', 'Atrasada': '#dc2626',
  'Emitida no prazo': '#16a34a', 'Emitida com atraso': '#d97706',
}

// Render puro (testável) do painel de CAT (pendências + CATs emitidas).
function _ssmaCatHTML(pendencias, cats) {
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const p = pendencias || { total: 0, atrasadas: 0, pendentes: [] }
  const kpi = (t, v, c) => `<div class="ss-kpi" style="border-left:4px solid ${c}">
    <div class="ss-kpi-val" style="color:${c}">${v}</div><div class="ss-kpi-lbl">${t}</div></div>`
  const pendRows = (p.pendentes || []).map(x => `
    <tr>
      <td style="font-size:12px;color:var(--fa-teal)">${esc(x.numero || '—')}</td>
      <td style="font-size:12px">${esc(x.colaborador_nome || '—')}</td>
      <td style="font-size:12px;white-space:nowrap">${esc(x.data_ocorrencia || '—')}</td>
      <td style="font-size:12px;white-space:nowrap">${esc(x.prazo_legal || '—')}</td>
      <td><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${_CAT_COR[x.situacao] || '#64748b'}22;color:${_CAT_COR[x.situacao] || '#64748b'}">${esc(x.situacao)}</span></td>
      <td><button class="btn btn-sm" style="font-size:11px;padding:3px 10px;background:rgba(220,38,38,.1);color:#dc2626" onclick="ssmaGerarCat(${Number(x.id)})"><i class="fas fa-file-medical"></i> Emitir CAT</button></td>
    </tr>`).join('')
  const catRows = (cats || []).map(c => `
    <tr>
      <td style="font-size:12px;color:var(--fa-teal);font-weight:600">${esc(c.numero)}</td>
      <td style="font-size:12px">${esc(c.colaborador_nome || '—')}</td>
      <td style="font-size:12px">${esc(c.tipo || '—')}</td>
      <td style="font-size:12px;white-space:nowrap">${esc(c.data_acidente || '—')}</td>
      <td style="font-size:12px;white-space:nowrap">${esc(c.prazo_legal || '—')}</td>
      <td><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${_CAT_COR[c.situacao] || '#64748b'}22;color:${_CAT_COR[c.situacao] || '#64748b'}">${esc(c.situacao)}</span></td>
      <td><button class="btn-icon view" onclick="ssmaVerCat(${Number(c.id)})" title="Ver S-2210"><i class="fas fa-eye"></i></button></td>
    </tr>`).join('')
  return `
    <div class="ss-card" style="margin-top:16px">
      <div class="ss-card-head">
        <div class="ss-card-title"><i class="fas fa-file-medical" style="color:#dc2626"></i>CAT / eSocial S-2210 · Lei 8.213/91</div>
      </div>
      <div style="padding:12px 16px">
        <div class="ss-kpi-grid" style="margin-bottom:14px">
          ${kpi('CAT pendentes', p.total || 0, (p.total ? '#d97706' : '#16a34a'))}
          ${kpi('Atrasadas (prazo legal)', p.atrasadas || 0, (p.atrasadas ? '#dc2626' : '#16a34a'))}
          ${kpi('CAT emitidas', (cats || []).length, '#0ea5e9')}
        </div>
        ${(p.atrasadas || 0) > 0 ? `<div class="ss-alert danger" style="margin-bottom:12px">
          <i class="fas fa-gavel" style="color:#dc2626;margin-top:2px"></i>
          <div><div style="font-weight:700;color:#dc2626">${p.atrasadas} CAT fora do prazo legal</div>
          <div style="font-size:12px;color:var(--text-secondary)">Lei 8.213/91 art. 22: a CAT deve ser comunicada até o 1º dia útil seguinte ao acidente (imediato em caso de óbito). O atraso é infração administrativa.</div></div>
        </div>` : ''}
        ${(p.pendentes || []).length ? `<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:6px">Acidentes com afastamento aguardando CAT</div>
          <div class="ss-table-wrap" style="margin-bottom:16px"><table class="ss-table">
          <thead><tr><th>Incidente</th><th>Colaborador</th><th>Data</th><th>Prazo legal</th><th>Situação</th><th>Ação</th></tr></thead>
          <tbody>${pendRows}</tbody></table></div>` : ''}
        ${(cats || []).length ? `<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:6px">CAT emitidas</div>
          <div class="ss-table-wrap"><table class="ss-table">
          <thead><tr><th>Nº</th><th>Colaborador</th><th>Tipo</th><th>Acidente</th><th>Prazo legal</th><th>Situação</th><th></th></tr></thead>
          <tbody>${catRows}</tbody></table></div>`
          : ((p.pendentes || []).length ? '' : `<div style="text-align:center;padding:24px;color:var(--text-muted)"><i class="fas fa-file-medical" style="font-size:24px;color:#16a34a;display:block;margin-bottom:6px"></i>Nenhum acidente com afastamento pendente de CAT</div>`)}
      </div>
    </div>`
}

async function _carregarSsmaCat() {
  const box = document.getElementById('ssmaCat')
  if (!box || typeof apiAuth !== 'function') return
  try {
    const [pend, cats] = await Promise.all([
      apiAuth('/api/ssma/cat/pendentes/alertas'),
      apiAuth('/api/ssma/cat'),
    ])
    box.innerHTML = _ssmaCatHTML(pend, cats)
  } catch (e) { box.style.display = 'none' }
}

// Emite a CAT a partir de um incidente (id da ocorrência de SSMA).
async function ssmaGerarCat(ssmaId) {
  if (typeof openModal !== 'function') { return _postGerarCat(ssmaId, {}) }
  openModal('Emitir CAT (eSocial S-2210)', `
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Campos opcionais reforçam o evento S-2210. O prazo legal é calculado a partir da data do acidente.</div>
    <div class="form-row">
      <div class="form-group"><label>Parte atingida (cód. eSocial)</label><input class="form-control" id="cat-parte"></div>
      <div class="form-group"><label>Agente causador (cód.)</label><input class="form-control" id="cat-agente"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>CID</label><input class="form-control" id="cat-cid" placeholder="Ex.: S82"></div>
      <div class="form-group"><label>Hora do acidente (HHMM)</label><input class="form-control" id="cat-hora" placeholder="1430"></div>
    </div>
    <div class="form-group"><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="cat-obito"> Comunicação de óbito</label></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="ssmaConfirmarCat(${Number(ssmaId)})"><i class="fas fa-file-medical"></i> Emitir CAT</button>
  `)
}

function ssmaConfirmarCat(ssmaId) {
  const g = id => document.getElementById(id)
  _postGerarCat(ssmaId, {
    parte_atingida: g('cat-parte')?.value?.trim() || null,
    agente_causador: g('cat-agente')?.value?.trim() || null,
    cid: g('cat-cid')?.value?.trim() || null,
    hora_acidente: g('cat-hora')?.value?.trim() || null,
    obito: !!g('cat-obito')?.checked,
  })
}

async function _postGerarCat(ssmaId, body) {
  try {
    const cat = await apiAuth(`/api/ssma/${ssmaId}/gerar-cat`, { method: 'POST', body })
    if (typeof showToast === 'function') showToast(`${cat.numero} emitida (prazo legal ${cat.prazo_legal})`, 'success')
    if (typeof closeModal === 'function') closeModal()
    _carregarSsmaCat()
  } catch (e) {
    if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Falha ao emitir CAT', 'error')
  }
}

// Mostra o payload eSocial S-2210 da CAT (para conferência/integração).
async function ssmaVerCat(id) {
  try {
    const c = await apiAuth(`/api/ssma/cat/${id}`)
    const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
    openModal(`CAT ${esc(c.numero)} — eSocial S-2210`, `
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Colaborador: <b>${esc(c.colaborador_nome || '—')}</b> · Acidente: ${esc(c.data_acidente || '—')} · Prazo: ${esc(c.prazo_legal || '—')}</div>
      <pre style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:8px;padding:12px;font-size:11px;overflow:auto;max-height:50vh">${esc(JSON.stringify(c.s2210, null, 2))}</pre>
    `, `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`)
  } catch (e) {
    if (typeof showToast === 'function') showToast('Falha ao carregar CAT', 'error')
  }
}

window._ssmaCatHTML = _ssmaCatHTML
window._carregarSsmaCat = _carregarSsmaCat
window.ssmaGerarCat = ssmaGerarCat
window.ssmaConfirmarCat = ssmaConfirmarCat
window.ssmaVerCat = ssmaVerCat
