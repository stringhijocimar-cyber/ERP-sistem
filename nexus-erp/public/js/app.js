// =====================================================
// ERP – App Core (Navegação, Login, Utils)
// =====================================================

let currentPage = 'dashboard';
let currentUser = null;
let sidebarCollapsed = false;

// =====================================================
// TEMA ESCURO / CLARO
// =====================================================
function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const newTheme = isLight ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('erp_theme', newTheme);
  _updateThemeIcon(newTheme);
}

function _updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  const btn  = document.getElementById('btnThemeToggle');
  if (!icon) return;
  if (theme === 'light') {
    icon.className = 'fas fa-sun';
    if (btn) btn.title = typeof t==='function' ? t('theme_dark') : 'Tema Escuro';
  } else {
    icon.className = 'fas fa-moon';
    if (btn) btn.title = typeof t==='function' ? t('theme_light') : 'Tema Claro';
  }
}

// =====================================================
// IDIOMA – DROPDOWN
// =====================================================
const _LANG_META = {
  pt: { flag: '🇧🇷', label: 'PT' },
  en: { flag: '🇺🇸', label: 'EN' },
  es: { flag: '🇪🇸', label: 'ES' },
};

function _toggleLangDrop() {
  const drop = document.getElementById('langDrop');
  if (!drop) return;
  const open = drop.style.display !== 'none';
  drop.style.display = open ? 'none' : 'block';
  if (!open) {
    const closeOnOutside = (e) => {
      if (!document.getElementById('langDropWrap')?.contains(e.target)) {
        drop.style.display = 'none';
        document.removeEventListener('click', closeOnOutside);
      }
    };
    setTimeout(() => document.addEventListener('click', closeOnOutside), 10);
  }
}

function _updateLangUI() {
  const lang = typeof getLang === 'function' ? getLang() : (localStorage.getItem('erp_lang') || 'pt');
  const meta = _LANG_META[lang] || _LANG_META.pt;
  const flagEl  = document.getElementById('langFlagCurrent');
  const labelEl = document.getElementById('langLabelCurrent');
  if (flagEl)  flagEl.textContent  = meta.flag;
  if (labelEl) labelEl.textContent = meta.label;
  // Atualiza estado visual dos botões de idioma
  document.querySelectorAll('[data-lang-btn]').forEach(btn => {
    const active = btn.getAttribute('data-lang-btn') === lang;
    btn.style.fontWeight   = active ? '700' : '400';
    btn.style.opacity      = active ? '1'   : '0.6';
    btn.style.background   = active ? 'rgba(var(--orange-rgb,230,126,34),0.12)' : 'none';
  });
}


// --- INSTRUÇÕES DE LOGIN (visível antes de logar) ---
function mostrarInstrucoesLoginAdmin() {
  // Cria um overlay simples que funciona antes do login
  const overlay = document.createElement('div');
  overlay.id = 'instrucoesTempOverlay';
  overlay.style.cssText = `
    position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
    background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;
    animation:fadeIn 0.2s ease;
  `;
  overlay.innerHTML = `
    <div style="background:#0d1117;border:1px solid #30363d;border-radius:14px;max-width:680px;width:90%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
      <div style="background:#161b22;padding:18px 24px;border-bottom:1px solid #30363d;border-radius:14px 14px 0 0;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:16px;font-weight:700;color:#e6edf3"><i class="fas fa-shield-alt" style="color:#00b4b8;margin-right:8px"></i>Como Acessar o Sistema</div>
          <div style="font-size:11px;color:#7d8590;margin-top:2px">ERP – Sistema de Gestão Integrada</div>
        </div>
        <button onclick="document.getElementById('instrucoesTempOverlay').remove()" style="background:transparent;border:1px solid #30363d;color:#e6edf3;width:30px;height:30px;border-radius:6px;cursor:pointer;font-size:16px">×</button>
      </div>

      <div style="padding:20px 24px;font-family:Arial,sans-serif">

        <!-- COMO LOGAR -->
        <div style="background:#161b22;border:1px solid #30363d;border-radius:10px;padding:16px;margin-bottom:16px">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#7d8590;font-weight:700;margin-bottom:12px">Como fazer login</div>
          <div style="display:grid;gap:10px">
            <div style="display:flex;gap:12px;align-items:flex-start">
              <div style="background:#00b4b8;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">1</div>
              <div style="font-size:12px;color:#c9d1d9">Digite seu <strong style="color:#e6edf3">e-mail corporativo</strong> no campo indicado (Ex: admin@fraseralexander.com.br)</div>
            </div>
            <div style="display:flex;gap:12px;align-items:flex-start">
              <div style="background:#00b4b8;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">2</div>
              <div style="font-size:12px;color:#c9d1d9">Informe sua <strong style="color:#e6edf3">senha</strong>. No primeiro acesso a senha padrão é <strong style="color:#e67e22">Fraser@2025</strong> — você será obrigado a trocá-la.</div>
            </div>
            <div style="display:flex;gap:12px;align-items:flex-start">
              <div style="background:#00b4b8;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">3</div>
              <div style="font-size:12px;color:#c9d1d9">Clique em <strong style="color:#e6edf3">Acessar o Sistema</strong> — ou use os botões de <strong style="color:#e6edf3">Acesso Rápido</strong> para demonstração</div>
            </div>
          </div>
        </div>

        <!-- PERFIS -->
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#7d8590;font-weight:700;margin-bottom:10px">Perfis e e-mails de acesso</div>
        <div style="display:grid;gap:6px;margin-bottom:16px">
          ${[
            { icon:'🛡️', perfil:'Administrador do Sistema', email:'admin@fraseralexander.com.br', destaque:true },
            { icon:'👔', perfil:'Diretor / Gerente Geral', email:'diretor@fraseralexander.com.br', destaque:false },
            { icon:'💰', perfil:'Financeiro / Faturamento', email:'financeiro@fraseralexander.com.br', destaque:false },
            { icon:'🔧', perfil:'Gestor de Operações', email:'operacao@fraseralexander.com.br', destaque:false },
            { icon:'🛒', perfil:'Compras / Suprimentos', email:'compras@fraseralexander.com.br', destaque:false },
            { icon:'🦺', perfil:'SSMA / Segurança', email:'supervisor@fraseralexander.com.br', destaque:false }
          ].map(u => `
            <div style="background:${u.destaque ? 'rgba(0,180,184,0.08)' : '#161b22'};border:1px solid ${u.destaque ? '#00b4b8' : '#30363d'};border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:12px">
              <span style="font-size:18px">${u.icon}</span>
              <div style="flex:1">
                <div style="font-size:12px;font-weight:600;color:${u.destaque ? '#00b4b8' : '#e6edf3'}">${u.perfil} ${u.destaque ? '<span style="background:#00b4b8;color:#fff;font-size:9px;padding:1px 6px;border-radius:8px;margin-left:4px">ADM</span>' : ''}</div>
                <div style="font-size:11px;color:#7d8590;margin-top:1px">${u.email}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- PAINEL ADM -->
        <div style="background:rgba(230,126,34,0.08);border:1px solid rgba(230,126,34,0.25);border-radius:10px;padding:14px;margin-bottom:16px">
          <div style="font-size:11px;font-weight:700;color:#e67e22;margin-bottom:8px"><i class="fas fa-shield-alt" style="margin-right:6px"></i>Painel de Administração (ADM)</div>
          <div style="font-size:12px;color:#c9d1d9;line-height:1.7">
            O painel ADM é visível <strong>somente</strong> para o perfil <strong style="color:#00b4b8">Administrador do Sistema</strong>. Após login como ADM, o menu lateral exibe a seção <strong>Administração</strong> com:
            <br>• <strong>Usuários</strong> – criar, editar e bloquear usuários
            <br>• <strong>Permissões</strong> – matriz de acesso por módulo
            <br>• <strong>Configurações</strong> – dados da empresa e do sistema
            <br>• <strong>Logs do Sistema</strong> – auditoria completa de ações
            <br>• <strong>Backup e Dados</strong> – exportação CSV e backup geral
          </div>
        </div>

        <!-- DICA PEDIDOS PDF -->
        <div style="background:rgba(0,180,184,0.05);border:1px solid rgba(0,180,184,0.2);border-radius:10px;padding:14px">
          <div style="font-size:11px;font-weight:700;color:#00b4b8;margin-bottom:8px"><i class="fas fa-file-pdf" style="margin-right:6px"></i>Pedidos de Compra – PDF e E-mail</div>
          <div style="font-size:12px;color:#c9d1d9;line-height:1.7">
            Após criar um Pedido de Compra, o sistema exibe automaticamente um modal com 3 opções:<br>
            • <strong>Enviar por e-mail (via sistema)</strong> – envia com corpo padronizado contendo todos os itens e valor total para o e-mail do fornecedor cadastrado ou outro endereço informado<br>
            • <strong>Apenas salvar PDF</strong> – faz o download do PDF sem envio por e-mail<br>
            • Em <strong>Ver Detalhes</strong> de qualquer pedido, os botões <strong>Baixar PDF</strong> e <strong>Enviar por E-mail</strong> estão sempre disponíveis
          </div>
        </div>
      </div>

      <div style="padding:14px 24px;border-top:1px solid #30363d;display:flex;justify-content:flex-end">
        <button onclick="document.getElementById('instrucoesTempOverlay').remove()" style="background:#00b4b8;color:#fff;border:none;padding:8px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">
          <i class="fas fa-check"></i> Entendido – Fechar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  // Permite fechar clicando fora
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// ─────────────────────────────────────────────────────────
// SISTEMA DE AUTENTICAÇÃO
// Credenciais armazenadas em localStorage por usuário ADM
// ─────────────────────────────────────────────────────────

// Senhas padrão iniciais (primeiro acesso)
// Formato: email.toLowerCase() → { profile, senhaHash, primeiroAcesso }
const SENHA_PADRAO = 'Fraser@2025';

function _hashSimples(str) {
  // Hash simples (não criptográfico) – adequado para sistema interno de demonstração
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; }
  return String(Math.abs(h));
}

function _getCredenciais() {
  try {
    const raw = localStorage.getItem('fa_credenciais');
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}

function _saveCredenciais(obj) {
  localStorage.setItem('fa_credenciais', JSON.stringify(obj));
}

// Inicializa credenciais padrão se não existirem
function _inicializarCredenciais() {
  const creds = _getCredenciais();
  const defaults = [
    { email: 'admin@fraseralexander.com.br',      profile: 'admin',      nome: 'Administrador' },
    { email: 'diretor@fraseralexander.com.br',     profile: 'diretor',    nome: 'Diretor Geral' },
    { email: 'financeiro@fraseralexander.com.br',  profile: 'financeiro', nome: 'Financeiro' },
    { email: 'operacao@fraseralexander.com.br',    profile: 'operacao',   nome: 'Operação' },
    { email: 'compras@fraseralexander.com.br',     profile: 'compras',    nome: 'Comprador Principal' },
    { email: 'supervisor@fraseralexander.com.br',  profile: 'supervisor', nome: 'Supervisor' },
  ];
  defaults.forEach(u => {
    if (!creds[u.email]) {
      creds[u.email] = {
        profile: u.profile,
        nome: u.nome,
        senhaHash: _hashSimples(SENHA_PADRAO),
        primeiroAcesso: true, // todos devem trocar senha no 1º login
        ativo: true,
        criadoPorAdm: true
      };
    }
  });
  // ADM nunca precisa trocar senha padrão (já configurado)
  if (creds['admin@fraseralexander.com.br']) {
    creds['admin@fraseralexander.com.br'].primeiroAcesso = false;
  }
  _saveCredenciais(creds);
  return creds;
}

function toggleSenhaLogin() {
  const inp = document.getElementById('loginPass');
  const ico = document.getElementById('eyeIcon');
  if (inp.type === 'password') { inp.type = 'text'; ico.className = 'fas fa-eye-slash'; }
  else { inp.type = 'password'; ico.className = 'fas fa-eye'; }
}

function _mostrarErroLogin(msg) {
  const el = document.getElementById('loginError');
  const ms = document.getElementById('loginErrorMsg');
  if (el && ms) { ms.textContent = msg; el.style.display = 'block'; }
  else showToast(msg, 'error');
}

function _limparErroLogin() {
  const el = document.getElementById('loginError');
  if (el) el.style.display = 'none';
}

// --- LOGIN ---
function doLogin() {
  _limparErroLogin();
  const emailRaw  = (document.getElementById('loginEmail').value || '').trim();
  const senha     = (document.getElementById('loginPass').value  || '').trim();
  const emailKey  = emailRaw.toLowerCase();

  if (!emailRaw) { _mostrarErroLogin('Informe seu e-mail corporativo.'); return; }
  if (!senha)    { _mostrarErroLogin('Informe sua senha.'); return; }

  const creds = _inicializarCredenciais();
  const userCred = creds[emailKey];

  if (!userCred) {
    _mostrarErroLogin('E-mail não encontrado. Verifique com o Administrador do Sistema.');
    return;
  }
  if (!userCred.ativo) {
    _mostrarErroLogin('Usuário bloqueado ou inativo. Entre em contato com o ADM.');
    return;
  }
  if (_hashSimples(senha) !== userCred.senhaHash) {
    _mostrarErroLogin('Senha incorreta. Verifique e tente novamente.');
    return;
  }

  // Login OK – verifica primeiro acesso
  if (userCred.primeiroAcesso) {
    _abrirTrocaSenhaPrimeiroAcesso(emailKey, userCred);
    return;
  }

  loginAs(userCred.profile, emailRaw);
}

function quickLogin(profile) {
  // Acesso rápido: e-mails reais cadastrados no D1
  const emailMap = {
    admin:      'admin@fraseralexander.com.br',
    diretor:    'diretor@fraseralexander.com.br',
    financeiro: 'financeiro@fraseralexander.com.br',
    operacao:   'operacao@fraseralexander.com.br',
    compras:    'compras@fraseralexander.com.br',
    ssma:       'ssma@fraseralexander.com.br',
    rh:         'rh@fraseralexander.com.br',
    supervisor: 'supervisor@fraseralexander.com.br',
  };
  _inicializarCredenciais();
  loginAs(profile, emailMap[profile] || '');
}

// ── TELA DE PRIMEIRO ACESSO ───────────────────────────────
function _abrirTrocaSenhaPrimeiroAcesso(emailKey, userCred) {
  const overlay = document.createElement('div');
  overlay.id = 'primeiroAcessoOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="background:#0d1117;border:1px solid #30363d;border-radius:14px;max-width:440px;width:90%;padding:32px;box-shadow:0 20px 60px rgba(0,0,0,0.6)">
      <div style="text-align:center;margin-bottom:24px">
        <div style="width:60px;height:60px;background:rgba(230,126,34,0.15);border:2px solid #e67e22;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
          <i class="fas fa-key" style="color:#e67e22;font-size:22px"></i>
        </div>
        <div style="font-size:17px;font-weight:700;color:#e6edf3">Primeiro Acesso</div>
        <div style="font-size:12px;color:#7d8590;margin-top:4px">Por segurança, defina uma nova senha para sua conta.</div>
      </div>
      <div style="background:rgba(230,126,34,0.08);border:1px solid rgba(230,126,34,0.25);border-radius:8px;padding:10px 14px;margin-bottom:18px;font-size:12px;color:#e67e22">
        <i class="fas fa-info-circle" style="margin-right:6px"></i>Esta é sua senha inicial <strong>Fraser@2025</strong>. Você deve criar uma nova senha pessoal agora.
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:12px;color:#7d8590;display:block;margin-bottom:6px">Nova Senha</label>
        <input type="password" id="novaSenha1" placeholder="Mínimo 8 caracteres" class="form-control" style="background:#161b22;border:1px solid #30363d;color:#e6edf3;padding:10px 14px;border-radius:8px;width:100%;box-sizing:border-box">
      </div>
      <div style="margin-bottom:20px">
        <label style="font-size:12px;color:#7d8590;display:block;margin-bottom:6px">Confirmar Nova Senha</label>
        <input type="password" id="novaSenha2" placeholder="Repita a nova senha" class="form-control" style="background:#161b22;border:1px solid #30363d;color:#e6edf3;padding:10px 14px;border-radius:8px;width:100%;box-sizing:border-box">
      </div>
      <div id="erroNovaSenha" style="display:none;color:#f87171;font-size:12px;margin-bottom:12px;background:rgba(239,68,68,0.1);padding:8px 12px;border-radius:6px"></div>
      <button onclick="_confirmarNovaSenha('${emailKey}')" style="width:100%;background:#00b4b8;color:#fff;border:none;padding:12px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">
        <i class="fas fa-check"></i> Definir Nova Senha e Acessar
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
}

function _confirmarNovaSenha(emailKey) {
  const s1 = document.getElementById('novaSenha1').value;
  const s2 = document.getElementById('novaSenha2').value;
  const erroEl = document.getElementById('erroNovaSenha');
  const mostrarErro = (msg) => { erroEl.textContent = msg; erroEl.style.display = 'block'; };

  if (!s1 || s1.length < 8) { mostrarErro('A senha deve ter no mínimo 8 caracteres.'); return; }
  if (s1 !== s2) { mostrarErro('As senhas não coincidem. Tente novamente.'); return; }
  if (s1 === SENHA_PADRAO) { mostrarErro('Não use a senha padrão do sistema. Escolha uma senha pessoal.'); return; }

  // Salva nova senha
  const creds = _getCredenciais();
  creds[emailKey].senhaHash = _hashSimples(s1);
  creds[emailKey].primeiroAcesso = false;
  _saveCredenciais(creds);

  const overlay = document.getElementById('primeiroAcessoOverlay');
  if (overlay) overlay.remove();

  showToast('Senha definida com sucesso! Bem-vindo ao sistema!', 'success');
  loginAs(creds[emailKey].profile, emailKey);
}

function loginAs(profile, emailLogin) {
  currentUser = { ...(ERP_DATA.profiles[profile] || ERP_DATA.profiles['diretor']) };
  currentUser.profile = profile;
  if (emailLogin) currentUser.email = emailLogin;
  // Expõe globalmente para que outros scripts possam acessar via window.currentUser
  window.currentUser = currentUser;

  const loginPage = document.getElementById('loginPage');
  loginPage.style.opacity = '0';
  loginPage.style.transition = 'opacity 0.4s';

  setTimeout(() => {
    loginPage.style.display = 'none';
    const app = document.getElementById('app');
    app.style.display = 'block';
    app.style.opacity = '0';
    app.style.transition = 'opacity 0.3s';
    setTimeout(() => app.style.opacity = '1', 50);

    // Atualiza sidebar user
    document.getElementById('userAvatar').textContent = currentUser.avatar;
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = currentUser.role;

    // Aplica permissões na sidebar (oculta itens sem acesso)
    if (typeof aplicarPermissoesSidebar === 'function') {
      setTimeout(aplicarPermissoesSidebar, 100);
    } else {
      const navAdmin = document.getElementById('nav-admin');
      if (navAdmin) navAdmin.style.display = profile === 'admin' ? 'block' : 'none';
    }

    // CRM só visível para diretor e admin
    const navCRM = document.getElementById('nav-crm');
    if (navCRM) navCRM.style.display = ['admin','diretor','crm'].includes(profile) ? 'block' : 'none';

    // Portal do Fornecedor só visível para usuários do tipo fornecedor
    const navPortal = document.getElementById('nav-portal');
    if (navPortal) navPortal.style.display = profile === 'fornecedor' ? 'block' : 'none';

    // Central de Alertas: feed interno — oculto para o fornecedor
    const navAlertas = document.getElementById('nav-alertas');
    if (navAlertas) navAlertas.style.display = profile === 'fornecedor' ? 'none' : 'block';

    // Dashboard BI: painel gerencial interno — oculto para o fornecedor
    const navBI = document.getElementById('nav-bi');
    if (navBI) navBI.style.display = profile === 'fornecedor' ? 'none' : 'block';

    // Registra log
    logAction('Login', 'Sistema', `Acesso realizado: ${currentUser.name} (${profile})`);

    navigate('dashboard');
    showToast(`${typeof t==='function'?t('dash_welcome'):'Bem-vindo'}, ${currentUser.name.split(' ')[0]}!`, 'success');

    // Inicializa tema, idioma e empresa após login
    const savedTheme = localStorage.getItem('erp_theme') || 'dark';
    _updateThemeIcon(savedTheme);
    _updateLangUI();
    if (typeof _renderEmpresaAtivaBadge === 'function') _renderEmpresaAtivaBadge();
    if (typeof _renderEmpresaSidebarLogo === 'function') _renderEmpresaSidebarLogo();
    // ── Alertas de Vencimento pós-login (90 / 60 / 30 dias) ──
    setTimeout(() => {
      if (typeof ctrRenderAlertasVencimento === 'function') {
        ctrRenderAlertasVencimento('ctr_alertas_vencimento');
      }
      _nexusBootAlertasVencimento();
    }, 800);
  }, 400);
}

/* ── Alertas globais de vencimento exibidos como toasts no boot ─────────── */
function _nexusBootAlertasVencimento() {
  try {
    const hoje = Date.now();
    const d30  = hoje + 30  * 86400000;
    const d60  = hoje + 60  * 86400000;
    const d90  = hoje + 90  * 86400000;
    const contratos = [
      ...(ERP_DATA?.contratos || []),
      ...JSON.parse(localStorage.getItem('fa_contratos') || '[]'),
    ];
    const dedup = {};
    contratos.forEach(c => { if (c?.id) dedup[c.id] = c; });
    const ativos = Object.values(dedup).filter(c => !/Encerrado|Suspenso/i.test(c.status || ''));
    const criticos = [], alertas = [], avisos = [];
    ativos.forEach(c => {
      const f = c.data_fim || c.vigencia_fim || c.fim;
      if (!f) return;
      const ts = new Date(f).getTime();
      const dias = Math.round((ts - hoje) / 86400000);
      if (dias < 0)      return; // já vencido — tratado na lista
      if (dias <= 30)    criticos.push({ id: c.id, cliente: c.cliente || c.empresa || c.id, dias });
      else if (dias <= 60) alertas.push({ id: c.id, cliente: c.cliente || c.empresa || c.id, dias });
      else if (dias <= 90) avisos.push({ id: c.id, cliente: c.cliente || c.empresa || c.id, dias });
    });
    if (criticos.length)
      showToast(`🔴 ${criticos.length} contrato(s) vencem em ≤30 dias! (ex: ${criticos[0].cliente} – ${criticos[0].dias}d)`, 'error', 7000);
    else if (alertas.length)
      showToast(`🟠 ${alertas.length} contrato(s) vencem em ≤60 dias (ex: ${alertas[0].cliente} – ${alertas[0].dias}d)`, 'warning', 5000);
    else if (avisos.length)
      showToast(`🟡 ${avisos.length} contrato(s) vencem em ≤90 dias (ex: ${avisos[0].cliente} – ${avisos[0].dias}d)`, 'info', 4000);
  } catch(e) { /* silent */ }
}

function doLogout() {
  const emp = typeof getEmpresaAtiva === 'function' ? getEmpresaAtiva() : null;
  const logoHtml = (emp && emp.logo)
    ? `<img src="${emp.logo}" alt="${emp.fantasia||emp.nome}" style="height:48px;border-radius:6px;margin-bottom:12px">`
    : `<div style="width:64px;height:64px;border-radius:14px;background:${emp&&emp.cor_primaria||'var(--orange)'};
       display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;
       color:#fff;margin:0 auto 12px">${(emp?((emp.fantasia||emp.nome||'E').charAt(0).toUpperCase()):'G')}</div>`;
  openModal(typeof t==='function'?t('logout'):'Sair do Sistema', `
    <div style="text-align:center;padding:8px 0 16px">
      ${logoHtml}
      <p style="color:var(--text-secondary);font-size:14px">Tem certeza que deseja encerrar a sessão?</p>
    </div>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-danger" onclick="confirmLogout()" style="flex:1">
        <i class="fas fa-sign-out-alt"></i> ${typeof t==='function'?t('logout'):'Sair'}
      </button>
      <button class="btn btn-secondary" onclick="closeModal()" style="flex:1">${typeof t==='function'?t('cancel'):'Cancelar'}</button>
    </div>
  `, '');
}

function confirmLogout() {
  logAction('Logout', 'Sistema', 'Sessão encerrada pelo usuário');
  closeModal();
  const app = document.getElementById('app');
  app.style.opacity = '0';
  app.style.transition = 'opacity 0.3s';
  setTimeout(() => {
    app.style.display = 'none';
    const lp = document.getElementById('loginPage');
    lp.style.display = 'flex';
    lp.style.opacity = '0';
    lp.style.transition = 'opacity 0.3s';
    setTimeout(() => { lp.style.opacity = '1'; app.style.opacity = '1'; }, 50);
    currentUser = null;
    window.currentUser = null;
  }, 300);
}

// --- NAVEGAÇÃO ---
const PAGE_META = {
  dashboard:        { label: 'Dashboard',                              icon: 'th-large' },
  projetos_gantt:   { label: 'Projetos & Gantt',                        icon: 'project-diagram' },
  contratos:        { label: 'Contratos',                               icon: 'file-contract' },
  os: { label: 'Ordens de Serviço', icon: 'clipboard-list' },
  apontamento:               { label: 'Apontamento Operacional Diário',       icon: 'clock' },
  inteligencia_suprimentos:  { label: 'Inteligência Estratégica de Suprimentos', icon: 'chess' },
  medicao: { label: 'Medição', icon: 'ruler-combined' },
  custos: { label: 'Controle de Custos (WBS)', icon: 'chart-area' },
  financeiro: { label: 'Painel Financeiro', icon: 'chart-line' },
  faturamento: { label: 'Faturamento', icon: 'file-invoice-dollar' },
  contas_pagar: { label: 'Contas a Pagar', icon: 'hand-holding-usd' },
  compras: { label: 'Suprimentos', icon: 'shopping-cart' },
  fluxo_compras:       { label: 'Fluxo Aprovação de Requisições de Compras', icon: 'project-diagram' },
  fluxo_aprovacao_rc:  { label: 'Fluxo Aprovação de Requisições de Compras', icon: 'project-diagram' },
  fornecedores: { label: 'Fornecedores', icon: 'building' },
  requisicoes: { label: 'Emissão de Requisições', icon: 'file-alt' },
  mapa_cotacao: { label: 'Mapa Comparativo de Propostas', icon: 'balance-scale' },
  pedidos: { label: 'Pedidos de Compra', icon: 'shopping-cart' },
  materiais: { label: 'Cadastro de Materiais', icon: 'cube' },
  contratos_sup: { label: 'Contratos de Fornecimento', icon: 'handshake' },
  crm: { label: 'CRM Comercial', icon: 'handshake' },
  rfq: { label: 'Cotações (RFQ)', icon: 'file-signature' },
  recebimento: { label: 'Recebimento de Materiais', icon: 'dolly' },
  contratos_3rd: { label: 'Contratos de Terceiros', icon: 'file-alt' },
  avaliacao_forn: { label: 'Avaliação de Fornecedores', icon: 'star' },
  idf: { label: 'IDF – Índice de Desenvolvimento de Fornecedores', icon: 'chart-bar' },
  auditoria_ai: { label: 'Auditoria Inteligente AI', icon: 'robot' },
  iso: { label: 'Auditoria ISO / Conformidade', icon: 'certificate' },
  lgpd: { label: 'Conformidade LGPD', icon: 'user-shield' },
  portal: { label: 'Portal do Fornecedor', icon: 'store' },
  alertas: { label: 'Central de Alertas', icon: 'bell' },
  bi: { label: 'Dashboard BI', icon: 'chart-line' },
  meu_painel: { label: 'Meu Painel de Pendências', icon: 'th-large' },
  equipe: { label: 'Equipe / Mobilização', icon: 'users' },
  frota: { label: 'Frota / Equipamentos', icon: 'truck' },
  estoque: { label: 'Almoxarifado', icon: 'boxes' },
  ssma: { label: 'SSMA', icon: 'hard-hat' },
  documentos: { label: 'Documentos', icon: 'folder-open' },
  treinamentos: { label: 'Treinamentos', icon: 'graduation-cap' },
  relatorios: { label: 'Relatórios', icon: 'chart-bar' },
  admin_usuarios: { label: 'Gestão de Usuários', icon: 'users-cog' },
  admin_config: { label: 'Configurações do Sistema', icon: 'cog' },
  admin_logs: { label: 'Logs do Sistema', icon: 'history' },
  admin_backup: { label: 'Backup e Dados', icon: 'database' },
  dre:          { label: 'DRE & Fluxo de Caixa Projetado', icon: 'chart-bar' },
  ativo_fixo:   { label: 'Ativo Fixo / Patrimônio', icon: 'building' },
  kpi_exec:     { label: 'KPI Executivo / Business Intelligence', icon: 'chart-pie' },
  fiscal:       { label: 'Fiscal & Obrigações Acessórias', icon: 'landmark' },
  perfil: { label: 'Meu Perfil', icon: 'user-circle' },
  dre:          { label: 'DRE & Fluxo de Caixa',           icon: 'chart-pie' },
  ativo_fixo:   { label: 'Ativo Fixo / Patrimônio',         icon: 'building' },
  kpi_exec:     { label: 'KPI Executivo & BI',              icon: 'tachometer-alt' },
  fiscal:       { label: 'Fiscal & Obrigações Acessórias',  icon: 'receipt' },
  comparativo:              { label: 'Análise Comparativa ERP',                    icon: 'chart-bar' },
  busca_global:             { label: 'Busca Global & Timeline',                      icon: 'search' },
  criterios_medicao:        { label: 'Critérios de Medição & Checklists IA',          icon: 'tasks' },
  governanca:               { label: 'Painel de Governança',                         icon: 'shield-alt' },
  benchmark_ia:             { label: 'Benchmark Público de Mercado — IA',           icon: 'trophy' },
  inteligencia_adaptativa:  { label: 'Inteligência Adaptativa ao Negócio',           icon: 'brain' },
  ssma:                     { label: 'SSMA / Qualidade / Compliance',                icon: 'hard-hat' },
  custos:                   { label: 'Controle de Custos & Rastreabilidade',         icon: 'chart-area' },
};

function navigate(page) {
  currentPage = page;

  // Atualiza nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    const onclick = item.getAttribute('onclick') || '';
    if (onclick.includes(`'${page}'`)) item.classList.add('active');
  });

  // Breadcrumb
  const meta = PAGE_META[page] || { label: page, icon: 'circle' };
  document.getElementById('breadcrumb').innerHTML = `
    <span class="breadcrumb-item"><i class="fas fa-${meta.icon}"></i></span>
    <span class="breadcrumb-item">›</span>
    <span class="breadcrumb-item active">${meta.label}</span>
  `;

  const main = document.getElementById('mainContent');
  main.scrollTop = 0;

  const pages = {
    dashboard: renderDashboard,
    contratos: renderContratos,
    os: renderOS,
    apontamento:              function() { if(typeof renderApontamento === 'function') renderApontamento(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando Apontamento...</p>'; },
    inteligencia_suprimentos: function() { if(typeof renderInteligenciaSuprimentos === 'function') renderInteligenciaSuprimentos(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando Inteligência Estratégica...</p>'; },
    medicao: renderMedicao,
    custos: renderCustos,
    financeiro: renderFinanceiro,
    faturamento: renderFaturamento,
    contas_pagar: renderContasPagar,
    compras: renderCompras,
    fluxo_compras:         function() { if(typeof renderFluxoAprovacaoRC === 'function') renderFluxoAprovacaoRC(); else renderFluxoCompras(); },
    fluxo_aprovacao_rc:    function() { if(typeof renderFluxoAprovacaoRC === 'function') renderFluxoAprovacaoRC(); else renderFluxoCompras(); },
    fornecedores:          renderFornecedores,
    requisicoes:           function() { if(typeof renderRequisicoes === 'function') renderRequisicoes(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando Requisições...</p>'; },
    mapa_cotacao: renderMapaCotacao,
    pedidos: renderPedidos,
    materiais: renderMateriais,
    contratos_sup: renderContratosFor,
    crm: renderCRM,
    proposta_comercial: function() { if(typeof renderPropostaComercial === 'function') renderPropostaComercial(); else document.getElementById('mainContent').innerHTML = '<p>Módulo em carregamento...</p>'; },
    rfq: renderRFQ,
    recebimento: renderRecebimento,
    contratos_3rd: renderGestaoContratosTerceiros,
    avaliacao_forn: renderAvaliacaoFornecedores,
    idf: renderIDF,
    auditoria_ai: function() { if(typeof renderAuditoriaAI === 'function') renderAuditoriaAI(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando Auditoria AI...</p>'; },
    iso: function() { if(typeof renderISO === 'function') renderISO(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando Auditoria ISO...</p>'; },
    lgpd: function() { if(typeof renderLGPD === 'function') renderLGPD(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando LGPD...</p>'; },
    portal: function() { if(typeof renderPortal === 'function') renderPortal(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando Portal...</p>'; },
    alertas: function() { if(typeof renderAlertas === 'function') renderAlertas(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando Alertas...</p>'; },
    bi: function() { if(typeof renderBI === 'function') renderBI(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando BI...</p>'; },
    meu_painel: function() { if(typeof renderMeuPainel === 'function') renderMeuPainel(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando Meu Painel...</p>'; },
    equipe: renderEquipe,
    frota: renderFrota,
    estoque: function() { if(typeof renderAlmoxarifado === 'function') renderAlmoxarifado(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando Almoxarifado...</p>'; },
    ssma: renderSSMA,
    documentos: renderDocumentos,
    treinamentos: renderTreinamentos,
    relatorios: renderRelatorios,
    admin_usuarios: renderAdminUsuarios,
    admin_config: renderAdminConfig,
    admin_logs: renderAdminLogs,
    admin_backup: renderAdminBackup,
    perfil: renderPerfil,
    projetos_gantt: function() { if(typeof renderProjetosGantt === 'function') renderProjetosGantt(); else document.getElementById('mainContent').innerHTML = '<p style="color:#fff;padding:40px">Módulo Projetos & Gantt carregando...</p>'; },
    dre:        function() { if(typeof renderDRE === 'function') renderDRE(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando DRE...</p>'; },
    ativo_fixo: function() { if(typeof renderAtivoFixo === 'function') renderAtivoFixo(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando Ativo Fixo...</p>'; },
    kpi_exec:   function() { if(typeof renderKPIExecutivo === 'function') renderKPIExecutivo(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando KPI Executivo...</p>'; },
    fiscal:     function() { if(typeof renderFiscal === 'function') renderFiscal(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando Fiscal...</p>'; },
    comparativo: function() { if(typeof renderComparativoERP === 'function') renderComparativoERP(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando Análise Comparativa...</p>'; },
    benchmark_ia: function() { if(typeof renderBenchmarkIA === 'function') renderBenchmarkIA(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando Benchmark Público...</p>'; },
    inteligencia_adaptativa: function() { if(typeof renderInteligenciaAdaptativa === 'function') renderInteligenciaAdaptativa(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando Inteligência Adaptativa...</p>'; },
    busca_global: function() { if(typeof renderBuscaGlobal === 'function') renderBuscaGlobal(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando Busca Global...</p>'; },
    criterios_medicao: function() { if(typeof renderCriteriosMedicao === 'function') renderCriteriosMedicao(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando Critérios de Medição...</p>'; },
    governanca: function() { if(typeof renderGovernancePanel === 'function') renderGovernancePanel(); else document.getElementById('mainContent').innerHTML = '<p style="padding:40px">Carregando Painel de Governança...</p>'; },
  };

  if (pages[page]) {
    pages[page]();
  } else {
    main.innerHTML = `
      <div class="empty-state" style="padding-top:80px">
        <i class="fas fa-tools" style="color:var(--fa-teal)"></i>
        <p style="margin-top:12px;font-size:16px;font-weight:500">Módulo em desenvolvimento</p>
        <p style="font-size:13px;margin-top:4px">${meta.label}</p>
      </div>`;
  }

  return false;
}

// --- SIDEBAR TOGGLE ---
function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  const sidebar = document.getElementById('sidebar');
  const topbar = document.getElementById('topbar');
  const main = document.getElementById('mainContent');
  [sidebar, topbar, main].forEach(el => {
    el.classList.toggle('collapsed', sidebarCollapsed);
    el.classList.toggle('sidebar-collapsed', sidebarCollapsed);
  });
}

// --- MODAL ---
function openModal(title, body, footer = '') {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modalFooter').innerHTML = footer;
  // Rola o overlay para o topo antes de mostrar
  const overlay = document.getElementById('globalModal');
  overlay.scrollTop = 0;
  overlay.classList.add('show');
  // Rola o body do modal para o topo
  const mb = document.getElementById('modalBody');
  if (mb) mb.scrollTop = 0;
}

function openModalWide(title, body, footer = '') {
  const mc = document.getElementById('modalContainer');
  mc.style.maxWidth = '900px';
  openModal(title, body, footer);
}

function openModalXL(title, body, footer = '') {
  const mc = document.getElementById('modalContainer');
  mc.style.maxWidth = '1100px';
  openModal(title, body, footer);
}

function closeModal() {
  document.getElementById('globalModal').classList.remove('show');
  const mc = document.getElementById('modalContainer');
  if (mc) {
    mc.style.maxWidth = '560px';
    mc.style.width = '';
  }
}

document.getElementById('globalModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// --- TOAST ---
function showToast(message, type = 'info', duration = 3500) {
  const icons = { success: 'check-circle', error: 'times-circle', warning: 'exclamation-triangle', info: 'info-circle' };
  const colors = { success: 'var(--green-light)', error: 'var(--red-light)', warning: 'var(--yellow-light)', info: 'var(--fa-teal)' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas fa-${icons[type]}" style="color:${colors[type]};font-size:16px;min-width:16px"></i>
    <span style="flex:1">${message}</span>
  `;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// --- NOTIFICAÇÕES ---
function showNotifications() {
  openModal('Central de Notificações', `
    <div class="alert alert-info">
      <span class="alert-icon"><i class="fas fa-info-circle"></i></span>
      <div><div class="alert-title">Sem notificações pendentes</div><div class="alert-desc">Nenhuma notificação no momento. Alertas aparecerão aqui conforme a atividade do sistema.</div></div>
    </div>
  `);
}

// --- LOG DO SISTEMA ---
const SYSTEM_LOGS = [];

function logAction(acao, modulo, descricao) {
  if (!currentUser) return;
  SYSTEM_LOGS.unshift({
    usuario: currentUser.name,
    perfil: currentUser.profile,
    acao,
    modulo,
    descricao,
    data_hora: new Date().toLocaleString('pt-BR'),
    ip: '192.168.1.' + Math.floor(Math.random() * 100 + 10)
  });
  // Mantém apenas os últimos 100
  if (SYSTEM_LOGS.length > 100) SYSTEM_LOGS.pop();
}

// --- HELPERS ---
function fmt(value) {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  return 'R$ ' + Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtK(value) {
  if (!value) return 'R$ 0';
  if (value >= 1000000) return 'R$ ' + (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return 'R$ ' + (value / 1000).toFixed(0) + 'K';
  return fmt(value);
}

function fmtDate(str) {
  if (!str || str === '—') return '—';
  return str;
}

function stars(rating) {
  const n = Math.round(rating || 0);
  return '<span class="star-rating">' + '★'.repeat(n) + '☆'.repeat(5 - n) + '</span> ' +
    '<span style="font-size:11px;color:var(--text-secondary)">' + (rating || 0).toFixed(1) + '</span>';
}

function statusBadge(status) {
  const map = {
    'Ativo': 'badge-success', 'Mobilização': 'badge-info', 'Encerrado': 'badge-muted',
    'Suspenso': 'badge-danger', 'Em Andamento': 'badge-info', 'Concluída': 'badge-success',
    'Agendada': 'badge-orange', 'Pausada': 'badge-warning', 'Aguardando Peça': 'badge-danger',
    'Rascunho': 'badge-muted', 'Em Análise': 'badge-info', 'Aprovada': 'badge-success',
    'Glosada': 'badge-warning', 'Paga': 'badge-success', 'Pendente': 'badge-warning',
    'Aguardando': 'badge-info', 'Atrasada': 'badge-danger', 'Bloqueado': 'badge-danger',
    'Mobilizando': 'badge-orange', 'Conforme': 'badge-success', 'Alerta': 'badge-warning',
    'N/A': 'badge-muted', 'OK': 'badge-success', 'Atenção': 'badge-warning', 'Crítico': 'badge-danger',
    'Válido': 'badge-success', 'Vencendo': 'badge-warning', 'Vencido': 'badge-danger',
    'Em Homologação': 'badge-orange', 'Aprovado': 'badge-success', 'Emitido': 'badge-info',
    'Entregue Total': 'badge-success', 'Entregue Parcial': 'badge-warning', 'Cancelado': 'badge-danger',
    'Aguardando Aprovação': 'badge-warning', 'Pago': 'badge-success', 'Urgente': 'badge-danger',
    'Alta': 'badge-warning', 'Normal': 'badge-muted', 'Inativo': 'badge-muted',
    'admin': 'badge-purple', 'diretor': 'badge-info', 'financeiro': 'badge-success',
    'operacao': 'badge-orange', 'compras': 'badge-warning', 'ssma': 'badge-danger',
    'rh': 'badge-info', 'supervisor': 'badge-muted',
    'Em Investigação': 'badge-warning', 'Concluído': 'badge-success', 'Plano de Ação Aberto': 'badge-danger',
    'Atrasado': 'badge-danger', 'Em Aprovação': 'badge-warning'
  };
  const cls = map[status] || 'badge-muted';
  return `<span class="badge ${cls}">${status}</span>`;
}

function prioridade(p) {
  const map = { 'Crítica': 'badge-danger', 'Urgente': 'badge-danger', 'Alta': 'badge-warning', 'Normal': 'badge-muted' };
  return `<span class="badge ${map[p] || 'badge-muted'}">${p}</span>`;
}

// Confirmar ação genérica
function confirmarAcao(titulo, msg, onConfirm, danger = false) {
  openModal(titulo, `
    <p style="color:var(--text-secondary);font-size:14px;line-height:1.6">${msg}</p>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" onclick="${onConfirm};closeModal()">Confirmar</button>
  `);
}

// Gerar ID único
function gerarId(prefix) {
  return prefix + '-' + Date.now().toString(36).toUpperCase();
}

// =====================================================
// INICIALIZAÇÃO TEMA + IDIOMA + EMPRESA (carregamento)
// =====================================================
(function _initAppExtensions() {
  // Aplica tema salvo (anti-flash já feito no <head>, aqui apenas atualiza ícone)
  const savedTheme = localStorage.getItem('erp_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Aguarda DOM pronto para atualizar ícone e idioma
  function _onReady() {
    _updateThemeIcon(savedTheme);
    _updateLangUI();
    // Adiciona listener hover nos itens do dropdown de idioma
    const drop = document.getElementById('langDrop');
    if (drop) {
      drop.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('mouseenter', () => btn.style.background = 'var(--bg-hover)');
        btn.addEventListener('mouseleave', () => {
          const lang = typeof getLang === 'function' ? getLang() : localStorage.getItem('erp_lang') || 'pt';
          btn.style.background = btn.getAttribute('data-lang-btn') === lang
            ? 'rgba(230,126,34,0.12)' : 'none';
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _onReady);
  } else {
    _onReady();
  }

  // Overrides setLang para também atualizar UI do topbar
  const _origSetLang = window.setLang;
  window.setLang = function(lang) {
    if (_origSetLang) _origSetLang(lang);
    _updateLangUI();
  };
})();

// =====================================================
// UTILITÁRIO DE VALIDAÇÃO DE FORMULÁRIOS
// =====================================================
/**
 * _validarCampos(regras)
 * Valida campos de formulário e exibe feedback visual inline.
 *
 * @param {Array} regras - Array de objetos:
 *   { id: 'elementId', label: 'Nome amigável', required: true, minVal: 0, tipo: 'cnpj'|'email'|'date' }
 * @returns {boolean} true se válido, false se houver erro
 */
function _validarCampos(regras) {
  let valido = true;

  // Limpa erros anteriores
  regras.forEach(r => {
    const el = typeof r.id === 'string' ? document.getElementById(r.id) : r.el;
    if (!el) return;
    el.style.borderColor = '';
    el.style.boxShadow = '';
    const errEl = document.getElementById('_valerr_' + (r.id || r.key));
    if (errEl) errEl.remove();
  });

  regras.forEach(r => {
    const el = typeof r.id === 'string' ? document.getElementById(r.id) : r.el;
    if (!el) return;
    const val = el.value ? el.value.trim() : '';
    let msg = null;

    if (r.required && !val) {
      msg = `${r.label || r.id} é obrigatório.`;
    } else if (val && r.tipo === 'cnpj') {
      const nums = val.replace(/\D/g,'');
      if (nums.length !== 14) msg = `CNPJ inválido (deve ter 14 dígitos).`;
    } else if (val && r.tipo === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) msg = `E-mail inválido.`;
    } else if (val && r.minVal !== undefined) {
      const n = parseFloat(val);
      if (isNaN(n) || n < r.minVal) msg = `${r.label || r.id}: valor mínimo é ${r.minVal}.`;
    } else if (val && r.minLen !== undefined && val.length < r.minLen) {
      msg = `${r.label || r.id}: mínimo ${r.minLen} caracteres.`;
    }

    if (msg) {
      valido = false;
      el.style.borderColor = '#dc2626';
      el.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.18)';
      // Insere mensagem de erro abaixo do campo
      const errEl = document.createElement('div');
      errEl.id = '_valerr_' + (r.id || r.key || Math.random());
      errEl.style.cssText = 'color:#dc2626;font-size:11px;margin-top:3px;display:flex;align-items:center;gap:4px';
      errEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
      el.parentNode.appendChild(errEl);
      // Remove borda vermelha ao corrigir
      el.addEventListener('input', function _fix() {
        el.style.borderColor = '';
        el.style.boxShadow = '';
        errEl.remove();
        el.removeEventListener('input', _fix);
      }, { once: true });
    }
  });

  if (!valido) {
    // Scroll para o primeiro campo com erro
    const firstErr = document.querySelector('[style*="border-color: rgb(220, 38, 38)"]');
    if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return valido;
}

window._validarCampos = _validarCampos;
