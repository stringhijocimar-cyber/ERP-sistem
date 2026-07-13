// public/js/nexus_api.js
// ============================================================
// NexusAPI — cliente HTTP resiliente compartilhado pelos módulos
// "enterprise" (notifications, crm_pipeline, commercial, lowcode,
// customer_*, production_readiness, security_enterprise, workflow_*,
// data_platform, enterprise_consolidation).
//
// Esses módulos referenciam window.NexusAPI.get/post/escapeHtml, mas o
// objeto NUNCA era definido — então TODA página quebrava no mount com
// "Cannot read properties of undefined (reading 'get')".
//
// Este cliente:
//  - injeta o token (o interceptor global já cobre /api/, mas reforçamos);
//  - desembrulha o envelope { success, data } do Express e o { data } do Worker;
//  - NUNCA lança em 404/erro de rede: devolve um default seguro ({ items: [] })
//    para o GET e { ok:false } para o POST, de modo que as páginas exibam
//    estados vazios honestos ("Sem X", "Fila vazia") em vez de telas quebradas.
//    Assim que um backend real existir para a rota, a página acende sozinha.
// ============================================================
(function () {
  if (window.NexusAPI && window.NexusAPI.__real) return;

  const BASE = '';
  const SAFE_GET = Object.freeze({ items: [], data: [], ok: false, _stub: true });

  function _token() {
    try {
      return sessionStorage.getItem('fa_token') || localStorage.getItem('fa_token') || '';
    } catch { return ''; }
  }

  function _unwrap(json) {
    if (json && typeof json === 'object') {
      if ('data' in json && ('success' in json || Object.keys(json).length <= 2)) return json.data;
      if ('data' in json) return json.data;
    }
    return json;
  }

  async function _req(method, path, body) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${_token()}`,
      },
    };
    if (body !== undefined && method !== 'GET') opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    let json = null;
    try { json = await res.json(); } catch { json = null; }
    if (!res.ok) {
      const msg = (json && (json.error || json.message)) || `HTTP ${res.status}`;
      const e = new Error(msg); e.status = res.status; throw e;
    }
    return _unwrap(json);
  }

  async function get(path) {
    try {
      const out = await _req('GET', path);
      return (out === null || out === undefined) ? { ...SAFE_GET } : out;
    } catch (e) {
      // Rota ainda não implementada / offline → estado vazio, sem quebrar a UI.
      if (e.status && e.status !== 404) console.debug('[NexusAPI] GET', path, e.status, e.message);
      return { ...SAFE_GET };
    }
  }

  async function post(path, data) {
    try {
      const out = await _req('POST', path, data || {});
      return (out === null || out === undefined) ? { ok: true } : out;
    } catch (e) {
      console.debug('[NexusAPI] POST', path, e.status || '', e.message);
      // "Módulo não conectado" só faz sentido para rota ausente (404) ou
      // rede caída (sem status). 400/403/409 são respostas de negócio
      // legítimas que o chamador trata — não mostrar o toast enganoso.
      const naoConectado = !e.status || e.status === 404;
      if (naoConectado && window.NexusToast) window.NexusToast(`Módulo ainda não conectado: ${path.replace('/api/', '')}`, 'info');
      return { ok: false, _stub: naoConectado, error: e.message, status: e.status };
    }
  }

  async function put(path, data) {
    try { return await _req('PUT', path, data || {}); }
    catch (e) { return { ok: false, _stub: true, error: e.message }; }
  }

  async function del(path) {
    try { return await _req('DELETE', path); }
    catch (e) { return { ok: false, _stub: true, error: e.message }; }
  }

  function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  // Baixa um .xlsx autenticado com estado de carregamento no botão (evento).
  // Usado por todas as telas com "Exportar para Excel".
  async function baixarXLSX(url, ev) {
    const btn = ev && (ev.currentTarget || ev.target && ev.target.closest && ev.target.closest('button'));
    if (btn && btn.disabled) return;
    const original = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando…'; }
    try {
      const token = sessionStorage.getItem('fa_token') || localStorage.getItem('fa_token') || '';
      const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!resp.ok) {
        let msg = 'Falha na exportação';
        try { msg = (await resp.json()).error || msg; } catch (e) {}
        if (typeof showToast === 'function') showToast(msg, resp.status === 404 ? 'warning' : 'error');
        return;
      }
      const nome = (resp.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/)?.[1] || 'exportacao.xlsx';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(await resp.blob());
      a.download = nome;
      a.click();
      URL.revokeObjectURL(a.href);
      if (typeof showToast === 'function') showToast('Exportação concluída: ' + nome, 'success');
    } catch (e) {
      if (typeof showToast === 'function') showToast('Erro na exportação: ' + ((e && e.message) || 'rede'), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = original; }
    }
  }
  window.nexusBaixarXLSX = baixarXLSX;

  window.NexusAPI = { __real: true, get, post, put, delete: del, del, escapeHtml };
})();
