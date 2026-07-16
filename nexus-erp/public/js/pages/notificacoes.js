/**
 * pages/notificacoes.js — Central de notificações (in-app) + badge do sino.
 */
const NOTIF_ICON = { homologacao: 'user-shield', banco: 'university', info: 'info-circle', alerta: 'exclamation-triangle' };

async function renderNotificacoes() {
  const main = document.getElementById('mainContent') || document.getElementById('main');
  if (!main) return;
  if (typeof apiAuth !== 'function') { main.innerHTML = '<p style="padding:40px">Indisponível offline.</p>'; return; }
  main.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div><h2><i class="fas fa-bell" style="color:var(--fa-teal);margin-right:10px"></i>Notificações</h2></div>
      <button class="btn btn-secondary btn-sm" onclick="marcarTodasNotif()"><i class="fas fa-check-double"></i> Marcar todas como lidas</button>
    </div>
    <div id="notif_lista" class="info-card" style="padding:8px"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>`;
  try {
    const ns = await apiAuth('/api/notificacoes');
    const box = document.getElementById('notif_lista');
    if (!ns.length) { box.innerHTML = '<p style="font-size:13px;color:var(--text-muted);padding:12px">Nenhuma notificação.</p>'; return; }
    box.innerHTML = ns.map(n => `
      <div onclick="lerNotif('${n.id}')" style="display:flex;gap:12px;align-items:flex-start;padding:10px 12px;border-bottom:1px solid var(--border,rgba(255,255,255,.06));cursor:pointer;${n.lida ? 'opacity:.6' : 'background:rgba(0,184,184,.04)'}">
        <i class="fas fa-${NOTIF_ICON[n.tipo] || 'bell'}" style="color:var(--fa-teal);margin-top:3px"></i>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:${n.lida ? '500' : '700'}">${n.titulo}${n.lida ? '' : ' <span style="width:7px;height:7px;background:#dc2626;border-radius:50%;display:inline-block;margin-left:4px"></span>'}</div>
          <div style="font-size:12px;color:var(--text-muted)">${n.mensagem || ''}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${n.created_at || ''}</div>
        </div>
      </div>`).join('');
  } catch (e) { document.getElementById('notif_lista').innerHTML = `<div style="color:#dc2626;font-size:13px;padding:12px">${e.message}</div>`; }
}

async function lerNotif(id) {
  try { await apiAuth(`/api/notificacoes/${id}/lida`, { method: 'POST', body: '{}' }); renderNotificacoes(); atualizarBadgeNotif(); } catch (e) { /* noop */ }
}
async function marcarTodasNotif() {
  try { await apiAuth('/api/notificacoes/ler-todas', { method: 'POST', body: '{}' }); renderNotificacoes(); atualizarBadgeNotif(); } catch (e) { /* noop */ }
}

// Atualiza o badge do sino com a contagem de não-lidas.
async function atualizarBadgeNotif() {
  const badge = document.getElementById('notifBadge');
  if (!badge || typeof apiAuth !== 'function') return;
  try {
    const r = await apiAuth('/api/notificacoes/contagem');
    const n = r && r.nao_lidas || 0;
    if (n > 0) { badge.textContent = n > 99 ? '99+' : n; badge.style.display = 'block'; }
    else badge.style.display = 'none';
  } catch (e) { /* sino é best-effort */ }
}

// Liga o refresh do badge (uma vez) — ao carregar e a cada 60s.
if (!window._notifBadgeTimer) {
  window._notifBadgeTimer = setInterval(() => { try { atualizarBadgeNotif(); } catch (e) {} }, 60000);
  setTimeout(() => { try { atualizarBadgeNotif(); } catch (e) {} }, 1500);
}

window.renderNotificacoes = renderNotificacoes;
window.atualizarBadgeNotif = atualizarBadgeNotif;
window.lerNotif = lerNotif;
window.marcarTodasNotif = marcarTodasNotif;
