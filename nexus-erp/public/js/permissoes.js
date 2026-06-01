// =====================================================
// Fraser Alexander – Sistema de Permissões por Perfil
// Controle granular por módulo e ação
// =====================================================

// ─── DEFINIÇÃO DE MÓDULOS ────────────────────────────────────────────────────
const MODULOS_SISTEMA = [
  { id: 'dashboard',     label: 'Dashboard',                 icon: 'th-large' },
  { id: 'contratos',     label: 'Contratos',                 icon: 'file-contract' },
  { id: 'os',            label: 'Ordens de Serviço',         icon: 'clipboard-list' },
  { id: 'medicao',       label: 'Medição',                   icon: 'ruler-combined' },
  { id: 'financeiro',    label: 'Painel Financeiro',         icon: 'chart-line' },
  { id: 'faturamento',   label: 'Faturamento',               icon: 'file-invoice-dollar' },
  { id: 'contas_pagar',  label: 'Contas a Pagar',            icon: 'hand-holding-usd' },
  { id: 'fornecedores',  label: 'Fornecedores',              icon: 'building' },
  { id: 'requisicoes',   label: 'Requisições de Compra',     icon: 'file-alt' },
  { id: 'pedidos',       label: 'Pedidos de Compra',         icon: 'shopping-cart' },
  { id: 'mapa_cotacao',  label: 'Mapa Comparativo',          icon: 'balance-scale' },
  { id: 'contratos_sup', label: 'Contratos de Fornecimento', icon: 'handshake' },
  { id: 'materiais',     label: 'Cadastro de Materiais',     icon: 'cube' },
  { id: 'almoxarifado',  label: 'Almoxarifado',              icon: 'boxes' },
  { id: 'equipe',        label: 'Equipe / Mobilização',      icon: 'users' },
  { id: 'frota',         label: 'Frota / Equipamentos',      icon: 'truck' },
  { id: 'ssma',          label: 'SSMA',                      icon: 'hard-hat' },
  { id: 'custos',         label: 'Controle de Custos (WBS)',   icon: 'chart-area' },
  { id: 'relatorios',    label: 'Relatórios',                icon: 'chart-bar' },
  { id: 'admin_usuarios',label: 'Gestão de Usuários',        icon: 'users-cog' },
  { id: 'admin_config',  label: 'Configurações',             icon: 'cog' },
  { id: 'admin_logs',    label: 'Logs do Sistema',           icon: 'history' },
  { id: 'admin_backup',  label: 'Backup e Dados',            icon: 'database' },
];

// Ações disponíveis por módulo
const ACOES_MODULO = ['view', 'create', 'edit', 'delete', 'approve', 'export'];

// ─── PERMISSÕES PADRÃO POR PERFIL ─────────────────────────────────────────────
// Formato: { modulo: { view, create, edit, delete, approve, export } }
const PERMISSOES_PADRAO = {
  admin: {
    // Admin tem acesso total a tudo
    _default: { view: true, create: true, edit: true, delete: true, approve: true, export: true }
  },
  diretor: {
    dashboard:      { view: true, create: false, edit: false, delete: false, approve: true, export: true },
    contratos:      { view: true, create: false, edit: false, delete: false, approve: true, export: true },
    os:             { view: true, create: false, edit: false, delete: false, approve: true, export: true },
    medicao:        { view: true, create: false, edit: false, delete: false, approve: true, export: true },
    financeiro:     { view: true, create: false, edit: false, delete: false, approve: true, export: true },
    faturamento:    { view: true, create: false, edit: false, delete: false, approve: true, export: true },
    contas_pagar:   { view: true, create: false, edit: false, delete: false, approve: true, export: true },
    fornecedores:   { view: true, create: false, edit: false, delete: false, approve: true, export: true },
    requisicoes:    { view: true, create: false, edit: false, delete: false, approve: true, export: true },
    pedidos:        { view: true, create: false, edit: false, delete: false, approve: true, export: true },
    mapa_cotacao:   { view: true, create: false, edit: false, delete: false, approve: true, export: true },
    contratos_sup:  { view: true, create: false, edit: false, delete: false, approve: true, export: true },
    materiais:      { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    almoxarifado:   { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    equipe:         { view: true, create: false, edit: false, delete: false, approve: true, export: true },
    frota:          { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    ssma:           { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    custos:         { view: true, create: true,  edit: true,  delete: false, approve: true,  export: true },
    relatorios:     { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    admin_usuarios: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
    admin_config:   { view: false, create: false, edit: false, delete: false, approve: false, export: false },
    admin_logs:     { view: true,  create: false, edit: false, delete: false, approve: false, export: true  },
    admin_backup:   { view: false, create: false, edit: false, delete: false, approve: false, export: false },
  },
  financeiro: {
    dashboard:      { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    contratos:      { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    os:             { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    medicao:        { view: true, create: false, edit: true,  delete: false, approve: true,  export: true },
    financeiro:     { view: true, create: true,  edit: true,  delete: false, approve: true,  export: true },
    faturamento:    { view: true, create: true,  edit: true,  delete: false, approve: true,  export: true },
    contas_pagar:   { view: true, create: true,  edit: true,  delete: false, approve: true,  export: true },
    fornecedores:   { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    requisicoes:    { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    pedidos:        { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    mapa_cotacao:   { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    contratos_sup:  { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    materiais:      { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    almoxarifado:   { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    equipe:         { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    frota:          { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    ssma:           { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    custos:         { view: true, create: true,  edit: true,  delete: false, approve: true,  export: true },
    relatorios:     { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    admin_usuarios: { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    admin_config:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    admin_logs:     { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    admin_backup:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
  },
  operacao: {
    dashboard:      { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    contratos:      { view: true, create: false, edit: true,  delete: false, approve: false, export: true },
    os:             { view: true, create: true,  edit: true,  delete: false, approve: true,  export: true },
    medicao:        { view: true, create: true,  edit: true,  delete: false, approve: false, export: true },
    financeiro:     { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    faturamento:    { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    contas_pagar:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    fornecedores:   { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    requisicoes:    { view: true, create: true,  edit: true,  delete: false, approve: true,  export: true },  // gestor aprova
    pedidos:        { view: true, create: false, edit: false, delete: false, approve: true,  export: false }, // gerente aprova
    mapa_cotacao:   { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    contratos_sup:  { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    materiais:      { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    almoxarifado:   { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    equipe:         { view: true, create: true,  edit: true,  delete: false, approve: true,  export: true },
    frota:          { view: true, create: false, edit: true,  delete: false, approve: false, export: true },
    ssma:           { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    custos:         { view: true, create: true,  edit: true,  delete: false, approve: false, export: true },
    relatorios:     { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    admin_usuarios: { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    admin_config:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    admin_logs:     { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    admin_backup:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
  },
  compras: {
    dashboard:      { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    contratos:      { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    os:             { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    medicao:        { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    financeiro:     { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    faturamento:    { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    contas_pagar:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    fornecedores:   { view: true, create: true,  edit: true,  delete: false, approve: false, export: true },
    requisicoes:    { view: true, create: false, edit: false, delete: false, approve: false, export: true }, // só vê, não cria
    pedidos:        { view: true, create: true,  edit: true,  delete: false, approve: false, export: true }, // emite pedido, não aprova
    mapa_cotacao:   { view: true, create: true,  edit: true,  delete: false, approve: false, export: true },
    contratos_sup:  { view: true, create: true,  edit: true,  delete: false, approve: false, export: true },
    materiais:      { view: true, create: true,  edit: true,  delete: false, approve: false, export: true },
    almoxarifado:   { view: true, create: true,  edit: true,  delete: false, approve: false, export: true },
    equipe:         { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    frota:          { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    ssma:           { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    custos:         { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    relatorios:     { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    admin_usuarios: { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    admin_config:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    admin_logs:     { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    admin_backup:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
  },
  ssma: {
    dashboard:      { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    contratos:      { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    os:             { view: true, create: true,  edit: true,  delete: false, approve: false, export: true },
    medicao:        { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    financeiro:     { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    faturamento:    { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    contas_pagar:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    fornecedores:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    requisicoes:    { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    pedidos:        { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    mapa_cotacao:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    contratos_sup:  { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    materiais:      { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    almoxarifado:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    equipe:         { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    frota:          { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    ssma:           { view: true, create: true,  edit: true,  delete: false, approve: true,  export: true },
    custos:         { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    relatorios:     { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    admin_usuarios: { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    admin_config:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    admin_logs:     { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    admin_backup:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
  },
  rh: {
    dashboard:      { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    contratos:      { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    os:             { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    medicao:        { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    financeiro:     { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    faturamento:    { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    contas_pagar:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    fornecedores:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    requisicoes:    { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    pedidos:        { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    mapa_cotacao:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    contratos_sup:  { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    materiais:      { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    almoxarifado:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    equipe:         { view: true, create: true,  edit: true,  delete: false, approve: true,  export: true },
    frota:          { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    ssma:           { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    custos:         { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    relatorios:     { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    admin_usuarios: { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    admin_config:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    admin_logs:     { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    admin_backup:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
  },
  supervisor: {
    dashboard:      { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    contratos:      { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    os:             { view: true, create: true,  edit: true,  delete: false, approve: false, export: true },
    medicao:        { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    financeiro:     { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    faturamento:    { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    contas_pagar:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    fornecedores:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    requisicoes:    { view: true, create: true,  edit: false, delete: false, approve: true,  export: false }, // supervisor aprova requisição
    pedidos:        { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    mapa_cotacao:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    contratos_sup:  { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    materiais:      { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    almoxarifado:   { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    equipe:         { view: true, create: false, edit: true,  delete: false, approve: false, export: false },
    frota:          { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    ssma:           { view: true, create: true,  edit: false, delete: false, approve: false, export: false },
    custos:         { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    relatorios:     { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    admin_usuarios: { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    admin_config:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    admin_logs:     { view: false,create: false, edit: false, delete: false, approve: false, export: false },
    admin_backup:   { view: false,create: false, edit: false, delete: false, approve: false, export: false },
  }
};

// ─── CARREGA PERMISSÕES CUSTOMIZADAS ──────────────────────────────────────────
// O ADM pode customizar permissões individuais por usuário via interface
function _getPermissoesCustom() {
  try {
    const raw = localStorage.getItem('fa_permissoes_custom');
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}

function _savePermissoesCustom(obj) {
  localStorage.setItem('fa_permissoes_custom', JSON.stringify(obj));
}

// ─── FUNÇÃO PRINCIPAL DE VERIFICAÇÃO ──────────────────────────────────────────
// hasPermission('os', 'create') → true/false
function hasPermission(modulo, acao) {
  if (!currentUser) return false;
  const perfil = currentUser.profile;

  // Admin tem tudo
  if (perfil === 'admin') return true;

  // Verifica permissões customizadas do usuário individual
  const custom = _getPermissoesCustom();
  const emailKey = (currentUser.email || '').toLowerCase();
  if (custom[emailKey] && custom[emailKey][modulo]) {
    const permCustom = custom[emailKey][modulo];
    if (typeof permCustom[acao] !== 'undefined') return !!permCustom[acao];
  }

  // Fallback para permissões padrão do perfil
  const permPerfil = PERMISSOES_PADRAO[perfil];
  if (!permPerfil) return false;

  // Se perfil tem _default (como admin), usa ele
  if (permPerfil._default) return !!permPerfil._default[acao];

  const permModulo = permPerfil[modulo];
  if (!permModulo) return false;
  return !!permModulo[acao];
}

// Retorna todas as permissões do usuário atual para um módulo
function getPermissoesModulo(modulo) {
  const acoes = {};
  ACOES_MODULO.forEach(a => { acoes[a] = hasPermission(modulo, a); });
  return acoes;
}

// ─── RENDERIZAR PÁGINA DE PERMISSÕES ──────────────────────────────────────────
function renderAdminPermissoes() {
  const main = document.getElementById('mainContent');
  const perfis = ['diretor','financeiro','operacao','compras','ssma','rh','supervisor'];
  const custom = _getPermissoesCustom();

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-key" style="color:var(--fa-teal);margin-right:10px"></i>Matriz de Permissões</h2>
        <p>Controle granular de acesso por perfil e módulo</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="renderAdminUsuarios()"><i class="fas fa-arrow-left"></i> Voltar</button>
        <button class="btn btn-primary btn-sm" onclick="salvarPermissoesMatrix()"><i class="fas fa-save"></i> Salvar Alterações</button>
      </div>
    </div>

    <!-- Abas: Por Perfil | Por Usuário -->
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn btn-primary btn-sm" id="tabPerfil" onclick="showPermTab('perfil')">
        <i class="fas fa-users"></i> Por Perfil
      </button>
      <button class="btn btn-secondary btn-sm" id="tabUsuario" onclick="showPermTab('usuario')">
        <i class="fas fa-user"></i> Por Usuário
      </button>
    </div>

    <!-- Por Perfil -->
    <div id="permTabPerfil">
      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-table" style="color:var(--orange);margin-right:8px"></i>Permissões por Perfil de Acesso</h3>
          <div style="font-size:11px;color:var(--text-muted)">✅ = Permitido · 🚫 = Bloqueado · Clique para alternar</div>
        </div>
        <div style="overflow-x:auto;padding:0 16px 16px">
          <table style="width:100%;min-width:900px;border-collapse:collapse;font-size:11px">
            <thead>
              <tr style="background:var(--bg-card2)">
                <th style="padding:10px 8px;text-align:left;border-bottom:1px solid var(--border);min-width:160px;font-size:12px">Módulo</th>
                ${['Ver','Criar','Editar','Excluir','Aprovar','Exportar'].map((a, i) => `
                  <th style="padding:8px;text-align:center;border-bottom:1px solid var(--border)">${perfis.map(p => `<div style="font-size:9px;color:var(--text-muted)">${{diretor:'DIR',financeiro:'FIN',operacao:'OPR',compras:'CMP',ssma:'SSM',rh:'RH',supervisor:'SUP'}[p]}</div>`).join('')}<div style="font-size:10px;font-weight:700;color:var(--fa-teal);margin-top:4px">${a}</div></th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${MODULOS_SISTEMA.map((mod, mi) => `
                <tr style="border-bottom:1px solid var(--border);${mi%2===0?'background:rgba(255,255,255,0.01)':''}">
                  <td style="padding:8px;font-size:11px;color:var(--text-secondary)">
                    <i class="fas fa-${mod.icon}" style="color:var(--orange);margin-right:6px;width:14px"></i>${mod.label}
                  </td>
                  ${ACOES_MODULO.map(acao => `
                    <td style="padding:4px 8px;text-align:center">
                      <div style="display:flex;gap:2px;justify-content:center;flex-wrap:wrap">
                        ${perfis.map(perfil => {
                          const p = PERMISSOES_PADRAO[perfil];
                          const val = p ? (p[mod.id] ? !!p[mod.id][acao] : false) : false;
                          return `
                            <button onclick="togglePermMatrix('${perfil}','${mod.id}','${acao}',this)"
                              data-perfil="${perfil}" data-modulo="${mod.id}" data-acao="${acao}" data-val="${val}"
                              title="${perfil} – ${mod.label} – ${acao}"
                              style="width:18px;height:18px;border:none;border-radius:3px;cursor:pointer;font-size:9px;
                                background:${val ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)'};
                                color:${val ? 'var(--green-light)' : 'var(--red-light)'}">
                              ${val ? '✓' : '✗'}
                            </button>
                          `;
                        }).join('')}
                      </div>
                    </td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Por Usuário -->
    <div id="permTabUsuario" style="display:none">
      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-user-cog" style="color:var(--orange);margin-right:8px"></i>Permissões Individuais por Usuário</h3>
          <div style="font-size:11px;color:var(--text-muted)">Permite sobrescrever permissões do perfil para um usuário específico</div>
        </div>
        <div class="card-body">
          <div class="form-group" style="max-width:400px">
            <label>Selecionar Usuário</label>
            <select class="form-control" id="selUsuarioPerm" onchange="renderPermUsuario()">
              <option value="">Selecione um usuário...</option>
              ${FA_USUARIOS.filter(u => u.perfil !== 'admin').map(u =>
                `<option value="${u.email.toLowerCase()}">${u.nome} (${u.perfil})</option>`
              ).join('')}
            </select>
          </div>
          <div id="permUsuarioContent" style="margin-top:16px"></div>
        </div>
      </div>
    </div>
  `;
}

function showPermTab(tab) {
  document.getElementById('permTabPerfil').style.display = tab === 'perfil' ? 'block' : 'none';
  document.getElementById('permTabUsuario').style.display = tab === 'usuario' ? 'block' : 'none';
  document.getElementById('tabPerfil').className = tab === 'perfil' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
  document.getElementById('tabUsuario').className = tab === 'usuario' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
}

function togglePermMatrix(perfil, modulo, acao, btn) {
  const val = btn.dataset.val === 'true';
  const novoVal = !val;
  btn.dataset.val = String(novoVal);
  btn.style.background = novoVal ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)';
  btn.style.color = novoVal ? 'var(--green-light)' : 'var(--red-light)';
  btn.textContent = novoVal ? '✓' : '✗';

  // Atualiza em memória
  if (!PERMISSOES_PADRAO[perfil]) PERMISSOES_PADRAO[perfil] = {};
  if (!PERMISSOES_PADRAO[perfil][modulo]) PERMISSOES_PADRAO[perfil][modulo] = {};
  PERMISSOES_PADRAO[perfil][modulo][acao] = novoVal;
}

function salvarPermissoesMatrix() {
  localStorage.setItem('fa_permissoes_matrix', JSON.stringify(PERMISSOES_PADRAO));
  logAction('Permissões', 'Admin', 'Matriz de permissões atualizada');
  showToast('Permissões salvas com sucesso!', 'success');
}

function renderPermUsuario() {
  const emailKey = document.getElementById('selUsuarioPerm').value;
  if (!emailKey) return;
  const user = FA_USUARIOS.find(u => u.email.toLowerCase() === emailKey);
  if (!user) return;

  const custom = _getPermissoesCustom();
  const customUser = custom[emailKey] || {};
  const permPerfil = PERMISSOES_PADRAO[user.perfil] || {};

  document.getElementById('permUsuarioContent').innerHTML = `
    <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--fa-teal)">
      <i class="fas fa-user-shield"></i> Permissões de <strong>${user.nome}</strong> (Perfil: ${user.perfil})
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
          <tr style="background:var(--bg-card2)">
            <th style="padding:8px;text-align:left;border-bottom:1px solid var(--border)">Módulo</th>
            ${ACOES_MODULO.map(a => `<th style="padding:8px;text-align:center;border-bottom:1px solid var(--border)">${{view:'Ver',create:'Criar',edit:'Editar',delete:'Excluir',approve:'Aprovar',export:'Exportar'}[a]}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${MODULOS_SISTEMA.filter(m => !m.id.startsWith('admin_')).map((mod, mi) => {
            const permBase = permPerfil[mod.id] || {};
            return `
              <tr style="border-bottom:1px solid var(--border);${mi%2===0?'background:rgba(255,255,255,0.01)':''}">
                <td style="padding:8px;font-size:11px">
                  <i class="fas fa-${mod.icon}" style="color:var(--orange);margin-right:6px;width:14px"></i>${mod.label}
                </td>
                ${ACOES_MODULO.map(acao => {
                  const baseVal = !!permBase[acao];
                  const customVal = customUser[mod.id] ? customUser[mod.id][acao] : undefined;
                  const finalVal = typeof customVal !== 'undefined' ? customVal : baseVal;
                  const isCustom = typeof customVal !== 'undefined';
                  return `
                    <td style="padding:8px;text-align:center">
                      <button onclick="togglePermUsuario('${emailKey}','${mod.id}','${acao}',this)"
                        data-val="${finalVal}"
                        title="${finalVal ? 'Permitido' : 'Bloqueado'}${isCustom ? ' (customizado)' : ' (padrão do perfil)'}"
                        style="width:24px;height:24px;border:none;border-radius:4px;cursor:pointer;font-size:10px;
                          background:${finalVal ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)'};
                          color:${finalVal ? 'var(--green-light)' : 'var(--red-light)'};
                          outline:${isCustom ? '2px solid var(--fa-teal)' : 'none'}">
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
    <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-danger btn-sm" onclick="resetPermUsuario('${emailKey}')"><i class="fas fa-undo"></i> Resetar para Perfil</button>
      <button class="btn btn-primary btn-sm" onclick="salvarPermUsuario('${emailKey}')"><i class="fas fa-save"></i> Salvar Customizações</button>
    </div>
    <div style="margin-top:8px;font-size:10px;color:var(--text-muted)">
      <i class="fas fa-info-circle"></i> Botões com borda colorida = permissão customizada (difere do padrão do perfil). Sem borda = seguindo permissões do perfil.
    </div>
  `;
}

function togglePermUsuario(emailKey, modulo, acao, btn) {
  const val = btn.dataset.val === 'true';
  const novoVal = !val;
  btn.dataset.val = String(novoVal);
  btn.style.background = novoVal ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)';
  btn.style.color = novoVal ? 'var(--green-light)' : 'var(--red-light)';
  btn.textContent = novoVal ? '✓' : '✗';
  btn.style.outline = '2px solid var(--fa-teal)';
  btn.title = (novoVal ? 'Permitido' : 'Bloqueado') + ' (customizado)';
}

function salvarPermUsuario(emailKey) {
  const custom = _getPermissoesCustom();
  custom[emailKey] = {};

  // Coleta todos os botões da tabela de permissão de usuário
  const btns = document.querySelectorAll('#permUsuarioContent button[data-val]');
  btns.forEach(btn => {
    const parts = btn.title.replace(' (customizado)', '').replace(' (padrão do perfil)', '').split(' – ');
    // fallback: usa onclick para extrair modulo/acao
  });

  // Abordagem direta: re-lê da tabela por posição
  const rows = document.querySelectorAll('#permUsuarioContent tbody tr');
  rows.forEach((row, ri) => {
    const mod = MODULOS_SISTEMA.filter(m => !m.id.startsWith('admin_'))[ri];
    if (!mod) return;
    const cells = row.querySelectorAll('td button');
    cells.forEach((btn, ci) => {
      const acao = ACOES_MODULO[ci];
      if (!acao) return;
      if (!custom[emailKey][mod.id]) custom[emailKey][mod.id] = {};
      custom[emailKey][mod.id][acao] = btn.dataset.val === 'true';
    });
  });

  _savePermissoesCustom(custom);
  logAction('Permissões Usuário', 'Admin', `Permissões customizadas salvas para ${emailKey}`);
  showToast('Permissões do usuário salvas!', 'success');
}

function resetPermUsuario(emailKey) {
  const custom = _getPermissoesCustom();
  delete custom[emailKey];
  _savePermissoesCustom(custom);
  showToast('Permissões resetadas para o padrão do perfil!', 'info');
  renderPermUsuario();
}

// ─── RENDERIZA ACESSO NEGADO ──────────────────────────────────────────────────
function renderAcessoNegado() {
  document.getElementById('mainContent').innerHTML = `
    <div class="empty-state" style="padding-top:80px">
      <i class="fas fa-lock" style="color:var(--red-light);font-size:48px"></i>
      <p style="margin-top:16px;font-size:18px;font-weight:600;color:var(--red-light)">Acesso Restrito</p>
      <p style="font-size:13px;color:var(--text-secondary);margin-top:4px">Você não tem permissão para acessar este módulo.</p>
      <p style="font-size:12px;color:var(--text-muted);margin-top:4px">Entre em contato com o Administrador do Sistema para solicitar acesso.</p>
      <button class="btn btn-secondary" style="margin-top:16px" onclick="navigate('dashboard')">
        <i class="fas fa-home"></i> Voltar ao Dashboard
      </button>
    </div>
  `;
}

// ─── SIDEBAR: OCULTA ITENS SEM PERMISSÃO ──────────────────────────────────────
function aplicarPermissoesSidebar() {
  if (!currentUser) return;

  // Mapeia menu → modulo
  const menuMap = {
    'contratos': 'contratos',
    'os': 'os',
    'medicao': 'medicao',
    'financeiro': 'financeiro',
    'faturamento': 'faturamento',
    'contas_pagar': 'contas_pagar',
    'fornecedores': 'fornecedores',
    'pedidos': 'pedidos',
    'compras': 'requisicoes',
    'equipe': 'equipe',
    'frota': 'frota',
    'estoque': 'almoxarifado',
    'ssma': 'ssma',
    'relatorios': 'relatorios',
    'admin_usuarios': 'admin_usuarios',
    'admin_config': 'admin_config',
    'admin_logs': 'admin_logs',
    'admin_backup': 'admin_backup',
  };

  document.querySelectorAll('.nav-item[onclick]').forEach(item => {
    const onclick = item.getAttribute('onclick') || '';
    const match = onclick.match(/navigate\('([^']+)'\)/);
    if (!match) return;
    const page = match[1];
    const modulo = menuMap[page];
    if (modulo) {
      const temAcesso = hasPermission(modulo, 'view');
      item.style.display = temAcesso ? '' : 'none';
    }
  });

  // Admin: mostra seção Administração
  const navAdmin = document.getElementById('nav-admin');
  if (navAdmin) navAdmin.style.display = currentUser.profile === 'admin' ? 'block' : 'none';
}

// ─── PERFIL RESUMIDO (para página de perfil) ──────────────────────────────────
function getPermissoesPerfilForDisplay(profile) {
  const permPerfil = PERMISSOES_PADRAO[profile] || {};
  if (permPerfil._default) {
    return MODULOS_SISTEMA.slice(0, 6).map(m => ({
      modulo: m.label, icon: m.icon, acesso: 'Total'
    }));
  }
  return MODULOS_SISTEMA.map(mod => {
    const p = permPerfil[mod.id];
    if (!p) return null;
    const temView = p.view;
    const temCriar = p.create;
    const temEditar = p.edit;
    const temAprovar = p.approve;
    if (!temView) return null;
    const nivel = (temCriar && temEditar && temAprovar) ? 'Total' :
                  (temCriar && temEditar) ? 'Operacional' :
                  (temEditar) ? 'Edição' :
                  (temView) ? 'Leitura' : 'Restrito';
    return { modulo: mod.label, icon: mod.icon, acesso: nivel };
  }).filter(Boolean);
}

// Mantém compatibilidade com código existente
function getPermissoesPerfil(profile) {
  return getPermissoesPerfilForDisplay(profile);
}
