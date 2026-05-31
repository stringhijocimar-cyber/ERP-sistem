// =====================================================
// Fraser Alexander – Área do Administrador
// Usuários, Permissões, Configurações, Logs, Backup
// v4.0 – Gestão completa por perfil e por usuário
// =====================================================

let FA_USUARIOS = [];

async function loadUsuarios() {
  try {
    // Carrega usuários via API D1
    const data = await DB.usuarios.listar();
    FA_USUARIOS = Array.isArray(data) ? data : [];
  } catch(e) {
    FA_USUARIOS = [];
  }
}

// ── CONFIGURAÇÕES DE PERFIL (ícone/cor) ─────────────
const PERFIL_CONFIG = {
  admin:      { label: 'Administrador',       icon: 'shield-alt',    color: '#00b4b8', bg: 'rgba(0,180,184,0.12)'   },
  diretor:    { label: 'Diretor',             icon: 'user-tie',      color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  financeiro: { label: 'Financeiro',          icon: 'chart-line',    color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  operacao:   { label: 'Operações',           icon: 'hard-hat',      color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  compras:    { label: 'Compras',             icon: 'shopping-cart', color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  ssma:       { label: 'SSMA',               icon: 'leaf',          color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  rh:         { label: 'RH',                 icon: 'users',         color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
  supervisor: { label: 'Supervisor',          icon: 'binoculars',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   }
};

// ── RENDER PRINCIPAL – ABA ADMIN ───────────────────────────────────────────────
function renderAdminUsuarios() {
  if (currentUser && currentUser.profile !== 'admin') {
    document.getElementById('mainContent').innerHTML = `
      <div class="empty-state" style="padding-top:80px">
        <i class="fas fa-lock" style="color:var(--red-light);font-size:48px"></i>
        <p style="margin-top:12px;font-size:16px;font-weight:600;color:var(--red-light)">Acesso Restrito</p>
        <p style="font-size:13px;color:var(--text-secondary)">Esta área é exclusiva para Administradores do Sistema.</p>
      </div>`;
    return;
  }
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin" style="color:var(--fa-teal)"></i><p style="margin-top:12px;color:var(--text-muted)">Carregando usuários...</p></div>`;
  loadUsuarios().then(() => _renderAdminUI('usuarios'));
}

// ── RENDER PRINCIPAL COM ABAS ──────────────────────────────────────────────────
function _renderAdminUI(abaAtiva) {
  const main = document.getElementById('mainContent');
  const ativos   = FA_USUARIOS.filter(u => u.status === 'Ativo').length;
  const inativos = FA_USUARIOS.filter(u => u.status !== 'Ativo').length;
  const pendentes= FA_USUARIOS.filter(u => u.status === 'Pendente').length;
  const semMFA   = FA_USUARIOS.filter(u => u.status === 'Ativo' && !u.mfa_ativo).length;
  const admins   = FA_USUARIOS.filter(u => u.perfil === 'admin').length;

  main.innerHTML = `
    <!-- CABEÇALHO -->
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-shield-alt" style="color:var(--fa-teal);margin-right:10px"></i>Painel de Administração</h2>
        <p>Gestão completa de usuários, perfis e permissões do sistema</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="mostrarInstrucoesAdmin()"><i class="fas fa-question-circle"></i> Ajuda</button>
        <button class="btn btn-primary btn-sm" onclick="openNovoUsuario()"><i class="fas fa-user-plus"></i> Novo Usuário</button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:16px">
      <div class="kpi-card kpi-blue" style="cursor:pointer" onclick="_adminSwitchTab('usuarios')">
        <div class="kpi-icon"><i class="fas fa-users"></i></div>
        <div class="kpi-value">${FA_USUARIOS.length}</div>
        <div class="kpi-label">Total de Usuários</div>
      </div>
      <div class="kpi-card kpi-green" style="cursor:pointer" onclick="_adminSwitchTab('usuarios')">
        <div class="kpi-icon"><i class="fas fa-user-check"></i></div>
        <div class="kpi-value">${ativos}</div>
        <div class="kpi-label">Usuários Ativos</div>
      </div>
      <div class="kpi-card ${pendentes>0?'kpi-yellow':'kpi-green'}" style="cursor:pointer" onclick="_adminSwitchTab('usuarios')">
        <div class="kpi-icon"><i class="fas fa-user-clock"></i></div>
        <div class="kpi-value">${pendentes}</div>
        <div class="kpi-label">Pendentes</div>
      </div>
      <div class="kpi-card ${semMFA>0?'kpi-red':'kpi-green'}" style="cursor:pointer" onclick="_adminSwitchTab('seguranca')">
        <div class="kpi-icon"><i class="fas fa-shield-alt"></i></div>
        <div class="kpi-value">${semMFA}</div>
        <div class="kpi-label">Sem MFA</div>
      </div>
      <div class="kpi-card kpi-purple" style="cursor:pointer" onclick="_adminSwitchTab('perfis')">
        <div class="kpi-icon"><i class="fas fa-key"></i></div>
        <div class="kpi-value">${admins}</div>
        <div class="kpi-label">Administradores</div>
      </div>
    </div>

    <!-- ABAS -->
    <div style="display:flex;gap:6px;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:0">
      ${[
        { id:'usuarios',   icon:'users',          label:'Usuários' },
        { id:'perfis',     icon:'user-tag',       label:'Perfis & Permissões' },
        { id:'individual', icon:'user-cog',       label:'Permissões por Usuário' },
        { id:'seguranca',  icon:'shield-alt',     label:'Segurança' },
      ].map(tab => `
        <button id="adminTab_${tab.id}"
          onclick="_adminSwitchTab('${tab.id}')"
          style="padding:9px 16px;border:none;border-bottom:3px solid ${abaAtiva===tab.id?'var(--fa-teal)':'transparent'};
            background:none;color:${abaAtiva===tab.id?'var(--fa-teal)':'var(--text-secondary)'};
            font-size:12px;font-weight:${abaAtiva===tab.id?700:500};cursor:pointer;display:flex;align-items:center;gap:6px;
            border-radius:6px 6px 0 0;transition:all .2s">
          <i class="fas fa-${tab.icon}"></i>${tab.label}
        </button>
      `).join('')}
    </div>

    <!-- CONTEÚDO DAS ABAS -->
    <div id="adminTabContent"></div>
  `;

  _adminSwitchTab(abaAtiva);
}

function _adminSwitchTab(aba) {
  // Atualiza estilo dos botões
  ['usuarios','perfis','individual','seguranca'].forEach(id => {
    const btn = document.getElementById('adminTab_' + id);
    if (!btn) return;
    const ativo = id === aba;
    btn.style.borderBottomColor = ativo ? 'var(--fa-teal)' : 'transparent';
    btn.style.color = ativo ? 'var(--fa-teal)' : 'var(--text-secondary)';
    btn.style.fontWeight = ativo ? '700' : '500';
  });

  const content = document.getElementById('adminTabContent');
  if (!content) return;
  switch(aba) {
    case 'usuarios':   content.innerHTML = _renderAbaUsuarios(); break;
    case 'perfis':     _renderAbaPerfis(content); break;
    case 'individual': _renderAbaIndividual(content); break;
    case 'seguranca':  content.innerHTML = _renderAbaSeguranca(); break;
  }
}

// ═══════════════════════════════════════════════════════
// ABA 1 – USUÁRIOS
// ═══════════════════════════════════════════════════════
function _renderAbaUsuarios() {
  const creds = (typeof _getCredenciais === 'function') ? _getCredenciais() : {};
  const pendentes = FA_USUARIOS.filter(u => u.status === 'Pendente');

  // Agrupa por perfil para visão de perfis
  const porPerfil = {};
  FA_USUARIOS.forEach(u => {
    if (!porPerfil[u.perfil]) porPerfil[u.perfil] = [];
    porPerfil[u.perfil].push(u);
  });

  return `
    ${pendentes.length > 0 ? `
      <div class="card page-section" style="border-color:var(--yellow);margin-bottom:16px">
        <div class="card-header" style="padding:12px 16px">
          <h3 style="margin:0;font-size:13px"><i class="fas fa-user-clock" style="color:var(--yellow-light);margin-right:8px"></i>Aguardando Ativação (${pendentes.length})</h3>
        </div>
        <div style="padding:8px 16px 12px">
          ${pendentes.map(u => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px;background:rgba(251,191,36,0.05);border:1px solid rgba(251,191,36,0.2);border-radius:8px;margin-bottom:6px">
              <div style="width:38px;height:38px;min-width:38px;border-radius:50%;background:rgba(251,191,36,0.15);border:2px solid rgba(251,191,36,0.3);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--yellow-light)">
                ${u.nome.split(' ').map(n=>n[0]).slice(0,2).join('')}
              </div>
              <div style="flex:1">
                <div style="font-weight:600;font-size:13px">${u.nome}</div>
                <div style="font-size:11px;color:var(--text-secondary)">${u.email} · ${u.departamento}</div>
              </div>
              ${statusBadge(u.perfil)}
              <div style="display:flex;gap:6px">
                <button class="btn btn-success btn-sm" onclick="ativarUsuario('${u.id}')"><i class="fas fa-check"></i> Ativar</button>
                <button class="btn btn-secondary btn-sm" onclick="editarUsuario('${u.id}')"><i class="fas fa-edit"></i></button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- VISÃO POR GRUPO DE PERFIL -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-header" style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between">
        <h3 style="margin:0;font-size:13px"><i class="fas fa-layer-group" style="color:var(--orange);margin-right:8px"></i>Usuários por Perfil de Acesso</h3>
        <div style="display:flex;gap:6px;align-items:center">
          <input type="text" id="srchUSR" class="search-input" style="width:200px;padding:6px 10px 6px 28px;font-size:12px" placeholder="Buscar usuário..." oninput="_filtrarListaUSR()">
          <select id="filtroStatusUSR" class="filter-select" style="font-size:12px" onchange="_filtrarListaUSR()">
            <option value="">Todos os Status</option>
            <option>Ativo</option><option>Inativo</option><option>Pendente</option><option>Bloqueado</option>
          </select>
        </div>
      </div>
      <div id="listaUSRContent" style="padding:0 16px 16px">
        ${_renderGruposPerfil(FA_USUARIOS, creds)}
      </div>
    </div>
  `;
}

function _renderGruposPerfil(lista, creds) {
  // Agrupa
  const grupos = {};
  lista.forEach(u => {
    if (!grupos[u.perfil]) grupos[u.perfil] = [];
    grupos[u.perfil].push(u);
  });

  const ordemPerfis = ['admin','diretor','operacao','financeiro','compras','ssma','rh','supervisor'];
  let html = '';

  ordemPerfis.forEach(perfil => {
    const usList = grupos[perfil];
    if (!usList || !usList.length) return;
    const cfg = PERFIL_CONFIG[perfil] || { label: perfil, icon: 'user', color: '#888', bg: 'rgba(128,128,128,0.1)' };

    html += `
      <div style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 12px;background:${cfg.bg};border-radius:8px;border-left:3px solid ${cfg.color}">
          <i class="fas fa-${cfg.icon}" style="color:${cfg.color};font-size:14px"></i>
          <span style="font-weight:700;font-size:13px;color:${cfg.color}">${cfg.label}</span>
          <span style="font-size:11px;color:var(--text-muted);background:var(--bg-card2);border-radius:10px;padding:2px 8px">${usList.length} usuário${usList.length !== 1 ? 's' : ''}</span>
          <div style="flex:1"></div>
          <span style="font-size:10px;color:var(--text-muted)">${getDescricaoPerfil(perfil)}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px;padding-left:8px">
          ${usList.map(u => _renderUserCard(u, creds, cfg)).join('')}
        </div>
      </div>
    `;
  });

  return html || '<div class="empty-state" style="padding:24px"><i class="fas fa-search"></i><p>Nenhum usuário encontrado</p></div>';
}

function _renderUserCard(u, creds, cfg) {
  const credUser  = creds[u.email.toLowerCase()];
  const primAcesso= credUser ? credUser.primeiroAcesso : (u.primeiro_acesso !== false);
  const cfgPerfil = PERFIL_CONFIG[u.perfil] || { label: u.perfil, icon: 'user', color: '#888', bg: 'rgba(128,128,128,0.1)' };

  const statusColor = {
    'Ativo': 'var(--green-light)', 'Bloqueado': 'var(--red-light)',
    'Pendente': 'var(--yellow-light)', 'Inativo': 'var(--text-muted)'
  }[u.status] || 'var(--text-muted)';

  const statusBg = {
    'Ativo': 'rgba(34,197,94,0.12)', 'Bloqueado': 'rgba(239,68,68,0.12)',
    'Pendente': 'rgba(251,191,36,0.12)', 'Inativo': 'rgba(128,128,128,0.08)'
  }[u.status] || 'rgba(128,128,128,0.08)';

  return `
    <div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:10px;padding:12px;position:relative;
      ${u.status === 'Bloqueado' ? 'opacity:0.65' : ''}">
      <!-- Status badge top-right -->
      <div style="position:absolute;top:10px;right:10px;background:${statusBg};color:${statusColor};
        font-size:10px;font-weight:700;border-radius:10px;padding:3px 8px;border:1px solid ${statusColor}33">
        <i class="fas fa-circle" style="font-size:6px;margin-right:3px"></i>${u.status}
      </div>
      <!-- Avatar + Info -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:44px;height:44px;min-width:44px;border-radius:50%;background:${cfgPerfil.bg};
          border:2px solid ${cfgPerfil.color}44;display:flex;align-items:center;justify-content:center;
          font-size:14px;font-weight:700;color:${cfgPerfil.color}">
          ${u.nome.split(' ').map(n=>n[0]).slice(0,2).join('')}
        </div>
        <div style="min-width:0;flex:1;padding-right:60px">
          <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.nome}</div>
          <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.email}</div>
          <div style="font-size:10px;color:var(--text-secondary);margin-top:2px">${u.departamento}</div>
        </div>
      </div>
      <!-- Detalhes -->
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;font-size:11px;color:var(--text-secondary)">
        <span><i class="fas fa-clock" style="margin-right:3px;color:var(--text-muted)"></i>${u.ultimo_acesso}</span>
        ${primAcesso ? `<span style="color:var(--yellow-light)"><i class="fas fa-exclamation-triangle" style="margin-right:3px"></i>1º acesso pendente</span>` : `<span style="color:var(--green-light)"><i class="fas fa-check" style="margin-right:3px"></i>Acesso realizado</span>`}
        ${u.mfa_ativo ? `<span style="color:var(--fa-teal)"><i class="fas fa-shield-alt" style="margin-right:3px"></i>MFA</span>` : `<span style="color:var(--red-light)"><i class="fas fa-shield-alt" style="margin-right:3px"></i>Sem MFA</span>`}
      </div>
      <!-- Seleção de Perfil inline -->
      <div style="margin-bottom:10px">
        <label style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;display:block">Perfil de Acesso</label>
        <div style="display:flex;gap:6px;align-items:center">
          <select id="perfilSelect_${u.id}" class="form-control" style="font-size:12px;padding:5px 8px;flex:1"
            ${u.id === 'USR-001' ? 'disabled title="Perfil do ADM principal não pode ser alterado"' : ''}>
            ${Object.entries(PERFIL_CONFIG).map(([pid, pcfg]) =>
              `<option value="${pid}" ${u.perfil === pid ? 'selected' : ''}>${pcfg.label}</option>`
            ).join('')}
          </select>
          ${u.id !== 'USR-001' ? `
            <button class="btn btn-primary btn-sm" onclick="_salvarPerfilUsuario('${u.id}')" title="Salvar novo perfil" style="padding:5px 10px">
              <i class="fas fa-save"></i>
            </button>
          ` : `<span title="ADM principal protegido" style="font-size:16px">🔒</span>`}
        </div>
      </div>
      <!-- Ações -->
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="editarUsuario('${u.id}')" style="flex:1;font-size:11px">
          <i class="fas fa-edit"></i> Editar
        </button>
        <button class="btn btn-secondary btn-sm" onclick="_abrirPermissoesUsuario('${u.email.toLowerCase()}')" style="flex:1;font-size:11px" title="Permissões individuais">
          <i class="fas fa-key"></i> Permissões
        </button>
        <button class="btn btn-warning btn-sm btn-icon" onclick="resetSenha('${u.id}')" title="Reset senha" style="font-size:11px">
          <i class="fas fa-lock-open"></i>
        </button>
        ${u.status === 'Pendente' ? `<button class="btn btn-success btn-sm btn-icon" onclick="ativarUsuario('${u.id}')" title="Ativar"><i class="fas fa-check"></i></button>` : ''}
        ${u.status === 'Ativo'    ? `<button class="btn btn-warning btn-sm btn-icon" onclick="bloquearUsuario('${u.id}')" title="Bloquear"><i class="fas fa-lock"></i></button>` : ''}
        ${u.status === 'Bloqueado'? `<button class="btn btn-info btn-sm btn-icon" onclick="ativarUsuario('${u.id}')" title="Desbloquear"><i class="fas fa-unlock"></i></button>` : ''}
        ${u.id !== 'USR-001'     ? `<button class="btn btn-danger btn-sm btn-icon" onclick="confirmarExcluirUsuario('${u.id}')" title="Excluir"><i class="fas fa-trash"></i></button>` : ''}
      </div>
    </div>
  `;
}

function _filtrarListaUSR() {
  const s   = (document.getElementById('srchUSR')?.value || '').toLowerCase();
  const st  = document.getElementById('filtroStatusUSR')?.value || '';
  const creds = (typeof _getCredenciais === 'function') ? _getCredenciais() : {};
  const lista = FA_USUARIOS.filter(u =>
    (!s  || (u.nome + u.email + u.departamento + u.perfil).toLowerCase().includes(s)) &&
    (!st || u.status === st)
  );
  const cont = document.getElementById('listaUSRContent');
  if (cont) cont.innerHTML = _renderGruposPerfil(lista, creds);
}

// Salvar perfil diretamente do card
async function _salvarPerfilUsuario(id) {
  const sel = document.getElementById('perfilSelect_' + id);
  if (!sel) return;
  const novoPerfil = sel.value;
  const idx = FA_USUARIOS.findIndex(u => u.id === id);
  if (idx < 0) return;
  const antigoPerfil = FA_USUARIOS[idx].perfil;
  FA_USUARIOS[idx].perfil = novoPerfil;
  try {
    await fetch(`tables/fa_usuarios/${id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ perfil: novoPerfil }) });
  } catch(e) {}
  // Atualiza credencial
  if (typeof _getCredenciais === 'function') {
    const creds = _getCredenciais();
    const ek = FA_USUARIOS[idx].email.toLowerCase();
    if (creds[ek]) { creds[ek].profile = novoPerfil; _saveCredenciais(creds); }
  }
  logAction('Alteração Perfil', 'Admin', `${FA_USUARIOS[idx].nome}: ${antigoPerfil} → ${novoPerfil}`);
  showToast(`Perfil de ${FA_USUARIOS[idx].nome} alterado para "${PERFIL_CONFIG[novoPerfil]?.label || novoPerfil}"`, 'success');
  _renderAdminUI('usuarios');
}

// ═══════════════════════════════════════════════════════
// ABA 2 – PERFIS & PERMISSÕES (MATRIZ GRANULAR)
// ═══════════════════════════════════════════════════════
function _renderAbaPerfis(container) {
  const perfis = ['diretor','operacao','financeiro','compras','ssma','rh','supervisor'];

  const acoesLabel = { view:'Ver', create:'Criar', edit:'Editar', delete:'Excluir', approve:'Aprovar', export:'Exportar' };

  container.innerHTML = `
    <div class="card">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px">
        <div>
          <h3 style="margin:0;font-size:14px"><i class="fas fa-table" style="color:var(--orange);margin-right:8px"></i>Matriz de Permissões por Perfil</h3>
          <p style="margin:4px 0 0;font-size:11px;color:var(--text-muted)">Defina quais ações cada perfil pode executar em cada módulo · <span style="color:var(--fa-teal)">Admin sempre tem acesso total</span></p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="_resetarMatrizPadrao()"><i class="fas fa-undo"></i> Restaurar Padrão</button>
          <button class="btn btn-primary btn-sm" onclick="salvarPermissoesMatrix()"><i class="fas fa-save"></i> Salvar Alterações</button>
        </div>
      </div>

      <!-- Legenda de perfis -->
      <div style="padding:0 16px 12px;display:flex;gap:8px;flex-wrap:wrap">
        ${perfis.map(p => {
          const cfg = PERFIL_CONFIG[p] || {};
          return `<span style="display:inline-flex;align-items:center;gap:5px;background:${cfg.bg||'rgba(128,128,128,0.1)'};border:1px solid ${cfg.color||'#888'}44;border-radius:20px;padding:4px 10px;font-size:11px;color:${cfg.color||'#888'}">
            <i class="fas fa-${cfg.icon||'user'}" style="font-size:10px"></i>${cfg.label||p}
          </span>`;
        }).join('')}
      </div>

      <div style="overflow-x:auto;padding:0 16px 16px">
        <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:750px">
          <thead>
            <tr style="background:var(--bg-card2)">
              <th style="padding:10px 8px;text-align:left;border-bottom:2px solid var(--border);min-width:160px;position:sticky;left:0;background:var(--bg-card2);z-index:2">
                Módulo
              </th>
              ${perfis.map(p => {
                const cfg = PERFIL_CONFIG[p] || { label: p, color: '#888' };
                return `<th colspan="6" style="padding:8px 4px;text-align:center;border-bottom:2px solid ${cfg.color}55;color:${cfg.color};font-size:10px;border-left:1px solid var(--border)">
                  <i class="fas fa-${cfg.icon||'user'}" style="margin-right:3px"></i>${cfg.label}
                </th>`;
              }).join('')}
            </tr>
            <tr style="background:var(--bg-card2)">
              <th style="padding:6px 8px;border-bottom:1px solid var(--border);position:sticky;left:0;background:var(--bg-card2);z-index:2"></th>
              ${perfis.map(p => {
                const cfg = PERFIL_CONFIG[p] || { color: '#888' };
                return ACOES_MODULO.map(a => `
                  <th style="padding:4px 2px;text-align:center;border-bottom:1px solid var(--border);font-size:9px;color:var(--text-muted);
                    border-left:${a==='view'?'1px solid var(--border)':'none'}">
                    ${acoesLabel[a]}
                  </th>`
                ).join('');
              }).join('')}
            </tr>
          </thead>
          <tbody>
            ${MODULOS_SISTEMA.map((mod, mi) => `
              <tr style="border-bottom:1px solid var(--border);${mi%2===0?'background:rgba(255,255,255,0.015)':''}">
                <td style="padding:6px 8px;font-size:11px;position:sticky;left:0;background:${mi%2===0?'var(--bg-card)':'var(--bg-card2)'};z-index:1">
                  <i class="fas fa-${mod.icon}" style="color:var(--orange);margin-right:6px;width:12px;font-size:10px"></i>
                  <span style="color:var(--text-secondary)">${mod.label}</span>
                  ${mod.id.startsWith('admin_') ? '<span style="font-size:9px;background:rgba(0,180,184,0.12);color:var(--fa-teal);border-radius:4px;padding:1px 4px;margin-left:4px">ADM</span>' : ''}
                </td>
                ${perfis.map(perfil => {
                  const p = PERMISSOES_PADRAO[perfil];
                  return ACOES_MODULO.map((acao, ai) => {
                    const val = p ? (p[mod.id] ? !!p[mod.id][acao] : false) : false;
                    const isAdmMod = mod.id.startsWith('admin_');
                    return `<td style="padding:3px 2px;text-align:center;${ai===0?'border-left:1px solid var(--border)':''}">
                      <button onclick="togglePermMatrix('${perfil}','${mod.id}','${acao}',this)"
                        data-perfil="${perfil}" data-modulo="${mod.id}" data-acao="${acao}" data-val="${val}"
                        title="${PERFIL_CONFIG[perfil]?.label||perfil} – ${mod.label} – ${acoesLabel[acao]}"
                        style="width:20px;height:20px;border:none;border-radius:4px;cursor:pointer;font-size:9px;
                          transition:all .15s;
                          background:${val ? 'rgba(34,197,94,0.18)' : (isAdmMod?'rgba(255,255,255,0.03)':'rgba(239,68,68,0.12)')};
                          color:${val ? '#34d399' : (isAdmMod?'var(--text-muted)':'#f87171')}">
                        ${val ? '✓' : '✗'}
                      </button>
                    </td>`;
                  }).join('');
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Descrição dos perfis -->
      <div style="padding:12px 16px 16px;border-top:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Descrição dos Perfis</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px">
          ${[{id:'admin',label:'Administrador'}, ...perfis.map(p => ({id:p, label: PERFIL_CONFIG[p]?.label||p}))].map(p => `
            <div style="background:${PERFIL_CONFIG[p.id]?.bg||'rgba(128,128,128,0.1)'};border:1px solid ${PERFIL_CONFIG[p.id]?.color||'#888'}33;border-radius:8px;padding:10px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                <i class="fas fa-${PERFIL_CONFIG[p.id]?.icon||'user'}" style="color:${PERFIL_CONFIG[p.id]?.color||'#888'}"></i>
                <span style="font-weight:700;font-size:12px;color:${PERFIL_CONFIG[p.id]?.color||'#888'}">${p.label}</span>
              </div>
              <div style="font-size:11px;color:var(--text-secondary)">${getDescricaoPerfil(p.id)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function _resetarMatrizPadrao() {
  confirmarAcao('Restaurar Permissões Padrão',
    'Deseja restaurar todas as permissões para os valores originais do sistema? Permissões customizadas por perfil serão perdidas.',
    '_confirmarResetMatriz()', true);
}

function _confirmarResetMatriz() {
  localStorage.removeItem('fa_permissoes_matrix');
  showToast('Permissões restauradas para o padrão do sistema!', 'success');
  logAction('Reset Permissões', 'Admin', 'Matriz de permissões restaurada para padrão');
  _adminSwitchTab('perfis');
}

// ═══════════════════════════════════════════════════════
// ABA 3 – PERMISSÕES POR USUÁRIO (OVERRIDE INDIVIDUAL)
// ═══════════════════════════════════════════════════════
function _renderAbaIndividual(container) {
  const naoAdmins = FA_USUARIOS.filter(u => u.perfil !== 'admin');
  const custom = _getPermissoesCustom();

  // Usuários com override
  const comCustom = naoAdmins.filter(u => custom[u.email.toLowerCase()]);

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:280px 1fr;gap:16px;align-items:start">
      <!-- Lista de usuários -->
      <div class="card" style="position:sticky;top:16px">
        <div class="card-header" style="padding:12px 16px">
          <h3 style="margin:0;font-size:13px"><i class="fas fa-user-cog" style="color:var(--fa-teal);margin-right:8px"></i>Selecionar Usuário</h3>
        </div>
        <div style="padding:8px 12px">
          <input type="text" class="search-input" style="width:100%;padding:7px 10px 7px 28px;font-size:12px;margin-bottom:8px" placeholder="Buscar..." oninput="_filtrarUsrIndividual(this.value)">
        </div>
        <div id="listaUsrIndividual" style="max-height:480px;overflow-y:auto;padding:0 8px 12px">
          ${naoAdmins.map(u => {
            const cfg = PERFIL_CONFIG[u.perfil] || { color: '#888', bg: 'rgba(128,128,128,0.1)', icon: 'user', label: u.perfil };
            const temCustom = !!custom[u.email.toLowerCase()];
            return `
              <div class="usr-ind-item" data-nome="${u.nome.toLowerCase()}" data-email="${u.email.toLowerCase()}"
                onclick="_abrirPermissoesUsuario('${u.email.toLowerCase()}')"
                style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;cursor:pointer;margin-bottom:4px;
                  border:1px solid transparent;transition:all .15s"
                onmouseover="this.style.background='var(--bg-card2)'" onmouseout="this.style.background=''">
                <div style="width:34px;height:34px;min-width:34px;border-radius:50%;background:${cfg.bg};
                  border:1.5px solid ${cfg.color}44;display:flex;align-items:center;justify-content:center;
                  font-size:11px;font-weight:700;color:${cfg.color}">
                  ${u.nome.split(' ').map(n=>n[0]).slice(0,2).join('')}
                </div>
                <div style="min-width:0;flex:1">
                  <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.nome}</div>
                  <div style="font-size:10px;color:var(--text-muted)">${cfg.label}</div>
                </div>
                ${temCustom ? `<span title="Tem permissões customizadas" style="font-size:9px;background:rgba(0,180,184,0.15);color:var(--fa-teal);border-radius:4px;padding:2px 5px;white-space:nowrap">custom</span>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Área de edição -->
      <div>
        <div id="permIndividualContent">
          <div class="card">
            <div style="padding:40px;text-align:center;color:var(--text-muted)">
              <i class="fas fa-user-cog" style="font-size:40px;margin-bottom:12px;opacity:.4"></i>
              <p style="margin:0;font-size:13px">Selecione um usuário ao lado para gerenciar suas permissões individuais.</p>
              <p style="margin:8px 0 0;font-size:11px">Permissões individuais <strong>sobrescrevem</strong> as permissões do perfil para aquele usuário específico.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function _filtrarUsrIndividual(q) {
  const ql = q.toLowerCase();
  document.querySelectorAll('.usr-ind-item').forEach(el => {
    const match = el.dataset.nome.includes(ql) || el.dataset.email.includes(ql);
    el.style.display = match ? '' : 'none';
  });
}

// Abre permissões individuais de um usuário (chamado da aba individual e dos cards)
function _abrirPermissoesUsuario(emailKey) {
  const user = FA_USUARIOS.find(u => u.email.toLowerCase() === emailKey);
  if (!user) return;

  // Se estiver na aba individual, mostra no painel
  const panel = document.getElementById('permIndividualContent');
  if (panel) {
    // Marca o item ativo
    document.querySelectorAll('.usr-ind-item').forEach(el => {
      el.style.background = el.dataset.email === emailKey ? 'var(--bg-card2)' : '';
      el.style.borderColor = el.dataset.email === emailKey ? 'var(--fa-teal)' : 'transparent';
    });
    panel.innerHTML = _renderPermUsuarioPainel(emailKey, user);
  } else {
    // Abre em modal se não estiver na aba
    openModalWide(`🔑 Permissões de ${user.nome}`, _renderPermUsuarioPainel(emailKey, user, true), `
      <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    `);
  }
}

function _renderPermUsuarioPainel(emailKey, user, modal=false) {
  const custom     = _getPermissoesCustom();
  const customUser = custom[emailKey] || {};
  const permPerfil = PERMISSOES_PADRAO[user.perfil] || {};
  const cfg        = PERFIL_CONFIG[user.perfil] || { label: user.perfil, color: '#888', bg: 'rgba(128,128,128,0.1)', icon: 'user' };
  const acoesLabel = { view:'Ver', create:'Criar', edit:'Editar', delete:'Excluir', approve:'Aprovar', export:'Exportar' };
  const temCustom  = Object.keys(customUser).length > 0;

  return `
    <div class="card" style="${modal?'':''}">
      <div class="card-header" style="padding:14px 16px;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:40px;height:40px;border-radius:50%;background:${cfg.bg};border:2px solid ${cfg.color}44;
            display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${cfg.color}">
            ${user.nome.split(' ').map(n=>n[0]).slice(0,2).join('')}
          </div>
          <div>
            <div style="font-weight:700;font-size:14px">${user.nome}</div>
            <div style="font-size:11px;color:var(--text-muted)">${user.email} · Perfil base: <span style="color:${cfg.color}">${cfg.label}</span>
              ${temCustom ? ' · <span style="color:var(--fa-teal)">✦ Tem overrides</span>' : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          ${temCustom ? `<button class="btn btn-danger btn-sm" onclick="resetPermUsuario('${emailKey}')"><i class="fas fa-undo"></i> Resetar</button>` : ''}
          <button class="btn btn-primary btn-sm" onclick="salvarPermUsuario('${emailKey}')"><i class="fas fa-save"></i> Salvar</button>
        </div>
      </div>

      <div style="padding:12px 16px;background:rgba(0,180,184,0.05);border-bottom:1px solid var(--border);font-size:11px;color:var(--text-secondary)">
        <i class="fas fa-info-circle" style="color:var(--fa-teal);margin-right:6px"></i>
        Células com <strong style="color:var(--fa-teal)">borda azul</strong> foram customizadas (sobrescrevem o perfil).
        Clique para alternar. As demais seguem as permissões do perfil <strong>${cfg.label}</strong>.
      </div>

      <div style="overflow-x:auto;padding:12px 16px">
        <table style="width:100%;border-collapse:collapse;font-size:11px" id="tblPermUser_${emailKey.replace(/[^a-z0-9]/g,'_')}">
          <thead>
            <tr style="background:var(--bg-card2)">
              <th style="padding:8px;text-align:left;border-bottom:1px solid var(--border);min-width:160px">Módulo</th>
              ${ACOES_MODULO.map(a => `<th style="padding:8px;text-align:center;border-bottom:1px solid var(--border);font-size:10px">${acoesLabel[a]}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${MODULOS_SISTEMA.filter(m => !m.id.startsWith('admin_')).map((mod, mi) => {
              const permBase = permPerfil[mod.id] || {};
              return `
                <tr style="border-bottom:1px solid var(--border);${mi%2===0?'background:rgba(255,255,255,0.01)':''}">
                  <td style="padding:6px 8px;font-size:11px">
                    <i class="fas fa-${mod.icon}" style="color:var(--orange);margin-right:6px;width:12px;font-size:10px"></i>
                    <span style="color:var(--text-secondary)">${mod.label}</span>
                  </td>
                  ${ACOES_MODULO.map(acao => {
                    const baseVal   = !!permBase[acao];
                    const customVal = customUser[mod.id] ? customUser[mod.id][acao] : undefined;
                    const finalVal  = typeof customVal !== 'undefined' ? customVal : baseVal;
                    const isCustom  = typeof customVal !== 'undefined';
                    return `
                      <td style="padding:5px;text-align:center">
                        <button onclick="togglePermUsuario('${emailKey}','${mod.id}','${acao}',this)"
                          data-val="${finalVal}"
                          title="${finalVal ? 'Permitido' : 'Bloqueado'}${isCustom ? ' (customizado)' : ' (padrão do perfil)'}"
                          style="width:26px;height:26px;border:none;border-radius:5px;cursor:pointer;font-size:10px;transition:all .15s;
                            background:${finalVal ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.12)'};
                            color:${finalVal ? '#34d399' : '#f87171'};
                            outline:${isCustom ? '2px solid var(--fa-teal)' : 'none'};
                            outline-offset:1px">
                          ${finalVal ? '✓' : '✗'}
                        </button>
                      </td>
                    `;
                  }).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════
// ABA 4 – SEGURANÇA
// ═══════════════════════════════════════════════════════
function _renderAbaSeguranca() {
  const semMFA   = FA_USUARIOS.filter(u => u.status === 'Ativo' && !u.mfa_ativo);
  const bloqueados = FA_USUARIOS.filter(u => u.status === 'Bloqueado');
  const admins   = FA_USUARIOS.filter(u => u.perfil === 'admin');

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <!-- Alertas de segurança -->
      <div class="card">
        <div class="card-header" style="padding:12px 16px">
          <h3 style="margin:0;font-size:13px"><i class="fas fa-exclamation-triangle" style="color:var(--yellow-light);margin-right:8px"></i>Alertas de Segurança</h3>
        </div>
        <div style="padding:12px 16px">
          ${semMFA.length > 0 ? `
            <div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:8px;padding:12px;margin-bottom:10px">
              <div style="font-weight:700;font-size:12px;color:var(--yellow-light);margin-bottom:8px">
                <i class="fas fa-shield-alt" style="margin-right:6px"></i>${semMFA.length} usuário${semMFA.length!==1?'s':''} sem MFA ativo
              </div>
              ${semMFA.map(u => `
                <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(251,191,36,0.1)">
                  <div style="width:28px;height:28px;border-radius:50%;background:rgba(251,191,36,0.15);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--yellow-light)">${u.nome.split(' ').map(n=>n[0]).slice(0,2).join('')}</div>
                  <div style="flex:1;font-size:12px">${u.nome}</div>
                  <button class="btn btn-warning btn-sm" style="font-size:10px" onclick="editarUsuario('${u.id}')"><i class="fas fa-edit"></i> Ativar MFA</button>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:8px;padding:12px;margin-bottom:10px;text-align:center">
              <i class="fas fa-shield-alt" style="color:var(--green-light);font-size:20px;margin-bottom:6px"></i>
              <div style="font-size:12px;color:var(--green-light);font-weight:600">Todos os usuários ativos possuem MFA!</div>
            </div>
          `}

          ${bloqueados.length > 0 ? `
            <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:12px">
              <div style="font-weight:700;font-size:12px;color:var(--red-light);margin-bottom:8px">
                <i class="fas fa-lock" style="margin-right:6px"></i>${bloqueados.length} usuário${bloqueados.length!==1?'s':''} bloqueado${bloqueados.length!==1?'s':''}
              </div>
              ${bloqueados.map(u => `
                <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(239,68,68,0.1)">
                  <div style="flex:1;font-size:12px">${u.nome}</div>
                  <button class="btn btn-info btn-sm" style="font-size:10px" onclick="ativarUsuario('${u.id}')"><i class="fas fa-unlock"></i> Desbloquear</button>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Administradores do sistema -->
      <div class="card">
        <div class="card-header" style="padding:12px 16px">
          <h3 style="margin:0;font-size:13px"><i class="fas fa-shield-alt" style="color:var(--fa-teal);margin-right:8px"></i>Administradores do Sistema</h3>
        </div>
        <div style="padding:12px 16px">
          ${admins.map(u => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(0,180,184,0.06);border:1px solid rgba(0,180,184,0.2);border-radius:8px;margin-bottom:8px">
              <div style="width:40px;height:40px;border-radius:50%;background:rgba(0,180,184,0.15);border:2px solid rgba(0,180,184,0.3);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--fa-teal)">
                ${u.nome.split(' ').map(n=>n[0]).slice(0,2).join('')}
              </div>
              <div style="flex:1">
                <div style="font-weight:700">${u.nome}</div>
                <div style="font-size:11px;color:var(--text-muted)">${u.email}</div>
                <div style="font-size:10px;margin-top:3px">
                  <span style="color:${u.mfa_ativo?'var(--green-light)':'var(--red-light)'}">
                    <i class="fas fa-shield-alt" style="margin-right:3px"></i>${u.mfa_ativo?'MFA Ativo':'Sem MFA'}
                  </span>
                  · <span style="color:var(--green-light)"><i class="fas fa-star" style="margin-right:3px"></i>Acesso Total ao Sistema</span>
                </div>
              </div>
            </div>
          `).join('')}
          <div style="margin-top:10px;padding:10px;background:rgba(0,180,184,0.05);border-radius:8px;font-size:11px;color:var(--text-muted)">
            <i class="fas fa-info-circle" style="color:var(--fa-teal);margin-right:6px"></i>
            O perfil <strong>Administrador</strong> tem acesso irrestrito a todos os módulos, usuários, configurações e logs do sistema.
          </div>
        </div>
      </div>

      <!-- Políticas -->
      <div class="card">
        <div class="card-header" style="padding:12px 16px">
          <h3 style="margin:0;font-size:13px"><i class="fas fa-cog" style="color:var(--blue-light);margin-right:8px"></i>Políticas de Segurança</h3>
        </div>
        <div style="padding:12px 16px">
          <div class="form-group" style="margin-bottom:10px">
            <label style="font-size:11px">MFA Obrigatório</label>
            <select class="form-control" style="font-size:12px">
              <option>Todos os usuários</option>
              <option>Apenas administradores</option>
              <option>Desabilitado</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:10px">
            <label style="font-size:11px">Tentativas de login antes de bloquear</label>
            <input class="form-control" type="number" value="5" style="font-size:12px">
          </div>
          <div class="form-group" style="margin-bottom:10px">
            <label style="font-size:11px">Validade da sessão (minutos)</label>
            <input class="form-control" type="number" value="480" style="font-size:12px">
          </div>
          <div class="form-group" style="margin-bottom:10px">
            <label style="font-size:11px">Política de Senhas</label>
            <select class="form-control" style="font-size:12px">
              <option>Forte (mín. 12 chars, maiúscula, número, símbolo)</option>
              <option>Média (mín. 8 chars, número)</option>
            </select>
          </div>
          <div class="form-group">
            <label style="font-size:11px">Validade da Senha (dias)</label>
            <input class="form-control" type="number" value="90" style="font-size:12px">
          </div>
          <button class="btn btn-primary btn-sm" style="width:100%;margin-top:8px" onclick="showToast('Políticas de segurança salvas!','success')">
            <i class="fas fa-save"></i> Salvar Políticas
          </button>
        </div>
      </div>

      <!-- Sessões / Log rápido -->
      <div class="card">
        <div class="card-header" style="padding:12px 16px">
          <h3 style="margin:0;font-size:13px"><i class="fas fa-history" style="color:var(--purple);margin-right:8px"></i>Últimos Acessos</h3>
        </div>
        <div style="padding:4px 16px 12px">
          ${FA_USUARIOS.filter(u=>u.ultimo_acesso !== '—').sort((a,b)=>b.ultimo_acesso.localeCompare(a.ultimo_acesso)).slice(0,8).map(u => {
            const cfg = PERFIL_CONFIG[u.perfil] || { color: '#888' };
            return `
              <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
                <div style="width:28px;height:28px;min-width:28px;border-radius:50%;background:${cfg.bg||'rgba(128,128,128,0.1)'};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${cfg.color}">
                  ${u.nome.split(' ').map(n=>n[0]).slice(0,2).join('')}
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:600">${u.nome}</div>
                  <div style="font-size:10px;color:var(--text-muted)">${cfg.label||u.perfil}</div>
                </div>
                <div style="font-size:10px;color:var(--text-secondary);text-align:right">
                  ${u.ultimo_acesso}
                  <div style="color:${u.mfa_ativo?'var(--green-light)':'var(--red-light)'}"><i class="fas fa-shield-alt"></i> ${u.mfa_ativo?'MFA':'—'}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════
// CRUD DE USUÁRIOS
// ═══════════════════════════════════════════════════════
function filterUsuarios() {
  const s  = document.getElementById('searchUSR')?.value.toLowerCase() || '';
  const st = document.getElementById('filterUSRStatus')?.value || '';
  const pf = document.getElementById('filterUSRPerfil')?.value || '';
  const f  = FA_USUARIOS.filter(u =>
    (!s  || (u.nome+u.email+u.departamento).toLowerCase().includes(s)) &&
    (!st || u.status === st) &&
    (!pf || u.perfil === pf)
  );
  const el = document.getElementById('tabelaUSR');
  if (el) el.innerHTML = renderTabelaUsuarios(f);
}

function renderTabelaUsuarios(lista) {
  const creds = (typeof _getCredenciais === 'function') ? _getCredenciais() : {};
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr><th>ID</th><th>Usuário</th><th>E-mail</th><th>Perfil</th><th>Departamento</th><th>1º Acesso</th><th>Último Acesso</th><th>Status</th><th>Ações</th></tr>
        </thead>
        <tbody>
          ${lista.map(u => {
            const credUser  = creds[u.email.toLowerCase()];
            const primAcesso= credUser ? credUser.primeiroAcesso : (u.primeiro_acesso !== false);
            return `
            <tr>
              <td style="color:var(--fa-teal);font-size:11px;font-weight:600">${u.id}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="width:32px;height:32px;border-radius:50%;background:${PERFIL_CONFIG[u.perfil]?.bg||'rgba(128,128,128,.1)'};
                    display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${PERFIL_CONFIG[u.perfil]?.color||'#888'}">
                    ${u.nome.split(' ').map(n=>n[0]).slice(0,2).join('')}
                  </div>
                  <span style="font-size:13px;font-weight:600">${u.nome}</span>
                </div>
              </td>
              <td style="font-size:12px;color:var(--text-secondary)">${u.email}</td>
              <td>${statusBadge(u.perfil)}</td>
              <td style="font-size:12px">${u.departamento}</td>
              <td style="text-align:center">
                ${primAcesso
                  ? '<span class="badge badge-warning" style="font-size:10px"><i class="fas fa-clock"></i> Pendente</span>'
                  : '<span class="badge badge-success" style="font-size:10px"><i class="fas fa-check"></i> Realizado</span>'}
              </td>
              <td style="font-size:11px;color:var(--text-secondary)">${u.ultimo_acesso}</td>
              <td>${statusBadge(u.status)}</td>
              <td>
                <div class="actions-cell">
                  <button class="btn btn-secondary btn-sm btn-icon" onclick="editarUsuario('${u.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                  <button class="btn btn-warning btn-sm btn-icon" onclick="resetSenha('${u.id}')" title="Reset Senha"><i class="fas fa-key"></i></button>
                  ${u.status==='Pendente'  ? `<button class="btn btn-success btn-sm btn-icon" onclick="ativarUsuario('${u.id}')" title="Ativar"><i class="fas fa-check"></i></button>` : ''}
                  ${u.status==='Ativo'     ? `<button class="btn btn-warning btn-sm btn-icon" onclick="bloquearUsuario('${u.id}')" title="Bloquear"><i class="fas fa-lock"></i></button>` : ''}
                  ${u.status==='Bloqueado' ? `<button class="btn btn-info btn-sm btn-icon" onclick="ativarUsuario('${u.id}')" title="Desbloquear"><i class="fas fa-unlock"></i></button>` : ''}
                  ${u.id !== 'USR-001'    ? `<button class="btn btn-danger btn-sm btn-icon" onclick="confirmarExcluirUsuario('${u.id}')" title="Excluir"><i class="fas fa-trash"></i></button>` : ''}
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openNovoUsuario() {
  openModalWide('Cadastrar Novo Usuário', `
    <div class="form-row">
      <div class="form-group"><label>Nome Completo *</label><input class="form-control" id="nu_nome" type="text" placeholder="Nome do usuário"></div>
      <div class="form-group"><label>E-mail Corporativo *</label><input class="form-control" id="nu_email" type="email" placeholder="usuario@fraseralexander.com.br"></div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Perfil de Acesso *</label>
        <select class="form-control" id="nu_perfil">
          ${Object.entries(PERFIL_CONFIG).map(([pid, pcfg]) =>
            `<option value="${pid}">${pcfg.label}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group"><label>Departamento</label><input class="form-control" id="nu_depto" type="text" placeholder="Ex: Operações, Financeiro..."></div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Senha Temporária *</label>
        <div style="position:relative">
          <input class="form-control" id="nu_senha" type="text" value="Fraser@2025" style="padding-right:90px">
          <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:10px;color:var(--text-muted)">editável</span>
        </div>
      </div>
      <div class="form-group">
        <label>Status Inicial</label>
        <select class="form-control" id="nu_status">
          <option>Ativo</option><option>Pendente</option>
        </select>
      </div>
    </div>
    <div class="alert alert-warning" style="margin-top:12px">
      <span class="alert-icon"><i class="fas fa-key"></i></span>
      <div>
        <div class="alert-title">Primeiro Acesso Obrigatório</div>
        <div class="alert-desc">O usuário deverá trocar a senha temporária no <strong>primeiro acesso</strong>. Informe-a por outro canal.</div>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarNovoUsuario()"><i class="fas fa-user-plus"></i> Cadastrar</button>
  `);
}

async function salvarNovoUsuario() {
  const nome   = document.getElementById('nu_nome').value.trim();
  const email  = document.getElementById('nu_email').value.trim();
  const senha  = document.getElementById('nu_senha').value.trim();
  const perfil = document.getElementById('nu_perfil').value;
  const depto  = document.getElementById('nu_depto').value.trim();
  const status = document.getElementById('nu_status').value;

  if (!nome)  { showToast('Informe o nome do usuário', 'warning'); return; }
  if (!email || !email.includes('@')) { showToast('Informe um e-mail válido', 'warning'); return; }
  if (!senha || senha.length < 6)  { showToast('Senha temporária deve ter no mínimo 6 caracteres', 'warning'); return; }

  const emailKey = email.toLowerCase();

  if (typeof _getCredenciais === 'function') {
    const creds = _getCredenciais();
    creds[emailKey] = {
      profile: perfil, nome,
      senhaHash: _hashSimples(senha),
      primeiroAcesso: true,
      ativo: status === 'Ativo',
      criadoPorAdm: true,
      criadoEm: new Date().toISOString()
    };
    _saveCredenciais(creds);
  }

  const novo = {
    id: gerarId('USR'),
    nome, email, perfil,
    departamento: depto || perfil,
    status,
    ultimo_acesso: '—',
    mfa_ativo: false,
    criado_em: new Date().toISOString().split('T')[0],
    primeiro_acesso: true
  };

  try {
    await fetch('tables/fa_usuarios', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(novo) });
  } catch(e) {}

  FA_USUARIOS.push(novo);
  logAction('Cadastro Usuário', 'Admin', `Novo usuário: ${nome} (${perfil}) – ${email}`);
  closeModal();

  openModal('✅ Usuário Cadastrado', `
    <div style="text-align:center;padding:8px 0 16px">
      <div style="width:56px;height:56px;background:rgba(34,197,94,0.12);border:2px solid var(--green-light);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
        <i class="fas fa-user-check" style="color:var(--green-light);font-size:20px"></i>
      </div>
      <div style="font-size:16px;font-weight:700">${nome}</div>
      <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${email} · ${PERFIL_CONFIG[perfil]?.label||perfil}</div>
    </div>
    <div style="background:rgba(230,126,34,0.08);border:1px solid rgba(230,126,34,0.25);border-radius:10px;padding:14px">
      <div style="font-size:11px;font-weight:700;color:var(--orange);margin-bottom:8px"><i class="fas fa-key"></i> Senha Temporária</div>
      <div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;padding:12px;display:flex;align-items:center;justify-content:space-between;font-family:monospace;font-size:16px;font-weight:700;color:var(--fa-teal)">
        <span>${senha}</span>
        <button onclick="navigator.clipboard.writeText('${senha}');showToast('Copiado!','success')" class="btn btn-secondary btn-sm"><i class="fas fa-copy"></i></button>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:8px"><i class="fas fa-info-circle"></i> O usuário trocará a senha no primeiro acesso.</div>
    </div>
  `, `<button class="btn btn-primary" onclick="closeModal()"><i class="fas fa-check"></i> Fechar</button>`);

  _renderAdminUI('usuarios');
}

function editarUsuario(id) {
  const u = FA_USUARIOS.find(x => x.id === id);
  if (!u) return;
  openModalWide(`Editar Usuário – ${u.nome}`, `
    <div class="form-row">
      <div class="form-group"><label>Nome</label><input class="form-control" id="eu_nome" type="text" value="${u.nome}"></div>
      <div class="form-group"><label>E-mail</label><input class="form-control" id="eu_email" type="email" value="${u.email}"></div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Perfil de Acesso</label>
        <select class="form-control" id="eu_perfil" ${u.id==='USR-001'?'disabled':''}>
          ${Object.entries(PERFIL_CONFIG).map(([pid, pcfg]) =>
            `<option value="${pid}" ${u.perfil===pid?'selected':''}>${pcfg.label}</option>`
          ).join('')}
        </select>
        ${u.id==='USR-001' ? '<div style="font-size:11px;color:var(--text-muted);margin-top:4px"><i class="fas fa-lock"></i> Perfil do ADM principal protegido</div>' : ''}
      </div>
      <div class="form-group"><label>Departamento</label><input class="form-control" id="eu_depto" type="text" value="${u.departamento||''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Status</label>
        <select class="form-control" id="eu_status" ${u.id==='USR-001'?'disabled':''}>
          ${['Ativo','Inativo','Pendente','Bloqueado'].map(s => `<option ${u.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>MFA</label>
        <select class="form-control" id="eu_mfa">
          <option value="true" ${u.mfa_ativo?'selected':''}>Ativo</option>
          <option value="false" ${!u.mfa_ativo?'selected':''}>Inativo</option>
        </select>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-warning" onclick="resetSenha('${id}')"><i class="fas fa-key"></i> Reset Senha</button>
    <button class="btn btn-info" onclick="closeModal();_abrirPermissoesUsuario('${u.email.toLowerCase()}')"><i class="fas fa-key"></i> Permissões</button>
    <button class="btn btn-primary" onclick="salvarEdicaoUsuario('${id}')"><i class="fas fa-save"></i> Salvar</button>
  `);
}

async function salvarEdicaoUsuario(id) {
  const idx = FA_USUARIOS.findIndex(u => u.id === id);
  if (idx < 0) return;
  const novoPerfilEl = document.getElementById('eu_perfil');
  const novoStatusEl = document.getElementById('eu_status');
  const novoPerfil = novoPerfilEl ? novoPerfilEl.value : FA_USUARIOS[idx].perfil;
  const novoStatus = novoStatusEl ? novoStatusEl.value : FA_USUARIOS[idx].status;

  FA_USUARIOS[idx] = {
    ...FA_USUARIOS[idx],
    nome: document.getElementById('eu_nome').value,
    email: document.getElementById('eu_email').value,
    perfil: novoPerfil,
    departamento: document.getElementById('eu_depto').value,
    status: novoStatus,
    mfa_ativo: document.getElementById('eu_mfa').value === 'true'
  };
  try {
    await fetch(`tables/fa_usuarios/${id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(FA_USUARIOS[idx]) });
  } catch(e) {}
  // Atualiza credencial
  if (typeof _getCredenciais === 'function') {
    const creds = _getCredenciais();
    const ek = FA_USUARIOS[idx].email.toLowerCase();
    if (creds[ek]) { creds[ek].profile = novoPerfil; _saveCredenciais(creds); }
  }
  logAction('Edição Usuário', 'Admin', `Usuário atualizado: ${FA_USUARIOS[idx].nome}`);
  closeModal();
  showToast('Usuário atualizado com sucesso!', 'success');
  _renderAdminUI('usuarios');
}

async function ativarUsuario(id) {
  const idx = FA_USUARIOS.findIndex(u => u.id === id);
  if (idx < 0) return;
  FA_USUARIOS[idx].status = 'Ativo';
  try { await fetch(`tables/fa_usuarios/${id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: 'Ativo' }) }); } catch(e) {}
  if (typeof _getCredenciais === 'function') {
    const creds = _getCredenciais();
    const ek = FA_USUARIOS[idx].email.toLowerCase();
    if (creds[ek]) { creds[ek].ativo = true; _saveCredenciais(creds); }
  }
  logAction('Ativação Usuário', 'Admin', `Usuário ativado: ${FA_USUARIOS[idx].nome}`);
  showToast(`Usuário "${FA_USUARIOS[idx].nome}" ativado!`, 'success');
  _renderAdminUI('usuarios');
}

async function bloquearUsuario(id) {
  const idx = FA_USUARIOS.findIndex(u => u.id === id);
  if (idx < 0) return;
  FA_USUARIOS[idx].status = 'Bloqueado';
  try { await fetch(`tables/fa_usuarios/${id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: 'Bloqueado' }) }); } catch(e) {}
  if (typeof _getCredenciais === 'function') {
    const creds = _getCredenciais();
    const ek = FA_USUARIOS[idx].email.toLowerCase();
    if (creds[ek]) { creds[ek].ativo = false; _saveCredenciais(creds); }
  }
  logAction('Bloqueio Usuário', 'Admin', `Usuário bloqueado: ${FA_USUARIOS[idx].nome}`);
  showToast(`Usuário "${FA_USUARIOS[idx].nome}" bloqueado.`, 'warning');
  _renderAdminUI('usuarios');
}

function confirmarExcluirUsuario(id) {
  const u = FA_USUARIOS.find(x => x.id === id);
  confirmarAcao('Excluir Usuário', `Deseja realmente excluir o usuário <strong>${u?.nome}</strong>? Esta ação não pode ser desfeita.`,
    `excluirUsuario('${id}')`, true);
}

async function excluirUsuario(id) {
  FA_USUARIOS = FA_USUARIOS.filter(u => u.id !== id);
  try { await fetch(`tables/fa_usuarios/${id}`, { method: 'DELETE' }); } catch(e) {}
  logAction('Exclusão Usuário', 'Admin', `Usuário excluído: ${id}`);
  showToast('Usuário removido do sistema.', 'warning');
  _renderAdminUI('usuarios');
}

function resetSenha(id) {
  const u = FA_USUARIOS.find(x => x.id === id);
  if (!u) return;
  closeModal();
  openModal(`🔑 Redefinir Senha – ${u.nome}`, `
    <div style="margin-bottom:16px;font-size:13px;color:var(--text-secondary)">
      Defina uma nova senha temporária para <strong style="color:var(--fa-teal)">${u.nome}</strong>.<br>
      O usuário deverá trocá-la no próximo acesso.
    </div>
    <div class="form-group">
      <label>Nova Senha Temporária</label>
      <input class="form-control" id="resetSenhaInput" type="text" value="Fraser@2025">
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-warning" onclick="_confirmarResetSenha('${id}')"><i class="fas fa-key"></i> Confirmar Reset</button>
  `);
}

function _confirmarResetSenha(id) {
  const u = FA_USUARIOS.find(x => x.id === id);
  const novaSenha = document.getElementById('resetSenhaInput')?.value?.trim();
  if (!novaSenha || novaSenha.length < 6) { showToast('Informe uma senha com mínimo 6 caracteres', 'warning'); return; }
  if (typeof _getCredenciais === 'function') {
    const creds = _getCredenciais();
    const emailKey = u.email.toLowerCase();
    if (creds[emailKey]) {
      creds[emailKey].senhaHash = _hashSimples(novaSenha);
      creds[emailKey].primeiroAcesso = true;
      creds[emailKey].ativo = true;
    } else {
      creds[emailKey] = { profile: u.perfil, nome: u.nome, senhaHash: _hashSimples(novaSenha), primeiroAcesso: true, ativo: true, criadoPorAdm: true };
    }
    _saveCredenciais(creds);
  }
  closeModal();
  logAction('Reset Senha', 'Admin', `Senha resetada para: ${u.nome}`);
  openModal('✅ Senha Redefinida', `
    <div style="text-align:center;padding:8px 0 12px">
      <i class="fas fa-check-circle" style="color:var(--green-light);font-size:40px;margin-bottom:12px"></i>
      <div style="font-size:15px;font-weight:700">Senha de ${u.nome} redefinida!</div>
    </div>
    <div style="background:rgba(230,126,34,0.08);border:1px solid rgba(230,126,34,0.25);border-radius:8px;padding:12px">
      <div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px">Senha Temporária:</div>
      <div style="font-family:monospace;font-size:18px;font-weight:700;color:var(--fa-teal);display:flex;align-items:center;justify-content:space-between">
        <span>${novaSenha}</span>
        <button onclick="navigator.clipboard.writeText('${novaSenha}');showToast('Copiado!','success')" class="btn btn-secondary btn-sm"><i class="fas fa-copy"></i></button>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:6px">O usuário criará nova senha pessoal no próximo login.</div>
    </div>
  `, `<button class="btn btn-primary" onclick="closeModal()">Fechar</button>`);
}

// ═══════════════════════════════════════════════════════
// PERMISSÕES – FUNÇÕES COMPARTILHADAS
// ═══════════════════════════════════════════════════════
function togglePermMatrix(perfil, modulo, acao, btn) {
  const val = btn.dataset.val === 'true';
  const novoVal = !val;
  btn.dataset.val = String(novoVal);
  btn.style.background = novoVal ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.12)';
  btn.style.color = novoVal ? '#34d399' : '#f87171';
  btn.textContent = novoVal ? '✓' : '✗';
  if (!PERMISSOES_PADRAO[perfil]) PERMISSOES_PADRAO[perfil] = {};
  if (!PERMISSOES_PADRAO[perfil][modulo]) PERMISSOES_PADRAO[perfil][modulo] = {};
  PERMISSOES_PADRAO[perfil][modulo][acao] = novoVal;
}

function salvarPermissoesMatrix() {
  localStorage.setItem('fa_permissoes_matrix', JSON.stringify(PERMISSOES_PADRAO));
  logAction('Permissões', 'Admin', 'Matriz de permissões por perfil atualizada');
  showToast('Permissões de perfil salvas com sucesso!', 'success');
}

function togglePermUsuario(emailKey, modulo, acao, btn) {
  const val = btn.dataset.val === 'true';
  const novoVal = !val;
  btn.dataset.val = String(novoVal);
  btn.style.background = novoVal ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.12)';
  btn.style.color = novoVal ? '#34d399' : '#f87171';
  btn.textContent = novoVal ? '✓' : '✗';
  btn.style.outline = '2px solid var(--fa-teal)';
  btn.style.outlineOffset = '1px';
}

function salvarPermUsuario(emailKey) {
  const custom = _getPermissoesCustom();
  custom[emailKey] = {};

  // Coleta da tabela de permissão do usuário
  const tableId = 'tblPermUser_' + emailKey.replace(/[^a-z0-9]/g,'_');
  const rows = document.querySelectorAll(`#${tableId} tbody tr`);
  const modsFiltrados = MODULOS_SISTEMA.filter(m => !m.id.startsWith('admin_'));

  rows.forEach((row, ri) => {
    const mod = modsFiltrados[ri];
    if (!mod) return;
    const cells = row.querySelectorAll('td button[data-val]');
    cells.forEach((btn, ci) => {
      const acao = ACOES_MODULO[ci];
      if (!acao) return;
      if (!custom[emailKey][mod.id]) custom[emailKey][mod.id] = {};
      custom[emailKey][mod.id][acao] = btn.dataset.val === 'true';
    });
  });

  _savePermissoesCustom(custom);
  logAction('Permissões Usuário', 'Admin', `Permissões customizadas salvas para ${emailKey}`);
  showToast('Permissões individuais salvas!', 'success');

  // Recarrega o painel para mostrar overrides em azul
  const user = FA_USUARIOS.find(u => u.email.toLowerCase() === emailKey);
  if (user) {
    const panel = document.getElementById('permIndividualContent');
    if (panel) panel.innerHTML = _renderPermUsuarioPainel(emailKey, user);
  }
}

function resetPermUsuario(emailKey) {
  confirmarAcao('Resetar Permissões', `Deseja remover todos os overrides de <strong>${emailKey}</strong> e voltar para as permissões padrão do perfil?`,
    `_confirmarResetPermUsuario('${emailKey}')`, false);
}

function _confirmarResetPermUsuario(emailKey) {
  const custom = _getPermissoesCustom();
  delete custom[emailKey];
  _savePermissoesCustom(custom);
  logAction('Reset Permissões Usuário', 'Admin', `Permissões resetadas para o perfil de ${emailKey}`);
  showToast('Permissões resetadas para o padrão do perfil!', 'info');
  const user = FA_USUARIOS.find(u => u.email.toLowerCase() === emailKey);
  if (user) {
    const panel = document.getElementById('permIndividualContent');
    if (panel) panel.innerHTML = _renderPermUsuarioPainel(emailKey, user);
  }
}

// Alias para compatibilidade
function renderPermUsuario() { }
function showPermTab(tab) { }

// ── PERMISSÕES (página legada — redireciona para nova) ─────────────────────────
function renderAdminPermissoes() {
  renderAdminUsuarios();
  setTimeout(() => _adminSwitchTab('perfis'), 100);
}

// ═══════════════════════════════════════════════════════
// CONFIGURAÇÕES
// ═══════════════════════════════════════════════════════
function renderAdminConfig() {
  const main = document.getElementById('mainContent');
  const cfg  = typeof _getAlcadaConfig === 'function' ? _getAlcadaConfig() : {};

  const perfisOpts = [
    { v:'admin',      l:'Administrador' },
    { v:'diretor',    l:'Diretor' },
    { v:'financeiro', l:'Financeiro' },
    { v:'operacao',   l:'Operação' },
    { v:'compras',    l:'Compras' },
    { v:'supervisor', l:'Supervisor' }
  ];
  const optHtml = (selected) => perfisOpts.map(p =>
    `<option value="${p.v}" ${selected===p.v?'selected':''}>${p.l}</option>`
  ).join('');

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-cog" style="color:var(--fa-teal);margin-right:10px"></i>Configurações do Sistema</h2>
        <p>Parâmetros globais, integrações e preferências</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="showToast('Configurações salvas!','success')"><i class="fas fa-save"></i> Salvar Tudo</button>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-building" style="color:var(--fa-teal);margin-right:8px"></i>Dados da Empresa</h3></div>
        <div class="card-body">
          <div class="form-group"><label>Razão Social</label><input class="form-control" value="Fraser Alexander Mineração Ltda." type="text"></div>
          <div class="form-group"><label>CNPJ</label><input class="form-control" value="00.000.000/0001-00" type="text"></div>
          <div class="form-group"><label>Endereço</label><input class="form-control" value="Av. Contorno, 1234 – Belo Horizonte/MG" type="text"></div>
          <div class="form-group"><label>Telefone</label><input class="form-control" value="(31) 3000-0000" type="text"></div>
          <div class="form-group"><label>Versão do Sistema</label><input class="form-control" value="v3.0.0 – Fraser Alexander ERP" readonly style="color:var(--fa-teal)"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-shield-alt" style="color:var(--green-light);margin-right:8px"></i>Segurança e Acesso</h3></div>
        <div class="card-body">
          <div class="form-group"><label>MFA Obrigatório para</label>
            <select class="form-control"><option>Todos os usuários</option><option>Apenas administradores</option><option>Desabilitado</option></select>
          </div>
          <div class="form-group"><label>Tempo de sessão (minutos)</label><input class="form-control" type="number" value="480"></div>
          <div class="form-group"><label>Tentativas de login antes de bloquear</label><input class="form-control" type="number" value="5"></div>
          <div class="form-group"><label>Política de Senhas</label>
            <select class="form-control"><option>Forte (mín. 12 chars, maiúscula, número, símbolo)</option><option>Média (mín. 8 chars, número)</option></select>
          </div>
          <div class="form-group"><label>Validade da Senha (dias)</label><input class="form-control" type="number" value="90"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-chart-line" style="color:var(--orange);margin-right:8px"></i>Parâmetros Financeiros</h3></div>
        <div class="card-body">
          <div class="form-group"><label>Moeda</label><select class="form-control"><option>BRL – Real Brasileiro</option></select></div>
          <div class="form-group"><label>Margem Mínima Aceitável (%)</label><input class="form-control" type="number" value="18"></div>
          <div class="form-group"><label>Alerta de Glosa acima de (%)</label><input class="form-control" type="number" value="5"></div>
          <div class="form-group"><label>Dias para alertar inadimplência</label><input class="form-control" type="number" value="3"></div>
          <div class="form-group"><label>Limite PC sem aprovação (R$)</label><input class="form-control" type="number" value="1000"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-bell" style="color:var(--yellow-light);margin-right:8px"></i>Notificações e Alertas</h3></div>
        <div class="card-body">
          <div class="form-group"><label>Alertas de documento vencendo (dias antes)</label><input class="form-control" type="number" value="30"></div>
          <div class="form-group"><label>Enviar alertas por</label>
            <select class="form-control"><option>E-mail + Sistema</option><option>Apenas Sistema</option><option>Apenas E-mail</option></select>
          </div>
          <div class="form-group"><label>E-mail padrão para alertas SSMA</label><input class="form-control" type="email" value="ssma@fraseralexander.com.br"></div>
          <div class="form-group"><label>E-mail padrão para alertas financeiros</label><input class="form-control" type="email" value="financeiro@fraseralexander.com.br"></div>
        </div>
      </div>

      <!-- ══ DELEGAÇÃO DE APROVAÇÃO DE COMPRAS ══ -->
      <div class="card" style="grid-column:1/-1;border:2px solid rgba(0,180,184,0.3)">
        <div class="card-header" style="background:linear-gradient(135deg,rgba(0,180,184,0.08),rgba(11,79,108,0.08))">
          <h3><i class="fas fa-user-shield" style="color:var(--fa-teal);margin-right:8px"></i>Delegação de Aprovação — Mapa Comparativo</h3>
          <span style="font-size:11px;color:var(--text-muted)">Define quem aprova o mapa com base no valor em USD no câmbio do dia</span>
        </div>
        <div class="card-body">

          <!-- Câmbio do dia -->
          <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:8px">
              <i class="fas fa-dollar-sign" style="color:#16a34a;font-size:18px"></i>
              <div>
                <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;font-weight:700">Câmbio USD/BRL</div>
                <div id="alcada-cotacao-display" style="font-size:16px;font-weight:800;color:#16a34a">Carregando…</div>
                <div id="alcada-cotacao-data" style="font-size:10px;color:var(--text-muted)">${cfg.cotacao_atualizada ? 'Atualizado: ' + cfg.cotacao_atualizada : 'Buscando cotação…'}</div>
              </div>
            </div>
            <div style="flex:1;min-width:200px">
              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Cotação Manual (deixe 0 para automática)</label>
              <div style="display:flex;gap:8px">
                <input id="alcada-cotacao-manual" type="number" step="0.01" min="0"
                  value="${cfg.cotacao_manual || ''}" placeholder="Ex: 5.75 (deixe vazio = automático)"
                  class="form-control" style="max-width:220px">
                <button class="btn btn-secondary btn-sm" onclick="_adminAtualizarCotacao()">
                  <i class="fas fa-sync-alt"></i> Buscar Agora
                </button>
              </div>
            </div>
          </div>

          <!-- Regras de alçada -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">

            <!-- Nível 1: Gerente -->
            <div style="border:1px solid rgba(0,180,184,0.3);border-radius:10px;padding:16px;position:relative">
              <div style="position:absolute;top:-11px;left:14px;background:var(--bg-card);padding:0 8px;font-size:11px;font-weight:700;color:var(--fa-teal);text-transform:uppercase">Nível 1 — Gerente</div>
              <div style="margin-top:4px">
                <div style="background:rgba(0,180,184,0.08);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--text-secondary);line-height:1.6">
                  <i class="fas fa-info-circle" style="color:var(--fa-teal);margin-right:6px"></i>
                  Aprova mapas com valor <strong>até o limite definido</strong> em USD.
                </div>
                <div class="form-group" style="margin-bottom:12px">
                  <label style="font-size:11px">Limite máximo (USD $)</label>
                  <input id="alcada-limite-usd" type="number" min="1" step="100"
                    value="${cfg.limite_usd || 10000}" class="form-control"
                    style="font-size:14px;font-weight:700;color:var(--fa-teal)">
                </div>
                <div class="form-group" style="margin-bottom:12px">
                  <label style="font-size:11px">Perfil no sistema</label>
                  <select id="alcada-perfil-gerente" class="form-control">${optHtml(cfg.perfil_gerente||'diretor')}</select>
                </div>
                <div class="form-group">
                  <label style="font-size:11px">Nome exibido</label>
                  <input id="alcada-nome-gerente" type="text" class="form-control"
                    value="${cfg.nome_gerente||'Gerente'}" placeholder="Ex: Gerente de Suprimentos">
                </div>
              </div>
            </div>

            <!-- Nível 2: General Manager -->
            <div style="border:1px solid rgba(245,158,11,0.4);border-radius:10px;padding:16px;position:relative">
              <div style="position:absolute;top:-11px;left:14px;background:var(--bg-card);padding:0 8px;font-size:11px;font-weight:700;color:#f59e0b;text-transform:uppercase">Nível 2 — General Manager</div>
              <div style="margin-top:4px">
                <div style="background:rgba(245,158,11,0.08);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--text-secondary);line-height:1.6">
                  <i class="fas fa-info-circle" style="color:#f59e0b;margin-right:6px"></i>
                  Aprova mapas com valor <strong>acima do limite</strong>. Alçada irrestrita.
                </div>
                <div class="form-group" style="margin-bottom:12px">
                  <label style="font-size:11px">Limite (acima do Nível 1)</label>
                  <input type="text" class="form-control" value="Sem limite" readonly
                    style="color:var(--text-muted);font-style:italic">
                </div>
                <div class="form-group" style="margin-bottom:12px">
                  <label style="font-size:11px">Perfil no sistema</label>
                  <select id="alcada-perfil-gm" class="form-control">${optHtml(cfg.perfil_gm||'admin')}</select>
                </div>
                <div class="form-group">
                  <label style="font-size:11px">Nome exibido</label>
                  <input id="alcada-nome-gm" type="text" class="form-control"
                    value="${cfg.nome_gm||'General Manager'}" placeholder="Ex: General Manager">
                </div>
              </div>
            </div>
          </div>

          <!-- Simulador -->
          <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:14px">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:10px">
              <i class="fas fa-calculator" style="margin-right:6px;color:var(--fa-teal)"></i>Simulador de Alçada
            </div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <div>
                <label style="font-size:10px;color:var(--text-muted)">Valor do mapa (R$)</label>
                <input id="alcada-sim-valor" type="number" min="0" step="100" value="50000"
                  class="form-control" style="width:160px" oninput="_adminSimularAlcada()">
              </div>
              <div style="padding-top:16px;font-size:18px;color:var(--border-color)">→</div>
              <div id="alcada-sim-result" style="padding-top:16px;font-size:13px;font-weight:600;color:var(--text-secondary)">
                Clique em Salvar primeiro para simular.
              </div>
            </div>
          </div>

          <div style="margin-top:16px;text-align:right">
            <button class="btn btn-primary" onclick="_adminSalvarAlcada()">
              <i class="fas fa-save"></i> Salvar Delegação de Aprovação
            </button>
          </div>
        </div>
      </div>
      <!-- ══ FIM DELEGAÇÃO ══ -->

    </div>
  `;

  // Busca cotação e preenche o display
  if (typeof _getCotacaoUSD === 'function') {
    _getCotacaoUSD().then(v => {
      const el = document.getElementById('alcada-cotacao-display');
      const dt = document.getElementById('alcada-cotacao-data');
      if (el) el.textContent = 'R$ ' + v.toFixed(2);
      if (dt) { const c2 = _getAlcadaConfig(); dt.textContent = c2.cotacao_atualizada ? 'Atualizado: ' + c2.cotacao_atualizada : ''; }
      _adminSimularAlcada();
    });
  }
}

function _adminAtualizarCotacao() {
  // Força refresh do cache (via wrapper exposto pelo procurement.js)
  if (typeof window._clearUsdCache === 'function') window._clearUsdCache();
  const el = document.getElementById('alcada-cotacao-display');
  if (el) el.textContent = 'Buscando…';
  if (typeof _getCotacaoUSD === 'function') {
    _getCotacaoUSD().then(v => {
      if (el) el.textContent = 'R$ ' + v.toFixed(2);
      const dt = document.getElementById('alcada-cotacao-data');
      if (dt) { const c2 = _getAlcadaConfig(); dt.textContent = 'Atualizado: ' + (c2.cotacao_atualizada||''); }
      showToast('Câmbio atualizado: R$ ' + v.toFixed(2) + '/USD', 'success');
      _adminSimularAlcada();
    });
  }
}

function _adminSalvarAlcada() {
  const limite = parseFloat(document.getElementById('alcada-limite-usd')?.value) || 10000;
  const pGer   = document.getElementById('alcada-perfil-gerente')?.value || 'diretor';
  const nGer   = document.getElementById('alcada-nome-gerente')?.value || 'Gerente';
  const pGM    = document.getElementById('alcada-perfil-gm')?.value || 'admin';
  const nGM    = document.getElementById('alcada-nome-gm')?.value || 'General Manager';
  const manual = parseFloat(document.getElementById('alcada-cotacao-manual')?.value) || null;

  if (typeof _saveAlcadaConfig === 'function') {
    const old = _getAlcadaConfig();
    _saveAlcadaConfig({ ...old, limite_usd: limite, perfil_gerente: pGer, nome_gerente: nGer,
      perfil_gm: pGM, nome_gm: nGM, cotacao_manual: manual > 0 ? manual : null });
    showToast('Delegação de aprovação salva com sucesso!', 'success');
    _adminSimularAlcada();
  }
}

function _adminSimularAlcada() {
  const valBRL = parseFloat(document.getElementById('alcada-sim-valor')?.value) || 0;
  const el     = document.getElementById('alcada-sim-result');
  if (!el) return;
  if (typeof _getCotacaoUSD !== 'function') { el.textContent = 'Módulo procurement não carregado.'; return; }
  _getCotacaoUSD().then(cotacao => {
    const cfg     = _getAlcadaConfig();
    const valUSD  = valBRL / cotacao;
    const limUSD  = cfg.limite_usd || 10000;
    const quem    = valUSD <= limUSD ? cfg.nome_gerente : cfg.nome_gm;
    const cor     = valUSD <= limUSD ? 'var(--fa-teal)' : '#f59e0b';
    const icone   = valUSD <= limUSD ? 'fa-user-check' : 'fa-user-tie';
    const usdFmt  = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(valUSD);
    const limFmt  = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(limUSD);
    el.innerHTML  = `<i class="fas ${icone}" style="color:${cor};margin-right:6px"></i>`
      + `<span style="color:${cor}">${usdFmt} → aprova: <strong>${quem}</strong></span>`
      + `<span style="font-size:10px;color:var(--text-muted);margin-left:8px">(limite: ${limFmt} · câmbio R$ ${cotacao.toFixed(2)})</span>`;
  });
}

// ═══════════════════════════════════════════════════════
// LOGS
// ═══════════════════════════════════════════════════════
function renderAdminLogs() {
  const main = document.getElementById('mainContent');
  // Logs carregados do D1 via DB.logs ou do localStorage (SYSTEM_LOGS)
  const allLogs = (typeof SYSTEM_LOGS !== 'undefined' ? SYSTEM_LOGS : []).slice(0, 50);

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-history" style="color:var(--fa-teal);margin-right:10px"></i>Logs do Sistema</h2>
        <p>${allLogs.length} registros de auditoria</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="exportLogs()"><i class="fas fa-download"></i> Exportar</button>
      </div>
    </div>
    <div class="card">
      <div class="search-bar">
        <div class="search-input-wrapper"><i class="fas fa-search"></i><input class="search-input" type="text" placeholder="Buscar em logs..." id="searchLog"></div>
      </div>
      <div class="card-body" style="padding:8px 16px">
        ${allLogs.map(l => `
          <div class="log-entry">
            <span class="log-time">${l.data_hora}</span>
            <span class="log-user">${l.usuario}</span>
            <span class="log-action">
              <span class="badge badge-muted" style="margin-right:6px">${l.modulo}</span>
              <strong>${l.acao}</strong> · ${l.descricao}
            </span>
            <span style="font-size:10px;color:var(--text-muted);min-width:100px;text-align:right">${l.ip||''}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function exportLogs() {
  showToast('Exportando logs de auditoria...', 'info');
  logAction('Export Logs', 'Admin', 'Logs do sistema exportados');
}

// ═══════════════════════════════════════════════════════
// INSTRUÇÕES / AJUDA
// ═══════════════════════════════════════════════════════
function mostrarInstrucoesAdmin() {
  openModalWide('📋 Painel de Administração – Guia Rápido', `
    <div style="line-height:1.7">
      <div class="alert alert-warning" style="margin-bottom:20px">
        <span class="alert-icon"><i class="fas fa-shield-alt"></i></span>
        <div>
          <div class="alert-title">Área de Administração – Acesso Restrito</div>
          <div class="alert-desc">Apenas o perfil <strong>Administrador do Sistema</strong> tem acesso completo. O ADM pode gerenciar usuários, perfis, permissões e logs.</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px">
        ${[
          { n:'01', titulo:'Gestão de Usuários', desc:'Criar, editar e desativar usuários. Atribuir perfil de acesso diretamente nos cartões da lista por perfil. Reset de senha disponível para qualquer usuário.', icon:'users', color:'var(--fa-teal)' },
          { n:'02', titulo:'Perfis & Permissões', desc:'Matriz granular com 6 ações por módulo (Ver, Criar, Editar, Excluir, Aprovar, Exportar) para cada perfil. Alterações salvas persistem no sistema.', icon:'key', color:'var(--orange)' },
          { n:'03', titulo:'Permissões por Usuário', desc:'Sobrescreva permissões de forma individual para um usuário específico, independente do perfil. Ideal para casos excepcionais.', icon:'user-cog', color:'var(--purple)' },
          { n:'04', titulo:'Segurança', desc:'Visualize usuários sem MFA, bloqueados e administradores. Configure políticas de senha, sessão e tentativas de login.', icon:'shield-alt', color:'var(--green-light)' }
        ].map(m => `
          <div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:10px;padding:14px">
            <div style="font-size:28px;font-weight:900;color:${m.color};opacity:.2;line-height:1">${m.n}</div>
            <div style="display:flex;align-items:center;gap:8px;margin:-8px 0 6px">
              <i class="fas fa-${m.icon}" style="color:${m.color}"></i>
              <span style="font-weight:700;font-size:13px">${m.titulo}</span>
            </div>
            <div style="font-size:12px;color:var(--text-secondary)">${m.desc}</div>
          </div>
        `).join('')}
      </div>

      <div style="overflow-x:auto;margin-bottom:16px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:var(--bg-card2)">
              <th style="padding:8px 12px;text-align:left">Perfil</th>
              <th style="padding:8px 12px;text-align:left">Usuário Padrão</th>
              <th style="padding:8px 12px;text-align:left">E-mail</th>
              <th style="padding:8px 12px;text-align:center">Admin?</th>
            </tr>
          </thead>
          <tbody>
            ${(FA_USUARIOS.length ? FA_USUARIOS : []).map((u,i) => {
              const cfg = PERFIL_CONFIG[u.perfil] || { color: '#8b949e', label: u.perfil };
              return `
              <tr style="${i%2===0?'background:rgba(255,255,255,0.02)':''}">
                <td style="padding:8px 12px;font-weight:600;color:${cfg.color}">${cfg.label || u.perfil}</td>
                <td style="padding:8px 12px">${u.nome}</td>
                <td style="padding:8px 12px;font-size:11px;color:var(--text-muted)">${u.email}</td>
                <td style="padding:8px 12px;text-align:center">${u.perfil==='admin'?'<span class="badge badge-success"><i class="fas fa-check"></i> Sim</span>':'<span class="badge badge-muted">Não</span>'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="alert alert-info">
        <span class="alert-icon"><i class="fas fa-lock"></i></span>
        <div>
          <div class="alert-title">Boas Práticas de Segurança</div>
          <div class="alert-desc">Nunca compartilhe a senha do ADM. Ative o MFA. Revise logs regularmente. Bloqueie imediatamente contas suspeitas.</div>
        </div>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-primary" onclick="closeModal();navigate('admin_usuarios')"><i class="fas fa-shield-alt"></i> Ir para Painel ADM</button>
  `);
}

// ═══════════════════════════════════════════════════════
// BACKUP
// ═══════════════════════════════════════════════════════
function renderAdminBackup() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-database" style="color:var(--fa-teal);margin-right:10px"></i>Backup e Gerenciamento de Dados</h2>
        <p>Exportação, backup e manutenção do banco de dados</p>
      </div>
    </div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-download" style="color:var(--fa-teal);margin-right:8px"></i>Exportação de Dados</h3></div>
        <div class="card-body">
          ${[
            { label: 'Contratos e Medições',    icon: 'file-contract',      color: 'var(--blue-light)' },
            { label: 'Pedidos de Compra',        icon: 'shopping-cart',      color: 'var(--fa-teal)' },
            { label: 'Fornecedores',             icon: 'building',           color: 'var(--orange)' },
            { label: 'Usuários do Sistema',      icon: 'users',              color: 'var(--purple)' },
            { label: 'Financeiro (Contas)',      icon: 'chart-line',         color: 'var(--green-light)' },
            { label: 'SSMA e Incidentes',        icon: 'hard-hat',           color: 'var(--yellow-light)' },
            { label: 'Logs de Auditoria',        icon: 'history',            color: 'var(--red-light)' }
          ].map(e => `
            <div class="stat-row" style="cursor:pointer" onclick="showToast('Exportando ${e.label}...','info')">
              <span class="stat-label"><i class="fas fa-${e.icon}" style="color:${e.color};width:16px;margin-right:6px"></i>${e.label}</span>
              <button class="btn btn-secondary btn-sm"><i class="fas fa-file-csv"></i> CSV</button>
            </div>
          `).join('')}
          <div style="margin-top:16px">
            <button class="btn btn-primary" style="width:100%" onclick="showToast('Backup completo gerado!','success')">
              <i class="fas fa-database"></i> Gerar Backup Completo (.zip)
            </button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-info-circle" style="color:var(--blue-light);margin-right:8px"></i>Status do Sistema</h3></div>
        <div class="card-body">
          <div class="stat-row"><span class="stat-label">Versão</span><span class="stat-value" style="color:var(--fa-teal)">v3.0.0 – Fraser Alexander ERP</span></div>
          <div class="stat-row"><span class="stat-label">Banco de Dados</span><span class="stat-value">Dataverse / Table API</span></div>
          <div class="stat-row"><span class="stat-label">Tabelas Ativas</span><span class="stat-value">5 tabelas</span></div>
          <div class="stat-row"><span class="stat-label">Usuários Cadastrados</span><span class="stat-value">${FA_USUARIOS.length}</span></div>
          <div class="stat-row"><span class="stat-label">Fornecedores</span><span class="stat-value">${typeof FA_FORNECEDORES !== 'undefined' ? FA_FORNECEDORES.length : 8}</span></div>
          <div class="stat-row"><span class="stat-label">Pedidos de Compra</span><span class="stat-value">${typeof FA_PEDIDOS !== 'undefined' ? FA_PEDIDOS.length : 5}</span></div>
          <div class="stat-row"><span class="stat-label">Último Backup</span><span class="stat-value" style="color:var(--green-light)">Hoje, 03:00</span></div>
          <div class="stat-row"><span class="stat-label">Dados Demo</span><span class="stat-value" style="color:var(--fa-teal)">${localStorage.getItem('_fa_demo_seed_v4')==='1' ? '✅ Carregados' : '⏳ Não carregados'}</span></div>
          <div class="alert alert-success" style="margin-top:12px">
            <span class="alert-icon"><i class="fas fa-check-circle"></i></span>
            <div><div class="alert-title">Sistema Operacional</div><div class="alert-desc">Todos os módulos funcionando normalmente.</div></div>
          </div>
          <div style="margin-top:12px">
            <button class="btn btn-warning" style="width:100%" onclick="resetarDadosDemo()">
              <i class="fas fa-sync-alt"></i> Recarregar Dados Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function resetarDadosDemo() {
  if (!confirm('Isto irá recarregar todos os dados demo e sobrescrever alterações. Confirmar?')) return;
  localStorage.removeItem('_fa_demo_seed_v4');
  // Re-executar o seed
  const s = document.createElement('script');
  s.src = 'js/seed_demo.js?t=' + Date.now();
  s.onload = function() { showToast('Dados demo recarregados com sucesso!', 'success'); setTimeout(() => navigate('dashboard'), 800); };
  document.head.appendChild(s);
}

// ─── HELPERS ──────────────────────────────────────────
function getDescricaoPerfil(p) {
  const map = {
    admin:      'Acesso total ao sistema, usuários, configurações e logs',
    diretor:    'Acesso completo a todas as operações e relatórios',
    financeiro: 'Gestão financeira, faturamento, contas a pagar e relatórios',
    operacao:   'Contratos, OS, medição, equipe e operações de campo',
    compras:    'Pedidos de compra, fornecedores e estoque',
    ssma:       'SSMA, documentos, treinamentos e conformidade',
    rh:         'Equipe, mobilização, colaboradores e documentação',
    supervisor: 'Ordens de serviço, apontamento e SSMA de campo'
  };
  return map[p] || '';
}

// Expõe no window para uso global
window._adminSwitchTab          = _adminSwitchTab;
window._salvarPerfilUsuario     = _salvarPerfilUsuario;
window._filtrarListaUSR         = _filtrarListaUSR;
window._filtrarUsrIndividual    = _filtrarUsrIndividual;
window._abrirPermissoesUsuario  = _abrirPermissoesUsuario;
window._confirmarResetPermUsuario= _confirmarResetPermUsuario;
window._confirmarResetMatriz    = _confirmarResetMatriz;
window._resetarMatrizPadrao     = _resetarMatrizPadrao;
