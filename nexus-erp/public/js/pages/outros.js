// =====================================================
// ERP Serviços e Operações — Outros módulos (Frota, Ativos, Perfil)
// =====================================================

function renderFrota() {
  const main = document.getElementById('mainContent');

  const operacionais = ERP_DATA.equipamentos.filter(e => e.status === 'Operacional').length;
  const emMaint = ERP_DATA.equipamentos.filter(e => e.status === 'Em Manutenção').length;

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2>Frota e Equipamentos</h2>
        <p>${ERP_DATA.equipamentos.length} ativos cadastrados · ${operacionais} operacionais</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary btn-sm" onclick="showToast('Abrindo cadastro de equipamento...','info')">
          <i class="fas fa-plus"></i> Novo Equipamento
        </button>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr)">
      <div class="kpi-card kpi-blue"><div class="kpi-icon"><i class="fas fa-truck"></i></div><div class="kpi-value">${ERP_DATA.equipamentos.length}</div><div class="kpi-label">Total de Ativos</div></div>
      <div class="kpi-card kpi-green"><div class="kpi-icon"><i class="fas fa-check-circle"></i></div><div class="kpi-value">${operacionais}</div><div class="kpi-label">Operacionais</div></div>
      <div class="kpi-card kpi-yellow"><div class="kpi-icon"><i class="fas fa-wrench"></i></div><div class="kpi-value">${emMaint}</div><div class="kpi-label">Em Manutenção</div></div>
      <div class="kpi-card kpi-orange"><div class="kpi-icon"><i class="fas fa-calendar-check"></i></div><div class="kpi-value">3</div><div class="kpi-label">Maint. Agendadas Abr/25</div></div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3><i class="fas fa-truck" style="color:var(--orange);margin-right:8px"></i>Equipamentos Cadastrados</h3>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr><th>ID</th><th>Descrição</th><th>Placa / Serial</th><th>Contrato</th><th>Próx. Manutenção</th><th>Status</th><th>Ações</th></tr>
          </thead>
          <tbody>
            ${ERP_DATA.equipamentos.map(e => `
              <tr>
                <td style="color:var(--orange);font-weight:600;font-size:12px">${e.id}</td>
                <td style="font-weight:500">${e.descricao}</td>
                <td style="font-size:12px;color:var(--text-secondary)">${e.placa}</td>
                <td style="font-size:11px;color:var(--text-muted)">${e.contrato}</td>
                <td style="font-size:12px;color:${e.status === 'Em Manutenção' ? 'var(--yellow-light)' : 'var(--text-secondary)'}">${e.proxMaint}</td>
                <td>${statusBadge(e.status)}</td>
                <td>
                  <div class="actions-cell">
                    <button class="btn btn-secondary btn-sm btn-icon" onclick="showToast('Abrindo histórico de ${e.id}...','info')">
                      <i class="fas fa-history"></i>
                    </button>
                    <button class="btn btn-info btn-sm btn-icon" onclick="showToast('Abrindo OS de manutenção...','info')">
                      <i class="fas fa-wrench"></i>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Gráfico manutenção -->
    <div class="grid-2 page-section">
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-chart-bar" style="color:var(--orange);margin-right:8px"></i>Custo de Manutenção por Mês</h3></div>
        <div class="card-body"><div style="height:200px"><canvas id="chartFrota"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-tachometer-alt" style="color:var(--blue-light);margin-right:8px"></i>Disponibilidade da Frota</h3></div>
        <div class="card-body">
          <div style="text-align:center;padding:20px 0">
            <div style="font-size:48px;font-weight:700;color:var(--green-light)">87%</div>
            <div style="font-size:14px;color:var(--text-secondary);margin-top:4px">Disponibilidade Média</div>
            <div class="progress" style="height:12px;margin-top:16px;max-width:200px;margin-left:auto;margin-right:auto">
              <div class="progress-bar green" style="width:87%"></div>
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:8px">Meta: 90% | Atual: 87%</div>
          </div>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    const ctx = document.getElementById('chartFrota');
    if (!ctx) return;
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Out/24','Nov/24','Dez/24','Jan/25','Fev/25','Mar/25'],
        datasets: [{
          label: 'Custo Manutenção',
          data: [28000, 32000, 19000, 35000, 28000, 24000],
          borderColor: '#e67e22', backgroundColor: 'rgba(230,126,34,0.1)',
          fill: true, tension: 0.4, borderWidth: 2,
          pointBackgroundColor: '#e67e22', pointRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#6e7681', font: { size: 10 } }, grid: { color: '#21262d' } },
          y: { ticks: { color: '#6e7681', font: { size: 10 }, callback: v => 'R$' + (v/1000).toFixed(0) + 'K' }, grid: { color: '#21262d' } }
        }
      }
    });
  }, 50);
}

// --- ESTOQUE ---
function renderEstoque() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2>Almoxarifado e Estoque</h2>
        <p>Controle de materiais, peças e insumos por contrato</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="showToast('Gerando inventário...','info')">
          <i class="fas fa-clipboard-check"></i> Inventário
        </button>
        <button class="btn btn-primary btn-sm" onclick="showToast('Abrindo entrada de material...','info')">
          <i class="fas fa-plus"></i> Entrada
        </button>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr)">
      <div class="kpi-card kpi-blue"><div class="kpi-icon"><i class="fas fa-boxes"></i></div><div class="kpi-value">248</div><div class="kpi-label">Itens Cadastrados</div></div>
      <div class="kpi-card kpi-red"><div class="kpi-icon"><i class="fas fa-exclamation-triangle"></i></div><div class="kpi-value">12</div><div class="kpi-label">Abaixo do Mínimo</div></div>
      <div class="kpi-card kpi-orange"><div class="kpi-icon"><i class="fas fa-dollar-sign"></i></div><div class="kpi-value">R$ 184K</div><div class="kpi-label">Valor em Estoque</div></div>
      <div class="kpi-card kpi-yellow"><div class="kpi-icon"><i class="fas fa-truck-loading"></i></div><div class="kpi-value">5</div><div class="kpi-label">Pedidos a Receber</div></div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3><i class="fas fa-list" style="color:var(--orange);margin-right:8px"></i>Itens em Estoque (Resumo)</h3>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr><th>Código</th><th>Descrição</th><th>Categoria</th><th>Qtd Atual</th><th>Qtd Mínima</th><th>Un</th><th>Contrato</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted)"><i class="fas fa-inbox" style="margin-right:6px"></i>Nenhum item cadastrado. Registre materiais pelo módulo de Suprimentos.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// --- PERFIL ---
function renderPerfil() {
  const main = document.getElementById('mainContent');
  const u = currentUser;
  if (!u) { main.innerHTML = ''; return; }

  // Busca dados atualizados do usuário no FA_USUARIOS (se disponível)
  let userData = u;
  if (typeof FA_USUARIOS !== 'undefined') {
    const found = FA_USUARIOS.find(x => x.email.toLowerCase() === (u.email || '').toLowerCase());
    if (found) userData = { ...u, departamento: found.departamento, ultimo_acesso: found.ultimo_acesso, mfa_ativo: found.mfa_ativo };
  }

  // Permissões do usuário
  const permsDisplay = typeof getPermissoesPerfilForDisplay === 'function'
    ? getPermissoesPerfilForDisplay(u.profile)
    : [];

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-user-circle" style="color:var(--orange);margin-right:8px"></i>Meu Perfil</h2>
        <p>Configurações da sua conta e preferências</p>
      </div>
    </div>

    <div class="grid-2">
      <!-- Card de dados -->
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-id-card" style="color:var(--orange);margin-right:8px"></i>Dados da Conta</h3></div>
        <div class="card-body">
          <div style="text-align:center;padding:20px 0 16px">
            <div style="width:80px;height:80px;background:linear-gradient(135deg,var(--blue),var(--cyan));border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:white;margin:0 auto 14px">
              ${u.avatar || u.name.split(' ').map(n=>n[0]).slice(0,2).join('')}
            </div>
            <div style="font-size:20px;font-weight:700">${u.name}</div>
            <div style="font-size:13px;color:var(--orange);margin-top:3px">${u.role}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px"><i class="fas fa-envelope" style="margin-right:4px"></i>${u.email}</div>
            <div style="margin-top:10px;display:flex;gap:6px;justify-content:center">
              ${statusBadge('Ativo')}
              ${statusBadge(u.profile)}
            </div>
          </div>
          <div class="stat-row"><span class="stat-label">Departamento</span><span class="stat-value">${userData.departamento || '—'}</span></div>
          <div class="stat-row"><span class="stat-label">Empresa</span><span class="stat-value">Fraser Alexander</span></div>
          <div class="stat-row"><span class="stat-label">Último acesso</span><span class="stat-value">${userData.ultimo_acesso || 'Agora'}</span></div>

          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary" style="flex:1" onclick="editarMeuPerfil()">
              <i class="fas fa-edit"></i> Editar Dados
            </button>
            <button class="btn btn-secondary" style="flex:1" onclick="alterarMinhaSenha()">
              <i class="fas fa-key"></i> Alterar Senha
            </button>
          </div>
        </div>
      </div>

      <!-- Card de permissões e segurança -->
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-shield-alt" style="color:var(--blue-light);margin-right:8px"></i>Segurança e Permissões</h3></div>
        <div class="card-body">
          <div class="${userData.mfa_ativo ? 'alert alert-success' : 'alert alert-warning'}">
            <span class="alert-icon"><i class="fas fa-${userData.mfa_ativo ? 'check-circle' : 'exclamation-triangle'}"></i></span>
            <div>
              <div class="alert-title">${userData.mfa_ativo ? 'MFA Ativo' : 'MFA Inativo'}</div>
              <div class="alert-desc">${userData.mfa_ativo ? 'Autenticação multifator habilitada' : 'Recomendamos ativar o MFA para maior segurança'}</div>
            </div>
          </div>

          <div class="section-divider" style="margin-top:12px"><h4>Módulos com Acesso</h4></div>
          <div style="max-height:280px;overflow-y:auto">
            ${permsDisplay.map(p => `
              <div class="stat-row" style="padding:6px 0">
                <span class="stat-label" style="display:flex;align-items:center;gap:6px">
                  <i class="fas fa-${p.icon}" style="color:var(--text-muted);width:14px"></i>${p.modulo}
                </span>
                <span class="badge ${p.acesso === 'Total' ? 'badge-success' : p.acesso === 'Operacional' ? 'badge-info' : p.acesso === 'Edição' ? 'badge-orange' : 'badge-muted'}">${p.acesso}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- Histórico de atividades recentes -->
    <div class="card page-section">
      <div class="card-header">
        <h3><i class="fas fa-history" style="color:var(--fa-teal);margin-right:8px"></i>Atividades Recentes</h3>
      </div>
      <div class="card-body">
        ${(typeof SYSTEM_LOGS !== 'undefined' ? SYSTEM_LOGS.filter(l => l.usuario === u.name).slice(0, 10) : []).map(l => `
          <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
            <div style="width:32px;height:32px;border-radius:50%;background:rgba(0,180,184,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <i class="fas fa-circle" style="color:var(--fa-teal);font-size:8px"></i>
            </div>
            <div style="flex:1">
              <div style="font-size:12px;font-weight:500">${l.acao} – ${l.modulo}</div>
              <div style="font-size:11px;color:var(--text-muted)">${l.descricao}</div>
            </div>
            <div style="font-size:11px;color:var(--text-muted);white-space:nowrap">${l.data_hora}</div>
          </div>
        `).join('') || '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Nenhuma atividade registrada nesta sessão.</div>'}
      </div>
    </div>
  `;
}

function editarMeuPerfil() {
  const u = currentUser;
  openModal('Editar Meu Perfil', `
    <div class="form-group">
      <label>Nome Completo</label>
      <input class="form-control" id="ep_nome" type="text" value="${u.name}">
    </div>
    <div class="form-group">
      <label>E-mail (não editável)</label>
      <input class="form-control" type="text" value="${u.email}" readonly style="opacity:0.6">
    </div>
    <div class="form-group">
      <label>Cargo / Função</label>
      <input class="form-control" id="ep_cargo" type="text" value="${u.role}">
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarMeuPerfil()"><i class="fas fa-save"></i> Salvar</button>
  `);
}

function salvarMeuPerfil() {
  const nome = document.getElementById('ep_nome').value.trim();
  const cargo = document.getElementById('ep_cargo').value.trim();
  if (!nome) { showToast('Informe seu nome', 'warning'); return; }
  currentUser.name = nome;
  currentUser.role = cargo;

  // Atualiza sidebar
  const el = document.getElementById('userName');
  const elRole = document.getElementById('userRole');
  if (el) el.textContent = nome;
  if (elRole) elRole.textContent = cargo;

  logAction('Edição Perfil', 'Perfil', `Perfil atualizado: ${nome}`);
  closeModal();
  showToast('Perfil atualizado com sucesso!', 'success');
  renderPerfil();
}

function alterarMinhaSenha() {
  const emailKey = (currentUser.email || '').toLowerCase();
  openModal('Alterar Senha', `
    <div class="form-group">
      <label>Senha Atual</label>
      <input class="form-control" id="ps_atual" type="password" placeholder="Informe sua senha atual">
    </div>
    <div class="form-group">
      <label>Nova Senha</label>
      <input class="form-control" id="ps_nova" type="password" placeholder="Mínimo 8 caracteres">
    </div>
    <div class="form-group">
      <label>Confirmar Nova Senha</label>
      <input class="form-control" id="ps_conf" type="password" placeholder="Repita a nova senha">
    </div>
    <div id="ps_erro" style="display:none;color:var(--red-light);font-size:12px;margin-top:8px;padding:8px;border-radius:6px;background:rgba(239,68,68,0.1)"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="confirmarAlteracaoSenha('${emailKey}')"><i class="fas fa-key"></i> Alterar Senha</button>
  `);
}

function confirmarAlteracaoSenha(emailKey) {
  const senhaAtual = document.getElementById('ps_atual').value;
  const novaSenha = document.getElementById('ps_nova').value;
  const conf = document.getElementById('ps_conf').value;
  const erroEl = document.getElementById('ps_erro');
  const mostrarErro = (m) => { erroEl.textContent = m; erroEl.style.display = 'block'; };

  if (!senhaAtual) { mostrarErro('Informe sua senha atual.'); return; }
  if (!novaSenha || novaSenha.length < 8) { mostrarErro('A nova senha deve ter pelo menos 8 caracteres.'); return; }
  if (novaSenha !== conf) { mostrarErro('As senhas não coincidem.'); return; }

  if (typeof _getCredenciais === 'function') {
    const creds = _getCredenciais();
    const userCred = creds[emailKey];
    if (!userCred) { mostrarErro('Usuário não encontrado.'); return; }
    if (_hashSimples(senhaAtual) !== userCred.senhaHash) { mostrarErro('Senha atual incorreta.'); return; }
    creds[emailKey].senhaHash = _hashSimples(novaSenha);
    creds[emailKey].primeiroAcesso = false;
    _saveCredenciais(creds);
  }

  logAction('Alteração Senha', 'Perfil', `Senha alterada pelo usuário`);
  closeModal();
  showToast('Senha alterada com sucesso!', 'success');
}
