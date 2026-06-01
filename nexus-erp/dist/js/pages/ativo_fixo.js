// =====================================================
// ERP – Módulo Ativo Fixo / Patrimônio v1.0
// Imobilizado, Depreciação, Controle Patrimonial
// =====================================================

// ─── Helpers de storage ───────────────────────────
function _afGet(k, def) { try { return JSON.parse(localStorage.getItem(k)||JSON.stringify(def)); } catch(e) { return def; } }
function _afSave(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

function _getAtivos() { return _afGet('fa_ativos_fixos', []); }
function _saveAtivos(d) { _afSave('fa_ativos_fixos', d); }
function _getDepreciacoes() { return _afGet('fa_depreciacoes', []); }
function _saveDepreciacoes(d) { _afSave('fa_depreciacoes', d); }
function _getManutencoes() { return _afGet('fa_manut_ativos', []); }
function _saveManutencoes(d) { _afSave('fa_manut_ativos', d); }

let _afAba = 'lista';

// ─── Tabelas de depreciação (vida útil/taxa Brasil) ─
const AF_TAXAS = {
  'Veículos/Automóveis':       { vidaUtil: 5,  taxa: 20 },
  'Caminhões e Frota Pesada':  { vidaUtil: 5,  taxa: 20 },
  'Máquinas e Equipamentos':   { vidaUtil: 10, taxa: 10 },
  'Computadores e Periféricos':{ vidaUtil: 5,  taxa: 20 },
  'Móveis e Utensílios':       { vidaUtil: 10, taxa: 10 },
  'Instalações':               { vidaUtil: 10, taxa: 10 },
  'Benfeitorias em Imóveis':   { vidaUtil: 10, taxa: 10 },
  'Imóveis':                   { vidaUtil: 25, taxa: 4  },
  'Software/Intangível':       { vidaUtil: 5,  taxa: 20 },
  'Outros':                    { vidaUtil: 5,  taxa: 20 },
};

// ─── Calcula depreciação acumulada ────────────────
function _afCalcularDeprec(ativo) {
  if (!ativo.data_aquisicao || !ativo.valor_aquisicao) return { depAcum: 0, vlrLiquido: ativo.valor_aquisicao || 0, pctDepreciado: 0 };
  const taxa = (ativo.taxa_deprec || AF_TAXAS[ativo.categoria]?.taxa || 10) / 100;
  const vidaUtil = ativo.vida_util || AF_TAXAS[ativo.categoria]?.vidaUtil || 10;
  const anos = (new Date() - new Date(ativo.data_aquisicao)) / (365.25 * 24 * 3600 * 1000);
  const depAcum = Math.min(ativo.valor_aquisicao * taxa * anos, ativo.valor_aquisicao * (1 - (ativo.pct_residual||0)/100));
  const vlrResidual = ativo.valor_aquisicao * ((ativo.pct_residual||0)/100);
  const vlrLiquido = Math.max(ativo.valor_aquisicao - depAcum, vlrResidual);
  const pctDepreciado = ativo.valor_aquisicao > 0 ? (depAcum/ativo.valor_aquisicao)*100 : 0;
  return { depAcum, vlrLiquido, pctDepreciado, anos, taxaAnual: taxa*100, vidaUtil, vlrResidual };
}

// ─── Render principal ──────────────────────────────
function renderAtivoFixo() {
  if (!hasPermission('financeiro', 'view')) { renderAcessoNegado(); return; }
  const main = document.getElementById('mainContent');

  const ativos = _getAtivos();
  const totalAquisicao = ativos.reduce((a,b) => a + (parseFloat(b.valor_aquisicao)||0), 0);
  const totalLiquido   = ativos.reduce((a,b) => { const { vlrLiquido } = _afCalcularDeprec(b); return a + vlrLiquido; }, 0);
  const totalDeprecAcum= totalAquisicao - totalLiquido;
  const atAtivos = ativos.filter(a => a.status === 'Ativo' || !a.status).length;

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-building" style="color:var(--fa-teal);margin-right:10px"></i>Ativo Fixo / Patrimônio</h2>
        <p>Controle de imobilizado, depreciação e manutenção patrimonial</p>
      </div>
      <div class="page-actions" style="gap:8px;display:flex">
        ${hasPermission('financeiro','create') ? `
        <button class="btn btn-success btn-sm" onclick="_afNovoAtivo()">
          <i class="fas fa-plus"></i> Cadastrar Ativo
        </button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="_afExportar()">
          <i class="fas fa-file-excel"></i> Exportar
        </button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:16px">
      <div class="kpi-card kpi-teal">
        <div class="kpi-icon"><i class="fas fa-building"></i></div>
        <div class="kpi-value">${ativos.length}</div>
        <div class="kpi-label">Total de Ativos</div>
        <div class="kpi-delta">${atAtivos} ativos em uso</div>
      </div>
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><i class="fas fa-dollar-sign"></i></div>
        <div class="kpi-value">${fmtK(totalAquisicao)}</div>
        <div class="kpi-label">Valor de Aquisição</div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-icon"><i class="fas fa-chart-line"></i></div>
        <div class="kpi-value">${fmtK(totalLiquido)}</div>
        <div class="kpi-label">Valor Contábil Líquido</div>
        <div class="kpi-delta delta-up">Valor atual do imobilizado</div>
      </div>
      <div class="kpi-card kpi-orange">
        <div class="kpi-icon"><i class="fas fa-arrow-down"></i></div>
        <div class="kpi-value">${fmtK(totalDeprecAcum)}</div>
        <div class="kpi-label">Depreciação Acumulada</div>
        <div class="kpi-delta">${totalAquisicao>0?((totalDeprecAcum/totalAquisicao)*100).toFixed(1):'0'}% depreciado</div>
      </div>
      <div class="kpi-card kpi-yellow">
        <div class="kpi-icon"><i class="fas fa-tools"></i></div>
        <div class="kpi-value">${ativos.filter(a => { const d = _afCalcularDeprec(a); return d.pctDepreciado >= 80; }).length}</div>
        <div class="kpi-label">Próximos da Baixa (>80%)</div>
        <div class="kpi-delta delta-down">Requerem atenção</div>
      </div>
    </div>

    <!-- Abas -->
    <div class="tab-bar" style="margin-bottom:16px">
      <button class="tab-btn ${_afAba==='lista'?'active':''}" onclick="_afSetAba('lista')">
        <i class="fas fa-list"></i> Inventário
      </button>
      <button class="tab-btn ${_afAba==='depreciacao'?'active':''}" onclick="_afSetAba('depreciacao')">
        <i class="fas fa-chart-area"></i> Depreciação
      </button>
      <button class="tab-btn ${_afAba==='manutencao'?'active':''}" onclick="_afSetAba('manutencao')">
        <i class="fas fa-tools"></i> Manutenção
      </button>
      <button class="tab-btn ${_afAba==='relatorio'?'active':''}" onclick="_afSetAba('relatorio')">
        <i class="fas fa-chart-bar"></i> Relatório
      </button>
    </div>

    <div id="afConteudo"></div>
  `;

  _afRenderAba();
}

function _afSetAba(aba) {
  _afAba = aba;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const idx = ['lista','depreciacao','manutencao','relatorio'].indexOf(aba);
  document.querySelectorAll('.tab-btn')[idx]?.classList.add('active');
  _afRenderAba();
}

function _afRenderAba() {
  const el = document.getElementById('afConteudo');
  if (!el) return;
  if (_afAba === 'lista') _afRenderLista(el);
  else if (_afAba === 'depreciacao') _afRenderDepreciacao(el);
  else if (_afAba === 'manutencao') _afRenderManutencao(el);
  else if (_afAba === 'relatorio') _afRenderRelatorio(el);
}

// ─── Lista de Ativos ──────────────────────────────
function _afRenderLista(el) {
  const ativos = _getAtivos();
  const busca  = (document.getElementById('afBusca')?.value || '').toLowerCase();
  const filtCat= document.getElementById('afFiltCat')?.value || '';
  const filtSt = document.getElementById('afFiltSt')?.value || '';

  let lista = [...ativos];
  if (busca) lista = lista.filter(a =>
    (a.descricao||'').toLowerCase().includes(busca) ||
    (a.placa||a.numero_serie||a.codigo||'').toLowerCase().includes(busca) ||
    (a.responsavel||'').toLowerCase().includes(busca)
  );
  if (filtCat) lista = lista.filter(a => a.categoria === filtCat);
  if (filtSt)  lista = lista.filter(a => (a.status||'Ativo') === filtSt);

  el.innerHTML = `
    <div class="card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h4><i class="fas fa-list" style="color:var(--fa-teal);margin-right:6px"></i>Inventário de Ativos (${lista.length})</h4>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input type="text" id="afBusca" class="form-control" style="width:180px;font-size:12px"
            placeholder="Buscar descrição, código..." value="${busca}"
            oninput="_afRenderLista(document.getElementById('afConteudo'))">
          <select class="form-control" id="afFiltCat" style="width:160px;font-size:12px"
            onchange="_afRenderLista(document.getElementById('afConteudo'))">
            <option value="">Todas categorias</option>
            ${Object.keys(AF_TAXAS).map(c=>`<option value="${c}" ${c===filtCat?'selected':''}>${c}</option>`).join('')}
          </select>
          <select class="form-control" id="afFiltSt" style="width:110px;font-size:12px"
            onchange="_afRenderLista(document.getElementById('afConteudo'))">
            <option value="">Todos status</option>
            ${['Ativo','Inativo','Em Manutenção','Baixado'].map(s=>`<option value="${s}" ${s===filtSt?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Código</th><th>Descrição</th><th>Categoria</th>
            <th>Responsável</th><th>Contrato/Setor</th>
            <th style="text-align:right">Valor Aq.</th>
            <th style="text-align:right">Valor Líquido</th>
            <th>Depreciado</th>
            <th>Status</th><th>Ações</th>
          </tr></thead>
          <tbody>
            ${lista.length ? lista.map(a => {
              const d = _afCalcularDeprec(a);
              const pctBar = Math.min(d.pctDepreciado, 100);
              const corBadge = pctBar < 50 ? 'badge-success' : pctBar < 80 ? 'badge-warning' : 'badge-danger';
              const stCorMap = { 'Ativo':'badge-success', 'Inativo':'badge-warning', 'Em Manutenção':'badge-info', 'Baixado':'badge-danger' };
              return `<tr>
                <td style="font-family:monospace;font-size:11px">${a.codigo||'—'}</td>
                <td style="font-size:12px;font-weight:600">${a.descricao||'—'}<br><span style="font-size:10px;color:var(--text-muted)">${a.numero_serie||a.placa||''}</span></td>
                <td style="font-size:11px">${a.categoria||'—'}</td>
                <td style="font-size:11px">${a.responsavel||'—'}</td>
                <td style="font-size:11px">${a.contrato||a.setor||'—'}</td>
                <td style="text-align:right;font-size:12px">${fmt(a.valor_aquisicao||0)}</td>
                <td style="text-align:right;font-weight:700;font-size:12px;color:var(--fa-teal)">${fmt(d.vlrLiquido)}</td>
                <td>
                  <div style="width:80px;background:var(--border);border-radius:4px;height:8px">
                    <div style="width:${pctBar}%;background:${pctBar<50?'var(--green)':pctBar<80?'var(--orange)':'var(--red)'};border-radius:4px;height:8px"></div>
                  </div>
                  <span class="badge ${corBadge}" style="font-size:10px;margin-top:2px">${d.pctDepreciado.toFixed(0)}%</span>
                </td>
                <td><span class="badge ${stCorMap[a.status||'Ativo']||'badge-info'}">${a.status||'Ativo'}</span></td>
                <td>
                  <button class="btn btn-xs btn-secondary" onclick="_afVerAtivo('${a.id}')" title="Detalhes"><i class="fas fa-eye"></i></button>
                  ${hasPermission('financeiro','create') ? `
                  <button class="btn btn-xs btn-secondary" onclick="_afEditarAtivo('${a.id}')" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:30px">
              <i class="fas fa-building" style="font-size:28px;margin-bottom:8px;display:block;opacity:.3"></i>
              Nenhum ativo cadastrado. Clique em "Cadastrar Ativo" para começar.
            </td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── Aba Depreciação ──────────────────────────────
function _afRenderDepreciacao(el) {
  const ativos = _getAtivos().filter(a => (a.status||'Ativo') !== 'Baixado');
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  const depMensal = ativos.reduce((tot, a) => {
    const taxa = (a.taxa_deprec || AF_TAXAS[a.categoria]?.taxa || 10) / 100;
    return tot + (parseFloat(a.valor_aquisicao)||0) * taxa / 12;
  }, 0);
  const depAnual  = depMensal * 12;

  // Agrupa por categoria
  const porCategoria = {};
  ativos.forEach(a => {
    const cat = a.categoria || 'Outros';
    if (!porCategoria[cat]) porCategoria[cat] = { total: 0, depMens: 0, depAcum: 0 };
    const taxa = (a.taxa_deprec || AF_TAXAS[cat]?.taxa || 10) / 100;
    porCategoria[cat].total   += parseFloat(a.valor_aquisicao)||0;
    porCategoria[cat].depMens += (parseFloat(a.valor_aquisicao)||0) * taxa / 12;
    porCategoria[cat].depAcum += _afCalcularDeprec(a).depAcum;
  });

  el.innerHTML = `
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
      <div class="kpi-card kpi-orange">
        <div class="kpi-icon"><i class="fas fa-calendar"></i></div>
        <div class="kpi-value">${fmt(depMensal)}</div>
        <div class="kpi-label">Depreciação Mensal</div>
        <div class="kpi-delta">${String(mesAtual).padStart(2,'0')}/${anoAtual}</div>
      </div>
      <div class="kpi-card kpi-red">
        <div class="kpi-icon"><i class="fas fa-calendar-alt"></i></div>
        <div class="kpi-value">${fmt(depAnual)}</div>
        <div class="kpi-label">Depreciação Anual (est.)</div>
        <div class="kpi-delta">${anoAtual}</div>
      </div>
      <div class="kpi-card kpi-teal">
        <div class="kpi-icon"><i class="fas fa-layer-group"></i></div>
        <div class="kpi-value">${Object.keys(porCategoria).length}</div>
        <div class="kpi-label">Categorias Depreciando</div>
      </div>
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><i class="fas fa-balance-scale"></i></div>
        <div class="kpi-value">${fmt(ativos.reduce((a,b)=>a+_afCalcularDeprec(b).depAcum,0))}</div>
        <div class="kpi-label">Depreciação Acumulada Total</div>
      </div>
    </div>

    <div class="grid-2" style="gap:14px;margin-bottom:14px">
      <div class="card">
        <div class="card-header"><h4><i class="fas fa-chart-pie" style="color:var(--fa-teal);margin-right:6px"></i>Depreciação por Categoria</h4></div>
        <div class="card-body"><div style="height:240px"><canvas id="afChartCat"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><h4><i class="fas fa-table" style="color:var(--fa-teal);margin-right:6px"></i>Por Categoria</h4></div>
        <div class="table-wrapper" style="max-height:260px">
          <table>
            <thead><tr><th>Categoria</th><th style="text-align:right">Valor Total</th><th style="text-align:right">Dep/Mês</th><th style="text-align:right">Dep Acum</th></tr></thead>
            <tbody>
              ${Object.entries(porCategoria).map(([cat, v]) => `
                <tr>
                  <td style="font-size:12px">${cat}</td>
                  <td style="text-align:right;font-size:12px">${fmt(v.total)}</td>
                  <td style="text-align:right;font-size:12px;color:var(--orange)">${fmt(v.depMens)}</td>
                  <td style="text-align:right;font-size:12px;color:var(--red)">${fmt(v.depAcum)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h4><i class="fas fa-list" style="color:var(--fa-teal);margin-right:6px"></i>Detalhe de Depreciação por Ativo</h4></div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Ativo</th><th>Categoria</th><th style="text-align:right">Val. Aq.</th>
            <th style="text-align:right">Taxa</th><th style="text-align:right">Dep/Mês</th>
            <th style="text-align:right">Dep. Acum.</th><th style="text-align:right">Val. Líquido</th>
            <th style="text-align:right">% Dep.</th><th>Vida Útil Restante</th>
          </tr></thead>
          <tbody>
            ${ativos.map(a => {
              const d = _afCalcularDeprec(a);
              const taxa = (a.taxa_deprec || AF_TAXAS[a.categoria]?.taxa || 10);
              const depMens = (parseFloat(a.valor_aquisicao)||0) * (taxa/100) / 12;
              const vidaRestante = Math.max(0, (d.vidaUtil - d.anos)).toFixed(1);
              return `<tr>
                <td style="font-size:12px;font-weight:600">${a.descricao||'—'}</td>
                <td style="font-size:11px">${a.categoria||'—'}</td>
                <td style="text-align:right;font-size:12px">${fmt(a.valor_aquisicao||0)}</td>
                <td style="text-align:right;font-size:11px">${taxa}% a.a.</td>
                <td style="text-align:right;font-size:12px;color:var(--orange)">${fmt(depMens)}</td>
                <td style="text-align:right;font-size:12px;color:var(--red)">${fmt(d.depAcum)}</td>
                <td style="text-align:right;font-weight:700;color:var(--fa-teal)">${fmt(d.vlrLiquido)}</td>
                <td style="text-align:right">
                  <span class="badge ${d.pctDepreciado<50?'badge-success':d.pctDepreciado<80?'badge-warning':'badge-danger'}">${d.pctDepreciado.toFixed(0)}%</span>
                </td>
                <td style="font-size:11px">${vidaRestante} anos</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  setTimeout(() => {
    const ctx = document.getElementById('afChartCat');
    if (!ctx) return;
    const cats = Object.keys(porCategoria);
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: cats,
        datasets: [{
          data: cats.map(c => porCategoria[c].depAcum),
          backgroundColor: ['#00b4b8','#22c55e','#f97316','#ef4444','#8b5cf6','#06b6d4','#84cc16','#eab308','#f43f5e','#0ea5e9'],
          borderWidth: 2, borderColor: 'var(--bg-primary)'
        }]
      },
      options: { responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ position:'right', labels:{color:'var(--text-primary)',font:{size:10}} } }
      }
    });
  }, 100);
}

// ─── Aba Manutenção ───────────────────────────────
function _afRenderManutencao(el) {
  const manutencoes = _getManutencoes();
  const ativos      = _getAtivos();

  el.innerHTML = `
    <div class="card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
        <h4><i class="fas fa-tools" style="color:var(--fa-teal);margin-right:6px"></i>Histórico de Manutenções (${manutencoes.length})</h4>
        ${hasPermission('financeiro','create') ? `
        <button class="btn btn-success btn-sm" onclick="_afNovaManutencao()">
          <i class="fas fa-plus"></i> Registrar Manutenção
        </button>` : ''}
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Data</th><th>Ativo</th><th>Tipo</th><th>Descrição</th>
            <th style="text-align:right">Custo</th><th>Responsável</th><th>Status</th>
          </tr></thead>
          <tbody>
            ${manutencoes.length ? manutencoes.map(m => {
              const ativo = ativos.find(a => a.id === m.ativo_id);
              const stMap = { 'Concluída':'badge-success', 'Agendada':'badge-info', 'Em Andamento':'badge-warning', 'Cancelada':'badge-danger' };
              return `<tr>
                <td style="font-size:11px">${m.data||'—'}</td>
                <td style="font-size:12px;font-weight:600">${ativo?.descricao||m.ativo_desc||'—'}</td>
                <td><span class="badge badge-info" style="font-size:10px">${m.tipo||'—'}</span></td>
                <td style="font-size:12px">${m.descricao||'—'}</td>
                <td style="text-align:right;font-weight:700">${fmt(m.custo||0)}</td>
                <td style="font-size:11px">${m.responsavel||'—'}</td>
                <td><span class="badge ${stMap[m.status]||'badge-info'}">${m.status||'—'}</span></td>
              </tr>`;
            }).join('') : `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px">Nenhuma manutenção registrada.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── Aba Relatório ────────────────────────────────
function _afRenderRelatorio(el) {
  const ativos = _getAtivos();
  const anoAtual = new Date().getFullYear();

  const totalAq     = ativos.reduce((a,b) => a+(parseFloat(b.valor_aquisicao)||0), 0);
  const totalLiq    = ativos.reduce((a,b) => a+_afCalcularDeprec(b).vlrLiquido, 0);
  const totalDepAcum= totalAq - totalLiq;
  const depMensal   = ativos.reduce((a,b) => {
    const taxa = (b.taxa_deprec || AF_TAXAS[b.categoria]?.taxa || 10)/100;
    return a + (parseFloat(b.valor_aquisicao)||0)*taxa/12;
  }, 0);

  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const depAcumMeses = meses.map((_,i) => depMensal * (i+1));

  el.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div class="card-header">
        <h4><i class="fas fa-chart-bar" style="color:var(--fa-teal);margin-right:6px"></i>Relatório Patrimonial – ${anoAtual}</h4>
      </div>
      <div class="card-body">
        <div class="grid-2" style="gap:16px;margin-bottom:16px">
          <div>
            <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px">Valor de Aquisição (Custo Histórico)</div>
            <div style="font-size:22px;font-weight:700">${fmt(totalAq)}</div>
          </div>
          <div>
            <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px">(-) Depreciação Acumulada</div>
            <div style="font-size:22px;font-weight:700;color:var(--red)">(${fmt(totalDepAcum)})</div>
          </div>
          <div>
            <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px">= Valor Contábil Líquido</div>
            <div style="font-size:22px;font-weight:700;color:var(--fa-teal)">${fmt(totalLiq)}</div>
          </div>
          <div>
            <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px">Depreciação Mensal (Comp. ${anoAtual})</div>
            <div style="font-size:22px;font-weight:700;color:var(--orange)">${fmt(depMensal)}</div>
          </div>
        </div>
        <div style="height:240px"><canvas id="afRelChart"></canvas></div>
      </div>
    </div>
  `;

  setTimeout(() => {
    const ctx = document.getElementById('afRelChart');
    if (!ctx) return;
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: meses,
        datasets: [
          { label: 'Valor Líquido Previsto', data: meses.map((_,i) => Math.max(0, totalLiq - depMensal*i)), backgroundColor: 'rgba(0,180,184,0.7)', borderRadius:3 },
          { label: 'Depreciação Acumulada',  data: depAcumMeses.map(d => Math.min(d+totalDepAcum, totalAq)), backgroundColor: 'rgba(249,115,22,0.5)', borderRadius:3 }
        ]
      },
      options: { responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ labels:{color:'var(--text-primary)',font:{size:11}} } },
        scales:{ y:{stacked:false, ticks:{callback:v=>'R$'+Math.abs(v/1000).toFixed(0)+'k',color:'var(--text-muted)',font:{size:10}},grid:{color:'var(--border)'}},
          x:{ticks:{color:'var(--text-muted)',font:{size:10}},grid:{display:false}} }
      }
    });
  }, 100);
}

// ─── Modal Novo Ativo ─────────────────────────────
function _afNovoAtivo(id) {
  const ativos = _getAtivos();
  const a = id ? ativos.find(x => x.id === id) : null;
  const hoje = new Date().toISOString().split('T')[0];

  openModal(`<i class="fas fa-building" style="color:var(--fa-teal);margin-right:8px"></i>${a?'Editar':'Cadastrar'} Ativo Fixo`, `
    <div class="grid-2" style="gap:12px">
      <div class="form-group">
        <label>Código do Bem</label>
        <input class="form-control" id="afNovoCod" placeholder="PAT-001" value="${a?.codigo||''}">
      </div>
      <div class="form-group">
        <label>Descrição *</label>
        <input class="form-control" id="afNovoDesc" placeholder="Ex.: Veículo Toyota Hilux 2022" value="${a?.descricao||''}">
      </div>
      <div class="form-group">
        <label>Categoria *</label>
        <select class="form-control" id="afNovoCat" onchange="_afAtualizarTaxa()">
          ${Object.keys(AF_TAXAS).map(c=>`<option value="${c}" ${c===a?.categoria?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Data de Aquisição *</label>
        <input type="date" class="form-control" id="afNovoData" value="${a?.data_aquisicao||hoje}">
      </div>
      <div class="form-group">
        <label>Valor de Aquisição (R$) *</label>
        <input type="number" step="0.01" class="form-control" id="afNovoValor" placeholder="0.00" value="${a?.valor_aquisicao||''}">
      </div>
      <div class="form-group">
        <label>Taxa Depreciação (% a.a.)</label>
        <input type="number" step="0.1" class="form-control" id="afNovoTaxa"
          placeholder="Ex.: 20" value="${a?.taxa_deprec||AF_TAXAS[a?.categoria||'Outros']?.taxa||20}">
        <small style="color:var(--text-muted);font-size:10px">Preenchido automaticamente pela categoria</small>
      </div>
      <div class="form-group">
        <label>% Valor Residual</label>
        <input type="number" step="0.1" class="form-control" id="afNovoResidual" placeholder="0" value="${a?.pct_residual||0}">
      </div>
      <div class="form-group">
        <label>Nº de Série / Placa</label>
        <input class="form-control" id="afNovoSerie" placeholder="Identificação única" value="${a?.numero_serie||a?.placa||''}">
      </div>
      <div class="form-group">
        <label>Responsável</label>
        <input class="form-control" id="afNovoResp" placeholder="Nome do responsável" value="${a?.responsavel||''}">
      </div>
      <div class="form-group">
        <label>Contrato / Setor</label>
        <input class="form-control" id="afNovoContrato" placeholder="Ex.: CONT-001, Administrativo" value="${a?.contrato||a?.setor||''}">
      </div>
      <div class="form-group">
        <label>Status</label>
        <select class="form-control" id="afNovoStatus">
          ${['Ativo','Inativo','Em Manutenção','Baixado'].map(s=>`<option value="${s}" ${(a?.status||'Ativo')===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Observações</label>
        <textarea class="form-control" id="afNovoObs" rows="2" placeholder="Informações adicionais...">${a?.obs||''}</textarea>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-success" onclick="_afSalvarAtivo('${a?.id||''}')">
      <i class="fas fa-save"></i> Salvar
    </button>
  `);
}

function _afAtualizarTaxa() {
  const cat  = document.getElementById('afNovoCat')?.value;
  const taxa = AF_TAXAS[cat]?.taxa || 20;
  const el   = document.getElementById('afNovoTaxa');
  if (el) el.value = taxa;
}

function _afSalvarAtivo(idExist) {
  const desc   = document.getElementById('afNovoDesc')?.value?.trim();
  const cat    = document.getElementById('afNovoCat')?.value;
  const data   = document.getElementById('afNovoData')?.value;
  const valor  = parseFloat(document.getElementById('afNovoValor')?.value || 0);

  if (!desc || !valor) { showToast('Preencha Descrição e Valor.','error'); return; }

  const ativos = _getAtivos();
  const novo = {
    id: idExist || gerarId('PAT'),
    codigo: document.getElementById('afNovoCod')?.value?.trim(),
    descricao: desc, categoria: cat,
    data_aquisicao: data, valor_aquisicao: valor,
    taxa_deprec: parseFloat(document.getElementById('afNovoTaxa')?.value || AF_TAXAS[cat]?.taxa || 20),
    pct_residual: parseFloat(document.getElementById('afNovoResidual')?.value || 0),
    numero_serie: document.getElementById('afNovoSerie')?.value?.trim(),
    responsavel: document.getElementById('afNovoResp')?.value?.trim(),
    contrato: document.getElementById('afNovoContrato')?.value?.trim(),
    status: document.getElementById('afNovoStatus')?.value || 'Ativo',
    obs: document.getElementById('afNovoObs')?.value?.trim(),
    vida_util: AF_TAXAS[cat]?.vidaUtil || 10,
    criado_em: idExist ? (ativos.find(a=>a.id===idExist)?.criado_em||new Date().toISOString()) : new Date().toISOString()
  };

  if (idExist) {
    const idx = ativos.findIndex(a => a.id === idExist);
    if (idx >= 0) ativos[idx] = novo;
  } else {
    ativos.unshift(novo);
  }
  _saveAtivos(ativos);
  closeModal();
  showToast('Ativo salvo com sucesso!','success');
  renderAtivoFixo();
}

function _afEditarAtivo(id) { _afNovoAtivo(id); }

function _afVerAtivo(id) {
  const ativos = _getAtivos();
  const a = ativos.find(x => x.id === id);
  if (!a) return;
  const d = _afCalcularDeprec(a);
  openModal(`<i class="fas fa-building" style="color:var(--fa-teal);margin-right:8px"></i>${a.descricao}`, `
    <div class="grid-2" style="gap:12px;font-size:13px">
      ${[
        ['Código', a.codigo||'—'], ['Categoria', a.categoria||'—'],
        ['Data Aquisição', a.data_aquisicao||'—'], ['Status', a.status||'Ativo'],
        ['Valor de Aquisição', fmt(a.valor_aquisicao||0)], ['Valor Líquido Atual', fmt(d.vlrLiquido)],
        ['Depreciação Acumulada', fmt(d.depAcum)], ['% Depreciado', d.pctDepreciado.toFixed(1)+'%'],
        ['Taxa Anual', (a.taxa_deprec||10)+'% a.a.'], ['Vida Útil', d.vidaUtil+' anos'],
        ['Anos de Uso', d.anos.toFixed(1)+' anos'], ['Vida Restante', Math.max(0,d.vidaUtil-d.anos).toFixed(1)+' anos'],
        ['Responsável', a.responsavel||'—'], ['Contrato/Setor', a.contrato||a.setor||'—'],
        ['Nº Série / Placa', a.numero_serie||a.placa||'—'], ['Observações', a.obs||'—'],
      ].map(([k,v]) => `
        <div class="stat-row"><span class="stat-label">${k}</span><span class="stat-value">${v}</span></div>
      `).join('')}
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
      ${hasPermission('financeiro','create') ? `<button class="btn btn-success" onclick="closeModal();_afEditarAtivo('${id}')"><i class="fas fa-edit"></i> Editar</button>` : ''}`);
}

function _afNovaManutencao() {
  const ativos = _getAtivos();
  const hoje = new Date().toISOString().split('T')[0];
  openModal(`<i class="fas fa-tools" style="color:var(--fa-teal);margin-right:8px"></i>Registrar Manutenção`, `
    <div class="grid-2" style="gap:12px">
      <div class="form-group">
        <label>Ativo *</label>
        <select class="form-control" id="afMat_ativo">
          ${ativos.map(a=>`<option value="${a.id}">${a.descricao||a.id}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Tipo de Manutenção</label>
        <select class="form-control" id="afMat_tipo">
          ${['Preventiva','Corretiva','Preditiva','Revisão','Troca de Peças','Outros'].map(t=>`<option>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Data</label>
        <input type="date" class="form-control" id="afMat_data" value="${hoje}">
      </div>
      <div class="form-group">
        <label>Custo (R$)</label>
        <input type="number" step="0.01" class="form-control" id="afMat_custo" placeholder="0.00">
      </div>
      <div class="form-group">
        <label>Responsável</label>
        <input class="form-control" id="afMat_resp" placeholder="Técnico responsável">
      </div>
      <div class="form-group">
        <label>Status</label>
        <select class="form-control" id="afMat_status">
          ${['Concluída','Agendada','Em Andamento','Cancelada'].map(s=>`<option>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Descrição dos Serviços</label>
        <textarea class="form-control" id="afMat_desc" rows="2" placeholder="Detalhe os serviços realizados..."></textarea>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-success" onclick="_afSalvarManutencao()"><i class="fas fa-save"></i> Salvar</button>
  `);
}

function _afSalvarManutencao() {
  const ativo_id  = document.getElementById('afMat_ativo')?.value;
  const tipo      = document.getElementById('afMat_tipo')?.value;
  const data      = document.getElementById('afMat_data')?.value;
  const custo     = parseFloat(document.getElementById('afMat_custo')?.value || 0);
  const resp      = document.getElementById('afMat_resp')?.value?.trim();
  const status    = document.getElementById('afMat_status')?.value;
  const desc      = document.getElementById('afMat_desc')?.value?.trim();

  const manutencoes = _getManutencoes();
  manutencoes.unshift({ id: gerarId('MNT'), ativo_id, tipo, data, custo, responsavel:resp, status, descricao:desc, criado_em: new Date().toISOString() });
  _saveManutencoes(manutencoes);
  closeModal();
  showToast('Manutenção registrada!','success');
  _afRenderAba();
}

function _afExportar() {
  const ativos = _getAtivos();
  const headers = ['Código','Descrição','Categoria','Data Aquisição','Valor Aquisição','Valor Líquido','Depreciação Acum.','% Depreciado','Taxa %a.a.','Responsável','Status'];
  const rows = ativos.map(a => {
    const d = _afCalcularDeprec(a);
    return [a.codigo, a.descricao, a.categoria, a.data_aquisicao, a.valor_aquisicao, d.vlrLiquido.toFixed(2), d.depAcum.toFixed(2), d.pctDepreciado.toFixed(1), a.taxa_deprec||10, a.responsavel, a.status];
  });
  const csv = [headers,...rows].map(r=>r.map(v=>'"'+(v||'').toString().replace(/"/g,'""')+'"').join(';')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
  a.download = 'ativo_fixo.csv';
  a.click();
  showToast('Exportação concluída!','success');
}
