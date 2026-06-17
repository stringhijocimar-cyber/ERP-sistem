// =====================================================================
// ERP – Módulo Análise Competitiva de Mercado v2.0
// UX totalmente renovada: cards interativos, animações, filtros,
// radar comparison, heat-map, modalidades de visualização
// =====================================================================

let _cmpAba    = 'visao_geral';
let _cmpCharts = {};
let _cmpFiltroTier = 'todos';
let _cmpSelectedERP = null;

// ─── Base de dados dos ERPs ──────────────────────────────────────────
const CMP_ERPS = {
  fraser: {
    nome: 'Fraser Alexander ERP',
    logo: '🏗️',
    segmento: 'Vertical (Engenharia/Mineração)',
    origem: 'Brasil 🇧🇷',
    modelo: 'SaaS / Edge (Cloudflare)',
    tier: 'PME–Médio Porte',
    cor: '#4f46e5',
    corClara: '#ede9fe',
    rank: 3,
    total: 72,
    descricao: 'ERP vertical desenvolvido para empresas de engenharia, construção pesada e mineração. Cobertura end-to-end do ciclo de contratos, operações de campo, suprimentos e compliance.',
    pontos_fortes: [
      'Aderência vertical total: OS→RC→RFQ→Mapa→PED→Almox',
      'Ciclo de contratos completo com Gantt, WBS e medições',
      'Módulo SSMA com incidentes, treinamentos e equipamentos',
      'IDF – Índice de Desenvolvimento de Fornecedores (único)',
      'Multi-empresa / Multi-CNPJ nativo',
      'KPI Executivo com alertas inteligentes cruzados',
      'Fiscal BR: NF-e, SPED, guias, agenda fiscal',
      'Ativo Fixo com depreciação automática (tabela RFB)',
      'DRE + Fluxo de Caixa Projetado integrado',
      'Arquitetura edge-first (Cloudflare Workers)',
      'Custo marginal próximo de zero após deploy',
      'i18n PT/EN/ES nativo',
    ],
    pontos_fracos: [
      'Sem integração nativa real com SEFAZ',
      'Contabilidade formal (razão, balanço) ausente',
      'Sem módulo de Folha de Pagamento / eSocial',
      'Manufatura / MRP / PCP não coberto',
      'Integrações bancárias (OFX/CNAB) não implementadas',
      'Marketplace de ISVs inexistente',
      'Aplicativo móvel nativo ausente (PWA parcial)',
    ],
    scores: { funcionalidade:72, fiscal_br:68, integracao:45, ux:88, custo_beneficio:95, implantacao:90, suporte:40, escalabilidade:60 },
    custo_impl: 'R$ 0 – R$ 50k',
    custo_mensal: 'R$ 0 – R$ 5k/mês',
    tempo_impl: '1–4 semanas',
    usuarios_ideais: '5–200',
    deployments: 'Cloud (Edge)',
    integracao_fiscal: 'Parcial',
    suporte_br: '⭐⭐⭐',
  },
  sap: {
    nome: 'SAP S/4HANA Cloud',
    logo: '🔷',
    segmento: 'Horizontal – Todos setores',
    origem: 'Alemanha 🇩🇪',
    modelo: 'SaaS / RISE / On-Premise',
    tier: 'Grande Porte',
    cor: '#0070f3',
    corClara: '#dbeafe',
    rank: 1,
    total: 88,
    descricao: 'Líder global absoluto. Plataforma ERP mais completa do mercado com cobertura de 100% dos processos empresariais.',
    pontos_fortes: [
      'Cobertura funcional completa (100% dos processos)',
      'Fiscal BR via SAP LFCA / NFe add-on',
      'Integração nativa com bancos, BACEN e EDI',
      'Ecossistema SAP Store – milhares de ISVs',
      'In-Memory HANA – analytics em tempo real',
      'SAP BTP para extensibilidade clean-core',
      'Referência global para auditoria e compliance',
    ],
    pontos_fracos: [
      'Custo de implantação R$ 2M – R$ 30M+',
      'Time-to-value 12–36 meses',
      'Altíssima complexidade operacional',
      'Dependência de consultores SAP (pool reduzido no Brasil)',
    ],
    scores: { funcionalidade:96, fiscal_br:88, integracao:92, ux:70, custo_beneficio:30, implantacao:25, suporte:85, escalabilidade:98 },
    custo_impl: 'R$ 2M – R$ 30M+',
    custo_mensal: 'R$ 50k – R$ 500k/mês',
    tempo_impl: '12–36 meses',
    usuarios_ideais: '500+',
    deployments: 'Cloud / On-Premise / Hybrid',
    integracao_fiscal: 'Completa',
    suporte_br: '⭐⭐⭐⭐⭐',
  },
  oracle: {
    nome: 'Oracle Fusion Cloud',
    logo: '🔴',
    segmento: 'Horizontal – Todos setores',
    origem: 'EUA 🇺🇸',
    modelo: 'SaaS / Cloud',
    tier: 'Grande Porte',
    cor: '#c0392b',
    corClara: '#fde8e8',
    rank: 2,
    total: 81,
    descricao: '2º maior ERP global. Forte em finanças, supply chain e manufatura. Liderança em analytics e AI.',
    pontos_fortes: [
      'Analytics e BI avançados nativos',
      'Supply Chain Management líder de mercado',
      'Integração com Oracle Cloud Infrastructure',
      'AI/ML integrado em todos os módulos',
      'Fiscal BR via parceiros certificados',
    ],
    pontos_fracos: [
      'Custo elevado de licença e implantação',
      'Ecossistema menor que SAP no Brasil',
      'Customização limitada no modelo SaaS puro',
    ],
    scores: { funcionalidade:90, fiscal_br:72, integracao:88, ux:72, custo_beneficio:32, implantacao:28, suporte:80, escalabilidade:96 },
    custo_impl: 'R$ 1.5M – R$ 20M+',
    custo_mensal: 'R$ 40k – R$ 300k/mês',
    tempo_impl: '12–24 meses',
    usuarios_ideais: '300+',
    deployments: 'Cloud',
    integracao_fiscal: 'Via parceiro',
    suporte_br: '⭐⭐⭐⭐',
  },
  dynamics: {
    nome: 'Microsoft Dynamics 365',
    logo: '🟦',
    segmento: 'Horizontal – Médio/Grande Porte',
    origem: 'EUA 🇺🇸',
    modelo: 'SaaS / On-Premise / Hybrid',
    tier: 'Médio–Grande Porte',
    cor: '#0078d4',
    corClara: '#e3f2fd',
    rank: 6,
    total: 69,
    descricao: 'ERP da Microsoft com forte integração ao ecossistema Microsoft (Teams, Azure, Power BI, Copilot).',
    pontos_fortes: [
      'Integração nativa com Microsoft 365 e Teams',
      'Power BI e Power Automate nativos',
      'Copilot (AI) integrado a todos os módulos',
      'Modelo de licenciamento flexível por módulo',
    ],
    pontos_fracos: [
      'Fiscal BR apenas via parceiros (poucos certificados)',
      'Complexidade alta de configuração',
      'Suporte Brasil limitado comparado a SAP/TOTVS',
    ],
    scores: { funcionalidade:78, fiscal_br:55, integracao:82, ux:75, custo_beneficio:55, implantacao:45, suporte:68, escalabilidade:82 },
    custo_impl: 'R$ 200k – R$ 3M',
    custo_mensal: 'R$ 8k – R$ 80k/mês',
    tempo_impl: '6–18 meses',
    usuarios_ideais: '50–500',
    deployments: 'Cloud / Hybrid',
    integracao_fiscal: 'Via parceiro',
    suporte_br: '⭐⭐⭐',
  },
  totvs: {
    nome: 'TOTVS Protheus / Fluig',
    logo: '🇧🇷',
    segmento: 'Horizontal – Foco Brasil',
    origem: 'Brasil 🇧🇷',
    modelo: 'On-Premise / SaaS',
    tier: 'PME–Grande Porte',
    cor: '#d9534f',
    corClara: '#fdecea',
    rank: 4,
    total: 71,
    descricao: 'Líder nacional no Brasil. Forte histórico fiscal-contábil. Mais de 45 anos de mercado e ampla rede de parceiros.',
    pontos_fortes: [
      'Cobertura fiscal BR líder (NFe, NFSe, CTe, SPED)',
      'Folha de Pagamento + eSocial nativo',
      'Contabilidade completa (SPED Contábil)',
      'Maior rede de parceiros no Brasil',
      'Suporte em português 24/7',
    ],
    pontos_fracos: [
      'Interface desatualizada (legado Protheus)',
      'Custo alto de manutenção on-premise',
      'Complexidade de customizações (ADVPL)',
      'Migração para TOTVS Carol (cloud) ainda em maturação',
    ],
    scores: { funcionalidade:74, fiscal_br:95, integracao:65, ux:58, custo_beneficio:52, implantacao:48, suporte:88, escalabilidade:70 },
    custo_impl: 'R$ 150k – R$ 2M',
    custo_mensal: 'R$ 5k – R$ 50k/mês',
    tempo_impl: '4–18 meses',
    usuarios_ideais: '20–1000',
    deployments: 'On-Premise / Cloud',
    integracao_fiscal: 'Completa (líder BR)',
    suporte_br: '⭐⭐⭐⭐⭐',
  },
  senior: {
    nome: 'Senior Sistemas',
    logo: '🟤',
    segmento: 'RH / Operações – Brasil',
    origem: 'Brasil 🇧🇷',
    modelo: 'SaaS / On-Premise',
    tier: 'PME–Médio Porte',
    cor: '#8b4513',
    corClara: '#fdf0e0',
    rank: 8,
    total: 64,
    descricao: 'Especialista em RH, Folha e HCM no Brasil. Forte em gestão de pessoas e controle de acesso.',
    pontos_fortes: [
      'Folha de Pagamento + eSocial referência BR',
      'Controle de ponto e acesso integrado',
      'HCM completo (Recrutamento, Treinamento)',
      'ERP operacional para médio porte',
    ],
    pontos_fracos: [
      'Módulos financeiros e de compras limitados',
      'Fraco em projetos e contratos',
      'Fiscal limitado fora do escopo RH',
    ],
    scores: { funcionalidade:60, fiscal_br:72, integracao:58, ux:62, custo_beneficio:65, implantacao:60, suporte:75, escalabilidade:58 },
    custo_impl: 'R$ 50k – R$ 500k',
    custo_mensal: 'R$ 2k – R$ 20k/mês',
    tempo_impl: '3–12 meses',
    usuarios_ideais: '20–500',
    deployments: 'Cloud / On-Premise',
    integracao_fiscal: 'Parcial (foco RH)',
    suporte_br: '⭐⭐⭐⭐',
  },
  odoo: {
    nome: 'Odoo Enterprise',
    logo: '🟣',
    segmento: 'Horizontal – Open Source',
    origem: 'Bélgica 🇧🇪',
    modelo: 'SaaS / On-Premise / Community',
    tier: 'PME',
    cor: '#714B67',
    corClara: '#f3e8f7',
    rank: 5,
    total: 70,
    descricao: 'ERP open-source líder global para PMEs. Custo acessível, ecossistema vasto de módulos.',
    pontos_fortes: [
      'Custo-benefício excelente para PMEs',
      'Mais de 30 módulos nativos integrados',
      'Marketplace com +16k extensões',
      'Comunidade global ativa',
      'Adaptações fiscais BR disponíveis (OCA)',
    ],
    pontos_fracos: [
      'Localizações BR menos maduras que TOTVS',
      'Suporte oficial no Brasil limitado',
      'Customizações pesadas podem travar upgrades',
    ],
    scores: { funcionalidade:76, fiscal_br:60, integracao:70, ux:72, custo_beneficio:82, implantacao:65, suporte:55, escalabilidade:72 },
    custo_impl: 'R$ 20k – R$ 300k',
    custo_mensal: 'R$ 1k – R$ 15k/mês',
    tempo_impl: '2–12 meses',
    usuarios_ideais: '5–300',
    deployments: 'Cloud / On-Premise / Hybrid',
    integracao_fiscal: 'Parcial (via OCA)',
    suporte_br: '⭐⭐',
  },
  infor: {
    nome: 'Infor CloudSuite',
    logo: '⚙️',
    segmento: 'Vertical – Manufatura/Construção',
    origem: 'EUA 🇺🇸',
    modelo: 'SaaS / Cloud',
    tier: 'Grande Porte',
    cor: '#e67e22',
    corClara: '#fef3e2',
    rank: 7,
    total: 66,
    descricao: 'ERP vertical especializado em manufatura, construção e distribuição. Forte nos EUA e Europa.',
    pontos_fortes: [
      'Especialização em manufatura e construção',
      'WMS e supply chain avançados',
      'AI/ML com Infor Coleman',
      'Infraestrutura AWS gerenciada',
    ],
    pontos_fracos: [
      'Fraco suporte à legislação brasileira',
      'Pool de consultores muito limitado no BR',
      'Alto custo de localização fiscal BR',
    ],
    scores: { funcionalidade:74, fiscal_br:38, integracao:72, ux:65, custo_beneficio:38, implantacao:35, suporte:60, escalabilidade:85 },
    custo_impl: 'R$ 500k – R$ 5M',
    custo_mensal: 'R$ 20k – R$ 150k/mês',
    tempo_impl: '9–24 meses',
    usuarios_ideais: '100–2000',
    deployments: 'Cloud (AWS)',
    integracao_fiscal: 'Fraca',
    suporte_br: '⭐⭐',
  },
};

const CMP_CRITERIOS = {
  funcionalidade:  { label: 'Funcionalidade',    icon: 'fa-cogs',          peso: 20 },
  fiscal_br:       { label: 'Fiscal BR',          icon: 'fa-file-invoice',  peso: 18 },
  integracao:      { label: 'Integração',         icon: 'fa-plug',          peso: 12 },
  ux:              { label: 'UX / Usabilidade',   icon: 'fa-desktop',       peso: 15 },
  custo_beneficio: { label: 'Custo-Benefício',    icon: 'fa-dollar-sign',   peso: 15 },
  implantacao:     { label: 'Velocidade Impl.',   icon: 'fa-rocket',        peso: 10 },
  suporte:         { label: 'Suporte BR',         icon: 'fa-headset',       peso: 5  },
  escalabilidade:  { label: 'Escalabilidade',     icon: 'fa-expand-arrows-alt', peso: 5 },
};

// ─── RENDER PRINCIPAL ─────────────────────────────────────────────────
function renderComparativoERP() {
  const el = document.getElementById('mainContent');
  if (!el) return;

  el.innerHTML = `
    <div class="page-header" style="margin-bottom:0;padding-bottom:0">
      <div class="page-title">
        <i class="fas fa-chart-bar page-icon"></i>
        <div>
          <h1>Análise Competitiva de Mercado</h1>
          <p class="page-subtitle">Benchmark Fraser Alexander ERP vs. Principais ERPs — Atualizado abr/2026</p>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-outline-primary btn-sm" onclick="_cmpExportarRelatorio()">
          <i class="fas fa-file-pdf"></i> Exportar PDF
        </button>
        <button class="btn btn-primary btn-sm" onclick="_cmpAbrirComparador()">
          <i class="fas fa-sliders-h"></i> Comparar ERPs
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="cmp-tab-nav" style="display:flex;gap:4px;padding:16px 0 0;border-bottom:2px solid var(--border-color);margin-bottom:20px;overflow-x:auto;scrollbar-width:none">
      ${[
        {k:'visao_geral',   i:'fa-th-large',           l:'Visão Geral'},
        {k:'radar',         i:'fa-spider',              l:'Radar'},
        {k:'tabela',        i:'fa-table',               l:'Tabela'},
        {k:'vantagens',     i:'fa-trophy',              l:'Vantagens'},
        {k:'lacunas',       i:'fa-exclamation-triangle',l:'Lacunas & Riscos'},
        {k:'oportunidades',  i:'fa-rocket',              l:'Oportunidades'},
        {k:'melhorias',     i:'fa-tasks',               l:'Recomendações'},
        {k:'roadmap',       i:'fa-road',                l:'Roadmap'},
        {k:'perfil',        i:'fa-user-tie',            l:'Por Perfil'},
      ].map(t=>`
        <button onclick="_cmpNavTab('${t.k}')" id="cmp-tab-${t.k}"
          style="white-space:nowrap;padding:8px 16px;border:none;background:transparent;cursor:pointer;font-size:13px;font-weight:600;color:${_cmpAba===t.k?'var(--primary)':'var(--text-secondary)'};border-bottom:${_cmpAba===t.k?'3px solid var(--primary)':'3px solid transparent'};margin-bottom:-2px;transition:all .2s;border-radius:6px 6px 0 0;">
          <i class="fas ${t.i}" style="margin-right:6px"></i>${t.l}
        </button>
      `).join('')}
    </div>

    <!-- Conteúdo da aba -->
    <div id="cmp-aba-content">
      ${_cmpRenderAba(_cmpAba)}
    </div>
  `;

  setTimeout(() => _cmpInitCharts(), 200);
}

function _cmpNavTab(k) {
  _cmpAba = k;
  // Atualiza tabs
  document.querySelectorAll('[id^="cmp-tab-"]').forEach(btn => {
    const isActive = btn.id === `cmp-tab-${k}`;
    btn.style.color = isActive ? 'var(--primary)' : 'var(--text-secondary)';
    btn.style.borderBottom = isActive ? '3px solid var(--primary)' : '3px solid transparent';
  });
  const el = document.getElementById('cmp-aba-content');
  if (el) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => {
      el.innerHTML = _cmpRenderAba(k);
      el.style.transition = 'opacity .25s ease, transform .25s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
      setTimeout(() => _cmpInitCharts(), 150);
    }, 150);
  }
}

function _cmpRenderAba(k) {
  switch(k) {
    case 'visao_geral': return _cmpRenderVisaoGeral();
    case 'radar':       return _cmpRenderRadar();
    case 'tabela':      return _cmpRenderTabela();
    case 'vantagens':   return _cmpRenderVantagens();
    case 'lacunas':     return _cmpRenderLacunas();
    case 'oportunidades': return _cmpRenderOportunidades();
    case 'melhorias':   return _cmpRenderMelhorias();
    case 'roadmap':     return _cmpRenderRoadmap();
    case 'perfil':      return _cmpRenderPerfil();
    default:            return _cmpRenderVisaoGeral();
  }
}

// ─── ABA: VISÃO GERAL ─────────────────────────────────────────────────
function _cmpRenderVisaoGeral() {
  const erps = Object.entries(CMP_ERPS).sort((a,b) => a[1].rank - b[1].rank);
  return `
    <!-- Banner destaque Fraser -->
    <div style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#2563eb 100%);border-radius:16px;padding:24px 28px;margin-bottom:24px;color:#fff;position:relative;overflow:hidden">
      <div style="position:absolute;right:-20px;top:-20px;width:180px;height:180px;background:rgba(255,255,255,0.06);border-radius:50%"></div>
      <div style="position:absolute;right:60px;bottom:-30px;width:120px;height:120px;background:rgba(255,255,255,0.04);border-radius:50%"></div>
      <div style="position:relative;display:flex;align-items:center;gap:24px;flex-wrap:wrap">
        <div style="font-size:52px">🏗️</div>
        <div style="flex:1;min-width:200px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;opacity:.7;margin-bottom:4px">Seu sistema atual</div>
          <div style="font-size:22px;font-weight:800;margin-bottom:4px">Fraser Alexander ERP</div>
          <div style="font-size:13px;opacity:.85">ERP Vertical · Engenharia & Mineração · Edge-first · Multi-empresa</div>
        </div>
        <div style="display:flex;gap:20px;flex-wrap:wrap">
          <div style="text-align:center">
            <div style="font-size:40px;font-weight:900;line-height:1">72</div>
            <div style="font-size:11px;opacity:.7">Score Geral</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:40px;font-weight:900;line-height:1">#3</div>
            <div style="font-size:11px;opacity:.7">Ranking</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:40px;font-weight:900;line-height:1">95</div>
            <div style="font-size:11px;opacity:.7">Custo-Ben.</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:40px;font-weight:900;line-height:1">88</div>
            <div style="font-size:11px;opacity:.7">UX Score</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Filtro tier -->
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
      <span style="font-size:12px;color:var(--text-muted);font-weight:600">FILTRAR:</span>
      ${['todos','PME','médio','grande'].map(t=>`
        <button onclick="_cmpFiltrar('${t}')" style="padding:4px 12px;border-radius:20px;border:1px solid ${_cmpFiltroTier===t?'var(--primary)':'var(--border-color)'};background:${_cmpFiltroTier===t?'var(--primary)':'transparent'};color:${_cmpFiltroTier===t?'#fff':'var(--text-secondary)'};font-size:12px;font-weight:600;cursor:pointer;transition:all .2s">
          ${t==='todos'?'Todos os ERPs':t.charAt(0).toUpperCase()+t.slice(1)+' Porte'}
        </button>
      `).join('')}
    </div>

    <!-- Cards de ERPs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-bottom:24px" id="cmp-cards-grid">
      ${erps.map(([k,e]) => `
        <div onclick="_cmpDetalheERP('${k}')" style="background:var(--bg-card);border-radius:14px;border:2px solid ${k==='fraser'?e.cor:'var(--border-color)'};padding:20px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden" 
          onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.12)'"
          onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'">
          ${k==='fraser'?`<div style="position:absolute;top:8px;right:8px;background:#4f46e5;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">SEU SISTEMA</div>`:''}
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
            <div style="font-size:28px">${e.logo}</div>
            <div>
              <div style="font-weight:700;font-size:13px;color:var(--text-primary);line-height:1.2">${e.nome}</div>
              <div style="font-size:11px;color:var(--text-muted)">${e.tier} · ${e.origem}</div>
            </div>
          </div>
          
          <!-- Score total com barra animada -->
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="font-size:11px;color:var(--text-muted)">Score Total</span>
              <span style="font-size:14px;font-weight:800;color:${e.cor}">${e.total}/100</span>
            </div>
            <div style="height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${e.total}%;background:${e.cor};border-radius:3px;transition:width 1s ease"></div>
            </div>
          </div>

          <!-- Mini scores -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            ${Object.entries(CMP_CRITERIOS).slice(0,4).map(([ck,cv]) => `
              <div style="background:var(--bg-tertiary);border-radius:6px;padding:6px 8px">
                <div style="font-size:10px;color:var(--text-muted);margin-bottom:2px">${cv.label.split(' ')[0]}</div>
                <div style="font-size:13px;font-weight:700;color:${_cmpCorScore(e.scores[ck])}">${e.scores[ck]}</div>
              </div>
            `).join('')}
          </div>

          <div style="margin-top:12px;font-size:11px;color:var(--text-muted);display:flex;justify-content:space-between">
            <span>⏱ ${e.tempo_impl}</span>
            <span>💰 ${e.custo_impl.split('–')[0].trim()}</span>
          </div>

          <div style="text-align:center;margin-top:10px">
            <span style="font-size:11px;color:${e.cor};font-weight:600">Ver detalhes →</span>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Gráfico bar comparativo rápido -->
    <div style="background:var(--bg-card);border-radius:14px;border:1px solid var(--border-color);padding:20px">
      <h3 style="font-size:14px;font-weight:700;margin-bottom:16px"><i class="fas fa-chart-bar" style="color:var(--primary);margin-right:8px"></i>Score Geral por ERP</h3>
      <canvas id="cmp-bar-chart" height="80"></canvas>
    </div>
  `;
}

function _cmpFiltrar(tier) {
  _cmpFiltroTier = tier;
  renderComparativoERP();
}

function _cmpCorScore(v) {
  if (v >= 80) return '#16a34a';
  if (v >= 60) return '#ca8a04';
  return '#dc2626';
}

// ─── ABA: RADAR ──────────────────────────────────────────────────────
function _cmpRenderRadar() {
  const erpsKeys = ['fraser','sap','totvs','odoo'];
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div style="background:var(--bg-card);border-radius:14px;border:1px solid var(--border-color);padding:20px">
        <h3 style="font-size:14px;font-weight:700;margin-bottom:4px"><i class="fas fa-spider" style="color:var(--primary);margin-right:8px"></i>Radar Competitivo</h3>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px">Fraser Alexander vs. concorrentes-chave</p>
        <div style="position:relative;height:320px">
          <canvas id="cmp-radar-chart"></canvas>
        </div>
        <!-- Legenda -->
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px">
          ${erpsKeys.map(k=>`
            <div style="display:flex;align-items:center;gap:6px">
              <div style="width:12px;height:12px;border-radius:2px;background:${CMP_ERPS[k].cor}"></div>
              <span style="font-size:11px;color:var(--text-muted)">${CMP_ERPS[k].nome.split(' ').slice(0,2).join(' ')}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div style="background:var(--bg-card);border-radius:14px;border:1px solid var(--border-color);padding:20px">
        <h3 style="font-size:14px;font-weight:700;margin-bottom:4px"><i class="fas fa-balance-scale" style="color:var(--primary);margin-right:8px"></i>Comparação por Critério</h3>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px">Fraser Alexander destacado</p>
        ${Object.entries(CMP_CRITERIOS).map(([k,c]) => `
          <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="font-size:12px;font-weight:600;color:var(--text-primary)"><i class="fas ${c.icon}" style="margin-right:6px;color:var(--text-muted)"></i>${c.label}</span>
              <span style="font-size:11px;color:var(--text-muted)">Peso: ${c.peso}%</span>
            </div>
            <div style="display:flex;gap:4px;align-items:center">
              ${Object.entries(CMP_ERPS).map(([ek,e]) => `
                <div title="${e.nome}: ${e.scores[k]}" style="flex:1;height:24px;background:${ek==='fraser'?e.cor:'var(--bg-tertiary)'};border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:default;transition:all .2s;opacity:${ek==='fraser'?1:0.7}"
                  onmouseover="this.style.opacity='1';this.style.transform='scaleY(1.15)'"
                  onmouseout="this.style.opacity='${ek==='fraser'?1:0.7}';this.style.transform='scaleY(1)'">
                  <span style="font-size:9px;font-weight:700;color:${ek==='fraser'?'#fff':'var(--text-muted)'}">${e.scores[k]}</span>
                </div>
              `).join('')}
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:2px">
              ${Object.entries(CMP_ERPS).map(([ek,e]) => `<span style="flex:1;font-size:8px;color:var(--text-muted);text-align:center">${e.logo}</span>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ─── ABA: TABELA ─────────────────────────────────────────────────────
function _cmpRenderTabela() {
  const erps = Object.entries(CMP_ERPS).sort((a,b) => a[1].rank - b[1].rank);
  const criterios = Object.entries(CMP_CRITERIOS);
  return `
    <div style="background:var(--bg-card);border-radius:14px;border:1px solid var(--border-color);overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center">
        <h3 style="font-size:14px;font-weight:700"><i class="fas fa-table" style="color:var(--primary);margin-right:8px"></i>Matriz Comparativa Completa</h3>
        <span style="font-size:12px;color:var(--text-muted)">🟢 ≥80 · 🟡 60-79 · 🔴 &lt;60</span>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:900px">
          <thead>
            <tr style="background:var(--bg-tertiary)">
              <th style="padding:12px 14px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;white-space:nowrap">CRITÉRIO</th>
              ${erps.map(([k,e]) => `
                <th style="padding:12px 10px;text-align:center;font-size:11px;color:${k==='fraser'?e.cor:'var(--text-muted)'};font-weight:700;min-width:90px;border-bottom:3px solid ${k==='fraser'?e.cor:'transparent'}">
                  <div style="font-size:16px">${e.logo}</div>
                  <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px">${e.nome.split(' ').slice(0,2).join(' ')}</div>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${criterios.map(([ck,cv], idx) => `
              <tr style="background:${idx%2===0?'transparent':'var(--bg-tertiary)'}">
                <td style="padding:10px 14px;font-size:12px;font-weight:600;color:var(--text-primary);white-space:nowrap">
                  <i class="fas ${cv.icon}" style="width:16px;color:var(--text-muted);margin-right:6px"></i>${cv.label}
                  <span style="font-size:10px;color:var(--text-muted);margin-left:4px">(${cv.peso}%)</span>
                </td>
                ${erps.map(([ek,e]) => {
                  const s = e.scores[ck];
                  const bg = s>=80?'rgba(22,163,74,0.12)':s>=60?'rgba(202,138,4,0.12)':'rgba(220,38,38,0.1)';
                  const clr = s>=80?'#16a34a':s>=60?'#ca8a04':'#dc2626';
                  return `<td style="padding:10px;text-align:center;background:${ek==='fraser'?`rgba(79,70,229,0.08)`:bg}">
                    <span style="font-size:14px;font-weight:800;color:${ek==='fraser'?CMP_ERPS[ek].cor:clr}">${s}</span>
                  </td>`;
                }).join('')}
              </tr>
            `).join('')}
            <!-- Linha total -->
            <tr style="background:var(--bg-tertiary);border-top:2px solid var(--border-color)">
              <td style="padding:12px 14px;font-size:13px;font-weight:800;color:var(--text-primary)">
                <i class="fas fa-star" style="color:#f59e0b;margin-right:6px"></i>SCORE TOTAL
              </td>
              ${erps.map(([ek,e]) => `
                <td style="padding:12px 10px;text-align:center">
                  <div style="display:inline-block;background:${e.cor};color:#fff;font-size:16px;font-weight:900;padding:4px 12px;border-radius:8px">${e.total}</div>
                </td>
              `).join('')}
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Heat-map visual -->
    <div style="background:var(--bg-card);border-radius:14px;border:1px solid var(--border-color);padding:20px;margin-top:16px">
      <h3 style="font-size:14px;font-weight:700;margin-bottom:16px"><i class="fas fa-th" style="color:var(--primary);margin-right:8px"></i>Heat-map de Posicionamento</h3>
      <canvas id="cmp-bubble-chart" height="120"></canvas>
    </div>
  `;
}

// ─── ABA: VANTAGENS ───────────────────────────────────────────────────
function _cmpRenderVantagens() {
  const vantagens = [
    { icon:'fa-route', title:'Fluxo Vertical Nativo', desc:'OS → RC → RFQ → Mapa de Cotação → Pedido → Almoxarifado — integração end-to-end exclusiva para obras e projetos, sem necessidade de customização.', score:95, categoria:'Diferencial Único' },
    { icon:'fa-file-contract', title:'Ciclo Completo de Contratos', desc:'Gantt integrado, WBS, múltiplos contratos simultâneos, medições de campo, faturamento vinculado e contas a receber em um único ambiente.', score:90, categoria:'Diferencial Único' },
    { icon:'fa-chart-bar', title:'IDF – Índice de Desenvolvimento', desc:'Módulo exclusivo de avaliação de fornecedores com critérios técnicos, financeiros e de sustentabilidade. Não existe em nenhum ERP concorrente.', score:100, categoria:'Exclusivo' },
    { icon:'fa-bolt', title:'Edge Computing (Cloudflare)', desc:'Zero latência global graças à arquitetura edge-first. Menor custo de infraestrutura por usuário ativo. Disponível em 300+ PoPs mundiais.', score:95, categoria:'Tecnológico' },
    { icon:'fa-rocket', title:'Time-to-Value Extremo', desc:'Deploy em 1–4 semanas vs. 12–36 meses dos concorrentes enterprise. Empresas em obras remotas operam desde o dia 1.', score:95, categoria:'Vantagem Operacional' },
    { icon:'fa-dollar-sign', title:'Custo-Benefício Superior', desc:'Score 95/100 em custo-benefício — maior do ranking. Investimento inicial zero (SaaS) e custo marginal próximo de zero após o deploy.', score:95, categoria:'Econômico' },
    { icon:'fa-desktop', title:'UX Moderna', desc:'Score 88/100 em UX — melhor entre ERPs brasileiros. Interface responsiva, dark mode, i18n PT/EN/ES, sem dependências de plugins legados.', score:88, categoria:'Tecnológico' },
    { icon:'fa-hard-hat', title:'SSMA Nativo', desc:'Módulo de Saúde, Segurança e Meio Ambiente com registro de incidentes, treinamentos e controle de EPIs. Diferencial crítico para licitações de mineração.', score:88, categoria:'Compliance' },
    { icon:'fa-robot', title:'Auditoria Inteligente com IA', desc:'Algoritmos de detecção de anomalias em compras, desvios de WBS e alertas proativos. Única solução no segmento com IA embarcada nativa.', score:85, categoria:'Tecnológico' },
    { icon:'fa-building', title:'Multi-Empresa / Multi-CNPJ', desc:'Gestão unificada de múltiplos CNPJs em uma única tela. Essencial para grupos econômicos com obras em diferentes estados e regimes tributários.', score:85, categoria:'Diferencial Único' },
  ];

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      ${vantagens.map((v,i) => `
        <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:18px;transition:all .2s;cursor:default"
          onmouseover="this.style.borderColor='var(--primary)';this.style.boxShadow='0 4px 16px rgba(79,70,229,0.12)'"
          onmouseout="this.style.borderColor='var(--border-color)';this.style.boxShadow='none'">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:38px;height:38px;border-radius:10px;background:rgba(79,70,229,0.1);display:flex;align-items:center;justify-content:center">
                <i class="fas ${v.icon}" style="color:#4f46e5;font-size:16px"></i>
              </div>
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${v.title}</div>
                <span style="font-size:10px;background:rgba(79,70,229,0.1);color:#4f46e5;padding:1px 8px;border-radius:10px;font-weight:600">${v.categoria}</span>
              </div>
            </div>
            <div style="font-size:20px;font-weight:900;color:${_cmpCorScore(v.score)}">${v.score}</div>
          </div>
          <p style="font-size:12px;color:var(--text-secondary);line-height:1.6;margin:0">${v.desc}</p>
          <div style="height:4px;background:var(--bg-tertiary);border-radius:2px;margin-top:12px;overflow:hidden">
            <div style="height:100%;width:${v.score}%;background:linear-gradient(90deg,#4f46e5,#7c3aed);border-radius:2px"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── ABA: OPORTUNIDADES DE MELHORIA ─────────────────────────────────────
function _cmpRenderOportunidades() {
  // Estado persistido no localStorage
  const _getStatus = (id) => {
    try { return JSON.parse(localStorage.getItem('erp_oport_status') || '{}')[id] || 'Planejado'; } catch(e) { return 'Planejado'; }
  };

  const OPP = [
    {
      id:'O1', icon:'fa-calculator', cor:'#dc2626', corBg:'rgba(220,38,38,0.08)',
      prioridade:'Alta', gap:85, prazo:'6–12 meses', esforco:'Grande',
      impacto:'Crítico', categoria:'Financeiro / Fiscal',
      title:'Contabilidade Formal',
      desc:'Ausência de plano de contas, razão contábil, balancete e balanço patrimonial. Impede substituição completa do sistema contábil (Domínio, Questor, SAP FI).',
      solucao:'Integração via API REST com sistema contábil certificado (Domínio, Sicoob, Questor) ou desenvolvimento de módulo Contabilidade próprio com exportação SPED Contábil (EFD-ICMS/IPI).',
      apis:[
        {nome:'Domínio Sistemas', url:'https://www.dominioerp.com.br', cor:'#0ea5e9'},
        {nome:'Questor Sistemas', url:'https://www.questor.com.br',    cor:'#8b5cf6'},
        {nome:'SAP LFCA',         url:'https://www.sap.com',            cor:'#3b82f6'}
      ],
      beneficios:['Compliance contábil completo','Exportação SPED Contábil','Substituição total do sistema legado','Balanço patrimonial em tempo real'],
      dependencias:['Plano de contas configurado','DRE já disponível (parcial)'],
    },
    {
      id:'O2', icon:'fa-users', cor:'#dc2626', corBg:'rgba(220,38,38,0.08)',
      prioridade:'Alta', gap:80, prazo:'9–18 meses', esforco:'Muito Grande',
      impacto:'Crítico', categoria:'RH / Legal',
      title:'Folha de Pagamento & eSocial',
      desc:'RH limitado a equipe e mobilização. Sem cálculo de folha, eSocial (S-2200, S-2210, S-2245), RAIS, DIRF ou CAGED. Risco legal de não-conformidade fiscal.',
      solucao:'Integração com Senior Sistemas (líder BR em HCM) ou desenvolvimento de módulo Folha próprio. eSocial requer homologação específica com SEPRT/RFB.',
      apis:[
        {nome:'Senior Sistemas API', url:'https://www.senior.com.br', cor:'#f59e0b'},
        {nome:'Totvs RH',            url:'https://www.totvs.com',      cor:'#ef4444'},
        {nome:'DataPrev eSocial',    url:'https://esocial.fazenda.gov.br', cor:'#16a34a'}
      ],
      beneficios:['Cálculo automático de folha','Envio eSocial integrado','RAIS/DIRF/CAGED automáticos','Holerites digitais'],
      dependencias:['Módulo Equipe (existente)','Cadastro de colaboradores completo'],
    },
    {
      id:'O3', icon:'fa-university', cor:'#d97706', corBg:'rgba(217,119,6,0.08)',
      prioridade:'Alta', gap:75, prazo:'3–6 meses', esforco:'Médio',
      impacto:'Alto', categoria:'Financeiro / Bancário',
      title:'Integrações Bancárias (CNAB/PIX)',
      desc:'Sem OFX/CNAB 240/150 para importação de extratos, conciliação bancária automática, pagamentos em lote e DDA (Débito Direto Autorizado).',
      solucao:'Implementar módulo CNAB 240/150 + OFX via Open Finance API (BACEN Sandbox) e integração PIX via DICT API. Sicoob e Bradesco disponibilizam APIs certificadas.',
      apis:[
        {nome:'Open Finance BR (BACEN)', url:'https://openfinancebrasil.org.br', cor:'#0ea5e9'},
        {nome:'PIX DICT API',           url:'https://www.bcb.gov.br/estabilidadefinanceira/pix', cor:'#16a34a'},
        {nome:'Sicoob API',             url:'https://developers.sicoob.com.br', cor:'#15803d'},
        {nome:'Bradesco API',           url:'https://developers.bradesco.com.br', cor:'#ef4444'}
      ],
      beneficios:['Conciliação bancária automática','Pagamentos em lote (CNAB 240)','Import de extratos OFX','Integração PIX instantânea'],
      dependencias:['Módulo Financeiro (existente)','Cadastro de contas bancárias'],
    },
    {
      id:'O4', icon:'fa-file-invoice-dollar', cor:'#d97706', corBg:'rgba(217,119,6,0.08)',
      prioridade:'Alta', gap:70, prazo:'1–3 meses', esforco:'Pequeno',
      impacto:'Alto', categoria:'Fiscal / NFe',
      title:'Emissão NF-e / NFS-e / CT-e',
      desc:'Módulo fiscal cobre controle, agenda e guias, mas não emite NF-e (modelo 55), NFS-e ou CT-e diretamente. Usuário depende de SEFAZ web ou sistema externo.',
      solucao:'Integração REST com Focus NF-e, eNotas ou NFe.io. APIs prontas, baixo esforço de integração. Permite emissão NF-e/NFS-e/CT-e dentro do ERP sem troca de sistema.',
      apis:[
        {nome:'Focus NF-e API',  url:'https://focusnfe.com.br',          cor:'#f59e0b'},
        {nome:'eNotas API',      url:'https://enotas.com.br',            cor:'#8b5cf6'},
        {nome:'NFe.io REST API', url:'https://nfe.io',                   cor:'#0ea5e9'},
        {nome:'SEFAZ WebService',url:'https://www.nfe.fazenda.gov.br',   cor:'#16a34a'}
      ],
      beneficios:['Emissão NF-e / NFS-e integrada','CT-e para transportadoras','Cancelamento e DANFE automático','Manifesto do destinatário'],
      dependencias:['Módulo Fiscal (existente)','CNPJ e certificado digital A1/A3'],
      destaque: true, // Quick win
    },
    {
      id:'O5', icon:'fa-mobile-alt', cor:'#d97706', corBg:'rgba(217,119,6,0.06)',
      prioridade:'Média', gap:65, prazo:'2–4 meses', esforco:'Médio',
      impacto:'Médio', categoria:'Mobilidade / UX',
      title:'App Móvel Nativo & Offline',
      desc:'PWA parcial sem app nativo iOS/Android. Obras e minas remotas com conectividade limitada sofrem com UX móvel. Falta sincronização offline para apontamentos de campo.',
      solucao:'Desenvolver PWA avançado com service workers, IndexedDB para cache offline e sincronização automática ao reconectar. Alternativa: React Native para apps stores (iOS/Android).',
      apis:[
        {nome:'Service Worker API',      url:'https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API', cor:'#f59e0b'},
        {nome:'IndexedDB',               url:'https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API',     cor:'#8b5cf6'},
        {nome:'Push Notifications API',  url:'https://developer.mozilla.org/en-US/docs/Web/API/Push_API',         cor:'#0ea5e9'}
      ],
      beneficios:['Apontamentos de campo offline','Sincronização automática ao reconectar','Push notifications','Experiência nativa iOS/Android'],
      dependencias:['PWA base (existente)','Backend APIs estabilizadas'],
    },
    {
      id:'O6', icon:'fa-puzzle-piece', cor:'#6366f1', corBg:'rgba(99,102,241,0.07)',
      prioridade:'Média', gap:60, prazo:'12–24 meses', esforco:'Muito Grande',
      impacto:'Estratégico', categoria:'Plataforma / Ecossistema',
      title:'Marketplace de Extensões (ISV)',
      desc:'Sem ecossistema de parceiros ISV para distribuir extensões verticais (fiscal, RH específico, BI avançado, EDI). Limita escalabilidade do produto para novos verticais.',
      solucao:'Criar plataforma de plugins/extensões com SDK público documentado, sistema de review e revenue share com parceiros (modelo Salesforce AppExchange simplificado).',
      apis:[
        {nome:'Plugin SDK próprio', url:'#', cor:'#4f46e5'},
        {nome:'Webhook API',        url:'#', cor:'#8b5cf6'},
        {nome:'OAuth 2.0',          url:'https://oauth.net/2/', cor:'#0ea5e9'}
      ],
      beneficios:['Ecossistema de parceiros ISV','Revenue share com parceiros','Extensões verticais (fiscal, RH, BI)','Escalabilidade para novos mercados'],
      dependencias:['APIs públicas estabilizadas','Modelo de autenticação OAuth 2.0'],
    },
    {
      id:'O7', icon:'fa-warehouse', cor:'#0891b2', corBg:'rgba(8,145,178,0.07)',
      prioridade:'Média', gap:55, prazo:'4–8 meses', esforco:'Grande',
      impacto:'Médio', categoria:'Operações / WMS',
      title:'WMS Avançado (Lotes, FEFO/FIFO)',
      desc:'Almoxarifado atual não cobre picking por zona, endereçamento de prateleiras (localização física), rastreabilidade por lote/série e conformidade ANVISA para materiais controlados.',
      solucao:'Expandir módulo almoxarifado com endereçamento (prateleira.corredor.posição), controle de lotes, FEFO/FIFO automático e integração WMS externo (Linx WMS, TWL).',
      apis:[
        {nome:'Linx WMS API',           url:'https://www.linx.com.br',  cor:'#0ea5e9'},
        {nome:'QR Code/Barcode (ZXing)', url:'https://github.com/zxing', cor:'#16a34a'},
        {nome:'ANVISA e-Saúde',          url:'https://www.anvisa.gov.br', cor:'#d97706'}
      ],
      beneficios:['Endereçamento físico de estoque','Controle de lotes e validade','FEFO/FIFO automático','Conformidade ANVISA'],
      dependencias:['Módulo Almoxarifado (existente)','Infraestrutura de QR Code/Barcode'],
    },
    {
      id:'O8', icon:'fa-industry', cor:'#6b7280', corBg:'rgba(107,114,128,0.07)',
      prioridade:'Baixa', gap:40, prazo:'Não prioritário', esforco:'Muito Grande',
      impacto:'Fora do Escopo', categoria:'Manufatura / Produção',
      title:'MRP / Manufatura (Out of Scope)',
      desc:'Não cobre planejamento de produção (MRP/MRP II), ordens de produção, controle de chão de fábrica (MES) ou processo industrial. Não é público-alvo do produto.',
      solucao:'Fora do escopo vertical (engenharia/mineração). Para clientes com manufatura industrial, integrar via API com TOTVS Manufacturing ou SAP PP. Não priorizar internamente.',
      apis:[
        {nome:'TOTVS Manufacturing API', url:'https://www.totvs.com', cor:'#ef4444'},
        {nome:'SAP PP integration',      url:'https://www.sap.com',   cor:'#3b82f6'}
      ],
      beneficios:['Cobertura de MRP/MRP II','Ordens de produção','Controle de chão de fábrica'],
      dependencias:['Definição de escopo de produto','Parceria TOTVS/SAP'],
    },
  ];

  const statusOpts = ['Planejado', 'Em análise', 'Em desenvolvimento', 'Concluído', 'Cancelado'];
  const corStatus  = {
    'Planejado':        {bg:'rgba(37,99,235,.1)',  c:'#2563eb', i:'fa-calendar'},
    'Em análise':       {bg:'rgba(217,119,6,.1)',  c:'#d97706', i:'fa-search'},
    'Em desenvolvimento':{bg:'rgba(139,92,246,.1)',c:'#8b5cf6', i:'fa-code'},
    'Concluído':        {bg:'rgba(22,163,74,.1)',  c:'#16a34a', i:'fa-check-circle'},
    'Cancelado':        {bg:'rgba(107,114,128,.1)',c:'#6b7280', i:'fa-ban'},
  };

  const priorityCount = { Alta: OPP.filter(o=>o.prioridade==='Alta').length, Media: OPP.filter(o=>o.prioridade==='Média').length, Baixa: OPP.filter(o=>o.prioridade==='Baixa').length };
  const quickWins    = OPP.filter(o=>o.prazo.includes('1–3') || o.prazo.includes('1-3')).length;
  const gapMedio     = Math.round(OPP.reduce((s,o)=>s+o.gap,0)/OPP.length);

  return `
    <!-- Header KPIs -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px">
      <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:14px;text-align:center">
        <div style="font-size:26px;font-weight:900;color:#6366f1">${OPP.length}</div>
        <div style="font-size:11px;color:var(--text-muted)">Oportunidades</div>
      </div>
      <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:14px;text-align:center">
        <div style="font-size:26px;font-weight:900;color:#dc2626">${priorityCount.Alta}</div>
        <div style="font-size:11px;color:var(--text-muted)">Prioridade Alta</div>
      </div>
      <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:14px;text-align:center">
        <div style="font-size:26px;font-weight:900;color:#16a34a">${quickWins}</div>
        <div style="font-size:11px;color:var(--text-muted)">Quick Wins (≤3m)</div>
      </div>
      <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:14px;text-align:center">
        <div style="font-size:26px;font-weight:900;color:#d97706">${gapMedio}</div>
        <div style="font-size:11px;color:var(--text-muted)">Gap Médio</div>
      </div>
      <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:14px;text-align:center">
        <div style="font-size:26px;font-weight:900;color:#0891b2">
          ${OPP.filter(o=>_getStatus(o.id)==='Concluído').length}
        </div>
        <div style="font-size:11px;color:var(--text-muted)">Concluídos</div>
      </div>
    </div>

    <!-- Barra de progresso geral -->
    <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:14px 18px;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:12px;font-weight:700"><i class="fas fa-tasks" style="color:#6366f1;margin-right:6px"></i>Progresso do Roadmap de Melhorias</span>
        <span style="font-size:11px;color:var(--text-muted)">${OPP.filter(o=>_getStatus(o.id)==='Concluído').length}/${OPP.length} concluídos</span>
      </div>
      <div style="height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${Math.round(OPP.filter(o=>_getStatus(o.id)==='Concluído').length/OPP.length*100)}%;background:linear-gradient(90deg,#4f46e5,#16a34a);border-radius:4px;transition:width .5s"></div>
      </div>
    </div>

    <!-- Cards por oportunidade -->
    <div style="display:grid;gap:14px">
      ${OPP.map(o => {
        const st   = _getStatus(o.id);
        const stCor = corStatus[st] || corStatus['Planejado'];
        return `
        <div style="background:var(--bg-card);border-radius:14px;border:1px solid var(--border-color);border-left:5px solid ${o.cor};padding:18px 20px;${o.destaque?'box-shadow:0 0 0 2px rgba(22,163,74,.25)':''}">
          <!-- Linha 1: cabeçalho -->
          <div style="display:flex;align-items:flex-start;gap:14px">
            <div style="width:46px;height:46px;border-radius:12px;background:${o.corBg};display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <i class="fas ${o.icon}" style="color:${o.cor};font-size:20px"></i>
            </div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">
                ${o.destaque ? '<span style="font-size:9px;font-weight:800;background:#16a34a;color:#fff;padding:2px 7px;border-radius:8px">⚡ QUICK WIN</span>' : ''}
                <span style="font-size:14px;font-weight:800;color:var(--text-primary)">${o.title}</span>
                <span style="font-size:10px;padding:2px 8px;border-radius:10px;background:${o.corBg};color:${o.cor};font-weight:700">Prioridade ${o.prioridade}</span>
                <span style="font-size:10px;padding:2px 8px;border-radius:10px;background:${stCor.bg};color:${stCor.c};font-weight:700">
                  <i class="fas ${stCor.i}" style="margin-right:3px;font-size:9px"></i>${st}
                </span>
                <span style="font-size:10px;color:var(--text-muted);background:var(--bg-tertiary);padding:2px 7px;border-radius:8px;border:1px solid var(--border-color)">${o.categoria}</span>
              </div>
              <p style="font-size:12px;color:var(--text-secondary);line-height:1.6;margin:0 0 12px">${o.desc}</p>

              <!-- Solução recomendada -->
              <div style="background:rgba(79,70,229,0.05);border:1px solid rgba(79,70,229,0.14);border-radius:9px;padding:11px 14px;margin-bottom:10px">
                <div style="font-size:11px;font-weight:700;color:#4f46e5;margin-bottom:5px">
                  <i class="fas fa-lightbulb" style="color:#f59e0b;margin-right:4px"></i>Solução Recomendada
                </div>
                <div style="font-size:12px;color:var(--text-secondary);line-height:1.5;margin-bottom:8px">${o.solucao}</div>
                <!-- APIs / Integrações -->
                <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px">
                  ${o.apis.map(a=>`
                    <span title="${a.nome}" style="font-size:10px;padding:3px 9px;border-radius:8px;background:${a.cor}18;color:${a.cor};border:1px solid ${a.cor}33;font-weight:600;cursor:default">
                      <i class="fas fa-plug" style="margin-right:3px;font-size:9px"></i>${a.nome}
                    </span>`).join('')}
                </div>
                <div style="font-size:11px;color:var(--text-muted)">
                  <i class="fas fa-clock" style="color:#6366f1;margin-right:4px"></i>Prazo: <strong style="color:var(--text-primary)">${o.prazo}</strong> &nbsp;·&nbsp;
                  <i class="fas fa-tools" style="color:#0891b2;margin-right:4px"></i>Esforço: <strong style="color:var(--text-primary)">${o.esforco}</strong> &nbsp;·&nbsp;
                  <i class="fas fa-bolt" style="color:#f59e0b;margin-right:4px"></i>Impacto: <strong style="color:var(--text-primary)">${o.impacto}
                  </strong>
                </div>
              </div>

              <!-- Benefícios esperados -->
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
                ${o.beneficios.map(b=>`
                  <span style="font-size:10px;padding:2px 8px;border-radius:8px;background:rgba(22,163,74,.08);color:#16a34a;border:1px solid rgba(22,163,74,.2)">
                    <i class="fas fa-check" style="margin-right:3px;font-size:9px"></i>${b}
                  </span>`).join('')}
              </div>

              <!-- Alterar status -->
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span style="font-size:11px;color:var(--text-muted)">Status:</span>
                ${statusOpts.map(s=>{
                  const sc = corStatus[s]||corStatus['Planejado'];
                  return `<button onclick="_cmpSetOportStatus('${o.id}','${s}')" style="font-size:10px;padding:3px 9px;border-radius:7px;border:1px solid ${st===s?sc.c:'var(--border-color)'};background:${st===s?sc.bg:'transparent'};color:${st===s?sc.c:'var(--text-muted)'};cursor:pointer;font-weight:${st===s?'700':'400'}">${s}</button>`;
                }).join('')}
              </div>
            </div>

            <!-- Gap Score -->
            <div style="text-align:center;flex-shrink:0;min-width:58px">
              <div style="font-size:28px;font-weight:900;color:${o.cor};line-height:1">${o.gap}</div>
              <div style="font-size:9px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.4px">Gap Score</div>
              <div style="height:5px;background:var(--bg-tertiary);border-radius:3px;margin-top:5px;overflow:hidden">
                <div style="height:100%;width:${o.gap}%;background:${o.cor};border-radius:3px"></div>
              </div>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>

    <!-- Nota rodapé -->
    <div style="margin-top:16px;padding:12px 16px;background:rgba(99,102,241,0.05);border-radius:10px;border:1px solid rgba(99,102,241,0.15);font-size:12px;color:var(--text-secondary)">
      <i class="fas fa-info-circle" style="color:#6366f1;margin-right:6px"></i>
      <strong>Gap Score:</strong> escala 0–100 onde 100 = lacuna crítica sem solução disponível. Status interativo: atualize o andamento de cada oportunidade — persistido localmente.
      Veja o plano de execução detalhado na aba <strong>Roadmap</strong>.
    </div>
  `;
}

function _cmpSetOportStatus(id, status) {
  try {
    const data = JSON.parse(localStorage.getItem('erp_oport_status') || '{}');
    data[id] = status;
    localStorage.setItem('erp_oport_status', JSON.stringify(data));
    // Re-renderiza a aba atual
    const el = document.getElementById('cmp-aba-content');
    if (el) el.innerHTML = _cmpRenderOportunidades();
  } catch(e) { console.warn('Erro ao salvar status oportunidade:', e); }
}

window._cmpSetOportStatus = _cmpSetOportStatus;

// ─── ABA: LACUNAS & RISCOS ────────────────────────────────────────────
function _cmpRenderLacunas() {
  const lacunas = [
    {
      id:'L1', icon:'fa-calculator', title:'Contabilidade Formal Ausente',
      prioridade:'Alta', impacto:'Crítico', gap: 85, gapColor:'#dc2626',
      desc:'Ausência de plano de contas, razão contábil, balancete e balanço patrimonial. Impede substituição completa do sistema contábil (Domínio, Questor, SAP FI).',
      solucao:'Integração via API REST com sistema contábil certificado (Domínio, Sicoob, Questor) ou desenvolvimento de módulo Contabilidade próprio com exportação SPED Contábil (EFD-ICMS/IPI).',
      apis:['Domínio Sistemas', 'Questor Sistemas', 'SAP LFCA'],
      prazo:'6–12 meses', esforco:'Grande', status:'Planejado'
    },
    {
      id:'L2', icon:'fa-users', title:'Sem Folha de Pagamento / eSocial',
      prioridade:'Alta', impacto:'Crítico', gap:80, gapColor:'#dc2626',
      desc:'RH limitado a equipe e mobilização. Sem cálculo de folha, eSocial (S-2200, S-2210, S-2245), RAIS, DIRF ou CAGED. Risco legal de não-conformidade fiscal.',
      solucao:'Integração com Senior Sistemas (líder BR em HCM) ou desenvolvimento de módulo Folha próprio. eSocial requer homologação específica com SEPRT/RFB.',
      apis:['Senior Sistemas API', 'Totvs RH', 'DataPrev eSocial'],
      prazo:'9–18 meses', esforco:'Muito Grande', status:'Planejado'
    },
    {
      id:'L3', icon:'fa-university', title:'Integrações Bancárias Ausentes',
      prioridade:'Alta', impacto:'Alto', gap:75, gapColor:'#d97706',
      desc:'Sem OFX/CNAB 240/150 para importação de extratos, conciliação bancária automática, pagamentos em lote e DDA (Débito Direto Autorizado).',
      solucao:'Implementar módulo CNAB 240/150 + OFX via Open Finance API (BACEN Sandbox) e integração PIX via DICT API. Sicoob e Bradesco disponibilizam APIs certificadas.',
      apis:['Open Finance BR (BACEN)', 'PIX DICT API', 'Sicoob API', 'Bradesco API'],
      prazo:'3–6 meses', esforco:'Médio', status:'Em análise'
    },
    {
      id:'L4', icon:'fa-file-invoice-dollar', title:'NF-e / NFS-e Não Emitida',
      prioridade:'Alta', impacto:'Alto', gap:70, gapColor:'#d97706',
      desc:'Módulo fiscal cobre controle, agenda e guias, mas não emite NF-e (modelo 55), NFS-e ou CT-e diretamente. Usuário depende de SEFAZ web ou sistema externo.',
      solucao:'Integração REST com Focus NF-e, eNotas ou NFe.io. APIs prontas, baixo esforço de integração. Permite emissão NF-e/NFS-e/CT-e dentro do ERP sem troca de sistema.',
      apis:['Focus NF-e API', 'eNotas API', 'NFe.io REST API', 'SEFAZ WebService'],
      prazo:'1–3 meses', esforco:'Pequeno', status:'Prioridade Q2/2026'
    },
    {
      id:'L5', icon:'fa-mobile-alt', title:'App Móvel Nativo Ausente',
      prioridade:'Média', impacto:'Médio', gap:65, gapColor:'#d97706',
      desc:'PWA parcial sem app nativo iOS/Android. Obras e minas remotas com conectividade limitada sofrem com UX móvel. Falta sincronização offline para apontamentos de campo.',
      solucao:'Desenvolver PWA avançado com service workers, IndexedDB para cache offline e sincronização automática ao reconectar. Alternativa: React Native para apps stores (iOS/Android).',
      apis:['Service Worker API', 'IndexedDB', 'Push Notifications API'],
      prazo:'2–4 meses', esforco:'Médio', status:'Em análise'
    },
    {
      id:'L6', icon:'fa-puzzle-piece', title:'Marketplace de Extensões Inexistente',
      prioridade:'Média', impacto:'Estratégico', gap:60, gapColor:'#6366f1',
      desc:'Sem ecossistema de parceiros ISV para distribuir extensões verticais (fiscal, RH específico, BI avançado, EDI). Limita escalabilidade do produto para novos verticais.',
      solucao:'Criar plataforma de plugins/extensões com SDK público documentado, sistema de review e revenue share com parceiros (modelo Salesforce AppExchange simplificado).',
      apis:['Plugin SDK próprio', 'Webhook API', 'OAuth 2.0'],
      prazo:'12–24 meses', esforco:'Muito Grande', status:'Long-term'
    },
    {
      id:'L7', icon:'fa-warehouse', title:'WMS Avançado Limitado',
      prioridade:'Média', impacto:'Médio', gap:55, gapColor:'#0891b2',
      desc:'Almoxarifado atual não cobre picking por zona, endereçamento de prateleiras (localização física), rastreabilidade por lote/série e conformidade ANVISA para materiais controlados.',
      solucao:'Expandir módulo almoxarifado com endereçamento (prateleira.corredor.posição), controle de lotes, FEFO/FIFO automático e integração WMS externo (Linx WMS, TWL).',
      apis:['Linx WMS API', 'QR Code/Barcode (ZXing)', 'ANVISA e-Saúde'],
      prazo:'4–8 meses', esforco:'Grande', status:'Planejado'
    },
    {
      id:'L8', icon:'fa-industry', title:'MRP / Manufatura Ausente',
      prioridade:'Baixa', impacto:'Fora do Escopo', gap:40, gapColor:'#6b7280',
      desc:'Não cobre planejamento de produção (MRP/MRP II), ordens de produção, controle de chão de fábrica (MES) ou processo industrial. Não é público-alvo do produto.',
      solucao:'Fora do escopo vertical (engenharia/mineração). Para clientes com manufatura industrial, integrar via API com TOTVS Manufacturing ou SAP PP. Não priorizar internamente.',
      apis:['TOTVS Manufacturing API', 'SAP PP integration'],
      prazo:'Não prioritário', esforco:'Muito Grande', status:'Out of scope'
    },
  ];

  const getPrioColor = (p) => p==='Alta'?'#dc2626':p==='Média'?'#d97706':p==='Baixa'?'#6b7280':'#6366f1';
  const getStatusColor = (s) => {
    if (s.includes('2026')) return { bg:'#16a34a22', c:'#16a34a', icon:'fa-bolt' };
    if (s==='Em análise') return { bg:'#d9770622', c:'#d97706', icon:'fa-search' };
    if (s==='Planejado') return { bg:'#2563eb22', c:'#2563eb', icon:'fa-calendar' };
    if (s==='Long-term') return { bg:'#6366f122', c:'#6366f1', icon:'fa-road' };
    return { bg:'#6b728022', c:'#6b7280', icon:'fa-minus-circle' };
  };

  const total = lacunas.reduce((s,l) => s+l.gap, 0);
  const mediaGap = Math.round(total / lacunas.length);

  return `
    <!-- Sumário -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:14px 16px;text-align:center">
        <div style="font-size:28px;font-weight:900;color:#dc2626">8</div>
        <div style="font-size:12px;color:var(--text-muted)">Lacunas Identificadas</div>
      </div>
      <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:14px 16px;text-align:center">
        <div style="font-size:28px;font-weight:900;color:#d97706">3</div>
        <div style="font-size:12px;color:var(--text-muted)">Prioridade Alta</div>
      </div>
      <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:14px 16px;text-align:center">
        <div style="font-size:28px;font-weight:900;color:#16a34a">1</div>
        <div style="font-size:12px;color:var(--text-muted)">Quick Win (1–3 meses)</div>
      </div>
      <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:14px 16px;text-align:center">
        <div style="font-size:28px;font-weight:900;color:#6366f1">${mediaGap}</div>
        <div style="font-size:12px;color:var(--text-muted)">Gap Score Médio</div>
      </div>
    </div>

    <!-- Lacunas detalhadas -->
    <div style="display:grid;gap:12px">
      ${lacunas.map((l) => {
        const pColor = getPrioColor(l.prioridade);
        const sStyle = getStatusColor(l.status);
        return `
        <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:16px 20px;border-left:4px solid ${pColor}">
          <div style="display:flex;align-items:flex-start;gap:16px">
            <!-- Ícone -->
            <div style="width:44px;height:44px;border-radius:11px;background:${pColor}18;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <i class="fas ${l.icon}" style="color:${pColor};font-size:18px"></i>
            </div>

            <!-- Conteúdo -->
            <div style="flex:1;min-width:0">
              <!-- Cabeçalho -->
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
                <span style="font-size:13px;font-weight:700;color:var(--text-primary)">${l.title}</span>
                <span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:10px;background:${pColor}18;color:${pColor}">Prioridade ${l.prioridade}</span>
                <span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:10px;background:${sStyle.bg};color:${sStyle.c}">
                  <i class="fas ${sStyle.icon}" style="margin-right:3px;font-size:9px"></i>${l.status}
                </span>
                <span style="font-size:10px;color:var(--text-muted)">Impacto: ${l.impacto}</span>
              </div>

              <!-- Descrição -->
              <p style="font-size:12px;color:var(--text-secondary);line-height:1.6;margin:0 0 10px">${l.desc}</p>

              <!-- Solução e APIs -->
              <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:start">
                <div style="background:rgba(79,70,229,0.05);border-radius:8px;padding:10px 12px;border:1px solid rgba(79,70,229,0.12)">
                  <div style="font-size:11px;font-weight:700;color:#4f46e5;margin-bottom:4px">
                    <i class="fas fa-lightbulb" style="margin-right:4px;color:#f59e0b"></i>Solução Recomendada
                  </div>
                  <div style="font-size:11px;color:var(--text-secondary);line-height:1.5">${l.solucao}</div>
                  <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">
                    ${l.apis.map(a=>`<span style="font-size:10px;padding:2px 7px;border-radius:8px;background:var(--bg-tertiary);color:var(--text-muted);border:1px solid var(--border-color);font-weight:600">${a}</span>`).join('')}
                  </div>
                  <div style="font-size:11px;color:var(--text-muted);margin-top:5px">
                    <i class="fas fa-clock" style="color:#6366f1;margin-right:4px"></i>
                    Prazo: <strong style="color:var(--text-primary)">${l.prazo}</strong> &nbsp;·&nbsp;
                    <i class="fas fa-tools" style="color:#0891b2;margin-right:4px"></i>
                    Esforço: <strong style="color:var(--text-primary)">${l.esforco}</strong>
                  </div>
                </div>
              </div>
            </div>

            <!-- Gap Score -->
            <div style="text-align:center;flex-shrink:0;min-width:60px">
              <div style="font-size:26px;font-weight:900;color:${l.gapColor};line-height:1">${l.gap}</div>
              <div style="font-size:9px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Gap Score</div>
              <div style="height:4px;background:var(--bg-tertiary);border-radius:2px;margin-top:4px;overflow:hidden">
                <div style="height:100%;width:${l.gap}%;background:${l.gapColor};border-radius:2px"></div>
              </div>
            </div>
          </div>
        </div>
      `}).join('')}
    </div>

    <!-- Nota rodapé -->
    <div style="margin-top:16px;padding:12px 16px;background:rgba(99,102,241,0.05);border-radius:10px;border:1px solid rgba(99,102,241,0.15);font-size:12px;color:var(--text-secondary)">
      <i class="fas fa-info-circle" style="color:#6366f1;margin-right:6px"></i>
      <strong>Gap Score:</strong> escala 0–100 onde 100 = lacuna crítica sem solução disponível. Valores acima de 70 indicam risco competitivo significativo no segmento-alvo.
      Clique em "Roadmap" para ver o plano de resolução priorizando por ROI.
    </div>
  `;
}

// ─── ABA: RECOMENDAÇÕES DE MELHORIA ─────────────────────────────────────
function _cmpRenderMelhorias() {
  // Dados persistidos em localStorage
  const _KEY = 'fa_melhorias_checklist';
  const _load = () => { try { return JSON.parse(localStorage.getItem(_KEY)||'{}'); } catch(e){ return {}; } };
  const _save = (d) => localStorage.setItem(_KEY, JSON.stringify(d));

  const CATS = [
    {
      id:'suprimentos', icon:'fa-shopping-cart', cor:'#2563eb', label:'Suprimentos & Compras',
      items:[
        { id:'sup_01', text:'Checklist digital com validação de campos obrigatórios nos formulários de RC, RFQ e PO', kpi:'Taxa de RC rejeitada por incompletude → meta: 0%', esforco:'P', prazo:'Implementado ✅' },
        { id:'sup_02', text:'Alertas automáticos para RFQs abertas há mais de 15 dias sem atividade (e-mail/notificação no sistema)', kpi:'Tempo médio de resposta RFQ → meta: ≤ 10 dias', esforco:'P', prazo:'Implementado ✅' },
        { id:'sup_03', text:'Política de compra emergencial com formulário específico e aprovação obrigatória de Diretor', kpi:'Compras emergenciais / total → meta: < 5%', esforco:'P', prazo:'Implementado ✅' },
        { id:'sup_04', text:'Mínimo 3 fornecedores em cotações acima de R$ 10.000 com bloqueio automático se < 3 propostas', kpi:'% cotações com ≥ 3 fornecedores → meta: > 95%', esforco:'P', prazo:'Implementado ✅' },
        { id:'sup_05', text:'Tipo obrigatório na RC (Material / Serviço / Equipamento) com RCs separadas por tipo e indicador Spot vs Recorrente', kpi:'% RCs com tipo definido → meta: 100%', esforco:'P', prazo:'Implementado ✅' },
        { id:'sup_06', text:'Vinculação obrigatória de RC a linha WBS para rastreabilidade custo-contrato-projeto', kpi:'% RCs com WBS vinculada → meta: > 90%', esforco:'P', prazo:'Implementado ✅' },
        { id:'sup_07', text:'Integração SEFAZ para consulta automática de CNPJ/situação cadastral de fornecedores antes de emissão de PO', kpi:'Fornecedores irregulares bloqueados preventivamente → meta: 100%', esforco:'P', prazo:'1–3 meses' },
        { id:'sup_08', text:'Rastreabilidade completa OS → RC → RFQ → PO → NF → Pagamento com histórico imutável de auditoria', kpi:'% processos com trilha completa → meta: 100%', esforco:'M', prazo:'2 meses' },
      ]
    },
    {
      id:'contratos', icon:'fa-file-contract', cor:'#7c3aed', label:'Contratos & Fornecedores',
      items:[
        { id:'con_01', text:'Alertas automáticos de vencimento de contrato com 90, 60 e 30 dias de antecedência (notificação + e-mail)', kpi:'Contratos vencidos sem renovação → meta: 0', esforco:'P', prazo:'Implementado ✅' },
        { id:'con_02', text:'Reuniões mensais de gestão de contratos formalizadas com ata e pauta mínima no sistema', kpi:'% contratos com reunião mensal registrada → meta: 100%', esforco:'M', prazo:'1 mês' },
        { id:'con_03', text:'Designação formal de gestor de contrato com responsabilidade registrada via portaria interna no sistema', kpi:'% contratos com gestor designado → meta: 100%', esforco:'P', prazo:'Implementado ✅' },
        { id:'con_04', text:'Checklist de aceite de contrato com itens obrigatórios (PO, prazo, pagamento, conta contábil, aprovação)', kpi:'% contratos com checklist 100% preenchido → meta: > 95%', esforco:'M', prazo:'Implementado ✅' },
        { id:'con_05', text:'Vinculação de OS a itens mensuráveis do contrato via WBS para medição de avanço físico e financeiro', kpi:'% OS vinculadas a WBS → meta: > 80%', esforco:'M', prazo:'1 mês' },
        { id:'con_06', text:'IDF (Índice de Desempenho do Fornecedor) trimestral: OTD ≥ 95%, taxa devolução ≤ 1%, resposta RFQ ≤ 3 dias', kpi:'Fornecedores com IDF < 70 bloqueados → meta: aplicar em 100%', esforco:'M', prazo:'2 meses' },
        { id:'con_07', text:'Critérios de Medição (KPIs) por contrato: tonelagem, disponibilidade mecânica, avanço físico, conformidade cronograma', kpi:'% contratos com KPIs definidos → meta: 100%', esforco:'M', prazo:'Implementado ✅' },
      ]
    },
    {
      id:'financeiro', icon:'fa-dollar-sign', cor:'#16a34a', label:'Financeiro & Contas a Pagar',
      items:[
        { id:'fin_01', text:'Comparativo semanal fluxo de caixa real vs. planejado por contrato com dashboard de desvios', kpi:'Desvio orçamentário aceitável → meta: ≤ 5%', esforco:'M', prazo:'3 semanas' },
        { id:'fin_02', text:'Alçada hierárquica para contas a pagar > R$ 50.000 exigindo aprovação de Diretor Financeiro', kpi:'Pagamentos > R$50k sem aprovação → meta: 0', esforco:'P', prazo:'Implementado ✅' },
        { id:'fin_03', text:'Prazo mínimo de 15 dias úteis após recebimento de NF; revisão mensal de AP vencidos com justificativa obrigatória', kpi:'AP vencido há > 30 dias / total → meta: < 2%', esforco:'P', prazo:'2 semanas' },
        { id:'fin_04', text:'Validações obrigatórias em campos críticos: valor, CNPJ, datas de emissão e vencimento de NF com bloqueio', kpi:'NFs rejeitadas por dados inválidos → meta: 0', esforco:'P', prazo:'1 mês' },
        { id:'fin_05', text:'Integração via API REST com sistema contábil certificado (Domínio, Questor, SAP FI) ou módulo próprio + SPED EFD', kpi:'Lançamentos automáticos / manual → meta: > 80% automático', esforco:'G', prazo:'6–12 meses' },
        { id:'fin_06', text:'Módulo CNAB 240/150 + OFX para conciliação bancária automática, pagamentos em lote e DDA via Open Finance/PIX', kpi:'Tempo de conciliação bancária mensal → meta: < 2h', esforco:'M', prazo:'3–6 meses' },
      ]
    },
    {
      id:'dados', icon:'fa-database', cor:'#d97706', label:'Qualidade de Dados & Cadastros',
      items:[
        { id:'dad_01', text:'Auditoria mensal automática de cadastros de fornecedores com relatório de inconsistências e plano de ação', kpi:'Fornecedores com cadastro incompleto → meta: < 2%', esforco:'P', prazo:'3 semanas' },
        { id:'dad_02', text:'Aprovação em dois níveis para alterações em dados críticos de fornecedor (CNPJ, conta bancária, e-mail)', kpi:'Alterações não autorizadas → meta: 0', esforco:'P', prazo:'2 semanas' },
        { id:'dad_03', text:'Rotina semanal automática de detecção de duplicatas em cadastros (fornecedor, material, NF) com alerta ao gestor', kpi:'Duplicatas detectadas e tratadas / mês → meta: < 5', esforco:'M', prazo:'1 mês' },
        { id:'dad_04', text:'Validação CNPJ/CPF em tempo real via Receita Federal durante cadastro – bloqueia entidades irregulares', kpi:'Fornecedores irregulares cadastrados → meta: 0', esforco:'P', prazo:'Implementado ✅' },
        { id:'dad_05', text:'Endereçamento de prateleiras no almoxarifado (prateleira.corredor.posição) com controle FEFO/FIFO automático', kpi:'Acurácia de estoque → meta: > 98%', esforco:'G', prazo:'4–8 meses' },
        { id:'dad_06', text:'App móvel offline-first (PWA avançado) com service workers e sincronização automática para campo', kpi:'Apontamentos registrados offline / total → meta: disponível 24/7', esforco:'M', prazo:'2–4 meses' },
      ]
    },
    {
      id:'rh_esocial', icon:'fa-users-cog', cor:'#dc2626', label:'RH, Folha & eSocial',
      items:[
        { id:'rh_01', text:'Módulo de Folha de Pagamento: cálculo de salários, horas extras, FGTS, INSS, IRRF com geração de holerites', kpi:'Erro em folha por funcionário → meta: 0', esforco:'GG', prazo:'9–18 meses' },
        { id:'rh_02', text:'eSocial: envio automático dos eventos obrigatórios (S-2200, S-2210, S-2245 – admissão, afastamento, treinamento)', kpi:'Eventos eSocial com erro de transmissão → meta: 0', esforco:'GG', prazo:'12–18 meses' },
        { id:'rh_03', text:'RAIS, DIRF e CAGED: geração automática dos arquivos obrigatórios anuais com validação prévia', kpi:'Obrigações acessórias entregues no prazo → meta: 100%', esforco:'G', prazo:'6–12 meses' },
        { id:'rh_04', text:'Integração com Senior Sistemas HCM ou Totvs RH para fluxo bidirecional admissão → folha → eSocial', kpi:'Retrabalho manual em RH → meta: < 10% do tempo', esforco:'G', prazo:'6–12 meses' },
        { id:'rh_05', text:'Módulo de Controle de Ponto (registro, banco de horas, horas extras) integrado com folha', kpi:'Discrepâncias ponto vs. folha → meta: 0', esforco:'M', prazo:'3–6 meses' },
      ]
    },
    {
      id:'fiscal_contabil', icon:'fa-receipt', cor:'#0891b2', label:'Fiscal & Contabilidade',
      items:[
        { id:'fis_01', text:'Emissão nativa de NF-e (modelo 55), NFS-e e CT-e via API Focus NF-e, eNotas ou NFe.io dentro do ERP', kpi:'Notas emitidas sem sair do sistema → meta: 100%', esforco:'P', prazo:'1–3 meses' },
        { id:'fis_02', text:'Módulo Contábil próprio com Plano de Contas (PCG), razão contábil, balancete e balanço patrimonial', kpi:'Substituição de sistema contábil externo → meta: completo', esforco:'G', prazo:'6–12 meses' },
        { id:'fis_03', text:'Exportação SPED Contábil (EFD-ICMS/IPI) e EFD Contribuições com validação PVA do SEFAZ', kpi:'Obrigações SPED entregues no prazo sem rejeição → meta: 100%', esforco:'G', prazo:'6–12 meses' },
        { id:'fis_04', text:'Apuração automática de ICMS, PIS/COFINS, ISS e IRPJ/CSLL com dashboard fiscal por período', kpi:'Erro em apuração tributária → meta: 0', esforco:'G', prazo:'6–9 meses' },
        { id:'fis_05', text:'Integração com Sicoob, Bradesco (APIs Open Finance) para conciliação automática de extratos bancários', kpi:'Divergências bancárias detectadas automaticamente → meta: > 99%', esforco:'M', prazo:'3–6 meses' },
      ]
    },
    {
      id:'plataforma', icon:'fa-rocket', cor:'#6366f1', label:'Plataforma & Tecnologia',
      items:[
        { id:'plt_01', text:'Marketplace de extensões com SDK público, sistema de review, revenue-share e onboarding de ISVs', kpi:'Parceiros ISV ativos → meta: 10 em 24 meses', esforco:'GG', prazo:'12–24 meses' },
        { id:'plt_02', text:'API pública REST/GraphQL documentada (Swagger) para integrações externas com autenticação OAuth 2.0', kpi:'Integrações externas funcionais sem erros → meta: 99.9% uptime', esforco:'G', prazo:'6–12 meses' },
        { id:'plt_03', text:'Integração com TOTVS Manufacturing ou SAP PP para clientes industriais com MRP e PCP completos', kpi:'Clientes industriais atendidos → meta: módulo disponível', esforco:'GG', prazo:'Out of scope / parceria' },
        { id:'plt_04', text:'PWA avançado: service workers, push notifications, sincronização offline (IndexedDB) e instalação em iOS/Android', kpi:'Apontamentos offline disponíveis → meta: 100% funcional', esforco:'M', prazo:'2–4 meses' },
        { id:'plt_05', text:'Integração com WMS externo (Linx WMS, TWL) via API para clientes com operação logística avançada', kpi:'Sincronização estoque ERP ↔ WMS → meta: tempo real', esforco:'G', prazo:'4–8 meses' },
        { id:'plt_06', text:'Dashboard executivo com BI embarcado: gráficos drill-down, alertas preditivos por IA e exportação para PowerBI', kpi:'Decisões suportadas por dados em tempo real → meta: 100%', esforco:'M', prazo:'3–6 meses' },
      ]
    },
  ];

  const saved = _load();
  const totalItems = CATS.reduce((s,c)=>s+c.items.length,0);
  const totalConcluidos = Object.values(saved).filter(v=>v===true).length;
  const pct = Math.round((totalConcluidos/totalItems)*100);

  // --- Cria HTML principal ---
  const html = `
    <!-- Cabeçalho -->
    <div style="background:linear-gradient(135deg,#1e40af,#7c3aed);border-radius:16px;padding:20px 24px;margin-bottom:20px;color:#fff;display:flex;align-items:center;gap:20px">
      <div style="flex:1">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;opacity:.8;margin-bottom:4px">Plano de Ação</div>
        <div style="font-size:20px;font-weight:900;margin-bottom:2px">Recomendações de Melhoria</div>
        <div style="font-size:12px;opacity:.85">${totalItems} ações identificadas em 7 áreas · Use como checklist de execução</div>
      </div>
      <div style="text-align:center;flex-shrink:0">
        <div style="font-size:36px;font-weight:900">${pct}%</div>
        <div style="font-size:10px;opacity:.8;text-transform:uppercase;letter-spacing:.5px">Concluído</div>
        <div style="height:6px;width:100px;background:rgba(255,255,255,0.25);border-radius:3px;margin-top:6px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:#fff;border-radius:3px;transition:width .4s"></div>
        </div>
      </div>
    </div>

    <!-- KPIs resumo -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:14px 16px;text-align:center">
        <div style="font-size:26px;font-weight:900;color:#2563eb">${totalItems}</div>
        <div style="font-size:11px;color:var(--text-muted)">Ações Total</div>
      </div>
      <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:14px 16px;text-align:center">
        <div style="font-size:26px;font-weight:900;color:#16a34a">${totalConcluidos}</div>
        <div style="font-size:11px;color:var(--text-muted)">Concluídas</div>
      </div>
      <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:14px 16px;text-align:center">
        <div style="font-size:26px;font-weight:900;color:#d97706">${totalItems-totalConcluidos}</div>
        <div style="font-size:11px;color:var(--text-muted)">Pendentes</div>
      </div>
      <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:14px 16px;text-align:center">
        <div style="font-size:26px;font-weight:900;color:#16a34a">${CATS.reduce((s,c)=>s+c.items.filter(i=>i.prazo.includes('✅')).length,0)}</div>
        <div style="font-size:11px;color:var(--text-muted)">Já Implementadas</div>
      </div>
    </div>

    <!-- Categorias -->
    <div style="display:grid;gap:16px">
      ${CATS.map(cat => {
        const catConcluidos = cat.items.filter(it=>saved[it.id]===true).length;
        const catPct = Math.round((catConcluidos/cat.items.length)*100);
        return `
        <div style="background:var(--bg-card);border-radius:14px;border:1px solid var(--border-color);overflow:hidden">
          <!-- Header categoria -->
          <div style="background:${cat.cor}12;border-bottom:1px solid ${cat.cor}22;padding:14px 18px;display:flex;align-items:center;gap:12px">
            <div style="width:36px;height:36px;border-radius:9px;background:${cat.cor}20;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <i class="fas ${cat.icon}" style="color:${cat.cor};font-size:15px"></i>
            </div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${cat.label}</div>
              <div style="font-size:11px;color:var(--text-muted)">${catConcluidos} de ${cat.items.length} ações concluídas</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:18px;font-weight:900;color:${cat.cor}">${catPct}%</div>
              <div style="height:4px;width:70px;background:var(--bg-tertiary);border-radius:2px;margin-top:4px;overflow:hidden">
                <div style="height:100%;width:${catPct}%;background:${cat.cor};border-radius:2px;transition:width .4s"></div>
              </div>
            </div>
          </div>

          <!-- Itens -->
          <div style="padding:6px 0">
            ${cat.items.map(it => {
              const checked = saved[it.id]===true;
              const isImpl = it.prazo.includes('✅');
              return `
              <div onclick="_cmpToggleMelhoria('${it.id}')" id="melhoria-row-${it.id}"
                style="display:flex;align-items:flex-start;gap:14px;padding:12px 18px;cursor:pointer;border-bottom:1px solid var(--border-color);transition:background .15s;${checked?'background:rgba(22,163,74,0.04)':''}">
                <!-- Checkbox -->
                <div style="width:22px;height:22px;border-radius:6px;border:2px solid ${checked?'#16a34a':isImpl?'#16a34a':'var(--border-color)'};background:${checked||isImpl?'#16a34a':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;transition:all .2s">
                  ${checked||isImpl?'<i class="fas fa-check" style="color:#fff;font-size:11px"></i>':''}
                </div>
                <!-- Conteúdo -->
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:${checked?'400':'600'};color:${checked?'var(--text-muted)':'var(--text-primary)'};line-height:1.5;${checked?'text-decoration:line-through':''}">${it.text}</div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:5px;align-items:center">
                    <span style="font-size:10px;padding:2px 7px;border-radius:6px;background:rgba(99,102,241,0.08);color:#6366f1;border:1px solid rgba(99,102,241,0.15)">
                      <i class="fas fa-bullseye" style="margin-right:3px;font-size:9px"></i>${it.kpi}
                    </span>
                  </div>
                </div>
                <!-- Prazo/Esforço -->
                <div style="flex-shrink:0;text-align:right">
                  <div style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${isImpl?'#16a34a20':it.esforco==='P'?'#16a34a15':it.esforco==='M'?'#d9770615':(it.esforco==='G'||it.esforco==='XG')?'#dc262615':'#dc262615'};color:${isImpl?'#16a34a':it.esforco==='P'?'#16a34a':it.esforco==='M'?'#d97706':'#dc2626'};margin-bottom:3px">
                    ${isImpl?'✅ Feito':it.prazo}
                  </div>
                  <div style="font-size:10px;color:var(--text-muted)">Esforço: <strong>${it.esforco==='P'?'Baixo':it.esforco==='M'?'Médio':it.esforco==='G'?'Alto':it.esforco==='XG'?'Muito Alto':'Muito Alto'}</strong></div>
                </div>
              </div>
            `}).join('')}
          </div>
        </div>
      `}).join('')}
    </div>

    <!-- Rodapé instrução -->
    <div style="margin-top:16px;padding:12px 16px;background:rgba(37,99,235,0.04);border-radius:10px;border:1px solid rgba(37,99,235,0.12);font-size:12px;color:var(--text-secondary)">
      <i class="fas fa-mouse-pointer" style="color:#2563eb;margin-right:6px"></i>
      <strong>Clique em qualquer ação</strong> para marcar como concluída. O progresso é salvo automaticamente.
      Itens marcados com <span style="font-weight:700;color:#16a34a">✅ Feito</span> já estão implementados no sistema.
    </div>
  `;

  return html;
}

window._cmpToggleMelhoria = function(itemId) {
  const _KEY = 'fa_melhorias_checklist';
  const _load = () => { try { return JSON.parse(localStorage.getItem(_KEY)||'{}'); } catch(e){ return {}; } };
  const _save = (d) => localStorage.setItem(_KEY, JSON.stringify(d));

  const d = _load();
  // Não permite desmarcar itens já implementados
  // Itens já implementados no sistema (não podem ser desmarcados)
  const isImpl = ['sup_01','sup_02','sup_03','sup_04','sup_05','sup_06','con_01','con_03','con_04','con_07','fin_02','dad_04'].includes(itemId);
  if (isImpl) return;

  d[itemId] = !d[itemId];
  _save(d);

  // Re-renderiza a aba
  const el = document.getElementById('cmp-aba-content');
  if (el) {
    el.innerHTML = _cmpRenderMelhorias();
  }
};

// ─── ABA: ROADMAP ─────────────────────────────────────────────────────
function _cmpRenderRoadmap() {
  const fases = [
    {
      fase: 'Fase 1', prazo: 'Q2 2026 (1–3 meses)', cor: '#16a34a', icone: 'fa-bolt',
      label: 'Quick Wins – Alta prioridade',
      score_delta: '+5 pts (72→77)',
      itens: [
        { t:'Integração NF-e/NFS-e via API (Focus NF-e ou eNotas)', p:'Alta', esforco:'M' },
        { t:'CNAB 240/150 + OFX para conciliação bancária', p:'Alta', esforco:'M' },
        { t:'PWA offline-first com service workers', p:'Média', esforco:'P' },
        { t:'SEFAZ – Consulta CNPJ/CPF em fornecedores', p:'Alta', esforco:'P' },
      ]
    },
    {
      fase: 'Fase 2', prazo: 'Q3 2026 (4–6 meses)', cor: '#2563eb', icone: 'fa-layer-group',
      label: 'Consolidação Fiscal & Operacional',
      score_delta: '+5 pts (77→82)',
      itens: [
        { t:'eSocial / Folha de Pagamento (integração Senior)', p:'Alta', esforco:'G' },
        { t:'Contabilidade básica (razão, balancete, SPED Contábil)', p:'Alta', esforco:'G' },
        { t:'WMS avançado (endereçamento, lotes, rastreabilidade)', p:'Média', esforco:'M' },
        { t:'iPaaS / API Gateway para integrações externas', p:'Alta', esforco:'M' },
      ]
    },
    {
      fase: 'Fase 3', prazo: 'Q4 2026 (7–12 meses)', cor: '#7c3aed', icone: 'fa-star',
      label: 'Diferenciação & Ecossistema',
      score_delta: '+3 pts (82→85)',
      itens: [
        { t:'App Móvel Nativo iOS/Android (React Native)', p:'Média', esforco:'G' },
        { t:'Master Data Governance (MDM) – cadastro único', p:'Alta', esforco:'M' },
        { t:'BI avançado com drill-down e alertas preditivos', p:'Média', esforco:'M' },
        { t:'Marketplace de extensões (SDK público)', p:'Estratégico', esforco:'G' },
      ]
    },
    {
      fase: 'Fase 4', prazo: '2027+ (12–24 meses)', cor: '#f59e0b', icone: 'fa-crown',
      label: 'Liderança Vertical',
      score_delta: 'Score > 88 — liderança regional',
      itens: [
        { t:'Manufatura leve / MRP para clientes com produção', p:'Baixa', esforco:'GG' },
        { t:'Certificação SOC 2 Type II', p:'Estratégico', esforco:'M' },
        { t:'Expansão internacional (LATAM)', p:'Estratégico', esforco:'GG' },
        { t:'AI Generativa para relatórios e insights automáticos', p:'Alta', esforco:'M' },
      ]
    },
  ];

  const esforcoColor = (e) => e==='P'?'#16a34a':e==='M'?'#2563eb':e==='G'?'#d97706':'#dc2626';

  return `
    <!-- Linha do tempo visual -->
    <div style="display:flex;gap:0;margin-bottom:28px;overflow-x:auto;padding-bottom:8px">
      ${fases.map((f,i) => `
        <div style="flex:1;min-width:200px;position:relative">
          ${i<fases.length-1?`<div style="position:absolute;top:20px;right:0;width:100%;height:2px;background:linear-gradient(90deg,${f.cor},${fases[i+1].cor});z-index:0"></div>`:''}
          <div style="position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:${f.cor};color:#fff;margin-bottom:8px">
            <i class="fas ${f.icone}" style="font-size:14px"></i>
          </div>
          <div style="font-size:12px;font-weight:800;color:${f.cor}">${f.fase}</div>
          <div style="font-size:11px;color:var(--text-muted)">${f.prazo}</div>
          <div style="font-size:11px;font-weight:600;color:var(--text-primary);margin-top:2px">${f.score_delta}</div>
        </div>
      `).join('')}
    </div>

    <!-- Cards por fase -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      ${fases.map(f => `
        <div style="background:var(--bg-card);border-radius:14px;border:1px solid var(--border-color);border-top:3px solid ${f.cor};padding:18px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
            <div style="width:32px;height:32px;border-radius:8px;background:${f.cor}22;display:flex;align-items:center;justify-content:center">
              <i class="fas ${f.icone}" style="color:${f.cor}"></i>
            </div>
            <div>
              <div style="font-size:12px;font-weight:800;color:${f.cor}">${f.fase} · ${f.prazo}</div>
              <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${f.label}</div>
            </div>
          </div>
          <div style="font-size:12px;color:${f.cor};font-weight:600;margin:8px 0 12px;background:${f.cor}11;padding:4px 10px;border-radius:6px;display:inline-block">${f.score_delta}</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${f.itens.map(it => `
              <div style="display:flex;align-items:flex-start;gap:8px">
                <div style="width:6px;height:6px;border-radius:50%;background:${f.cor};margin-top:5px;flex-shrink:0"></div>
                <div style="flex:1;font-size:12px;color:var(--text-secondary)">${it.t}</div>
                <div style="display:flex;gap:4px;flex-shrink:0">
                  <span style="font-size:10px;padding:1px 6px;border-radius:8px;background:${f.cor}22;color:${f.cor};font-weight:700">${it.p}</span>
                  <span title="Esforço" style="font-size:10px;padding:1px 6px;border-radius:8px;background:${esforcoColor(it.esforco)}22;color:${esforcoColor(it.esforco)};font-weight:700">${it.esforco}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── ABA: POR PERFIL ──────────────────────────────────────────────────
function _cmpRenderPerfil() {
  const perfis = [
    {
      icon:'fa-hard-hat', titulo:'Construtoras & Engenharia', cor:'#4f46e5',
      recomendado:'Fraser Alexander ERP',
      motivo:'Melhor cobertura de OS, contratos, medições e SSMA. Fluxo nativo sem customização.',
      alternativas:['TOTVS Protheus (se precisar de folha + fiscal completo)'],
      fit: 98
    },
    {
      icon:'fa-mountain', titulo:'Mineração & Recursos Naturais', cor:'#7c3aed',
      recomendado:'Fraser Alexander ERP',
      motivo:'IDF exclusivo, SSMA nativo, gestão de frota e almoxarifado de campo integrados.',
      alternativas:['SAP S/4HANA (para grupos de grande porte com orçamento amplo)'],
      fit: 95
    },
    {
      icon:'fa-industry', titulo:'Manufatura & Produção', cor:'#0070f3',
      recomendado:'TOTVS Protheus ou SAP S/4HANA',
      motivo:'Fraser não cobre MRP/PCP/produção. TOTVS tem aderência fiscal e manufatura nativas.',
      alternativas:['Odoo Enterprise (PME manufatura)', 'Infor CloudSuite (grande porte)'],
      fit: 35
    },
    {
      icon:'fa-store', titulo:'Varejo & Distribuição', cor:'#d97706',
      recomendado:'TOTVS Varejo ou Odoo',
      motivo:'Fraser não tem PDV, picking avançado ou integração com marketplaces.',
      alternativas:['Oracle NetSuite (distribuição global)'],
      fit: 20
    },
    {
      icon:'fa-hospital', titulo:'Saúde & Serviços', cor:'#16a34a',
      recomendado:'Microsoft Dynamics 365',
      motivo:'Melhor cobertura de CRM de serviços, agendamento e integração com Microsoft 365.',
      alternativas:['Oracle Fusion (médio/grande)', 'Odoo (PME)'],
      fit: 40
    },
    {
      icon:'fa-chart-line', titulo:'Grupo Econômico Multi-empresa', cor:'#dc2626',
      recomendado:'Fraser Alexander ERP (Multi-CNPJ)',
      motivo:'Multi-empresa nativo, DRE consolidado e KPI Executivo unificado. Deploy rápido.',
      alternativas:['SAP (se faturamento > R$ 500M/ano)', 'TOTVS (se precisa de fiscal contábil completo)'],
      fit: 85
    },
  ];

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
      ${perfis.map(p => `
        <div style="background:var(--bg-card);border-radius:14px;border:1px solid var(--border-color);padding:18px;transition:all .2s"
          onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'"
          onmouseout="this.style.boxShadow='none'">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <div style="width:40px;height:40px;border-radius:10px;background:${p.cor}18;display:flex;align-items:center;justify-content:center">
              <i class="fas ${p.icon}" style="color:${p.cor};font-size:18px"></i>
            </div>
            <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${p.titulo}</div>
          </div>

          <!-- Fit meter -->
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="font-size:11px;color:var(--text-muted)">Aderência Fraser Alexander</span>
              <span style="font-size:13px;font-weight:800;color:${p.fit>=70?'#16a34a':p.fit>=40?'#ca8a04':'#dc2626'}">${p.fit}%</span>
            </div>
            <div style="height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${p.fit}%;background:${p.fit>=70?'#16a34a':p.fit>=40?'#ca8a04':'#dc2626'};border-radius:4px;transition:width 1s ease"></div>
            </div>
          </div>

          <div style="margin-bottom:8px">
            <div style="font-size:10px;text-transform:uppercase;font-weight:700;color:var(--text-muted);margin-bottom:3px">Recomendado</div>
            <div style="font-size:13px;font-weight:700;color:${p.cor}">${p.recomendado}</div>
          </div>

          <p style="font-size:12px;color:var(--text-secondary);line-height:1.5;margin:0 0 10px">${p.motivo}</p>

          ${p.alternativas.length?`
            <div style="background:var(--bg-tertiary);border-radius:8px;padding:8px 10px">
              <div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:4px">ALTERNATIVAS</div>
              ${p.alternativas.map(a=>`<div style="font-size:11px;color:var(--text-secondary)">• ${a}</div>`).join('')}
            </div>
          `:''}
        </div>
      `).join('')}
    </div>
  `;
}

// ─── GRÁFICOS ─────────────────────────────────────────────────────────
function _cmpInitCharts() {
  if (typeof Chart === 'undefined') return;

  const mode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const gridColor = mode==='dark'?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.07)';
  const textColor = mode==='dark'?'#aaa':'#555';
  Chart.defaults.color = textColor;

  // Bar chart – Visão Geral
  const barCtx = document.getElementById('cmp-bar-chart');
  if (barCtx) {
    if (_cmpCharts.bar) { _cmpCharts.bar.destroy(); }
    const erps = Object.values(CMP_ERPS).sort((a,b)=>b.total-a.total);
    _cmpCharts.bar = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: erps.map(e => e.nome.split(' ').slice(0,2).join(' ')),
        datasets: [{
          label: 'Score Geral',
          data: erps.map(e => e.total),
          backgroundColor: erps.map(e => e.cor+'CC'),
          borderColor: erps.map(e => e.cor),
          borderWidth: 2,
          borderRadius: 8,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` Score: ${ctx.raw}/100`
            }
          }
        },
        scales: {
          y: { beginAtZero:false, min:20, max:100, grid:{color:gridColor} },
          x: { grid:{display:false} }
        },
        animation: { duration: 800, easing: 'easeOutQuart' }
      }
    });
  }

  // Radar chart
  const radarCtx = document.getElementById('cmp-radar-chart');
  if (radarCtx) {
    if (_cmpCharts.radar) { _cmpCharts.radar.destroy(); }
    const labels = Object.values(CMP_CRITERIOS).map(c=>c.label);
    const erpsKeys = ['fraser','sap','totvs','odoo'];
    _cmpCharts.radar = new Chart(radarCtx, {
      type: 'radar',
      data: {
        labels,
        datasets: erpsKeys.map(k => ({
          label: CMP_ERPS[k].nome.split(' ').slice(0,2).join(' '),
          data: Object.keys(CMP_CRITERIOS).map(ck => CMP_ERPS[k].scores[ck]),
          backgroundColor: CMP_ERPS[k].cor+'25',
          borderColor: CMP_ERPS[k].cor,
          borderWidth: k==='fraser'?3:1.5,
          pointBackgroundColor: CMP_ERPS[k].cor,
          pointRadius: k==='fraser'?5:3,
        }))
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            beginAtZero: true, max: 100,
            grid: { color: gridColor },
            angleLines: { color: gridColor },
            ticks: { backdropColor: 'transparent', stepSize: 20, font:{size:9} },
            pointLabels: { font:{size:10}, color: textColor }
          }
        },
        animation: { duration: 1000 }
      }
    });
  }

  // Bubble chart
  const bubbleCtx = document.getElementById('cmp-bubble-chart');
  if (bubbleCtx) {
    if (_cmpCharts.bubble) { _cmpCharts.bubble.destroy(); }
    const erps = Object.values(CMP_ERPS);
    _cmpCharts.bubble = new Chart(bubbleCtx, {
      type: 'bubble',
      data: {
        datasets: erps.map(e => ({
          label: e.nome.split(' ').slice(0,2).join(' '),
          data: [{
            x: e.scores.custo_beneficio,
            y: e.scores.funcionalidade,
            r: Math.max(8, e.scores.ux / 8)
          }],
          backgroundColor: e.cor+'80',
          borderColor: e.cor,
          borderWidth: 2,
        }))
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right', labels: { font:{size:10}, boxWidth:10 } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const e = erps[ctx.datasetIndex];
                return ` ${e.nome.split(' ').slice(0,2).join(' ')}: Custo-Ben:${ctx.raw.x} / Func:${ctx.raw.y} / UX:${e.scores.ux}`;
              }
            }
          }
        },
        scales: {
          x: { title:{display:true,text:'Custo-Benefício →',font:{size:10}}, min:20, max:100, grid:{color:gridColor} },
          y: { title:{display:true,text:'Funcionalidade ↑',font:{size:10}}, min:50, max:100, grid:{color:gridColor} }
        },
        animation: { duration: 800 }
      }
    });
  }
}

// ─── DETALHE MODAL DE ERP ─────────────────────────────────────────────
function _cmpDetalheERP(key) {
  const e = CMP_ERPS[key];
  if (!e) return;
  const fmt = (s) => `<div style="display:flex;justify-content:space-between;margin-bottom:4px"><div style="height:6px;width:100%;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;margin-top:2px"><div style="height:100%;width:${s}%;background:${_cmpCorScore(s)};border-radius:3px"></div></div></div>`;

  openModalWide(`${e.logo} ${e.nome}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">INFORMAÇÕES GERAIS</div>
        ${[
          ['Segmento', e.segmento],
          ['Origem', e.origem],
          ['Modelo', e.modelo],
          ['Tier', e.tier],
          ['Usuários Ideais', e.usuarios_ideais],
          ['Deploy', e.deployments],
          ['Fiscal BR', e.integracao_fiscal],
          ['Suporte BR', e.suporte_br],
        ].map(([l,v])=>`<div style="display:flex;gap:8px;margin-bottom:4px;font-size:12px"><span style="color:var(--text-muted);min-width:100px">${l}:</span><span style="font-weight:600;color:var(--text-primary)">${v}</span></div>`).join('')}
      </div>
      <div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">SCORES POR CRITÉRIO</div>
        ${Object.entries(CMP_CRITERIOS).map(([k,c])=>`
          <div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;margin-bottom:2px">
              <span style="font-size:11px;color:var(--text-secondary)">${c.label}</span>
              <span style="font-size:12px;font-weight:700;color:${_cmpCorScore(e.scores[k])}">${e.scores[k]}</span>
            </div>
            <div style="height:5px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${e.scores[k]}%;background:${_cmpCorScore(e.scores[k])};border-radius:3px"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    <div style="background:var(--bg-tertiary);border-radius:8px;padding:12px;margin-bottom:12px">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">INVESTIMENTO</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div><span style="font-size:11px;color:var(--text-muted)">Implantação: </span><span style="font-weight:700;color:var(--text-primary)">${e.custo_impl}</span></div>
        <div><span style="font-size:11px;color:var(--text-muted)">Mensalidade: </span><span style="font-weight:700;color:var(--text-primary)">${e.custo_mensal}</span></div>
        <div><span style="font-size:11px;color:var(--text-muted)">Go-live: </span><span style="font-weight:700;color:var(--text-primary)">${e.tempo_impl}</span></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div>
        <div style="font-size:12px;font-weight:700;color:#16a34a;margin-bottom:6px"><i class="fas fa-check-circle" style="margin-right:4px"></i>Pontos Fortes</div>
        ${e.pontos_fortes.map(p=>`<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:4px;font-size:11px;color:var(--text-secondary)"><i class="fas fa-plus" style="color:#16a34a;margin-top:2px;font-size:10px;flex-shrink:0"></i>${p}</div>`).join('')}
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;color:#dc2626;margin-bottom:6px"><i class="fas fa-times-circle" style="margin-right:4px"></i>Pontos Fracos</div>
        ${e.pontos_fracos.map(p=>`<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:4px;font-size:11px;color:var(--text-secondary)"><i class="fas fa-minus" style="color:#dc2626;margin-top:2px;font-size:10px;flex-shrink:0"></i>${p}</div>`).join('')}
      </div>
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`);
}

// ─── COMPARADOR SIDE BY SIDE ──────────────────────────────────────────
function _cmpAbrirComparador() {
  const erpsKeys = Object.keys(CMP_ERPS);
  openModalWide('⚡ Comparar ERPs lado a lado', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">ERP 1 (referência)</label>
        <select class="form-control" id="cmp-sel-a" onchange="_cmpAtualizarComparador()">
          ${erpsKeys.map(k=>`<option value="${k}" ${k==='fraser'?'selected':''}>${CMP_ERPS[k].logo} ${CMP_ERPS[k].nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">ERP 2 (comparar com)</label>
        <select class="form-control" id="cmp-sel-b" onchange="_cmpAtualizarComparador()">
          ${erpsKeys.map(k=>`<option value="${k}" ${k==='sap'?'selected':''}>${CMP_ERPS[k].logo} ${CMP_ERPS[k].nome}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="cmp-comparador-result">
      ${_cmpGerarComparacao('fraser','sap')}
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`);
}

function _cmpAtualizarComparador() {
  const a = document.getElementById('cmp-sel-a')?.value;
  const b = document.getElementById('cmp-sel-b')?.value;
  const el = document.getElementById('cmp-comparador-result');
  if (el && a && b) el.innerHTML = _cmpGerarComparacao(a, b);
}

function _cmpGerarComparacao(keyA, keyB) {
  const a = CMP_ERPS[keyA], b = CMP_ERPS[keyB];
  return `
    <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:start">
      <div style="background:${a.cor}15;border-radius:10px;border:2px solid ${a.cor};padding:14px">
        <div style="font-size:20px;text-align:center">${a.logo}</div>
        <div style="font-size:13px;font-weight:700;color:var(--text-primary);text-align:center;margin:4px 0">${a.nome}</div>
        <div style="font-size:24px;font-weight:900;color:${a.cor};text-align:center">${a.total}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;padding-top:20px">
        ${Object.entries(CMP_CRITERIOS).map(([k,c]) => {
          const da=a.scores[k], db=b.scores[k];
          const win = da>db?'a':da<db?'b':'tie';
          return `
            <div style="display:flex;align-items:center;justify-content:center;gap:8px">
              <span style="font-size:12px;font-weight:${win==='a'?800:500};color:${win==='a'?a.cor:'var(--text-muted)'}">
                ${da}${win==='a'?' ✓':''}
              </span>
              <span style="font-size:10px;color:var(--text-muted);text-align:center;width:80px;line-height:1.2">${c.label}</span>
              <span style="font-size:12px;font-weight:${win==='b'?800:500};color:${win==='b'?b.cor:'var(--text-muted)'}">
                ${win==='b'?' ✓':''}${db}
              </span>
            </div>
          `;
        }).join('')}
      </div>
      <div style="background:${b.cor}15;border-radius:10px;border:2px solid ${b.cor};padding:14px">
        <div style="font-size:20px;text-align:center">${b.logo}</div>
        <div style="font-size:13px;font-weight:700;color:var(--text-primary);text-align:center;margin:4px 0">${b.nome}</div>
        <div style="font-size:24px;font-weight:900;color:${b.cor};text-align:center">${b.total}</div>
      </div>
    </div>
  `;
}

// ─── EXPORTAR PDF ─────────────────────────────────────────────────────
function _cmpExportarRelatorio() {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const erps = Object.values(CMP_ERPS).sort((a,b)=>a.rank-b.rank);

  const html = `<!DOCTYPE html><html lang="pt-BR"><head>
  <meta charset="UTF-8"><title>Análise Competitiva ERP – ${hoje}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;padding:28px}
    h1{font-size:20px;font-weight:900;color:#4f46e5}
    h2{font-size:13px;font-weight:700;color:#4f46e5;border-bottom:1px solid #e0e0e0;padding-bottom:4px;margin:16px 0 8px}
    table{width:100%;border-collapse:collapse;margin-bottom:12px}
    th{background:#4f46e5;color:#fff;padding:7px 10px;text-align:left;font-size:10px}
    td{padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:10px}
    tr:nth-child(even) td{background:#f8f8fc}
    .fraser td{background:#ede9fe!important;font-weight:700}
    .badge{display:inline-block;padding:2px 8px;border-radius:8px;font-size:9px;font-weight:700}
    .tag-alt{background:#dcfce7;color:#166534}
    .tag-bem{background:#dbeafe;color:#1e40af}
    .tag-bad{background:#fee2e2;color:#991b1b}
    @media print{body{padding:16px}}
  </style></head>
  <body>
    <div style="border-bottom:3px solid #4f46e5;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <h1>🏗️ Análise Competitiva de ERPs</h1>
        <p style="color:#666;font-size:11px;margin-top:4px">Benchmark Fraser Alexander ERP vs. Principais Soluções do Mercado</p>
      </div>
      <div style="text-align:right;font-size:11px;color:#888">Emitido em: ${hoje}<br>Fraser Alexander – Sistema de Gestão</div>
    </div>
    <h2>Ranking Geral</h2>
    <table>
      <thead><tr><th>#</th><th>ERP</th><th>Segmento</th><th>Tier</th><th>Score</th><th>Custo-Ben.</th><th>UX</th><th>Fiscal BR</th><th>Implantação</th></tr></thead>
      <tbody>
        ${erps.map(e=>`
          <tr class="${e.nome.includes('Fraser')?'fraser':''}">
            <td>${e.rank}${e.nome.includes('Fraser')?'⭐':''}</td>
            <td>${e.logo} <strong>${e.nome}</strong></td>
            <td>${e.segmento}</td>
            <td>${e.tier}</td>
            <td><strong style="color:${_cmpCorScore(e.total)}">${e.total}/100</strong></td>
            <td>${e.scores.custo_beneficio}</td>
            <td>${e.scores.ux}</td>
            <td>${e.scores.fiscal_br}</td>
            <td>${e.tempo_impl}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <h2>Vantagens Competitivas – Fraser Alexander ERP</h2>
    <ul style="padding-left:16px;margin-bottom:12px">
      ${CMP_ERPS.fraser.pontos_fortes.map(p=>`<li style="margin-bottom:3px;font-size:11px">${p}</li>`).join('')}
    </ul>
    <h2>Principais Lacunas Identificadas</h2>
    <ul style="padding-left:16px;margin-bottom:12px">
      ${CMP_ERPS.fraser.pontos_fracos.map(p=>`<li style="margin-bottom:3px;font-size:11px;color:#dc2626">${p}</li>`).join('')}
    </ul>
    <div style="margin-top:20px;border-top:1px solid #e0e0e0;padding-top:10px;font-size:10px;color:#888;text-align:center">
      Fraser Alexander – Sistema de Gestão Integrado · ${hoje} · Documento confidencial
    </div>
  </body></html>`;

  const win = window.open('', '_blank', 'width=960,height=700');
  if (!win) { showToast('Bloqueio de popup! Permita popups para este site.', 'error'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = function() { setTimeout(()=>{ win.focus(); win.print(); }, 500); };
  showToast('📊 Relatório comparativo pronto para impressão/PDF!', 'success', 4000);
}
