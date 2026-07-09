// ============================================================
// Comprador · Convites de fornecedor (onboarding self-service).
// Convida por e-mail (fornecedor novo ou existente), mostra o link do
// convite e a situação de cada um. Consome /api/fornecedor-convites.
// ============================================================

// Render puro (testável) da lista de convites.
function _convitesHTML(convites) {
  const lista = Array.isArray(convites) ? convites : []
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const chip = s => ({
    aceito: '<span style="color:#16a34a;font-size:11px;font-weight:600">✓ Aceito</span>',
    expirado: '<span style="color:#dc2626;font-size:11px;font-weight:600">Expirado</span>',
    pendente: '<span style="color:#d97706;font-size:11px;font-weight:600">Pendente</span>',
  }[s] || `<span style="color:var(--text-muted);font-size:11px">${esc(s || '—')}</span>`)
  const linhas = lista.length ? lista.map(c => `<tr>
      <td style="padding:6px 8px">${esc(c.fornecedor_nome || '—')}</td>
      <td style="padding:6px 8px">${esc(c.email)}</td>
      <td style="padding:6px 8px">${chip(c.situacao)}</td>
      <td style="padding:6px 8px">${esc(String(c.expira_em || '').slice(0, 10))}</td>
    </tr>`).join('') : `<tr><td colspan="4" style="padding:8px;color:var(--text-muted)">Nenhum convite enviado ainda.</td></tr>`
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <strong style="font-size:14px"><i class="fas fa-user-plus" style="margin-right:6px"></i>Convites de acesso ao portal</strong>
      <button class="btn btn-primary btn-sm" onclick="abrirConvidarFornecedor()"><i class="fas fa-paper-plane"></i> Convidar fornecedor</button>
    </div>
    <table class="table" style="width:100%;margin-top:10px;font-size:12px;border-collapse:collapse">
      <thead><tr style="color:var(--text-muted);text-align:left">
        <th style="padding:6px 8px">Fornecedor</th><th style="padding:6px 8px">E-mail</th>
        <th style="padding:6px 8px">Situação</th><th style="padding:6px 8px">Expira</th>
      </tr></thead><tbody>${linhas}</tbody>
    </table>`
}

async function renderConvitesFornecedor() {
  const el = document.getElementById('mainContent')
  if (!el) return
  el.innerHTML = `
    <div class="page-header">
      <div><h1><i class="fas fa-user-plus"></i> Onboarding de Fornecedores</h1>
        <p class="page-subtitle">Convide fornecedores para se cadastrarem sozinhos no portal.</p></div>
      <button class="btn btn-secondary btn-sm" onclick="renderConvitesFornecedor()"><i class="fas fa-sync-alt"></i> Atualizar</button>
    </div>
    <div id="convitesLista" class="card"><div class="card-body"><p style="color:#888">Carregando...</p></div></div>`
  await _carregarConvites()
}

async function _carregarConvites() {
  const box = document.getElementById('convitesLista')
  if (!box) return
  try {
    const convites = await apiAuth('/api/fornecedor-convites')
    box.innerHTML = `<div class="card-body">${_convitesHTML(convites)}</div>`
  } catch (e) {
    box.innerHTML = `<div class="card-body"><p style="color:#dc2626">Sem acesso à gestão de convites (perfil comprador/admin).</p></div>`
  }
}

function abrirConvidarFornecedor() {
  if (typeof openModal !== 'function') return
  openModal('Convidar fornecedor', `
    <p style="font-size:12px;color:var(--text-muted)">Um link será gerado para o fornecedor criar o próprio acesso. Envie-o por e-mail.</p>
    <div class="form-group"><label>E-mail do fornecedor *</label><input class="form-control" id="cv_email" type="email" placeholder="contato@fornecedor.com"></div>
    <div class="form-row">
      <div class="form-group"><label>Nome do fornecedor *</label><input class="form-control" id="cv_nome" placeholder="Aço Novo Ltda"></div>
      <div class="form-group"><label>CNPJ</label><input class="form-control" id="cv_cnpj" placeholder="00.000.000/0001-00"></div>
    </div>
    <div id="cv_link" style="margin-top:8px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-primary" id="cv_enviar" onclick="enviarConviteFornecedor()"><i class="fas fa-paper-plane"></i> Gerar convite</button>
  `)
}

async function enviarConviteFornecedor() {
  const email = ((document.getElementById('cv_email') || {}).value || '').trim()
  const nome = ((document.getElementById('cv_nome') || {}).value || '').trim()
  if (!email || !nome) { showToast('Informe e-mail e nome do fornecedor', 'warning'); return }
  try {
    const r = await apiAuth('/api/fornecedor-convites', { method: 'POST', body: JSON.stringify({
      email, nome, cnpj: (document.getElementById('cv_cnpj') || {}).value || '',
    }) })
    const link = location.origin + (r && r.link ? r.link : '')
    const box = document.getElementById('cv_link')
    if (box) box.innerHTML = `
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:10px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Link do convite (válido 7 dias) — envie ao fornecedor:</div>
        <div style="display:flex;gap:6px">
          <input class="form-control" id="cv_link_val" readonly value="${(window.NexusAPI ? NexusAPI.escapeHtml(link) : link)}" style="font-size:12px">
          <button class="btn btn-secondary btn-sm" onclick="copiarConvite()"><i class="fas fa-copy"></i></button>
        </div>
      </div>`
    if (window.logAction) logAction('Convidar fornecedor', 'fornecedores')
    showToast('Convite gerado', 'success')
    _carregarConvites()
  } catch (e) { showToast(e && e.message ? e.message : 'Falha ao gerar o convite', 'error') }
}

function copiarConvite() {
  const el = document.getElementById('cv_link_val')
  if (!el) return
  el.select()
  try { document.execCommand('copy') } catch {}
  if (navigator.clipboard) { try { navigator.clipboard.writeText(el.value) } catch {} }
  if (typeof showToast === 'function') showToast('Link copiado', 'success')
}

window._convitesHTML = _convitesHTML
window.renderConvitesFornecedor = renderConvitesFornecedor
window._carregarConvites = _carregarConvites
window.abrirConvidarFornecedor = abrirConvidarFornecedor
window.enviarConviteFornecedor = enviarConviteFornecedor
window.copiarConvite = copiarConvite
