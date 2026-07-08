/**
 * pages/portal.js — Portal do Fornecedor (self-service)
 * Área restrita: o fornecedor acompanha seus pedidos, envia NF e atualiza o
 * próprio cadastro. Todo o escopo é garantido no servidor (req.user.fornecedor_id).
 */
async function renderPortal() {
  const main = document.getElementById('mainContent') || document.getElementById('main');
  if (!main) return;
  if (typeof apiAuth !== 'function') { main.innerHTML = '<p style="padding:40px">Portal indisponível offline.</p>'; return; }

  main.innerHTML = `
    <div class="page-header"><h2><i class="fas fa-store" style="color:var(--fa-teal);margin-right:10px"></i>Portal do Fornecedor</h2>
      <p>Acompanhe seus pedidos, envie a nota fiscal e mantenha seu cadastro atualizado.</p></div>
    <div id="portal_perfil" class="info-card" style="padding:16px;margin-bottom:16px"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>
    <div id="portal_dashboard" style="margin-bottom:16px"></div>
    <div id="portal_rfq" class="info-card" style="padding:16px;margin-bottom:16px"></div>
    <div id="portal_entregas" class="info-card" style="padding:16px;margin-bottom:16px"></div>
    <div id="portal_pedidos" class="info-card" style="padding:16px;margin-bottom:16px"></div>
    <div id="portal_docs" class="info-card" style="padding:16px;margin-bottom:16px"></div>
    <div id="portal_financeiro" class="info-card" style="padding:16px"></div>`;

  // Módulos server-backed do portal; silenciosos se ausentes.
  if (typeof window._portalCarregarDashboard === 'function') window._portalCarregarDashboard();
  if (typeof window._portalCarregarRFQs === 'function') window._portalCarregarRFQs();
  if (typeof window._portalCarregarEntregas === 'function') window._portalCarregarEntregas();
  if (typeof window._portalCarregarDocs === 'function') window._portalCarregarDocs();
  if (typeof window._portalCarregarFinanceiro === 'function') window._portalCarregarFinanceiro();

  // Perfil
  try {
    const f = await apiAuth('/api/portal/perfil');
    document.getElementById('portal_perfil').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <strong style="font-size:14px"><i class="fas fa-id-card" style="margin-right:6px"></i>${f.razao_social || f.nome} ${f.cnpj ? '· ' + f.cnpj : ''}</strong>
        <button class="btn btn-secondary btn-sm" onclick="portalEditarPerfil()"><i class="fas fa-pen"></i> Editar contato/banco</button>
        ${typeof window.portalVerAcessos === 'function' ? '<button class="btn btn-secondary btn-sm" onclick="portalVerAcessos()"><i class="fas fa-shield-alt"></i> Acessos & senha</button>' : ''}
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:6px">Contato: ${f.contato || '—'} · ${f.email || '—'} · ${f.telefone || '—'}${f.banco ? ' · Banco ' + f.banco + ' Ag ' + (f.agencia || '—') + ' C/C ' + (f.conta || '—') : ''}</div>`;
    window._portalPerfil = f;
  } catch (e) {
    document.getElementById('portal_perfil').innerHTML = `<div style="color:#dc2626;font-size:13px"><i class="fas fa-lock"></i> ${e.message} — esta área é exclusiva de usuários fornecedor.</div>`;
    document.getElementById('portal_pedidos').style.display = 'none';
    return;
  }

  // Pedidos
  try {
    const peds = await apiAuth('/api/portal/pedidos');
    const box = document.getElementById('portal_pedidos');
    if (!peds.length) { box.innerHTML = '<p style="font-size:13px;color:var(--text-muted)">Nenhum pedido no momento.</p>'; return; }
    box.innerHTML = `
      <strong style="font-size:14px"><i class="fas fa-file-invoice" style="margin-right:6px"></i>Meus Pedidos (${peds.length})</strong>
      <table class="table" style="width:100%;margin-top:10px;font-size:12px;border-collapse:collapse">
        <thead><tr style="color:var(--text-muted);text-align:left">
          <th style="padding:6px 8px">Pedido</th><th style="padding:6px 8px">Status</th><th style="padding:6px 8px">Valor</th><th style="padding:6px 8px">NF</th><th></th>
        </tr></thead>
        <tbody>
          ${peds.map(p => `<tr>
            <td style="padding:6px 8px">${p.numero}</td>
            <td style="padding:6px 8px">${p.status || '—'}</td>
            <td style="padding:6px 8px">${typeof fmt === 'function' ? fmt(p.valor_total) : (p.valor_total || 0)}</td>
            <td style="padding:6px 8px">${p.nf_numero || '—'}</td>
            <td style="padding:6px 8px;text-align:right">${p.nf_numero ? '<span style="color:#16a34a;font-size:11px">NF enviada</span>' : `<button class="btn btn-primary btn-sm" style="padding:2px 8px;font-size:11px" onclick="portalEnviarNF(${p.id},'${p.numero}')"><i class="fas fa-upload"></i> Enviar NF</button>`}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    document.getElementById('portal_pedidos').innerHTML = `<div style="color:#dc2626;font-size:13px">${e.message}</div>`;
  }
}

function portalEnviarNF(id, numero) {
  if (typeof openModal !== 'function') return;
  openModal('Enviar NF — ' + numero, `
    <div class="form-group"><label>Número da NF *</label><input class="form-control" id="pnf_num"></div>
    <div class="form-group"><label>Valor da NF (R$)</label><input class="form-control" id="pnf_val" type="number" min="0" step="0.01"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="portalConfirmarNF(${id})"><i class="fas fa-upload"></i> Enviar</button>
  `);
}

async function portalConfirmarNF(id) {
  const nf_numero = (document.getElementById('pnf_num')?.value || '').trim();
  if (!nf_numero) { showToast('Informe o número da NF', 'warning'); return; }
  const nf_valor = parseFloat(document.getElementById('pnf_val')?.value) || 0;
  try {
    await apiAuth(`/api/portal/pedidos/${id}/nf`, { method: 'POST', body: JSON.stringify({ nf_numero, nf_valor }) });
    closeModal();
    showToast('NF enviada com sucesso.', 'success');
    renderPortal();
  } catch (e) { showToast('Falha ao enviar NF: ' + e.message, 'error'); }
}

function portalEditarPerfil() {
  const f = window._portalPerfil || {};
  if (typeof openModal !== 'function') return;
  openModal('Editar cadastro', `
    <div class="form-row">
      <div class="form-group"><label>Contato</label><input class="form-control" id="pp_contato" value="${f.contato || ''}"></div>
      <div class="form-group"><label>E-mail</label><input class="form-control" id="pp_email" value="${f.email || ''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Telefone</label><input class="form-control" id="pp_tel" value="${f.telefone || ''}"></div>
      <div class="form-group"><label>Banco</label><input class="form-control" id="pp_banco" value="${f.banco || ''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Agência</label><input class="form-control" id="pp_ag" value="${f.agencia || ''}"></div>
      <div class="form-group"><label>Conta</label><input class="form-control" id="pp_conta" value="${f.conta || ''}"></div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="portalSalvarPerfil()"><i class="fas fa-save"></i> Salvar</button>
  `);
}

async function portalSalvarPerfil() {
  const body = {
    contato: document.getElementById('pp_contato')?.value || '',
    email: document.getElementById('pp_email')?.value || '',
    telefone: document.getElementById('pp_tel')?.value || '',
    banco: document.getElementById('pp_banco')?.value || '',
    agencia: document.getElementById('pp_ag')?.value || '',
    conta: document.getElementById('pp_conta')?.value || '',
  };
  try {
    await apiAuth('/api/portal/perfil', { method: 'PUT', body: JSON.stringify(body) });
    closeModal();
    showToast('Cadastro atualizado.', 'success');
    renderPortal();
  } catch (e) { showToast('Falha ao salvar: ' + e.message, 'error'); }
}

window.renderPortal = renderPortal;
window.portalEnviarNF = portalEnviarNF;
window.portalConfirmarNF = portalConfirmarNF;
window.portalEditarPerfil = portalEditarPerfil;
window.portalSalvarPerfil = portalSalvarPerfil;
