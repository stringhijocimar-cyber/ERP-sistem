// ============================================================
// Onboarding público — aceite de convite do fornecedor.
// Se a URL trouxer ?token=... (link do convite), mostra uma tela de aceite
// ANTES do login. O fornecedor cria o próprio acesso e entra direto.
// Sem dependência de auth (endpoints /api/convites/* são públicos).
// ============================================================
(function () {
  function _params() { try { return new URLSearchParams(location.search) } catch { return new URLSearchParams() } }
  function _token() {
    const p = _params()
    const t = p.get('token')
    if (!t) return null
    // Só aciona no fluxo de convite (path .../convite ou ?convite=1) — evita
    // capturar um "token" de qualquer outra URL.
    return (location.pathname.indexOf('convite') >= 0 || p.get('convite')) ? t : null
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

  function _tela(html) {
    const box = document.createElement('div')
    box.id = 'convite-overlay'
    box.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#0f172a;display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,-apple-system,sans-serif'
    box.innerHTML = `<div style="background:#fff;border-radius:16px;max-width:420px;width:100%;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.4)">${html}</div>`
    document.body.appendChild(box)
    return box
  }

  async function _api(path, opts) {
    const resp = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts))
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok || json.success === false) throw new Error(json.error || ('HTTP ' + resp.status))
    return json.data
  }

  async function iniciar() {
    const token = _token()
    if (!token) return
    let info
    try { info = await _api(`/api/convites/${encodeURIComponent(token)}`) }
    catch (e) { _tela(`<h2 style="margin:0 0 8px;color:#dc2626">Convite inválido</h2><p style="color:#475569;font-size:14px">${esc(e.message)}</p><a href="/" style="color:#0e7c86">Ir para o login</a>`); return }

    if (!info.valido) {
      _tela(`<h2 style="margin:0 0 8px;color:#d97706">Convite ${esc(info.situacao || 'indisponível')}</h2>
        <p style="color:#475569;font-size:14px">Este convite não está mais disponível. Fale com a empresa contratante ou faça login se já tem acesso.</p>
        <a href="/" style="color:#0e7c86">Ir para o login</a>`)
      return
    }

    const box = _tela(`
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em">${esc(info.empresa)}</div>
        <h2 style="margin:6px 0 2px;font-size:20px;color:#0f172a">Bem-vindo ao Portal do Fornecedor</h2>
        <div style="font-size:13px;color:#475569">${esc(info.fornecedor_nome || '')} · ${esc(info.email)}</div>
      </div>
      <label style="font-size:12px;color:#334155">Seu nome</label>
      <input id="cv_nome" style="width:100%;padding:10px;margin:4px 0 12px;border:1px solid #cbd5e1;border-radius:8px;box-sizing:border-box" placeholder="Nome do responsável">
      <label style="font-size:12px;color:#334155">Crie uma senha (mín. 8, maiúscula, minúscula e número)</label>
      <input id="cv_senha" type="password" style="width:100%;padding:10px;margin:4px 0 16px;border:1px solid #cbd5e1;border-radius:8px;box-sizing:border-box" placeholder="Senha">
      <button id="cv_btn" style="width:100%;padding:12px;background:#0e7c86;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">Criar acesso e entrar</button>
      <div id="cv_erro" style="color:#dc2626;font-size:13px;margin-top:8px;min-height:18px"></div>`)

    box.querySelector('#cv_btn').onclick = async () => {
      const nome = box.querySelector('#cv_nome').value.trim()
      const senha = box.querySelector('#cv_senha').value
      const erro = box.querySelector('#cv_erro')
      erro.textContent = ''
      if (!nome) { erro.textContent = 'Informe seu nome.'; return }
      const btn = box.querySelector('#cv_btn'); btn.disabled = true; btn.textContent = 'Criando…'
      try {
        const data = await _api(`/api/convites/${encodeURIComponent(token)}/aceitar`, { method: 'POST', body: JSON.stringify({ nome, senha }) })
        try { sessionStorage.setItem('fa_token', data.token); localStorage.setItem('fa_token', data.token) } catch {}
        location.replace('/') // entra no portal já autenticado
      } catch (e) {
        erro.textContent = e.message
        btn.disabled = false; btn.textContent = 'Criar acesso e entrar'
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar)
  else iniciar()
  window._portalConviteToken = _token // exposto p/ teste
})();
