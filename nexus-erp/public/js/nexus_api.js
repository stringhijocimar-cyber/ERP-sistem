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
      if (window.NexusToast) window.NexusToast(`Módulo ainda não conectado: ${path.replace('/api/', '')}`, 'info');
      return { ok: false, _stub: true, error: e.message };
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

  window.NexusAPI = { __real: true, get, post, put, delete: del, del, escapeHtml };
})();
