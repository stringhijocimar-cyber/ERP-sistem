// =====================================================================
// Fraser Alexander ERP – Módulo Auditoria AI v2
// Análise inteligente de conformidade de processos
// =====================================================================

// ─── Engine de análise (roda 100% no browser, sem API externa) ───────
const _AUD = {

  // Coleta snapshot de todos os dados do sistema
  snapshot() {
    const get = k => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch(e) { return []; } };
    return {
      contratos:   get('fa_contratos'),
      os:          [...get('fa_os'), ...get('fa_fluxo_os').map(f => ({
                     id: f.os_id || f.id,
                     descricao: f.os_descricao || f.descricao,
                     status: f.status,
                     contrato: f.os_contrato || f.contrato,
                     itens: f.itens || [],
                     tipo_compra: f.os_tipo_compra,
                     valor_total: f.itens ? f.itens.reduce((s,i)=>s+(i.valor_unit||0)*(i.qtd||1),0) : 0,
                     data_criacao: f.data_criacao,
                     criado_por: f.criado_por,
                   }))],
      rcs:         [...get('fa_requisicoes'), ...get('fa_fluxo_os').flatMap(f => f.rcs_geradas || [])],
      rfqs:        [...get('fa_rfqs'), ...get('fa_rfq_flow')],
      matrizes:    get('fa_matrizes'),
      pedidos:     [...get('fa_pedidos'), ...(window.FA_PEDIDOS || [])],
      fornecedores:get('fa_fornecedores'),
      avaliacoes:  get('fa_avaliacoes_forn'),
      contas_pagar:get('fa_contas_pagar'),
      equipe:      get('fa_equipe'),
      ssma:        get('fa_incidentes'),
      treinamentos:get('fa_treinamentos'),
      documentos:  get('fa_documentos'),
      medicoes:    get('fa_medicoes'),
      projetos:    get('fa_projetos'),
    };
  },

  // ─── REGRAS DE AUDITORIA ─────────────────────────────────────────
  regras: [

    // ══ GRUPO: COMPRAS / COTAÇÕES ═══════════════════════════════════
    {
      id: 'A001', grupo: 'Compras', criticidade: 'Alta',
      titulo: 'OS com tipo de compra indefinido',
      norma: 'ISO 9001:8.4 / Procedimento Interno de Compras',
      desc: 'Ordens de Serviço com necessidade de compra devem ter o tipo definido (Material, Misto, Serviço Externo ou Serviço Interno).',
      check(d) {
        const problemas = d.os.filter(o =>
          o.precisa_compra === true && (!o.tipo_compra || o.tipo_compra === 'Não definido')
        );
        return { ok: problemas.length === 0, itens: problemas.map(o => o.id + ' – ' + (o.descricao||'')) };
      }
    },
    {
      id: 'A002', grupo: 'Compras', criticidade: 'Alta',
      titulo: 'Pedidos de compra sem mapa comparativo aprovado',
      norma: 'ISO 9001:8.4.1 / Política de Compras §3.2',
      desc: 'Todo Pedido de Compra deve estar vinculado a um Mapa Comparativo de Cotações aprovado (exceto compras de emergência documentadas).',
      check(d) {
        const problemas = d.pedidos.filter(p =>
          p.status !== 'Cancelado' && p.status !== 'Rascunho' &&
          !p.matriz_id && !p.rfq_id && (p.valor_total || 0) > 5000
        );
        return { ok: problemas.length === 0, itens: problemas.map(p => p.numero + ' – R$ ' + (p.valor_total||0).toLocaleString('pt-BR',{minimumFractionDigits:2})) };
      }
    },
    {
      id: 'A003', grupo: 'Compras', criticidade: 'Média',
      titulo: 'RFQs abertas há mais de 30 dias',
      norma: 'Procedimento de Cotações §4.1 – Prazo máximo de vigência',
      desc: 'Processos de cotação devem ser concluídos dentro de 30 dias da abertura. RFQs abertas além desse prazo indicam estagnação no processo.',
      check(d) {
        const limite = 30 * 24 * 3600 * 1000;
        const agora = Date.now();
        const problemas = d.rfqs.filter(r => {
          if (['Aprovada','Pedido Emitido','Cancelada','PC Emitido'].includes(r.status)) return false;
          const dt = r.data_criacao || r.criado_em || r.data_abertura;
          if (!dt) return false;
          return (agora - new Date(dt).getTime()) > limite;
        });
        return { ok: problemas.length === 0, itens: problemas.map(r => (r.numero_rfq || r.numero || r.id) + ' – ' + (r.titulo||'')) };
      }
    },
    {
      id: 'A004', grupo: 'Compras', criticidade: 'Alta',
      titulo: 'Pedidos com pagamento antecipado sem justificativa',
      norma: 'Política Financeira §6.1 – Pagamento Antecipado requer aprovação de Diretor',
      desc: 'Pedidos com condição de pagamento "Antecipado" acima de R$ 10.000 devem ter justificativa e aprovação de Diretor registradas.',
      check(d) {
        const problemas = d.pedidos.filter(p =>
          p.cond_pagamento === 'Antecipado' &&
          (p.valor_total || 0) > 10000 &&
          !['Cancelado','Rascunho'].includes(p.status)
        );
        return { ok: problemas.length === 0, itens: problemas.map(p => p.numero + ' – ' + fmt(p.valor_total) + ' – ' + (p.fornecedor_nome||'')) };
      }
    },
    {
      id: 'A005', grupo: 'Compras', criticidade: 'Média',
      titulo: 'Fornecedores sem avaliação nos últimos 12 meses',
      norma: 'ISO 9001:8.4.1 – Avaliação periódica de fornecedores críticos',
      desc: 'Fornecedores com pedidos emitidos nos últimos 6 meses devem ter avaliação de desempenho registrada nos últimos 12 meses.',
      check(d) {
        const um_ano_atras = Date.now() - 365 * 24 * 3600 * 1000;
        const seis_meses_atras = Date.now() - 180 * 24 * 3600 * 1000;
        const fornRecentes = new Set(
          d.pedidos
            .filter(p => p.data_emissao && new Date(p.data_emissao).getTime() > seis_meses_atras)
            .map(p => p.fornecedor_id || p.fornecedor)
            .filter(Boolean)
        );
        const avalIds = new Set(
          d.avaliacoes
            .filter(a => a.data && new Date(a.data).getTime() > um_ano_atras)
            .map(a => a.fornecedor_id || a.id_fornecedor)
        );
        const problemas = [...fornRecentes].filter(fid => !avalIds.has(fid));
        const nomes = problemas.map(fid => {
          const f = d.fornecedores.find(x => x.id === fid);
          return f ? (f.nome_fantasia || f.razao_social) : fid;
        });
        return { ok: problemas.length === 0, itens: nomes };
      }
    },
    {
      id: 'A006', grupo: 'Compras', criticidade: 'Alta',
      titulo: 'Cotações com único fornecedor sem justificativa',
      norma: 'Política de Compras §3.1 – Mínimo 3 cotações para valores > R$ 5.000',
      desc: 'Processos de cotação com apenas um fornecedor convidado para valores acima de R$ 5.000 violam a política de concorrência mínima.',
      check(d) {
        const problemas = d.rfqs.filter(r => {
          if (['Cancelada'].includes(r.status)) return false;
          const nForn = (r.fornecedores || r.suppliers || []).length;
          const vlr = r.valor_estimado || r.valor_total || 0;
          return nForn <= 1 && vlr > 5000;
        });
        return { ok: problemas.length === 0, itens: problemas.map(r => (r.numero_rfq||r.numero||r.id) + ' – ' + (r.titulo||'') + ' – R$ ' + fmt(r.valor_estimado||0)) };
      }
    },
    {
      id: 'A007', grupo: 'Compras', criticidade: 'Média',
      titulo: 'Mapas comparativos sem aprovador registrado',
      norma: 'Fluxo de Aprovação §2 – Aprovação formal obrigatória em mapas',
      desc: 'Mapas de cotação com status "Aprovado" devem ter o aprovador e a data de aprovação registrados.',
      check(d) {
        const problemas = d.matrizes.filter(m =>
          m.status === 'Aprovado' && (!m.aprovado_por || !m.data_aprovacao)
        );
        return { ok: problemas.length === 0, itens: problemas.map(m => (m.id||m.numero||'—') + ' – ' + (m.titulo||'')) };
      }
    },
    {
      id: 'A008', grupo: 'Compras', criticidade: 'Baixa',
      titulo: 'Pedidos entregues sem confirmação de recebimento',
      norma: 'ISO 9001:8.4.3 – Verificação de produto/serviço adquirido',
      desc: 'Pedidos com status "Entregue" devem ter confirmação formal de recebimento com data, responsável e quantidade conferida.',
      check(d) {
        const problemas = d.pedidos.filter(p =>
          p.status === 'Entregue' && !p.data_recebimento && !p.confirmacao_recebimento
        );
        return { ok: problemas.length === 0, itens: problemas.slice(0,10).map(p => p.numero + ' – ' + (p.fornecedor_nome||'')) };
      }
    },

    // ══ GRUPO: CONTRATOS ════════════════════════════════════════════
    {
      id: 'B001', grupo: 'Contratos', criticidade: 'Alta',
      titulo: 'Contratos vencidos ou a vencer em 30 dias',
      norma: 'Gestão de Contratos §2.3 – Renovação antecipada obrigatória',
      desc: 'Contratos ativos devem ter vigência monitorada. Contratos vencidos ou a vencer em 30 dias precisam de renovação ou encerramento formal.',
      check(d) {
        const hoje = Date.now();
        const d30 = hoje + 30 * 24 * 3600 * 1000;
        const problemas = d.contratos.filter(c => {
          if (c.status === 'Encerrado' || c.status === 'Suspenso') return false;
          const fim = c.data_fim || c.vigencia_fim || c.data_termino;
          if (!fim) return false;
          const t = new Date(fim + 'T23:59:59').getTime();
          return t <= d30;
        });
        return { ok: problemas.length === 0, itens: problemas.map(c => (c.numero||c.id) + ' – ' + (c.cliente||c.contratante||'') + ' – Fim: ' + (c.data_fim||c.vigencia_fim||'')) };
      }
    },
    {
      id: 'B002', grupo: 'Contratos', criticidade: 'Média',
      titulo: 'Contratos sem gestor designado',
      norma: 'ISO 9001:8.4 – Responsabilidade pela gestão de contratos',
      desc: 'Todo contrato ativo deve ter um gestor responsável designado para acompanhamento e fiscalização.',
      check(d) {
        const problemas = d.contratos.filter(c =>
          c.status === 'Ativo' && !c.gestor && !c.responsavel && !c.gerente
        );
        return { ok: problemas.length === 0, itens: problemas.map(c => (c.numero||c.id) + ' – ' + (c.cliente||'')) };
      }
    },
    {
      id: 'B003', grupo: 'Contratos', criticidade: 'Baixa',
      titulo: 'OS sem vínculo contratual',
      norma: 'Procedimento Operacional – Toda OS deve referenciar um contrato ativo',
      desc: 'Ordens de Serviço devem estar vinculadas a um contrato ativo. OS sem contrato podem indicar trabalho não contratualizado.',
      check(d) {
        const contratosAtivos = new Set(d.contratos.filter(c=>c.status==='Ativo').map(c=>c.id));
        const problemas = d.os.filter(o =>
          !o.contrato || (!contratosAtivos.has(o.contrato) && o.status !== 'Cancelada')
        );
        return { ok: problemas.length === 0, itens: problemas.slice(0,10).map(o => o.id + ' – ' + (o.descricao||'')) };
      }
    },
    {
      id: 'B004', grupo: 'Contratos', criticidade: 'Alta',
      titulo: 'Medições sem aprovação do cliente',
      norma: 'Gestão de Contratos §5.2 – Medição deve ser aprovada pelo cliente antes do faturamento',
      desc: 'Medições em estado "Pendente Aprovação" por mais de 15 dias representam risco de receita não reconhecida.',
      check(d) {
        const limite = 15 * 24 * 3600 * 1000;
        const agora = Date.now();
        const problemas = d.medicoes.filter(m => {
          if (!['Pendente Aprovação','Aguardando'].includes(m.status)) return false;
          const dt = m.data_envio || m.data_criacao;
          if (!dt) return false;
          return (agora - new Date(dt).getTime()) > limite;
        });
        return { ok: problemas.length === 0, itens: problemas.slice(0,10).map(m => (m.numero||m.id) + ' – Contrato: ' + (m.contrato||'') + ' – R$ ' + fmt(m.valor||0)) };
      }
    },
    {
      id: 'B005', grupo: 'Contratos', criticidade: 'Média',
      titulo: 'Contratos sem seguro vigente',
      norma: 'Requisito Contratual Padrão – Seguro RC e de Obra obrigatórios',
      desc: 'Contratos ativos de execução devem ter apólice de seguro vigente (Responsabilidade Civil e/ou Seguro de Obra).',
      check(d) {
        const hoje = Date.now();
        const problemas = d.contratos.filter(c => {
          if (c.status !== 'Ativo') return false;
          const segValidade = c.seguro_validade || c.apólice_validade;
          if (!segValidade) return true;
          return new Date(segValidade).getTime() < hoje;
        });
        return { ok: problemas.length === 0, itens: problemas.slice(0,10).map(c => (c.numero||c.id) + ' – ' + (c.cliente||'') + ' – Seguro: ' + (c.seguro_validade||'Não informado')) };
      }
    },

    // ══ GRUPO: FINANCEIRO ═══════════════════════════════════════════
    {
      id: 'C001', grupo: 'Financeiro', criticidade: 'Alta',
      titulo: 'Contas a pagar vencidas não pagas',
      norma: 'Política Financeira §4.2 – Inadimplência com fornecedores',
      desc: 'Contas a pagar vencidas há mais de 5 dias úteis sem justificativa de atraso impactam o rating de fornecedores e podem gerar multas contratuais.',
      check(d) {
        const hoje = Date.now();
        const cinco_dias = 5 * 24 * 3600 * 1000;
        const problemas = d.contas_pagar.filter(cp => {
          if (['Paga','Cancelada'].includes(cp.status)) return false;
          const venc = cp.data_vencimento || cp.vencimento;
          if (!venc) return false;
          return (hoje - new Date(venc).getTime()) > cinco_dias;
        });
        return { ok: problemas.length === 0, itens: problemas.slice(0,10).map(cp => (cp.numero||cp.id) + ' – ' + (cp.fornecedor||cp.descricao||'') + ' – Venc: ' + (cp.data_vencimento||'')) };
      }
    },
    {
      id: 'C002', grupo: 'Financeiro', criticidade: 'Média',
      titulo: 'Pedidos emitidos sem conta a pagar gerada',
      norma: 'Integração Financeira §1.1 – Emissão de PC gera obrigação financeira automaticamente',
      desc: 'Todo Pedido de Compra com pagamento antecipado deve ter conta a pagar correspondente gerada no módulo financeiro.',
      check(d) {
        const cpIds = new Set(d.contas_pagar.map(cp => cp.pedido_id || cp.origem_id).filter(Boolean));
        const problemas = d.pedidos.filter(p =>
          p.cond_pagamento === 'Antecipado' &&
          ['Emitido','Aprovado'].includes(p.status) &&
          !cpIds.has(p.id)
        );
        return { ok: problemas.length === 0, itens: problemas.map(p => p.numero + ' – ' + fmt(p.valor_total)) };
      }
    },
    {
      id: 'C003', grupo: 'Financeiro', criticidade: 'Alta',
      titulo: 'Contas a pagar sem NF vinculada',
      norma: 'Política Fiscal §3.1 – Toda obrigação fiscal deve ter NF emitida',
      desc: 'Contas a pagar com status "Aprovado" ou "A Pagar" devem ter número de Nota Fiscal vinculado para fins contábeis e fiscais.',
      check(d) {
        const problemas = d.contas_pagar.filter(cp =>
          ['A Pagar','Aprovado'].includes(cp.status) &&
          !cp.nota_fiscal && !cp.nf_numero && !cp.numero_nf
        );
        return { ok: problemas.length === 0, itens: problemas.slice(0,10).map(cp => (cp.numero||cp.id) + ' – ' + (cp.fornecedor||'') + ' – R$ ' + fmt(cp.valor||cp.valor_total||0)) };
      }
    },
    {
      id: 'C004', grupo: 'Financeiro', criticidade: 'Média',
      titulo: 'Pedidos aprovados sem data de entrega prevista',
      norma: 'Logística §2.2 – Prazo de entrega obrigatório em PC aprovado',
      desc: 'Pedidos aprovados devem ter data de entrega prevista para planejamento de estoque e logística.',
      check(d) {
        const problemas = d.pedidos.filter(p =>
          ['Aprovado','Emitido'].includes(p.status) &&
          !p.prazo_entrega && !p.data_entrega_prevista && !p.delivery_date
        );
        return { ok: problemas.length === 0, itens: problemas.slice(0,10).map(p => p.numero + ' – ' + (p.fornecedor_nome||'')) };
      }
    },

    // ══ GRUPO: SSMA / CONFORMIDADE ══════════════════════════════════
    {
      id: 'D001', grupo: 'SSMA', criticidade: 'Alta',
      titulo: 'Incidentes sem plano de ação encerrado',
      norma: 'ISO 45001:10.2 – Ação corretiva obrigatória para incidentes',
      desc: 'Todo incidente de segurança deve ter um plano de ação corretiva aberto, com responsável e prazo definidos, e encerrado após implementação.',
      check(d) {
        const problemas = d.ssma.filter(i =>
          ['Em Investigação','Plano de Ação Aberto'].includes(i.status) &&
          !i.data_encerramento
        );
        return { ok: problemas.length === 0, itens: problemas.map(i => (i.numero||i.id) + ' – ' + (i.tipo||'') + ' – ' + (i.descricao||'').slice(0,60)) };
      }
    },
    {
      id: 'D002', grupo: 'SSMA', criticidade: 'Alta',
      titulo: 'Colaboradores com treinamentos vencidos',
      norma: 'NR-35 / NR-10 / Programa de Treinamentos §2.1',
      desc: 'Colaboradores mobilizados devem ter treinamentos obrigatórios (NRs, SSMA, operacional) em dia. Treinamentos vencidos bloqueiam a operação.',
      check(d) {
        const hoje = Date.now();
        const problemas = d.treinamentos.filter(t => {
          const validade = t.validade || t.data_validade || t.expiracao;
          if (!validade) return false;
          return new Date(validade).getTime() < hoje;
        });
        return { ok: problemas.length === 0, itens: problemas.slice(0,10).map(t => (t.colaborador||t.nome||'—') + ' – ' + (t.curso||t.treinamento||'') + ' – Venc: ' + (t.validade||'')) };
      }
    },
    {
      id: 'D003', grupo: 'SSMA', criticidade: 'Média',
      titulo: 'Documentos controlados vencidos',
      norma: 'ISO 9001:7.5 – Controle de informações documentadas',
      desc: 'Documentos controlados (procedimentos, APRs, PTAs) devem ser revisados periodicamente. Documentos vencidos devem ser retirados de circulação.',
      check(d) {
        const hoje = Date.now();
        const problemas = d.documentos.filter(doc => {
          const validade = doc.validade || doc.data_validade;
          if (!validade) return false;
          return new Date(validade).getTime() < hoje && doc.status !== 'Arquivado';
        });
        return { ok: problemas.length === 0, itens: problemas.slice(0,10).map(doc => (doc.titulo||doc.nome||doc.id) + ' – Venc: ' + (doc.validade||'')) };
      }
    },
    {
      id: 'D004', grupo: 'SSMA', criticidade: 'Alta',
      titulo: 'Incidentes graves sem notificação regulatória',
      norma: 'NR-1 §6 / CIPA – Notificação obrigatória de acidentes com afastamento',
      desc: 'Acidentes com afastamento ou com potencial de óbito devem ter notificação ao MTE e CIPA registrada no sistema.',
      check(d) {
        const graves = ['Acidente com Afastamento','Acidente Fatal','Acidente Grave'];
        const problemas = d.ssma.filter(i =>
          graves.includes(i.tipo || i.classificacao) &&
          !i.notificacao_mte && !i.notificacao_cipa
        );
        return { ok: problemas.length === 0, itens: problemas.map(i => (i.numero||i.id) + ' – ' + (i.tipo||'') + ' – ' + (i.data||'')) };
      }
    },
    {
      id: 'D005', grupo: 'SSMA', criticidade: 'Média',
      titulo: 'EPI sem registro de entrega assinado',
      norma: 'NR-6 §6.7 – Ficha de EPI deve ser assinada pelo trabalhador',
      desc: 'A entrega de EPI deve ser registrada com assinatura do colaborador na ficha individual de EPI.',
      check(d) {
        const ativos = d.equipe.filter(e => e.status === 'Ativo');
        const problemas = ativos.filter(e => !e.ficha_epi && !e.epi_registrado);
        return { ok: problemas.length === 0, itens: problemas.slice(0,10).map(e => e.nome || e.id) };
      }
    },

    // ══ GRUPO: RECURSOS HUMANOS ═════════════════════════════════════
    {
      id: 'E001', grupo: 'RH / Equipe', criticidade: 'Média',
      titulo: 'Colaboradores mobilizados sem ASO vigente',
      norma: 'NR-7 – PCMSO: ASO periódico obrigatório para trabalhadores',
      desc: 'Todo colaborador mobilizado deve ter Atestado de Saúde Ocupacional (ASO) vigente. ASO vencido impede a permanência no canteiro.',
      check(d) {
        const hoje = Date.now();
        const problemas = d.equipe.filter(e => {
          if (e.status !== 'Ativo' && e.mobilizacao_status !== 'Mobilizado') return false;
          const aso = e.aso_validade || e.data_aso;
          if (!aso) return true;
          return new Date(aso).getTime() < hoje;
        });
        return { ok: problemas.length === 0, itens: problemas.slice(0,10).map(e => (e.nome||e.id) + ' – ASO: ' + (e.aso_validade||'Não informado')) };
      }
    },
    {
      id: 'E002', grupo: 'RH / Equipe', criticidade: 'Baixa',
      titulo: 'Colaboradores com função sem cargo definido',
      norma: 'CLT – Contrato de trabalho deve especificar função',
      desc: 'Todos os colaboradores devem ter cargo/função definida no cadastro para fins de controle de acesso, treinamentos e remuneração.',
      check(d) {
        const problemas = d.equipe.filter(e => e.status === 'Ativo' && !e.cargo && !e.funcao && !e.perfil);
        return { ok: problemas.length === 0, itens: problemas.slice(0,10).map(e => e.nome || e.id) };
      }
    },
    {
      id: 'E003', grupo: 'RH / Equipe', criticidade: 'Média',
      titulo: 'Colaboradores sem contrato de trabalho vigente',
      norma: 'CLT Art. 29 – Carteira de trabalho deve ser registrada no prazo',
      desc: 'Colaboradores ativos sem registro de contrato de trabalho representam risco trabalhista.',
      check(d) {
        const problemas = d.equipe.filter(e =>
          e.status === 'Ativo' && !e.data_admissao && !e.contrato_trabalho
        );
        return { ok: problemas.length === 0, itens: problemas.slice(0,10).map(e => e.nome || e.id) };
      }
    },

    // ══ GRUPO: DADOS / INTEGRIDADE ══════════════════════════════════
    {
      id: 'F001', grupo: 'Integridade de Dados', criticidade: 'Alta',
      titulo: 'Pedidos com valor zerado ou indefinido',
      norma: 'Controle de Dados §1 – Campos obrigatórios em PC',
      desc: 'Pedidos de compra não podem ter valor total zero ou indefinido após emissão. Isso indica dados incompletos ou erro de cadastro.',
      check(d) {
        const problemas = d.pedidos.filter(p =>
          !['Cancelado','Rascunho'].includes(p.status) &&
          (!p.valor_total || p.valor_total === 0)
        );
        return { ok: problemas.length === 0, itens: problemas.map(p => p.numero + ' – Status: ' + p.status) };
      }
    },
    {
      id: 'F002', grupo: 'Integridade de Dados', criticidade: 'Média',
      titulo: 'RCs sem itens ou com itens sem preço',
      norma: 'Procedimento RC §2 – Requisição deve ter itens com valor estimado',
      desc: 'Requisições de Compra devem ter ao menos um item com descrição, quantidade e preço unitário estimado preenchidos.',
      check(d) {
        const problemas = d.rcs.filter(rc => {
          if (!rc.itens || rc.itens.length === 0) return true;
          return rc.itens.some(i => !i.valor_unit && !i.preco_unit);
        }).filter(rc => rc.status !== 'Cancelada');
        return { ok: problemas.length === 0, itens: problemas.slice(0,10).map(rc => (rc.numero||rc.id) + ' – ' + (rc.titulo||rc.descricao||'')) };
      }
    },
    {
      id: 'F003', grupo: 'Integridade de Dados', criticidade: 'Baixa',
      titulo: 'Fornecedores sem CNPJ cadastrado',
      norma: 'Cadastro de Fornecedores §1 – CNPJ obrigatório para homologação',
      desc: 'Todos os fornecedores ativos devem ter CNPJ cadastrado para emissão de notas fiscais e verificação de situação fiscal (Receita Federal).',
      check(d) {
        const problemas = d.fornecedores.filter(f => f.status === 'Ativo' && !f.cnpj);
        return { ok: problemas.length === 0, itens: problemas.slice(0,10).map(f => f.nome_fantasia || f.razao_social || f.id) };
      }
    },
    {
      id: 'F004', grupo: 'Integridade de Dados', criticidade: 'Média',
      titulo: 'OS sem responsável técnico definido',
      norma: 'Procedimento Operacional §1.2 – Toda OS deve ter responsável técnico',
      desc: 'Ordens de Serviço em execução sem responsável técnico designado representam risco operacional e de qualidade.',
      check(d) {
        const problemas = d.os.filter(o =>
          ['Em Execução','Em Andamento'].includes(o.status) &&
          !o.responsavel && !o.responsavel_tecnico && !o.engenheiro
        );
        return { ok: problemas.length === 0, itens: problemas.slice(0,10).map(o => (o.id||'') + ' – ' + (o.descricao||'')) };
      }
    },
    {
      id: 'F005', grupo: 'Integridade de Dados', criticidade: 'Alta',
      titulo: 'Duplicidade de fornecedores por CNPJ',
      norma: 'Cadastro de Fornecedores §1.4 – Unicidade de CNPJ obrigatória',
      desc: 'Dois ou mais fornecedores com o mesmo CNPJ indicam duplicidade no cadastro, o que causa problemas fiscais e de pagamento.',
      check(d) {
        const cnpjCount = {};
        d.fornecedores.filter(f=>f.cnpj).forEach(f => {
          const c = f.cnpj.replace(/\D/g,'');
          if (c) cnpjCount[c] = (cnpjCount[c]||0) + 1;
        });
        const duplicados = Object.entries(cnpjCount).filter(([,v])=>v>1);
        const problemas = duplicados.map(([cnpj]) => {
          const fList = d.fornecedores.filter(f => (f.cnpj||'').replace(/\D/g,'') === cnpj);
          return fList.map(f => f.nome_fantasia || f.razao_social).join(' / ') + ' (CNPJ: ' + cnpj + ')';
        });
        return { ok: problemas.length === 0, itens: problemas };
      }
    },
    {
      id: 'F006', grupo: 'Integridade de Dados', criticidade: 'Baixa',
      titulo: 'RFQs sem critério de seleção definido',
      norma: 'Política de Compras §3.3 – Critério de seleção deve ser informado na abertura',
      desc: 'O critério de seleção de fornecedores (Menor Preço, Melhor Técnica, etc.) deve ser definido na abertura da RFQ.',
      check(d) {
        const problemas = d.rfqs.filter(r =>
          !['Cancelada'].includes(r.status) &&
          !r.criterio && !r.criterio_selecao && !r.selection_criteria
        );
        return { ok: problemas.length === 0, itens: problemas.slice(0,10).map(r => (r.numero_rfq||r.numero||r.id) + ' – ' + (r.titulo||'')) };
      }
    },

    // ══ GRUPO: PROJETOS ═════════════════════════════════════════════
    {
      id: 'G001', grupo: 'Projetos', criticidade: 'Média',
      titulo: 'Projetos com cronograma atrasado',
      norma: 'PMBOK 6ª Ed. §6 – Controle de cronograma é processo chave',
      desc: 'Projetos com data de término prevista no passado e ainda com status ativo indicam atraso de cronograma não tratado.',
      check(d) {
        const hoje = Date.now();
        const problemas = d.projetos.filter(p => {
          if (['Concluído','Cancelado'].includes(p.status)) return false;
          const fim = p.data_fim || p.data_termino || p.end_date;
          if (!fim) return false;
          return new Date(fim).getTime() < hoje;
        });
        return { ok: problemas.length === 0, itens: problemas.slice(0,10).map(p => (p.codigo||p.id) + ' – ' + (p.nome||p.titulo||'') + ' – Previsto: ' + (p.data_fim||p.end_date||'')) };
      }
    },
    {
      id: 'G002', grupo: 'Projetos', criticidade: 'Baixa',
      titulo: 'Projetos sem baseline de custo definido',
      norma: 'Controle de Custo §2.1 – Orçamento base (baseline) obrigatório',
      desc: 'Projetos em execução devem ter orçamento base (baseline) definido para controle de variação de custo (CPI).',
      check(d) {
        const problemas = d.projetos.filter(p =>
          p.status === 'Em Andamento' && !p.orcamento && !p.baseline_custo && !p.valor_contrato
        );
        return { ok: problemas.length === 0, itens: problemas.slice(0,10).map(p => (p.codigo||p.id) + ' – ' + (p.nome||'')) };
      }
    },
  ],

  // ─── EXECUTA TODAS AS REGRAS ─────────────────────────────────────
  analisar(filtroContrato = '', filtroGrupo = '', filtroStatus = '') {
    const dados = this.snapshot();

    // Se filtro por contrato, filtra OS, pedidos, RCs relacionados
    if (filtroContrato) {
      dados.os       = dados.os.filter(o => (o.contrato||'').includes(filtroContrato) || (o.os_contrato||'').includes(filtroContrato));
      dados.pedidos  = dados.pedidos.filter(p => (p.contrato_id||'').includes(filtroContrato) || (p.contrato||'').includes(filtroContrato));
    }

    let regras = this.regras;
    if (filtroGrupo) regras = regras.filter(r => r.grupo === filtroGrupo);

    const resultados = regras.map(r => {
      let resultado;
      try { resultado = r.check(dados); } catch(e) { resultado = { ok: true, itens: [], erro: e.message }; }
      const status = resultado.ok ? 'OK' : (r.criticidade === 'Alta' ? 'Crítico' : r.criticidade === 'Média' ? 'Atenção' : 'Info');
      return { ...r, status, itens: resultado.itens || [], erro: resultado.erro };
    }).filter(r => {
      if (!filtroStatus) return true;
      if (filtroStatus === 'problemas') return r.status !== 'OK';
      return r.status === filtroStatus;
    });

    const total    = resultados.length;
    const criticos = resultados.filter(r => r.status === 'Crítico').length;
    const atencoes = resultados.filter(r => r.status === 'Atenção').length;
    const infos    = resultados.filter(r => r.status === 'Info').length;
    const oks      = resultados.filter(r => r.status === 'OK').length;
    // Score baseado em todas as regras, não apenas filtradas
    const allRes   = this.regras.map(r => {
      try { const res = r.check(dados); return res.ok ? 'OK' : 'NOK'; } catch(e) { return 'OK'; }
    });
    const score    = Math.round((allRes.filter(s=>s==='OK').length / allRes.length) * 100);

    return { resultados, total, criticos, atencoes, infos, oks, score, gerado_em: new Date().toLocaleString('pt-BR') };
  },

  // ─── SUGESTÕES POR GRUPO ─────────────────────────────────────────
  sugestoes: {
    'Compras': [
      'Implemente checklist digital de abertura de processo com validação de campos obrigatórios.',
      'Configure alertas automáticos para RFQs abertas há mais de 15 dias sem movimentação.',
      'Crie política formal de compras de emergência com formulário de justificativa e aprovação de Diretor.',
      'Estabeleça critérios mínimos de 3 fornecedores por processo de cotação para valores > R$ 10.000.',
    ],
    'Contratos': [
      'Configure alertas de vencimento com 90, 60 e 30 dias de antecedência.',
      'Crie plano de gestão contratual com reuniões mensais entre gestor e fiscal do cliente.',
      'Documente formalmente a designação de gestor para cada contrato com portaria interna.',
      'Utilize a funcionalidade de WBS para vincular todas as OS a itens contratuais mensuráveis.',
    ],
    'Financeiro': [
      'Implemente fluxo de caixa semanal comparando realizado vs. planejado por contrato.',
      'Configure aprovação hierárquica para contas a pagar acima de R$ 50.000.',
      'Estabeleça prazo mínimo de 15 dias úteis para pagamentos após recebimento de NF.',
      'Revise mensalmente contas a pagar vencidas e documente justificativas de atraso.',
    ],
    'SSMA': [
      'Implemente inspeções de segurança semanais com checklist digital e envio automático ao gestor.',
      'Crie matriz de treinamentos obrigatórios por função e configure alertas de vencimento.',
      'Estabeleça revisão anual de documentos controlados com responsável designado.',
      'Realize análise de causa-raiz para todos os incidentes, mesmo sem afastamento.',
    ],
    'RH / Equipe': [
      'Configure alertas de vencimento de ASO com 30 dias de antecedência para RH.',
      'Implemente onboarding digital com checklist de documentos admissionais obrigatórios.',
      'Mantenha matriz de competências atualizada mensalmente para planejamento de mobilização.',
    ],
    'Integridade de Dados': [
      'Configure validações obrigatórias nos formulários para campos críticos (valor, CNPJ, datas).',
      'Realize auditoria mensal de dados cadastrais de fornecedores.',
      'Implemente processo de aprovação em dois níveis para alterações cadastrais de fornecedores.',
      'Execute rotina automática de detecção de duplicidades semanalmente.',
    ],
    'Projetos': [
      'Realize reuniões semanais de acompanhamento de cronograma com equipe de projeto.',
      'Configure alertas de desvio de cronograma quando atraso superar 5% da duração total.',
      'Implemente análise de valor agregado (EVM) para projetos com orçamento > R$ 500.000.',
    ],
  }
};

// ─── UTILIDADE ────────────────────────────────────────────────────────
function fmt(v) {
  return (v||0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

// ─── RENDER PRINCIPAL ─────────────────────────────────────────────────
function renderAuditoriaAI() {
  const main = document.getElementById('mainContent');

  const grupos = [...new Set(_AUD.regras.map(r => r.grupo))];

  main.innerHTML = `
    <style>
      /* ── Auditoria AI – estilos responsivos ── */
      .aud-page-header {
        display: flex; align-items: flex-start; justify-content: space-between;
        flex-wrap: wrap; gap: 12px; margin-bottom: 20px;
      }
      .aud-title h2 { margin: 0; font-size: clamp(16px, 3vw, 22px); }
      .aud-title p  { margin: 4px 0 0; font-size: 12px; color: var(--text-secondary); }
      .aud-actions  {
        display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      }
      .aud-filter-row {
        display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;
        background: var(--bg-secondary); border-radius: 10px; padding: 12px 16px;
        border: 1px solid var(--border-color);
      }
      .aud-filter-row select,
      .aud-filter-row input {
        flex: 1 1 140px; min-width: 120px; max-width: 220px;
        font-size: 12px; padding: 6px 10px;
        border: 1px solid var(--border-color); border-radius: 6px;
        background: var(--bg-primary); color: var(--text-primary);
      }
      .aud-kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 10px; margin-bottom: 16px;
      }
      .aud-kpi {
        background: var(--bg-secondary); border: 1px solid var(--border-color);
        border-radius: 10px; padding: 12px; text-align: center;
      }
      .aud-kpi-num { font-size: 28px; font-weight: 800; line-height: 1; }
      .aud-kpi-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; margin-top: 4px; }
      .aud-group-card {
        margin-bottom: 12px; border-radius: 10px; overflow: hidden;
        border: 1px solid var(--border-color);
      }
      .aud-group-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 16px; cursor: pointer; user-select: none;
        background: var(--bg-secondary); flex-wrap: wrap; gap: 8px;
      }
      .aud-group-header h3 { margin: 0; font-size: 14px; display: flex; align-items: center; gap: 8px; }
      .aud-group-badges { display: flex; gap: 6px; flex-wrap: wrap; }
      .aud-badge {
        font-size: 10px; font-weight: 700; border-radius: 10px; padding: 2px 8px;
      }
      .aud-rule {
        border-bottom: 1px solid var(--border-color);
        padding: 10px 14px; display: flex; gap: 10px; align-items: flex-start;
      }
      .aud-rule:last-child { border-bottom: none; }
      .aud-rule-icon { font-size: 15px; margin-top: 1px; flex-shrink: 0; }
      .aud-rule-body { flex: 1; min-width: 0; }
      .aud-rule-title {
        font-weight: 700; font-size: 13px; color: var(--text-primary);
        display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 2px;
      }
      .aud-rule-desc { font-size: 11px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 3px; }
      .aud-rule-norma { font-size: 10px; color: var(--text-muted); }
      .aud-ocorrencias {
        margin-top: 8px; background: var(--bg-secondary); border-radius: 6px;
        padding: 8px 10px;
      }
      .aud-ocorrencias-title {
        font-size: 10px; font-weight: 700; color: var(--text-muted);
        text-transform: uppercase; margin-bottom: 4px; letter-spacing: .4px;
      }
      .aud-ocorrencias ul { margin: 0; padding: 0 0 0 14px; }
      .aud-ocorrencias li { font-size: 11px; color: var(--text-secondary); padding: 1px 0; }
      .aud-score-wrap {
        display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
        padding: 16px 20px; margin-bottom: 16px;
        background: linear-gradient(135deg, rgba(0,180,184,.06), rgba(99,102,241,.06));
        border: 1px solid rgba(0,180,184,.2); border-radius: 12px;
      }
      .aud-score-svg { flex-shrink: 0; }
      .aud-score-info { flex: 1; min-width: 150px; }
      .aud-score-title { font-size: clamp(14px,3vw,20px); font-weight: 800; }
      .aud-score-sub   { font-size: 12px; color: var(--text-secondary); line-height: 1.6; margin-top: 4px; }
      .aud-score-progress {
        height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden; margin-top: 10px;
      }
      .aud-score-bar { height: 100%; border-radius: 4px; transition: width 1s ease; }
      .aud-spinner {
        width: 40px; height: 40px; border: 4px solid var(--border-color);
        border-top-color: var(--fa-teal); border-radius: 50%;
        animation: aud-spin .8s linear infinite; margin: 0 auto;
      }
      @keyframes aud-spin { to { transform: rotate(360deg); } }
      @media (max-width: 600px) {
        .aud-actions { width: 100%; }
        .aud-actions .btn { flex: 1; justify-content: center; }
        .aud-score-svg { display: none; }
        .aud-kpi-num { font-size: 22px; }
      }
    </style>

    <div class="aud-page-header">
      <div class="aud-title">
        <h2><i class="fas fa-robot" style="color:var(--fa-teal);margin-right:8px"></i>
          Auditoria Inteligente
          <span style="font-size:10px;background:rgba(0,180,184,.15);color:var(--fa-teal);padding:2px 8px;border-radius:8px;font-weight:600;margin-left:6px">AI</span>
        </h2>
        <p>Análise automatizada de conformidade · ISO 9001 · ISO 45001 · Procedimentos Internos</p>
      </div>
      <div class="aud-actions">
        <button class="btn btn-primary btn-sm" onclick="executarAuditoria()">
          <i class="fas fa-play"></i> Executar Análise
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-pdf-auditoria" onclick="gerarPdfAuditoria()" style="display:none">
          <i class="fas fa-file-pdf"></i> PDF
        </button>
      </div>
    </div>

    <!-- Filtros avançados -->
    <div class="aud-filter-row">
      <label style="align-self:center;font-size:11px;color:var(--text-muted);white-space:nowrap"><i class="fas fa-filter" style="margin-right:4px"></i>Filtros:</label>
      <select id="aud-filtro-contrato">
        <option value="">Todos os Contratos</option>
        ${(() => { try { return JSON.parse(localStorage.getItem('fa_contratos')||'[]').map(c=>`<option value="${c.id}">${c.id} – ${c.cliente||''}</option>`).join(''); } catch(e){return '';} })()}
      </select>
      <select id="aud-filtro-grupo">
        <option value="">Todos os Grupos</option>
        ${grupos.map(g=>`<option value="${g}">${g}</option>`).join('')}
      </select>
      <select id="aud-filtro-status">
        <option value="">Todos os Status</option>
        <option value="problemas">Apenas Problemas</option>
        <option value="Crítico">Crítico</option>
        <option value="Atenção">Atenção</option>
        <option value="Info">Info</option>
        <option value="OK">OK</option>
      </select>
    </div>

    <!-- Placeholder -->
    <div id="aud-resultado">
      <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <div style="width:72px;height:72px;border-radius:50%;background:rgba(0,180,184,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <i class="fas fa-robot" style="font-size:32px;color:var(--fa-teal)"></i>
        </div>
        <div style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:8px">Auditoria AI Pronta</div>
        <div style="font-size:13px;max-width:400px;margin:0 auto;line-height:1.7">
          Clique em <strong style="color:var(--fa-teal)">Executar Análise</strong> para verificar automaticamente
          <strong>${_AUD.regras.length} regras</strong> de conformidade em todos os módulos.
        </div>
        <div style="margin-top:20px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;font-size:11px">
          ${['ISO 9001','ISO 45001','SSMA / NRs','Compras','Contratos','Financeiro','Projetos','Dados'].map(n=>`
            <span style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:16px;padding:3px 10px">
              <i class="fas fa-check-circle" style="color:#22c55e;margin-right:3px"></i>${n}
            </span>`).join('')}
        </div>
      </div>
    </div>
  `;

  // Auto-executa
  setTimeout(executarAuditoria, 150);
}

// ─── EXECUTA AUDITORIA ────────────────────────────────────────────────
function executarAuditoria() {
  const main = document.getElementById('aud-resultado');
  if (!main) return;

  main.innerHTML = `
    <div style="text-align:center;padding:60px 20px">
      <div class="aud-spinner"></div>
      <div style="margin-top:14px;color:var(--text-secondary);font-size:14px">Analisando processos…</div>
      <div style="color:var(--text-muted);font-size:11px;margin-top:4px">Verificando ${_AUD.regras.length} regras de conformidade</div>
    </div>
  `;

  const filtroContrato = document.getElementById('aud-filtro-contrato')?.value || '';
  const filtroGrupo    = document.getElementById('aud-filtro-grupo')?.value || '';
  const filtroStatus   = document.getElementById('aud-filtro-status')?.value || '';

  setTimeout(() => {
    const analise = _AUD.analisar(filtroContrato, filtroGrupo, filtroStatus);
    window._lastAuditoria = analise;
    _renderAuditoriaResultado(analise);
    const btnPdf = document.getElementById('btn-pdf-auditoria');
    if (btnPdf) btnPdf.style.display = '';
  }, 500);
}

// ─── RENDER RESULTADO ─────────────────────────────────────────────────
function _renderAuditoriaResultado(analise) {
  const { resultados, total, criticos, atencoes, infos, oks, score, gerado_em } = analise;

  const scoreColor = score >= 85 ? '#22c55e' : score >= 65 ? '#f59e0b' : '#ef4444';
  const scoreLabel = score >= 85 ? 'Conformidade Alta' : score >= 65 ? 'Atenção Necessária' : 'Alto Risco';
  const scoreIcon  = score >= 85 ? 'shield-alt'        : score >= 65 ? 'exclamation-triangle' : 'times-circle';

  const r38 = 38;
  const circunf = 2 * Math.PI * r38;
  const offset  = circunf * (1 - score / 100);

  // Agrupa por grupo
  const grupos = {};
  resultados.forEach(r => { if (!grupos[r.grupo]) grupos[r.grupo] = []; grupos[r.grupo].push(r); });

  const grupoIcons = {
    'Compras':'shopping-cart', 'Contratos':'file-contract', 'Financeiro':'chart-line',
    'SSMA':'hard-hat', 'RH / Equipe':'users', 'Integridade de Dados':'database', 'Projetos':'project-diagram'
  };

  const cont = document.getElementById('aud-resultado');
  cont.innerHTML = `
    <div id="aud-report">

      <!-- Score Header -->
      <div class="aud-score-wrap">
        <div class="aud-score-svg">
          <svg width="80" height="80" viewBox="0 0 90 90">
            <circle cx="45" cy="45" r="${r38}" fill="none" stroke="var(--border-color)" stroke-width="8"/>
            <circle cx="45" cy="45" r="${r38}" fill="none" stroke="${scoreColor}" stroke-width="8"
              stroke-dasharray="${circunf}" stroke-dashoffset="${offset}"
              stroke-linecap="round" transform="rotate(-90 45 45)" style="transition:stroke-dashoffset 1s ease"/>
          </svg>
          <div style="position:relative;margin-top:-58px;text-align:center;pointer-events:none">
            <div style="font-size:20px;font-weight:900;color:${scoreColor};line-height:1">${score}</div>
            <div style="font-size:9px;color:var(--text-muted);font-weight:700">/100</div>
          </div>
        </div>

        <div class="aud-score-info">
          <div class="aud-score-title" style="color:${scoreColor}">
            <i class="fas fa-${scoreIcon}" style="margin-right:8px"></i>${scoreLabel}
          </div>
          <div class="aud-score-sub">
            ${criticos > 0 ? `<strong style="color:#ef4444">${criticos} não conformidade(s) crítica(s)</strong> · ` : ''}
            ${atencoes > 0 ? `<strong style="color:#f59e0b">${atencoes} ponto(s) de atenção</strong> · ` : ''}
            ${oks === total ? '<strong style="color:#22c55e">Todos os controles OK!</strong>' : `${oks}/${total} controles em conformidade`}
          </div>
          <div class="aud-score-progress">
            <div class="aud-score-bar" style="width:${score}%;background:linear-gradient(90deg,${scoreColor},${scoreColor}cc)"></div>
          </div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:6px">
            <i class="fas fa-clock" style="margin-right:4px"></i>${gerado_em} · ${_AUD.regras.length} regras · Fraser Alexander ERP v3
          </div>
        </div>

        <!-- Mini KPIs -->
        <div class="aud-kpi-grid" style="margin:0">
          ${[
            { v: criticos, l: 'Críticos', c: '#ef4444', bg: 'rgba(239,68,68,.1)', i: 'times-circle' },
            { v: atencoes, l: 'Atenção',  c: '#f59e0b', bg: 'rgba(245,158,11,.1)', i: 'exclamation-triangle' },
            { v: infos,    l: 'Info',     c: '#6366f1', bg: 'rgba(99,102,241,.1)', i: 'info-circle' },
            { v: oks,      l: 'OK',       c: '#22c55e', bg: 'rgba(34,197,94,.1)',  i: 'check-circle' },
          ].map(k => `
            <div class="aud-kpi" style="background:${k.bg};border-color:${k.c}40;min-width:60px">
              <div class="aud-kpi-num" style="color:${k.c}">${k.v}</div>
              <div class="aud-kpi-lbl" style="color:${k.c}">${k.l}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Grupos -->
      ${Object.entries(grupos).map(([grupo, regras]) => {
        const gIcon  = grupoIcons[grupo] || 'folder';
        const gCrit  = regras.filter(r=>r.status==='Crítico').length;
        const gAt    = regras.filter(r=>r.status==='Atenção').length;
        const gOk    = regras.filter(r=>r.status==='OK').length;
        const gBord  = gCrit > 0 ? '#ef4444' : gAt > 0 ? '#f59e0b' : '#22c55e';
        const sugs   = _AUD.sugestoes[grupo] || [];
        const temProb= regras.some(r => r.status !== 'OK');

        return `
        <div class="aud-group-card" style="border-left:4px solid ${gBord}">
          <div class="aud-group-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
            <h3><i class="fas fa-${gIcon}" style="color:${gBord}"></i>${grupo}
              <span style="font-size:10px;color:var(--text-muted);font-weight:400">(${regras.length})</span>
            </h3>
            <div class="aud-group-badges">
              ${gCrit>0?`<span class="aud-badge" style="background:rgba(239,68,68,.12);color:#ef4444">${gCrit} crítico(s)</span>`:''}
              ${gAt>0?`<span class="aud-badge" style="background:rgba(245,158,11,.12);color:#f59e0b">${gAt} atenção</span>`:''}
              ${gOk>0?`<span class="aud-badge" style="background:rgba(34,197,94,.1);color:#22c55e">${gOk} OK</span>`:''}
              <i class="fas fa-chevron-down" style="color:var(--text-muted);font-size:11px"></i>
            </div>
          </div>
          <div>
            ${regras.map(r => {
              const isOk = r.status === 'OK';
              const cor  = { 'OK':'#22c55e', 'Crítico':'#ef4444', 'Atenção':'#f59e0b', 'Info':'#6366f1' }[r.status] || '#8b949e';
              const bg   = { 'OK':'rgba(34,197,94,.03)', 'Crítico':'rgba(239,68,68,.04)', 'Atenção':'rgba(245,158,11,.04)', 'Info':'rgba(99,102,241,.04)' }[r.status] || 'transparent';
              const ico  = { 'OK':'check-circle', 'Crítico':'times-circle', 'Atenção':'exclamation-triangle', 'Info':'info-circle' }[r.status] || 'circle';
              return `
              <div class="aud-rule" style="background:${bg}">
                <i class="fas fa-${ico} aud-rule-icon" style="color:${cor}"></i>
                <div class="aud-rule-body">
                  <div class="aud-rule-title">
                    ${r.titulo}
                    <span style="font-size:9px;color:${cor};background:${bg};border:1px solid ${cor}40;border-radius:6px;padding:1px 6px;font-weight:700">${r.status}</span>
                    <span style="font-size:9px;color:var(--text-muted);font-family:monospace">${r.id}</span>
                  </div>
                  <div class="aud-rule-desc">${r.desc}</div>
                  <div class="aud-rule-norma"><i class="fas fa-bookmark" style="margin-right:3px;color:#6366f1"></i>${r.norma}</div>
                  ${!isOk && r.itens.length > 0 ? `
                  <div class="aud-ocorrencias">
                    <div class="aud-ocorrencias-title"><i class="fas fa-list" style="margin-right:4px"></i>Ocorrências (${r.itens.length})</div>
                    <ul>
                      ${r.itens.slice(0,5).map(i => `<li>${i}</li>`).join('')}
                      ${r.itens.length > 5 ? `<li style="color:var(--text-muted)">… e mais ${r.itens.length-5} ocorrência(s)</li>` : ''}
                    </ul>
                  </div>` : ''}
                </div>
              </div>`;
            }).join('')}

            <!-- Sugestões -->
            ${sugs.length > 0 && temProb ? `
            <div style="padding:12px 16px;background:rgba(99,102,241,.04);border-top:1px solid rgba(99,102,241,.15)">
              <div style="font-size:11px;font-weight:700;color:#6366f1;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px">
                <i class="fas fa-lightbulb" style="margin-right:6px"></i>Recomendações de Melhoria
              </div>
              <ul style="margin:0;padding:0;list-style:none">
                ${sugs.map(s=>`
                  <li style="font-size:11px;color:var(--text-secondary);padding:3px 0;display:flex;gap:6px">
                    <i class="fas fa-arrow-right" style="color:#6366f1;font-size:10px;margin-top:3px;flex-shrink:0"></i>
                    ${s}
                  </li>`).join('')}
              </ul>
            </div>` : ''}
          </div>
        </div>`;
      }).join('')}

      <div style="text-align:center;padding:16px;font-size:10px;color:var(--text-muted);border-top:1px solid var(--border-color);margin-top:12px">
        <i class="fas fa-robot" style="margin-right:6px;color:var(--fa-teal)"></i>
        Análise gerada em ${gerado_em} · ${_AUD.regras.length} regras verificadas · Fraser Alexander ERP v3
        <br><span>Esta análise é baseada nos dados registrados no sistema. Consulte um auditor certificado para avaliação formal.</span>
      </div>
    </div>
  `;
}

// ─── GERAR PDF DA AUDITORIA ───────────────────────────────────────────
function gerarPdfAuditoria() {
  const analise = window._lastAuditoria;
  if (!analise) { if(typeof showToast==='function') showToast('Execute a análise primeiro.', 'warning'); return; }

  const { resultados, total, criticos, atencoes, oks, score, gerado_em } = analise;
  const scoreColor = score >= 85 ? '#16a34a' : score >= 65 ? '#b45309' : '#dc2626';
  const scoreLabel = score >= 85 ? 'Conformidade Alta' : score >= 65 ? 'Atenção Necessária' : 'Alto Risco';

  const grupos = {};
  resultados.forEach(r => { if (!grupos[r.grupo]) grupos[r.grupo] = []; grupos[r.grupo].push(r); });

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Auditoria AI – Fraser Alexander</title>
  <style>
    * { margin:0;padding:0;box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1a1a2e;background:#fff }
    .hdr { background:linear-gradient(135deg,#0d1117,#1c2333);color:#fff;padding:24px 36px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px }
    .hdr-logo { font-size:20px;font-weight:900;color:#00b4b8 }
    .hdr-sub { font-size:10px;color:#8b949e;margin-top:2px }
    .hdr-right { text-align:right;font-size:10px;color:#8b949e }
    .score-bar { background:#161b22;padding:16px 36px;display:flex;align-items:center;gap:20px;flex-wrap:wrap }
    .score-num { font-size:48px;font-weight:900;color:${scoreColor};line-height:1 }
    .score-label { font-size:15px;font-weight:700;color:${scoreColor};margin-bottom:3px }
    .kpis { display:flex;gap:10px;margin-left:auto;flex-wrap:wrap }
    .kpi-box { background:#21262d;border-radius:8px;padding:8px 14px;text-align:center;min-width:65px }
    .kpi-num { font-size:18px;font-weight:800 }
    .kpi-lbl { font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.4px }
    .content { padding:20px 36px }
    .grupo { margin-bottom:18px }
    .grupo-title { font-size:13px;font-weight:800;color:#0d1117;border-bottom:2px solid #e5e7eb;padding-bottom:5px;margin-bottom:8px }
    .regra { border:1px solid #e5e7eb;border-radius:6px;margin-bottom:7px;overflow:hidden }
    .regra-header { padding:7px 11px;display:flex;align-items:flex-start;gap:8px }
    .regra-status { font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;white-space:nowrap;flex-shrink:0;margin-top:2px }
    .status-OK { background:#dcfce7;color:#16a34a }
    .status-Crítico { background:#fee2e2;color:#dc2626 }
    .status-Atenção { background:#fef3c7;color:#b45309 }
    .status-Info { background:#ede9fe;color:#6d28d9 }
    .regra-titulo { font-size:12px;font-weight:700;color:#1a1a2e;margin-bottom:2px }
    .regra-desc { font-size:10px;color:#6b7280;line-height:1.5 }
    .regra-norma { font-size:9px;color:#9ca3af;margin-top:2px }
    .ocorrencias { background:#f9fafb;border-top:1px solid #e5e7eb;padding:7px 11px }
    .ocorrencias ul { padding-left:14px;margin:0 }
    .ocorrencias li { font-size:10px;color:#374151;padding:1px 0 }
    .ftr { background:#f9fafb;border-top:2px solid #e5e7eb;padding:14px 36px;text-align:center;font-size:10px;color:#6b7280 }
    .btn-print { position:fixed;bottom:16px;right:16px;background:#00b4b8;color:#fff;border:none;border-radius:8px;padding:9px 18px;cursor:pointer;font-size:12px;font-weight:700;z-index:999 }
    @media print { .btn-print { display:none } .hdr,.score-bar { -webkit-print-color-adjust:exact;print-color-adjust:exact } }
  </style>
</head>
<body>
  <button class="btn-print" onclick="window.print()">🖨 Imprimir</button>
  <div class="hdr">
    <div>
      <div class="hdr-logo">FRASER ALEXANDER</div>
      <div class="hdr-sub">Sistema de Gestão Integrado – ERP v3</div>
    </div>
    <div class="hdr-right">
      <strong style="font-size:14px;color:#fff">Relatório de Auditoria Inteligente</strong><br>
      Gerado em ${gerado_em} · ${total} regras verificadas
    </div>
  </div>
  <div class="score-bar">
    <div>
      <div class="score-num">${score}</div>
      <div style="font-size:11px;color:#8b949e">/100 pontos</div>
    </div>
    <div>
      <div class="score-label">${scoreLabel}</div>
      <div style="font-size:10px;color:#8b949e">${criticos} crítico(s) · ${atencoes} atenção · ${oks}/${total} OK</div>
    </div>
    <div class="kpis">
      ${[
        {v:criticos,l:'Críticos',c:'#ef4444'},
        {v:atencoes,l:'Atenção',c:'#f59e0b'},
        {v:oks,l:'OK',c:'#22c55e'},
      ].map(k=>`<div class="kpi-box"><div class="kpi-num" style="color:${k.c}">${k.v}</div><div class="kpi-lbl" style="color:${k.c}">${k.l}</div></div>`).join('')}
    </div>
  </div>
  <div class="content">
    ${Object.entries(grupos).map(([grupo, regras]) => `
    <div class="grupo">
      <div class="grupo-title">${grupo}</div>
      ${regras.map(r => `
      <div class="regra">
        <div class="regra-header">
          <span class="regra-status status-${r.status.replace(' ','')}">${r.status}</span>
          <div>
            <div class="regra-titulo">${r.titulo} <span style="font-size:9px;color:#9ca3af;font-family:monospace">${r.id}</span></div>
            <div class="regra-desc">${r.desc}</div>
            <div class="regra-norma">📌 ${r.norma}</div>
          </div>
        </div>
        ${r.itens.length > 0 ? `
        <div class="ocorrencias">
          <div style="font-size:9px;font-weight:700;color:#6b7280;margin-bottom:3px;text-transform:uppercase">Ocorrências (${r.itens.length})</div>
          <ul>${r.itens.slice(0,8).map(i=>`<li>${i}</li>`).join('')}${r.itens.length>8?`<li>… e mais ${r.itens.length-8}</li>`:''}</ul>
        </div>` : ''}
      </div>`).join('')}
    </div>`).join('')}
  </div>
  <div class="ftr">
    Análise gerada automaticamente em ${gerado_em} · Fraser Alexander ERP v3<br>
    <em>Esta análise é baseada nos dados registrados no sistema. Consulte um auditor certificado para avaliação formal de conformidade.</em>
  </div>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) { if(typeof showToast==='function') showToast('Permita pop-ups para gerar o PDF.', 'warning'); return; }
  w.document.write(html);
  w.document.close();
}
