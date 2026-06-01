// =====================================================
// Fraser Alexander ERP – Melhorias e Correções v2.0
// Limpeza de base, funcionalidades extras, integrações
// =====================================================

// ─── 1. LIMPEZA DA BASE DE DADOS ─────────────────────────────────────────────
// Remove todos os dados de teste e reinicia o sistema com dados reais
function limparBaseCompleta() {
  if (!currentUser || currentUser.profile !== 'admin') {
    showToast('Apenas o Administrador pode limpar a base de dados.', 'error');
    return;
  }

  openModalWide('⚠️ Limpeza Completa da Base de Dados', `
    <div class="alert alert-danger">
      <span class="alert-icon"><i class="fas fa-exclamation-triangle"></i></span>
      <div>
        <div class="alert-title">ATENÇÃO – Ação Irreversível</div>
        <div class="alert-desc">Esta ação removerá TODOS os dados salvos no sistema (OS, Requisições, Pedidos, Medições, Fornecedores, etc.) e reiniciará com os dados padrão do sistema. Esta ação NÃO pode ser desfeita.</div>
      </div>
    </div>

    <div style="margin:16px 0">
      <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:12px">Dados que serão removidos:</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${[
          { icon:'clipboard-list', label:'Ordens de Serviço', key:'fa_ordens_servico' },
          { icon:'clock', label:'Apontamentos de Horas', key:'fa_apontamentos_os' },
          { icon:'tasks', label:'Checklists de OS', key:'fa_checklist_os' },
          { icon:'file-alt', label:'Requisições de Compra', key:'fa_requisicoes' },
          { icon:'shopping-cart', label:'Pedidos de Compra', key:'fa_pedidos' },
          { icon:'building', label:'Fornecedores', key:'fa_fornecedores' },
          { icon:'balance-scale', label:'Cotações (RFQ)', key:'fa_rfq' },
          { icon:'ruler-combined', label:'Medições', key:'fa_medicoes' },
          { icon:'file-invoice-dollar', label:'Faturas', key:'fa_faturas' },
          { icon:'boxes', label:'Estoque / Almoxarifado', key:'fa_estoque' },
          { icon:'users', label:'Colaboradores', key:'fa_colaboradores' },
          { icon:'hard-hat', label:'Incidentes SSMA', key:'fa_ssma_incidentes' },
        ].map(d => `
          <div style="display:flex;align-items:center;gap:8px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:6px;padding:8px 10px">
            <i class="fas fa-${d.icon}" style="color:var(--red-light);width:14px"></i>
            <span style="font-size:12px;color:var(--text-secondary)">${d.label}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <div style="background:rgba(0,180,184,0.06);border:1px solid rgba(0,180,184,0.2);border-radius:8px;padding:12px;margin-bottom:12px">
      <div style="font-size:12px;color:var(--fa-teal);font-weight:600;margin-bottom:4px"><i class="fas fa-shield-alt"></i> O que NÃO será removido:</div>
      <div style="font-size:12px;color:var(--text-secondary)">Usuários cadastrados, senhas, configurações do sistema e permissões personalizadas.</div>
    </div>

    <div class="form-group">
      <label style="color:var(--red-light)">Digite "CONFIRMAR LIMPEZA" para prosseguir:</label>
      <input class="form-control" id="confirmLimpezaInput" type="text" placeholder='Digite exatamente: CONFIRMAR LIMPEZA' style="border-color:var(--red-light)">
    </div>
    <div id="limpezaErro" style="display:none;color:var(--red-light);font-size:12px;padding:8px;border-radius:6px;background:rgba(239,68,68,0.1)"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="executarLimpezaBase()">
      <i class="fas fa-trash-alt"></i> Confirmar Limpeza
    </button>
  `);
}

function executarLimpezaBase() {
  const input = document.getElementById('confirmLimpezaInput');
  const erroEl = document.getElementById('limpezaErro');

  if (!input || input.value.trim() !== 'CONFIRMAR LIMPEZA') {
    erroEl.textContent = 'Digite exatamente "CONFIRMAR LIMPEZA" para confirmar.';
    erroEl.style.display = 'block';
    return;
  }

  // Remove todos os dados de transação do sistema
  const keysToRemove = [
    'fa_ordens_servico', 'fa_apontamentos_os', 'fa_checklist_os',
    'fa_requisicoes', 'fa_pedidos', 'fa_fornecedores', 'fa_rfq',
    'fa_medicoes', 'fa_faturas', 'fa_estoque', 'fa_colaboradores',
    'fa_ssma_incidentes', 'fa_frota', 'fa_materiais', 'fa_contas_pagar',
    'fa_contratos_fornecimento', 'fa_crm_leads', 'fa_avaliacoes_forn',
    'fa_notificacoes', 'fa_suprimentos', 'fa_incidentes',
    'fa_permissoes_matrix'
  ];

  keysToRemove.forEach(key => localStorage.removeItem(key));

  logAction('Limpeza Base', 'Admin', 'Base de dados completamente limpa pelo administrador');
  closeModal();
  showToast('✅ Base de dados limpa com sucesso! Sistema reiniciado com dados padrão.', 'success', 6000);

  // Volta ao dashboard
  setTimeout(() => navigate('dashboard'), 1500);
}

// ─── 2. LIMPEZA SELETIVA DE DADOS ────────────────────────────────────────────
function limparDadosModulo(modulo, chave, label) {
  if (!currentUser || currentUser.profile !== 'admin') {
    showToast('Apenas o Administrador pode limpar dados.', 'error');
    return;
  }

  confirmarAcao(
    `Limpar ${label}`,
    `Remover todos os dados de <strong>${label}</strong>? Esta ação não pode ser desfeita.`,
    `_executarLimpezaModulo('${chave}','${label}')`,
    true
  );
}

function _executarLimpezaModulo(chave, label) {
  localStorage.removeItem(chave);
  logAction('Limpeza Módulo', 'Admin', `Dados de ${label} removidos`);
  showToast(`Dados de "${label}" removidos com sucesso!`, 'warning');
}

// ─── 3. MÓDULO ADMIN BACKUP MELHORADO ────────────────────────────────────────
function renderAdminBackupMelhorado() {
  const main = document.getElementById('mainContent');

  // Calcula uso de dados
  let totalBytes = 0;
  const keysInfo = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('fa_')) {
      const val = localStorage.getItem(key) || '';
      totalBytes += val.length * 2;
      keysInfo.push({
        key,
        label: _labelForKey(key),
        size: (val.length * 2 / 1024).toFixed(1),
        count: _countItems(key, val)
      });
    }
  }
  const totalKB = (totalBytes / 1024).toFixed(1);

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-database" style="color:var(--fa-teal);margin-right:10px"></i>Backup e Gerenciamento de Dados</h2>
        <p>Exportação, backup e manutenção do banco de dados · <strong>${totalKB} KB</strong> em uso</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-danger btn-sm" onclick="limparBaseCompleta()">
          <i class="fas fa-trash-alt"></i> Limpar Base
        </button>
        <button class="btn btn-primary btn-sm" onclick="exportarBackupCompleto()">
          <i class="fas fa-download"></i> Backup Completo
        </button>
      </div>
    </div>

    <div class="grid-2">
      <!-- Exportação de Dados -->
      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-file-export" style="color:var(--fa-teal);margin-right:8px"></i>Exportação por Módulo</h3>
        </div>
        <div class="card-body">
          ${[
            { label:'Ordens de Serviço', icon:'clipboard-list', color:'var(--orange)', fn:"exportarModuloCSV('fa_ordens_servico','OrdemServico')" },
            { label:'Requisições de Compra', icon:'file-alt', color:'var(--blue-light)', fn:"exportarModuloCSV('fa_requisicoes','Requisicoes')" },
            { label:'Pedidos de Compra', icon:'shopping-cart', color:'var(--fa-teal)', fn:"exportarModuloCSV('fa_pedidos','PedidosCompra')" },
            { label:'Fornecedores', icon:'building', color:'var(--green-light)', fn:"exportarModuloCSV('fa_fornecedores','Fornecedores')" },
            { label:'Medições Contratuais', icon:'ruler-combined', color:'var(--purple)', fn:"exportarModuloCSV('fa_medicoes','Medicoes')" },
            { label:'Logs de Auditoria', icon:'history', color:'var(--red-light)', fn:"exportarLogsCSV()" },
          ].map(e => `
            <div class="stat-row" style="cursor:pointer" onclick="${e.fn}">
              <span class="stat-label"><i class="fas fa-${e.icon}" style="color:${e.color};width:16px;margin-right:8px"></i>${e.label}</span>
              <button class="btn btn-secondary btn-sm" onclick="${e.fn};event.stopPropagation()">
                <i class="fas fa-file-csv"></i> CSV
              </button>
            </div>
          `).join('')}
          <div style="margin-top:16px">
            <button class="btn btn-primary" style="width:100%" onclick="exportarBackupCompleto()">
              <i class="fas fa-database"></i> Gerar Backup Completo (JSON)
            </button>
          </div>
        </div>
      </div>

      <!-- Dados no Armazenamento -->
      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-hdd" style="color:var(--blue-light);margin-right:8px"></i>Armazenamento Local</h3>
          <span class="badge badge-info">${totalKB} KB</span>
        </div>
        <div class="card-body" style="max-height:400px;overflow-y:auto">
          ${keysInfo.length ? keysInfo.sort((a,b) => parseFloat(b.size)-parseFloat(a.size)).map(k => `
            <div class="stat-row" style="padding:8px 0;border-bottom:1px solid var(--border)">
              <div>
                <div style="font-size:12px;font-weight:500">${k.label}</div>
                <div style="font-size:10px;color:var(--text-muted)">${k.key} · ${k.count} registro(s)</div>
              </div>
              <div style="display:flex;align-items:center;gap:6px">
                <span style="font-size:11px;color:var(--text-muted)">${k.size} KB</span>
                <button class="btn btn-danger btn-sm btn-icon" onclick="limparDadosModulo('${k.key.replace('fa_','')}','${k.key}','${k.label}')" title="Limpar">
                  <i class="fas fa-trash" style="font-size:10px"></i>
                </button>
              </div>
            </div>
          `).join('') : `
            <div class="empty-state" style="padding:20px">
              <i class="fas fa-box-open" style="color:var(--text-muted)"></i>
              <p>Nenhum dado armazenado localmente</p>
            </div>
          `}
        </div>
      </div>
    </div>

    <!-- Status do Sistema -->
    <div class="card" style="margin-top:16px">
      <div class="card-header">
        <h3><i class="fas fa-info-circle" style="color:var(--blue-light);margin-right:8px"></i>Status do Sistema</h3>
      </div>
      <div class="card-body" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
        <div>
          <div class="stat-row"><span class="stat-label">Versão ERP</span><span class="stat-value" style="color:var(--fa-teal)">v4.0 – Fraser Alexander</span></div>
          <div class="stat-row"><span class="stat-label">Armazenamento</span><span class="stat-value">localStorage (Browser)</span></div>
          <div class="stat-row"><span class="stat-label">Capacidade</span><span class="stat-value">${totalKB} KB de ~10 MB</span></div>
        </div>
        <div>
          <div class="stat-row"><span class="stat-label">Usuários Cadastrados</span><span class="stat-value">${(FA_USUARIOS||[]).length}</span></div>
          <div class="stat-row"><span class="stat-label">OS no Sistema</span><span class="stat-value">${_countItems('fa_ordens_servico')}</span></div>
          <div class="stat-row"><span class="stat-label">Pedidos de Compra</span><span class="stat-value">${_countItems('fa_pedidos')}</span></div>
        </div>
        <div>
          <div class="stat-row"><span class="stat-label">Fornecedores</span><span class="stat-value">${_countItems('fa_fornecedores')}</span></div>
          <div class="stat-row"><span class="stat-label">Logs de Auditoria</span><span class="stat-value">${(SYSTEM_LOGS||[]).length}</span></div>
          <div class="stat-row"><span class="stat-label">Último Acesso</span><span class="stat-value" style="color:var(--green-light)">${currentUser ? currentUser.name : '—'}</span></div>
        </div>
      </div>
    </div>
  `;
}

function _labelForKey(key) {
  const labels = {
    'fa_ordens_servico': 'Ordens de Serviço',
    'fa_apontamentos_os': 'Apontamentos de HH',
    'fa_checklist_os': 'Checklists OS',
    'fa_requisicoes': 'Requisições de Compra',
    'fa_pedidos': 'Pedidos de Compra',
    'fa_fornecedores': 'Fornecedores',
    'fa_rfq': 'Cotações (RFQ)',
    'fa_medicoes': 'Medições',
    'fa_faturas': 'Faturas',
    'fa_estoque': 'Estoque/Almoxarifado',
    'fa_colaboradores': 'Colaboradores',
    'fa_ssma_incidentes': 'Incidentes SSMA',
    'fa_frota': 'Frota/Equipamentos',
    'fa_materiais': 'Materiais',
    'fa_contas_pagar': 'Contas a Pagar',
    'fa_contratos_fornecimento': 'Contratos Fornecimento',
    'fa_crm_leads': 'CRM – Leads',
    'fa_avaliacoes_forn': 'Avaliações Fornecedores',
    'fa_credenciais': 'Credenciais de Acesso',
    'fa_permissoes_custom': 'Permissões Customizadas',
    'fa_permissoes_matrix': 'Matriz de Permissões',
    'fa_config_sistema': 'Configurações do Sistema',
  };
  return labels[key] || key;
}

function _countItems(key, val = null) {
  try {
    const raw = val || localStorage.getItem(key);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length;
    if (typeof parsed === 'object') return Object.keys(parsed).length;
    return 1;
  } catch(e) { return 0; }
}

function exportarModuloCSV(key, nomeArquivo) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) { showToast('Nenhum dado para exportar.', 'warning'); return; }
    const data = JSON.parse(raw);
    if (!data || (Array.isArray(data) && !data.length)) {
      showToast('Nenhum dado encontrado.', 'warning'); return;
    }
    const items = Array.isArray(data) ? data : Object.values(data);
    if (!items.length) { showToast('Nenhum dado para exportar.', 'warning'); return; }

    const headers = Object.keys(items[0]);
    const rows = items.map(item => headers.map(h => {
      const v = item[h];
      if (typeof v === 'object' && v !== null) return JSON.stringify(v).replace(/"/g, "'");
      return String(v || '').replace(/,/g, ';').replace(/"/g, "'");
    }));

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${nomeArquivo}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    logAction('Exportação CSV', 'Admin', `Exportou ${items.length} registros de ${nomeArquivo}`);
    showToast(`${items.length} registros exportados!`, 'success');
  } catch(e) {
    showToast('Erro ao exportar. Tente novamente.', 'error');
  }
}

function exportarLogsCSV() {
  const logs = SYSTEM_LOGS || [];
  if (!logs.length) { showToast('Nenhum log para exportar.', 'warning'); return; }

  const headers = ['Data/Hora', 'Usuário', 'Perfil', 'Módulo', 'Ação', 'Descrição', 'IP'];
  const rows = logs.map(l => [l.data_hora, l.usuario, l.perfil, l.modulo, l.acao, l.descricao, l.ip || '']);

  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Logs_Auditoria_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`${logs.length} logs exportados!`, 'success');
}

function exportarBackupCompleto() {
  const backup = {
    versao: '4.0',
    exportadoEm: new Date().toISOString(),
    exportadoPor: currentUser ? currentUser.name : 'Sistema',
    dados: {}
  };

  // Coleta todos os dados FA do localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('fa_')) {
      try {
        backup.dados[key] = JSON.parse(localStorage.getItem(key));
      } catch(e) {
        backup.dados[key] = localStorage.getItem(key);
      }
    }
  }

  // Inclui logs em memória
  backup.dados['system_logs'] = SYSTEM_LOGS || [];

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `BackupERP_Fraser_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(a.href);

  logAction('Backup', 'Admin', 'Backup completo do sistema exportado');
  showToast('Backup completo gerado com sucesso!', 'success');
}

function restaurarBackup() {
  openModal('Restaurar Backup', `
    <div class="alert alert-warning" style="margin-bottom:16px">
      <span class="alert-icon"><i class="fas fa-exclamation-triangle"></i></span>
      <div><div class="alert-title">Atenção</div>
        <div class="alert-desc">A restauração sobrescreverá os dados atuais do sistema. Certifique-se de ter um backup recente antes de continuar.</div>
      </div>
    </div>
    <div class="form-group">
      <label>Selecionar arquivo de backup (.json)</label>
      <input type="file" class="form-control" id="backupFileInput" accept=".json" onchange="previewBackup(event)">
    </div>
    <div id="backupPreview" style="display:none;background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;padding:12px;margin-top:12px;font-size:12px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-warning" id="btnRestaurar" disabled onclick="confirmarRestauracao()">
      <i class="fas fa-undo"></i> Restaurar
    </button>
  `);
}

let _backupData = null;
function previewBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      _backupData = JSON.parse(e.target.result);
      const preview = document.getElementById('backupPreview');
      preview.style.display = 'block';
      preview.innerHTML = `
        <div style="font-weight:600;color:var(--green-light);margin-bottom:8px">✅ Arquivo válido</div>
        <div>Versão: ${_backupData.versao || 'N/A'}</div>
        <div>Exportado em: ${_backupData.exportadoEm ? new Date(_backupData.exportadoEm).toLocaleString('pt-BR') : 'N/A'}</div>
        <div>Por: ${_backupData.exportadoPor || 'N/A'}</div>
        <div>Módulos: ${Object.keys(_backupData.dados || {}).join(', ')}</div>
      `;
      document.getElementById('btnRestaurar').disabled = false;
    } catch(err) {
      const preview = document.getElementById('backupPreview');
      preview.style.display = 'block';
      preview.innerHTML = '<div style="color:var(--red-light)">❌ Arquivo inválido ou corrompido.</div>';
      _backupData = null;
    }
  };
  reader.readAsText(file);
}

function confirmarRestauracao() {
  if (!_backupData) return;
  closeModal();
  confirmarAcao('Confirmar Restauração', 'Todos os dados atuais serão substituídos pelos dados do backup. Continuar?', '_executarRestauracao()', true);
}

function _executarRestauracao() {
  if (!_backupData || !_backupData.dados) return;
  Object.keys(_backupData.dados).forEach(key => {
    if (key !== 'system_logs') {
      try {
        localStorage.setItem(key, JSON.stringify(_backupData.dados[key]));
      } catch(e) {}
    }
  });
  logAction('Restauração', 'Admin', 'Backup restaurado com sucesso');
  showToast('✅ Backup restaurado! Recarregue a página para ver os dados.', 'success', 8000);
  _backupData = null;
}

// ─── 4. MELHORIAS NA GESTÃO DE USUÁRIOS ──────────────────────────────────────
// Redefinir senha de usuário pelo ADM
function resetarSenhaUsuario(emailKey) {
  const creds = (typeof _getCredenciais === 'function') ? _getCredenciais() : {};
  const user = creds[emailKey];
  if (!user) { showToast('Usuário não encontrado.', 'error'); return; }

  openModal(`Redefinir Senha – ${emailKey}`, `
    <div class="alert alert-warning" style="margin-bottom:16px">
      <span class="alert-icon"><i class="fas fa-key"></i></span>
      <div>
        <div class="alert-title">Redefinição de Senha</div>
        <div class="alert-desc">A senha do usuário será redefinida para <strong>Fraser@2025</strong> e ele será obrigado a trocar no próximo acesso.</div>
      </div>
    </div>
    <p style="font-size:14px;color:var(--text-secondary)">Confirmar redefinição da senha de <strong>${emailKey}</strong>?</p>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-warning" onclick="_confirmarResetSenha('${emailKey}')">
      <i class="fas fa-key"></i> Redefinir Senha
    </button>
  `);
}

function _confirmarResetSenha(emailKey) {
  if (typeof _getCredenciais !== 'function' || typeof _hashSimples !== 'function') {
    showToast('Função não disponível.', 'error'); return;
  }
  const creds = _getCredenciais();
  if (!creds[emailKey]) { showToast('Usuário não encontrado.', 'error'); return; }

  creds[emailKey].senhaHash = _hashSimples('Fraser@2025');
  creds[emailKey].primeiroAcesso = true;
  _saveCredenciais(creds);

  logAction('Reset Senha', 'Admin', `Senha redefinida para ${emailKey}`);
  closeModal();
  showToast(`Senha de ${emailKey} redefinida para Fraser@2025. Usuário deverá trocar no próximo acesso.`, 'success', 7000);
}

// Forçar logout / bloquear usuário
function bloquearUsuarioAdmin(emailKey) {
  if (!currentUser || currentUser.profile !== 'admin') return;
  if (emailKey.toLowerCase() === (currentUser.email || '').toLowerCase()) {
    showToast('Você não pode bloquear sua própria conta!', 'error'); return;
  }

  confirmarAcao('Bloquear Usuário', `Bloquear o acesso de <strong>${emailKey}</strong>? O usuário não conseguirá mais fazer login.`,
    `_executarBloqueio('${emailKey}')`, true);
}

function _executarBloqueio(emailKey) {
  if (typeof _getCredenciais !== 'function') return;
  const creds = _getCredenciais();
  if (!creds[emailKey]) {
    showToast('Usuário não encontrado nas credenciais.', 'error'); return;
  }
  creds[emailKey].ativo = false;
  _saveCredenciais(creds);
  logAction('Bloqueio Usuário', 'Admin', `Usuário bloqueado: ${emailKey}`);
  showToast(`Usuário ${emailKey} bloqueado com sucesso.`, 'warning');
  if (typeof renderAdminUsuarios === 'function') renderAdminUsuarios();
}

function desbloquearUsuarioAdmin(emailKey) {
  if (typeof _getCredenciais !== 'function') return;
  const creds = _getCredenciais();
  if (!creds[emailKey]) { showToast('Usuário não encontrado.', 'error'); return; }
  creds[emailKey].ativo = true;
  _saveCredenciais(creds);
  logAction('Desbloqueio Usuário', 'Admin', `Usuário desbloqueado: ${emailKey}`);
  showToast(`Usuário ${emailKey} desbloqueado com sucesso.`, 'success');
  if (typeof renderAdminUsuarios === 'function') renderAdminUsuarios();
}

// ─── 5. INTEGRAÇÃO OS → REQUISIÇÕES ──────────────────────────────────────────
// Função aprimorada de criação de requisição a partir de OS
function criarRequisicaoRapida(osId, descricaoOS) {
  if (!hasPermission('requisicoes', 'create') && !hasPermission('os', 'edit')) {
    showToast('Sem permissão para criar requisições.', 'error'); return;
  }

  openModalWide(`Requisição de Compra – OS ${osId}`, `
    <div style="background:rgba(230,126,34,0.08);border:1px solid rgba(230,126,34,0.3);border-radius:8px;padding:12px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:var(--orange);margin-bottom:4px">
        <i class="fas fa-link"></i> Vinculada à OS: ${osId}
      </div>
      <div style="font-size:12px;color:var(--text-secondary)">${descricaoOS}</div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Tipo de Necessidade *</label>
        <select class="form-control" id="rq_tipo">
          <option>Material</option>
          <option>Serviço Externo</option>
          <option>Locação de Equipamento</option>
          <option>Ferramenta</option>
          <option>EPI / EPC</option>
        </select>
      </div>
      <div class="form-group">
        <label>Urgência</label>
        <select class="form-control" id="rq_urgencia">
          <option>Normal</option>
          <option>Alta</option>
          <option>Urgente</option>
          <option>Crítica</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label>Itens a Requisitar *</label>
      <table style="width:100%;border-collapse:collapse;font-size:12px" id="rq_itens_table">
        <thead><tr style="background:var(--bg-tertiary)">
          <th style="padding:6px 8px;text-align:left">Descrição do Item</th>
          <th style="padding:6px 8px;text-align:center;width:70px">Qtd</th>
          <th style="padding:6px 8px;text-align:center;width:70px">Unidade</th>
          <th style="padding:6px 8px;text-align:center;width:100px">Valor Est.</th>
          <th style="padding:6px 8px;text-align:center;width:40px"></th>
        </tr></thead>
        <tbody id="rq_itens_body">
          <tr>
            <td style="padding:4px"><input type="text" placeholder="Ex: Rolamento SKF 6205-2Z" class="form-control rq-item-desc" style="font-size:12px"></td>
            <td style="padding:4px"><input type="number" value="1" min="0.01" step="0.01" class="form-control rq-item-qtd" style="font-size:12px;text-align:center" oninput="calcTotalRQ(this)"></td>
            <td style="padding:4px"><input type="text" value="Un" class="form-control rq-item-un" style="font-size:12px;text-align:center"></td>
            <td style="padding:4px"><input type="number" value="0" min="0" step="0.01" class="form-control rq-item-val" placeholder="0,00" style="font-size:12px;text-align:right" oninput="calcTotalRQ(this)"></td>
            <td style="padding:4px;text-align:center"><button onclick="this.closest('tr').remove();calcTotalRQGlobal()" class="btn btn-sm btn-danger"><i class="fas fa-trash"></i></button></td>
          </tr>
        </tbody>
      </table>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
        <button onclick="addItemRQ()" class="btn btn-secondary btn-sm"><i class="fas fa-plus"></i> Adicionar Item</button>
        <div style="font-size:13px;font-weight:600">Valor Estimado Total: <span id="rq_total_val" style="color:var(--fa-teal)">R$ 0,00</span></div>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Prazo de Necessidade</label>
        <input class="form-control" id="rq_prazo" type="date">
      </div>
      <div class="form-group">
        <label>Fornecedor Sugerido (opcional)</label>
        <input class="form-control" id="rq_fornecedor" type="text" placeholder="Nome do fornecedor preferencial">
      </div>
    </div>
    <div class="form-group">
      <label>Justificativa / Observações</label>
      <textarea class="form-control" id="rq_obs" rows="2" placeholder="Justifique a necessidade desta compra...">${descricaoOS ? 'Necessário para execução da ' + osId + ': ' + descricaoOS : ''}</textarea>
    </div>

    <div id="rq_erro" style="display:none;color:var(--red-light);font-size:12px;background:rgba(239,68,68,0.1);padding:8px;border-radius:6px;margin-top:8px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarRequisicaoOSRapida('${osId}','${(descricaoOS||'').replace(/'/g,"\\'")}')">
      <i class="fas fa-paper-plane"></i> Criar Requisição
    </button>
  `);
}

function addItemRQ() {
  const body = document.getElementById('rq_itens_body');
  if (!body) return;
  const row = document.createElement('tr');
  row.innerHTML = `
    <td style="padding:4px"><input type="text" placeholder="Descrição do item" class="form-control rq-item-desc" style="font-size:12px"></td>
    <td style="padding:4px"><input type="number" value="1" min="0.01" step="0.01" class="form-control rq-item-qtd" style="font-size:12px;text-align:center" oninput="calcTotalRQ(this)"></td>
    <td style="padding:4px"><input type="text" value="Un" class="form-control rq-item-un" style="font-size:12px;text-align:center"></td>
    <td style="padding:4px"><input type="number" value="0" min="0" step="0.01" class="form-control rq-item-val" placeholder="0,00" style="font-size:12px;text-align:right" oninput="calcTotalRQ(this)"></td>
    <td style="padding:4px;text-align:center"><button onclick="this.closest('tr').remove();calcTotalRQGlobal()" class="btn btn-sm btn-danger"><i class="fas fa-trash"></i></button></td>
  `;
  body.appendChild(row);
}

function calcTotalRQ(input) {
  calcTotalRQGlobal();
}

function calcTotalRQGlobal() {
  let total = 0;
  document.querySelectorAll('#rq_itens_body tr').forEach(row => {
    const qtd = parseFloat(row.querySelector('.rq-item-qtd')?.value || 0);
    const val = parseFloat(row.querySelector('.rq-item-val')?.value || 0);
    total += qtd * val;
  });
  const el = document.getElementById('rq_total_val');
  if (el) el.textContent = fmt(total);
}

function salvarRequisicaoOSRapida(osId, descricaoOS) {
  const erroEl = document.getElementById('rq_erro');
  const itens = [];
  let total = 0;
  let valido = true;

  document.querySelectorAll('#rq_itens_body tr').forEach(row => {
    const d = row.querySelector('.rq-item-desc')?.value?.trim();
    const q = parseFloat(row.querySelector('.rq-item-qtd')?.value || 0);
    const u = row.querySelector('.rq-item-un')?.value || 'Un';
    const v = parseFloat(row.querySelector('.rq-item-val')?.value || 0);
    if (!d) valido = false;
    if (d) {
      itens.push({ descricao: d, qtd: q, unidade: u, valor_unit: v, total: q * v });
      total += q * v;
    }
  });

  if (!itens.length) {
    erroEl.textContent = 'Adicione pelo menos um item.';
    erroEl.style.display = 'block'; return;
  }
  if (!valido) {
    erroEl.textContent = 'Preencha a descrição de todos os itens.';
    erroEl.style.display = 'block'; return;
  }

  const tipo = document.getElementById('rq_tipo').value;
  const urgencia = document.getElementById('rq_urgencia').value;
  const prazo = document.getElementById('rq_prazo').value;
  const obs = document.getElementById('rq_obs').value.trim();
  const fornecedor = document.getElementById('rq_fornecedor').value.trim();

  // Busca os dados da OS para obter o contrato
  const osList = (typeof _getOSList === 'function') ? _getOSList() : [];
  const osData = osList.find(o => o.id === osId);

  const reqs = (typeof _getRequisicoes === 'function') ? _getRequisicoes() : [];
  const ano = new Date().getFullYear();
  const numProc = `PROC-${ano}-${String(reqs.length + 1).padStart(4,'0')}`;

  const novaReq = {
    id: gerarId('REQ'),
    titulo: `[${tipo}] para OS ${osId} – ${descricaoOS.substring(0,50)}`,
    contrato: osData ? osData.contrato : '',
    solicitante: currentUser ? currentUser.name : '—',
    departamento: 'Operações',
    data_abertura: new Date().toLocaleDateString('pt-BR'),
    prazo_necessidade: prazo ? new Date(prazo + 'T12:00:00').toLocaleDateString('pt-BR') : '—',
    status: 'Pendente Supervisor',
    urgencia,
    valor_estimado: total,
    numero_processo: numProc,
    origem_os: osId,
    fornecedor_sugerido: fornecedor,
    aprovacao_supervisor: { nome: '', data: '', status: 'Pendente' },
    aprovacao_gestor: { nome: '', data: '', status: 'Pendente' },
    itens,
    observacoes: obs
  };

  if (typeof _saveRequisicoes === 'function') {
    reqs.unshift(novaReq);
    _saveRequisicoes(reqs);

    // Atualiza badge
    const badge = document.getElementById('badge-reqs');
    if (badge) badge.textContent = reqs.filter(r => r.status && r.status.includes('Pendente')).length;
  }

  logAction('Criar RC', 'Requisições', `RC ${numProc} criada para OS ${osId} – ${itens.length} item(ns) – ${fmt(total)}`);
  closeModal();
  showToast(`✅ Requisição ${numProc} criada! Valor: ${fmt(total)}. Aguarda aprovação do Supervisor.`, 'success', 7000);
}

// ─── 6. ALÇADAS DE APROVAÇÃO PARA PEDIDOS ────────────────────────────────────
// Exibe a lógica de alçadas conforme valor
function getAlcadaInfo(valor) {
  if (valor <= 5000) return { nivel: 'Supervisor', cor: 'var(--blue-light)', icon: 'user-check', desc: 'Aprovação pelo Supervisor de Campo' };
  if (valor <= 20000) return { nivel: 'Gestor de Operações', cor: 'var(--orange)', icon: 'user-tie', desc: 'Aprovação pelo Gestor de Operações' };
  if (valor <= 100000) return { nivel: 'Diretoria', cor: 'var(--purple)', icon: 'building', desc: 'Aprovação pela Diretoria' };
  return { nivel: 'Diretoria + Financeiro', cor: 'var(--red-light)', icon: 'shield-alt', desc: 'Aprovação pela Diretoria e Financeiro' };
}

function renderAlcadaBadge(valor) {
  const alcada = getAlcadaInfo(valor || 0);
  return `<span class="badge" style="background:rgba(0,0,0,0.2);color:${alcada.cor};border:1px solid ${alcada.cor};font-size:10px">
    <i class="fas fa-${alcada.icon}" style="margin-right:3px"></i>${alcada.nivel}
  </span>`;
}

// ─── 7. DASHBOARD KPIs DINÂMICOS ─────────────────────────────────────────────
// Calcula KPIs reais dos dados em localStorage + dados base
function calcularKPIsReais() {
  const osList = (typeof _getOSList === 'function') ? _getOSList() : ERP_DATA.ordens || [];
  const medicoes = (() => { try { const r = localStorage.getItem('fa_medicoes'); return r ? JSON.parse(r) : ERP_DATA.medicoes; } catch(e) { return ERP_DATA.medicoes; }})();
  const reqs = (() => { try { const r = localStorage.getItem('fa_requisicoes'); return r ? JSON.parse(r) : []; } catch(e) { return []; }})();
  const pedidos = (() => { try { const r = localStorage.getItem('fa_pedidos'); return r ? JSON.parse(r) : []; } catch(e) { return []; }})();

  return {
    os: {
      total: osList.length,
      andamento: osList.filter(o => o.status === 'Em Andamento').length,
      criticas: osList.filter(o => o.prioridade === 'Crítica').length,
      concluidas: osList.filter(o => o.status === 'Concluída').length,
      aguardandoPeca: osList.filter(o => o.status === 'Aguardando Peça').length,
    },
    financeiro: {
      medicoesTotal: medicoes.reduce((a, m) => a + (m.valorLiquido || 0), 0),
      medicoesPendentes: medicoes.filter(m => ['Rascunho','Em Análise'].includes(m.status)).length,
    },
    suprimentos: {
      reqsPendentes: reqs.filter(r => r.status && r.status.includes('Pendente')).length,
      pedidosAbertos: pedidos.filter(p => p.status && ['Aguardando Aprovação','Aprovado','Em Transito'].includes(p.status)).length,
    }
  };
}

// ─── 8. EXPORTAÇÃO PDF DE OS ──────────────────────────────────────────────────
// Gera PDF visual da OS usando print do browser
function imprimirOS(osId) {
  const os = (typeof _getOSList === 'function') ? _getOSList().find(o => o.id === osId) : null;
  if (!os) { showToast('OS não encontrada.', 'error'); return; }

  const aponts = (typeof _getApontamentosOS === 'function') ? _getApontamentosOS(osId) : [];
  const checklist = (typeof _getChecklistOS === 'function') ? _getChecklistOS(osId) : [];
  const totalHH = aponts.reduce((a, x) => a + (x.horas || 0), 0);

  const conteudo = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>OS ${os.id} – Fraser Alexander</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #222; margin: 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #00b4b8; padding-bottom: 12px; margin-bottom: 16px; }
    .title { font-size: 18px; font-weight: 700; color: #00b4b8; }
    .subtitle { font-size: 11px; color: #555; }
    .section { margin-bottom: 16px; }
    .section-title { font-size: 13px; font-weight: 700; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
    .field { margin-bottom: 6px; }
    .label { font-size: 10px; text-transform: uppercase; color: #777; font-weight: 700; }
    .value { font-size: 12px; color: #222; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f5f5f5; padding: 6px 8px; text-align: left; border: 1px solid #ddd; }
    td { padding: 5px 8px; border: 1px solid #eee; }
    .badge-status { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
    .checklist-item { display: flex; gap: 8px; align-items: center; padding: 4px 0; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .signature-line { border-bottom: 1px solid #333; margin-top: 24px; }
    .signature-label { font-size: 10px; color: #777; text-align: center; margin-top: 4px; }
    @media print { body { margin: 10px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">🔧 Ordem de Serviço – ${os.id}</div>
      <div class="subtitle">Fraser Alexander – Sistema de Gestão Integrado</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:10px;color:#777">Emitido em: ${new Date().toLocaleDateString('pt-BR')}</div>
      <div style="font-size:10px;color:#777">Por: ${currentUser ? currentUser.name : '—'}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Dados da Ordem de Serviço</div>
    <div class="grid2">
      <div class="field"><div class="label">Número da OS</div><div class="value" style="color:#00b4b8;font-weight:700">${os.id}</div></div>
      <div class="field"><div class="label">Status</div><div class="value">${os.status}</div></div>
      <div class="field"><div class="label">Contrato</div><div class="value">${os.contrato || '—'}</div></div>
      <div class="field"><div class="label">Cliente</div><div class="value">${os.cliente || '—'}</div></div>
      <div class="field"><div class="label">Tipo</div><div class="value">${os.tipo || '—'}</div></div>
      <div class="field"><div class="label">Prioridade</div><div class="value">${os.prioridade || '—'}</div></div>
      <div class="field"><div class="label">Responsável</div><div class="value">${os.responsavel || '—'}</div></div>
      <div class="field"><div class="label">Equipe</div><div class="value">${os.equipe || 0} colaboradores</div></div>
      <div class="field"><div class="label">Abertura</div><div class="value">${os.abertura || '—'}</div></div>
      <div class="field"><div class="label">Prazo</div><div class="value">${os.prazo || '—'}</div></div>
      <div class="field"><div class="label">Horas Previstas</div><div class="value">${os.horas || 0}h</div></div>
      <div class="field"><div class="label">HH Apontadas</div><div class="value" style="color:#22c55e;font-weight:700">${totalHH}h</div></div>
      <div class="field"><div class="label">Local / Área</div><div class="value">${os.local || '—'}</div></div>
      <div class="field"><div class="label">Progresso</div><div class="value">${os.progress || 0}%</div></div>
    </div>
    ${os.descricao ? `<div class="field" style="margin-top:8px"><div class="label">Descrição Completa</div><div class="value">${os.descricao}</div></div>` : ''}
    ${os.observacoes ? `<div class="field"><div class="label">Observações</div><div class="value">${os.observacoes}</div></div>` : ''}
  </div>

  ${checklist.length ? `
  <div class="section">
    <div class="section-title">Checklist de Execução (${checklist.filter(c=>c.ok).length}/${checklist.length} concluídos)</div>
    ${checklist.map((item, i) => `
      <div class="checklist-item">
        <span style="font-size:14px">${item.ok ? '☑' : '☐'}</span>
        <span style="text-decoration:${item.ok ? 'line-through' : 'none'};color:${item.ok ? '#888' : '#222'}">${i+1}. ${item.texto}</span>
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${aponts.length ? `
  <div class="section">
    <div class="section-title">Apontamentos de Horas</div>
    <table>
      <thead><tr><th>Data</th><th>Colaborador</th><th>Horas</th><th>Atividade Realizada</th></tr></thead>
      <tbody>
        ${aponts.map(a => `<tr><td>${a.data}</td><td>${a.colaborador}</td><td style="font-weight:700;color:#22c55e">${a.horas}h</td><td>${a.atividade || '—'}</td></tr>`).join('')}
        <tr style="font-weight:700;background:#f9f9f9"><td colspan="2">TOTAL</td><td style="color:#00b4b8">${totalHH}h</td><td></td></tr>
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="footer">
    <div>
      <div class="signature-line"></div>
      <div class="signature-label">Responsável pela Execução</div>
      <div style="font-size:10px;color:#777;text-align:center;margin-top:4px">${os.responsavel || '___________________________'}</div>
    </div>
    <div>
      <div class="signature-line"></div>
      <div class="signature-label">Aprovado por / Visto Supervisor</div>
    </div>
  </div>
</body>
</html>
  `;

  const janela = window.open('', '_blank', 'width=800,height=600');
  janela.document.write(conteudo);
  janela.document.close();
  setTimeout(() => janela.print(), 500);
  logAction('Impressão OS', 'Ordens de Serviço', `OS ${osId} impressa/exportada em PDF`);
}

// ─── 9. FUNÇÕES DE AÇÃO NA SIDEBAR E EXTRAS ──────────────────────────────────
// Atualiza badges do menu lateral com dados reais
function atualizarBadgesSidebar() {
  try {
    const osList = (typeof _getOSList === 'function') ? _getOSList() : (ERP_DATA.ordens || []);
    const reqs = (() => { try { const r = localStorage.getItem('fa_requisicoes'); return r ? JSON.parse(r) : []; } catch(e) { return []; }})();
    const pedidos = (() => { try { const r = localStorage.getItem('fa_pedidos'); return r ? JSON.parse(r) : []; } catch(e) { return []; }})();

    const badgeOS = document.getElementById('badge-os');
    if (badgeOS) {
      const osAtivas = osList.filter(o => o.status === 'Em Andamento' || o.status === 'Aguardando Peça').length;
      badgeOS.textContent = osAtivas || '';
      badgeOS.style.display = osAtivas ? '' : 'none';
    }

    const badgeReqs = document.getElementById('badge-reqs');
    if (badgeReqs) {
      const reqsPend = reqs.filter(r => r.status && r.status.includes('Pendente')).length;
      badgeReqs.textContent = reqsPend || '';
      badgeReqs.style.display = reqsPend ? '' : 'none';
    }

    const badgePedidos = document.getElementById('badge-pedidos');
    if (badgePedidos) {
      const pedAbertos = pedidos.filter(p => p.status === 'Aguardando Aprovação').length;
      badgePedidos.textContent = pedAbertos || '';
      badgePedidos.style.display = pedAbertos ? '' : 'none';
    }
  } catch(e) {}
}

// Inicia atualização de badges após login
// (variáveis em escopo de bloco para evitar redeclaração global)
var _origLoginAs = typeof loginAs === 'function' ? loginAs : null;
// Chama atualizarBadgesSidebar após navegação
var _origNavigate = typeof navigate === 'function' ? navigate : null;

// ─── 10. FUNÇÃO ABRIRACAO MATERIAL OS (compatibilidade) ───────────────────────
function abrirAcaoMaterialOS(osId, descricaoOS) {
  // Esta função exibe opções para a OS que precisa de material
  openModal(`Ação de Material / Compra – ${osId}`, `
    <div style="text-align:center;padding:8px 0 20px">
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">${descricaoOS}</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <button class="btn btn-primary" onclick="closeModal();criarRequisicaoRapida('${osId}','${(descricaoOS||'').replace(/'/g,"\\'")}')" style="padding:12px">
          <i class="fas fa-file-alt" style="margin-right:8px"></i> Criar Requisição de Compra (RC)
          <div style="font-size:11px;opacity:0.8;margin-top:2px">Inicia o fluxo RC → RFQ → Mapa → Pedido</div>
        </button>
        <button class="btn btn-secondary" onclick="closeModal();navigate('requisicoes')" style="padding:12px">
          <i class="fas fa-list-alt" style="margin-right:8px"></i> Ver Todas as Requisições
        </button>
        <button class="btn btn-warning" onclick="closeModal();imprimirOS('${osId}')" style="padding:12px">
          <i class="fas fa-file-pdf" style="margin-right:8px"></i> Imprimir / Exportar PDF da OS
        </button>
        <button class="btn btn-success" onclick="closeModal();apontarHorasOS('${osId}')" style="padding:12px">
          <i class="fas fa-clock" style="margin-right:8px"></i> Registrar Horas Trabalhadas
        </button>
      </div>
    </div>
  `, '');
}

// ─── 11. INICIALIZAÇÃO ────────────────────────────────────────────────────────
// Aguarda DOM pronto e configura melhorias
document.addEventListener('DOMContentLoaded', function() {
  // Substitui o renderAdminBackup padrão pelo melhorado
  if (typeof window !== 'undefined') {
    window.renderAdminBackup = renderAdminBackupMelhorado;
  }
});

// Override da função de backup após scripts carregarem
if (typeof renderAdminBackup === 'undefined') {
  window.renderAdminBackup = renderAdminBackupMelhorado;
}

// ─── 12. BUSCA RÁPIDA NO TOPBAR (Ctrl+K) ────────────────────────────────────
function _toggleTopbarSearch() {
  const inp = document.getElementById('topbar_quick_search');
  const btn = document.getElementById('topbar_search_btn');
  if (!inp) return;
  const expanded = inp.style.maxWidth === '220px';
  if (expanded) {
    _closeTopbarSearch();
  } else {
    inp.style.maxWidth = '220px';
    inp.style.width = '220px';
    inp.style.padding = '6px 32px 6px 10px';
    inp.style.border = '1px solid var(--border-color)';
    inp.style.background = 'var(--bg-tertiary)';
    inp.style.borderRadius = '8px';
    inp.style.opacity = '1';
    inp.focus();
  }
}

function _closeTopbarSearch() {
  const inp = document.getElementById('topbar_quick_search');
  if (!inp) return;
  inp.style.maxWidth = '0';
  inp.style.width = '0';
  inp.style.padding = '6px 0';
  inp.style.border = 'none';
  inp.style.background = 'transparent';
  inp.style.opacity = '0';
  inp.value = '';
}

// Atalho de teclado Ctrl+K
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    const inp = document.getElementById('topbar_quick_search');
    if (inp) {
      _toggleTopbarSearch();
    }
  }
  // Esc fecha busca
  if (e.key === 'Escape') {
    _closeTopbarSearch();
  }
});

// ─── 13. ANIMAÇÕES DE ENTRADA DE PÁGINA ─────────────────────────────────────
// Adiciona animação suave ao trocar de módulo
(function() {
  const origNavigate = window.navigate;
  if (origNavigate) {
    window.navigate = function(page) {
      const mc = document.getElementById('main-content');
      if (mc) {
        mc.style.transition = 'opacity .15s ease, transform .15s ease';
        mc.style.opacity = '0';
        mc.style.transform = 'translateY(4px)';
        setTimeout(() => {
          origNavigate(page);
          mc.style.opacity = '1';
          mc.style.transform = 'translateY(0)';
        }, 120);
      } else {
        origNavigate(page);
      }
    };
  }
})();

// ─── 14. TOOLTIPS AUTOMÁTICOS ───────────────────────────────────────────────
// Delegação de evento para tooltips em elementos com [data-tooltip]
document.addEventListener('mouseover', function(e) {
  const el = e.target.closest('[data-tooltip]');
  if (!el) return;
  const tip = el.getAttribute('data-tooltip');
  if (!tip) return;
  let tooltip = document.getElementById('_fa_tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = '_fa_tooltip';
    tooltip.style.cssText = 'position:fixed;z-index:99999;background:#1e293b;color:#fff;font-size:11px;padding:5px 10px;border-radius:6px;pointer-events:none;white-space:nowrap;opacity:0;transition:opacity .15s;max-width:200px;white-space:normal;line-height:1.4';
    document.body.appendChild(tooltip);
  }
  tooltip.textContent = tip;
  const rect = el.getBoundingClientRect();
  tooltip.style.left = rect.left + 'px';
  tooltip.style.top = (rect.bottom + 6) + 'px';
  tooltip.style.opacity = '1';
});
document.addEventListener('mouseout', function(e) {
  const tooltip = document.getElementById('_fa_tooltip');
  if (tooltip) tooltip.style.opacity = '0';
});

// ─── 15. INDICADOR DE LOADING GLOBAL ────────────────────────────────────────
window._showLoading = function(msg) {
  let el = document.getElementById('_fa_loading_bar');
  if (!el) {
    el = document.createElement('div');
    el.id = '_fa_loading_bar';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#4f46e5,#7c3aed,#4f46e5);background-size:200% 100%;animation:_fa_loading_anim 1.2s linear infinite;z-index:99999;transition:opacity .3s';
    document.body.appendChild(el);
    const style = document.createElement('style');
    style.textContent = '@keyframes _fa_loading_anim{0%{background-position:200% 0}100%{background-position:0 0}}';
    document.head.appendChild(style);
  }
  el.style.opacity = '1';
};
window._hideLoading = function() {
  const el = document.getElementById('_fa_loading_bar');
  if (el) el.style.opacity = '0';
};

// ─── 16. MELHORIAS VISUAIS NOS CARDS ────────────────────────────────────────
// Aplica ripple effect em botões ao clicar
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  const circle = document.createElement('span');
  const diameter = Math.max(btn.clientWidth, btn.clientHeight);
  const radius = diameter / 2;
  const rect = btn.getBoundingClientRect();
  circle.style.cssText = `
    position:absolute;
    width:${diameter}px;height:${diameter}px;
    border-radius:50%;
    background:rgba(255,255,255,0.3);
    top:${e.clientY - rect.top - radius}px;
    left:${e.clientX - rect.left - radius}px;
    animation:_ripple .5s linear;
    pointer-events:none;
  `;
  if (!document.getElementById('_ripple_style')) {
    const s = document.createElement('style');
    s.id = '_ripple_style';
    s.textContent = '@keyframes _ripple{0%{transform:scale(0);opacity:1}100%{transform:scale(2.5);opacity:0}}';
    document.head.appendChild(s);
  }
  const pos = getComputedStyle(btn).position;
  if (pos === 'static') btn.style.position = 'relative';
  btn.style.overflow = 'hidden';
  btn.appendChild(circle);
  setTimeout(() => circle.remove(), 500);
});
