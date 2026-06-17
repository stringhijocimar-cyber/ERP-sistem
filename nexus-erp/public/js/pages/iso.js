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
    capas:        _isoNCs(),
    aspectos:     _isoGet('fa_iso_aspectos'),
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
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="isoVerificarTrilha()" title="ISO 27001 A.12.4 — trilha imutável"><i class="fas fa-shield-halved"></i> Verificar trilha</button>
        <button class="btn btn-secondary btn-sm" onclick="isoRegistrarAspecto()" title="ISO 14001 §6.1"><i class="fas fa-leaf"></i> Aspecto ambiental</button>
        <button class="btn btn-primary btn-sm" onclick="isoRegistrarNC()"><i class="fas fa-triangle-exclamation"></i> Registrar não conformidade</button>
      </div>
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

    ${_isoRenderCAPA(ncs)}
    ${_isoRenderAspectos()}
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

// Verifica a integridade da trilha de auditoria imutável (hash encadeado).
async function isoVerificarTrilha() {
  if (typeof apiAuth !== 'function') { showToast('Verificação indisponível offline.', 'warning'); return; }
  try {
    const r = await apiAuth('/api/auditoria/verificar');
    if (r && r.integra) showToast(`Trilha íntegra ✅ — ${r.total} registro(s) encadeado(s) sem adulteração.`, 'success', 6000);
    else showToast(`⚠️ Trilha COMPROMETIDA: ${r.motivo} (registro ${r.quebraEm}).`, 'error', 8000);
  } catch (e) {
    showToast('Não foi possível verificar a trilha: ' + e.message, 'error');
  }
}

// ─── CAPA (workflow de ação corretiva) ───────────────────────
function _isoCapaCor(statusEfetivo) {
  return statusEfetivo === 'Fechada' ? '#16a34a'
       : statusEfetivo === 'Atrasada' ? '#dc2626'
       : statusEfetivo === 'Verificação' ? '#2563eb'
       : statusEfetivo === 'Em Ação' ? '#d97706' : '#64748b';
}

function _isoRenderCAPA(ncs) {
  if (!ncs.length) return '';
  const C = window.CAPA;
  const resumo = C ? C.resumoCapa(ncs) : { abertas: ncs.length, emAcao: 0, verificacao: 0, fechadas: 0, atrasadas: 0, percentNoPrazo: 100 };
  const linhas = ncs.map(nc => {
    const e = C ? C.estadoCapa(nc) : { statusEfetivo: nc.status || 'Aberta', atrasada: false };
    const cor = _isoCapaCor(e.statusEfetivo);
    const prox = C ? C.proximoStatus(nc.status || 'Aberta') : null;
    return `<tr>
      <td style="padding:6px 8px">${nc.norma || '—'}</td>
      <td style="padding:6px 8px">${(nc.descricao || '').replace(/</g, '&lt;')}</td>
      <td style="padding:6px 8px">${nc.responsavel || '—'}</td>
      <td style="padding:6px 8px;color:${e.atrasada ? '#dc2626' : 'var(--text-muted)'}">${nc.prazo || '—'}${e.atrasada ? ' ⚠️' : ''}</td>
      <td style="padding:6px 8px"><span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:${cor}1f;color:${cor}">${e.statusEfetivo}</span></td>
      <td style="padding:6px 8px;text-align:right">${prox ? `<button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:11px" onclick="isoAvancarCapa('${nc.id}')"><i class="fas fa-forward"></i> ${prox}</button>` : '<span style="color:#16a34a;font-size:11px">concluída</span>'}</td>
    </tr>`;
  }).join('');
  return `
    <div class="info-card" style="padding:16px;margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
        <strong style="font-size:14px"><i class="fas fa-clipboard-list" style="margin-right:6px"></i>CAPA — Ações Corretivas e Preventivas</strong>
        <span style="font-size:12px;color:var(--text-muted)">
          ${resumo.atrasadas ? `<span style="color:#dc2626;font-weight:700">${resumo.atrasadas} atrasada(s)</span> · ` : ''}${resumo.percentNoPrazo}% no prazo · ${resumo.fechadas}/${resumo.total} fechadas
        </span>
      </div>
      <table class="table" style="width:100%;font-size:12px;border-collapse:collapse">
        <thead><tr style="color:var(--text-muted);text-align:left">
          <th style="padding:6px 8px">Norma</th><th style="padding:6px 8px">Descrição</th><th style="padding:6px 8px">Responsável</th><th style="padding:6px 8px">Prazo</th><th style="padding:6px 8px">Status</th><th></th>
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>`;
}

function isoAvancarCapa(id) {
  const ncs = _isoNCs();
  const nc = ncs.find(x => x.id === id);
  if (!nc) return;
  const prox = window.CAPA ? window.CAPA.proximoStatus(nc.status || 'Aberta') : null;
  if (!prox) return;
  nc.status = prox;
  nc.atualizado_em = new Date().toISOString();
  try { localStorage.setItem('fa_iso_ncs', JSON.stringify(ncs)); } catch (e) {}
  if (typeof logAction === 'function') logAction('CAPA → ' + prox, 'ISO', (nc.descricao || '').slice(0, 50));
  showToast('CAPA avançada para: ' + prox, 'success');
  renderISO();
}

// ─── Aspectos e impactos ambientais (ISO 14001 §6.1) ─────────
function _isoRenderAspectos() {
  const asp = _isoGet('fa_iso_aspectos');
  if (!asp.length) return '';
  return `
    <div class="info-card" style="padding:16px;margin-top:16px">
      <strong style="font-size:14px"><i class="fas fa-leaf" style="margin-right:6px;color:#16a34a"></i>Aspectos e Impactos Ambientais (ISO 14001)</strong>
      <table class="table" style="width:100%;margin-top:10px;font-size:12px;border-collapse:collapse">
        <thead><tr style="color:var(--text-muted);text-align:left"><th style="padding:6px 8px">Aspecto</th><th style="padding:6px 8px">Impacto</th><th style="padding:6px 8px">Significância</th><th style="padding:6px 8px">Controle</th></tr></thead>
        <tbody>
          ${asp.map(a => {
            const cor = a.significancia === 'Alta' ? '#dc2626' : a.significancia === 'Média' ? '#d97706' : '#16a34a';
            return `<tr>
              <td style="padding:6px 8px">${(a.aspecto || '').replace(/</g, '&lt;')}</td>
              <td style="padding:6px 8px">${(a.impacto || '').replace(/</g, '&lt;')}</td>
              <td style="padding:6px 8px"><span style="color:${cor};font-weight:700">${a.significancia || '—'}</span></td>
              <td style="padding:6px 8px">${(a.controle || '—').replace(/</g, '&lt;')}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function isoRegistrarAspecto() {
  if (typeof openModal !== 'function') return;
  openModal('Registrar aspecto ambiental (ISO 14001)', `
    <div class="form-group"><label>Aspecto *</label><input class="form-control" id="asp_aspecto" placeholder="Ex.: Geração de resíduo perigoso"></div>
    <div class="form-group"><label>Impacto</label><input class="form-control" id="asp_impacto" placeholder="Ex.: Contaminação de solo"></div>
    <div class="form-row">
      <div class="form-group"><label>Significância</label>
        <select class="form-control" id="asp_signif"><option>Baixa</option><option>Média</option><option>Alta</option></select>
      </div>
      <div class="form-group"><label>Controle operacional</label><input class="form-control" id="asp_controle" placeholder="Ex.: Coleta seletiva + destinação licenciada"></div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="isoSalvarAspecto()"><i class="fas fa-save"></i> Registrar</button>
  `);
}

function isoSalvarAspecto() {
  const aspecto = (document.getElementById('asp_aspecto')?.value || '').trim();
  if (!aspecto) { showToast('Informe o aspecto ambiental', 'warning'); return; }
  const lista = _isoGet('fa_iso_aspectos');
  lista.unshift({
    id: 'ASP-' + Date.now(),
    aspecto,
    impacto: document.getElementById('asp_impacto')?.value || '',
    significancia: document.getElementById('asp_signif')?.value || 'Baixa',
    controle: document.getElementById('asp_controle')?.value || '',
    criado_em: new Date().toISOString(),
  });
  try { localStorage.setItem('fa_iso_aspectos', JSON.stringify(lista)); } catch (e) {}
  if (typeof logAction === 'function') logAction('Aspecto ambiental', 'ISO', aspecto.slice(0, 50));
  closeModal();
  showToast('Aspecto ambiental registrado.', 'success');
  renderISO();
}

window.renderISO = renderISO;
window.isoRegistrarNC = isoRegistrarNC;
window.isoSalvarNC = isoSalvarNC;
window.isoVerificarTrilha = isoVerificarTrilha;
window.isoAvancarCapa = isoAvancarCapa;
window.isoRegistrarAspecto = isoRegistrarAspecto;
window.isoSalvarAspecto = isoSalvarAspecto;
