// =====================================================
// ERP Serviços e Operações — Módulo Financeiro e Faturamento
// =====================================================

function renderFinanceiro() {
  if (!hasPermission('financeiro', 'view')) { renderAcessoNegado(); return; }
  const main = document.getElementById('mainContent');

  const totalReceber = ERP_DATA.faturas.filter(f => f.status !== 'Paga').reduce((a,b) => a + b.liquido, 0);
  const totalPago = ERP_DATA.faturas.filter(f => f.status === 'Paga').reduce((a,b) => a + b.liquido, 0);
  const emAtraso = ERP_DATA.faturas.filter(f => f.status === 'Atrasada').reduce((a,b) => a + b.liquido, 0);
  const glosas = ERP_DATA.medicoes.reduce((a,b) => a + b.glosa, 0);

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2>Painel Financeiro</h2>
        <p>Gestão de receitas, custos e margem por contrato</p>
      </div>
      <div class="page-actions">
        ${hasPermission('financeiro','create') ? `
        <button class="btn btn-warning btn-sm" onclick="openLancamentoDespesa()">
          <i class="fas fa-plus-circle"></i> Inserir Despesa
        </button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="exportarFinanceiro()">
          <i class="fas fa-file-excel"></i> Exportar
        </button>
      </div>
    </div>

    <!-- KPIs Financeiros -->
    <div class="kpi-grid" style="grid-template-columns: repeat(5, 1fr)">
      <div class="kpi-card kpi-orange">
        <div class="kpi-icon"><i class="fas fa-file-invoice-dollar"></i></div>
        <div class="kpi-value">${fmtK(totalReceber)}</div>
        <div class="kpi-label">A Receber</div>
        <div class="kpi-delta delta-up">▲ 3 títulos em aberto</div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-icon"><i class="fas fa-check-circle"></i></div>
        <div class="kpi-value">${fmtK(totalPago)}</div>
        <div class="kpi-label">Recebido – Mar/25</div>
        <div class="kpi-delta delta-up">▲ Em dia</div>
      </div>
      <div class="kpi-card kpi-red">
        <div class="kpi-icon"><i class="fas fa-exclamation-circle"></i></div>
        <div class="kpi-value">${fmtK(emAtraso)}</div>
        <div class="kpi-label">Em Atraso</div>
        <div class="kpi-delta delta-down">▼ 1 cliente inadimplente</div>
      </div>
      <div class="kpi-card kpi-yellow">
        <div class="kpi-icon"><i class="fas fa-cut"></i></div>
        <div class="kpi-value">${fmtK(glosas)}</div>
        <div class="kpi-label">Glosas Acumuladas</div>
      </div>
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><i class="fas fa-percent"></i></div>
        <div class="kpi-value">22%</div>
        <div class="kpi-label">Margem Média</div>
        <div class="kpi-delta delta-up">▲ Acima da meta (20%)</div>
      </div>
    </div>

    <!-- Gráficos -->
    <div class="grid-2 page-section">
      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-chart-area" style="color:var(--green-light);margin-right:8px"></i>Fluxo de Caixa – 6 Meses</h3>
        </div>
        <div class="card-body">
          <div style="height:220px"><canvas id="chartFluxo"></canvas></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-chart-bar" style="color:var(--orange);margin-right:8px"></i>Margem por Contrato</h3>
        </div>
        <div class="card-body">
          <div style="height:220px"><canvas id="chartMargem"></canvas></div>
        </div>
      </div>
    </div>

    <!-- Contas a Receber -->
    <div class="card page-section">
      <div class="card-header">
        <h3><i class="fas fa-hand-holding-usd" style="color:var(--orange);margin-right:8px"></i>Contas a Receber</h3>
        <button class="btn btn-secondary btn-sm" onclick="navigate('faturamento')">Ver Faturamento</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>NF</th>
              <th>Cliente</th>
              <th>Medição</th>
              <th>Valor Bruto</th>
              <th>Imposto</th>
              <th>Valor Líquido</th>
              <th>Emissão</th>
              <th>Vencimento</th>
              <th>Dias em Atraso</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${ERP_DATA.faturas.map(f => `
              <tr>
                <td style="color:var(--orange);font-weight:600;font-size:12px">${f.id}</td>
                <td style="font-weight:500">${f.cliente}</td>
                <td style="font-size:11px;color:var(--text-muted)">${f.medicao}</td>
                <td>${fmt(f.valor)}</td>
                <td style="color:var(--text-muted);font-size:12px">${fmt(f.imposto)}</td>
                <td style="font-weight:600;color:var(--green-light)">${fmt(f.liquido)}</td>
                <td style="font-size:12px;color:var(--text-secondary)">${f.emissao}</td>
                <td style="font-size:12px;color:${f.status === 'Atrasada' ? 'var(--red-light)' : 'var(--text-secondary)'};font-weight:${f.status === 'Atrasada' ? '600' : '400'}">${f.vencimento}</td>
                <td style="text-align:center;color:${f.diasAtraso > 0 ? 'var(--red-light)' : 'var(--text-muted)'}">
                  ${f.diasAtraso > 0 ? `+${f.diasAtraso}d` : '—'}
                </td>
                <td>${statusBadge(f.status)}</td>
                <td>
                  <div class="actions-cell">
                    <button class="btn btn-secondary btn-sm btn-icon" onclick="showToast('Abrindo NF ${f.id}...','info')" title="Ver NF">
                      <i class="fas fa-eye"></i>
                    </button>
                    ${f.status === 'Atrasada' ? `
                      <button class="btn btn-warning btn-sm btn-icon" onclick="showToast('Enviando cobrança para ${f.cliente}...','warning')" title="Cobrar">
                        <i class="fas fa-bell"></i>
                      </button>
                    ` : ''}
                    ${f.status !== 'Paga' ? `
                      <button class="btn btn-success btn-sm btn-icon" onclick="showToast('Baixa de recebiveis requer o backend financeiro — acao nao persistida.','info')" title="Baixar Pgto.">
                        <i class="fas fa-check"></i>
                      </button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Custos por contrato -->
    <div class="card page-section">
      <div class="card-header">
        <h3><i class="fas fa-coins" style="color:var(--yellow-light);margin-right:8px"></i>Custo × Receita por Contrato</h3>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Contrato</th>
              <th>Cliente</th>
              <th>Receita Acum.</th>
              <th>Custo Acum.</th>
              <th>Lucro Bruto</th>
              <th>Margem</th>
              <th>Saldo Contratual</th>
            </tr>
          </thead>
          <tbody>
            ${ERP_DATA.contratos.filter(c => c.status !== 'Encerrado').map(c => `
              <tr>
                <td style="color:var(--orange);font-weight:600;font-size:12px">${c.id}</td>
                <td style="font-weight:500">${c.cliente}</td>
                <td style="color:var(--green-light);font-weight:500">${fmt(c.medidoAcum)}</td>
                <td style="color:var(--red-light)">${fmt(c.custoAcum)}</td>
                <td style="font-weight:600;color:var(--green-light)">${fmt(c.medidoAcum - c.custoAcum)}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-weight:600;color:${c.margem >= 20 ? 'var(--green-light)' : 'var(--yellow-light)'}">${c.margem}%</span>
                    <div class="progress" style="flex:1;min-width:60px">
                      <div class="progress-bar ${c.margem >= 20 ? 'green' : ''}" style="width:${Math.min(c.margem * 4, 100)}%"></div>
                    </div>
                  </div>
                </td>
                <td>${fmt(c.valor - c.medidoAcum)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  setTimeout(() => {
    renderChartFluxo();
    renderChartMargem();
  }, 50);
}

function renderChartFluxo() {
  const ctx = document.getElementById('chartFluxo');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Out/24', 'Nov/24', 'Dez/24', 'Jan/25', 'Fev/25', 'Mar/25'],
      datasets: [
        {
          label: 'Entradas',
          data: [762000, 798000, 620000, 835000, 861000, 661250],
          backgroundColor: 'rgba(34,197,94,0.55)',
          borderColor: '#22c55e', borderWidth: 1.5, borderRadius: 4
        },
        {
          label: 'Saídas',
          data: [580000, 610000, 490000, 645000, 670000, 520000],
          backgroundColor: 'rgba(239,68,68,0.45)',
          borderColor: '#ef4444', borderWidth: 1.5, borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8b949e', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#6e7681', font: { size: 10 } }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#6e7681', font: { size: 10 }, callback: v => 'R$' + (v/1000).toFixed(0) + 'K' }, grid: { color: '#21262d' } }
      }
    }
  });
}

function renderChartMargem() {
  const ctx = document.getElementById('chartMargem');
  if (!ctx) return;
  const contratos = ERP_DATA.contratos.filter(c => c.status !== 'Encerrado');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: contratos.map(c => c.cliente.split(' ')[0]),
      datasets: [{
        label: 'Margem %',
        data: contratos.map(c => c.margem),
        backgroundColor: contratos.map(c => c.margem >= 20 ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.5)'),
        borderColor: contratos.map(c => c.margem >= 20 ? '#22c55e' : '#ef4444'),
        borderWidth: 1.5, borderRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        annotation: {}
      },
      scales: {
        x: { ticks: { color: '#8b949e', font: { size: 11 } }, grid: { display: false } },
        y: { min: 0, max: 35, ticks: { color: '#6e7681', font: { size: 10 }, callback: v => v + '%' }, grid: { color: '#21262d' } }
      }
    }
  });
}

// --- FATURAMENTO ---
// Resumo do faturamento a partir das contas a receber REAIS (função pura,
// testável): pipeline por status, totais e detecção de atraso.
function _faturamentoResumo(contas) {
  const hoje = new Date().toISOString().slice(0, 10);
  const arr = Array.isArray(contas) ? contas : [];
  const isAtraso = c => c.status === 'A Receber' && c.data_vencimento && c.data_vencimento < hoje && !c.data_recebimento;
  const aFaturar = arr.filter(c => c.status === 'A Faturar');
  const aReceber = arr.filter(c => c.status === 'A Receber' && !isAtraso(c));
  const atraso = arr.filter(isAtraso);
  const recebida = arr.filter(c => c.status === 'Recebida');
  const sum = l => l.reduce((a, c) => a + (Number(c.valor) || 0), 0);
  return {
    contas: arr, isAtraso,
    pipeline: [
      { label: 'A Faturar', count: aFaturar.length, color: 'var(--yellow-light)', icon: 'fa-clock' },
      { label: 'A Receber', count: aReceber.length, color: 'var(--orange)', icon: 'fa-file-invoice' },
      { label: 'Em Atraso', count: atraso.length, color: 'var(--red-light)', icon: 'fa-triangle-exclamation' },
      { label: 'Recebida', count: recebida.length, color: 'var(--green-light)', icon: 'fa-check-circle' },
    ],
    aReceberTotal: sum(aReceber) + sum(atraso), aReceberQtd: aReceber.length + atraso.length,
    recebidoTotal: sum(recebida), recebidoQtd: recebida.length,
    atrasoTotal: sum(atraso), atrasoQtd: atraso.length,
  };
}
window._faturamentoResumo = _faturamentoResumo;

function renderFaturamento() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2>Faturamento</h2>
        <p>Contas a receber, faturamento e baixa de recebíveis</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="renderFaturamento()"><i class="fas fa-sync-alt"></i> Atualizar</button>
        <button class="btn btn-primary btn-sm" onclick="openNovaFatura()"><i class="fas fa-plus"></i> Nova cobrança</button>
      </div>
    </div>
    <div id="fatBody"><i class="fas fa-spinner fa-spin"></i> Carregando contas a receber...</div>`;
  _carregarFaturamento();
}

// Busca as contas a receber do tenant e monta pipeline + tabela + totais.
async function _carregarFaturamento() {
  const box = document.getElementById('fatBody');
  if (!box) return;
  let contas = [];
  try { contas = (typeof apiAuth === 'function' ? await apiAuth('/api/contas-receber') : []) || []; }
  catch (e) { box.innerHTML = `<div style="color:var(--red-light);font-size:13px">Não foi possível carregar: ${e.message}</div>`; return; }
  const R = _faturamentoResumo(contas);
  const esc = v => (window.NexusAPI ? NexusAPI.escapeHtml(v) : String(v ?? ''));
  const linhas = R.contas.map(c => {
    const atraso = R.isAtraso(c);
    return `
      <tr style="${atraso ? 'background:rgba(220,38,38,0.05)' : ''}">
        <td style="color:var(--orange);font-weight:700;font-size:12px">${esc(c.numero)}</td>
        <td style="font-weight:500">${esc(c.cliente || '—')}</td>
        <td style="font-size:11px;color:var(--text-muted)">${esc(c.descricao || '')}</td>
        <td style="font-weight:700">${fmt(c.valor)}</td>
        <td style="font-size:12px;color:${atraso ? 'var(--red-light)' : 'var(--text-secondary)'};font-weight:${atraso ? '700' : '400'}">${esc(c.data_vencimento || '—')}</td>
        <td>${esc(c.nota_fiscal || '—')}</td>
        <td>${statusBadge(atraso ? 'Atrasada' : c.status)}</td>
        <td><div class="actions-cell">
          ${c.status !== 'Recebida' ? `<button class="btn btn-success btn-sm btn-icon" onclick="receberFatura('${esc(String(c.id))}')" title="Dar baixa (recebido)"><i class="fas fa-check"></i></button>` : ''}
          ${!c.nota_fiscal && c.status !== 'Recebida' ? `<button class="btn btn-outline-primary btn-sm" style="font-size:11px;padding:4px 8px" onclick="emitirNfseConta('${esc(String(c.id))}')" title="Emitir NFS-e"><i class="fas fa-file-invoice"></i> Emitir NFS-e</button>` : ''}
        </div></td>
      </tr>`;
  }).join('');

  box.innerHTML = `
    <div class="card page-section"><div class="card-body">
      <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:.5px">Pipeline de Faturamento</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
        ${R.pipeline.map(s => `
          <div style="text-align:center;padding:16px 12px;background:var(--bg-card2);border:1px solid var(--border);border-radius:8px">
            <div style="font-size:24px;font-weight:700;color:${s.color}">${s.count}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${s.label}</div>
            <i class="fas ${s.icon}" style="font-size:18px;color:${s.color};opacity:.3;margin-top:6px;display:block"></i>
          </div>`).join('')}
      </div>
    </div></div>

    <div class="card"><div class="card-header">
      <h3><i class="fas fa-file-invoice-dollar" style="color:var(--orange);margin-right:8px"></i>Contas a Receber</h3>
      ${R.atrasoQtd > 0 ? `<span class="badge badge-danger">${R.atrasoQtd} em atraso</span>` : ''}
    </div>
      <div class="table-wrapper"><table>
        <thead><tr><th>Nº</th><th>Cliente</th><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>NF</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="8" style="padding:20px;text-align:center;color:var(--text-muted)">Nenhuma conta a receber ainda. Use "Nova cobrança".</td></tr>'}</tbody>
      </table></div>
    </div>

    <div class="grid-3 page-section" style="margin-top:16px">
      <div class="card"><div class="card-body">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">TOTAL A RECEBER</div>
        <div style="font-size:24px;font-weight:700;color:var(--orange)">${fmt(R.aReceberTotal)}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${R.aReceberQtd} títulos em aberto</div>
      </div></div>
      <div class="card"><div class="card-body">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">RECEBIDO</div>
        <div style="font-size:24px;font-weight:700;color:var(--green-light)">${fmt(R.recebidoTotal)}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${R.recebidoQtd} títulos liquidados</div>
      </div></div>
      <div class="card" style="${R.atrasoQtd > 0 ? 'border-color:var(--red);' : ''}"><div class="card-body">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">EM ATRASO</div>
        <div style="font-size:24px;font-weight:700;color:var(--red-light)">${fmt(R.atrasoTotal)}</div>
        <div style="font-size:12px;color:var(--red-light);margin-top:4px">${R.atrasoQtd} títulos em atraso</div>
      </div></div>
    </div>`;
}

// Baixa o recebível de verdade (POST /:id/receber) e recarrega.
async function receberFatura(id) {
  if (!window.NexusAPI) return;
  const r = await NexusAPI.post(`/api/contas-receber/${id}/receber`, { forma_recebimento: 'Manual' });
  if (r && r.status === 'Recebida') { if (typeof showToast === 'function') showToast('Recebimento registrado!', 'success'); }
  else if (typeof showToast === 'function') showToast(r && r.error ? r.error : 'Não foi possível dar baixa.', 'error');
  _carregarFaturamento();
}

// Fatura a conta (vincula NF, se informada) e recarrega.
async function faturarConta(id) {
  if (!window.NexusAPI) return;
  const nf = (typeof prompt === 'function') ? prompt('Número da NF (opcional):') : '';
  const r = await NexusAPI.post(`/api/contas-receber/${id}/faturar`, { nota_fiscal: nf || null });
  if (r && r.status && typeof showToast === 'function') showToast('Conta faturada.', 'success');
  _carregarFaturamento();
}
// Emite a NFS-e a partir da conta (liga faturamento ao fiscal) e recarrega.
async function emitirNfseConta(id) {
  if (!window.NexusAPI) return;
  const cnpj = (typeof prompt === 'function') ? prompt('CNPJ do tomador (cliente):') : '';
  if (!cnpj) return;
  const r = await NexusAPI.post(`/api/contas-receber/${id}/emitir-nfse`, { cnpj_destinatario: cnpj });
  if (r && r.nota) {
    if (typeof showToast === 'function') showToast(`NFS-e ${r.nota.numero} ${r.nota.status} — conta faturada.`, 'success', 6000);
  } else if (typeof showToast === 'function') {
    showToast(r && r.error ? r.error : 'Não foi possível emitir a NFS-e.', 'error');
  }
  _carregarFaturamento();
}
window.receberFatura = receberFatura;
window.faturarConta = faturarConta;
window.emitirNfseConta = emitirNfseConta;
window._carregarFaturamento = _carregarFaturamento;

function openNovaFatura() {
  openModal('Nova cobrança (conta a receber)', `
    <div class="form-row">
      <div class="form-group">
        <label>Cliente</label>
        <input class="form-control" id="nf_cliente" placeholder="Razão social do cliente">
      </div>
      <div class="form-group">
        <label>Valor (R$)</label>
        <input class="form-control" id="nf_valor" type="number" placeholder="0,00">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Vencimento</label>
        <input class="form-control" id="nf_venc" type="date">
      </div>
      <div class="form-group">
        <label>Contrato (opcional)</label>
        <input class="form-control" id="nf_contrato" placeholder="Nº do contrato">
      </div>
    </div>
    <div class="form-group">
      <label>Descrição</label>
      <input class="form-control" id="nf_desc" placeholder="Referência, medição, período...">
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarNovaFatura()"><i class="fas fa-save"></i> Criar cobrança</button>
  `);
}

// Cria a conta a receber de verdade (POST /api/contas-receber).
async function salvarNovaFatura() {
  const v = id => (document.getElementById(id)?.value || '').trim();
  const cliente = v('nf_cliente'); const valor = parseFloat(v('nf_valor'));
  if (!cliente || !(valor > 0)) { if (typeof showToast === 'function') showToast('Informe cliente e valor (> 0).', 'error'); return; }
  if (!window.NexusAPI) return;
  const r = await NexusAPI.post('/api/contas-receber', {
    cliente, valor, descricao: v('nf_desc'), contrato_id: v('nf_contrato') || null, data_vencimento: v('nf_venc') || null,
  });
  if (r && r.id != null && !r._stub) {
    if (typeof logAction === 'function') logAction('Criar', 'Faturamento', `Conta a receber ${r.numero} — ${cliente}`);
    if (typeof showToast === 'function') showToast(`Cobrança ${r.numero} criada!`, 'success');
    if (typeof closeModal === 'function') closeModal();
    _carregarFaturamento();
  } else if (typeof showToast === 'function') {
    showToast(r && r.error ? r.error : 'Não foi possível criar a cobrança.', 'error');
  }
}
window.salvarNovaFatura = salvarNovaFatura;
window.openNovaFatura = openNovaFatura;
window.renderFaturamento = renderFaturamento;

// --- CONTAS A PAGAR ---
let FA_CONTAS_PAGAR = [];
window.FA_CONTAS_PAGAR = FA_CONTAS_PAGAR;

async function loadContasPagar() {
  try {
    FA_CONTAS_PAGAR = (await apiAuth('/api/contas-pagar?limit=200')) || [];
    window.FA_CONTAS_PAGAR = FA_CONTAS_PAGAR;
  } catch (e) { FA_CONTAS_PAGAR = []; }
}

function renderContasPagar() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin" style="color:var(--fa-teal)"></i><p>Carregando contas a pagar...</p></div>`;

  loadContasPagar().then(() => {
    const pagas = FA_CONTAS_PAGAR.filter(c => c.status === 'Pago');
    const pendentes = FA_CONTAS_PAGAR.filter(c => c.status !== 'Pago');
    const totalPago = pagas.reduce((a,c) => a+(c.valor||0), 0);
    const totalPendente = pendentes.reduce((a,c) => a+(c.valor||0), 0);
    const totalGeral = FA_CONTAS_PAGAR.reduce((a,c) => a+(c.valor||0), 0);
    const hoje = new Date().toISOString().split('T')[0];

    main.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2><i class="fas fa-hand-holding-usd" style="color:var(--orange);margin-right:10px"></i>Contas a Pagar</h2>
          <p>${FA_CONTAS_PAGAR.length} títulos · ${pendentes.length} em aberto · integrado com Pedidos de Compra</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary btn-sm" onclick="gerarRelContabilidade()"><i class="fas fa-file-alt"></i> Rel. Contabilidade</button>
          <button class="btn btn-secondary btn-sm" onclick="exportarCP()"><i class="fas fa-file-excel"></i> Exportar</button>
          <button class="btn btn-outline-primary btn-sm" onclick="finModalInadimplencia()"><i class="fas fa-clipboard-list"></i> Revisão Inadimpl.</button>
          ${hasPermission('contas_pagar','create') ? `<button class="btn btn-primary btn-sm" onclick="openNovaCP()"><i class="fas fa-plus"></i> Lançar Conta</button>` : ''}
        </div>
      </div>

      <!-- Fluxo de Caixa Semanal -->
      <div id="fin_fluxo_caixa_semanal"></div>

      <!-- Inadimplência -->
      <div id="fin_inadimplencia"></div>

      <!-- KPIs -->
      <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="kpi-card kpi-orange">
          <div class="kpi-icon"><i class="fas fa-file-invoice"></i></div>
          <div class="kpi-value">${fmtK(totalGeral)}</div>
          <div class="kpi-label">Total do Período</div>
        </div>
        <div class="kpi-card kpi-green">
          <div class="kpi-icon"><i class="fas fa-check-circle"></i></div>
          <div class="kpi-value">${fmtK(totalPago)}</div>
          <div class="kpi-label">Pago</div>
        </div>
        <div class="kpi-card kpi-yellow">
          <div class="kpi-icon"><i class="fas fa-clock"></i></div>
          <div class="kpi-value">${fmtK(totalPendente)}</div>
          <div class="kpi-label">Saldo a Pagar</div>
        </div>
        <div class="kpi-card kpi-blue">
          <div class="kpi-icon"><i class="fas fa-tasks"></i></div>
          <div class="kpi-value">${pendentes.length}</div>
          <div class="kpi-label">Títulos em Aberto</div>
        </div>
      </div>

      <!-- Alerta de integração -->
      <div class="alert alert-info" style="margin-bottom:16px">
        <span class="alert-icon"><i class="fas fa-link"></i></span>
        <div>
          <div class="alert-title">Integração Automática</div>
          <div class="alert-desc">Ao aprovar um Pedido de Compra, uma conta a pagar é gerada automaticamente com base no prazo de pagamento do fornecedor.</div>
        </div>
      </div>

      <!-- Tabela -->
      <div class="card">
        <div class="search-bar">
          <div class="search-input-wrapper">
            <i class="fas fa-search"></i>
            <input class="search-input" type="text" id="searchCP" placeholder="Buscar por descrição, fornecedor, contrato..." oninput="filterCP()">
          </div>
          <select class="filter-select" id="filterCPStatus" onchange="filterCP()">
            <option value="">Todos os Status</option>
            <option>Pago</option><option>Aprovado</option><option>Pendente</option><option>Atrasado</option>
          </select>
          <select class="filter-select" id="filterCPTipo" onchange="filterCP()">
            <option value="">Todos os Tipos</option>
            <option>Fornecedor</option><option>RH</option><option>Equipamentos</option><option>Seguro</option>
          </select>
        </div>
        <div id="tabelaCP">${renderTabelaCP_()}</div>
      </div>

      <!-- Resumo por tipo -->
      <div class="card" style="margin-top:14px">
        <div class="card-header"><h3><i class="fas fa-chart-pie" style="color:var(--fa-teal);margin-right:8px"></i>Resumo por Tipo de Custo</h3></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
            ${['Fornecedor','RH','Equipamentos','Seguro'].map(tipo => {
              const total = FA_CONTAS_PAGAR.filter(c=>c.tipo===tipo).reduce((a,c)=>a+(c.valor||0),0);
              const pct = totalGeral > 0 ? (total/totalGeral*100).toFixed(1) : 0;
              const cor = tipo === 'RH' ? 'var(--blue-light)' : tipo === 'Fornecedor' ? 'var(--orange)' : tipo === 'Equipamentos' ? 'var(--fa-teal)' : 'var(--purple)';
              return `
                <div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;padding:14px">
                  <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">${tipo}</div>
                  <div style="font-size:18px;font-weight:700;color:${cor};margin:4px 0">${fmtK(total)}</div>
                  <div style="height:4px;background:var(--bg-dark);border-radius:2px;overflow:hidden">
                    <div style="height:100%;width:${pct}%;background:${cor};border-radius:2px"></div>
                  </div>
                  <div style="font-size:10px;color:var(--text-muted);margin-top:4px">${pct}% do total</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
    // Injetar widgets de governança financeira
    if (typeof finRenderFluxoCaixaSemanal === 'function') finRenderFluxoCaixaSemanal('fin_fluxo_caixa_semanal');
    if (typeof finRenderInadimplencia === 'function') finRenderInadimplencia('fin_inadimplencia');
  });
}

function renderTabelaCP_(lista) {
  if (!Array.isArray(lista)) lista = FA_CONTAS_PAGAR;
  const hoje = new Date().toISOString().split('T')[0];
  if (!lista.length) return `<div class="empty-state"><i class="fas fa-hand-holding-usd"></i><p>Nenhuma conta encontrada</p></div>`;
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr><th>ID</th><th>Descrição</th><th>Fornecedor</th><th>Tipo</th><th>Contrato</th><th>Valor</th><th>Vencimento</th><th>Pgto. Real</th><th>NF</th><th>Status</th><th>Ações</th></tr>
        </thead>
        <tbody>
          ${lista.map(c => {
            const vencido = !c.data_pagamento && c.vencimento < hoje;
            return `
              <tr style="${vencido ? 'background:rgba(220,38,38,0.04)' : ''}">
                <td style="color:var(--fa-teal);font-weight:600;font-size:11px">${escapeHtml(c.id)}</td>
                <td style="font-size:12px">${escapeHtml(c.descricao)}</td>
                <td style="font-size:12px;font-weight:500">${escapeHtml(c.fornecedor_nome)}</td>
                <td><span class="badge badge-muted" style="font-size:10px">${escapeHtml(c.tipo||'—')}</span></td>
                <td style="font-size:11px;color:var(--text-secondary)">${escapeHtml(c.contrato_id||'—')}</td>
                <td style="font-weight:700;color:var(--orange)">${fmt(c.valor)}</td>
                <td style="font-size:12px;color:${vencido?'var(--red-light)':'var(--text-secondary)'};font-weight:${vencido?700:400}">${escapeHtml(c.vencimento)}${vencido?'<span class="badge badge-danger" style="margin-left:4px;font-size:9px">VENC.</span>':''}</td>
                <td style="font-size:12px;color:${c.data_pagamento?'var(--green-light)':'var(--text-muted)'}">${escapeHtml(c.data_pagamento||'—')}</td>
                <td style="font-size:11px;color:var(--text-muted)">${escapeHtml(c.nota_fiscal||'—')}</td>
                <td>${statusBadge(c.data_pagamento ? 'Pago' : vencido ? 'Atrasado' : c.status)}</td>
                <td>
                  <div class="actions-cell">
                    ${!c.data_pagamento ? `
                      <button class="btn btn-success btn-sm btn-icon" onclick="baixarCP('${escapeHtml(c.id)}')" title="Registrar Pagamento"><i class="fas fa-check"></i></button>
                      <button class="btn btn-secondary btn-sm btn-icon" onclick="editarCP('${escapeHtml(c.id)}')" title="Editar"><i class="fas fa-edit"></i></button>
                    ` : '<span style="color:var(--green-light);font-size:11px"><i class="fas fa-check-circle"></i> Pago</span>'}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function filterCP() {
  const s  = (document.getElementById('searchCP')?.value || '').toLowerCase();
  const st = document.getElementById('filterCPStatus')?.value || '';
  const tp = document.getElementById('filterCPTipo')?.value || '';
  const hoje = new Date().toISOString().split('T')[0];
  const filtradas = FA_CONTAS_PAGAR.filter(c => {
    const ms  = !s || ((c.descricao||'') + (c.fornecedor_nome||'') + (c.contrato_id||'')).toLowerCase().includes(s);
    const real = c.data_pagamento ? 'Pago' : (c.vencimento < hoje ? 'Atrasado' : c.status);
    const mst = !st || real === st;
    const mt  = !tp || c.tipo === tp;
    return ms && mst && mt;
  });
  // Reutiliza a MESMA funcao de render (com escape de HTML) — sem duplicar codigo.
  document.getElementById('tabelaCP').innerHTML = renderTabelaCP_(filtradas);
}

async function baixarCP(id) {
  const idx = FA_CONTAS_PAGAR.findIndex(c => c.id === id);
  if (idx < 0) return;
  const conta = FA_CONTAS_PAGAR[idx];

  // Gate no cliente (UX rapida). A decisao FINAL e do servidor (abaixo).
  const checkLocal = podePagarConta(conta);
  if (!checkLocal.ok) { showToast('Pagamento bloqueado: ' + checkLocal.motivos.join('; '), 'error'); return; }

  try {
    // O SERVIDOR reaplica o gate de lastro e so confirma se estiver tudo ok.
    // Canonico via DB.contas.pagar (server-authoritative; propaga o 409).
    const r = await DB.contas.pagar(id);
    FA_CONTAS_PAGAR[idx] = { ...conta, status: 'Pago', data_pagamento: (r && r.data_pagamento) || new Date().toISOString().split('T')[0] };
    logAction('Baixa CP', 'Financeiro', `${conta.descricao} pago – ${fmt(conta.valor)}`);
    showToast(`Pagamento registrado: ${conta.descricao}`, 'success');
  } catch (e) {
    // Servidor recusou (ex.: faltou lastro) ou esta fora: NAO finge sucesso.
    showToast('Pagamento nao efetuado: ' + e.message, 'error');
  }
  document.getElementById('tabelaCP').innerHTML = renderTabelaCP_();
}

function editarCP(id) {
  const c = FA_CONTAS_PAGAR.find(x => x.id === id);
  if (!c) return;
  openModal(`Editar Conta a Pagar – ${c.id}`, `
    <div class="form-group"><label>Descrição</label><input class="form-control" id="ecp_desc" value="${c.descricao}"></div>
    <div class="form-row">
      <div class="form-group"><label>Valor (R$)</label><input class="form-control" id="ecp_val" type="number" value="${c.valor}"></div>
      <div class="form-group"><label>Vencimento</label><input class="form-control" id="ecp_venc" type="date" value="${c.vencimento}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Nota Fiscal</label><input class="form-control" id="ecp_nf" value="${c.nota_fiscal||''}"></div>
      <div class="form-group"><label>Data Pagamento</label><input class="form-control" id="ecp_pgto" type="date" value="${c.data_pagamento||''}"></div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarEdicaoCP('${id}')"><i class="fas fa-save"></i> Salvar</button>
  `);
}

async function salvarEdicaoCP(id) {
  const idx = FA_CONTAS_PAGAR.findIndex(c => c.id === id);
  if (idx < 0) return;
  FA_CONTAS_PAGAR[idx].descricao = document.getElementById('ecp_desc').value;
  FA_CONTAS_PAGAR[idx].valor = parseFloat(document.getElementById('ecp_val').value);
  FA_CONTAS_PAGAR[idx].vencimento = document.getElementById('ecp_venc').value;
  FA_CONTAS_PAGAR[idx].nota_fiscal = document.getElementById('ecp_nf').value;
  FA_CONTAS_PAGAR[idx].data_pagamento = document.getElementById('ecp_pgto').value;
  try { await apiAuth('/api/contas-pagar/' + id, { method: 'PUT', body: JSON.stringify(FA_CONTAS_PAGAR[idx]) }); } catch(e) {}
  closeModal();
  showToast('Conta a pagar atualizada!', 'success');
  document.getElementById('tabelaCP').innerHTML = renderTabelaCP_();
}

function openNovaCP() {
  openModal('Lançar Conta a Pagar', `
    <div class="form-group"><label>Descrição *</label><input class="form-control" id="ncp_desc" type="text" placeholder="Ex: Fatura de energia, serviço, material..."></div>
    <div class="form-row">
      <div class="form-group"><label>Fornecedor / Credor *</label><input class="form-control" id="ncp_for" type="text" placeholder="Razão social"></div>
      <div class="form-group">
        <label>Tipo</label>
        <select class="form-control" id="ncp_tipo">
          <option>Fornecedor</option><option>RH</option><option>Equipamentos</option><option>Seguro</option><option>Outros</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Valor (R$) *</label><input class="form-control" id="ncp_val" type="number" placeholder="0,00"></div>
      <div class="form-group"><label>Vencimento *</label><input class="form-control" id="ncp_venc" type="date"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Contrato/Centro de Custo</label>
        <select class="form-control" id="ncp_ctr">
          <option value="Geral">Geral</option>
          ${ERP_DATA.contratos.filter(c=>c.status==='Ativo').map(c=>`<option value="${c.id}">${c.id} – ${c.cliente}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Nota Fiscal</label><input class="form-control" id="ncp_nf" type="text" placeholder="Nº NF (opcional)"></div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarNovaCP()"><i class="fas fa-save"></i> Lançar</button>
  `);
}

async function salvarNovaCP() {
  const desc = document.getElementById('ncp_desc').value;
  const forN = document.getElementById('ncp_for').value;
  const val = parseFloat(document.getElementById('ncp_val').value);
  if (!desc || !forN || !val) { showToast('Preencha os campos obrigatórios', 'warning'); return; }

  // Validação hierárquica para valores > R$50.000
  if (typeof finValidarAprovacaoCP === 'function') {
    const check = finValidarAprovacaoCP(val);
    if (check.requerAprovacao) {
      closeModal();
      setTimeout(() => finAbrirAprovacaoHierarquica(null, val), 300);
      showToast(`⚠️ Valor ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(val)} exige aprovação hierárquica antes do lançamento.`, 'warning');
      return;
    }
  }

  const nova = {
    id: gerarId('CP'),
    descricao: desc,
    fornecedor_nome: forN,
    tipo: document.getElementById('ncp_tipo').value,
    contrato_id: document.getElementById('ncp_ctr').value,
    valor: val,
    vencimento: document.getElementById('ncp_venc').value,
    data_pagamento: '',
    status: 'Aprovado',
    nota_fiscal: document.getElementById('ncp_nf').value || '—',
    centro_custo: document.getElementById('ncp_ctr').value
  };

  try {
    await apiAuth('/api/contas-pagar', { method: 'POST', body: JSON.stringify(nova) });
  } catch(e) {}
  FA_CONTAS_PAGAR.unshift(nova);
  window.FA_CONTAS_PAGAR = FA_CONTAS_PAGAR;
  logAction('Lançamento CP', 'Financeiro', `Conta criada: ${desc} – ${fmt(val)}`);
  closeModal();
  showToast(`Conta a pagar lançada: ${desc}`, 'success');
  document.getElementById('tabelaCP').innerHTML = renderTabelaCP_();
}

// Exportação para Excel (.xlsx real, backend multi-tenant) — substitui o CSV
// que não neutralizava fórmulas.
function exportarCP(ev) { nexusBaixarXLSX('/api/contas-pagar/export.xlsx', ev); }

// --- LANÇAMENTO DE DESPESAS ---
function openLancamentoDespesa() {
  openModalWide('Inserir Despesa', `
    <div class="form-row">
      <div class="form-group"><label>Descrição da Despesa *</label><input class="form-control" id="ld_desc" placeholder="Ex: Energia elétrica, Combustível, Aluguel..."></div>
      <div class="form-group">
        <label>Classificação / Tipo *</label>
        <select class="form-control" id="ld_tipo">
          <option>Pessoal</option><option>Material</option><option>Equipamentos</option><option>Combustível</option>
          <option>Transporte</option><option>Alimentação</option><option>Seguro</option><option>Impostos</option>
          <option>Comunicação</option><option>TI</option><option>Instalações</option><option>Outros</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Fornecedor / Credor *</label><input class="form-control" id="ld_for" placeholder="Nome do credor"></div>
      <div class="form-group">
        <label>Centro de Custo / Contrato</label>
        <select class="form-control" id="ld_ctr">
          <option value="Geral">Geral</option>
          ${ERP_DATA.contratos.filter(c=>c.status==='Ativo').map(c=>`<option value="${c.id}">${c.id} – ${c.cliente}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Valor (R$) *</label><input class="form-control" id="ld_val" type="number" step="0.01" min="0"></div>
      <div class="form-group"><label>Data / Competência *</label><input class="form-control" id="ld_data" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Nº Nota Fiscal</label><input class="form-control" id="ld_nf" placeholder="Opcional"></div>
      <div class="form-group"><label>Vencimento do Pagamento</label><input class="form-control" id="ld_venc" type="date"></div>
    </div>
    <div class="form-group"><label>Observações</label><textarea class="form-control" id="ld_obs" rows="2" placeholder="Informações adicionais..."></textarea></div>
    <div id="ld_erro" style="display:none;color:var(--red-light);font-size:12px;padding:8px;border-radius:6px;background:rgba(239,68,68,0.1);margin-top:8px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarLancamentoDespesa()"><i class="fas fa-save"></i> Lançar Despesa</button>
  `);
}

async function salvarLancamentoDespesa() {
  const desc = document.getElementById('ld_desc').value.trim();
  const fornec = document.getElementById('ld_for').value.trim();
  const val = parseFloat(document.getElementById('ld_val').value) || 0;
  const erroEl = document.getElementById('ld_erro');
  if (!desc) { erroEl.textContent = 'Informe a descrição.'; erroEl.style.display='block'; return; }
  if (!fornec) { erroEl.textContent = 'Informe o fornecedor/credor.'; erroEl.style.display='block'; return; }
  if (val <= 0) { erroEl.textContent = 'Informe o valor.'; erroEl.style.display='block'; return; }

  const nova = {
    id: gerarId('CP'),
    descricao: desc,
    fornecedor_nome: fornec,
    tipo: document.getElementById('ld_tipo').value,
    contrato_id: document.getElementById('ld_ctr').value,
    valor: val,
    vencimento: document.getElementById('ld_venc').value || document.getElementById('ld_data').value,
    data_pagamento: '',
    status: 'Aprovado',
    nota_fiscal: document.getElementById('ld_nf').value || '—',
    centro_custo: document.getElementById('ld_ctr').value,
    observacoes: document.getElementById('ld_obs').value.trim(),
    classificacao: document.getElementById('ld_tipo').value
  };

  try {
    await apiAuth('/api/contas-pagar', { method: 'POST', body: JSON.stringify(nova) });
  } catch(e) {}

  FA_CONTAS_PAGAR.unshift(nova);
  window.FA_CONTAS_PAGAR = FA_CONTAS_PAGAR;
  logAction('Lançamento Despesa', 'Financeiro', `Despesa lançada: ${desc} – ${fmt(val)} – ${nova.tipo}`);
  closeModal();
  showToast(`Despesa "${desc}" lançada com sucesso!`, 'success');
}

// --- EXPORTAÇÃO FINANCEIRO ---
function exportarFinanceiro() {
  const faturas = ERP_DATA.faturas;
  const csv = [['Tipo','ID','Cliente/Fornecedor','Descrição','Valor','Status','Vencimento'],
    ...faturas.map(f => ['Fatura', f.id, f.cliente, `Medição ${f.medicao}`, f.liquido, f.status, f.vencimento]),
    ...FA_CONTAS_PAGAR.map(c => ['Despesa', c.id, c.fornecedor_nome, c.descricao, c.valor, c.status, c.vencimento])
  ].map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
  a.download = `Financeiro_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  logAction('Exportação', 'Financeiro', 'Painel financeiro exportado');
  showToast('Painel financeiro exportado!', 'success');
}

// --- RELATÓRIO PARA CONTABILIDADE ---
function gerarRelContabilidade() {
  const hoje = new Date();
  const mesAno = hoje.toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'});
  const contas = FA_CONTAS_PAGAR;
  let txt = `FRASER ALEXANDER – RELATÓRIO PARA CONTABILIDADE\n${'='.repeat(60)}\nCompetência: ${mesAno}\nEmitido em: ${hoje.toLocaleDateString('pt-BR')} | Emitido por: ${currentUser?.name||'—'}\n${'='.repeat(60)}\n\n`;

  txt += `CONTAS A PAGAR:\n${'-'.repeat(60)}\n`;
  contas.forEach(c => {
    txt += `${c.id} | ${c.descricao} | ${c.fornecedor_nome} | ${fmt(c.valor)} | ${c.tipo} | Venc: ${c.vencimento} | ${c.data_pagamento ? 'PAGO em '+c.data_pagamento : 'EM ABERTO'} | NF: ${c.nota_fiscal||'—'}\n`;
  });

  const totalPago = contas.filter(c=>c.data_pagamento).reduce((a,c)=>a+(c.valor||0),0);
  const totalAberto = contas.filter(c=>!c.data_pagamento).reduce((a,c)=>a+(c.valor||0),0);
  txt += `\n${'='.repeat(60)}\nTOTAL PAGO: ${fmt(totalPago)}\nTOTAL EM ABERTO: ${fmt(totalAberto)}\nTOTAL GERAL: ${fmt(totalPago+totalAberto)}\n\nAssinar e enviar para: contabilidade@fraseralexander.com.br\n`;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt],{type:'text/plain;charset=utf-8'}));
  a.download = `Relatorio_Contabilidade_${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  showToast('Relatório para contabilidade exportado!', 'success');
}

// --- COMPRAS ---
function renderCompras() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2>Compras e Suprimentos</h2>
        <p>Gestão de requisições, cotações e pedidos</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary btn-sm" onclick="showToast('Abrindo requisição...','info')">
          <i class="fas fa-plus"></i> Nova Requisição
        </button>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr)" id="comprasKpiGrid">
      <div class="kpi-card kpi-blue"><div class="kpi-icon"><i class="fas fa-file-alt"></i></div><div class="kpi-value" id="kpiRCAberto">—</div><div class="kpi-label">Requisições Abertas</div></div>
      <div class="kpi-card kpi-yellow"><div class="kpi-icon"><i class="fas fa-search"></i></div><div class="kpi-value" id="kpiRFQAberto">—</div><div class="kpi-label">Em Cotação</div></div>
      <div class="kpi-card kpi-orange"><div class="kpi-icon"><i class="fas fa-shopping-bag"></i></div><div class="kpi-value" id="kpiPCAberto">—</div><div class="kpi-label">Pedidos Emitidos</div></div>
      <div class="kpi-card kpi-green"><div class="kpi-icon"><i class="fas fa-check-circle"></i></div><div class="kpi-value" id="kpiPCEntregue">—</div><div class="kpi-label">Pedidos Entregues</div></div>
    </div>

    <div class="card" id="comprasReqCard">
      <div class="card-header">
        <h3><i class="fas fa-shopping-cart" style="color:var(--orange);margin-right:8px"></i>Requisições de Compra Recentes</h3>
      </div>
      <div class="table-wrapper" id="comprasReqTbody">
        <div class="empty-state" style="padding:24px"><i class="fas fa-spinner fa-spin" style="color:var(--fa-teal)"></i><p>Carregando...</p></div>
      </div>
    </div>
  `;

  // Carregar dados reais da API
  Promise.all([
    DB.rc.listar({ limit: 5 }).catch(() => []),
    DB.rfq.listar({ limit: 5 }).catch(() => []),
    DB.pedidos.listar({ limit: 5 }).catch(() => [])
  ]).then(([rcs, rfqs, pedidos]) => {
    const rcAberto  = Array.isArray(rcs)    ? rcs.filter(r => r.status !== 'Concluída' && r.status !== 'Cancelada').length : 0;
    const rfqAberto = Array.isArray(rfqs)   ? rfqs.filter(r => r.status === 'Aberta' || r.status === 'Em Andamento').length : 0;
    const pcEmitido = Array.isArray(pedidos) ? pedidos.filter(p => p.status === 'Emitido' || p.status === 'Enviado').length : 0;
    const pcEntregue= Array.isArray(pedidos) ? pedidos.filter(p => p.status === 'Entregue').length : 0;
    const el = id => document.getElementById(id);
    if (el('kpiRCAberto'))   el('kpiRCAberto').textContent   = rcAberto;
    if (el('kpiRFQAberto'))  el('kpiRFQAberto').textContent  = rfqAberto;
    if (el('kpiPCAberto'))   el('kpiPCAberto').textContent   = pcEmitido;
    if (el('kpiPCEntregue')) el('kpiPCEntregue').textContent = pcEntregue;

    const tbody = el('comprasReqTbody');
    if (!tbody) return;
    if (!Array.isArray(rcs) || !rcs.length) {
      tbody.innerHTML = '<div class="empty-state" style="padding:24px"><i class="fas fa-inbox"></i><p>Nenhuma requisição encontrada</p></div>';
      return;
    }
    tbody.innerHTML = `<table><thead><tr><th>Nº</th><th>Título</th><th>Solicitante</th><th>Valor Est.</th><th>Urgência</th><th>Status</th></tr></thead><tbody>
      ${rcs.slice(0,5).map(r => `
        <tr style="cursor:pointer" onclick="navigate('fluxo_aprovacao_rc')">
          <td style="color:var(--orange);font-weight:600">${r.numero||r.id}</td>
          <td>${(r.titulo||r.descricao||'—').substring(0,45)}</td>
          <td>${r.solicitante||'—'}</td>
          <td>${r.valor_estimado ? fmt(r.valor_estimado) : '—'}</td>
          <td>${statusBadge(r.urgencia||'Normal')}</td>
          <td>${statusBadge(r.status||'—')}</td>
        </tr>`).join('')}
    </tbody></table>`;
  });
}
