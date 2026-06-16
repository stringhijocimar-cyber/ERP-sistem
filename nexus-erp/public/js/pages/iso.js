/**
 * pages/iso.js — Painel de Auditoria ISO / Conformidade
 * Usa o motor js/lib/iso.js. As evidências são derivadas automaticamente dos
 * módulos existentes (IDF, SSMA, RBAC, logs, documentos). Não-conformidades
 * (CAPA) ficam em localStorage 'fa_iso_ncs'.
 */
function _isoGet(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; } }
function _isoNCs() { return _isoGet('fa_iso_ncs'); }

function _isoColetarDados() {
  return {
    idf:          _isoGet('fa_idf_avaliacoes'),
    fornecedores: _isoGet('fa_fornecedores_cache'),
    incidentes:   _isoGet('fa_incidentes'),
    treinamentos: _isoGet('fa_treinamentos'),
    usuarios:     _isoGet('fa_usuarios'),
    logs:         _isoGet('fa_logs_sistema'),
    documentos:   _isoGet('fa_documentos'),
    gateAtivo:    window.NEXUS_SERVER_MODE === true,
  };
}

function _isoCorNivel(nivel) {
  return nivel === 'Maduro' ? '#16a34a' : nivel === 'Em evolução' ? '#2563eb'
       : nivel === 'Inicial' ? '#d97706' : '#dc2626';
}

function renderISO() {
  const main = document.getElementById('mainContent') || document.getElementById('main');
  if (!main) return;
  if (!window.ISO) { main.innerHTML = '<p style="padding:40px">Motor ISO não carregado (js/lib/iso.js).</p>'; return; }

  const dados = _isoColetarDados();
  const evidencias = window.ISO.gerarEvidenciasAutomaticas(dados);
  const ncs = _isoNCs();
  const aval = window.ISO.avaliarConformidade(window.ISO.CATALOGO_ISO, evidencias, ncs);
  const g = aval.geral;
  const evPorReq = {};
  evidencias.forEach(e => { evPorReq[e.requisito_id] = e; });

  const cards = aval.porNorma.map(n => {
    const cor = _isoCorNivel(n.nivel);
    const pend = n.pendentes.map(p =>
      `<li style="font-size:12px;color:var(--text-muted);padding:2px 0"><i class="fas fa-circle-exclamation" style="color:#d97706;margin-right:6px"></i>${p.id} — ${p.titulo}</li>`).join('');
    return `
      <div class="info-card" style="padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong style="font-size:14px">${n.norma}</strong>
          <span style="padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;background:${cor}1f;color:${cor}">${n.nivel} · ${n.score}</span>
        </div>
        <div style="background:var(--bg-secondary,#0002);border-radius:8px;height:10px;overflow:hidden;margin-bottom:6px">
          <div style="height:100%;width:${n.cobertura}%;background:${cor}"></div>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
          Cobertura ${n.cobertura}% · ${n.atendidos}/${n.total} cláusulas evidenciadas
          ${n.ncsAbertas ? ` · <span style="color:#dc2626">${n.ncsAbertas} NC aberta(s)</span>` : ''}
        </div>
        ${pend ? `<details><summary style="font-size:12px;cursor:pointer;color:var(--fa-teal)">Lacunas (${n.pendentes.length})</summary><ul style="list-style:none;margin:6px 0 0;padding:0">${pend}</ul></details>` : '<div style="font-size:12px;color:#16a34a"><i class="fas fa-check"></i> Todas as cláusulas mapeadas têm evidência</div>'}
      </div>`;
  }).join('');

  main.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
      <div>
        <h2><i class="fas fa-certificate" style="color:var(--fa-teal);margin-right:10px"></i>Auditoria ISO / Conformidade</h2>
        <p>Evidências derivadas automaticamente de IDF, SSMA, RBAC, logs e documentos. ISO 9001 · 14001 · 45001 · 27001.</p>
      </div>
      <button class="btn btn-primary btn-sm" onclick="isoRegistrarNC()"><i class="fas fa-triangle-exclamation"></i> Registrar não conformidade</button>
    </div>

    <div class="info-card" style="padding:18px;margin-bottom:16px;border-left:4px solid ${_isoCorNivel(g.nivel)}">
      <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
        <div>
          <span style="font-size:34px;font-weight:800;color:${_isoCorNivel(g.nivel)}">${g.score}</span>
          <span style="font-size:13px;color:var(--text-muted)">/100 · Maturidade ${g.nivel}</span>
        </div>
        <div style="font-size:13px;color:var(--text-muted)">
          Cobertura geral <strong>${g.cobertura}%</strong> (${g.atendidos}/${g.total} cláusulas)
          ${g.ncsAbertas ? ` · <span style="color:#dc2626"><strong>${g.ncsAbertas}</strong> não conformidade(s) aberta(s)</span>` : ' · sem NCs abertas'}
        </div>
      </div>
    </div>

    <div class="cards-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">
      ${cards}
    </div>

    ${ncs.length ? `
    <div class="info-card" style="padding:16px;margin-top:16px">
      <strong style="font-size:14px"><i class="fas fa-clipboard-list" style="margin-right:6px"></i>Não conformidades (CAPA)</strong>
      <table class="table" style="width:100%;margin-top:10px;font-size:12px">
        <thead><tr><th>Norma</th><th>Descrição</th><th>Responsável</th><th>Prazo</th><th>Status</th></tr></thead>
        <tbody>
          ${ncs.map(nc => `<tr>
            <td>${nc.norma || '—'}</td><td>${(nc.descricao || '').replace(/</g, '&lt;')}</td>
            <td>${nc.responsavel || '—'}</td><td>${nc.prazo || '—'}</td>
            <td>${nc.status || 'Aberta'}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}
  `;
}

function isoRegistrarNC() {
  if (typeof openModal !== 'function') return;
  const norms = (window.ISO ? window.ISO.CATALOGO_ISO : []).reduce((acc, c) => { acc[c.norma] = 1; return acc; }, {});
  const opts = Object.keys(norms).map(n => `<option>${n}</option>`).join('');
  openModal('Registrar não conformidade', `
    <div class="form-group"><label>Norma</label><select class="form-control" id="nc_norma">${opts}</select></div>
    <div class="form-group"><label>Descrição *</label><textarea class="form-control" id="nc_desc" rows="3" placeholder="O que foi observado"></textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Responsável</label><input class="form-control" id="nc_resp" type="text"></div>
      <div class="form-group"><label>Prazo</label><input class="form-control" id="nc_prazo" type="date"></div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="isoSalvarNC()"><i class="fas fa-save"></i> Registrar</button>
  `);
}

function isoSalvarNC() {
  const desc = (document.getElementById('nc_desc')?.value || '').trim();
  if (!desc) { showToast('Informe a descrição da não conformidade', 'warning'); return; }
  const ncs = _isoNCs();
  ncs.unshift({
    id: 'NC-' + Date.now(),
    norma: document.getElementById('nc_norma')?.value || '',
    descricao: desc,
    responsavel: document.getElementById('nc_resp')?.value || '',
    prazo: document.getElementById('nc_prazo')?.value || '',
    status: 'Aberta',
    criado_em: new Date().toISOString(),
  });
  try { localStorage.setItem('fa_iso_ncs', JSON.stringify(ncs)); } catch (e) {}
  if (typeof logAction === 'function') logAction('Registrar NC', 'ISO', desc.slice(0, 60));
  closeModal();
  showToast('Não conformidade registrada.', 'success');
  renderISO();
}

window.renderISO = renderISO;
window.isoRegistrarNC = isoRegistrarNC;
window.isoSalvarNC = isoSalvarNC;
