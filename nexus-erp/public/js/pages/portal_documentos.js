// ============================================================
// Portal do Fornecedor · Documentos com validade + acessos + senha.
// Consome /api/portal/documentos, /acessos e /trocar-senha.
// ============================================================

// Render puro (testável) da seção de documentos.
function _portalDocsHTML(d) {
  if (!d) return ''
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const lista = Array.isArray(d.documentos) ? d.documentos : []
  const r = d.resumo || {}
  const chip = s => ({
    'Vencido': '<span style="color:#dc2626;font-size:11px;font-weight:600">⚠ Vencido</span>',
    'A vencer': '<span style="color:#d97706;font-size:11px;font-weight:600">A vencer</span>',
    'Válido': '<span style="color:#16a34a;font-size:11px;font-weight:600">✓ Válido</span>',
  }[s] || `<span style="color:var(--text-muted);font-size:11px">${s || '—'}</span>`)
  const alerta = r.vencidos ? `<span style="color:#dc2626;font-size:12px;font-weight:600">${r.vencidos} vencido(s) — renove para seguir cotando</span>`
    : (r.a_vencer ? `<span style="color:#d97706;font-size:12px">${r.a_vencer} a vencer em 30 dias</span>`
      : `<span style="color:#16a34a;font-size:12px">documentação em dia</span>`)
  const linhas = lista.length ? lista.map(x => `<tr style="${x.vigente ? '' : 'opacity:.55'}">
      <td style="padding:6px 8px">${esc(x.tipo)}${x.vigente ? '' : ' <span style="font-size:10px;color:var(--text-muted)">(substituído)</span>'}</td>
      <td style="padding:6px 8px">${x.arquivo_id ? `<a href="#" onclick="portalBaixarArquivo(${x.arquivo_id},'${esc(x.arquivo_nome || 'arquivo').replace(/'/g, '')}');return false" style="color:var(--fa-teal);text-decoration:underline"><i class="fas fa-download"></i> ${esc(x.arquivo_nome || 'arquivo')}</a>` : esc(x.arquivo_nome || '—')}</td>
      <td style="padding:6px 8px">${esc(x.validade || 'sem validade')}</td>
      <td style="padding:6px 8px">${x.vigente ? chip(x.situacao) : '—'}</td>
    </tr>`).join('') : `<tr><td colspan="4" style="padding:8px;color:var(--text-muted)">Nenhum documento enviado.</td></tr>`
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <strong style="font-size:14px"><i class="fas fa-folder-open" style="margin-right:6px"></i>Meus Documentos</strong>
      <div style="display:flex;gap:8px;align-items:center">${alerta}
        <button class="btn btn-primary btn-sm" style="padding:2px 10px;font-size:11px" onclick="portalNovoDocumento()"><i class="fas fa-plus"></i> Enviar documento</button>
      </div>
    </div>
    <table class="table" style="width:100%;margin-top:10px;font-size:12px;border-collapse:collapse">
      <thead><tr style="color:var(--text-muted);text-align:left">
        <th style="padding:6px 8px">Tipo</th><th style="padding:6px 8px">Arquivo</th>
        <th style="padding:6px 8px">Validade</th><th style="padding:6px 8px">Situação</th>
      </tr></thead><tbody>${linhas}</tbody>
    </table>`
}

async function _portalCarregarDocs() {
  const box = document.getElementById('portal_docs')
  if (!box || typeof apiAuth !== 'function') return
  try { box.innerHTML = _portalDocsHTML(await apiAuth('/api/portal/documentos')) }
  catch (e) { box.style.display = 'none' }
}

function portalNovoDocumento() {
  if (typeof openModal !== 'function') return
  openModal('Enviar documento', `
    <div class="form-group"><label>Tipo *</label>
      <input class="form-control" id="pdoc_tipo" list="pdoc_tipos" placeholder="Ex.: CND Federal">
      <datalist id="pdoc_tipos">
        <option>CND Federal</option><option>CND Estadual</option><option>CRF FGTS</option>
        <option>CNDT Trabalhista</option><option>Contrato Social</option><option>Certificado ISO 9001</option>
      </datalist></div>
    <div class="form-row">
      <div class="form-group"><label>Validade</label><input class="form-control" id="pdoc_val" type="date"></div>
      <div class="form-group"><label>Número</label><input class="form-control" id="pdoc_num"></div>
    </div>
    <div class="form-group"><label>Arquivo (PDF/imagem/office)</label><input class="form-control" id="pdoc_file" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.xml,.zip"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="portalEnviarDocumento()"><i class="fas fa-upload"></i> Enviar</button>
  `)
}

async function portalEnviarDocumento() {
  const tipo = ((document.getElementById('pdoc_tipo') || {}).value || '').trim()
  if (!tipo) { showToast('Informe o tipo do documento', 'warning'); return }
  try {
    // Upload real do arquivo escolhido (se houver) → arquivo_id.
    let arquivo_id = null, arquivo_nome = null
    const fileEl = document.getElementById('pdoc_file')
    const file = fileEl && fileEl.files && fileEl.files[0]
    if (file && typeof portalUploadArquivo === 'function') {
      const arq = await portalUploadArquivo(file)
      arquivo_id = arq && arq.id; arquivo_nome = arq && arq.nome
    }
    await apiAuth('/api/portal/documentos', { method: 'POST', body: JSON.stringify({
      tipo,
      validade: (document.getElementById('pdoc_val') || {}).value || '',
      numero: (document.getElementById('pdoc_num') || {}).value || '',
      arquivo_id, arquivo_nome,
    }) })
    if (typeof closeModal === 'function') closeModal()
    showToast('Documento enviado — o compliance foi avisado', 'success')
    _portalCarregarDocs()
  } catch (e) { showToast(e && e.message ? e.message : 'Falha ao enviar documento', 'error') }
}

// Segurança: histórico de acessos + troca de senha.
async function portalVerAcessos() {
  if (typeof openModal !== 'function' || typeof apiAuth !== 'function') return
  let acessos = []
  try { acessos = await apiAuth('/api/portal/acessos') } catch (e) { showToast(e.message, 'error'); return }
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const linhas = (acessos || []).map(a => `<tr><td style="padding:4px 8px">${esc(a.quando)}</td><td style="padding:4px 8px">${esc(a.ip || '—')}</td></tr>`).join('')
  openModal('Histórico de acessos', `
    <p style="font-size:12px;color:var(--text-muted)">Últimos acessos da sua conta ao portal. Não reconhece algum? Troque a senha.</p>
    <table class="table" style="width:100%;font-size:12px;border-collapse:collapse">
      <thead><tr style="color:var(--text-muted);text-align:left"><th style="padding:4px 8px">Quando (UTC)</th><th style="padding:4px 8px">IP</th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="2" style="padding:8px">Sem registros.</td></tr>'}</tbody>
    </table>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
      <button class="btn btn-primary" onclick="portalTrocarSenha()"><i class="fas fa-key"></i> Trocar senha</button>`)
}

function portalTrocarSenha() {
  if (typeof openModal !== 'function') return
  openModal('Trocar senha', `
    <div class="form-group"><label>Senha atual *</label><input class="form-control" id="psen_atual" type="password"></div>
    <div class="form-group"><label>Nova senha * (mín. 8, maiúscula, minúscula e número)</label><input class="form-control" id="psen_nova" type="password"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="portalConfirmarTrocaSenha()"><i class="fas fa-key"></i> Trocar</button>
  `)
}

async function portalConfirmarTrocaSenha() {
  const atual = (document.getElementById('psen_atual') || {}).value || ''
  const nova = (document.getElementById('psen_nova') || {}).value || ''
  if (!atual || !nova) { showToast('Preencha as duas senhas', 'warning'); return }
  try {
    await apiAuth('/api/portal/trocar-senha', { method: 'POST', body: JSON.stringify({ senha_atual: atual, senha_nova: nova }) })
    if (typeof closeModal === 'function') closeModal()
    showToast('Senha alterada. Suas outras sessões foram encerradas.', 'success')
  } catch (e) { showToast(e && e.message ? e.message : 'Falha ao trocar a senha', 'error') }
}

window._portalDocsHTML = _portalDocsHTML
window._portalCarregarDocs = _portalCarregarDocs
window.portalNovoDocumento = portalNovoDocumento
window.portalEnviarDocumento = portalEnviarDocumento
window.portalVerAcessos = portalVerAcessos
window.portalTrocarSenha = portalTrocarSenha
window.portalConfirmarTrocaSenha = portalConfirmarTrocaSenha
