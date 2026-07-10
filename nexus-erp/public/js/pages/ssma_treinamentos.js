// ============================================================
// SSMA · Treinamentos/matriz NR por colaborador (NR-1 §1.7) — habilitação com
// controle de validade e BLOQUEIO de atividade de risco vencida.
// Injetado na página SSMA (#ssmaTreinamentos). Consome /api/ssma/treinamentos[/alertas].
// ============================================================

const _TRE_COR = { 'Vencido': '#dc2626', 'A vencer': '#d97706', 'Válido': '#16a34a', 'Sem validade': '#64748b' }

// Render puro (testável) do painel de treinamentos (alertas + tabela).
function _ssmaTreinamentosHTML(alertas, lista) {
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const a = alertas || { vencidos: 0, a_vencer: 0, bloqueantes: 0, total: 0 }
  const rows = (lista || []).map(t => `
    <tr>
      <td style="font-size:12px;font-weight:600">${esc(t.colaborador_nome || '—')}</td>
      <td style="font-size:12px">${esc(t.tipo)}${t.bloqueia_risco ? ' <i class="fas fa-lock" title="Bloqueia atividade de risco se vencido" style="color:#dc2626;font-size:10px"></i>' : ''}</td>
      <td style="font-size:12px">${esc(t.descricao || '—')}</td>
      <td style="font-size:12px;white-space:nowrap">${esc(t.validade || '—')}</td>
      <td><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${_TRE_COR[t.situacao] || '#64748b'}22;color:${_TRE_COR[t.situacao] || '#64748b'}">${esc(t.situacao)}</span></td>
    </tr>`).join('')
  const kpi = (t, v, c) => `<div class="ss-kpi" style="border-left:4px solid ${c}">
    <div class="ss-kpi-val" style="color:${c}">${v}</div><div class="ss-kpi-lbl">${t}</div></div>`
  return `
    <div class="ss-card" style="margin-top:16px">
      <div class="ss-card-head">
        <div class="ss-card-title"><i class="fas fa-graduation-cap" style="color:#7c3aed"></i>Treinamentos / matriz NR · NR-1 §1.7</div>
        <button class="btn btn-primary btn-sm" onclick="ssmaAbrirNovoTreinamento()"><i class="fas fa-plus"></i> Registrar treinamento</button>
      </div>
      <div style="padding:12px 16px">
        <div class="ss-kpi-grid" style="margin-bottom:14px">
          ${kpi('Bloqueiam risco', a.bloqueantes || 0, (a.bloqueantes ? '#dc2626' : '#16a34a'))}
          ${kpi('Vencidos', a.vencidos || 0, (a.vencidos ? '#dc2626' : '#16a34a'))}
          ${kpi('A vencer (30d)', a.a_vencer || 0, (a.a_vencer ? '#d97706' : '#16a34a'))}
          ${kpi('Total de registros', (lista || []).length, '#7c3aed')}
        </div>
        ${(a.bloqueantes || 0) > 0 ? `<div class="ss-alert danger" style="margin-bottom:12px">
          <i class="fas fa-user-lock" style="color:#dc2626;margin-top:2px"></i>
          <div><div style="font-weight:700;color:#dc2626">${a.bloqueantes} treinamento(s) de risco vencido(s) — colaborador BLOQUEADO</div>
          <div style="font-size:12px;color:var(--text-secondary)">NR-1 §1.7 / NR-7: colaborador com NR-10, NR-35, NR-33 ou ASO vencido não pode exercer a atividade de risco.</div></div>
        </div>` : ''}
        ${(lista || []).length ? `<div class="ss-table-wrap"><table class="ss-table">
          <thead><tr><th>Colaborador</th><th>Treinamento</th><th>Descrição</th><th>Validade</th><th>Situação</th></tr></thead>
          <tbody>${rows}</tbody></table></div>`
          : `<div style="text-align:center;padding:24px;color:var(--text-muted)"><i class="fas fa-graduation-cap" style="font-size:24px;color:#7c3aed;display:block;margin-bottom:6px"></i>Nenhum treinamento registrado</div>`}
      </div>
    </div>`
}

async function _carregarSsmaTreinamentos() {
  const box = document.getElementById('ssmaTreinamentos')
  if (!box || typeof apiAuth !== 'function') return
  try {
    const [alertas, lista] = await Promise.all([
      apiAuth('/api/ssma/treinamentos/alertas'),
      apiAuth('/api/ssma/treinamentos'),
    ])
    box.innerHTML = _ssmaTreinamentosHTML(alertas, lista)
  } catch (e) { box.style.display = 'none' }
}

async function ssmaAbrirNovoTreinamento() {
  if (typeof openModal !== 'function') return
  let colabs = []
  try { colabs = await apiAuth('/api/colaboradores') } catch (e) { colabs = [] }
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const opts = (colabs || []).map(c => `<option value="${c.id}">${esc(c.nome)}${c.cargo ? ' — ' + esc(c.cargo) : ''}</option>`).join('')
  const nrs = ['NR-10', 'NR-35', 'NR-33', 'NR-34', 'NR-18', 'NR-22', 'NR-12', 'NR-05', 'NR-06', 'ASO', 'Integração', 'Outro']
  openModal('Registrar treinamento / certificação (NR-1 §1.7)', `
    <div class="form-group">
      <label>Colaborador *</label>
      <select class="form-control" id="tre-colab">${opts || '<option value="">Nenhum colaborador cadastrado</option>'}</select>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Treinamento *</label>
        <select class="form-control" id="tre-tipo">${nrs.map(n => `<option>${n}</option>`).join('')}</select></div>
      <div class="form-group"><label>Carga horária</label><input class="form-control" type="number" id="tre-ch" placeholder="horas"></div>
    </div>
    <div class="form-group"><label>Descrição / turma</label><input class="form-control" id="tre-desc" placeholder="Ex.: Trabalho em altura — reciclagem"></div>
    <div class="form-row">
      <div class="form-group"><label>Data de realização</label><input class="form-control" type="date" id="tre-data" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="form-group"><label>Validade</label><input class="form-control" type="date" id="tre-validade"></div>
    </div>
    <div class="form-group"><label>Instrutor</label><input class="form-control" id="tre-instrutor"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="ssmaSalvarTreinamento()"><i class="fas fa-save"></i> Registrar</button>
  `)
}

async function ssmaSalvarTreinamento() {
  const g = id => document.getElementById(id)
  const body = {
    colaborador_id: g('tre-colab')?.value,
    tipo: g('tre-tipo')?.value,
    descricao: g('tre-desc')?.value?.trim() || null,
    data_realizacao: g('tre-data')?.value || null,
    validade: g('tre-validade')?.value || null,
    carga_horaria: g('tre-ch')?.value ? Number(g('tre-ch').value) : null,
    instrutor: g('tre-instrutor')?.value?.trim() || null,
  }
  if (!body.colaborador_id || !body.tipo) {
    if (typeof showToast === 'function') showToast('Informe o colaborador e o treinamento', 'warning')
    return
  }
  try {
    await apiAuth('/api/ssma/treinamentos', { method: 'POST', body })
    if (typeof showToast === 'function') showToast('Treinamento registrado', 'success')
    if (typeof closeModal === 'function') closeModal()
    _carregarSsmaTreinamentos()
  } catch (e) {
    if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Falha ao registrar treinamento', 'error')
  }
}

window._ssmaTreinamentosHTML = _ssmaTreinamentosHTML
window._carregarSsmaTreinamentos = _carregarSsmaTreinamentos
window.ssmaAbrirNovoTreinamento = ssmaAbrirNovoTreinamento
window.ssmaSalvarTreinamento = ssmaSalvarTreinamento
