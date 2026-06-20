/**
 * pages/nfe.js — Fiscal: emissão de NF-e / NFS-e / CT-e.
 * Emite (adaptador server-side), lista e cancela (regra SEFAZ de justificativa).
 */
async function renderNFe() {
  const main = document.getElementById('mainContent') || document.getElementById('main');
  if (!main) return;
  if (typeof apiAuth !== 'function') { main.innerHTML = '<p style="padding:40px">Indisponível offline.</p>'; return; }
  const money = v => typeof fmt === 'function' ? fmt(v) : ('R$ ' + (v || 0).toLocaleString('pt-BR'));

  main.innerHTML = `
    <div class="page-header"><h2><i class="fas fa-file-invoice-dollar" style="color:var(--fa-teal);margin-right:10px"></i>Documentos Fiscais</h2>
      <p>Emissão de NF-e, NFS-e e CT-e — com chave de acesso, DANFE e cancelamento.</p></div>
    <div class="info-card" style="padding:16px;margin-bottom:16px">
      <strong style="font-size:13px"><i class="fas fa-plus-circle"></i> Emitir documento</strong>
      <div class="form-row" style="margin-top:10px">
        <div class="form-group"><label>Tipo</label>
          <select class="form-control" id="nfe_tipo"><option value="nfe">NF-e</option><option value="nfse">NFS-e</option><option value="cte">CT-e</option></select></div>
        <div class="form-group"><label>CNPJ emitente *</label><input class="form-control" id="nfe_emit" placeholder="só números"></div>
        <div class="form-group"><label>CNPJ/CPF destinatário *</label><input class="form-control" id="nfe_dest" placeholder="só números"></div>
        <div class="form-group"><label>Valor (R$) *</label><input class="form-control" id="nfe_valor" type="number" min="0" step="0.01"></div>
      </div>
      <div class="form-group"><label>Descrição *</label><input class="form-control" id="nfe_desc" placeholder="Discriminação do serviço/produto"></div>
      <div id="nfe_erro" style="display:none;color:#dc2626;font-size:12px;margin:6px 0"></div>
      <button class="btn btn-primary btn-sm" onclick="emitirNFe()"><i class="fas fa-paper-plane"></i> Emitir</button>
    </div>
    <div id="nfe_lista" class="info-card" style="padding:16px"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>`;
  _carregarNFe(money);
}

async function _carregarNFe(money) {
  money = money || (v => 'R$ ' + (v || 0).toLocaleString('pt-BR'));
  const box = document.getElementById('nfe_lista');
  try {
    const notas = await apiAuth('/api/nfe');
    if (!notas.length) { box.innerHTML = '<p style="font-size:13px;color:var(--text-muted)">Nenhum documento emitido.</p>'; return; }
    box.innerHTML = `
      <strong style="font-size:13px"><i class="fas fa-list"></i> Emitidos (${notas.length})</strong>
      <table class="table" style="width:100%;margin-top:10px;font-size:12px;border-collapse:collapse">
        <thead><tr style="color:var(--text-muted);text-align:left">
          <th style="padding:6px 8px">Tipo</th><th style="padding:6px 8px">Nº/Série</th><th style="padding:6px 8px">Chave</th>
          <th style="padding:6px 8px">Valor</th><th style="padding:6px 8px">Status</th><th></th></tr></thead>
        <tbody>${notas.map(n => `
          <tr>
            <td style="padding:6px 8px">${(n.tipo || '').toUpperCase()}</td>
            <td style="padding:6px 8px">${n.numero}/${n.serie}</td>
            <td style="padding:6px 8px;font-family:monospace;font-size:10px">${(n.chave || '').slice(0, 12)}…</td>
            <td style="padding:6px 8px">${money(n.valor)}</td>
            <td style="padding:6px 8px">${n.status === 'cancelada' ? '<span style="color:#dc2626">cancelada</span>' : '<span style="color:#16a34a">autorizada</span>'}</td>
            <td style="padding:6px 8px;text-align:right">
              <a href="${n.danfe_url || '#'}" target="_blank" class="btn btn-secondary btn-sm" style="padding:2px 7px;font-size:11px"><i class="fas fa-file-pdf"></i> DANFE</a>
              ${n.status !== 'cancelada' ? `<button class="btn btn-secondary btn-sm" style="padding:2px 7px;font-size:11px" onclick="cancelarNFe('${n.id}')"><i class="fas fa-ban"></i> Cancelar</button>` : ''}
            </td>
          </tr>`).join('')}</tbody>
      </table>`;
  } catch (e) { box.innerHTML = `<div style="color:#dc2626;font-size:13px">${e.message}</div>`; }
}

async function emitirNFe() {
  const erro = document.getElementById('nfe_erro');
  const body = {
    tipo: document.getElementById('nfe_tipo').value,
    cnpj_emitente: (document.getElementById('nfe_emit').value || '').replace(/\D/g, ''),
    cnpj_destinatario: (document.getElementById('nfe_dest').value || '').replace(/\D/g, ''),
    valor: parseFloat(document.getElementById('nfe_valor').value) || 0,
    descricao: document.getElementById('nfe_desc').value.trim(),
  };
  try {
    await apiAuth('/api/nfe/emitir', { method: 'POST', body: JSON.stringify(body) });
    erro.style.display = 'none';
    showToast('Documento emitido e autorizado.', 'success');
    renderNFe();
  } catch (e) {
    erro.textContent = e.message; erro.style.display = 'block';
  }
}

async function cancelarNFe(id) {
  const justificativa = prompt('Justificativa do cancelamento (mínimo 15 caracteres — regra SEFAZ):') || '';
  if (justificativa.trim().length < 15) { showToast('Justificativa precisa de ao menos 15 caracteres.', 'warning'); return; }
  try {
    await apiAuth(`/api/nfe/${id}/cancelar`, { method: 'POST', body: JSON.stringify({ justificativa }) });
    showToast('Documento cancelado.', 'success');
    renderNFe();
  } catch (e) { showToast('Falha: ' + e.message, 'error'); }
}

window.renderNFe = renderNFe;
