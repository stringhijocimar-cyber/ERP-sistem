// =====================================================
// Fraser Alexander ERP – Seed de Dados Demo
// Processo completo: CRM → Contrato → WBS/Custos → OS → RC → RFQ → Pedido → Pagamento
// =====================================================
function _runSeedDemoData() {
  'use strict';

  // Só roda se não tiver sido executado antes
  if (localStorage.getItem('_fa_demo_seed_v15') === '1') return;
  // Remove versões anteriores para forçar reload
  localStorage.removeItem('_fa_demo_seed_v5');
  localStorage.removeItem('_fa_demo_seed_v6');
  localStorage.removeItem('_fa_demo_seed_v7');
  localStorage.removeItem('_fa_demo_seed_v8');
  localStorage.removeItem('_fa_demo_seed_v9');
  localStorage.removeItem('_fa_demo_seed_v10');
  localStorage.removeItem('_fa_demo_seed_v11');
  localStorage.removeItem('_fa_demo_seed_v12');
  localStorage.removeItem('_fa_demo_seed_v13');

  console.log('[SEED] Carregando dados demo Fraser Alexander...');

  // ─── HELPERS ─────────────────────────────────────
  const iso = (d) => new Date(d).toISOString();
  const hoje = '2025-03-28';
  const fmt  = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // ─── 1. ERP_DATA (contratos, colaboradores, incidentes, equipamentos, medicoes, faturas, ordens) ───
  // Garante que ERP_DATA exista (já deve ter dados do data.js)
  if (!window.ERP_DATA) window.ERP_DATA = { profiles:{}, contratos:[], ordens:[], medicoes:[], faturas:[], colaboradores:[], incidentes:[], equipamentos:[] };

  window.ERP_DATA.contratos = [
    {
      id: 'CONT-001',
      cliente: 'Mineração Vale Verde Ltda',
      objeto: 'Operação e Manutenção de Equipamentos de Mineração',
      descricao: 'Operação e Manutenção de Equipamentos de Mineração – Mina do Cerrado',
      valor: 4800000,
      medidoAcum: 1920000,
      custoAcum: 1536000,
      status: 'Ativo',
      inicio: '2024-01-15',
      fim: '2026-01-14',
      equipe: 28,
      equipamentos: 7,
      gestor: 'Ricardo Almeida',
      contato_cliente: 'Eng. Paulo Henrique',
      tipo: 'Operação',
      unidade: 'Mina do Cerrado – MG',
      moeda: 'BRL',
      margem: 20,
      progress: 40,
      ssmaStatus: 'Conforme',
      observacoes: 'Contrato principal – Mina do Cerrado'
    },
    {
      id: 'CONT-002', cliente: 'Cobre & Ouro Mineração S/A',
      objeto: 'Terraplanagem e Estradas de Mina', descricao: 'Terraplanagem e Estradas de Mina – Fase 3',
      valor: 2350000, medidoAcum: 940000, custoAcum: 780000, status: 'Ativo',
      inicio: '2024-03-01', fim: '2025-08-31', equipe: 14, equipamentos: 3,
      gestor: 'Fernanda Costa', contato_cliente: 'Diretora Maria Clara',
      tipo: 'Construção', unidade: 'Mina Cobre & Ouro – PA', moeda: 'BRL',
      margem: 17, progress: 40, ssmaStatus: 'Alerta', observacoes: 'Ampliação da Fase 3'
    },
    {
      id: 'CONT-003', cliente: 'Bauxita do Norte Ind. e Com.',
      objeto: 'Serviços de Britagem Primária e Secundária', descricao: 'Britagem Primária e Secundária – Operação Contínua',
      valor: 1800000, medidoAcum: 1440000, custoAcum: 1180000, status: 'Ativo',
      inicio: '2023-08-01', fim: '2025-07-31', equipe: 10, equipamentos: 2,
      gestor: 'Carlos Mendes', contato_cliente: 'Diretor Técnico João Silva',
      tipo: 'Processamento', unidade: 'Planta Bauxita Norte – PA', moeda: 'BRL',
      margem: 18, progress: 80, ssmaStatus: 'Conforme', observacoes: 'Renovação automática prevista'
    },
    {
      id: 'CONT-004', cliente: 'Ferro Bruto Extração Ltda',
      objeto: 'Desmonte a Fogo e Carregamento', descricao: 'Perfuração, Desmonte e Carregamento de Minério',
      valor: 3200000, medidoAcum: 320000, custoAcum: 280000, status: 'Mobilização',
      inicio: '2025-02-01', fim: '2027-01-31', equipe: 20, equipamentos: 2,
      gestor: 'Ana Paula Rocha', contato_cliente: 'Gerente de Operações Sérgio',
      tipo: 'Perfuração e Fogo', unidade: 'Ferro Bruto – GO', moeda: 'BRL',
      margem: 21, progress: 10, ssmaStatus: 'Pendente', observacoes: 'Mobilização em andamento – 30% concluída'
    },
    {
      id: 'CONT-005', cliente: 'Granito Serrano Cia.',
      objeto: 'Gestão de Pátio e Expedição', descricao: 'Gestão de Pátio, Expedição e Logística Interna',
      valor: 980000, medidoAcum: 980000, custoAcum: 800000, status: 'Encerrado',
      inicio: '2023-01-01', fim: '2024-12-31', equipe: 6, equipamentos: 1,
      gestor: 'Marcos Vieira', contato_cliente: 'Sr. Antônio Pereira',
      tipo: 'Logística', unidade: 'Pedreira Serrana – ES', moeda: 'BRL',
      margem: 18, progress: 100, ssmaStatus: 'Conforme', observacoes: 'Encerrado com sucesso'
    }
  ];

  window.ERP_DATA.colaboradores = [
    { id: 'COL-001', nome: 'Ricardo Almeida',    cargo: 'Gerente de Operações',   contrato: 'CONT-001', status: 'Ativo',      docs: 'OK',      admissao: '2022-01-10', salario: 12500, cpf: '111.222.333-44' },
    { id: 'COL-002', nome: 'Fernanda Costa',     cargo: 'Engenheira de Minas',    contrato: 'CONT-002', status: 'Ativo',      docs: 'OK',      admissao: '2023-03-15', salario: 11000, cpf: '222.333.444-55' },
    { id: 'COL-003', nome: 'Carlos Mendes',      cargo: 'Supervisor de Campo',    contrato: 'CONT-003', status: 'Ativo',      docs: 'Atenção', admissao: '2022-08-01', salario: 8500,  cpf: '333.444.555-66' },
    { id: 'COL-004', nome: 'Jair Oliveira',      cargo: 'Operador de Escavadeira',contrato: 'CONT-001', status: 'Ativo',      docs: 'OK',      admissao: '2023-01-05', salario: 5200,  cpf: '444.555.666-77' },
    { id: 'COL-005', nome: 'Patrícia Souza',     cargo: 'Técnica de SSMA',        contrato: 'CONT-001', status: 'Ativo',      docs: 'OK',      admissao: '2023-05-20', salario: 6800,  cpf: '555.666.777-88' },
    { id: 'COL-006', nome: 'Antônio Ferreira',   cargo: 'Motorista de Caminhão',  contrato: 'CONT-001', status: 'Ativo',      docs: 'OK',      admissao: '2022-11-15', salario: 4800,  cpf: '666.777.888-99' },
    { id: 'COL-007', nome: 'Marcos Vieira',      cargo: 'Mecânico de Manutenção', contrato: 'CONT-002', status: 'Ativo',      docs: 'Crítico', admissao: '2024-03-01', salario: 5500,  cpf: '777.888.999-00' },
    { id: 'COL-008', nome: 'Luciana Barros',     cargo: 'Analista de Custos',     contrato: 'CONT-001', status: 'Ativo',      docs: 'OK',      admissao: '2023-07-10', salario: 7200,  cpf: '888.999.000-11' },
    { id: 'COL-009', nome: 'Pedro Castilho',     cargo: 'Operador de Perfuratriz',contrato: 'CONT-004', status: 'Mobilizando',docs: 'OK',      admissao: '2025-02-01', salario: 5800,  cpf: '999.000.111-22' },
    { id: 'COL-010', nome: 'Ana Paula Rocha',    cargo: 'Gerente de Contratos',   contrato: 'CONT-004', status: 'Mobilizando',docs: 'OK',      admissao: '2024-12-15', salario: 13000, cpf: '000.111.222-33' },
    { id: 'COL-011', nome: 'José Rodrigues',     cargo: 'Operador de Motoniveladora', contrato: 'CONT-002', status: 'Ativo', docs: 'OK',      admissao: '2024-03-10', salario: 5100,  cpf: '111.333.555-77' },
    { id: 'COL-012', nome: 'Simone Lacerda',     cargo: 'Auxiliar Administrativo',contrato: 'CONT-001', status: 'Ativo',      docs: 'Atenção', admissao: '2023-09-01', salario: 3200,  cpf: '222.444.666-88' },
    { id: 'COL-013', nome: 'Roberto Lima',       cargo: 'Eletricista Industrial', contrato: 'CONT-003', status: 'Ativo',      docs: 'OK',      admissao: '2023-08-15', salario: 5900,  cpf: '333.555.777-99' },
    { id: 'COL-014', nome: 'Cláudia Martins',    cargo: 'Enfermeira do Trabalho', contrato: 'CONT-001', status: 'Ativo',      docs: 'OK',      admissao: '2022-06-01', salario: 6200,  cpf: '444.666.888-00' },
    { id: 'COL-015', nome: 'Diego Fonseca',      cargo: 'Operador de Britagem',   contrato: 'CONT-003', status: 'Ativo',      docs: 'OK',      admissao: '2023-08-01', salario: 4700,  cpf: '555.777.999-11' }
  ];

  window.ERP_DATA.incidentes = [
    { id: 'INC-001', data: '2025-02-10', tipo: 'Quase Acidente', descricao: 'Veículo passou próximo a pedestre na pista de acesso – Mina do Cerrado', gravidade: 'Baixa',  contrato: 'CONT-001', envolvidos: ['COL-006'], acoes: 'Treinamento de sinalização e novos cones instalados', status: 'Fechado' },
    { id: 'INC-002', data: '2025-03-05', tipo: 'Acidente Sem Afastamento', descricao: 'Corte leve na mão durante manutenção – falta de EPI adequado', gravidade: 'Média', contrato: 'CONT-002', envolvidos: ['COL-007'], acoes: 'Investigação em andamento – troca de luvas corte 5', status: 'Aberto' },
    { id: 'INC-003', data: '2025-01-22', tipo: 'Condição Insegura', descricao: 'Derramamento de óleo hidráulico na área de manutenção', gravidade: 'Baixa', contrato: 'CONT-001', envolvidos: [], acoes: 'Área limpa e kit de contenção instalado permanentemente', status: 'Fechado' },
    { id: 'INC-004', data: '2025-03-15', tipo: 'Quase Acidente', descricao: 'Falha no freio de estacionamento do caminhão HD785', gravidade: 'Alta', contrato: 'CONT-001', envolvidos: ['COL-004'], acoes: 'Caminhão retirado de circulação – manutenção emergencial', status: 'Aberto' }
  ];

  window.ERP_DATA.equipamentos = [
    { id: 'EQP-001', codigo: 'EX-001', descricao: 'Escavadeira Hidráulica PC800',    tipo: 'Equipamento', marca: 'Komatsu',   modelo: 'PC800-8',      ano: 2020, placa: 'MG-001', contrato: 'CONT-001', status: 'Operacional',  horasAcum: 8450, ultimaManut: '2025-03-01', proxManut: '2025-05-01', horimetro: 8450 },
    { id: 'EQP-002', codigo: 'HD-001', descricao: 'Caminhão Fora-de-Estrada HD785', tipo: 'Veículo',    marca: 'Komatsu',   modelo: 'HD785-7',      ano: 2019, placa: 'MG-002', contrato: 'CONT-001', status: 'Manutenção',   horasAcum: 12300, ultimaManut: '2025-03-20', proxManut: '2025-04-10', horimetro: 12300 },
    { id: 'EQP-003', codigo: 'MN-001', descricao: 'Motoniveladora GD655',           tipo: 'Equipamento', marca: 'Komatsu',   modelo: 'GD655-5',      ano: 2021, placa: 'MG-003', contrato: 'CONT-002', status: 'Operacional',  horasAcum: 5200, ultimaManut: '2025-02-15', proxManut: '2025-04-15', horimetro: 5200 },
    { id: 'EQP-004', codigo: 'BT-001', descricao: 'Britador Primário 42×65',        tipo: 'Equipamento', marca: 'Metso',     modelo: 'Nordberg C160',ano: 2018, placa: 'N/A',    contrato: 'CONT-003', status: 'Operacional',  horasAcum: 18700, ultimaManut: '2025-03-10', proxManut: '2025-04-30', horimetro: 18700 },
    { id: 'EQP-005', codigo: 'PF-001', descricao: 'Perfuratriz Rotativa DM45',      tipo: 'Equipamento', marca: 'Caterpillar',modelo: 'DM45-HP',     ano: 2022, placa: 'N/A',    contrato: 'CONT-004', status: 'Operacional',  horasAcum: 1200, ultimaManut: '2025-03-25', proxManut: '2025-05-25', horimetro: 1200 },
    { id: 'EQP-006', codigo: 'TR-001', descricao: 'Trator de Esteiras D155',        tipo: 'Equipamento', marca: 'Komatsu',   modelo: 'D155AX-8',     ano: 2020, placa: 'MG-005', contrato: 'CONT-001', status: 'Operacional',  horasAcum: 7800, ultimaManut: '2025-02-28', proxManut: '2025-04-28', horimetro: 7800 },
    { id: 'EQP-007', codigo: 'PP-001', descricao: 'Pá Carregadeira WA600',          tipo: 'Equipamento', marca: 'Komatsu',   modelo: 'WA600-8',      ano: 2021, placa: 'MG-006', contrato: 'CONT-001', status: 'Operacional',  horasAcum: 6100, ultimaManut: '2025-03-05', proxManut: '2025-05-05', horimetro: 6100 },
    { id: 'EQP-008', codigo: 'CT-001', descricao: 'Caminhão Basculante Volvo FMX',  tipo: 'Veículo',    marca: 'Volvo',     modelo: 'FMX 500',      ano: 2022, placa: 'MG-007', contrato: 'CONT-002', status: 'Operacional',  horasAcum: 4300, ultimaManut: '2025-03-18', proxManut: '2025-05-18', horimetro: 4300 }
  ];

  window.ERP_DATA.medicoes = [
    { id: 'MED-001', contrato: 'CONT-001', referencia: 'Jan/2025', dataEnvio: '2025-02-05', dataPagamento: '2025-02-25', bruto: 380000, glosa: 8500, liquido: 371500, status: 'Paga',    observacoes: 'Medição aprovada sem ressalvas' },
    { id: 'MED-002', contrato: 'CONT-001', referencia: 'Fev/2025', dataEnvio: '2025-03-05', dataPagamento: '2025-03-25', bruto: 395000, glosa: 4200, liquido: 390800, status: 'Paga',    observacoes: 'Glosa por hora parada EQP-002' },
    { id: 'MED-003', contrato: 'CONT-001', referencia: 'Mar/2025', dataEnvio: '2025-04-02', dataPagamento: '',           bruto: 410000, glosa: 0,    liquido: 410000, status: 'Enviada',  observacoes: 'Aguardando aprovação cliente' },
    { id: 'MED-004', contrato: 'CONT-002', referencia: 'Fev/2025', dataEnvio: '2025-03-07', dataPagamento: '2025-03-28', bruto: 195000, glosa: 0,    liquido: 195000, status: 'Paga',    observacoes: '' },
    { id: 'MED-005', contrato: 'CONT-002', referencia: 'Mar/2025', dataEnvio: '2025-04-04', dataPagamento: '',           bruto: 198000, glosa: 0,    liquido: 198000, status: 'Enviada',  observacoes: '' },
    { id: 'MED-006', contrato: 'CONT-003', referencia: 'Mar/2025', dataEnvio: '2025-04-01', dataPagamento: '',           bruto: 148000, glosa: 2100, liquido: 145900, status: 'Contestada', observacoes: 'Cliente contestou horas de britagem' }
  ];

  window.ERP_DATA.faturas = [
    { id: 'FAT-001', contrato: 'CONT-001', numero: 'NF-000345', referencia: 'Jan/2025', emissao: '2025-02-06', vencimento: '2025-02-28', bruto: 380000, glosa: 8500, liquido: 371500, status: 'Paga',    pagamento: '2025-02-25' },
    { id: 'FAT-002', contrato: 'CONT-001', numero: 'NF-000389', referencia: 'Fev/2025', emissao: '2025-03-06', vencimento: '2025-03-28', bruto: 395000, glosa: 4200, liquido: 390800, status: 'Paga',    pagamento: '2025-03-25' },
    { id: 'FAT-003', contrato: 'CONT-001', numero: 'NF-000421', referencia: 'Mar/2025', emissao: '2025-04-03', vencimento: '2025-04-30', bruto: 410000, glosa: 0,    liquido: 410000, status: 'Em Aberto', pagamento: '' },
    { id: 'FAT-004', contrato: 'CONT-002', numero: 'NF-000392', referencia: 'Fev/2025', emissao: '2025-03-08', vencimento: '2025-03-30', bruto: 195000, glosa: 0,    liquido: 195000, status: 'Paga',    pagamento: '2025-03-28' },
    { id: 'FAT-005', contrato: 'CONT-002', numero: 'NF-000425', referencia: 'Mar/2025', emissao: '2025-04-05', vencimento: '2025-05-05', bruto: 198000, glosa: 0,    liquido: 198000, status: 'Em Aberto', pagamento: '' },
    { id: 'FAT-006', contrato: 'CONT-003', numero: 'NF-000387', referencia: 'Fev/2025', emissao: '2025-03-02', vencimento: '2025-03-30', bruto: 148000, glosa: 2100, liquido: 145900, status: 'Atrasada', pagamento: '' }
  ];

  window.ERP_DATA.ordens = [
    { id: 'OS-2025-0001', contrato: 'CONT-001', tipo: 'Preventiva', descricao: 'Revisão geral Escavadeira PC800 – 500h', status: 'Concluída', prioridade: 'Normal', responsavel: 'Marcos Vieira', equipe: 2, prazo: '2025-03-10', horas: 8, progresso: 100, local: 'Oficina Central' },
    { id: 'OS-2025-0002', contrato: 'CONT-001', tipo: 'Corretiva',  descricao: 'Reparo freio estacionamento HD785', status: 'Em Andamento', prioridade: 'Crítica', responsavel: 'Marcos Vieira', equipe: 3, prazo: '2025-04-02', horas: 16, progresso: 60, local: 'Oficina Central' },
    { id: 'OS-2025-0003', contrato: 'CONT-002', tipo: 'Preventiva', descricao: 'Troca de pneus Motoniveladora GD655', status: 'Agendada', prioridade: 'Normal', responsavel: 'José Rodrigues', equipe: 2, prazo: '2025-04-10', horas: 6, progresso: 0, local: 'Canteiro CONT-002' },
    { id: 'OS-2025-0004', contrato: 'CONT-003', tipo: 'Inspeção',   descricao: 'Inspeção mandíbulas britador primário', status: 'Concluída', prioridade: 'Alta', responsavel: 'Diego Fonseca', equipe: 2, prazo: '2025-03-20', horas: 4, progresso: 100, local: 'Planta Britagem' },
    { id: 'OS-2025-0005', contrato: 'CONT-001', tipo: 'Preventiva', descricao: 'Lubrificação geral equipamentos – lote Março', status: 'Em Andamento', prioridade: 'Normal', responsavel: 'Jair Oliveira', equipe: 2, prazo: '2025-04-05', horas: 12, progresso: 45, local: 'Pátio de Manutenção' }
  ];

  // ─── 2. CRM ───────────────────────────────────────
  const crmLeads = [
    { id: 'LEAD-001', empresa: 'Lithium Power Mineração S/A', segmento: 'Mineração', contato: 'Dr. Henrique Carvalho', cargo: 'Diretor de Operações', email: 'hcarvalho@lithiumpower.com.br', telefone: '(11) 3400-8800', origem: 'Prospecção Ativa', potencial: 8500000, probabilidade: 70, etapa: 'Proposta Enviada', responsavel: 'Ana Paula Rocha', criado: '10/01/2025', ultimaAcao: '20/03/2025', obs: 'Cliente em avaliação de 3 empresas. Proposta técnica enviada em Fev/2025.' },
    { id: 'LEAD-002', empresa: 'Cobre & Ouro Mineração S/A', segmento: 'Mineração', contato: 'Maria Clara Ramos', cargo: 'Diretora de Contratos', email: 'mclara@cobreouro.com.br', telefone: '(91) 3200-4400', origem: 'Renovação', potencial: 1800000, probabilidade: 85, etapa: 'Negociação', responsavel: 'Fernanda Costa', criado: '05/02/2025', ultimaAcao: '25/03/2025', obs: 'Extensão do CONT-002 – Ampliação Fase 4.' },
    { id: 'LEAD-003', empresa: 'Nióbio do Cerrado Ltda', segmento: 'Mineração', contato: 'Eng. Roberto Assis', cargo: 'Gerente de Infraestrutura', email: 'rassis@niobiocerrado.com.br', telefone: '(62) 3500-1100', origem: 'Indicação', potencial: 5200000, probabilidade: 40, etapa: 'Qualificação', responsavel: 'Ricardo Almeida', criado: '20/02/2025', ultimaAcao: '15/03/2025', obs: 'Visita técnica agendada para Abril/2025.' },
    { id: 'LEAD-004', empresa: 'Ferro Bruto Extração Ltda', segmento: 'Mineração', contato: 'Sérgio Machado', cargo: 'Gerente de Operações', email: 'smachado@ferrobruto.com.br', telefone: '(62) 3601-9900', origem: 'Renovação', potencial: 3200000, probabilidade: 100, etapa: 'Fechado Ganho', responsavel: 'Ana Paula Rocha', criado: '01/12/2024', ultimaAcao: '28/02/2025', obs: 'Contrato assinado – CONT-004.' },
    { id: 'LEAD-005', empresa: 'Granito Serrano Cia.', segmento: 'Mineração', contato: 'Antônio Pereira', cargo: 'Sócio-Diretor', email: 'apedesira@granitoserrabo.com.br', telefone: '(27) 3355-7700', origem: 'Renovação', potencial: 1100000, probabilidade: 55, etapa: 'Proposta Enviada', responsavel: 'Marcos Vieira', criado: '01/03/2025', ultimaAcao: '22/03/2025', obs: '' }
  ];
  const crmPropostas = [
    { id: 'PROP-001', numero: 'PROP-001', lead: 'LEAD-001', cliente: 'Lithium Power Mineração S/A', descricao: 'Proposta Operação Mina Subterrânea', objeto: 'Operação de Mina Subterrânea', valor: 8500000, status: 'Enviada', data: '15/02/2025', validade: '15/05/2025', responsavel: 'Ana Paula Rocha', margem: 22, obs: 'Inclui mobilização de 90 dias' },
    { id: 'PROP-002', numero: 'PROP-002', lead: 'LEAD-002', cliente: 'Cobre & Ouro Mineração S/A', descricao: 'Aditivo CONT-002 – Ampliação Fase 4', objeto: 'Ampliação Fase 4 – Terraplenagem', valor: 1800000, status: 'Em Negociação', data: '01/03/2025', validade: '30/04/2025', responsavel: 'Fernanda Costa', margem: 19, obs: '' },
    { id: 'PROP-003', numero: 'PROP-003', lead: 'LEAD-004', cliente: 'Ferro Bruto Extração Ltda', descricao: 'Contrato CONT-004 – Desmonte e Carregamento', objeto: 'Desmonte a Fogo e Carregamento', valor: 3200000, status: 'Aprovada', data: '15/12/2024', validade: '28/02/2025', responsavel: 'Ana Paula Rocha', margem: 21, obs: 'Proposta aprovada – contrato assinado' }
  ];
  const crmAtividades = [
    { id: 'ATI-001', lead: 'LEAD-001', tipo: 'Reunião', descricao: 'Apresentação da proposta técnica – Rio de Janeiro', data: '20/02/2025', responsavel: 'Ana Paula Rocha', status: 'Realizada', resultado: 'Cliente solicitou ajuste no prazo de mobilização' },
    { id: 'ATI-002', lead: 'LEAD-001', tipo: 'E-mail', descricao: 'Envio de proposta revisada com prazo ajustado para 75 dias', data: '28/02/2025', responsavel: 'Ana Paula Rocha', status: 'Realizada', resultado: 'Aguardando aprovação do comitê do cliente' },
    { id: 'ATI-003', lead: 'LEAD-002', tipo: 'Negociação', descricao: 'Reunião de negociação do aditivo – Belém/PA', data: '25/03/2025', responsavel: 'Fernanda Costa', status: 'Realizada', resultado: 'Alinhados em escopo; pendente ajuste de preço unitário' },
    { id: 'ATI-004', lead: 'LEAD-003', tipo: 'Visita Técnica', descricao: 'Visita ao site de mineração – Catalão/GO (rejeitos e barragem)', data: '18/03/2025', responsavel: 'Ricardo Almeida', status: 'Agendada', resultado: '' },
    { id: 'ATI-005', lead: 'LEAD-005', tipo: 'Ligação', descricao: 'Follow-up proposta de renovação do contrato de pátio', data: '22/03/2025', responsavel: 'Marcos Vieira', status: 'Realizada', resultado: 'Cliente em análise interna, retorno em 2 semanas' }
  ];
  const crmContatos = [
    { id: 'CONT-CRM-001', nome: 'Dr. Henrique Carvalho', cargo: 'Diretor de Operações', empresa: 'Lithium Power Mineração S/A', email: 'hcarvalho@lithiumpower.com.br', telefone: '(11) 3400-8800', cidade: 'São Paulo', decisor: true },
    { id: 'CONT-CRM-002', nome: 'Maria Clara Ramos', cargo: 'Diretora de Contratos', empresa: 'Cobre & Ouro Mineração S/A', email: 'mclara@cobreouro.com.br', telefone: '(91) 3200-4400', cidade: 'Belém', decisor: true },
    { id: 'CONT-CRM-003', nome: 'Eng. Roberto Assis', cargo: 'Gerente de Infraestrutura', empresa: 'Nióbio do Cerrado Ltda', email: 'rassis@niobiocerrado.com.br', telefone: '(62) 3500-1100', cidade: 'Catalão', decisor: false },
    { id: 'CONT-CRM-004', nome: 'Sérgio Machado', cargo: 'Gerente de Operações', empresa: 'Ferro Bruto Extração Ltda', email: 'smachado@ferrobruto.com.br', telefone: '(62) 3601-9900', cidade: 'Goiânia', decisor: true },
    { id: 'CONT-CRM-005', nome: 'Antônio Pereira', cargo: 'Sócio-Diretor', empresa: 'Granito Serrano Cia.', email: 'apedesira@granitoserrabo.com.br', telefone: '(27) 3355-7700', cidade: 'Cachoeiro de Itapemirim', decisor: true }
  ];
  const crmData = {
    leads: crmLeads, propostas: crmPropostas, atividades: crmAtividades, contatos: crmContatos,
    oportunidades: [
      { id: 'OPP-001', cliente: 'Lithium Power Mineração S/A', servico: 'Operação de Mina Subterrânea', valor_estimado: 8500000, fase: 'Proposta Enviada', probabilidade: 70, responsavel: 'Ana Paula Rocha', previsao_fechamento: '2025-05-30', criado_em: iso('2025-01-10'), observacoes: 'Cliente em fase de avaliação de 3 empresas' },
      { id: 'OPP-002', cliente: 'Cobre & Ouro Mineração S/A', servico: 'Ampliação Fase 4 – Terraplenagem', valor_estimado: 1800000, fase: 'Negociação', probabilidade: 85, responsavel: 'Fernanda Costa', previsao_fechamento: '2025-04-15', criado_em: iso('2025-02-05'), observacoes: 'Extensão do CONT-002' },
      { id: 'OPP-003', cliente: 'Nióbio do Cerrado Ltda', servico: 'Gestão de Rejeitos e Barragem', valor_estimado: 5200000, fase: 'Qualificação', probabilidade: 40, responsavel: 'Ricardo Almeida', previsao_fechamento: '2025-07-01', criado_em: iso('2025-02-20'), observacoes: 'Visita técnica agendada para Abril' },
      { id: 'OPP-004', cliente: 'Ferro Bruto Extração Ltda', servico: 'Extensão Contrato CONT-004', valor_estimado: 3200000, fase: 'Contrato Assinado', probabilidade: 100, responsavel: 'Ana Paula Rocha', previsao_fechamento: '2025-02-28', criado_em: iso('2024-12-01'), observacoes: 'Mobilização em andamento' },
      { id: 'OPP-005', cliente: 'Granito Serrano Cia.', servico: 'Renovação Gestão de Pátio', valor_estimado: 1100000, fase: 'Proposta Enviada', probabilidade: 55, responsavel: 'Marcos Vieira', previsao_fechamento: '2025-05-15', criado_em: iso('2025-03-01'), observacoes: '' }
    ]
  };
  localStorage.setItem('fa_crm_data', JSON.stringify(crmData));
  localStorage.setItem('fraser_crm_oportunidades', JSON.stringify(crmData.oportunidades));

  // ─── 3. Fornecedores ──────────────────────────────
  const fornecedores = [
    { id: 'FOR-001', razao_social: 'Komaflex Peças e Serviços Ltda',      cnpj: '11.222.333/0001-44', categoria: 'Autopeças e Manutenção', status: 'Ativo',           contato: 'André Lima',       telefone: '(31) 3322-1100', email: 'vendas@komaflex.com.br',   cidade: 'Belo Horizonte', estado: 'MG', idf_score: 88, homologado: true,  prazo_entrega: 5 },
    { id: 'FOR-002', razao_social: 'Lubrax Lubrificantes S/A',            cnpj: '22.333.444/0001-55', categoria: 'Lubrificantes e Fluidos',  status: 'Ativo',           contato: 'Carla Moreira',    telefone: '(11) 4002-8922', email: 'comercial@lubrax.com.br',  cidade: 'São Paulo',      estado: 'SP', idf_score: 92, homologado: true,  prazo_entrega: 3 },
    { id: 'FOR-003', razao_social: 'SegMax Equipamentos de Proteção',      cnpj: '33.444.555/0001-66', categoria: 'EPI e Segurança',          status: 'Ativo',           contato: 'Pedro Faria',      telefone: '(31) 3456-7890', email: 'pedidos@segmax.com.br',    cidade: 'Contagem',       estado: 'MG', idf_score: 79, homologado: true,  prazo_entrega: 7 },
    { id: 'FOR-004', razao_social: 'Diesel Sul Combustíveis',              cnpj: '44.555.666/0001-77', categoria: 'Combustíveis',             status: 'Ativo',           contato: 'Marisa Santos',    telefone: '(41) 3501-2200', email: 'operacoes@dieselsul.com.br',cidade: 'Curitiba',       estado: 'PR', idf_score: 95, homologado: true,  prazo_entrega: 2 },
    { id: 'FOR-005', razao_social: 'InflaMax Pneus para Minas',           cnpj: '55.666.777/0001-88', categoria: 'Pneus e Câmaras',          status: 'Ativo',           contato: 'Roberto Leal',     telefone: '(31) 3781-4400', email: 'vendas@inflammax.com.br',  cidade: 'Betim',          estado: 'MG', idf_score: 81, homologado: true,  prazo_entrega: 10 },
    { id: 'FOR-006', razao_social: 'Aliminas Alimentação Coletiva',        cnpj: '66.777.888/0001-99', categoria: 'Alimentação/Catering',     status: 'Ativo',           contato: 'Juliana Ramos',    telefone: '(31) 3902-5500', email: 'contratos@aliminas.com.br', cidade: 'Nova Lima',      estado: 'MG', idf_score: 74, homologado: true,  prazo_entrega: 1 },
    { id: 'FOR-007', razao_social: 'HospedaMinas Alojamentos Ltda',       cnpj: '77.888.999/0001-00', categoria: 'Hospedagem/Alojamento',    status: 'Ativo',           contato: 'Sandra Costa',     telefone: '(31) 3251-8800', email: 'reservas@hospedaminas.com.br', cidade: 'Itabira', estado: 'MG', idf_score: 68, homologado: false, prazo_entrega: 1 },
    { id: 'FOR-008', razao_social: 'Abrasivos & Filtros Industriais S/A', cnpj: '88.999.000/0001-11', categoria: 'Consumíveis Industriais',  status: 'Homologação',     contato: 'Fernando Braga',   telefone: '(51) 3344-2211', email: 'comercial@abrafil.com.br',  cidade: 'Porto Alegre',   estado: 'RS', idf_score: 0,  homologado: false, prazo_entrega: 8 },
    { id: 'FOR-009', razao_social: 'TechDrill Serviços de Perfuração',    cnpj: '99.000.111/0001-22', categoria: 'Serviços Especializados',  status: 'Ativo',           contato: 'Gustavo Nunes',    telefone: '(62) 3300-4400', email: 'operacoes@techdrill.com.br',cidade: 'Goiânia',        estado: 'GO', idf_score: 86, homologado: true,  prazo_entrega: 15 },
    { id: 'FOR-010', razao_social: 'Metso Brazil Parts',                  cnpj: '12.345.678/0001-33', categoria: 'Peças Britagem',           status: 'Ativo',           contato: 'Thomas Mäkinen',   telefone: '(11) 5555-8800', email: 'parts.br@metso.com',         cidade: 'São Paulo',      estado: 'SP', idf_score: 97, homologado: true,  prazo_entrega: 21 }
  ];
  localStorage.setItem('fa_fornecedores_cache', JSON.stringify(fornecedores));

  // ─── 4. IDF – Índice de Desempenho de Fornecedor ──
  const idfAvaliacoes = [
    { id: 'IDF-001', fornecedor_id: 'FOR-001', fornecedor: 'Komaflex Peças e Serviços Ltda', data: '2025-01-15', avaliador: 'Ricardo Almeida', prazo: 90, qualidade: 85, preco: 88, atendimento: 90, score: 88, obs: 'Entrega pontual, peças de qualidade' },
    { id: 'IDF-002', fornecedor_id: 'FOR-002', fornecedor: 'Lubrax Lubrificantes S/A', data: '2025-02-10', avaliador: 'Luciana Barros', prazo: 95, qualidade: 92, preco: 90, atendimento: 92, score: 92, obs: 'Excelente parceiro' },
    { id: 'IDF-003', fornecedor_id: 'FOR-004', fornecedor: 'Diesel Sul Combustíveis', data: '2025-02-20', avaliador: 'Carlos Mendes', prazo: 98, qualidade: 95, preco: 93, atendimento: 95, score: 95, obs: 'Melhor preço da região' },
    { id: 'IDF-004', fornecedor_id: 'FOR-005', fornecedor: 'InflaMax Pneus para Minas', data: '2025-01-25', avaliador: 'José Rodrigues', prazo: 80, qualidade: 82, preco: 79, atendimento: 83, score: 81, obs: 'Prazo de entrega pode melhorar' },
    { id: 'IDF-005', fornecedor_id: 'FOR-003', fornecedor: 'SegMax Equipamentos de Proteção', data: '2025-03-01', avaliador: 'Patrícia Souza', prazo: 78, qualidade: 80, preco: 77, atendimento: 82, score: 79, obs: 'Qualidade OK, preços um pouco elevados' },
    { id: 'IDF-006', fornecedor_id: 'FOR-010', fornecedor: 'Metso Brazil Parts', data: '2025-02-28', avaliador: 'Diego Fonseca', prazo: 97, qualidade: 98, preco: 95, atendimento: 97, score: 97, obs: 'Referência no segmento de britagem' }
  ];
  localStorage.setItem('fa_idf_avaliacoes', JSON.stringify(idfAvaliacoes));

  // ─── 5. Ordens de Serviço (fa_ordens_servico) ─────
  const ordensServico = [
    {
      id: 'OS-2025-0001', numero: 'OS-2025-0001',
      contrato: 'CONT-001', cliente: 'Mineração Vale Verde Ltda',
      tipo: 'Preventiva', descricao: 'Revisão geral Escavadeira PC800 – 500h (troca de fluidos, filtros e ajustes)',
      status: 'Concluída', prioridade: 'Normal',
      responsavel: 'Marcos Vieira', equipe: 2,
      prazo: '2025-03-10', horas: 8, progresso: 100,
      local: 'Oficina Central – Mina do Cerrado',
      wbs_id: '1.2.1', wbs_descricao: 'Manutenção Preventiva – Filtros/Óleos', wbs_natureza: 'MAN',
      precisa_compra: true, tipo_compra: 'Material',
      itens_compra: [
        { descricao: 'Filtro de Óleo Motor Komatsu', qtd: 4, unidade: 'un', valor_unit: 85, valor_total: 340 },
        { descricao: 'Óleo Motor 15W40 Diesel', qtd: 20, unidade: 'L', valor_unit: 18, valor_total: 360 },
        { descricao: 'Filtro de Ar Primário', qtd: 2, unidade: 'un', valor_unit: 120, valor_total: 240 }
      ],
      criado_em: iso('2025-02-28'), criado_por: 'Ricardo Almeida',
      atualizado_em: iso('2025-03-10'), observacoes: 'Revisão concluída sem intercorrências'
    },
    {
      id: 'OS-2025-0002', numero: 'OS-2025-0002',
      contrato: 'CONT-001', cliente: 'Mineração Vale Verde Ltda',
      tipo: 'Corretiva', descricao: 'Reparo urgente no sistema de freio de estacionamento do HD785 – falha detectada no INC-004',
      status: 'Em Andamento', prioridade: 'Crítica',
      responsavel: 'Marcos Vieira', equipe: 3,
      prazo: '2025-04-02', horas: 16, progresso: 60,
      local: 'Oficina Central – Mina do Cerrado',
      wbs_id: '1.2.2', wbs_descricao: 'Manutenção Corretiva – Emergencial', wbs_natureza: 'MAN', wbs_nao_previsto: false,
      precisa_compra: true, tipo_compra: 'Misto',
      itens_compra: [
        { descricao: 'Conjunto de Freio HD785 Komatsu Original', qtd: 1, unidade: 'kit', valor_unit: 4800, valor_total: 4800 },
        { descricao: 'Serviço de Alinhamento Especializado', qtd: 1, unidade: 'vb', valor_unit: 1200, valor_total: 1200 }
      ],
      criado_em: iso('2025-03-20'), criado_por: 'Ricardo Almeida',
      atualizado_em: iso('2025-03-28'), observacoes: 'Peças solicitadas via RC-2025-0003'
    },
    {
      id: 'OS-2025-0003', numero: 'OS-2025-0003',
      contrato: 'CONT-002', cliente: 'Cobre & Ouro Mineração S/A',
      tipo: 'Preventiva', descricao: 'Troca de pneus traseiros da Motoniveladora GD655 (desgaste >80%)',
      status: 'Agendada', prioridade: 'Normal',
      responsavel: 'José Rodrigues', equipe: 2,
      prazo: '2025-04-10', horas: 6, progresso: 0,
      local: 'Canteiro CONT-002 – Terraplanagem Fase 3',
      wbs_id: 'P2-3.1', wbs_descricao: 'Pneus OTR 23.5R25 – 4 unidades', wbs_natureza: 'MAT',
      precisa_compra: true, tipo_compra: 'Material',
      itens_compra: [
        { descricao: 'Pneu OTR 23.5R25 para Motoniveladora', qtd: 4, unidade: 'un', valor_unit: 2800, valor_total: 11200 }
      ],
      criado_em: iso('2025-03-25'), criado_por: 'Fernanda Costa',
      atualizado_em: iso('2025-03-25'), observacoes: ''
    },
    {
      id: 'OS-2025-0004', numero: 'OS-2025-0004',
      contrato: 'CONT-003', cliente: 'Bauxita do Norte Ind. e Com.',
      tipo: 'Inspeção', descricao: 'Inspeção e medição das mandíbulas do britador primário Metso C160',
      status: 'Concluída', prioridade: 'Alta',
      responsavel: 'Diego Fonseca', equipe: 2,
      prazo: '2025-03-20', horas: 4, progresso: 100,
      local: 'Planta de Britagem – CONT-003',
      wbs_id: 'P3-2.1', wbs_descricao: 'Mandíbulas Britador (desgaste)', wbs_natureza: 'MAT',
      precisa_compra: false,
      itens_compra: [],
      criado_em: iso('2025-03-15'), criado_por: 'Carlos Mendes',
      atualizado_em: iso('2025-03-20'), observacoes: 'Desgaste de 45% – reposição prevista para Jun/25'
    },
    {
      id: 'OS-2025-0005', numero: 'OS-2025-0005',
      contrato: 'CONT-001', cliente: 'Mineração Vale Verde Ltda',
      tipo: 'Preventiva', descricao: 'Lubrificação geral de equipamentos – lote Março/2025 (escavadeira, trator, pá carregadeira)',
      status: 'Em Andamento', prioridade: 'Normal',
      responsavel: 'Jair Oliveira', equipe: 2,
      prazo: '2025-04-05', horas: 12, progresso: 45,
      local: 'Pátio de Manutenção – Mina do Cerrado',
      wbs_id: '1.3.1', wbs_descricao: 'Lubrificação Geral – Consumíveis', wbs_natureza: 'INS',
      precisa_compra: true, tipo_compra: 'Material',
      itens_compra: [
        { descricao: 'Graxa Lubrax EP-2 18kg', qtd: 6, unidade: 'balde', valor_unit: 95, valor_total: 570 },
        { descricao: 'Lubrificante de Engrenagem GL5 20L', qtd: 4, unidade: 'pct', valor_unit: 185, valor_total: 740 }
      ],
      criado_em: iso('2025-03-22'), criado_por: 'Ricardo Almeida',
      atualizado_em: iso('2025-03-26'), observacoes: ''
    },
    {
      id: 'OS-2025-0006', numero: 'OS-2025-0006',
      contrato: 'CONT-004', cliente: 'Ferro Bruto Extração Ltda',
      tipo: 'Projeto', descricao: 'Instalação e comissionamento da perfuratriz DM45 – Mobilização CONT-004',
      status: 'Em Andamento', prioridade: 'Alta',
      responsavel: 'Pedro Castilho', equipe: 4,
      prazo: '2025-04-15', horas: 32, progresso: 30,
      local: 'Área de Perfuração – Mina Ferro Bruto',
      wbs_id: null, wbs_descricao: null, wbs_natureza: null, wbs_nao_previsto: false,
      precisa_compra: false,
      itens_compra: [],
      criado_em: iso('2025-03-10'), criado_por: 'Ana Paula Rocha',
      atualizado_em: iso('2025-03-28'), observacoes: 'Aguardando liberação de área pela equipe de topografia'
    }
  ];
  localStorage.setItem('fa_ordens_servico', JSON.stringify(ordensServico));
  localStorage.setItem('fa_os_list', JSON.stringify(ordensServico));

  // Apontamentos de horas
  const apontamentos = [
    { id: 'APO-001', os_id: 'OS-2025-0001', data: '2025-03-08', horas: 4, colaborador: 'Marcos Vieira', atividade: 'Drenagem de óleo, remoção de filtros', registrado_por: 'Ricardo Almeida', criado_em: iso('2025-03-08') },
    { id: 'APO-002', os_id: 'OS-2025-0001', data: '2025-03-10', horas: 4, colaborador: 'Marcos Vieira', atividade: 'Instalação de novos filtros, fluidos e testes de partida', registrado_por: 'Ricardo Almeida', criado_em: iso('2025-03-10') },
    { id: 'APO-003', os_id: 'OS-2025-0002', data: '2025-03-21', horas: 5, colaborador: 'Marcos Vieira', atividade: 'Diagnóstico e desmontagem do sistema de freio', registrado_por: 'Ricardo Almeida', criado_em: iso('2025-03-21') },
    { id: 'APO-004', os_id: 'OS-2025-0002', data: '2025-03-25', horas: 4.5, colaborador: 'Roberto Lima', atividade: 'Instalação do conjunto de freio parcial – aguardando peça', registrado_por: 'Marcos Vieira', criado_em: iso('2025-03-25') },
    { id: 'APO-005', os_id: 'OS-2025-0004', data: '2025-03-19', horas: 4, colaborador: 'Diego Fonseca', atividade: 'Medição de desgaste das mandíbulas e laudo técnico', registrado_por: 'Carlos Mendes', criado_em: iso('2025-03-19') },
    { id: 'APO-006', os_id: 'OS-2025-0005', data: '2025-03-26', horas: 5.5, colaborador: 'Jair Oliveira', atividade: 'Lubrificação EQP-001 e EQP-006 – pontos externos', registrado_por: 'Ricardo Almeida', criado_em: iso('2025-03-26') },
    { id: 'APO-007', os_id: 'OS-2025-0006', data: '2025-03-15', horas: 8, colaborador: 'Pedro Castilho', atividade: 'Montagem do conjunto de haste e mesa giratória', registrado_por: 'Ana Paula Rocha', criado_em: iso('2025-03-15') }
  ];
  localStorage.setItem('fa_apontamentos_os', JSON.stringify(apontamentos));

  // ─── 6. Requisições de Compra (RC) ───────────────
  const rcs = [
    {
      id: 'RC-2025-0001', numero: 'RC-2025-0001',
      contrato: 'CONT-001', os_id: 'OS-2025-0001',
      solicitante: 'Marcos Vieira', data: '2025-02-28',
      tipo: 'Material', urgencia: 'Normal',
      status: 'PC Emitido',
      aprovado_por: 'Ricardo Almeida', data_aprovacao: '2025-03-01',
      pedido_id: 'PED-2025-001',
      itens: [
        { descricao: 'Filtro de Óleo Motor Komatsu', qtd: 4, unidade: 'un', valor_unit: 85, valor_total: 340 },
        { descricao: 'Óleo Motor 15W40 Diesel 20L', qtd: 20, unidade: 'L', valor_unit: 18, valor_total: 360 },
        { descricao: 'Filtro de Ar Primário', qtd: 2, unidade: 'un', valor_unit: 120, valor_total: 240 }
      ],
      valor_total: 940, observacoes: 'Revisão 500h PC800'
    },
    {
      id: 'RC-2025-0002', numero: 'RC-2025-0002',
      contrato: 'CONT-001', os_id: 'OS-2025-0005',
      solicitante: 'Jair Oliveira', data: '2025-03-22',
      tipo: 'Material', urgencia: 'Normal',
      status: 'PC Emitido',
      aprovado_por: 'Ricardo Almeida', data_aprovacao: '2025-03-23',
      pedido_id: 'PED-2025-002',
      itens: [
        { descricao: 'Graxa Lubrax EP-2 18kg', qtd: 6, unidade: 'balde', valor_unit: 95, valor_total: 570 },
        { descricao: 'Lubrificante GL5 20L', qtd: 4, unidade: 'pct', valor_unit: 185, valor_total: 740 }
      ],
      valor_total: 1310, observacoes: 'Lote lubrificação março'
    },
    {
      id: 'RC-2025-0003', numero: 'RC-2025-0003',
      contrato: 'CONT-001', os_id: 'OS-2025-0002',
      solicitante: 'Marcos Vieira', data: '2025-03-21',
      tipo: 'Misto', urgencia: 'Urgente',
      status: 'Aguardando Aprovação',
      aprovado_por: '', data_aprovacao: '',
      itens: [
        { descricao: 'Conjunto de Freio HD785 Komatsu Original', qtd: 1, unidade: 'kit', valor_unit: 4800, valor_total: 4800 },
        { descricao: 'Serviço de Alinhamento Especializado TechDrill', qtd: 1, unidade: 'vb', valor_unit: 1200, valor_total: 1200 }
      ],
      valor_total: 6000, observacoes: 'Urgente – equipamento fora de operação (INC-004)'
    },
    {
      id: 'RC-2025-0004', numero: 'RC-2025-0004',
      contrato: 'CONT-002', os_id: 'OS-2025-0003',
      solicitante: 'José Rodrigues', data: '2025-03-25',
      tipo: 'Material', urgencia: 'Normal',
      status: 'Rascunho',
      aprovado_por: '', data_aprovacao: '',
      itens: [
        { descricao: 'Pneu OTR 23.5R25 Motoniveladora', qtd: 4, unidade: 'un', valor_unit: 2800, valor_total: 11200 }
      ],
      valor_total: 11200, observacoes: 'OS-2025-0003 – desgaste crítico'
    },
    {
      id: 'RC-2025-0005', numero: 'RC-2025-0005',
      contrato: 'CONT-001', os_id: '',
      solicitante: 'Patrícia Souza', data: '2025-03-10',
      tipo: 'Material', urgencia: 'Normal',
      status: 'PC Emitido',
      aprovado_por: 'Ricardo Almeida', data_aprovacao: '2025-03-11',
      pedido_id: 'PED-2025-003',
      itens: [
        { descricao: 'Capacete de Segurança Classe A – lote', qtd: 30, unidade: 'un', valor_unit: 28, valor_total: 840 },
        { descricao: 'Óculos de Proteção Ampla Visão', qtd: 30, unidade: 'un', valor_unit: 15, valor_total: 450 },
        { descricao: 'Luvas de Vaqueta Par', qtd: 50, unidade: 'par', valor_unit: 12, valor_total: 600 },
        { descricao: 'Botina de Segurança Par 38-44', qtd: 10, unidade: 'par', valor_unit: 110, valor_total: 1100 }
      ],
      valor_total: 2990, observacoes: 'Reposição EPI – CONT-001'
    }
  ];
  localStorage.setItem('fa_rcs', JSON.stringify(rcs));
  localStorage.setItem('fa_rc', JSON.stringify(rcs));
  localStorage.setItem('fraser_rcs', JSON.stringify(rcs));

  // Fluxo de aprovação OS — formato correto para renderFluxoAprovacaoRC
  // Cada entrada representa uma OS com itens de compra no fluxo
  const fluxoOS = [
    {
      id: 'FOS-001',
      os_id: 'OS-2025-0001',
      os_descricao: 'Revisão 500h – Filtros e óleos do PC800 (escavadeira hidráulica)',
      os_contrato: 'CONT-001',
      os_tipo_compra: 'Material',
      contrato: 'CONT-001',
      criado_por: 'Marcos Vieira',
      criado_em: iso('2025-02-28'),
      atualizado_em: iso('2025-03-01'),
      status: 'PC Emitido',
      estagio_atual: 4,
      total_estagios: 3,
      estagios_aprovacao: [
        { estagio: 1, status: 'Aprovado', aprovador: 'Ricardo Almeida', data: iso('2025-03-01'), obs: 'Aprovado – dentro da alçada do supervisor' }
      ],
      itens: [
        { descricao: 'Filtro de Óleo Motor Komatsu', qtd: 4, unidade: 'un', valor_unit: 85, valor_total: 340, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-02-28') },
        { descricao: 'Óleo Motor 15W40 Diesel', qtd: 20, unidade: 'L', valor_unit: 18, valor_total: 360, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-02-28') },
        { descricao: 'Filtro de Ar Primário', qtd: 2, unidade: 'un', valor_unit: 120, valor_total: 240, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-02-28') }
      ],
      rcs_geradas: ['RC-2025-0001'],
      rcs: [{ rc_id: 'RC-2025-0001', rc_numero: 'RC-2025-0001', data: '01/03/2025 08:00', criado_por: 'Marcos Vieira' }],
      historico: [
        { acao: 'PC emitido – PED-2025-001', usuario: 'Luciana Barros', data: '05/03/2025 14:30' },
        { acao: 'RC RC-2025-0001 emitida com 3 item(ns)', usuario: 'Marcos Vieira', data: '01/03/2025 08:00' },
        { acao: 'OS inserida no fluxo de aprovação', usuario: 'Ricardo Almeida', data: '28/02/2025 07:00' }
      ]
    },
    {
      id: 'FOS-002',
      os_id: 'OS-2025-0005',
      os_descricao: 'Lubrificação geral de equipamentos – lote Março/2025',
      os_contrato: 'CONT-001',
      os_tipo_compra: 'Material',
      contrato: 'CONT-001',
      criado_por: 'Jair Oliveira',
      criado_em: iso('2025-03-22'),
      atualizado_em: iso('2025-03-23'),
      status: 'PC Emitido',
      estagio_atual: 4,
      total_estagios: 3,
      estagios_aprovacao: [
        { estagio: 1, status: 'Aprovado', aprovador: 'Ricardo Almeida', data: iso('2025-03-23'), obs: 'Aprovado – lote de lubrificação mensal' }
      ],
      itens: [
        { descricao: 'Graxa Lubrax EP-2 18kg', qtd: 6, unidade: 'balde', valor_unit: 95, valor_total: 570, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-03-22') },
        { descricao: 'Lubrificante de Engrenagem GL5 20L', qtd: 4, unidade: 'pct', valor_unit: 185, valor_total: 740, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-03-22') }
      ],
      rcs_geradas: ['RC-2025-0002'],
      rcs: [{ rc_id: 'RC-2025-0002', rc_numero: 'RC-2025-0002', data: '23/03/2025 09:15', criado_por: 'Jair Oliveira' }],
      historico: [
        { acao: 'PC emitido – PED-2025-002', usuario: 'Luciana Barros', data: '25/03/2025 11:00' },
        { acao: 'RC RC-2025-0002 emitida com 2 item(ns)', usuario: 'Jair Oliveira', data: '23/03/2025 09:15' },
        { acao: 'OS inserida no fluxo de aprovação', usuario: 'Ricardo Almeida', data: '22/03/2025 08:00' }
      ]
    },
    {
      id: 'FOS-003',
      os_id: 'OS-2025-0002',
      os_descricao: 'Reparo urgente no sistema de freio HD785 – falha detectada no INC-004',
      os_contrato: 'CONT-001',
      os_tipo_compra: 'Misto',
      contrato: 'CONT-001',
      criado_por: 'Marcos Vieira',
      criado_em: iso('2025-03-21'),
      atualizado_em: iso('2025-03-21'),
      status: 'Aguardando Aprovação',
      estagio_atual: 1,
      total_estagios: 3,
      estagios_aprovacao: [],
      itens: [
        { descricao: 'Conjunto de Freio HD785 Komatsu Original', qtd: 1, unidade: 'kit', valor_unit: 4800, valor_total: 4800, status_item: 'Aguardando Aprovação', novo: false, adicionado_em: iso('2025-03-21') },
        { descricao: 'Serviço de Alinhamento Especializado TechDrill', qtd: 1, unidade: 'vb', valor_unit: 1200, valor_total: 1200, status_item: 'Aguardando Aprovação', novo: false, adicionado_em: iso('2025-03-21') }
      ],
      rcs_geradas: [],
      rcs: [],
      historico: [
        { acao: 'OS inserida no fluxo de aprovação – urgente (INC-004)', usuario: 'Marcos Vieira', data: '21/03/2025 10:30' }
      ]
    },
    {
      id: 'FOS-004',
      os_id: 'OS-EPI-001',
      os_descricao: 'Reposição EPI – CONT-001 (capacetes, óculos, luvas, botinas)',
      os_contrato: 'CONT-001',
      os_tipo_compra: 'Material',
      contrato: 'CONT-001',
      criado_por: 'Patrícia Souza',
      criado_em: iso('2025-03-10'),
      atualizado_em: iso('2025-03-11'),
      status: 'PC Emitido',
      estagio_atual: 4,
      total_estagios: 3,
      estagios_aprovacao: [
        { estagio: 1, status: 'Aprovado', aprovador: 'Ricardo Almeida', data: iso('2025-03-11'), obs: 'EPI – reposição periódica aprovada' }
      ],
      itens: [
        { descricao: 'Capacete de Segurança Classe A', qtd: 30, unidade: 'un', valor_unit: 28, valor_total: 840, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-03-10') },
        { descricao: 'Óculos de Proteção Ampla Visão', qtd: 30, unidade: 'un', valor_unit: 15, valor_total: 450, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-03-10') },
        { descricao: 'Luvas de Vaqueta Par', qtd: 50, unidade: 'par', valor_unit: 12, valor_total: 600, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-03-10') },
        { descricao: 'Botina de Segurança Par 38-44', qtd: 10, unidade: 'par', valor_unit: 110, valor_total: 1100, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-03-10') }
      ],
      rcs_geradas: ['RC-2025-0005'],
      rcs: [{ rc_id: 'RC-2025-0005', rc_numero: 'RC-2025-0005', data: '11/03/2025 09:00', criado_por: 'Patrícia Souza' }],
      historico: [
        { acao: 'PC emitido – PED-2025-003', usuario: 'Luciana Barros', data: '16/03/2025 10:00' },
        { acao: 'RC RC-2025-0005 emitida com 4 item(ns)', usuario: 'Patrícia Souza', data: '11/03/2025 09:00' },
        { acao: 'OS inserida no fluxo de aprovação', usuario: 'Patrícia Souza', data: '10/03/2025 14:00' }
      ]
    }
  ];
  localStorage.setItem('fa_fluxo_os', JSON.stringify(fluxoOS));
  localStorage.setItem('fraser_fluxo_os', JSON.stringify(fluxoOS));

  // ─── 7. RFQs (Cotações) ───────────────────────────
  const rfqs = [
    {
      id: 'RFQ-2025-001', numero: 'RFQ-2025-001',
      rc_id: 'RC-2025-0001', contrato: 'CONT-001',
      descricao: 'Filtros e óleos para revisão PC800',
      status: 'Pedido Emitido', data_criacao: iso('2025-03-02'), data_encerramento: iso('2025-03-05'),
      fornecedores_convidados: ['FOR-001', 'FOR-002', 'FOR-008'],
      fornecedor_vencedor: 'FOR-001',
      cotacoes: [
        { fornecedor_id: 'FOR-001', fornecedor: 'Komaflex', valor_total: 940, prazo: 5, status: 'Recebida', nota: 92 },
        { fornecedor_id: 'FOR-002', fornecedor: 'Lubrax', valor_total: 890, prazo: 3, status: 'Recebida', nota: 89 },
        { fornecedor_id: 'FOR-008', fornecedor: 'Abrasivos & Filtros', valor_total: 1050, prazo: 8, status: 'Recebida', nota: 71 }
      ],
      valor_aprovado: 940, criado_por: 'Luciana Barros'
    },
    {
      id: 'RFQ-2025-002', numero: 'RFQ-2025-002',
      rc_id: 'RC-2025-0002', contrato: 'CONT-001',
      descricao: 'Graxas e lubrificantes – lote março',
      status: 'Pedido Emitido', data_criacao: iso('2025-03-23'), data_encerramento: iso('2025-03-25'),
      fornecedores_convidados: ['FOR-002', 'FOR-001'],
      fornecedor_vencedor: 'FOR-002',
      cotacoes: [
        { fornecedor_id: 'FOR-002', fornecedor: 'Lubrax', valor_total: 1280, prazo: 3, status: 'Recebida', nota: 95 },
        { fornecedor_id: 'FOR-001', fornecedor: 'Komaflex', valor_total: 1380, prazo: 5, status: 'Recebida', nota: 82 }
      ],
      valor_aprovado: 1280, criado_por: 'Luciana Barros'
    },
    {
      id: 'RFQ-2025-003', numero: 'RFQ-2025-003',
      rc_id: 'RC-2025-0005', contrato: 'CONT-001',
      descricao: 'EPI – capacetes, óculos, luvas, botinas',
      status: 'Pedido Emitido', data_criacao: iso('2025-03-12'), data_encerramento: iso('2025-03-15'),
      fornecedores_convidados: ['FOR-003'],
      fornecedor_vencedor: 'FOR-003',
      cotacoes: [
        { fornecedor_id: 'FOR-003', fornecedor: 'SegMax', valor_total: 2980, prazo: 7, status: 'Recebida', nota: 80 }
      ],
      valor_aprovado: 2980, criado_por: 'Patrícia Souza'
    },
    {
      id: 'RFQ-2025-004', numero: 'RFQ-2025-004',
      rc_id: 'RC-2025-0003', contrato: 'CONT-001',
      descricao: 'Conjunto freio HD785 + serviço alinhamento',
      status: 'Em Cotação', data_criacao: iso('2025-03-22'), data_encerramento: '',
      fornecedores_convidados: ['FOR-001', 'FOR-009'],
      fornecedor_vencedor: '',
      cotacoes: [
        { fornecedor_id: 'FOR-001', fornecedor: 'Komaflex', valor_total: 5200, prazo: 7, status: 'Recebida', nota: 88 }
      ],
      valor_aprovado: 0, criado_por: 'Luciana Barros'
    }
  ];
  // Garante que nenhum RFQ fique com 'Aguardando Envio' (status removido do fluxo)
  const _fixRFQStatus = (lista) => lista.map(r => r.status === 'Aguardando Envio' ? Object.assign({}, r, { status: 'Em Cotação' }) : r);
  localStorage.setItem('fa_rfqs', JSON.stringify(_fixRFQStatus(rfqs)));
  localStorage.setItem('fa_rfq_flow', JSON.stringify(_fixRFQStatus(rfqs)));

  // ─── 8. Mapas de Comparação ───────────────────────
  const matrizes = [
    {
      id: 'MAP-001', numero: 'MAPA-2025-0001', rfq_id: 'RFQ-2025-001', descricao: 'Comparativo filtros e óleos PC800',
      status: 'Aprovada', aprovador: 'Ricardo Almeida', data_aprovacao: iso('2025-03-05'),
      fornecedor_selecionado: 'FOR-001', fornecedor_selecionado_nome: 'Komaflex Peças e Serviços Ltda',
      valor: 940, valor_aprovado: 940, economizado: 110, criado_por: 'Luciana Barros', contrato: 'CONT-001',
      rc_id: 'RC-2025-0001', cotacoes_comparadas: [
        { fornecedor_id: 'FOR-001', fornecedor: 'Komaflex', valor: 940, prazo: 5, score_idf: 88, recomendado: true, justificativa: 'Menor preço + melhor IDF' },
        { fornecedor_id: 'FOR-002', fornecedor: 'Lubrax', valor: 890, prazo: 3, score_idf: 92, recomendado: false, justificativa: '' },
        { fornecedor_id: 'FOR-008', fornecedor: 'Abrasivos & Filtros', valor: 1050, prazo: 8, score_idf: 0, recomendado: false, justificativa: '' }
      ]
    },
    {
      id: 'MAP-002', numero: 'MAPA-2025-0002', rfq_id: 'RFQ-2025-002', descricao: 'Comparativo graxas e lubrificantes',
      status: 'Aprovada', aprovador: 'Ricardo Almeida', data_aprovacao: iso('2025-03-25'),
      fornecedor_selecionado: 'FOR-002', fornecedor_selecionado_nome: 'Lubrax Lubrificantes S/A',
      valor: 1280, valor_aprovado: 1280, economizado: 100, criado_por: 'Luciana Barros', contrato: 'CONT-001',
      rc_id: 'RC-2025-0002', cotacoes_comparadas: [
        { fornecedor_id: 'FOR-002', fornecedor: 'Lubrax', valor: 1280, prazo: 3, score_idf: 92, recomendado: true, justificativa: 'Melhor custo-benefício' },
        { fornecedor_id: 'FOR-001', fornecedor: 'Komaflex', valor: 1380, prazo: 5, score_idf: 88, recomendado: false, justificativa: '' }
      ]
    },
    {
      id: 'MAP-003', numero: 'MAPA-2025-0003', rfq_id: 'RFQ-2025-003', descricao: 'Comparativo EPI – reposição CONT-001',
      status: 'Aprovada', aprovador: 'Patrícia Souza', data_aprovacao: iso('2025-03-15'),
      fornecedor_selecionado: 'FOR-003', fornecedor_selecionado_nome: 'SegMax Equipamentos de Proteção',
      valor: 2980, valor_aprovado: 2980, economizado: 10, criado_por: 'Patrícia Souza', contrato: 'CONT-001',
      rc_id: 'RC-2025-0005', cotacoes_comparadas: [
        { fornecedor_id: 'FOR-003', fornecedor: 'SegMax', valor: 2980, prazo: 7, score_idf: 79, recomendado: true, justificativa: 'Único fornecedor cotado' }
      ]
    }
  ];
  // Mescla com mapas existentes (preserva mapas criados pelo usuário)
  const _matrizesExist = (() => { try { return JSON.parse(localStorage.getItem('fa_matrizes') || '[]'); } catch(e) { return []; } })();
  const _matrizesIds = new Set(matrizes.map(m => m.id));
  const _matrizesUsuario = _matrizesExist.filter(m => !_matrizesIds.has(m.id));
  const _matrizesFinais = [...matrizes, ..._matrizesUsuario];
  localStorage.setItem('fa_matrizes', JSON.stringify(_matrizesFinais));
  localStorage.setItem('fa_mapas_comp', JSON.stringify(_matrizesFinais));

  // ─── 9. Pedidos de Compra ─────────────────────────
  const pedidos = [
    {
      id: 'PED-2025-001', numero: 'PED-2025-001',
      rfq_id: 'RFQ-2025-001', rc_id: 'RC-2025-0001',
      fornecedor_id: 'FOR-001', fornecedor: 'Komaflex Peças e Serviços Ltda',
      contrato: 'CONT-001', descricao: 'Filtros e óleos para revisão 500h PC800',
      status: 'Entregue', data_emissao: iso('2025-03-06'), data_entrega_prev: '2025-03-11', data_entrega_real: '2025-03-10',
      itens: [
        { descricao: 'Filtro de Óleo Motor Komatsu', qtd: 4, unidade: 'un', valor_unit: 85, valor_total: 340 },
        { descricao: 'Óleo Motor 15W40', qtd: 20, unidade: 'L', valor_unit: 18, valor_total: 360 },
        { descricao: 'Filtro de Ar Primário', qtd: 2, unidade: 'un', valor_unit: 120, valor_total: 240 }
      ],
      valor_total: 940, forma_pagamento: '30 dias', nf_numero: 'NF-45201',
      recebido_por: 'Marcos Vieira', observacoes: 'Entregue antes do prazo'
    },
    {
      id: 'PED-2025-002', numero: 'PED-2025-002',
      rfq_id: 'RFQ-2025-002', rc_id: 'RC-2025-0002',
      fornecedor_id: 'FOR-002', fornecedor: 'Lubrax Lubrificantes S/A',
      contrato: 'CONT-001', descricao: 'Graxas e lubrificantes – lote março',
      status: 'Entregue', data_emissao: iso('2025-03-26'), data_entrega_prev: '2025-03-29', data_entrega_real: '2025-03-29',
      itens: [
        { descricao: 'Graxa Lubrax EP-2 18kg', qtd: 6, unidade: 'balde', valor_unit: 213.33, valor_total: 1280 }
      ],
      valor_total: 1280, forma_pagamento: '30 dias', nf_numero: 'NF-78923',
      recebido_por: 'Jair Oliveira', observacoes: ''
    },
    {
      id: 'PED-2025-003', numero: 'PED-2025-003',
      rfq_id: 'RFQ-2025-003', rc_id: 'RC-2025-0005',
      fornecedor_id: 'FOR-003', fornecedor: 'SegMax Equipamentos de Proteção',
      contrato: 'CONT-001', descricao: 'EPI – reposição trimestral CONT-001',
      status: 'Enviado', data_emissao: iso('2025-03-16'), data_entrega_prev: '2025-03-23', data_entrega_real: '',
      itens: [
        { descricao: 'Capacete de Segurança Classe A', qtd: 30, unidade: 'un', valor_unit: 28, valor_total: 840 },
        { descricao: 'Óculos Proteção Ampla Visão', qtd: 30, unidade: 'un', valor_unit: 15, valor_total: 450 },
        { descricao: 'Luvas de Vaqueta Par', qtd: 50, unidade: 'par', valor_unit: 12, valor_total: 600 },
        { descricao: 'Botina de Segurança', qtd: 10, unidade: 'par', valor_unit: 109, valor_total: 1090 }
      ],
      valor_total: 2980, forma_pagamento: '30 dias', nf_numero: '',
      recebido_por: '', observacoes: 'Aguardando entrega'
    },
    {
      id: 'PED-2025-004', numero: 'PED-2025-004',
      rfq_id: '', rc_id: '',
      fornecedor_id: 'FOR-004', fornecedor: 'Diesel Sul Combustíveis',
      contrato: 'CONT-001', descricao: 'Fornecimento de diesel S-10 – Março/2025',
      status: 'Entregue', data_emissao: iso('2025-03-01'), data_entrega_prev: '2025-03-03', data_entrega_real: '2025-03-03',
      itens: [
        { descricao: 'Diesel S-10', qtd: 8000, unidade: 'L', valor_unit: 5.85, valor_total: 46800 }
      ],
      valor_total: 46800, forma_pagamento: 'À vista', nf_numero: 'NF-12890',
      recebido_por: 'Antônio Ferreira', observacoes: 'Abastecimento mensal'
    },
    {
      id: 'PED-2025-005', numero: 'PED-2025-005',
      rfq_id: '', rc_id: '',
      fornecedor_id: 'FOR-006', fornecedor: 'Aliminas Alimentação Coletiva',
      contrato: 'CONT-001', descricao: 'Serviço de catering – Março/2025 (28 colaboradores)',
      status: 'Entregue', data_emissao: iso('2025-03-01'), data_entrega_prev: '2025-03-31', data_entrega_real: '2025-03-31',
      itens: [
        { descricao: 'Alimentação coletiva diária 28 pax', qtd: 31, unidade: 'dia', valor_unit: 2800, valor_total: 86800 }
      ],
      valor_total: 86800, forma_pagamento: '30 dias', nf_numero: 'NF-55410',
      recebido_por: 'Simone Lacerda', observacoes: ''
    }
  ];
  // Mescla pedidos da seed com pedidos do usuário (preserva itens não-seed)
  const _pedidosExist = (() => { try { return JSON.parse(localStorage.getItem('fa_pedidos') || '[]'); } catch(e) { return []; } })();
  const _pedidosSeedIds = new Set(pedidos.map(p => p.id));
  const _pedidosUser = _pedidosExist.filter(p => p.id && !_pedidosSeedIds.has(p.id));
  const _pedidosFinais = [...pedidos, ..._pedidosUser];
  localStorage.setItem('fa_pedidos', JSON.stringify(_pedidosFinais));
  localStorage.setItem('fraser_pedidos', JSON.stringify(_pedidosFinais));

  // ─── 10. Recebimentos ────────────────────────────
  const recebimentos = [
    {
      id: 'REC-001', numero: 'REC-001',
      pedido_id: 'PED-2025-001', pedido_numero: 'PC-2025-001',
      fornecedor_id: 'FOR-001', fornecedor: 'Komaflex Filtros',
      nf_numero: 'NF-45201', valor_nf: 940,
      data_recebimento: '10/03/2025', data_recebimento_iso: '2025-03-10',
      conferente: 'Marcos Vieira', status: 'Conforme',
      local_entrega: 'Almoxarifado Central',
      obs: 'Todos os itens conferidos OK',
      itens_inspecao: [
        { descricao: 'Filtro de Óleo Motor Komatsu PC800', nome: 'Filtro de Óleo Motor Komatsu PC800', material_id: 'MAT-001', qtd_pedida: 4, qtd_recebida: 4, status: 'Conforme', unidade: 'un', valor_unitario: 85 },
        { descricao: 'Filtro de Ar Primário Komatsu', nome: 'Filtro de Ar Primário Komatsu', material_id: 'MAT-002', qtd_pedida: 2, qtd_recebida: 2, status: 'Conforme', unidade: 'un', valor_unitario: 120 }
      ]
    },
    {
      id: 'REC-002', numero: 'REC-002',
      pedido_id: 'PED-2025-002', pedido_numero: 'PC-2025-002',
      fornecedor_id: 'FOR-002', fornecedor: 'Lubrax Lubrificantes',
      nf_numero: 'NF-78923', valor_nf: 1280,
      data_recebimento: '29/03/2025', data_recebimento_iso: '2025-03-29',
      conferente: 'Jair Oliveira', status: 'Conforme',
      local_entrega: 'Almoxarifado Central',
      obs: '',
      itens_inspecao: [
        { descricao: 'Graxa Lubrax EP-2 18kg', nome: 'Graxa Lubrax EP-2 18kg', material_id: 'MAT-004', qtd_pedida: 6, qtd_recebida: 6, status: 'Conforme', unidade: 'balde', valor_unitario: 95 },
        { descricao: 'Óleo Motor 15W40 Diesel 20L', nome: 'Óleo Motor 15W40 Diesel 20L', material_id: 'MAT-003', qtd_pedida: 10, qtd_recebida: 10, status: 'Conforme', unidade: 'L', valor_unitario: 18 }
      ]
    },
    {
      id: 'REC-003', numero: 'REC-003',
      pedido_id: 'PED-2025-004', pedido_numero: 'PC-2025-004',
      fornecedor_id: 'FOR-004', fornecedor: 'Diesel Sul Combustíveis',
      nf_numero: 'NF-12890', valor_nf: 46800,
      data_recebimento: '03/03/2025', data_recebimento_iso: '2025-03-03',
      conferente: 'Antônio Ferreira', status: 'Conforme',
      local_entrega: 'Tanque Diesel',
      obs: 'Abastecimento confirmado via medidor',
      itens_inspecao: [
        { descricao: 'Diesel S-10', nome: 'Diesel S-10', material_id: 'MAT-008', qtd_pedida: 8000, qtd_recebida: 8000, status: 'Conforme', unidade: 'L', valor_unitario: 5.85 }
      ]
    },
    {
      id: 'REC-004', numero: 'REC-004',
      pedido_id: 'PED-2025-005', pedido_numero: 'PC-2025-005',
      fornecedor_id: 'FOR-005', fornecedor: 'Aliminas Catering',
      nf_numero: 'NF-55410', valor_nf: 86800,
      data_recebimento: '31/03/2025', data_recebimento_iso: '2025-03-31',
      conferente: 'Simone Lacerda', status: 'Conforme',
      local_entrega: 'Refeitório',
      obs: 'Serviço prestado todo mês',
      itens_inspecao: [
        { descricao: 'Serviço de Catering Março/2025', nome: 'Serviço de Catering Março/2025', material_id: '', qtd_pedida: 1, qtd_recebida: 1, status: 'Conforme', unidade: 'mês', valor_unitario: 86800 }
      ]
    }
  ];
  localStorage.setItem('fa_recebimentos', JSON.stringify(recebimentos));

  // ─── 11. Avaliações de Fornecedores (pós-entrega) ──
  const avaliacoesForn = [
    { id: 'AVFOR-001', pedido_id: 'PED-2025-001', fornecedor_id: 'FOR-001', data: '2025-03-12', avaliador: 'Marcos Vieira', prazo: 95, qualidade: 90, atendimento: 88, score: 91, obs: 'Entregou 1 dia antes do previsto' },
    { id: 'AVFOR-002', pedido_id: 'PED-2025-002', fornecedor_id: 'FOR-002', data: '2025-03-30', avaliador: 'Jair Oliveira', prazo: 100, qualidade: 92, atendimento: 95, score: 95, obs: 'Excelente – manter fornecedor preferencial' },
    { id: 'AVFOR-003', pedido_id: 'PED-2025-004', fornecedor_id: 'FOR-004', data: '2025-03-04', avaliador: 'Antônio Ferreira', prazo: 100, qualidade: 96, atendimento: 95, score: 97, obs: 'Diesel de qualidade, entrega impecável' }
  ];
  localStorage.setItem('fa_avaliacoes_forn', JSON.stringify(avaliacoesForn));

  // ─── 12. Contas a Pagar ───────────────────────────
  const contasPagar = [
    { id: 'CP-001', pedido_id: 'PED-2025-001', fornecedor: 'Komaflex', descricao: 'Filtros e óleos PC800', vencimento: '2025-04-06', valor: 940, status: 'Pago', pagamento: '2025-04-05', nf: 'NF-45201', contrato: 'CONT-001' },
    { id: 'CP-002', pedido_id: 'PED-2025-002', fornecedor: 'Lubrax', descricao: 'Graxas e lubrificantes', vencimento: '2025-04-26', valor: 1280, status: 'Em Aberto', pagamento: '', nf: 'NF-78923', contrato: 'CONT-001' },
    { id: 'CP-003', pedido_id: 'PED-2025-003', fornecedor: 'SegMax', descricao: 'EPI reposição trimestral', vencimento: '2025-04-16', valor: 2980, status: 'Em Aberto', pagamento: '', nf: '', contrato: 'CONT-001' },
    { id: 'CP-004', pedido_id: 'PED-2025-004', fornecedor: 'Diesel Sul', descricao: 'Diesel S-10 Março', vencimento: '2025-03-03', valor: 46800, status: 'Pago', pagamento: '2025-03-03', nf: 'NF-12890', contrato: 'CONT-001' },
    { id: 'CP-005', pedido_id: 'PED-2025-005', fornecedor: 'Aliminas', descricao: 'Catering Março/2025', vencimento: '2025-04-30', valor: 86800, status: 'Em Aberto', pagamento: '', nf: 'NF-55410', contrato: 'CONT-001' },
    { id: 'CP-006', pedido_id: '', fornecedor: 'HospedaMinas', descricao: 'Alojamento equipe Março', vencimento: '2025-04-05', valor: 18200, status: 'Em Aberto', pagamento: '', nf: 'NF-33100', contrato: 'CONT-001' }
  ];
  localStorage.setItem('fa_contas_pagar', JSON.stringify(contasPagar));
  localStorage.setItem('fraser_contas_pagar', JSON.stringify(contasPagar));

  // ─── 13. Materiais / Almoxarifado ─────────────────
  const materiais = [
    { id: 'MAT-001', codigo: 'FO-001', descricao: 'Filtro de Óleo Motor Komatsu PC800', categoria: 'Filtros', unidade: 'un', estoque: 8, min: 4, max: 20, custo_medio: 85, local: 'Prateleira A-1', ultima_mov: '2025-03-10' },
    { id: 'MAT-002', codigo: 'FO-002', descricao: 'Filtro de Ar Primário Komatsu', categoria: 'Filtros', unidade: 'un', estoque: 3, min: 2, max: 10, custo_medio: 120, local: 'Prateleira A-2', ultima_mov: '2025-03-10' },
    { id: 'MAT-003', codigo: 'LU-001', descricao: 'Óleo Motor 15W40 Diesel 20L', categoria: 'Lubrificantes', unidade: 'L', estoque: 80, min: 40, max: 200, custo_medio: 18, local: 'Tanque L-1', ultima_mov: '2025-03-29' },
    { id: 'MAT-004', codigo: 'LU-002', descricao: 'Graxa Lubrax EP-2 18kg', categoria: 'Lubrificantes', unidade: 'balde', estoque: 12, min: 4, max: 24, custo_medio: 95, local: 'Prateleira B-3', ultima_mov: '2025-03-29' },
    { id: 'MAT-005', codigo: 'EPI-001', descricao: 'Capacete de Segurança Classe A', categoria: 'EPI', unidade: 'un', estoque: 25, min: 10, max: 50, custo_medio: 28, local: 'Armário EPI-1', ultima_mov: '2025-03-23' },
    { id: 'MAT-006', codigo: 'EPI-002', descricao: 'Óculos de Proteção Ampla Visão', categoria: 'EPI', unidade: 'un', estoque: 18, min: 10, max: 40, custo_medio: 15, local: 'Armário EPI-1', ultima_mov: '2025-03-23' },
    { id: 'MAT-007', codigo: 'EPI-003', descricao: 'Luvas de Vaqueta Par', categoria: 'EPI', unidade: 'par', estoque: 32, min: 20, max: 80, custo_medio: 12, local: 'Armário EPI-2', ultima_mov: '2025-03-23' },
    { id: 'MAT-008', codigo: 'CB-001', descricao: 'Diesel S-10', categoria: 'Combustível', unidade: 'L', estoque: 3500, min: 2000, max: 10000, custo_medio: 5.85, local: 'Tanque Diesel', ultima_mov: '2025-03-03' },
    { id: 'MAT-009', codigo: 'PA-001', descricao: 'Pneu OTR 23.5R25 Motoniveladora', categoria: 'Pneus', unidade: 'un', estoque: 0, min: 4, max: 12, custo_medio: 2800, local: 'Pátio Externo', ultima_mov: '2025-02-10' }
  ];
  localStorage.setItem('fa_materiais', JSON.stringify(materiais));

  const movAlmox = [
    // Saídas para OS
    { id: 'MOV-001', numero: 'MOV-2025-0001', data: '2025-03-10', tipo: 'Saída', subtipo: 'OS', material_id: 'MAT-001', material: 'Filtro de Óleo Komatsu', material_nome: 'Filtro de Óleo Motor Komatsu PC800', material_codigo: 'FO-001', qtd: 4, quantidade: 4, unidade: 'un', destino: 'OS-2025-0001', local_destino: 'OS-2025-0001', responsavel: 'Marcos Vieira', pedido: 'PED-2025-001', os_numero: 'OS-2025-0001', estoque_antes: 12, estoque_depois: 8, status: 'Efetivado', criado_em: '2025-03-10T08:00:00.000Z' },
    { id: 'MOV-002', numero: 'MOV-2025-0002', data: '2025-03-10', tipo: 'Saída', subtipo: 'OS', material_id: 'MAT-002', material: 'Filtro de Ar Primário', material_nome: 'Filtro de Ar Primário Komatsu', material_codigo: 'FO-002', qtd: 2, quantidade: 2, unidade: 'un', destino: 'OS-2025-0001', local_destino: 'OS-2025-0001', responsavel: 'Marcos Vieira', pedido: 'PED-2025-001', os_numero: 'OS-2025-0001', estoque_antes: 5, estoque_depois: 3, status: 'Efetivado', criado_em: '2025-03-10T08:30:00.000Z' },
    { id: 'MOV-005', numero: 'MOV-2025-0005', data: '2025-03-29', tipo: 'Saída', subtipo: 'OS', material_id: 'MAT-004', material: 'Graxa Lubrax EP-2', material_nome: 'Graxa Lubrax EP-2 18kg', material_codigo: 'LU-002', qtd: 4, quantidade: 4, unidade: 'balde', destino: 'OS-2025-0005', local_destino: 'OS-2025-0005', responsavel: 'Jair Oliveira', os_numero: 'OS-2025-0005', estoque_antes: 16, estoque_depois: 12, status: 'Efetivado', criado_em: '2025-03-29T14:00:00.000Z' },
    { id: 'MOV-007', numero: 'MOV-2025-0007', data: '2025-03-31', tipo: 'Saída', subtipo: 'Manual', material_id: 'MAT-008', material: 'Diesel S-10', material_nome: 'Diesel S-10', material_codigo: 'CB-001', qtd: 4500, quantidade: 4500, unidade: 'L', destino: 'Abastecimento frota Março', local_destino: 'Pátio frota', responsavel: 'Antônio Ferreira', estoque_antes: 8000, estoque_depois: 3500, status: 'Efetivado', criado_em: '2025-03-31T18:00:00.000Z' },
    // Entradas por Recebimento (vinculadas aos recebimentos confirmados)
    { id: 'MOV-003', numero: 'MOV-2025-0003', data: '2025-03-10', tipo: 'Entrada', subtipo: 'Recebimento', material_id: 'MAT-001', material: 'Filtro de Óleo Komatsu', material_nome: 'Filtro de Óleo Motor Komatsu PC800', material_codigo: 'FO-001', qtd: 4, quantidade: 4, unidade: 'un', destino: 'Almoxarifado Central', local_destino: 'Almoxarifado Central', responsavel: 'Marcos Vieira', pedido: 'PED-2025-001', pedido_numero: 'PC-2025-001', recebimento_id: 'REC-001', recebimento_num: 'REC-001', nota_fiscal: 'NF-45201', fornecedor_nome: 'Komaflex Filtros', valor_unitario: 85, valor_total: 340, estoque_antes: 8, estoque_depois: 12, observacoes: 'Entrada automática – Recebimento REC-001 – NF: NF-45201', status: 'Efetivado', criado_em: '2025-03-10T07:00:00.000Z' },
    { id: 'MOV-003B', numero: 'MOV-2025-0003B', data: '2025-03-10', tipo: 'Entrada', subtipo: 'Recebimento', material_id: 'MAT-002', material: 'Filtro de Ar Primário', material_nome: 'Filtro de Ar Primário Komatsu', material_codigo: 'FO-002', qtd: 2, quantidade: 2, unidade: 'un', destino: 'Almoxarifado Central', local_destino: 'Almoxarifado Central', responsavel: 'Marcos Vieira', pedido: 'PED-2025-001', pedido_numero: 'PC-2025-001', recebimento_id: 'REC-001', recebimento_num: 'REC-001', nota_fiscal: 'NF-45201', fornecedor_nome: 'Komaflex Filtros', valor_unitario: 120, valor_total: 240, estoque_antes: 3, estoque_depois: 5, observacoes: 'Entrada automática – Recebimento REC-001 – NF: NF-45201', status: 'Efetivado', criado_em: '2025-03-10T07:05:00.000Z' },
    { id: 'MOV-004', numero: 'MOV-2025-0004', data: '2025-03-29', tipo: 'Entrada', subtipo: 'Recebimento', material_id: 'MAT-004', material: 'Graxa Lubrax EP-2', material_nome: 'Graxa Lubrax EP-2 18kg', material_codigo: 'LU-002', qtd: 6, quantidade: 6, unidade: 'balde', destino: 'Almoxarifado Central', local_destino: 'Almoxarifado Central', responsavel: 'Jair Oliveira', pedido: 'PED-2025-002', pedido_numero: 'PC-2025-002', recebimento_id: 'REC-002', recebimento_num: 'REC-002', nota_fiscal: 'NF-78923', fornecedor_nome: 'Lubrax Lubrificantes', valor_unitario: 95, valor_total: 570, estoque_antes: 10, estoque_depois: 16, observacoes: 'Entrada automática – Recebimento REC-002 – NF: NF-78923', status: 'Efetivado', criado_em: '2025-03-29T07:00:00.000Z' },
    { id: 'MOV-004B', numero: 'MOV-2025-0004B', data: '2025-03-29', tipo: 'Entrada', subtipo: 'Recebimento', material_id: 'MAT-003', material: 'Óleo Motor 15W40', material_nome: 'Óleo Motor 15W40 Diesel 20L', material_codigo: 'LU-001', qtd: 10, quantidade: 10, unidade: 'L', destino: 'Tanque L-1', local_destino: 'Tanque L-1', responsavel: 'Jair Oliveira', pedido: 'PED-2025-002', pedido_numero: 'PC-2025-002', recebimento_id: 'REC-002', recebimento_num: 'REC-002', nota_fiscal: 'NF-78923', fornecedor_nome: 'Lubrax Lubrificantes', valor_unitario: 18, valor_total: 180, estoque_antes: 70, estoque_depois: 80, observacoes: 'Entrada automática – Recebimento REC-002 – NF: NF-78923', status: 'Efetivado', criado_em: '2025-03-29T07:10:00.000Z' },
    { id: 'MOV-006', numero: 'MOV-2025-0006', data: '2025-03-03', tipo: 'Entrada', subtipo: 'Recebimento', material_id: 'MAT-008', material: 'Diesel S-10', material_nome: 'Diesel S-10', material_codigo: 'CB-001', qtd: 8000, quantidade: 8000, unidade: 'L', destino: 'Tanque Diesel', local_destino: 'Tanque Diesel', responsavel: 'Antônio Ferreira', pedido: 'PED-2025-004', pedido_numero: 'PC-2025-004', recebimento_id: 'REC-003', recebimento_num: 'REC-003', nota_fiscal: 'NF-12890', fornecedor_nome: 'Diesel Sul Combustíveis', valor_unitario: 5.85, valor_total: 46800, estoque_antes: 0, estoque_depois: 8000, observacoes: 'Entrada automática – Recebimento REC-003 – NF: NF-12890', status: 'Efetivado', criado_em: '2025-03-03T07:00:00.000Z' }
  ];
  // Salva nos dois formatos para compatibilidade total
  localStorage.setItem('fa_mov_almox', JSON.stringify(movAlmox));
  // Também salva no formato v6.1 (fa_almox_movimentos) com campos normalizados
  localStorage.setItem('fa_almox_movimentos', JSON.stringify(movAlmox.map(m => ({
    ...m,
    material_nome:   m.material_nome || m.material || '—',
    material_codigo: m.material_codigo || m.material_id || '',
    quantidade:      m.quantidade || m.qtd || 0,
    criado_em:       m.criado_em || m.data + 'T00:00:00.000Z'
  }))));

  // ─── 14. Requisições de Suprimentos ───────────────
  const requisicoes = [
    { id: 'REQ-001', rc_id: 'RC-2025-0001', contrato: 'CONT-001', solicitante: 'Marcos Vieira', descricao: 'Filtros e óleos OS-2025-0001', status: 'Concluída', data: '2025-03-01', valor: 940 },
    { id: 'REQ-002', rc_id: 'RC-2025-0002', contrato: 'CONT-001', solicitante: 'Jair Oliveira', descricao: 'Graxas OS-2025-0005', status: 'Concluída', data: '2025-03-23', valor: 1310 },
    { id: 'REQ-003', rc_id: 'RC-2025-0003', contrato: 'CONT-001', solicitante: 'Marcos Vieira', descricao: 'Freio HD785 – urgente', status: 'Em Cotação', data: '2025-03-21', valor: 6000 },
    { id: 'REQ-004', rc_id: 'RC-2025-0005', contrato: 'CONT-001', solicitante: 'Patrícia Souza', descricao: 'EPI reposição trimestral', status: 'Concluída', data: '2025-03-11', valor: 2990 }
  ];
  localStorage.setItem('fa_requisicoes', JSON.stringify(requisicoes));

  // Contratos de fornecimento
  const contratosForn = [
    { id: 'CF-001', fornecedor_id: 'FOR-004', fornecedor: 'Diesel Sul Combustíveis', contrato_cliente: 'CONT-001', objeto: 'Fornecimento de Diesel S-10', valor_mensal: 46800, inicio: '2024-01-01', fim: '2025-12-31', status: 'Ativo', renovavel: true },
    { id: 'CF-002', fornecedor_id: 'FOR-006', fornecedor: 'Aliminas Alimentação Coletiva', contrato_cliente: 'CONT-001', objeto: 'Catering 28 pax/dia', valor_mensal: 86800, inicio: '2024-01-01', fim: '2025-12-31', status: 'Ativo', renovavel: true },
    { id: 'CF-003', fornecedor_id: 'FOR-007', fornecedor: 'HospedaMinas Alojamentos', contrato_cliente: 'CONT-001', objeto: 'Alojamento 28 colaboradores', valor_mensal: 18200, inicio: '2024-01-01', fim: '2025-12-31', status: 'Ativo', renovavel: true }
  ];
  localStorage.setItem('fa_contratos_fornecimento', JSON.stringify(contratosForn));

  // ─── 15. WBS de Custos (fraser_custos_wbs) ────────
  // Projeto PROJ-001: CONT-001 - Mina do Cerrado
  const wbsProj1 = [
    // Grupos L1 (para wbsRenderTree visualizar hierarquia)
    { id: '1', projeto_id: 'PROJ-001', nivel: 1, g1: '1', g2: '', g3: '', item: '', descricao: 'Equipamentos e Operação', natureza: 'Grupo', expenditure: 'OPEX', tipo: 'OPEX', unidade: '—', qtd: 0, v_unit_est: 0, v_total_est: 0, est_total: 0, custo_real: 0, custo_proj: 0, custo_spot: 0, variacao: 0, variacao_pct: 0, preco_venda: 0, nao_previsto: false },
    { id: '2', projeto_id: 'PROJ-001', nivel: 1, g1: '2', g2: '', g3: '', item: '', descricao: 'Pessoal e Mão de Obra', natureza: 'Grupo', expenditure: 'OPEX', tipo: 'OPEX', unidade: '—', qtd: 0, v_unit_est: 0, v_total_est: 0, est_total: 0, custo_real: 0, custo_proj: 0, custo_spot: 0, variacao: 0, variacao_pct: 0, preco_venda: 0, nao_previsto: false },
    { id: '3', projeto_id: 'PROJ-001', nivel: 1, g1: '3', g2: '', g3: '', item: '', descricao: 'Alimentação e Acomodação', natureza: 'Grupo', expenditure: 'OPEX', tipo: 'OPEX', unidade: '—', qtd: 0, v_unit_est: 0, v_total_est: 0, est_total: 0, custo_real: 0, custo_proj: 0, custo_spot: 0, variacao: 0, variacao_pct: 0, preco_venda: 0, nao_previsto: false },
    { id: '4', projeto_id: 'PROJ-001', nivel: 1, g1: '4', g2: '', g3: '', item: '', descricao: 'EPI e Segurança', natureza: 'Grupo', expenditure: 'OPEX', tipo: 'OPEX', unidade: '—', qtd: 0, v_unit_est: 0, v_total_est: 0, est_total: 0, custo_real: 0, custo_proj: 0, custo_spot: 0, variacao: 0, variacao_pct: 0, preco_venda: 0, nao_previsto: false },
    // G1: Equipamentos Principais – Sub-grupos L2
    { id: '1.1', projeto_id: 'PROJ-001', nivel: 2, g1: '1', g2: '1', g3: '', item: '', descricao: 'Operação de Equipamentos', natureza: 'EQP', expenditure: 'OPEX', tipo: 'OPEX', unidade: 'mês', qtd: 24, v_unit_est: 95000, v_total_est: 2280000, est_total: 2280000, custo_real: 285000, custo_proj: 2280000, custo_spot: 0, custo_contrato: 2280000, variacao: 1995000, variacao_pct: 87, preco_venda: 2850000, nao_previsto: false, fornecedor: 'Fraser Alexander', obs: 'Escavadeira PC800 + frota CONT-001' },
    { id: '1.2', projeto_id: 'PROJ-001', nivel: 2, g1: '1', g2: '2', g3: '', item: '', descricao: 'Manutenção de Frota', natureza: 'MAN', expenditure: 'OPEX', tipo: 'OPEX', unidade: 'mês', qtd: 24, v_unit_est: 3500, v_total_est: 82700, est_total: 82700, custo_real: 2250, custo_proj: 82700, custo_spot: 0, custo_contrato: 82700, variacao: 80450, variacao_pct: 97, preco_venda: 103375, nao_previsto: false, fornecedor: 'Komaflex', obs: 'Preventiva + Corretiva' },
    { id: '1.3', projeto_id: 'PROJ-001', nivel: 2, g1: '1', g2: '3', g3: '', item: '', descricao: 'Combustível Diesel S-10', natureza: 'INS', expenditure: 'OPEX', tipo: 'OPEX', unidade: 'L', qtd: 192000, v_unit_est: 5.70, v_total_est: 1094400, est_total: 1094400, custo_real: 46800, custo_proj: 1094400, custo_spot: 0, custo_contrato: 1094400, variacao: 1047600, variacao_pct: 96, preco_venda: 1368000, nao_previsto: false, fornecedor: 'Diesel Sul', obs: 'PED-2025-004' },
    // G2: Pessoal
    { id: '2.1', projeto_id: 'PROJ-001', nivel: 2, g1: '2', g2: '1', g3: '', item: '', descricao: 'Mão de Obra Direta – 28 colaboradores', natureza: 'MOD', expenditure: 'OPEX', tipo: 'OPEX', unidade: 'mês', qtd: 28, v_unit_est: 7000, v_total_est: 4704000, est_total: 4704000, custo_real: 196000, custo_proj: 4704000, custo_spot: 0, custo_contrato: 4704000, variacao: 4508000, variacao_pct: 96, preco_venda: 5880000, nao_previsto: false, fornecedor: 'Fraser Alexander', obs: '' },
    // G3: Alimentação e Acomodação
    { id: '3.1', projeto_id: 'PROJ-001', nivel: 2, g1: '3', g2: '1', g3: '', item: '', descricao: 'Catering – 28 pax/dia', natureza: 'ALM', expenditure: 'OPEX', tipo: 'OPEX', unidade: 'mês', qtd: 24, v_unit_est: 84000, v_total_est: 2016000, est_total: 2016000, custo_real: 86800, custo_proj: 2016000, custo_spot: 0, custo_contrato: 2016000, variacao: 1929200, variacao_pct: 96, preco_venda: 2520000, nao_previsto: false, fornecedor: 'Aliminas', obs: 'PED-2025-005' },
    { id: '3.2', projeto_id: 'PROJ-001', nivel: 2, g1: '3', g2: '2', g3: '', item: '', descricao: 'Alojamento – 28 colaboradores', natureza: 'ALM', expenditure: 'OPEX', tipo: 'OPEX', unidade: 'mês', qtd: 24, v_unit_est: 17500, v_total_est: 420000, est_total: 420000, custo_real: 18200, custo_proj: 420000, custo_spot: 0, custo_contrato: 420000, variacao: 401800, variacao_pct: 96, preco_venda: 525000, nao_previsto: false, fornecedor: 'HospedaMinas', obs: 'CP-006' },
    // G4: EPI e Segurança
    { id: '4.1', projeto_id: 'PROJ-001', nivel: 2, g1: '4', g2: '1', g3: '', item: '', descricao: 'EPI – Reposição Trimestral', natureza: 'SSMA', expenditure: 'OPEX', tipo: 'OPEX', unidade: 'vb', qtd: 4, v_unit_est: 2800, v_total_est: 33600, est_total: 33600, custo_real: 2980, custo_proj: 33600, custo_spot: 0, custo_contrato: 33600, variacao: 30620, variacao_pct: 91, preco_venda: 42000, nao_previsto: false, fornecedor: 'SegMax', obs: 'PED-2025-003 – RC-2025-0005' },
    // L3: Detalhes de manutenção (vinculados às OS)
    { id: '1.2.1', projeto_id: 'PROJ-001', nivel: 3, g1: '1', g2: '2', g3: '1', item: '', descricao: 'Manutenção Preventiva – Filtros/Óleos', natureza: 'MAN', expenditure: 'OPEX', tipo: 'OPEX', unidade: 'serv.', qtd: 24, v_unit_est: 1800, v_total_est: 43200, est_total: 43200, custo_real: 940, custo_proj: 43200, custo_spot: 0, custo_contrato: 43200, variacao: 42260, variacao_pct: 98, preco_venda: 54000, nao_previsto: false, fornecedor: 'Komaflex', obs: 'OS-2025-0001', os_vinculadas: ['OS-2025-0001'] },
    { id: '1.2.2', projeto_id: 'PROJ-001', nivel: 3, g1: '1', g2: '2', g3: '2', item: '', descricao: 'Manutenção Corretiva – Emergencial', natureza: 'MAN', expenditure: 'OPEX', tipo: 'OPEX', unidade: 'vb', qtd: 1, v_unit_est: 3500, v_total_est: 3500, est_total: 3500, custo_real: 0, custo_proj: 6000, custo_spot: 0, custo_contrato: 6000, variacao: 3500, variacao_pct: 100, preco_venda: 8000, nao_previsto: false, fornecedor: 'Komaflex', obs: 'OS-2025-0002 – Freio HD785', os_vinculadas: ['OS-2025-0002'] },
    { id: '1.3.1', projeto_id: 'PROJ-001', nivel: 3, g1: '1', g2: '3', g3: '1', item: '', descricao: 'Lubrificação Geral – Consumíveis', natureza: 'INS', expenditure: 'OPEX', tipo: 'OPEX', unidade: 'mês', qtd: 24, v_unit_est: 1500, v_total_est: 36000, est_total: 36000, custo_real: 1310, custo_proj: 36000, custo_spot: 0, custo_contrato: 36000, variacao: 34690, variacao_pct: 96, preco_venda: 45000, nao_previsto: false, fornecedor: 'Lubrax', obs: 'OS-2025-0005', os_vinculadas: ['OS-2025-0005'] }
  ];

  // Projeto PROJ-002: CONT-002
  const wbsProj2 = [
    // Grupos L1
    { id: 'P2-1', projeto_id: 'PROJ-002', g1:'1', g2:'', g3:'', item:'', descricao:'Equipamentos e Operação', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0, custo_real:0, custo_proj:0, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:0, nao_previsto:false },
    { id: 'P2-2', projeto_id: 'PROJ-002', g1:'2', g2:'', g3:'', item:'', descricao:'Pessoal e Mão de Obra', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0, custo_real:0, custo_proj:0, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:0, nao_previsto:false },
    { id: 'P2-3', projeto_id: 'PROJ-002', g1:'3', g2:'', g3:'', item:'', descricao:'Pneus e Manutenção', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0, custo_real:0, custo_proj:0, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:0, nao_previsto:false },
    // Itens
    { id: 'P2-1.1', projeto_id: 'PROJ-002', g1: '1', g2: '1', g3: '', item: '', descricao: 'Motoniveladora GD655 – Operação', natureza: 'EQP', expenditure:'OPEX', fornecedor: 'Fraser Alexander', tipo: 'OPEX', unidade: 'mês', qtd: 18, v_unit_est: 45000, v_total_est: 810000, est_total:810000, custo_real: 90000, custo_proj: 810000, custo_spot: 0, custo_contrato: 810000, variacao: 0, variacao_pct: 0, preco_venda: 1012500, nao_previsto:false, obs: '' },
    { id: 'P2-2.1', projeto_id: 'PROJ-002', g1: '2', g2: '1', g3: '', item: '', descricao: 'Mão de Obra Direta – 14 colaboradores', natureza: 'MOD', expenditure:'OPEX', fornecedor: 'Fraser Alexander', tipo: 'OPEX', unidade: 'mês', qtd: 18, v_unit_est: 95200, v_total_est: 1713600, est_total:1713600, custo_real: 190400, custo_proj: 1713600, custo_spot: 0, custo_contrato: 1713600, variacao: 0, variacao_pct: 0, preco_venda: 2142000, nao_previsto:false, obs: '' },
    { id: 'P2-3.1', projeto_id: 'PROJ-002', g1: '3', g2: '1', g3: '', item: '', descricao: 'Pneus OTR 23.5R25 – 4 unidades', natureza: 'MAT', expenditure:'OPEX', fornecedor: 'InflaMax', tipo: 'OPEX', unidade: 'un', qtd: 4, v_unit_est: 2800, v_total_est: 11200, est_total:11200, custo_real: 0, custo_proj: 11200, custo_spot: 0, custo_contrato: 11200, variacao: 11200, variacao_pct: 100, preco_venda: 14000, nao_previsto:false, obs: 'OS-2025-0003 aguardando' }
  ];

  // Projeto PROJ-003: CONT-003 - Britagem
  const wbsProj3 = [
    // Grupos L1
    { id: 'P3-1', projeto_id: 'PROJ-003', g1:'1', g2:'', g3:'', item:'', descricao:'Operação e Mão de Obra', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0, custo_real:0, custo_proj:0, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:0, nao_previsto:false },
    { id: 'P3-2', projeto_id: 'PROJ-003', g1:'2', g2:'', g3:'', item:'', descricao:'Materiais e Insumos', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0, custo_real:0, custo_proj:0, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:0, nao_previsto:false },
    { id: 'P3-3', projeto_id: 'PROJ-003', g1:'3', g2:'', g3:'', item:'', descricao:'Energia e Utilidades', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0, custo_real:0, custo_proj:0, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:0, nao_previsto:false },
    { id: 'P3-4', projeto_id: 'PROJ-003', g1:'4', g2:'', g3:'', item:'', descricao:'Itens Não Previstos', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0, custo_real:0, custo_proj:0, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:0, nao_previsto:false },
    // Itens L2
    { id: 'P3-1.1', projeto_id: 'PROJ-003', g1:'1', g2:'1', g3:'', item:'', descricao:'Operação de Britagem Primária', natureza:'MOD', expenditure:'OPEX', tipo:'OPEX', unidade:'HH', qtd:3600, v_unit_est:45, v_total_est:162000, est_total:162000, custo_real:108000, custo_proj:162000, custo_spot:12000, variacao:54000, variacao_pct:33, preco_venda:202500, nao_previsto:false },
    { id: 'P3-1.2', projeto_id: 'PROJ-003', g1:'1', g2:'2', g3:'', item:'', descricao:'Supervisão e Controle', natureza:'MOD', expenditure:'OPEX', tipo:'OPEX', unidade:'HH', qtd:900, v_unit_est:75, v_total_est:67500, est_total:67500, custo_real:45000, custo_proj:67500, custo_spot:5000, variacao:22500, variacao_pct:33, preco_venda:84375, nao_previsto:false },
    { id: 'P3-2.1', projeto_id: 'PROJ-003', g1:'2', g2:'1', g3:'', item:'', descricao:'Mandíbulas Britador (desgaste)', natureza:'MAT', expenditure:'OPEX', tipo:'OPEX', unidade:'par', qtd:6, v_unit_est:18500, v_total_est:111000, est_total:111000, custo_real:37000, custo_proj:111000, custo_spot:0, variacao:74000, variacao_pct:67, preco_venda:138750, nao_previsto:false },
    { id: 'P3-2.2', projeto_id: 'PROJ-003', g1:'2', g2:'2', g3:'', item:'', descricao:'Óleo e Lubrificantes Britagem', natureza:'MAT', expenditure:'OPEX', tipo:'OPEX', unidade:'L', qtd:1200, v_unit_est:16, v_total_est:19200, est_total:19200, custo_real:6400, custo_proj:19200, custo_spot:0, variacao:12800, variacao_pct:67, preco_venda:24000, nao_previsto:false },
    { id: 'P3-3.1', projeto_id: 'PROJ-003', g1:'3', g2:'1', g3:'', item:'', descricao:'Energia Elétrica Planta', natureza:'INS', expenditure:'OPEX', tipo:'OPEX', unidade:'kWh', qtd:180000, v_unit_est:0.62, v_total_est:111600, est_total:111600, custo_real:74400, custo_proj:111600, custo_spot:0, variacao:37200, variacao_pct:33, preco_venda:139500, nao_previsto:false },
    // Item não previsto (OS fora de escopo – falha prematura do mancal)
    { id: 'P3-4.1', projeto_id: 'PROJ-003', g1:'4', g2:'1', g3:'', item:'', descricao:'Reparo Emergencial Mancal Britador – Não Previsto', natureza:'EQP', expenditure:'OPEX', tipo:'OPEX', unidade:'vb', qtd:1, v_unit_est:12500, v_total_est:12500, est_total:12500, custo_real:11800, custo_proj:12500, custo_spot:11800, variacao:700, variacao_pct:6, preco_venda:15625, nao_previsto:true, os_origem:'OS-2025-0004', obs:'Item não previsto – falha prematura do mancal. Criado a partir da OS-2025-0004' }
  ];

  // Propostas WBS (proposta → projeto estimativa)
  // Inclui grupos L1 (sem g2) para o resumo funcionar no CRM
  const wbsProposta1 = [
    // Grupos L1
    { id: 'PP1-1', projeto_id: 'PROJ-PROP-2025-001', g1:'1', g2:'', g3:'', item:'', descricao:'Recursos Humanos', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0, custo_real:0, custo_proj:0, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:0, nao_previsto:false },
    { id: 'PP1-2', projeto_id: 'PROJ-PROP-2025-001', g1:'2', g2:'', g3:'', item:'', descricao:'Materiais e Insumos', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0, custo_real:0, custo_proj:0, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:0, nao_previsto:false },
    { id: 'PP1-3', projeto_id: 'PROJ-PROP-2025-001', g1:'3', g2:'', g3:'', item:'', descricao:'Equipamentos e CAPEX', natureza:'Grupo', expenditure:'CAPEX', tipo:'CAPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0, custo_real:0, custo_proj:0, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:0, nao_previsto:false },
    { id: 'PP1-4', projeto_id: 'PROJ-PROP-2025-001', g1:'4', g2:'', g3:'', item:'', descricao:'SSMA e Qualidade', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0, custo_real:0, custo_proj:0, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:0, nao_previsto:false },
    { id: 'PP1-5', projeto_id: 'PROJ-PROP-2025-001', g1:'5', g2:'', g3:'', item:'', descricao:'Administração e Overhead', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0, custo_real:0, custo_proj:0, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:0, nao_previsto:false },
    // Itens L2
    { id: 'PP1-1.1', projeto_id: 'PROJ-PROP-2025-001', g1:'1', g2:'1', g3:'', item:'', descricao:'Mão de Obra Direta – Operação Subterrânea', natureza:'MOD', expenditure:'OPEX', tipo:'OPEX', unidade:'HH', qtd:12000, v_unit_est:68, v_total_est:816000, est_total:816000, custo_real:0, custo_proj:816000, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:1020000, nao_previsto:false },
    { id: 'PP1-1.2', projeto_id: 'PROJ-PROP-2025-001', g1:'1', g2:'2', g3:'', item:'', descricao:'Encargos e Benefícios (73% da MOD)', natureza:'MOI', expenditure:'OPEX', tipo:'OPEX', unidade:'%', qtd:1, v_unit_est:596000, v_total_est:596000, est_total:596000, custo_real:0, custo_proj:596000, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:745000, nao_previsto:false },
    { id: 'PP1-2.1', projeto_id: 'PROJ-PROP-2025-001', g1:'2', g2:'1', g3:'', item:'', descricao:'Materiais e Insumos – Consumíveis', natureza:'MAT', expenditure:'OPEX', tipo:'OPEX', unidade:'vb', qtd:1, v_unit_est:510000, v_total_est:510000, est_total:510000, custo_real:0, custo_proj:510000, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:637500, nao_previsto:false },
    { id: 'PP1-2.2', projeto_id: 'PROJ-PROP-2025-001', g1:'2', g2:'2', g3:'', item:'', descricao:'Peças e Componentes', natureza:'MAT', expenditure:'OPEX', tipo:'OPEX', unidade:'vb', qtd:1, v_unit_est:340000, v_total_est:340000, est_total:340000, custo_real:0, custo_proj:340000, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:425000, nao_previsto:false },
    { id: 'PP1-3.1', projeto_id: 'PROJ-PROP-2025-001', g1:'3', g2:'1', g3:'', item:'', descricao:'Equipamentos Mineração Subterrânea (CAPEX)', natureza:'EQP', expenditure:'CAPEX', tipo:'CAPEX', unidade:'vb', qtd:1, v_unit_est:3200000, v_total_est:3200000, est_total:3200000, custo_real:0, custo_proj:3200000, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:4000000, nao_previsto:false },
    { id: 'PP1-4.1', projeto_id: 'PROJ-PROP-2025-001', g1:'4', g2:'1', g3:'', item:'', descricao:'EPIs e Equipamentos de Segurança', natureza:'SSMA', expenditure:'OPEX', tipo:'OPEX', unidade:'vb', qtd:1, v_unit_est:102000, v_total_est:102000, est_total:102000, custo_real:0, custo_proj:102000, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:127500, nao_previsto:false },
    { id: 'PP1-4.2', projeto_id: 'PROJ-PROP-2025-001', g1:'4', g2:'2', g3:'', item:'', descricao:'SSMA – Treinamentos e PCMSO', natureza:'SSMA', expenditure:'OPEX', tipo:'OPEX', unidade:'vb', qtd:1, v_unit_est:83000, v_total_est:83000, est_total:83000, custo_real:0, custo_proj:83000, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:103750, nao_previsto:false },
    { id: 'PP1-5.1', projeto_id: 'PROJ-PROP-2025-001', g1:'5', g2:'1', g3:'', item:'', descricao:'Overhead Administrativo', natureza:'ADM', expenditure:'OPEX', tipo:'OPEX', unidade:'%', qtd:1, v_unit_est:553000, v_total_est:553000, est_total:553000, custo_real:0, custo_proj:553000, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:691250, nao_previsto:false },
    { id: 'PP1-5.2', projeto_id: 'PROJ-PROP-2025-001', g1:'5', g2:'2', g3:'', item:'', descricao:'Margem e Contingência', natureza:'ADM', expenditure:'OPEX', tipo:'OPEX', unidade:'%', qtd:1, v_unit_est:300000, v_total_est:300000, est_total:300000, custo_real:0, custo_proj:300000, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:375000, nao_previsto:false }
  ];

  const todosWBS = [...wbsProj1, ...wbsProj2, ...wbsProj3, ...wbsProposta1];
  localStorage.setItem('fraser_custos_wbs', JSON.stringify(todosWBS));
  localStorage.setItem('fraser_custos_wbs_version', '5-multi-projetos');

  // Mapa contrato → projeto (para wbs_manager)
  // Inclui: contratoId → projetoId, prop_<propostaId> → projetoId, prop_<leadId> → projetoId
  const wbsContratoMap = {
    'CONT-001': 'PROJ-001',
    'CONT-002': 'PROJ-002',
    'CONT-003': 'PROJ-003',
    // Proposta/Lead Lithium Power → Projeto de estimativa
    'prop_PROP-001': 'PROJ-PROP-2025-001',
    'prop_LEAD-001': 'PROJ-PROP-2025-001',  // CRM lead
    'prop_OPP-001': 'PROJ-PROP-2025-001',   // Oportunidade
    // Proposta/Lead Cobre & Ouro (Fase 4) → Projeto CONT-002 (reutiliza WBS do contrato)
    'prop_PROP-002': 'PROJ-002',
    'prop_LEAD-002': 'PROJ-002'
  };
  localStorage.setItem('fraser_wbs_contrato_map', JSON.stringify(wbsContratoMap));

  // Projetos de custos
  const projetosCustos = [
    { id: 'PROJ-001', nome: 'CONT-001 – Mina do Cerrado (Vale Verde)', contrato: 'CONT-001', cliente: 'Mineração Vale Verde Ltda', status: 'Ativo', inicio: '2024-01-15', fim: '2026-01-14', valor_contrato: 4800000, criado_em: iso('2024-01-10') },
    { id: 'PROJ-002', nome: 'CONT-002 – Terraplanagem Cobre & Ouro', contrato: 'CONT-002', cliente: 'Cobre & Ouro Mineração S/A', status: 'Ativo', inicio: '2024-03-01', fim: '2025-08-31', valor_contrato: 2350000, criado_em: iso('2024-02-20') },
    { id: 'PROJ-003', nome: 'CONT-003 – Britagem Bauxita do Norte', contrato: 'CONT-003', cliente: 'Bauxita do Norte Ind. e Com.', status: 'Ativo', inicio: '2023-08-01', fim: '2025-07-31', valor_contrato: 1800000, criado_em: iso('2023-07-15') },
    { id: 'PROJ-PROP-2025-001', nome: 'Proposta OPP-001 – Lithium Power (Mina Subterrânea)', proposta: 'PROP-001', lead: 'OPP-001', cliente: 'Lithium Power Mineração S/A', status: 'Proposta', inicio: '2025-06-01', fim: '', valor_proposta: 8500000, criado_em: iso('2025-02-15') }
  ];
  localStorage.setItem('fraser_custos_projetos', JSON.stringify(projetosCustos));

  // ─── 16. Propostas Comerciais (CRM → Proposta) ───
  const propostas = [
    { id: 'PROP-001', opp_id: 'OPP-001', cliente: 'Lithium Power Mineração S/A', descricao: 'Proposta Operação Mina Subterrânea', valor: 8500000, status: 'Enviada', data: iso('2025-02-15'), validade: '2025-05-15', responsavel: 'Ana Paula Rocha', margem: 22, obs: 'Inclui mobilização de 90 dias' },
    { id: 'PROP-002', opp_id: 'OPP-002', cliente: 'Cobre & Ouro Mineração S/A', descricao: 'Aditivo CONT-002 – Ampliação Fase 4', valor: 1800000, status: 'Negociação', data: iso('2025-03-01'), validade: '2025-04-30', responsavel: 'Fernanda Costa', margem: 19, obs: '' },
    { id: 'PROP-003', opp_id: 'OPP-004', cliente: 'Ferro Bruto Extração Ltda', descricao: 'Contrato CONT-004 – Desmonte e Carregamento', valor: 3200000, status: 'Aprovada', data: iso('2024-12-15'), validade: '2025-02-28', responsavel: 'Ana Paula Rocha', margem: 21, obs: 'Proposta aprovada – contrato assinado' }
  ];
  localStorage.setItem('fa_propostas_comerciais', JSON.stringify(propostas));

  // ─── 17. Medições v2 ──────────────────────────────
  const medicoesV2 = window.ERP_DATA.medicoes.map(m => ({ ...m, aprovado: m.status === 'Paga', aprovado_por: m.status === 'Paga' ? 'Eng. Paulo Henrique' : '' }));
  localStorage.setItem('fa_medicoes_v2', JSON.stringify(medicoesV2));
  localStorage.setItem('fa_medicoes', JSON.stringify(medicoesV2));

  // ─── 18. Frota v2 ────────────────────────────────
  const frotaV2 = window.ERP_DATA.equipamentos.map(e => ({ ...e, km_total: e.horasAcum * 18, custo_manut_acum: e.id === 'EQP-001' ? 8420 : e.id === 'EQP-002' ? 12800 : 5500 }));
  localStorage.setItem('fa_frota_v2', JSON.stringify(frotaV2));

  // ─── 19. Estoque v2 ───────────────────────────────
  localStorage.setItem('fa_estoque_v2', JSON.stringify(materiais));

  // ─── 20. Histórico de Compras ─────────────────────
  const historicoCompras = [
    { id: 'HC-001', ano_mes: '2025-01', total_pedidos: 3, valor_total: 68400, fornecedores: 3, saving: 2800 },
    { id: 'HC-002', ano_mes: '2025-02', total_pedidos: 5, valor_total: 125600, fornecedores: 5, saving: 4100 },
    { id: 'HC-003', ano_mes: '2025-03', total_pedidos: 8, valor_total: 138800, fornecedores: 6, saving: 6300 }
  ];
  localStorage.setItem('fa_historico_compras', JSON.stringify(historicoCompras));

  // ─── 21. Alcada / Aprovação ───────────────────────
  const alcadaConfig = {
    supervisor: { limite: 5000, pode_aprovar_rc: true, pode_emitir_rfq: false },
    gerente: { limite: 30000, pode_aprovar_rc: true, pode_emitir_rfq: true },
    diretor: { limite: 999999999, pode_aprovar_rc: true, pode_emitir_rfq: true }
  };
  localStorage.setItem('fa_alcada_config', JSON.stringify(alcadaConfig));

  const aprovacaoConfig = {
    niveis: [
      { nivel: 1, cargo: 'Supervisor', limite: 5000, aprovadores: ['COL-003', 'COL-010'] },
      { nivel: 2, cargo: 'Gerente', limite: 30000, aprovadores: ['COL-001', 'COL-002'] },
      { nivel: 3, cargo: 'Diretor', limite: 999999999, aprovadores: ['COL-001'] }
    ]
  };
  localStorage.setItem('fa_aprovacao_config', JSON.stringify(aprovacaoConfig));

  // ─── 22. Logs do sistema ──────────────────────────
  const logs = [
    { id: 'LOG-001', data: iso('2025-03-10'), usuario: 'Marcos Vieira', acao: 'OS-2025-0001 concluída', modulo: 'OS', nivel: 'info' },
    { id: 'LOG-002', data: iso('2025-03-10'), usuario: 'Luciana Barros', acao: 'PED-2025-001 emitido', modulo: 'Compras', nivel: 'info' },
    { id: 'LOG-003', data: iso('2025-03-15'), usuario: 'Marcos Vieira', acao: 'INC-004 registrado – falha freio HD785', modulo: 'SSMA', nivel: 'alerta' },
    { id: 'LOG-004', data: iso('2025-03-21'), usuario: 'Marcos Vieira', acao: 'RC-2025-0003 criada – urgente', modulo: 'Suprimentos', nivel: 'alerta' },
    { id: 'LOG-005', data: iso('2025-03-25'), usuario: 'Ricardo Almeida', acao: 'RFQ-2025-004 aberta para cotação', modulo: 'Procurement', nivel: 'info' },
    { id: 'LOG-006', data: iso('2025-03-28'), usuario: 'Sistema', acao: 'Seed demo v4 carregado', modulo: 'Admin', nivel: 'info' }
  ];
  localStorage.setItem('fa_logs_sistema', JSON.stringify(logs));

  // ─── 23. Contas a Pagar v2 ────────────────────────
  localStorage.setItem('fa_contas_pagar_v2', JSON.stringify(contasPagar));
  localStorage.setItem('fraser_contas_pagar', JSON.stringify(contasPagar));

  // ─── 24. Pedidos v2 ───────────────────────────────
  localStorage.setItem('fa_pedidos_v2', JSON.stringify(pedidos));

  // ─── 25. Contratos cliente ────────────────────────
  const contratosCliente = window.ERP_DATA.contratos.map(c => ({ ...c, contrato_id: c.id }));
  localStorage.setItem('fa_contratos_cliente', JSON.stringify(contratosCliente));
  localStorage.setItem('fraser_contratos', JSON.stringify(contratosCliente));

  // ─── 26. Recebimentos de Medição ─────────────────
  localStorage.setItem('fa_recebimentos', JSON.stringify(recebimentos));

  // ═══════════════════════════════════════════════════════════
  // BLOCO EXTRA v6: Dados completos para testes de integração
  // Módulos: Mapa de Cotação, Fornecedores (completo),
  //          Pedidos (completo), Fluxo de Aprovação RC
  // ═══════════════════════════════════════════════════════════

  // ─── 27. Fornecedores – dados adicionais ─────────────────
  // Adiciona mais fornecedores e atualiza cache com dados completos
  const fornecedoresExtra = [
    { id: 'FOR-011', razao_social: 'ElectroBras Componentes Industriais', cnpj: '23.456.789/0001-01', categoria: 'Material Elétrico', status: 'Ativo', contato: 'Roberta Campos', telefone: '(11) 4123-5500', email: 'comercial@electrobras-comp.com.br', cidade: 'Guarulhos', estado: 'SP', idf_score: 84, homologado: true, prazo_entrega: 7, avaliacao_geral: 'B', limite_credito: 50000, condicao_pagamento: '30 dias', banco: 'Bradesco', agencia: '0412', conta: '12345-6' },
    { id: 'FOR-012', razao_social: 'ProSafety Soluções em SSMA', cnpj: '34.567.890/0001-12', categoria: 'Consultoria SSMA', status: 'Ativo', contato: 'Eng. Fábio Mello', telefone: '(31) 3800-2200', email: 'prosafety@prosafety.com.br', cidade: 'BH', estado: 'MG', idf_score: 90, homologado: true, prazo_entrega: 3, avaliacao_geral: 'A', limite_credito: 80000, condicao_pagamento: '30 dias', banco: 'Itaú', agencia: '0320', conta: '54321-0' },
    { id: 'FOR-013', razao_social: 'MecaFlex Usinagem e Tornearia', cnpj: '45.678.901/0001-23', categoria: 'Serviços de Usinagem', status: 'Ativo', contato: 'Carlos Matos', telefone: '(31) 3456-1100', email: 'orcamento@mecaflex.com.br', cidade: 'Contagem', estado: 'MG', idf_score: 76, homologado: true, prazo_entrega: 12, avaliacao_geral: 'B', limite_credito: 30000, condicao_pagamento: '15 dias', banco: 'Caixa', agencia: '0110', conta: '11111-1' },
    { id: 'FOR-014', razao_social: 'DeltaTech Automação Industrial', cnpj: '56.789.012/0001-34', categoria: 'Automação e Instrumentação', status: 'Homologação', contato: 'Eng. Patrícia Lima', telefone: '(51) 3500-7700', email: 'vendas@deltatech-auto.com.br', cidade: 'Porto Alegre', estado: 'RS', idf_score: 0, homologado: false, prazo_entrega: 20, avaliacao_geral: 'N/A', limite_credito: 0, condicao_pagamento: 'A definir', banco: '', agencia: '', conta: '' },
    { id: 'FOR-015', razao_social: 'AgroQuim Defensivos e Insumos', cnpj: '67.890.123/0001-45', categoria: 'Insumos Químicos', status: 'Suspenso', contato: 'João Vasconcelos', telefone: '(62) 3301-4400', email: 'contato@agroquim.com.br', cidade: 'Goiânia', estado: 'GO', idf_score: 52, homologado: false, prazo_entrega: 14, avaliacao_geral: 'D', limite_credito: 0, condicao_pagamento: 'Suspenso', banco: '', agencia: '', conta: '' }
  ];
  const fornecedoresCompletos = JSON.parse(localStorage.getItem('fa_fornecedores_cache') || '[]');
  // Mescla sem duplicar
  fornecedoresExtra.forEach(fe => { if (!fornecedoresCompletos.find(f => f.id === fe.id)) fornecedoresCompletos.push(fe); });
  // Garante campos completos nos fornecedores já existentes
  fornecedoresCompletos.forEach(f => {
    if (!f.avaliacao_geral) f.avaliacao_geral = f.idf_score >= 90 ? 'A' : f.idf_score >= 75 ? 'B' : f.idf_score >= 60 ? 'C' : f.idf_score >= 1 ? 'D' : 'N/A';
    if (!f.limite_credito) f.limite_credito = f.homologado ? 50000 : 0;
    if (!f.condicao_pagamento) f.condicao_pagamento = '30 dias';
    if (!f.banco) f.banco = '';
    if (!f.tipo) f.tipo = 'Produto/Serviço';
    if (!f.categoria_fiscal) f.categoria_fiscal = 'PJ Nacional';
    if (!f.inscricao_estadual) f.inscricao_estadual = 'Isento';
  });
  localStorage.setItem('fa_fornecedores_cache', JSON.stringify(fornecedoresCompletos));
  localStorage.setItem('fraser_fornecedores', JSON.stringify(fornecedoresCompletos));

  // ─── 28. IDF – Avaliações Adicionais ─────────────
  const idfExtra = [
    { id: 'IDF-007', fornecedor_id: 'FOR-006', fornecedor: 'Aliminas Alimentação Coletiva', data: '2025-03-05', avaliador: 'Simone Lacerda', prazo: 100, qualidade: 72, preco: 70, atendimento: 75, score: 74, obs: 'Cardápio monótono. Solicitação de melhoria registrada.' },
    { id: 'IDF-008', fornecedor_id: 'FOR-007', fornecedor: 'HospedaMinas Alojamentos Ltda', data: '2025-03-10', avaliador: 'Ricardo Almeida', prazo: 100, qualidade: 65, preco: 62, atendimento: 68, score: 68, obs: 'Manutenção do alojamento precária. Notificação enviada.' },
    { id: 'IDF-009', fornecedor_id: 'FOR-009', fornecedor: 'TechDrill Serviços de Perfuração', data: '2025-03-15', avaliador: 'Ana Paula Rocha', prazo: 85, qualidade: 88, preco: 82, atendimento: 90, score: 86, obs: 'Boa experiência técnica, prazo levemente elevado.' },
    { id: 'IDF-010', fornecedor_id: 'FOR-012', fornecedor: 'ProSafety Soluções em SSMA', data: '2025-02-25', avaliador: 'Patrícia Souza', prazo: 92, qualidade: 90, preco: 88, atendimento: 91, score: 90, obs: 'Excelente qualidade nos treinamentos de segurança.' }
  ];
  const idfAtual = JSON.parse(localStorage.getItem('fa_idf_avaliacoes') || '[]');
  idfExtra.forEach(i => { if (!idfAtual.find(x => x.id === i.id)) idfAtual.push(i); });
  localStorage.setItem('fa_idf_avaliacoes', JSON.stringify(idfAtual));

  // ─── 28b. Fornecedores Extras v7 (novos 10 fornecedores) ─────────
  const fornecedoresV7 = [
    { id: 'FOR-016', razao_social: 'SteelMax Aços e Metais Ltda',        cnpj: '71.234.567/0001-11', categoria: 'Materiais Metálicos',    status: 'Ativo',        contato: 'Rodrigo Pinheiro',  telefone: '(31) 3541-8800', email: 'vendas@steelmax.com.br',          cidade: 'Ibirité',        estado: 'MG', idf_score: 83, homologado: true,  prazo_entrega: 8,  avaliacao_geral: 'B', limite_credito: 60000,  condicao_pagamento: '30 dias', banco: 'Itaú',    agencia: '0430', conta: '67890-1', tipo: 'Produto/Serviço', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '123.456.789/0001' },
    { id: 'FOR-017', razao_social: 'AirTec Compressores Industriais',    cnpj: '82.345.678/0001-22', categoria: 'Equipamentos Pneumáticos', status: 'Ativo',        contato: 'Fernanda Queiroz', telefone: '(11) 4002-1122', email: 'comercial@airtec-ind.com.br',     cidade: 'São Paulo',      estado: 'SP', idf_score: 91, homologado: true,  prazo_entrega: 14, avaliacao_geral: 'A', limite_credito: 120000, condicao_pagamento: '30/60 dias', banco: 'Bradesco', agencia: '0521', conta: '11223-4', tipo: 'Produto/Serviço', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '234.567.890/0001' },
    { id: 'FOR-018', razao_social: 'HidroMax Vedações e Mangueiras',     cnpj: '93.456.789/0001-33', categoria: 'Hidráulica e Pneumática',  status: 'Ativo',        contato: 'Alexandre Teles',  telefone: '(31) 3672-4400', email: 'orcamentos@hidromax.com.br',      cidade: 'Belo Horizonte', estado: 'MG', idf_score: 78, homologado: true,  prazo_entrega: 5,  avaliacao_geral: 'B', limite_credito: 40000,  condicao_pagamento: '15 dias', banco: 'BB',      agencia: '0041', conta: '22334-5', tipo: 'Produto/Serviço', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '345.678.901/0001' },
    { id: 'FOR-019', razao_social: 'CordeSul Cabos e Cordoalhas',        cnpj: '14.567.890/0001-44', categoria: 'Cabos e Acessórios',      status: 'Ativo',        contato: 'Daniela Fonseca',  telefone: '(41) 3400-2200', email: 'vendas@cordesul.com.br',          cidade: 'Curitiba',       estado: 'PR', idf_score: 73, homologado: true,  prazo_entrega: 6,  avaliacao_geral: 'B', limite_credito: 25000,  condicao_pagamento: '30 dias', banco: 'Caixa',   agencia: '0312', conta: '33445-6', tipo: 'Produto/Serviço', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '456.789.012/0001' },
    { id: 'FOR-020', razao_social: 'BrasTrans Logística Especializada',  cnpj: '25.678.901/0001-55', categoria: 'Transporte e Logística',  status: 'Ativo',        contato: 'Maurício Alves',   telefone: '(34) 3831-5500', email: 'operacoes@brastrans.com.br',      cidade: 'Uberlândia',     estado: 'MG', idf_score: 85, homologado: true,  prazo_entrega: 2,  avaliacao_geral: 'B', limite_credito: 80000,  condicao_pagamento: '30 dias', banco: 'Santander', agencia: '0601', conta: '44556-7', tipo: 'Serviço', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '567.890.123/0001' },
    { id: 'FOR-021', razao_social: 'NovaTec Instrumentação e Medição',   cnpj: '36.789.012/0001-66', categoria: 'Instrumentação Industrial',status: 'Homologação',  contato: 'Igor Sandoval',    telefone: '(11) 3855-9900', email: 'novatas.inst@novatec.com.br',     cidade: 'Guarulhos',      estado: 'SP', idf_score: 0,  homologado: false, prazo_entrega: 20, avaliacao_geral: 'N/A', limite_credito: 0,      condicao_pagamento: 'A definir', banco: '', agencia: '', conta: '', tipo: 'Produto/Serviço', categoria_fiscal: 'PJ Nacional', inscricao_estadual: 'Isento' },
    { id: 'FOR-022', razao_social: 'RefinaçãoSul Óleos Especiais',       cnpj: '47.890.123/0001-77', categoria: 'Óleos e Lubrificantes',   status: 'Ativo',        contato: 'Silvia Magalhães', telefone: '(51) 3311-8800', email: 'comercial@refinacaosul.com.br',  cidade: 'Canoas',         estado: 'RS', idf_score: 88, homologado: true,  prazo_entrega: 4,  avaliacao_geral: 'B', limite_credito: 55000,  condicao_pagamento: '30 dias', banco: 'Itaú',    agencia: '0712', conta: '55667-8', tipo: 'Produto',  categoria_fiscal: 'PJ Nacional', inscricao_estadual: '678.901.234/0001' },
    { id: 'FOR-023', razao_social: 'ConstruMin Serviços de Mineração',   cnpj: '58.901.234/0001-88', categoria: 'Serviços de Mineração',   status: 'Ativo',        contato: 'Bruno Lacerda',    telefone: '(31) 3940-1100', email: 'contratos@construmin.com.br',     cidade: 'Nova Lima',      estado: 'MG', idf_score: 94, homologado: true,  prazo_entrega: 30, avaliacao_geral: 'A', limite_credito: 200000, condicao_pagamento: '30/60/90 dias', banco: 'BB', agencia: '0042', conta: '66778-9', tipo: 'Serviço', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '789.012.345/0001' },
    { id: 'FOR-024', razao_social: 'BioMax Meio Ambiente e Saneamento',  cnpj: '69.012.345/0001-99', categoria: 'Meio Ambiente / SSMA',    status: 'Em Homologação', contato: 'Carolina Reis',   telefone: '(31) 3200-4400', email: 'contato@biomaxambiental.com.br', cidade: 'Belo Horizonte', estado: 'MG', idf_score: 0,  homologado: false, prazo_entrega: 15, avaliacao_geral: 'N/A', limite_credito: 0,      condicao_pagamento: 'A definir', banco: '', agencia: '', conta: '', tipo: 'Serviço', categoria_fiscal: 'PJ Nacional', inscricao_estadual: 'Isento' },
    { id: 'FOR-025', razao_social: 'FiltroMaster Filtragem Industrial',  cnpj: '70.123.456/0001-00', categoria: 'Filtros Industriais',     status: 'Ativo',        contato: 'Henrique Borges',  telefone: '(11) 4050-6600', email: 'vendas@filtromaster.com.br',      cidade: 'São Bernardo',   estado: 'SP', idf_score: 80, homologado: true,  prazo_entrega: 7,  avaliacao_geral: 'B', limite_credito: 35000,  condicao_pagamento: '30 dias', banco: 'Bradesco', agencia: '0831', conta: '77889-0', tipo: 'Produto',  categoria_fiscal: 'PJ Nacional', inscricao_estadual: '890.123.456/0001' }
  ];
  const fornecedoresCompletoV7 = JSON.parse(localStorage.getItem('fa_fornecedores_cache') || '[]');
  fornecedoresV7.forEach(fe => { if (!fornecedoresCompletoV7.find(f => f.id === fe.id)) fornecedoresCompletoV7.push(fe); });
  localStorage.setItem('fa_fornecedores_cache', JSON.stringify(fornecedoresCompletoV7));
  localStorage.setItem('fraser_fornecedores', JSON.stringify(fornecedoresCompletoV7));

  // ─── 28d. Fornecedores v8 – 15 novos fornecedores fictícios ──────────────
  const fornecedoresV8 = [
    // Segmento: Soldagem e Corte
    { id: 'FOR-026', razao_social: 'SoldaMax Equipamentos e Consumíveis', cnpj: '81.234.567/0001-10', categoria: 'Soldagem e Corte', status: 'Ativo', contato: 'Tiago Medeiros', telefone: '(31) 3344-9900', email: 'vendas@soldamax.com.br', cidade: 'Sabará', estado: 'MG', idf_score: 82, homologado: true, prazo_entrega: 5, avaliacao_geral: 'B', limite_credito: 45000, condicao_pagamento: '30 dias', banco: 'Itaú', agencia: '0540', conta: '12345-7', tipo: 'Produto', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '111.222.333/0001' },
    // Segmento: Segurança Eletrônica
    { id: 'FOR-027', razao_social: 'VigilMax Sistemas de Segurança Ltda', cnpj: '92.345.678/0001-21', categoria: 'Segurança Eletrônica', status: 'Ativo', contato: 'Mariana Esteves', telefone: '(11) 3210-4455', email: 'projetos@vigilmax.com.br', cidade: 'São Paulo', estado: 'SP', idf_score: 77, homologado: true, prazo_entrega: 10, avaliacao_geral: 'B', limite_credito: 60000, condicao_pagamento: '30/60 dias', banco: 'Bradesco', agencia: '0621', conta: '23456-8', tipo: 'Serviço', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '222.333.444/0001' },
    // Segmento: Tratamento de Água
    { id: 'FOR-028', razao_social: 'AquaPura Tratamento Industrial', cnpj: '13.456.789/0001-32', categoria: 'Tratamento de Água', status: 'Ativo', contato: 'Claudio Neves', telefone: '(41) 3290-1122', email: 'comercial@aquapura-ind.com.br', cidade: 'Curitiba', estado: 'PR', idf_score: 89, homologado: true, prazo_entrega: 7, avaliacao_geral: 'B', limite_credito: 75000, condicao_pagamento: '30 dias', banco: 'BB', agencia: '0055', conta: '34567-9', tipo: 'Serviço/Produto', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '333.444.555/0001' },
    // Segmento: Uniformes e EPIs Têxteis
    { id: 'FOR-029', razao_social: 'UniTex Uniformes Profissionais', cnpj: '24.567.890/0001-43', categoria: 'Uniformes e Vestuário', status: 'Ativo', contato: 'Luciana Ferreira', telefone: '(31) 3560-7788', email: 'pedidos@unitex.com.br', cidade: 'Belo Horizonte', estado: 'MG', idf_score: 71, homologado: true, prazo_entrega: 15, avaliacao_geral: 'B', limite_credito: 20000, condicao_pagamento: '30 dias', banco: 'Caixa', agencia: '0140', conta: '45678-0', tipo: 'Produto', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '444.555.666/0001' },
    // Segmento: Aluguel de Equipamentos Pesados
    { id: 'FOR-030', razao_social: 'LocaHeavy Locação de Máquinas', cnpj: '35.678.901/0001-54', categoria: 'Locação de Equipamentos', status: 'Ativo', contato: 'Roberto Assis', telefone: '(34) 3820-3300', email: 'locacao@locaheavy.com.br', cidade: 'Uberlândia', estado: 'MG', idf_score: 87, homologado: true, prazo_entrega: 3, avaliacao_geral: 'B', limite_credito: 150000, condicao_pagamento: '30 dias', banco: 'Santander', agencia: '0730', conta: '56789-1', tipo: 'Serviço', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '555.666.777/0001' },
    // Segmento: Ferramentas e Abrasivos
    { id: 'FOR-031', razao_social: 'FerraTool Ferramentas Industriais', cnpj: '46.789.012/0001-65', categoria: 'Ferramentas e Abrasivos', status: 'Ativo', contato: 'Antônio Vilas', telefone: '(51) 3365-5544', email: 'comercial@ferratool.com.br', cidade: 'Caxias do Sul', estado: 'RS', idf_score: 79, homologado: true, prazo_entrega: 6, avaliacao_geral: 'B', limite_credito: 28000, condicao_pagamento: '15/30 dias', banco: 'Itaú', agencia: '0832', conta: '67890-2', tipo: 'Produto', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '666.777.888/0001' },
    // Segmento: Serviços de TI
    { id: 'FOR-032', razao_social: 'DataMine TI e Sistemas Ltda', cnpj: '57.890.123/0001-76', categoria: 'Tecnologia da Informação', status: 'Ativo', contato: 'Eng. Rafael Santos', telefone: '(11) 4102-8800', email: 'suporte@datamine-ti.com.br', cidade: 'Campinas', estado: 'SP', idf_score: 92, homologado: true, prazo_entrega: 5, avaliacao_geral: 'A', limite_credito: 100000, condicao_pagamento: '30 dias', banco: 'Bradesco', agencia: '0943', conta: '78901-3', tipo: 'Serviço', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '777.888.999/0001' },
    // Segmento: Calibração e Metrologia
    { id: 'FOR-033', razao_social: 'MetroCert Calibração e Ensaios', cnpj: '68.901.234/0001-87', categoria: 'Metrologia e Calibração', status: 'Ativo', contato: 'Dra. Aline Borba', telefone: '(31) 3740-2211', email: 'laboratorio@metrocert.com.br', cidade: 'Contagem', estado: 'MG', idf_score: 96, homologado: true, prazo_entrega: 10, avaliacao_geral: 'A', limite_credito: 50000, condicao_pagamento: '30 dias', banco: 'BB', agencia: '0058', conta: '89012-4', tipo: 'Serviço', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '888.999.000/0001' },
    // Segmento: Química Industrial
    { id: 'FOR-034', razao_social: 'QuimBras Produtos Químicos Industriais', cnpj: '79.012.345/0001-98', categoria: 'Químicos Industriais', status: 'Ativo', contato: 'Viviane Carmo', telefone: '(11) 4080-1144', email: 'vendas@quimbras.com.br', cidade: 'Santo André', estado: 'SP', idf_score: 83, homologado: true, prazo_entrega: 8, avaliacao_geral: 'B', limite_credito: 65000, condicao_pagamento: '30 dias', banco: 'Itaú', agencia: '1040', conta: '90123-5', tipo: 'Produto', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '900.111.222/0001' },
    // Segmento: Borrachas e Polímeros
    { id: 'FOR-035', razao_social: 'PoliMax Borrachas e Polímeros', cnpj: '80.123.456/0001-09', categoria: 'Borrachas e Polímeros', status: 'Ativo', contato: 'Jorge Tavares', telefone: '(13) 3219-6677', email: 'orcamento@polimax.com.br', cidade: 'Santos', estado: 'SP', idf_score: 75, homologado: true, prazo_entrega: 9, avaliacao_geral: 'B', limite_credito: 30000, condicao_pagamento: '30 dias', banco: 'Caixa', agencia: '0219', conta: '01234-6', tipo: 'Produto', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '011.222.333/0001' },
    // Segmento: Manutenção Predial
    { id: 'FOR-036', razao_social: 'PredialSul Manutenção e Conservação', cnpj: '91.234.567/0001-10', categoria: 'Manutenção Predial', status: 'Homologação', contato: 'Marcos Pimentel', telefone: '(51) 3390-8877', email: 'servicos@predialsul.com.br', cidade: 'Porto Alegre', estado: 'RS', idf_score: 0, homologado: false, prazo_entrega: 5, avaliacao_geral: 'N/A', limite_credito: 0, condicao_pagamento: 'A definir', banco: '', agencia: '', conta: '', tipo: 'Serviço', categoria_fiscal: 'PJ Nacional', inscricao_estadual: 'Isento' },
    // Segmento: Engenharia Civil / Obras
    { id: 'FOR-037', razao_social: 'EngeMinas Construção e Infraestrutura', cnpj: '12.345.678/0001-11', categoria: 'Engenharia Civil', status: 'Ativo', contato: 'Eng. Paulo Henriques', telefone: '(31) 3620-4400', email: 'obras@engeminas.com.br', cidade: 'Belo Horizonte', estado: 'MG', idf_score: 88, homologado: true, prazo_entrega: 30, avaliacao_geral: 'B', limite_credito: 300000, condicao_pagamento: '30/60/90 dias', banco: 'BB', agencia: '0060', conta: '12345-8', tipo: 'Serviço', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '122.233.344/0001' },
    // Segmento: Descarte e Resíduos
    { id: 'FOR-038', razao_social: 'EcoResiduos Gestão Ambiental', cnpj: '23.456.789/0001-22', categoria: 'Gestão de Resíduos', status: 'Ativo', contato: 'Sandra Reis', telefone: '(31) 3780-5500', email: 'coleta@ecoresiduos.com.br', cidade: 'Nova Lima', estado: 'MG', idf_score: 90, homologado: true, prazo_entrega: 2, avaliacao_geral: 'A', limite_credito: 40000, condicao_pagamento: '30 dias', banco: 'Santander', agencia: '0830', conta: '23456-9', tipo: 'Serviço', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '233.344.455/0001' },
    // Segmento: Válvulas e Tubulações
    { id: 'FOR-039', razao_social: 'ValveFit Válvulas e Conexões Industriais', cnpj: '34.567.890/0001-33', categoria: 'Válvulas e Tubulações', status: 'Em Homologação', contato: 'Nelson Barretto', telefone: '(11) 4033-7700', email: 'vendas@valvefit.com.br', cidade: 'Mogi das Cruzes', estado: 'SP', idf_score: 0, homologado: false, prazo_entrega: 12, avaliacao_geral: 'N/A', limite_credito: 0, condicao_pagamento: 'A definir', banco: '', agencia: '', conta: '', tipo: 'Produto', categoria_fiscal: 'PJ Nacional', inscricao_estadual: 'Isento' },
    // Segmento: Recrutamento e RH
    { id: 'FOR-040', razao_social: 'TalentosMG Recrutamento e Seleção', cnpj: '45.678.901/0001-44', categoria: 'Recursos Humanos', status: 'Ativo', contato: 'Cristina Vaz', telefone: '(31) 3430-6600', email: 'rh@talentosmg.com.br', cidade: 'Belo Horizonte', estado: 'MG', idf_score: 85, homologado: true, prazo_entrega: 20, avaliacao_geral: 'B', limite_credito: 80000, condicao_pagamento: '30 dias', banco: 'Itaú', agencia: '0660', conta: '34567-0', tipo: 'Serviço', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '344.455.566/0001' }
  ];
  const fornecedoresCompletoV8 = JSON.parse(localStorage.getItem('fa_fornecedores_cache') || '[]');
  fornecedoresV8.forEach(fe => { if (!fornecedoresCompletoV8.find(f => f.id === fe.id)) fornecedoresCompletoV8.push(fe); });
  localStorage.setItem('fa_fornecedores_cache', JSON.stringify(fornecedoresCompletoV8));
  localStorage.setItem('fraser_fornecedores', JSON.stringify(fornecedoresCompletoV8));

  // ─── 28f. Fornecedores v9 (FOR-041 a FOR-055) ───────────────────────────────
  const fornecedoresV9 = [
    // Segmento: Manutenção Industrial
    { id: 'FOR-041', razao_social: 'TurbineServ Manutenção de Turbinas',    cnpj: '56.789.012/0001-55', categoria: 'Manutenção de Turbinas',    status: 'Ativo',          contato: 'Eng. Eduardo Campos',  telefone: '(19) 3322-7744', email: 'manutencao@turbineserv.com.br',     cidade: 'Campinas',       estado: 'SP', idf_score: 91, homologado: true,  prazo_entrega: 14, avaliacao_geral: 'A', limite_credito: 120000, condicao_pagamento: '30/60 dias',    banco: 'Bradesco',  agencia: '0943', conta: '10203-4', tipo: 'Serviço',         categoria_fiscal: 'PJ Nacional', inscricao_estadual: '456.789.012/0001' },
    // Segmento: Elétrica Industrial
    { id: 'FOR-042', razao_social: 'AmpereMax Instalações Elétricas',       cnpj: '67.890.123/0001-66', categoria: 'Elétrica Industrial',       status: 'Ativo',          contato: 'Roberto Freitas',      telefone: '(31) 3510-8822', email: 'projetos@amperemax.com.br',         cidade: 'Betim',          estado: 'MG', idf_score: 86, homologado: true,  prazo_entrega: 7,  avaliacao_geral: 'B', limite_credito: 90000,  condicao_pagamento: '30 dias',       banco: 'Itaú',      agencia: '0321', conta: '20304-5', tipo: 'Serviço',         categoria_fiscal: 'PJ Nacional', inscricao_estadual: '567.890.123/0001' },
    // Segmento: Automação Hidráulica
    { id: 'FOR-043', razao_social: 'HydroFlex Sistemas Hidráulicos',        cnpj: '78.901.234/0001-77', categoria: 'Hidráulica Industrial',     status: 'Ativo',          contato: 'Fábio Drummond',       telefone: '(31) 3780-3311', email: 'vendas@hydroflex.com.br',           cidade: 'Contagem',       estado: 'MG', idf_score: 78, homologado: true,  prazo_entrega: 5,  avaliacao_geral: 'B', limite_credito: 55000,  condicao_pagamento: '30 dias',       banco: 'BB',        agencia: '0047', conta: '30405-6', tipo: 'Produto/Serviço', categoria_fiscal: 'PJ Nacional', inscricao_estadual: '678.901.234/0001' },
    // Segmento: Peças de Reposição Pesada
    { id: 'FOR-044', razao_social: 'MegaParts Peças para Equipamentos',     cnpj: '89.012.345/0001-88', categoria: 'Peças para Máquinas Pesadas', status: 'Ativo',        contato: 'Cláudia Magalhães',    telefone: '(34) 3870-6655', email: 'comercial@megaparts.com.br',        cidade: 'Uberlândia',     estado: 'MG', idf_score: 84, homologado: true,  prazo_entrega: 10, avaliacao_geral: 'B', limite_credito: 100000, condicao_pagamento: '30 dias',       banco: 'Santander', agencia: '0752', conta: '40506-7', tipo: 'Produto',         categoria_fiscal: 'PJ Nacional', inscricao_estadual: '789.012.345/0001' },
    // Segmento: Telecomunicações
    { id: 'FOR-045', razao_social: 'RadioComm Telecomunicações Industriais',cnpj: '90.123.456/0001-99', categoria: 'Telecomunicações',          status: 'Ativo',          contato: 'Eng. Marcela Torres',  telefone: '(11) 4070-5544', email: 'projetos@radiocomm.com.br',         cidade: 'São Paulo',      estado: 'SP', idf_score: 82, homologado: true,  prazo_entrega: 12, avaliacao_geral: 'B', limite_credito: 70000,  condicao_pagamento: '30/60 dias',    banco: 'Bradesco',  agencia: '1031', conta: '50607-8', tipo: 'Serviço',         categoria_fiscal: 'PJ Nacional', inscricao_estadual: '890.123.456/0001' },
    // Segmento: Iluminação Industrial
    { id: 'FOR-046', razao_social: 'LumPro Iluminação Industrial Ltda',     cnpj: '11.234.567/0001-00', categoria: 'Iluminação Industrial',     status: 'Ativo',          contato: 'Alberto Chaves',       telefone: '(41) 3322-9911', email: 'vendas@lumpro.com.br',              cidade: 'Curitiba',       estado: 'PR', idf_score: 73, homologado: true,  prazo_entrega: 8,  avaliacao_geral: 'B', limite_credito: 40000,  condicao_pagamento: '30 dias',       banco: 'Caixa',     agencia: '0041', conta: '60708-9', tipo: 'Produto',         categoria_fiscal: 'PJ Nacional', inscricao_estadual: '901.234.567/0001' },
    // Segmento: Consultoria Jurídica
    { id: 'FOR-047', razao_social: 'JurisMinas Consultoria Jurídica',       cnpj: '22.345.678/0001-11', categoria: 'Consultoria Jurídica',      status: 'Ativo',          contato: 'Dra. Helena Figueiredo', telefone: '(31) 3260-1100', email: 'atendimento@jurisminas.com.br',   cidade: 'Belo Horizonte', estado: 'MG', idf_score: 93, homologado: true,  prazo_entrega: 5,  avaliacao_geral: 'A', limite_credito: 50000,  condicao_pagamento: '30 dias',       banco: 'Itaú',      agencia: '0330', conta: '70809-0', tipo: 'Serviço',         categoria_fiscal: 'PJ Nacional', inscricao_estadual: 'Isento' },
    // Segmento: Análises Laboratoriais
    { id: 'FOR-048', razao_social: 'LabGeoChem Análises Geoquímicas',       cnpj: '33.456.789/0001-22', categoria: 'Laboratório e Análises',    status: 'Ativo',          contato: 'Dra. Raquel Cunha',    telefone: '(31) 3420-5544', email: 'laboratorio@labgeochem.com.br',     cidade: 'Ouro Preto',     estado: 'MG', idf_score: 95, homologado: true,  prazo_entrega: 7,  avaliacao_geral: 'A', limite_credito: 60000,  condicao_pagamento: '30 dias',       banco: 'BB',        agencia: '0061', conta: '80900-1', tipo: 'Serviço',         categoria_fiscal: 'PJ Nacional', inscricao_estadual: '012.345.678/0001' },
    // Segmento: Transportes Especiais
    { id: 'FOR-049', razao_social: 'TransPeso Cargas Especiais Ltda',       cnpj: '44.567.890/0001-33', categoria: 'Transporte de Carga Pesada', status: 'Ativo',         contato: 'Márcio Barbosa',       telefone: '(31) 3850-7700', email: 'operacoes@transpeso.com.br',        cidade: 'Betim',          estado: 'MG', idf_score: 80, homologado: true,  prazo_entrega: 3,  avaliacao_geral: 'B', limite_credito: 200000, condicao_pagamento: '30 dias',       banco: 'Bradesco',  agencia: '0851', conta: '91011-2', tipo: 'Serviço',         categoria_fiscal: 'PJ Nacional', inscricao_estadual: '123.456.789/0001' },
    // Segmento: Comunicação e Marketing
    { id: 'FOR-050', razao_social: 'MediaMinas Comunicação Corporativa',    cnpj: '55.678.901/0001-44', categoria: 'Comunicação e Marketing',   status: 'Ativo',          contato: 'Priscila Andrade',     telefone: '(31) 3170-3322', email: 'contato@mediaminas.com.br',         cidade: 'Belo Horizonte', estado: 'MG', idf_score: 77, homologado: true,  prazo_entrega: 10, avaliacao_geral: 'B', limite_credito: 30000,  condicao_pagamento: '30 dias',       banco: 'Santander', agencia: '0930', conta: '11223-3', tipo: 'Serviço',         categoria_fiscal: 'PJ Nacional', inscricao_estadual: 'Isento' },
    // Segmento: Tecnologia – TI de Campo
    { id: 'FOR-051', razao_social: 'FieldTech Suporte e Infraestrutura TI', cnpj: '66.789.012/0001-55', categoria: 'Suporte de TI',             status: 'Ativo',          contato: 'Eng. Leandro Pinto',   telefone: '(11) 4011-5533', email: 'suporte@fieldtech.com.br',          cidade: 'Guarulhos',      estado: 'SP', idf_score: 88, homologado: true,  prazo_entrega: 2,  avaliacao_geral: 'B', limite_credito: 45000,  condicao_pagamento: '30 dias',       banco: 'Itaú',      agencia: '0443', conta: '22334-4', tipo: 'Serviço',         categoria_fiscal: 'PJ Nacional', inscricao_estadual: '234.567.890/0001' },
    // Segmento: Em Homologação (sem IDF)
    { id: 'FOR-052', razao_social: 'RoboMin Automação e Robótica',          cnpj: '77.890.123/0001-66', categoria: 'Robótica Industrial',       status: 'Em Homologação', contato: 'Dr. Felipe Drummond',  telefone: '(31) 3610-4400', email: 'comercial@robotmin.com.br',         cidade: 'Belo Horizonte', estado: 'MG', idf_score: 0,  homologado: false, prazo_entrega: 20, avaliacao_geral: 'N/A', limite_credito: 0, condicao_pagamento: 'A definir',     banco: '',          agencia: '',     conta: '',        tipo: 'Produto/Serviço', categoria_fiscal: 'PJ Nacional', inscricao_estadual: 'Isento' },
    // Segmento: Explosivos / Detonação
    { id: 'FOR-053', razao_social: 'ExploBras Serviços de Desmonte',        cnpj: '88.901.234/0001-77', categoria: 'Explosivos e Desmonte',     status: 'Ativo',          contato: 'Eng. Renato Guimarães',telefone: '(31) 3930-8844', email: 'operacoes@explobras.com.br',        cidade: 'Congonhas',      estado: 'MG', idf_score: 89, homologado: true,  prazo_entrega: 15, avaliacao_geral: 'B', limite_credito: 500000, condicao_pagamento: '30/60/90 dias', banco: 'BB',        agencia: '0062', conta: '33445-5', tipo: 'Serviço',         categoria_fiscal: 'PJ Nacional', inscricao_estadual: '345.678.901/0001' },
    // Segmento: Em Homologação – Locação Veicular
    { id: 'FOR-054', razao_social: 'MotorFrota Locação Veicular',           cnpj: '99.012.345/0001-88', categoria: 'Locação de Veículos',       status: 'Homologação',    contato: 'André Monteiro',       telefone: '(34) 3841-7700', email: 'locacao@motorfrota.com.br',         cidade: 'Uberlândia',     estado: 'MG', idf_score: 0,  homologado: false, prazo_entrega: 1,  avaliacao_geral: 'N/A', limite_credito: 0, condicao_pagamento: 'A definir',     banco: '',          agencia: '',     conta: '',        tipo: 'Serviço',         categoria_fiscal: 'PJ Nacional', inscricao_estadual: 'Isento' },
    // Segmento: Saúde Ocupacional
    { id: 'FOR-055', razao_social: 'ClínicaMinas Saúde Ocupacional',        cnpj: '10.123.456/0001-99', categoria: 'Saúde Ocupacional',         status: 'Ativo',          contato: 'Dr. Thiago Mendes',    telefone: '(31) 3270-6600', email: 'saudeocupacional@clinicaminas.com.br', cidade: 'Belo Horizonte', estado: 'MG', idf_score: 94, homologado: true, prazo_entrega: 3, avaliacao_geral: 'A', limite_credito: 60000,  condicao_pagamento: '30 dias',       banco: 'Bradesco',  agencia: '0961', conta: '44556-6', tipo: 'Serviço',         categoria_fiscal: 'PJ Nacional', inscricao_estadual: 'Isento' }
  ];
  const fornecedoresCompletoV9 = JSON.parse(localStorage.getItem('fa_fornecedores_cache') || '[]');
  fornecedoresV9.forEach(fe => { if (!fornecedoresCompletoV9.find(f => f.id === fe.id)) fornecedoresCompletoV9.push(fe); });
  localStorage.setItem('fa_fornecedores_cache', JSON.stringify(fornecedoresCompletoV9));
  localStorage.setItem('fraser_fornecedores', JSON.stringify(fornecedoresCompletoV9));

  // ─── 28g. IDF – Avaliações v9 (novos fornecedores FOR-041 a FOR-055) ────────
  const idfV9 = [
    // FOR-041 TurbineServ
    { id: 'IDF-036', fornecedor_id: 'FOR-041', fornecedor: 'TurbineServ Manutenção de Turbinas', data: '2025-03-28', avaliador: 'Eng. Eduardo Campos', tipo: 1, categoria: 1,
      scores: { gen_0: 5, gen_1: 4, gen_2: 5, gen_3: 4, gen_4: 5, serv_0: 5, serv_1: 4, serv_2: 5, serv_3: 4, serv_4: 4 },
      prazo: 90, qualidade: 93, preco: 88, atendimento: 92, score: 91,
      obs: 'Excelente equipe técnica especializada. Turbinas revisadas dentro do prazo com alta precisão.' },
    // FOR-042 AmpereMax
    { id: 'IDF-037', fornecedor_id: 'FOR-042', fornecedor: 'AmpereMax Instalações Elétricas', data: '2025-03-15', avaliador: 'Carlos Mendes', tipo: 1, categoria: 2,
      scores: { gen_0: 4, gen_1: 4, gen_2: 4, gen_3: 4, gen_4: 5, serv_0: 4, serv_1: 4, serv_2: 4, serv_3: 5, serv_4: 4 },
      prazo: 84, qualidade: 87, preco: 83, atendimento: 88, score: 86,
      obs: 'Equipe habilitada NR-10. Instalações de alta qualidade e conformidade com normas.' },
    // FOR-043 HydroFlex
    { id: 'IDF-038', fornecedor_id: 'FOR-043', fornecedor: 'HydroFlex Sistemas Hidráulicos', data: '2025-02-20', avaliador: 'Ricardo Almeida', tipo: 3, categoria: 3,
      scores: { gen_0: 4, gen_1: 4, gen_2: 3, gen_3: 4, gen_4: 4, mat_0: 4, mat_1: 3, mat_2: 4, mat_3: 4, mat_4: 3 },
      prazo: 76, qualidade: 79, preco: 77, atendimento: 78, score: 78,
      obs: 'Mangueiras e conexões de boa qualidade. Prazo de entrega de kits customizados pode melhorar.' },
    // FOR-044 MegaParts
    { id: 'IDF-039', fornecedor_id: 'FOR-044', fornecedor: 'MegaParts Peças para Equipamentos', data: '2025-02-28', avaliador: 'Ana Paula Rocha', tipo: 3, categoria: 2,
      scores: { gen_0: 4, gen_1: 4, gen_2: 4, gen_3: 4, gen_4: 4, mat_0: 4, mat_1: 4, mat_2: 4, mat_3: 4, mat_4: 3 },
      prazo: 82, qualidade: 85, preco: 83, atendimento: 84, score: 84,
      obs: 'Catálogo amplo de peças. Disponibilidade de itens críticos garantida em estoque.' },
    // FOR-045 RadioComm
    { id: 'IDF-040', fornecedor_id: 'FOR-045', fornecedor: 'RadioComm Telecomunicações Industriais', data: '2025-03-05', avaliador: 'Diego Fonseca', tipo: 1, categoria: 2,
      scores: { gen_0: 4, gen_1: 4, gen_2: 4, gen_3: 4, gen_4: 4, serv_0: 4, serv_1: 4, serv_2: 4, serv_3: 4, serv_4: 3 },
      prazo: 80, qualidade: 83, preco: 81, atendimento: 83, score: 82,
      obs: 'Sistema de rádio P25 implantado com sucesso. Cobertura atende 98% da área da mina.' },
    // FOR-046 LumPro
    { id: 'IDF-041', fornecedor_id: 'FOR-046', fornecedor: 'LumPro Iluminação Industrial Ltda', data: '2025-01-25', avaliador: 'Patrícia Souza', tipo: 3, categoria: 3,
      scores: { gen_0: 3, gen_1: 4, gen_2: 3, gen_3: 4, gen_4: 4, mat_0: 4, mat_1: 3, mat_2: 3, mat_3: 4, mat_4: 3 },
      prazo: 70, qualidade: 74, preco: 73, atendimento: 74, score: 73,
      obs: 'Luminárias LED de boa eficiência energética. Prazo de garantia a revisar.' },
    // FOR-047 JurisMinas
    { id: 'IDF-042', fornecedor_id: 'FOR-047', fornecedor: 'JurisMinas Consultoria Jurídica', data: '2025-03-18', avaliador: 'Simone Lacerda', tipo: 1, categoria: 1,
      scores: { gen_0: 5, gen_1: 5, gen_2: 4, gen_3: 5, gen_4: 4, serv_0: 5, serv_1: 5, serv_2: 4, serv_3: 5, serv_4: 4 },
      prazo: 92, qualidade: 94, preco: 91, atendimento: 93, score: 93,
      obs: 'Pareceres jurídicos precisos e entregues no prazo. Equipe especializada em direito minerário.' },
    // FOR-048 LabGeoChem
    { id: 'IDF-043', fornecedor_id: 'FOR-048', fornecedor: 'LabGeoChem Análises Geoquímicas', data: '2025-03-22', avaliador: 'Carlos Mendes', tipo: 1, categoria: 1,
      scores: { gen_0: 5, gen_1: 5, gen_2: 4, gen_3: 5, gen_4: 5, serv_0: 5, serv_1: 5, serv_2: 5, serv_3: 4, serv_4: 5 },
      prazo: 94, qualidade: 96, preco: 93, atendimento: 95, score: 95,
      obs: 'Laboratório acreditado INMETRO. Laudos com alto rigor técnico e rastreabilidade.' },
    // FOR-049 TransPeso
    { id: 'IDF-044', fornecedor_id: 'FOR-049', fornecedor: 'TransPeso Cargas Especiais Ltda', data: '2025-02-10', avaliador: 'José Rodrigues', tipo: 1, categoria: 2,
      scores: { gen_0: 4, gen_1: 4, gen_2: 4, gen_3: 4, gen_4: 4, serv_0: 4, serv_1: 4, serv_2: 4, serv_3: 4, serv_4: 3 },
      prazo: 79, qualidade: 81, preco: 79, atendimento: 80, score: 80,
      obs: 'Transporte de equipamentos pesados realizado com segurança e dentro do prazo.' },
    // FOR-050 MediaMinas
    { id: 'IDF-045', fornecedor_id: 'FOR-050', fornecedor: 'MediaMinas Comunicação Corporativa', data: '2025-02-15', avaliador: 'Luciana Barros', tipo: 1, categoria: 3,
      scores: { gen_0: 4, gen_1: 4, gen_2: 3, gen_3: 4, gen_4: 4, serv_0: 4, serv_1: 3, serv_2: 4, serv_3: 4, serv_4: 3 },
      prazo: 75, qualidade: 78, preco: 76, atendimento: 78, score: 77,
      obs: 'Material de comunicação interna de boa qualidade. Prazos de criação poderiam ser menores.' },
    // FOR-051 FieldTech
    { id: 'IDF-046', fornecedor_id: 'FOR-051', fornecedor: 'FieldTech Suporte e Infraestrutura TI', data: '2025-03-10', avaliador: 'Ana Paula Rocha', tipo: 1, categoria: 1,
      scores: { gen_0: 4, gen_1: 4, gen_2: 5, gen_3: 4, gen_4: 4, serv_0: 5, serv_1: 4, serv_2: 4, serv_3: 4, serv_4: 5 },
      prazo: 86, qualidade: 89, preco: 86, atendimento: 90, score: 88,
      obs: 'SLA de atendimento cumprido. Suporte remoto e on-site eficiente para equipamentos de campo.' },
    // FOR-053 ExploBras
    { id: 'IDF-047', fornecedor_id: 'FOR-053', fornecedor: 'ExploBras Serviços de Desmonte', data: '2025-03-25', avaliador: 'Diego Fonseca', tipo: 1, categoria: 1,
      scores: { gen_0: 4, gen_1: 5, gen_2: 4, gen_3: 5, gen_4: 4, serv_0: 4, serv_1: 5, serv_2: 4, serv_3: 5, serv_4: 4 },
      prazo: 88, qualidade: 90, preco: 87, atendimento: 90, score: 89,
      obs: 'Operações de desmonte controlado com segurança exemplar. Documentação IBAMA em dia.' },
    // FOR-055 ClínicaMinas
    { id: 'IDF-048', fornecedor_id: 'FOR-055', fornecedor: 'ClínicaMinas Saúde Ocupacional', data: '2025-03-30', avaliador: 'Simone Lacerda', tipo: 1, categoria: 1,
      scores: { gen_0: 5, gen_1: 5, gen_2: 4, gen_3: 5, gen_4: 5, serv_0: 5, serv_1: 5, serv_2: 4, serv_3: 5, serv_4: 5 },
      prazo: 93, qualidade: 95, preco: 92, atendimento: 95, score: 94,
      obs: 'Atendimento médico e exames ASO realizados com agilidade. PCMSO atualizado e em conformidade.' }
    // FOR-052 RoboMin e FOR-054 MotorFrota → Em Homologação, aguardando primeira avaliação IDF
  ];
  const idfAtualV9 = JSON.parse(localStorage.getItem('fa_idf_avaliacoes') || '[]');
  idfV9.forEach(i => { if (!idfAtualV9.find(x => x.id === i.id)) idfAtualV9.push(i); });
  localStorage.setItem('fa_idf_avaliacoes', JSON.stringify(idfAtualV9));

  // ─── 28e. IDF – Avaliações v8 (novos fornecedores FOR-026 a FOR-040) ────────
  const idfV8 = [
    // FOR-026 SoldaMax
    { id: 'IDF-023', fornecedor_id: 'FOR-026', fornecedor: 'SoldaMax Equipamentos e Consumíveis', data: '2025-03-05', avaliador: 'Carlos Mendes', tipo: 3, categoria: 3,
      scores: { gen_0: 4, gen_1: 4, gen_2: 4, gen_3: 4, gen_4: 4, mat_0: 4, mat_1: 4, mat_2: 4, mat_3: 4, mat_4: 3 },
      prazo: 82, qualidade: 83, preco: 81, atendimento: 83, score: 82,
      obs: 'Consumíveis de solda de boa qualidade. Entrega no prazo.' },
    // FOR-027 VigilMax
    { id: 'IDF-024', fornecedor_id: 'FOR-027', fornecedor: 'VigilMax Sistemas de Segurança Ltda', data: '2025-02-14', avaliador: 'Ricardo Almeida', tipo: 1, categoria: 2,
      scores: { gen_0: 4, gen_1: 3, gen_2: 4, gen_3: 4, gen_4: 3, serv_0: 4, serv_1: 3, serv_2: 4, serv_3: 3, serv_4: 4 },
      prazo: 75, qualidade: 78, preco: 76, atendimento: 79, score: 77,
      obs: 'Instalação satisfatória. Suporte técnico um pouco lento.' },
    // FOR-028 AquaPura
    { id: 'IDF-025', fornecedor_id: 'FOR-028', fornecedor: 'AquaPura Tratamento Industrial', data: '2025-01-30', avaliador: 'Patrícia Souza', tipo: 1, categoria: 2,
      scores: { gen_0: 5, gen_1: 4, gen_2: 4, gen_3: 4, gen_4: 4, serv_0: 5, serv_1: 4, serv_2: 4, serv_3: 5, serv_4: 4 },
      prazo: 90, qualidade: 91, preco: 87, atendimento: 90, score: 89,
      obs: 'Excelente qualidade no tratamento de efluentes. Laudos dentro do prazo.' },
    // FOR-029 UniTex
    { id: 'IDF-026', fornecedor_id: 'FOR-029', fornecedor: 'UniTex Uniformes Profissionais', data: '2025-02-28', avaliador: 'Simone Lacerda', tipo: 3, categoria: 3,
      scores: { gen_0: 3, gen_1: 4, gen_2: 3, gen_3: 4, gen_4: 3, mat_0: 3, mat_1: 4, mat_2: 3, mat_3: 3, mat_4: 3 },
      prazo: 68, qualidade: 73, preco: 70, atendimento: 72, score: 71,
      obs: 'Uniformes de qualidade razoável. Prazo de entrega poderia ser menor.' },
    // FOR-030 LocaHeavy
    { id: 'IDF-027', fornecedor_id: 'FOR-030', fornecedor: 'LocaHeavy Locação de Máquinas', data: '2025-03-10', avaliador: 'Diego Fonseca', tipo: 1, categoria: 2,
      scores: { gen_0: 4, gen_1: 4, gen_2: 4, gen_3: 4, gen_4: 5, serv_0: 4, serv_1: 5, serv_2: 4, serv_3: 4, serv_4: 4 },
      prazo: 88, qualidade: 88, preco: 85, atendimento: 87, score: 87,
      obs: 'Equipamentos em ótimo estado de conservação. Disponibilidade excelente.' },
    // FOR-031 FerraTool
    { id: 'IDF-028', fornecedor_id: 'FOR-031', fornecedor: 'FerraTool Ferramentas Industriais', data: '2025-02-10', avaliador: 'Marcos Vieira', tipo: 3, categoria: 3,
      scores: { gen_0: 4, gen_1: 3, gen_2: 4, gen_3: 4, gen_4: 3, mat_0: 4, mat_1: 3, mat_2: 4, mat_3: 4, mat_4: 3 },
      prazo: 78, qualidade: 80, preco: 77, atendimento: 79, score: 79,
      obs: 'Ferramentas de qualidade. Bom estoque disponível.' },
    // FOR-032 DataMine TI
    { id: 'IDF-029', fornecedor_id: 'FOR-032', fornecedor: 'DataMine TI e Sistemas Ltda', data: '2025-03-20', avaliador: 'Ana Paula Rocha', tipo: 1, categoria: 1,
      scores: { gen_0: 5, gen_1: 5, gen_2: 4, gen_3: 5, gen_4: 4, serv_0: 5, serv_1: 5, serv_2: 4, serv_3: 5, serv_4: 4 },
      prazo: 93, qualidade: 94, preco: 90, atendimento: 93, score: 92,
      obs: 'Suporte excepcional. Sistemas implementados com alta disponibilidade.' },
    // FOR-033 MetroCert
    { id: 'IDF-030', fornecedor_id: 'FOR-033', fornecedor: 'MetroCert Calibração e Ensaios', data: '2025-03-25', avaliador: 'José Rodrigues', tipo: 1, categoria: 1,
      scores: { gen_0: 5, gen_1: 5, gen_2: 5, gen_3: 5, gen_4: 5, serv_0: 5, serv_1: 5, serv_2: 5, serv_3: 4, serv_4: 5 },
      prazo: 98, qualidade: 97, preco: 94, atendimento: 96, score: 96,
      obs: 'Referência em metrologia. Certificados INMETRO emitidos no prazo.' },
    // FOR-034 QuimBras
    { id: 'IDF-031', fornecedor_id: 'FOR-034', fornecedor: 'QuimBras Produtos Químicos Industriais', data: '2025-01-20', avaliador: 'Luciana Barros', tipo: 3, categoria: 2,
      scores: { gen_0: 4, gen_1: 4, gen_2: 4, gen_3: 4, gen_4: 4, mat_0: 4, mat_1: 4, mat_2: 4, mat_3: 4, mat_4: 3 },
      prazo: 83, qualidade: 84, preco: 82, atendimento: 83, score: 83,
      obs: 'Produtos químicos certificados. Documentação FISPQ sempre acompanha.' },
    // FOR-035 PoliMax
    { id: 'IDF-032', fornecedor_id: 'FOR-035', fornecedor: 'PoliMax Borrachas e Polímeros', data: '2025-02-18', avaliador: 'Carlos Mendes', tipo: 3, categoria: 3,
      scores: { gen_0: 4, gen_1: 3, gen_2: 4, gen_3: 3, gen_4: 3, mat_0: 4, mat_1: 3, mat_2: 4, mat_3: 3, mat_4: 3 },
      prazo: 73, qualidade: 76, preco: 74, atendimento: 74, score: 75,
      obs: 'Boa variedade de polímeros. Prazo um pouco extenso para itens sob medida.' },
    // FOR-037 EngeMinas
    { id: 'IDF-033', fornecedor_id: 'FOR-037', fornecedor: 'EngeMinas Construção e Infraestrutura', data: '2025-03-15', avaliador: 'Ricardo Almeida', tipo: 1, categoria: 1,
      scores: { gen_0: 4, gen_1: 4, gen_2: 4, gen_3: 4, gen_4: 4, serv_0: 4, serv_1: 4, serv_2: 5, serv_3: 4, serv_4: 4 },
      prazo: 88, qualidade: 89, preco: 86, atendimento: 88, score: 88,
      obs: 'Excelente execução de obras civis. Gestão de qualidade certificada ISO 9001.' },
    // FOR-038 EcoResiduos
    { id: 'IDF-034', fornecedor_id: 'FOR-038', fornecedor: 'EcoResiduos Gestão Ambiental', data: '2025-02-05', avaliador: 'Patrícia Souza', tipo: 1, categoria: 2,
      scores: { gen_0: 5, gen_1: 4, gen_2: 4, gen_3: 5, gen_4: 4, serv_0: 5, serv_1: 4, serv_2: 4, serv_3: 4, serv_4: 5 },
      prazo: 92, qualidade: 91, preco: 88, atendimento: 91, score: 90,
      obs: 'Coleta dentro da janela agendada sempre. Manifesto de transporte sempre correto.' },
    // FOR-040 TalentosMG
    { id: 'IDF-035', fornecedor_id: 'FOR-040', fornecedor: 'TalentosMG Recrutamento e Seleção', data: '2025-03-22', avaliador: 'Ana Paula Rocha', tipo: 1, categoria: 3,
      scores: { gen_0: 4, gen_1: 4, gen_2: 4, gen_3: 4, gen_4: 4, serv_0: 4, serv_1: 4, serv_2: 4, serv_3: 4, serv_4: 4 },
      prazo: 85, qualidade: 86, preco: 84, atendimento: 85, score: 85,
      obs: 'Perfis encaminhados com aderência ao cargo. Tempo médio de recrutamento: 12 dias.' }
    // FOR-036 PredialSul, FOR-039 ValveFit → Em Homologação, sem avaliação ainda
  ];
  const idfAtualV8 = JSON.parse(localStorage.getItem('fa_idf_avaliacoes') || '[]');
  idfV8.forEach(i => { if (!idfAtualV8.find(x => x.id === i.id)) idfAtualV8.push(i); });
  localStorage.setItem('fa_idf_avaliacoes', JSON.stringify(idfAtualV8));

  // ─── 28c. IDF – Avaliações v7 (novos fornecedores + re-avaliações) ─────────────
  const idfV7 = [
    // FOR-011 ElectroBras
    { id: 'IDF-011', fornecedor_id: 'FOR-011', fornecedor: 'ElectroBras Componentes Industriais', data: '2025-01-20', avaliador: 'Diego Fonseca', tipo: 1, categoria: 2,
      scores: { gen_0: 4, gen_1: 4, gen_2: 3, gen_3: 5, gen_4: 4, serv_0: 4, serv_1: 3, serv_2: 4, serv_3: 3, serv_4: 4 },
      prazo: 80, qualidade: 84, preco: 80, atendimento: 85, score: 84,
      obs: 'Bom atendimento técnico. Entregas dentro do prazo.' },
    // FOR-013 MecaFlex
    { id: 'IDF-012', fornecedor_id: 'FOR-013', fornecedor: 'MecaFlex Usinagem e Tornearia', data: '2025-02-05', avaliador: 'Carlos Mendes', tipo: 1, categoria: 1,
      scores: { gen_0: 4, gen_1: 3, gen_2: 4, gen_3: 3, gen_4: 3, serv_0: 4, serv_1: 3, serv_2: 3, serv_3: 4, serv_4: 3 },
      prazo: 70, qualidade: 78, preco: 75, atendimento: 76, score: 76,
      obs: 'Qualidade de usinagem satisfatória. Prazo poderia melhorar.' },
    // FOR-015 AgroQuim (avaliação baixa)
    { id: 'IDF-013', fornecedor_id: 'FOR-015', fornecedor: 'AgroQuim Defensivos e Insumos', data: '2025-01-10', avaliador: 'Patrícia Souza', tipo: 3, categoria: 3,
      scores: { gen_0: 2, gen_1: 3, gen_2: 2, gen_3: 3, gen_4: 2, mat_0: 2, mat_1: 3, mat_2: 2, mat_3: 3, mat_4: 2 },
      prazo: 50, qualidade: 52, preco: 55, atendimento: 50, score: 52,
      obs: 'Restrição de uso. Fornecedor suspenso por não conformidade de entrega.' },
    // FOR-016 SteelMax
    { id: 'IDF-014', fornecedor_id: 'FOR-016', fornecedor: 'SteelMax Aços e Metais Ltda', data: '2025-02-12', avaliador: 'Ricardo Almeida', tipo: 3, categoria: 2,
      scores: { gen_0: 4, gen_1: 4, gen_2: 4, gen_3: 4, gen_4: 3, mat_0: 4, mat_1: 4, mat_2: 3, mat_3: 4, mat_4: 4 },
      prazo: 82, qualidade: 85, preco: 80, atendimento: 83, score: 83,
      obs: 'Boa qualidade dos aços fornecidos. Preços competitivos.' },
    // FOR-017 AirTec
    { id: 'IDF-015', fornecedor_id: 'FOR-017', fornecedor: 'AirTec Compressores Industriais', data: '2025-02-18', avaliador: 'Ana Paula Rocha', tipo: 2, categoria: 2,
      scores: { gen_0: 5, gen_1: 4, gen_2: 4, gen_3: 5, gen_4: 4, equip_0: 5, equip_1: 4, equip_2: 5, equip_3: 4, equip_4: 4 },
      prazo: 92, qualidade: 93, preco: 88, atendimento: 91, score: 91,
      obs: 'Excelente suporte técnico pós-venda. Compressores de alta qualidade.' },
    // FOR-018 HidroMax
    { id: 'IDF-016', fornecedor_id: 'FOR-018', fornecedor: 'HidroMax Vedações e Mangueiras', data: '2025-03-02', avaliador: 'José Rodrigues', tipo: 3, categoria: 3,
      scores: { gen_0: 4, gen_1: 3, gen_2: 4, gen_3: 4, gen_4: 3, mat_0: 4, mat_1: 4, mat_2: 3, mat_3: 3, mat_4: 4 },
      prazo: 76, qualidade: 79, preco: 78, atendimento: 77, score: 78,
      obs: 'Produtos de boa qualidade. Estoque amplo de vedações.' },
    // FOR-019 CordeSul
    { id: 'IDF-017', fornecedor_id: 'FOR-019', fornecedor: 'CordeSul Cabos e Cordoalhas', data: '2025-03-08', avaliador: 'Luciana Barros', tipo: 3, categoria: 3,
      scores: { gen_0: 3, gen_1: 4, gen_2: 3, gen_3: 3, gen_4: 3, mat_0: 3, mat_1: 4, mat_2: 3, mat_3: 3, mat_4: 3 },
      prazo: 70, qualidade: 74, preco: 72, atendimento: 73, score: 73,
      obs: 'Bom produto mas prazo de entrega pode melhorar.' },
    // FOR-020 BrasTrans
    { id: 'IDF-018', fornecedor_id: 'FOR-020', fornecedor: 'BrasTrans Logística Especializada', data: '2025-02-22', avaliador: 'Simone Lacerda', tipo: 1, categoria: 2,
      scores: { gen_0: 4, gen_1: 4, gen_2: 4, gen_3: 4, gen_4: 4, serv_0: 4, serv_1: 5, serv_2: 4, serv_3: 4, serv_4: 4 },
      prazo: 87, qualidade: 85, preco: 84, atendimento: 86, score: 85,
      obs: 'Pontualidade nas entregas. Rastreamento eficiente da carga.' },
    // FOR-022 RefinaçãoSul
    { id: 'IDF-019', fornecedor_id: 'FOR-022', fornecedor: 'RefinaçãoSul Óleos Especiais', data: '2025-03-12', avaliador: 'Ricardo Almeida', tipo: 3, categoria: 2,
      scores: { gen_0: 4, gen_1: 4, gen_2: 5, gen_3: 4, gen_4: 4, mat_0: 5, mat_1: 4, mat_2: 4, mat_3: 4, mat_4: 4 },
      prazo: 88, qualidade: 90, preco: 87, atendimento: 89, score: 88,
      obs: 'Óleos especiais de alta pureza. Laudos de qualidade impecáveis.' },
    // FOR-023 ConstruMin
    { id: 'IDF-020', fornecedor_id: 'FOR-023', fornecedor: 'ConstruMin Serviços de Mineração', data: '2025-03-18', avaliador: 'Diego Fonseca', tipo: 1, categoria: 1,
      scores: { gen_0: 5, gen_1: 5, gen_2: 4, gen_3: 5, gen_4: 5, serv_0: 5, serv_1: 4, serv_2: 5, serv_3: 5, serv_4: 4 },
      prazo: 95, qualidade: 96, preco: 91, atendimento: 95, score: 94,
      obs: 'Excelência em serviços de mineração. Equipe altamente qualificada.' },
    // FOR-025 FiltroMaster
    { id: 'IDF-021', fornecedor_id: 'FOR-025', fornecedor: 'FiltroMaster Filtragem Industrial', data: '2025-03-20', avaliador: 'Ana Paula Rocha', tipo: 3, categoria: 3,
      scores: { gen_0: 4, gen_1: 4, gen_2: 4, gen_3: 4, gen_4: 3, mat_0: 4, mat_1: 4, mat_2: 4, mat_3: 3, mat_4: 4 },
      prazo: 80, qualidade: 82, preco: 79, atendimento: 80, score: 80,
      obs: 'Ampla linha de filtros para maquinário pesado. Bom prazo de entrega.' },
    // FOR-008 Abrasivos – primeira avaliação após homologação
    { id: 'IDF-022', fornecedor_id: 'FOR-008', fornecedor: 'Abrasivos & Filtros Industriais S/A', data: '2025-03-25', avaliador: 'Carlos Mendes', tipo: 3, categoria: 3,
      scores: { gen_0: 3, gen_1: 3, gen_2: 3, gen_3: 3, gen_4: 3, mat_0: 3, mat_1: 3, mat_2: 3, mat_3: 3, mat_4: 3 },
      prazo: 62, qualidade: 65, preco: 68, atendimento: 60, score: 64,
      obs: 'Primeira avaliação após homologação. Em acompanhamento.' }
  ];
  const idfAtualV7 = JSON.parse(localStorage.getItem('fa_idf_avaliacoes') || '[]');
  idfV7.forEach(i => { if (!idfAtualV7.find(x => x.id === i.id)) idfAtualV7.push(i); });
  localStorage.setItem('fa_idf_avaliacoes', JSON.stringify(idfAtualV7));

  // ─── 29. RCs Adicionais (para testar fluxo completo) ───
  const rcsExtra = [
    {
      id: 'RC-2025-0006', numero: 'RC-2025-0006',
      contrato: 'CONT-003', os_id: 'OS-2025-0004',
      solicitante: 'Diego Fonseca', data: '2025-03-20',
      tipo: 'Material', urgencia: 'Alta',
      status: 'Aprovada – Aguardando Comprador',
      aprovado_por: 'Carlos Mendes', data_aprovacao: '2025-03-21',
      nivel_aprovacao: 1,
      itens: [
        { descricao: 'Mandíbula Britador Metso C160 (par)', qtd: 2, unidade: 'par', valor_unit: 18500, valor_total: 37000 }
      ],
      valor_total: 37000, observacoes: 'Inspeção OS-2025-0004 detectou desgaste >45%',
      wbs_id: 'P3-2.1'
    },
    {
      id: 'RC-2025-0007', numero: 'RC-2025-0007',
      contrato: 'CONT-004', os_id: 'OS-2025-0006',
      solicitante: 'Pedro Castilho', data: '2025-03-28',
      tipo: 'Serviço', urgencia: 'Normal',
      status: 'Rascunho',
      aprovado_por: '', data_aprovacao: '',
      nivel_aprovacao: 0,
      itens: [
        { descricao: 'Alinhamento e Calibração Perfuratriz DM45', qtd: 1, unidade: 'vb', valor_unit: 3500, valor_total: 3500 },
        { descricao: 'Kit de vedação e juntas DM45', qtd: 2, unidade: 'kit', valor_unit: 850, valor_total: 1700 }
      ],
      valor_total: 5200, observacoes: 'Comissionamento CONT-004 – mobilização em andamento',
      wbs_id: null
    },
    {
      id: 'RC-2025-0008', numero: 'RC-2025-0008',
      contrato: 'CONT-002', os_id: '',
      solicitante: 'Fernanda Costa', data: '2025-03-26',
      tipo: 'Material', urgencia: 'Normal',
      status: 'Aguardando Aprovação',
      aprovado_por: '', data_aprovacao: '',
      nivel_aprovacao: 1,
      itens: [
        { descricao: 'Combustível Diesel S-10 para GD655', qtd: 3000, unidade: 'L', valor_unit: 5.85, valor_total: 17550 },
        { descricao: 'Óleo Transmissão SAE 80W90 20L', qtd: 6, unidade: 'pct', valor_unit: 210, valor_total: 1260 }
      ],
      valor_total: 18810, observacoes: 'Suprimento mensal CONT-002 – Abril',
      wbs_id: null
    }
  ];
  const rcsAtual = JSON.parse(localStorage.getItem('fa_rcs') || '[]');
  rcsExtra.forEach(r => { if (!rcsAtual.find(x => x.id === r.id)) rcsAtual.push(r); });
  localStorage.setItem('fa_rcs', JSON.stringify(rcsAtual));
  localStorage.setItem('fa_rc', JSON.stringify(rcsAtual));
  localStorage.setItem('fraser_rcs', JSON.stringify(rcsAtual));

  // ─── 30. RFQs Adicionais ──────────────────────────
  const rfqsExtra = [
    {
      id: 'RFQ-2025-005', numero: 'RFQ-2025-005',
      rc_id: 'RC-2025-0006', contrato: 'CONT-003',
      descricao: 'Mandíbulas Britador Metso C160 – 2 pares',
      status: 'Em Cotação', data_criacao: iso('2025-03-22'), data_encerramento: '',
      fornecedores_convidados: ['FOR-010', 'FOR-013'],
      fornecedor_vencedor: '',
      cotacoes: [
        { fornecedor_id: 'FOR-010', fornecedor: 'Metso Brazil Parts', valor_total: 37000, prazo: 21, status: 'Recebida', nota: 97 }
      ],
      valor_aprovado: 0, criado_por: 'Diego Fonseca'
    },
    {
      id: 'RFQ-2025-006', numero: 'RFQ-2025-006',
      rc_id: 'RC-2025-0004', contrato: 'CONT-002',
      descricao: 'Pneus OTR 23.5R25 para Motoniveladora GD655',
      status: 'Em Cotação', data_criacao: iso('2025-03-26'), data_encerramento: '',
      fornecedores_convidados: ['FOR-005', 'FOR-001'],
      fornecedor_vencedor: '',
      cotacoes: [
        { fornecedor_id: 'FOR-005', fornecedor: 'InflaMax Pneus para Minas', valor_total: 11200, prazo: 10, status: 'Recebida', nota: 82 },
        { fornecedor_id: 'FOR-001', fornecedor: 'Komaflex', valor_total: 12400, prazo: 7, status: 'Recebida', nota: 75 }
      ],
      valor_aprovado: 0, criado_por: 'Fernanda Costa'
    },
    {
      id: 'RFQ-2025-007', numero: 'RFQ-2025-007',
      rc_id: 'RC-2025-0008', contrato: 'CONT-002',
      descricao: 'Diesel S-10 + Óleo Transmissão – Suprimento Mensal CONT-002',
      status: 'Mapa em Análise', data_criacao: iso('2025-03-27'), data_encerramento: iso('2025-03-29'),
      fornecedores_convidados: ['FOR-004', 'FOR-002'],
      fornecedor_vencedor: 'FOR-004',
      cotacoes: [
        { fornecedor_id: 'FOR-004', fornecedor: 'Diesel Sul Combustíveis', valor_total: 18810, prazo: 2, status: 'Recebida', nota: 96 },
        { fornecedor_id: 'FOR-002', fornecedor: 'Lubrax Lubrificantes S/A', valor_total: 19200, prazo: 3, status: 'Recebida', nota: 88 }
      ],
      valor_aprovado: 18810, criado_por: 'Fernanda Costa'
    }
  ];
  const rfqsAtual = JSON.parse(localStorage.getItem('fa_rfqs') || '[]');
  rfqsExtra.forEach(r => { if (!rfqsAtual.find(x => x.id === r.id)) rfqsAtual.push(r); });
  localStorage.setItem('fa_rfqs', JSON.stringify(_fixRFQStatus(rfqsAtual)));
  localStorage.setItem('fa_rfq_flow', JSON.stringify(_fixRFQStatus(rfqsAtual)));

  // ─── 31. Mapas de Comparação Adicionais ──────────
  const mapasExtra = [
    {
      id: 'MAP-004', numero: 'MAPA-2025-0004',
      rfq_id: 'RFQ-2025-007', descricao: 'Comparativo Diesel + Óleo Transmissão CONT-002',
      status: 'Aguardando Aprovação',
      data_criacao: iso('2025-03-29'), data_aprovacao: '',
      aprovador: '', aprovador_id: '',
      fornecedor_selecionado: 'FOR-004', fornecedor_selecionado_nome: 'Diesel Sul Combustíveis',
      valor: 18810, economizado: 390,
      cotacoes_comparadas: [
        { fornecedor_id: 'FOR-004', fornecedor: 'Diesel Sul Combustíveis', valor: 18810, prazo: 2, score_idf: 95, recomendado: true, justificativa: 'Menor preço e maior IDF score' },
        { fornecedor_id: 'FOR-002', fornecedor: 'Lubrax', valor: 19200, prazo: 3, score_idf: 92, recomendado: false, justificativa: '' }
      ],
      criado_por: 'Luciana Barros', contrato: 'CONT-002',
      rc_id: 'RC-2025-0008',
      observacoes: 'Saving de R$ 390 em relação à segunda proposta',
      nivel_aprovacao_necessario: 2
    },
    {
      id: 'MAP-005', numero: 'MAPA-2025-0005',
      rfq_id: 'RFQ-2025-006', descricao: 'Comparativo Pneus OTR 23.5R25 – CONT-002',
      status: 'Aguardando Aprovação',
      data_criacao: iso('2025-03-28'), data_aprovacao: '',
      aprovador: '', aprovador_id: '',
      fornecedor_selecionado: 'FOR-005', fornecedor_selecionado_nome: 'InflaMax Pneus para Minas',
      valor: 11200, economizado: 1200,
      cotacoes_comparadas: [
        { fornecedor_id: 'FOR-005', fornecedor: 'InflaMax', valor: 11200, prazo: 10, score_idf: 81, recomendado: true, justificativa: 'Melhor preço; prazo aceitável' },
        { fornecedor_id: 'FOR-001', fornecedor: 'Komaflex', valor: 12400, prazo: 7, score_idf: 88, recomendado: false, justificativa: '' }
      ],
      criado_por: 'Fernanda Costa', contrato: 'CONT-002',
      rc_id: 'RC-2025-0004',
      observacoes: 'Saving de R$ 1.200',
      nivel_aprovacao_necessario: 2
    },
    {
      id: 'MAP-006', numero: 'MAPA-2025-0006',
      rfq_id: 'RFQ-2025-005', descricao: 'Comparativo Mandíbulas Britador Metso C160',
      status: 'Em Cotação',
      data_criacao: iso('2025-03-25'), data_aprovacao: '',
      aprovador: '', aprovador_id: '',
      fornecedor_selecionado: '', fornecedor_selecionado_nome: '',
      valor: 0, economizado: 0,
      cotacoes_comparadas: [
        { fornecedor_id: 'FOR-010', fornecedor: 'Metso Brazil Parts', valor: 37000, prazo: 21, score_idf: 97, recomendado: false, justificativa: 'Aguardando segunda cotação' },
        { fornecedor_id: 'FOR-013', fornecedor: 'MecaFlex Usinagem', valor: 0, prazo: 0, score_idf: 76, recomendado: false, justificativa: 'Cotação pendente' }
      ],
      criado_por: 'Diego Fonseca', contrato: 'CONT-003',
      rc_id: 'RC-2025-0006',
      observacoes: 'Aguardando cotação da MecaFlex',
      nivel_aprovacao_necessario: 3
    }
  ];
  const mapasAtual = JSON.parse(localStorage.getItem('fa_mapas_comp') || '[]');
  mapasExtra.forEach(m => { if (!mapasAtual.find(x => x.id === m.id)) mapasAtual.push(m); });
  localStorage.setItem('fa_mapas_comp', JSON.stringify(mapasAtual));
  // Mescla com mapas do usuário que não são da seed
  const _matrizesExist2 = (() => { try { return JSON.parse(localStorage.getItem('fa_matrizes') || '[]'); } catch(e) { return []; } })();
  const _seedIds2 = new Set(mapasAtual.map(m => m.id));
  const _userMapas2 = _matrizesExist2.filter(m => !_seedIds2.has(m.id));
  const _matrizesFinais2 = [...mapasAtual, ..._userMapas2];
  localStorage.setItem('fa_matrizes', JSON.stringify(_matrizesFinais2));
  localStorage.setItem('fa_mapas_comp', JSON.stringify(_matrizesFinais2));

  // ─── 32. Pedidos de Compra Adicionais ────────────
  const pedidosExtra = [
    {
      id: 'PED-2025-006', numero: 'PED-2025-006',
      rfq_id: 'RFQ-2025-006', rc_id: 'RC-2025-0004',
      fornecedor_id: 'FOR-005', fornecedor: 'InflaMax Pneus para Minas',
      contrato: 'CONT-002', descricao: 'Pneus OTR 23.5R25 – Troca GD655',
      status: 'Aguardando Entrega',
      data_emissao: iso('2025-04-01'), data_entrega_prev: '2025-04-11', data_entrega_real: '',
      itens: [
        { descricao: 'Pneu OTR 23.5R25 Motoniveladora', qtd: 4, unidade: 'un', valor_unit: 2800, valor_total: 11200 }
      ],
      valor_total: 11200, forma_pagamento: '30 dias', nf_numero: '',
      recebido_por: '', observacoes: 'OS-2025-0003 – Aguardando entrega',
      aprovado_por: 'Fernanda Costa'
    },
    {
      id: 'PED-2025-007', numero: 'PED-2025-007',
      rfq_id: 'RFQ-2025-007', rc_id: 'RC-2025-0008',
      fornecedor_id: 'FOR-004', fornecedor: 'Diesel Sul Combustíveis',
      contrato: 'CONT-002', descricao: 'Diesel S-10 + Óleo Transmissão – Abril CONT-002',
      status: 'Rascunho',
      data_emissao: '', data_entrega_prev: '2025-04-03', data_entrega_real: '',
      itens: [
        { descricao: 'Diesel S-10', qtd: 3000, unidade: 'L', valor_unit: 5.85, valor_total: 17550 },
        { descricao: 'Óleo Transmissão SAE 80W90', qtd: 6, unidade: 'pct', valor_unit: 210, valor_total: 1260 }
      ],
      valor_total: 18810, forma_pagamento: '30 dias', nf_numero: '',
      recebido_por: '', observacoes: 'Aguardando aprovação do mapa',
      aprovado_por: ''
    },
    {
      id: 'PED-2025-008', numero: 'PED-2025-008',
      rfq_id: '', rc_id: 'RC-2025-0006',
      fornecedor_id: 'FOR-010', fornecedor: 'Metso Brazil Parts',
      contrato: 'CONT-003', descricao: 'Mandíbulas Britador Primário C160 – Reposição',
      status: 'Rascunho',
      data_emissao: '', data_entrega_prev: '2025-04-20', data_entrega_real: '',
      itens: [
        { descricao: 'Mandíbula Britador Metso C160 (par)', qtd: 2, unidade: 'par', valor_unit: 18500, valor_total: 37000 }
      ],
      valor_total: 37000, forma_pagamento: '30 dias', nf_numero: '',
      recebido_por: '', observacoes: 'Aguardando fechamento do mapa de cotação',
      aprovado_por: ''
    }
  ];
  const pedidosAtual = JSON.parse(localStorage.getItem('fa_pedidos') || '[]');
  pedidosExtra.forEach(p => { if (!pedidosAtual.find(x => x.id === p.id)) pedidosAtual.push(p); });
  localStorage.setItem('fa_pedidos', JSON.stringify(pedidosAtual));
  localStorage.setItem('fraser_pedidos', JSON.stringify(pedidosAtual));
  localStorage.setItem('fa_pedidos_v2', JSON.stringify(pedidosAtual));

  // ─── 33. Fluxo de Aprovação OS (fluxo_os) extra ──
  const fluxoExtra = [
    {
      id: 'FOS-005',
      os_id: 'OS-2025-0004',
      os_descricao: 'Inspeção e medição das mandíbulas do britador primário Metso C160',
      os_contrato: 'CONT-003',
      os_tipo_compra: 'Material',
      contrato: 'CONT-003',
      criado_por: 'Diego Fonseca',
      criado_em: iso('2025-03-20'),
      atualizado_em: iso('2025-03-21'),
      status: 'Aprovada – Aguardando Comprador',
      estagio_atual: 2,
      total_estagios: 3,
      estagios_aprovacao: [
        { estagio: 1, status: 'Aprovado', aprovador: 'Carlos Mendes', data: iso('2025-03-21'), obs: 'Aprovado – dentro da alçada do gerente' }
      ],
      itens: [
        { descricao: 'Mandíbula Britador Metso C160 (par)', qtd: 2, unidade: 'par', valor_unit: 18500, valor_total: 37000, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-03-20') }
      ],
      rcs_geradas: ['RC-2025-0006'],
      rcs: [{ rc_id: 'RC-2025-0006', rc_numero: 'RC-2025-0006', data: '21/03/2025 14:00', criado_por: 'Diego Fonseca' }],
      historico: [
        { acao: 'RC RC-2025-0006 emitida – aguardando cotação', usuario: 'Diego Fonseca', data: '21/03/2025 14:00' },
        { acao: 'OS inserida no fluxo – pós inspeção com desgaste crítico', usuario: 'Carlos Mendes', data: '20/03/2025 16:00' }
      ]
    },
    {
      id: 'FOS-006',
      os_id: 'OS-2025-0003',
      os_descricao: 'Troca de pneus traseiros da Motoniveladora GD655 (desgaste >80%)',
      os_contrato: 'CONT-002',
      os_tipo_compra: 'Material',
      contrato: 'CONT-002',
      criado_por: 'José Rodrigues',
      criado_em: iso('2025-03-25'),
      atualizado_em: iso('2025-03-25'),
      status: 'Aguardando Aprovação',
      estagio_atual: 1,
      total_estagios: 3,
      estagios_aprovacao: [],
      itens: [
        { descricao: 'Pneu OTR 23.5R25 para Motoniveladora', qtd: 4, unidade: 'un', valor_unit: 2800, valor_total: 11200, status_item: 'Aguardando Aprovação', novo: false, adicionado_em: iso('2025-03-25') }
      ],
      rcs_geradas: [],
      rcs: [],
      historico: [
        { acao: 'OS inserida no fluxo – desgaste crítico detectado', usuario: 'José Rodrigues', data: '25/03/2025 11:00' }
      ]
    },
    {
      id: 'FOS-007',
      os_id: 'OS-2025-0006',
      os_descricao: 'Instalação e comissionamento da perfuratriz DM45 – Mobilização CONT-004',
      os_contrato: 'CONT-004',
      os_tipo_compra: 'Serviço Externo',
      contrato: 'CONT-004',
      criado_por: 'Pedro Castilho',
      criado_em: iso('2025-03-28'),
      atualizado_em: iso('2025-03-28'),
      status: 'Aguardando Aprovação',
      estagio_atual: 1,
      total_estagios: 3,
      estagios_aprovacao: [],
      itens: [
        { descricao: 'Alinhamento e Calibração Perfuratriz DM45', qtd: 1, unidade: 'vb', valor_unit: 3500, valor_total: 3500, status_item: 'Aguardando Aprovação', novo: false, adicionado_em: iso('2025-03-28') },
        { descricao: 'Kit de vedação e juntas DM45', qtd: 2, unidade: 'kit', valor_unit: 850, valor_total: 1700, status_item: 'Aguardando Aprovação', novo: false, adicionado_em: iso('2025-03-28') }
      ],
      rcs_geradas: [],
      rcs: [],
      historico: [
        { acao: 'OS inserida no fluxo – serviço de comissionamento', usuario: 'Pedro Castilho', data: '28/03/2025 09:00' }
      ]
    },
    {
      id: 'FOS-008',
      os_id: '',
      os_descricao: 'Suprimento mensal CONT-002 – Abril/2025 (combustível e óleo de transmissão)',
      os_contrato: 'CONT-002',
      os_tipo_compra: 'Material',
      contrato: 'CONT-002',
      criado_por: 'Fernanda Costa',
      criado_em: iso('2025-03-26'),
      atualizado_em: iso('2025-03-26'),
      status: 'Aguardando Aprovação',
      estagio_atual: 1,
      total_estagios: 3,
      estagios_aprovacao: [],
      itens: [
        { descricao: 'Diesel S-10', qtd: 3000, unidade: 'L', valor_unit: 5.85, valor_total: 17550, status_item: 'Aguardando Aprovação', novo: false, adicionado_em: iso('2025-03-26') },
        { descricao: 'Óleo de Transmissão SAE 80W90 20L', qtd: 6, unidade: 'pct', valor_unit: 210, valor_total: 1260, status_item: 'Aguardando Aprovação', novo: false, adicionado_em: iso('2025-03-26') }
      ],
      rcs_geradas: [],
      rcs: [],
      historico: [
        { acao: 'Requisição de suprimento mensal inserida no fluxo', usuario: 'Fernanda Costa', data: '26/03/2025 08:30' }
      ]
    }
  ];
  const fluxoAtual = JSON.parse(localStorage.getItem('fa_fluxo_os') || '[]');
  fluxoExtra.forEach(f => { if (!fluxoAtual.find(x => x.id === f.id)) fluxoAtual.push(f); });
  localStorage.setItem('fa_fluxo_os', JSON.stringify(fluxoAtual));
  localStorage.setItem('fraser_fluxo_os', JSON.stringify(fluxoAtual));

  // ─── 33b. Fluxos OS v7 – prontos para RC (sem RC criada) ─────────
  const fluxoV7 = [
    {
      id: 'FOS-009',
      os_id: 'OS-2025-NEW1',
      os_descricao: 'Substituição de rolamentos e vedações da bomba hidráulica – PC800',
      os_contrato: 'CONT-001',
      os_tipo_compra: 'Material',
      contrato: 'CONT-001',
      criado_por: 'Marcos Vieira',
      criado_em: iso('2025-03-28'),
      atualizado_em: iso('2025-03-29'),
      status: 'Aprovada – Aguardando Comprador',
      estagio_atual: 2,
      total_estagios: 3,
      estagios_aprovacao: [
        { estagio: 1, status: 'Aprovado', aprovador: 'Ricardo Almeida', data: iso('2025-03-29'), obs: 'Aprovado – manutenção preventiva urgente' }
      ],
      itens: [
        { descricao: 'Rolamento 6208-ZZ (SKF)', qtd: 6, unidade: 'un', valor_unit: 48, valor_total: 288, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-03-28') },
        { descricao: 'Vedação Hidráulica Bomba PC800', qtd: 1, unidade: 'kit', valor_unit: 320, valor_total: 320, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-03-28') },
        { descricao: 'Óleo Hidráulico ISO 46 20L', qtd: 4, unidade: 'pct', valor_unit: 140, valor_total: 560, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-03-28') }
      ],
      rcs_geradas: [],
      rcs: [],
      historico: [
        { acao: 'OS aprovada – aguardando comprador emitir RC', usuario: 'Ricardo Almeida', data: '29/03/2025 08:00' },
        { acao: 'OS inserida no fluxo de aprovação', usuario: 'Marcos Vieira', data: '28/03/2025 16:30' }
      ]
    },
    {
      id: 'FOS-010',
      os_id: 'OS-2025-NEW2',
      os_descricao: 'Fornecimento de EPI – Reposição Trimestral CONT-002 (Abr/2025)',
      os_contrato: 'CONT-002',
      os_tipo_compra: 'Material',
      contrato: 'CONT-002',
      criado_por: 'Fernanda Costa',
      criado_em: iso('2025-03-30'),
      atualizado_em: iso('2025-03-30'),
      status: 'Aprovada – Aguardando Comprador',
      estagio_atual: 2,
      total_estagios: 3,
      estagios_aprovacao: [
        { estagio: 1, status: 'Aprovado', aprovador: 'Carlos Mendes', data: iso('2025-03-30'), obs: 'Aprovado – reposição periódica obrigatória' }
      ],
      itens: [
        { descricao: 'Capacete ABS Classe B (lote 20)', qtd: 20, unidade: 'un', valor_unit: 32, valor_total: 640, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-03-30') },
        { descricao: 'Botina Bico de Aço CA 43910', qtd: 15, unidade: 'par', valor_unit: 125, valor_total: 1875, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-03-30') },
        { descricao: 'Luva de Vaqueta Par', qtd: 40, unidade: 'par', valor_unit: 12, valor_total: 480, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-03-30') },
        { descricao: 'Óculos de Proteção Ampla Visão CA 10344', qtd: 25, unidade: 'un', valor_unit: 18, valor_total: 450, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-03-30') }
      ],
      rcs_geradas: [],
      rcs: [],
      historico: [
        { acao: 'OS aprovada – aguardando comprador emitir RC', usuario: 'Carlos Mendes', data: '30/03/2025 14:00' },
        { acao: 'OS inserida no fluxo de reposição EPI', usuario: 'Fernanda Costa', data: '30/03/2025 08:00' }
      ]
    },
    {
      id: 'FOS-011',
      os_id: 'OS-2025-NEW3',
      os_descricao: 'Revisão 1000h Escavadeira PC200 – Kit completo de manutenção',
      os_contrato: 'CONT-003',
      os_tipo_compra: 'Material',
      contrato: 'CONT-003',
      criado_por: 'Diego Fonseca',
      criado_em: iso('2025-03-31'),
      atualizado_em: iso('2025-04-01'),
      status: 'Aprovada – Aguardando Comprador',
      estagio_atual: 2,
      total_estagios: 3,
      estagios_aprovacao: [
        { estagio: 1, status: 'Aprovado', aprovador: 'Carlos Mendes', data: iso('2025-04-01'), obs: 'Aprovado – revisão planejada no WBS' }
      ],
      itens: [
        { descricao: 'Filtro de Óleo Motor PC200', qtd: 3, unidade: 'un', valor_unit: 75, valor_total: 225, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-03-31') },
        { descricao: 'Filtro de Combustível PC200', qtd: 2, unidade: 'un', valor_unit: 68, valor_total: 136, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-03-31') },
        { descricao: 'Óleo Motor 15W40 Diesel 20L', qtd: 10, unidade: 'L', valor_unit: 18, valor_total: 180, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-03-31') },
        { descricao: 'Kit de filtros hidráulicos PC200', qtd: 1, unidade: 'kit', valor_unit: 420, valor_total: 420, status_item: 'Aprovado', novo: false, adicionado_em: iso('2025-03-31') }
      ],
      rcs_geradas: [],
      rcs: [],
      historico: [
        { acao: 'OS aprovada – disponível para emissão de RC', usuario: 'Carlos Mendes', data: '01/04/2025 07:00' },
        { acao: 'OS inserida no fluxo – revisão programada', usuario: 'Diego Fonseca', data: '31/03/2025 17:00' }
      ]
    }
  ];
  const fluxoAtualV7 = JSON.parse(localStorage.getItem('fa_fluxo_os') || '[]');
  fluxoV7.forEach(f => { if (!fluxoAtualV7.find(x => x.id === f.id)) fluxoAtualV7.push(f); });
  localStorage.setItem('fa_fluxo_os', JSON.stringify(fluxoAtualV7));
  localStorage.setItem('fraser_fluxo_os', JSON.stringify(fluxoAtualV7));

  // ─── 34. Configuração do Fluxo de Aprovação RC ───
  // Perfis que podem emitir OS
  const configPerfisOS = {
    perfis: ['admin', 'gestor', 'supervisor', 'mecanico', 'operador'],
    requer_contrato: true,
    requer_wbs: false,
    aprovacao_automatica_ate: 500
  };
  localStorage.setItem('fa_config_perfis_os', JSON.stringify(configPerfisOS));

  // Perfis que podem emitir RC
  const configPerfisRC = {
    perfis: ['admin', 'gestor', 'supervisor', 'almoxarife'],
    requer_os: false,
    valor_maximo_rascunho: 999999999
  };
  localStorage.setItem('fa_config_perfis_emissao_rc', JSON.stringify(configPerfisRC));

  // Configuração de alçadas de aprovação (formato utilizado pelo fluxo_compras.js)
  const aprovacaoConfigCompleta = {
    moeda_base: 'BRL',
    usar_usd: false,
    taxa_cambio: 5.0,
    estagio1: {
      nome: 'Supervisor de Campo',
      limite_brl: 5000,
      limite_usd: 1000,
      perfis: ['supervisor', 'admin'],
      aprovadores: ['Carlos Mendes', 'Ana Paula Rocha'],
      aprovadores_ids: ['COL-003', 'COL-010']
    },
    estagio2: {
      nome: 'Gerente de Operações',
      limite_brl: 30000,
      limite_usd: 6000,
      perfis: ['gestor', 'gerente', 'admin'],
      aprovadores: ['Ricardo Almeida', 'Fernanda Costa'],
      aprovadores_ids: ['COL-001', 'COL-002']
    },
    estagio3: {
      nome: 'Diretor',
      limite_brl: 999999999,
      limite_usd: 999999,
      perfis: ['diretor', 'admin'],
      aprovadores: ['Ricardo Almeida'],
      aprovadores_ids: ['COL-001']
    }
  };
  localStorage.setItem('fa_aprovacao_config', JSON.stringify(aprovacaoConfigCompleta));
  localStorage.setItem('fa_alcada_config', JSON.stringify({
    supervisor: { limite: 5000, pode_aprovar_rc: true, pode_emitir_rfq: false, pode_aprovar_mapa: false },
    gerente:    { limite: 30000, pode_aprovar_rc: true, pode_emitir_rfq: true, pode_aprovar_mapa: true },
    diretor:    { limite: 999999999, pode_aprovar_rc: true, pode_emitir_rfq: true, pode_aprovar_mapa: true }
  }));

  // ─── 35. Contas a Pagar Adicionais ───────────────
  const cpExtra = [
    { id: 'CP-007', pedido_id: 'PED-2025-006', fornecedor: 'InflaMax', descricao: 'Pneus OTR GD655', vencimento: '2025-05-01', valor: 11200, status: 'Em Aberto', pagamento: '', nf: '', contrato: 'CONT-002' },
    { id: 'CP-008', pedido_id: 'PED-2025-007', fornecedor: 'Diesel Sul', descricao: 'Diesel + Óleo Transmissão Abril', vencimento: '2025-05-03', valor: 18810, status: 'Em Aberto', pagamento: '', nf: '', contrato: 'CONT-002' },
    { id: 'CP-009', pedido_id: 'PED-2025-008', fornecedor: 'Metso Brazil Parts', descricao: 'Mandíbulas Britador C160', vencimento: '2025-05-20', valor: 37000, status: 'Em Aberto', pagamento: '', nf: '', contrato: 'CONT-003' },
    { id: 'CP-010', pedido_id: '', fornecedor: 'Aliminas', descricao: 'Catering CONT-002 Abril', vencimento: '2025-05-05', valor: 42000, status: 'Em Aberto', pagamento: '', nf: '', contrato: 'CONT-002' }
  ];
  const cpAtual = JSON.parse(localStorage.getItem('fa_contas_pagar') || '[]');
  cpExtra.forEach(cp => { if (!cpAtual.find(x => x.id === cp.id)) cpAtual.push(cp); });
  localStorage.setItem('fa_contas_pagar', JSON.stringify(cpAtual));
  localStorage.setItem('fraser_contas_pagar', JSON.stringify(cpAtual));
  localStorage.setItem('fa_contas_pagar_v2', JSON.stringify(cpAtual));

  // ─── 36. Apontamentos de Horas Adicionais ─────────
  const apontExtra = [
    { id: 'APO-008', os_id: 'OS-2025-0002', data: '2025-03-28', horas: 6, colaborador: 'Marcos Vieira', atividade: 'Montagem final sistema de freio – aguardando peça kit', registrado_por: 'Ricardo Almeida', criado_em: iso('2025-03-28') },
    { id: 'APO-009', os_id: 'OS-2025-0005', data: '2025-03-28', horas: 4, colaborador: 'Jair Oliveira', atividade: 'Lubrificação EQP-007 e EQP-002 (externos acessíveis)', registrado_por: 'Ricardo Almeida', criado_em: iso('2025-03-28') },
    { id: 'APO-010', os_id: 'OS-2025-0006', data: '2025-03-22', horas: 8, colaborador: 'Pedro Castilho', atividade: 'Instalação do sistema de perfuração e testes de pressão', registrado_por: 'Ana Paula Rocha', criado_em: iso('2025-03-22') },
    { id: 'APO-011', os_id: 'OS-2025-0006', data: '2025-03-25', horas: 6, colaborador: 'Roberto Lima', atividade: 'Conexão do painel elétrico da perfuratriz DM45', registrado_por: 'Ana Paula Rocha', criado_em: iso('2025-03-25') }
  ];
  const apontAtual = JSON.parse(localStorage.getItem('fa_apontamentos_os') || '[]');
  apontExtra.forEach(a => { if (!apontAtual.find(x => x.id === a.id)) apontAtual.push(a); });
  localStorage.setItem('fa_apontamentos_os', JSON.stringify(apontAtual));

  // ─── 37. Materiais/Almoxarifado Adicionais ────────
  const matExtra = [
    { id: 'MAT-010', codigo: 'PF-001', descricao: 'Haste de Perfuração 4m x 89mm', categoria: 'Perfuração', unidade: 'un', estoque: 12, min: 6, max: 30, custo_medio: 1200, local: 'Pátio CONT-004', ultima_mov: '2025-03-10' },
    { id: 'MAT-011', codigo: 'PF-002', descricao: 'Broca Tricone 12-1/4"', categoria: 'Perfuração', unidade: 'un', estoque: 4, min: 2, max: 10, custo_medio: 3800, local: 'Pátio CONT-004', ultima_mov: '2025-03-10' },
    { id: 'MAT-012', codigo: 'BT-001', descricao: 'Mandíbula Britador C160 (par)', categoria: 'Britagem', unidade: 'par', estoque: 0, min: 1, max: 3, custo_medio: 18500, local: 'Almox CONT-003', ultima_mov: '2025-03-01' },
    { id: 'MAT-013', codigo: 'EL-001', descricao: 'Fusível Industrial 80A', categoria: 'Elétrico', unidade: 'un', estoque: 24, min: 10, max: 50, custo_medio: 18, local: 'Armário Elétrico', ultima_mov: '2025-02-20' },
    { id: 'MAT-014', codigo: 'EPI-004', descricao: 'Protetor Auricular Tipo Concha', categoria: 'EPI', unidade: 'un', estoque: 15, min: 8, max: 40, custo_medio: 38, local: 'Armário EPI-2', ultima_mov: '2025-03-23' }
  ];
  const matAtual = JSON.parse(localStorage.getItem('fa_materiais') || '[]');
  matExtra.forEach(m => { if (!matAtual.find(x => x.id === m.id)) matAtual.push(m); });
  localStorage.setItem('fa_materiais', JSON.stringify(matAtual));
  localStorage.setItem('fa_estoque_v2', JSON.stringify(matAtual));

  // ─── 38. Logs do Sistema Adicionais ──────────────
  const logsExtra = [
    { id: 'LOG-007', data: iso('2025-03-29'), usuario: 'Fernanda Costa', acao: 'MAPA-2025-0004 gerado – aguardando aprovação R$ 18.810', modulo: 'Compras', nivel: 'info' },
    { id: 'LOG-008', data: iso('2025-03-29'), usuario: 'Fernanda Costa', acao: 'MAPA-2025-0005 gerado – pneus GD655 R$ 11.200', modulo: 'Compras', nivel: 'info' },
    { id: 'LOG-009', data: iso('2025-03-28'), usuario: 'Pedro Castilho', acao: 'RC-2025-0007 criada – comissionamento DM45', modulo: 'Suprimentos', nivel: 'info' },
    { id: 'LOG-010', data: iso('2025-03-22'), usuario: 'Diego Fonseca', acao: 'RC-2025-0006 aprovada – mandíbulas britador R$ 37.000', modulo: 'Suprimentos', nivel: 'alerta' },
    { id: 'LOG-011', data: iso('2025-03-20'), usuario: 'Diego Fonseca', acao: 'OS-2025-0004 concluída – inspeção mandíbulas britador', modulo: 'OS', nivel: 'info' },
    { id: 'LOG-012', data: iso('2025-04-01'), usuario: 'Sistema', acao: 'Seed demo v6 carregado – dados completos integração', modulo: 'Admin', nivel: 'info' }
  ];
  const logsAtual = JSON.parse(localStorage.getItem('fa_logs_sistema') || '[]');
  logsExtra.forEach(l => { if (!logsAtual.find(x => x.id === l.id)) logsAtual.push(l); });
  localStorage.setItem('fa_logs_sistema', JSON.stringify(logsAtual));

  // ─── 39. Histórico de Compras Atualizado ─────────
  const histAtual = JSON.parse(localStorage.getItem('fa_historico_compras') || '[]');
  if (!histAtual.find(h => h.id === 'HC-004')) {
    histAtual.push({ id: 'HC-004', ano_mes: '2025-04', total_pedidos: 3, valor_total: 67210, fornecedores: 3, saving: 1590 });
  }
  localStorage.setItem('fa_historico_compras', JSON.stringify(histAtual));

  // ─── 40. Contratos de Fornecimento Adicionais ────
  const cfExtra = [
    { id: 'CF-004', fornecedor_id: 'FOR-012', fornecedor: 'ProSafety Soluções em SSMA', contrato_cliente: 'CONT-001', objeto: 'Treinamentos SSMA e PCMSO', valor_mensal: 6500, inicio: '2024-01-01', fim: '2025-12-31', status: 'Ativo', renovavel: true },
    { id: 'CF-005', fornecedor_id: 'FOR-004', fornecedor: 'Diesel Sul Combustíveis', contrato_cliente: 'CONT-002', objeto: 'Fornecimento de Diesel S-10 CONT-002', valor_mensal: 17550, inicio: '2024-03-01', fim: '2025-08-31', status: 'Ativo', renovavel: true }
  ];
  const cfAtual = JSON.parse(localStorage.getItem('fa_contratos_fornecimento') || '[]');
  cfExtra.forEach(c => { if (!cfAtual.find(x => x.id === c.id)) cfAtual.push(c); });
  localStorage.setItem('fa_contratos_fornecimento', JSON.stringify(cfAtual));

  // ─── 41. Movimentações de Almoxarifado Adicionais ──
  const movExtra = [
    { id: 'MOV-008', numero: 'MOV-2025-0008', data: '2025-03-28', tipo: 'Saída', subtipo: 'Manual', material_id: 'MAT-008', material: 'Diesel S-10', material_nome: 'Diesel S-10', material_codigo: 'CB-001', qtd: 3000, quantidade: 3000, unidade: 'L', destino: 'Abastecimento CONT-002 Março', local_destino: 'Pátio CONT-002', responsavel: 'José Rodrigues', pedido: 'PED-2025-004', pedido_numero: 'PC-2025-004', estoque_antes: 6500, estoque_depois: 3500, status: 'Efetivado', criado_em: '2025-03-28T16:00:00.000Z' },
    { id: 'MOV-009', numero: 'MOV-2025-0009', data: '2025-03-10', tipo: 'Entrada', subtipo: 'Recebimento', material_id: 'MAT-010', material: 'Haste de Perfuração 4m', material_nome: 'Haste de Perfuração 4m', material_codigo: 'MAT-010', qtd: 12, quantidade: 12, unidade: 'un', destino: 'Almoxarifado CONT-004', local_destino: 'Almoxarifado CONT-004', responsavel: 'Pedro Castilho', observacoes: 'Recebimento mobilização CONT-004', estoque_antes: 0, estoque_depois: 12, status: 'Efetivado', criado_em: '2025-03-10T09:00:00.000Z' },
    { id: 'MOV-010', numero: 'MOV-2025-0010', data: '2025-03-10', tipo: 'Entrada', subtipo: 'Recebimento', material_id: 'MAT-011', material: 'Broca Tricone 12-1/4"', material_nome: 'Broca Tricone 12-1/4"', material_codigo: 'MAT-011', qtd: 4, quantidade: 4, unidade: 'un', destino: 'Almoxarifado CONT-004', local_destino: 'Almoxarifado CONT-004', responsavel: 'Pedro Castilho', observacoes: 'Recebimento mobilização CONT-004', estoque_antes: 0, estoque_depois: 4, status: 'Efetivado', criado_em: '2025-03-10T09:15:00.000Z' }
  ];
  const movAtual = JSON.parse(localStorage.getItem('fa_almox_movimentos') || localStorage.getItem('fa_mov_almox') || '[]');
  movExtra.forEach(m => { if (!movAtual.find(x => x.id === m.id)) movAtual.push(m); });
  localStorage.setItem('fa_almox_movimentos', JSON.stringify(movAtual));
  localStorage.setItem('fa_mov_almox', JSON.stringify(movAtual));

  // ─── 42. Avaliações de Fornecedores Adicionais ───
  const avForExtra = [
    { id: 'AVFOR-004', pedido_id: 'PED-2025-003', fornecedor_id: 'FOR-003', data: '2025-03-25', avaliador: 'Patrícia Souza', prazo: 75, qualidade: 82, atendimento: 78, score: 78, obs: 'Atraso de 2 dias na entrega dos EPIs' },
    { id: 'AVFOR-005', pedido_id: 'PED-2025-005', fornecedor_id: 'FOR-006', data: '2025-04-01', avaliador: 'Simone Lacerda', prazo: 100, qualidade: 71, atendimento: 74, score: 74, obs: 'Entrega no prazo, mas qualidade do cardápio abaixo do esperado' }
  ];
  const avForAtual = JSON.parse(localStorage.getItem('fa_avaliacoes_forn') || '[]');
  avForExtra.forEach(a => { if (!avForAtual.find(x => x.id === a.id)) avForAtual.push(a); });
  localStorage.setItem('fa_avaliacoes_forn', JSON.stringify(avForAtual));

  // ─── 43. OS Adicionais ────────────────────────────
  const osExtra = [
    {
      id: 'OS-2025-0007', numero: 'OS-2025-0007',
      contrato: 'CONT-003', cliente: 'Bauxita do Norte Ind. e Com.',
      tipo: 'Corretiva', descricao: 'Reparo emergencial mancal britador primário Metso C160',
      status: 'Concluída', prioridade: 'Crítica',
      responsavel: 'Diego Fonseca', equipe: 3,
      prazo: '2025-02-28', horas: 24, progresso: 100,
      local: 'Planta de Britagem – CONT-003',
      wbs_id: 'P3-4.1', wbs_descricao: 'Reparo Emergencial Mancal Britador – Não Previsto', wbs_natureza: 'EQP', wbs_nao_previsto: true,
      custo_estimado: 12500, custo_real: 11800,
      precisa_compra: true, tipo_compra: 'Misto',
      itens_compra: [
        { descricao: 'Mancal de Rolamento SKF 22340', qtd: 1, unidade: 'un', valor_unit: 8200, valor_total: 8200 },
        { descricao: 'Serviço de Montagem Especializada', qtd: 1, unidade: 'vb', valor_unit: 3600, valor_total: 3600 }
      ],
      criado_em: iso('2025-02-20'), criado_por: 'Carlos Mendes',
      atualizado_em: iso('2025-02-28'), observacoes: 'Item não previsto – falha prematura do mancal. Britador parado 3 dias.'
    },
    {
      id: 'OS-2025-0008', numero: 'OS-2025-0008',
      contrato: 'CONT-001', cliente: 'Mineração Vale Verde Ltda',
      tipo: 'Preventiva', descricao: 'Revisão 250h Trator de Esteiras D155 – EQP-006',
      status: 'Agendada', prioridade: 'Normal',
      responsavel: 'Marcos Vieira', equipe: 2,
      prazo: '2025-04-20', horas: 8, progresso: 0,
      local: 'Oficina Central – Mina do Cerrado',
      wbs_id: '1.2.1', wbs_descricao: 'Manutenção Preventiva – Filtros/Óleos', wbs_natureza: 'MAN',
      precisa_compra: true, tipo_compra: 'Material',
      itens_compra: [
        { descricao: 'Filtro Óleo Motor D155 Komatsu', qtd: 2, unidade: 'un', valor_unit: 95, valor_total: 190 },
        { descricao: 'Óleo Motor SAE 15W40 20L', qtd: 16, unidade: 'L', valor_unit: 18, valor_total: 288 }
      ],
      criado_em: iso('2025-03-30'), criado_por: 'Ricardo Almeida',
      atualizado_em: iso('2025-03-30'), observacoes: ''
    }
  ];
  const osAtual = JSON.parse(localStorage.getItem('fa_os_list') || '[]');
  osExtra.forEach(o => { if (!osAtual.find(x => x.id === o.id)) osAtual.push(o); });
  localStorage.setItem('fa_os_list', JSON.stringify(osAtual));
  localStorage.setItem('fa_ordens_servico', JSON.stringify(osAtual));
  // Também atualiza ERP_DATA.ordens
  if (window.ERP_DATA && window.ERP_DATA.ordens) {
    osExtra.forEach(o => { if (!window.ERP_DATA.ordens.find(x => x.id === o.id)) window.ERP_DATA.ordens.push(o); });
  }

  // ─── 44. Projetos de Custos – CONT-004 sem WBS ainda ──
  const projAtual = JSON.parse(localStorage.getItem('fraser_custos_projetos') || '[]');
  if (!projAtual.find(p => p.id === 'PROJ-004')) {
    projAtual.push({ id: 'PROJ-004', nome: 'CONT-004 – Desmonte Ferro Bruto', contrato: 'CONT-004', cliente: 'Ferro Bruto Extração Ltda', status: 'Mobilização', inicio: '2025-02-01', fim: '2027-01-31', valor_contrato: 3200000, criado_em: iso('2025-01-25') });
  }
  localStorage.setItem('fraser_custos_projetos', JSON.stringify(projAtual));

  // Vincula CONT-004 ao projeto (sem WBS ainda – para testar criação)
  const mapAtual = JSON.parse(localStorage.getItem('fraser_wbs_contrato_map') || '{}');
  if (!mapAtual['CONT-004']) mapAtual['CONT-004'] = 'PROJ-004';
  // Adiciona vinculações de propostas adicionais ao CRM
  if (!mapAtual['prop_LEAD-003']) mapAtual['prop_LEAD-003'] = 'PROJ-PROP-LEAD-003';
  if (!mapAtual['prop_LEAD-005']) mapAtual['prop_LEAD-005'] = 'PROJ-PROP-LEAD-005';
  localStorage.setItem('fraser_wbs_contrato_map', JSON.stringify(mapAtual));

  // ─── 45. Medições v2 e Faturas – garantir localStorage ───
  if (window.ERP_DATA) {
    localStorage.setItem('fa_medicoes', JSON.stringify(window.ERP_DATA.medicoes));
    localStorage.setItem('fa_medicoes_v2', JSON.stringify(window.ERP_DATA.medicoes));
    localStorage.setItem('fa_faturas', JSON.stringify(window.ERP_DATA.faturas));
    localStorage.setItem('fraser_medicoes', JSON.stringify(window.ERP_DATA.medicoes));
    localStorage.setItem('fraser_faturas', JSON.stringify(window.ERP_DATA.faturas));
    localStorage.setItem('fa_colaboradores', JSON.stringify(window.ERP_DATA.colaboradores));
    localStorage.setItem('fraser_colaboradores', JSON.stringify(window.ERP_DATA.colaboradores));
    localStorage.setItem('fa_equipamentos', JSON.stringify(window.ERP_DATA.equipamentos));
    localStorage.setItem('fraser_equipamentos', JSON.stringify(window.ERP_DATA.equipamentos));
    localStorage.setItem('fa_incidentes', JSON.stringify(window.ERP_DATA.incidentes));
    localStorage.setItem('fraser_incidentes', JSON.stringify(window.ERP_DATA.incidentes));
  }

  // ─── 46. Requisições Adicionais ──────────────────
  const reqExtra = [
    { id: 'REQ-005', rc_id: 'RC-2025-0006', contrato: 'CONT-003', solicitante: 'Diego Fonseca', descricao: 'Mandíbulas Britador – desgaste crítico OS-2025-0004', status: 'Em Compra', data: '2025-03-20', valor: 37000 },
    { id: 'REQ-006', rc_id: 'RC-2025-0007', contrato: 'CONT-004', solicitante: 'Pedro Castilho', descricao: 'Comissionamento perfuratriz DM45', status: 'Rascunho', data: '2025-03-28', valor: 5200 },
    { id: 'REQ-007', rc_id: 'RC-2025-0008', contrato: 'CONT-002', solicitante: 'Fernanda Costa', descricao: 'Suprimento mensal CONT-002 Abril', status: 'Aguardando Aprovação', data: '2025-03-26', valor: 18810 }
  ];
  const reqAtual = JSON.parse(localStorage.getItem('fa_requisicoes') || '[]');
  reqExtra.forEach(r => { if (!reqAtual.find(x => x.id === r.id)) reqAtual.push(r); });
  localStorage.setItem('fa_requisicoes', JSON.stringify(reqAtual));

  // ─── Sincronizar ERP_DATA com os dados do seed ───
  try {
    if (window.ERP_DATA) {
      // Garante que ERP_DATA.ordens inclui todas as OS do localStorage
      const osTudo = JSON.parse(localStorage.getItem('fa_os_list') || '[]');
      if (osTudo.length > window.ERP_DATA.ordens.length) {
        window.ERP_DATA.ordens = osTudo;
      }
    }
  } catch(e) {}

  // ─── Marcar seed como executado ───────────────────
  // ─── v10: IDF para fornecedores sem avaliação + sincronização ──────────────
  const idfV10 = [
    // FOR-014 DeltaTech Automação Industrial – Homologação
    { id: 'IDF-049', fornecedor_id: 'FOR-014', fornecedor: 'DeltaTech Automação Industrial', data: '2025-03-28', avaliador: 'Ricardo Almeida', tipo: 2, categoria: 2,
      scores: { gen_0: 3, gen_1: 3, gen_2: 3, gen_3: 3, gen_4: 3, equip_0: 3, equip_1: 3, equip_2: 3, equip_3: 3, equip_4: 3 },
      prazo: 60, qualidade: 63, preco: 61, atendimento: 62, score: 62,
      obs: 'Primeira avaliação em fase de homologação. Equipamentos instalados com ressalvas técnicas. Aguardando validação final.' },
    // FOR-021 NovaTec Instrumentação e Medição – Homologação
    { id: 'IDF-050', fornecedor_id: 'FOR-021', fornecedor: 'NovaTec Instrumentação e Medição', data: '2025-03-30', avaliador: 'Ana Paula Rocha', tipo: 2, categoria: 2,
      scores: { gen_0: 3, gen_1: 4, gen_2: 3, gen_3: 3, gen_4: 3, equip_0: 3, equip_1: 3, equip_2: 4, equip_3: 3, equip_4: 3 },
      prazo: 63, qualidade: 67, preco: 64, atendimento: 65, score: 65,
      obs: 'Instrumentos de medição com boa precisão. Documentação técnica incompleta. Em processo de regularização.' },
    // FOR-024 BioMax Meio Ambiente e Saneamento – Em Homologação
    { id: 'IDF-051', fornecedor_id: 'FOR-024', fornecedor: 'BioMax Meio Ambiente e Saneamento', data: '2025-04-01', avaliador: 'Patrícia Souza', tipo: 1, categoria: 2,
      scores: { gen_0: 3, gen_1: 3, gen_2: 4, gen_3: 3, gen_4: 3, serv_0: 3, serv_1: 4, serv_2: 3, serv_3: 3, serv_4: 3 },
      prazo: 64, qualidade: 66, preco: 63, atendimento: 65, score: 65,
      obs: 'Laudos ambientais entregues no prazo. Certificações IBAMA em processo de atualização. Homologação pendente de aprovação final.' },
    // FOR-036 PredialSul Manutenção e Conservação – Homologação
    { id: 'IDF-052', fornecedor_id: 'FOR-036', fornecedor: 'PredialSul Manutenção e Conservação', data: '2025-03-25', avaliador: 'Diego Fonseca', tipo: 1, categoria: 3,
      scores: { gen_0: 3, gen_1: 3, gen_2: 3, gen_3: 4, gen_4: 3, serv_0: 3, serv_1: 3, serv_2: 3, serv_3: 4, serv_4: 3 },
      prazo: 62, qualidade: 64, preco: 65, atendimento: 66, score: 64,
      obs: 'Serviços de limpeza e manutenção predial satisfatórios. Equipe em treinamento NR-35 para trabalho em altura.' },
    // FOR-039 ValveFit Válvulas e Conexões – Em Homologação
    { id: 'IDF-053', fornecedor_id: 'FOR-039', fornecedor: 'ValveFit Válvulas e Conexões Industriais', data: '2025-03-20', avaliador: 'Carlos Mendes', tipo: 3, categoria: 3,
      scores: { gen_0: 3, gen_1: 3, gen_2: 4, gen_3: 3, gen_4: 3, mat_0: 3, mat_1: 3, mat_2: 4, mat_3: 3, mat_4: 3 },
      prazo: 61, qualidade: 65, preco: 63, atendimento: 63, score: 63,
      obs: 'Catálogo de válvulas industriais adequado. Amostras aprovadas no teste de pressão. Aguardando certificação API.' },
    // FOR-052 RoboMin Automação e Robótica – Em Homologação
    { id: 'IDF-054', fornecedor_id: 'FOR-052', fornecedor: 'RoboMin Automação e Robótica', data: '2025-04-01', avaliador: 'Ricardo Almeida', tipo: 2, categoria: 1,
      scores: { gen_0: 4, gen_1: 3, gen_2: 4, gen_3: 3, gen_4: 4, equip_0: 4, equip_1: 3, equip_2: 4, equip_3: 3, equip_4: 4 },
      prazo: 67, qualidade: 70, preco: 65, atendimento: 68, score: 68,
      obs: 'Soluções robóticas inovadoras. Proposta técnica aprovada. Aguardando testes de integração com sistemas existentes.' },
    // FOR-054 MotorFrota Locação Veicular – Homologação
    { id: 'IDF-055', fornecedor_id: 'FOR-054', fornecedor: 'MotorFrota Locação Veicular', data: '2025-03-15', avaliador: 'Simone Lacerda', tipo: 1, categoria: 3,
      scores: { gen_0: 3, gen_1: 3, gen_2: 3, gen_3: 3, gen_4: 4, serv_0: 3, serv_1: 3, serv_2: 3, serv_3: 4, serv_4: 3 },
      prazo: 60, qualidade: 63, preco: 62, atendimento: 64, score: 62,
      obs: 'Frota de veículos leves adequada. Documentação de seguros e ANTT em regularização. Primeira avaliação.' }
  ];
  const idfAtualV10 = JSON.parse(localStorage.getItem('fa_idf_avaliacoes') || '[]');
  idfV10.forEach(i => { if (!idfAtualV10.find(x => x.id === i.id)) idfAtualV10.push(i); });
  localStorage.setItem('fa_idf_avaliacoes', JSON.stringify(idfAtualV10));

  // ─── Sincronização automática Fornecedores ↔ IDF ─────────────────────────
  // Garante que todo fornecedor com avaliação IDF existe na lista e vice-versa
  (function _syncFornecedoresIDF() {
    try {
      const fors = JSON.parse(localStorage.getItem('fa_fornecedores_cache') || '[]');
      const idfs = JSON.parse(localStorage.getItem('fa_idf_avaliacoes') || '[]');
      let changed = false;

      // 1) Atualiza idf_score de cada fornecedor com a avaliação mais recente
      fors.forEach(f => {
        const evals = idfs.filter(i => i.fornecedor_id === f.id);
        if (evals.length > 0) {
          const latest = evals.sort((a, b) => b.data.localeCompare(a.data))[0];
          if (f.idf_score !== latest.score) {
            f.idf_score = latest.score;
            // Atualiza avaliacao_geral baseado no score
            if (latest.score >= 90)      f.avaliacao_geral = 'A';
            else if (latest.score >= 70) f.avaliacao_geral = 'B';
            else if (latest.score >= 50) f.avaliacao_geral = 'C';
            else                         f.avaliacao_geral = 'D';
            changed = true;
          }
        }
      });

      // 2) Se IDF referenciar fornecedor que não existe, cria entrada básica
      idfs.forEach(idf => {
        if (!fors.find(f => f.id === idf.fornecedor_id)) {
          fors.push({
            id: idf.fornecedor_id,
            razao_social: idf.fornecedor,
            nome_fantasia: idf.fornecedor,
            cnpj: '00.000.000/0001-00',
            categoria: 'Não informado',
            status: 'Ativo',
            contato: 'Não informado',
            telefone: '',
            email: '',
            cidade: '',
            estado: '',
            idf_score: idf.score || 0,
            homologado: (idf.score || 0) >= 70,
            prazo_entrega: 0,
            avaliacao_geral: (idf.score||0) >= 90 ? 'A' : (idf.score||0) >= 70 ? 'B' : (idf.score||0) >= 50 ? 'C' : 'D',
            limite_credito: 0,
            condicao_pagamento: 'A definir',
            banco: '', agencia: '', conta: '',
            tipo: 'Não informado',
            categoria_fiscal: 'PJ Nacional',
            inscricao_estadual: 'Isento'
          });
          changed = true;
        }
      });

      if (changed) {
        localStorage.setItem('fa_fornecedores_cache', JSON.stringify(fors));
        localStorage.setItem('fraser_fornecedores', JSON.stringify(fors));
        console.log('[SYNC] ✅ Fornecedores e IDF sincronizados.');
      }
    } catch(e) { console.warn('[SYNC] Erro na sincronização:', e); }
  })();

  // ─── v11: Projetos Gantt completos (PROJ-001 a PROJ-004) ─────────────────────
  const projetosGantt = [
    // ── PROJ-001: Mina do Cerrado – Operação e Manutenção ─────────────────────
    {
      id: 'PROJ-001',
      nome: 'Mina do Cerrado – Op. e Manutenção',
      descricao: 'Operação e Manutenção de Equipamentos de Mineração – Contrato principal',
      contrato_id: 'CONT-001',
      cliente: 'Mineração Vale Verde Ltda',
      status: 'Em Andamento',
      data_inicio: '15/01/2024',
      data_fim: '14/01/2026',
      valor_contrato: 4800000,
      avanco_geral: 42,
      gerente: 'Ricardo Almeida',
      fases: [
        {
          id: 'FASE-MOB-1', nome: 'Mobilização',
          tarefas: [
            { id: 'T-001', nome: 'Montagem do Canteiro de Obra', tipo: 'Tarefa', inicio: '15/01/2024', fim: '31/01/2024', responsavel: 'Ricardo Almeida', avanco: 100, status: 'Concluída', descricao: 'Instalação de escritórios, refeitório e alojamentos', recursos: ['Equipe Infra x8', 'Caminhão Munck'], custo_previsto: 45000, custo_real: 48200 },
            { id: 'T-002', nome: 'Mobilização de Frota HD785 + PC800', tipo: 'Tarefa', inicio: '20/01/2024', fim: '10/02/2024', responsavel: 'Jair Oliveira', avanco: 100, status: 'Concluída', descricao: 'Transporte e inspeção dos equipamentos pesados', recursos: ['Equipe Mecânica x4', 'Prancha 60t', 'EQP-001', 'EQP-002'], custo_previsto: 32000, custo_real: 29500 },
            { id: 'T-003', nome: 'Treinamento NR-21 e NR-22 – 28 colaboradores', tipo: 'Tarefa', inicio: '05/02/2024', fim: '15/02/2024', responsavel: 'Patrícia Souza', avanco: 100, status: 'Concluída', descricao: 'Treinamentos obrigatórios de mineração e segurança', recursos: ['Instrutores x2', 'DeltaTech Automação'], custo_previsto: 18000, custo_real: 17400 },
            { id: 'T-004', nome: 'Marco: Aprovação Início de Operações', tipo: 'Marco', inicio: '15/02/2024', fim: '15/02/2024', responsavel: 'Ricardo Almeida', avanco: 100, status: 'Concluída', descricao: 'Aceite formal do cliente para início de operações', recursos: [], custo_previsto: 0, custo_real: 0 }
          ]
        },
        {
          id: 'FASE-OP-1', nome: 'Operação',
          tarefas: [
            { id: 'T-005', nome: 'Operação Escavadeira PC800 – Frente A', tipo: 'Tarefa', inicio: '16/02/2024', fim: '14/01/2026', responsavel: 'Jair Oliveira', avanco: 45, status: 'Em Andamento', descricao: 'Lavra contínua na Frente A – meta 18.000 t/mês', recursos: ['Operadores x4', 'EQP-001', 'Diesel S-10'], custo_previsto: 2280000, custo_real: 950000 },
            { id: 'T-006', nome: 'Operação HD785 – Transporte de Minério', tipo: 'Tarefa', inicio: '16/02/2024', fim: '14/01/2026', responsavel: 'Jair Oliveira', avanco: 45, status: 'Em Andamento', descricao: 'Transporte da frente de lavra até britagem primária', recursos: ['Motoristas x6', 'EQP-002', 'Diesel S-10'], custo_previsto: 1800000, custo_real: 740000 },
            { id: 'T-007', nome: 'Controle de Qualidade e Ensaios', tipo: 'Tarefa', inicio: '16/02/2024', fim: '14/01/2026', responsavel: 'Fernanda Costa', avanco: 44, status: 'Em Andamento', descricao: 'Ensaios de granulometria e teores mensais', recursos: ['Técnicos x2', 'LabGeoChem FOR-048'], custo_previsto: 96000, custo_real: 40000 }
          ]
        },
        {
          id: 'FASE-MAN-1', nome: 'Instalações',
          tarefas: [
            { id: 'T-008', nome: 'Manutenção Preventiva Mensal – PC800/HD785', tipo: 'Tarefa', inicio: '01/03/2024', fim: '14/01/2026', responsavel: 'Carlos Mendes', avanco: 40, status: 'Em Andamento', descricao: 'Troca de filtros, óleos e ajustes programados', recursos: ['Mecânicos x3', 'Komaflex FOR-007', 'Lubrax FOR-002'], custo_previsto: 432000, custo_real: 168000 },
            { id: 'T-009', nome: 'Manutenção Corretiva – Emergencial', tipo: 'Tarefa', inicio: '01/03/2024', fim: '14/01/2026', responsavel: 'Carlos Mendes', avanco: 35, status: 'Em Andamento', descricao: 'Intervenções não programadas – OS conforme demanda', recursos: ['Mecânicos x2', 'Komaflex FOR-007', 'Metso FOR-010'], custo_previsto: 240000, custo_real: 89000 },
            { id: 'T-010', nome: 'Inspeção SSMA e Relatório Mensal', tipo: 'Tarefa', inicio: '01/03/2024', fim: '14/01/2026', responsavel: 'Patrícia Souza', avanco: 43, status: 'Em Andamento', descricao: 'Rondas, DDS, investigação de incidentes e relatórios', recursos: ['Técnica SSMA x1', 'ProSafety FOR-012'], custo_previsto: 204000, custo_real: 84000 }
          ]
        }
      ],
      recursos: [
        { id: 'R-001', tipo: 'Equipe',      nome: 'Operadores de Equipamentos',  funcao: 'Operação de Escavadeira/HD785', quantidade: 10, unidade: 'pessoas', custo_unit: 5200, custo_total: 624000, fase: 'Operação',    fornecedor: '' },
        { id: 'R-002', tipo: 'Equipe',      nome: 'Mecânicos de Campo',           funcao: 'Manutenção Preventiva/Corretiva', quantidade: 5, unidade: 'pessoas', custo_unit: 5800, custo_total: 348000, fase: 'Instalações', fornecedor: '' },
        { id: 'R-003', tipo: 'Equipe',      nome: 'Técnica de SSMA',              funcao: 'Segurança e Meio Ambiente',      quantidade: 1, unidade: 'pessoas', custo_unit: 6800, custo_total: 163200, fase: 'Operação',    fornecedor: '' },
        { id: 'R-004', tipo: 'Equipamento', nome: 'Escavadeira PC800 (EX-001)',    especificacao: 'Komatsu PC800-8 – 2020', quantidade: 1, unidade: 'un',     custo_unit: 95000, custo_total: 2280000, fase: 'Operação',    fornecedor: 'Fraser Alexander' },
        { id: 'R-005', tipo: 'Equipamento', nome: 'Caminhão HD785 (HD-001)',       especificacao: 'Komatsu HD785-7 – 2019', quantidade: 1, unidade: 'un',     custo_unit: 75000, custo_total: 1800000, fase: 'Operação',    fornecedor: 'Fraser Alexander' },
        { id: 'R-006', tipo: 'Material',    nome: 'Diesel S-10',                   especificacao: '8.000 L/mês',             quantidade: 192000, unidade: 'L', custo_unit: 5.70, custo_total: 1094400, fase: 'Operação',    fornecedor: 'Diesel Sul FOR-004' },
        { id: 'R-007', tipo: 'Material',    nome: 'Lubrificantes e Graxas',        especificacao: 'Reposição mensal',         quantidade: 24, unidade: 'mês', custo_unit: 3500, custo_total: 84000,   fase: 'Instalações', fornecedor: 'Lubrax FOR-002' },
        { id: 'R-008', tipo: 'Serviço',     nome: 'Consultoria SSMA – ProSafety', especificacao: 'Laudos e auditorias',      quantidade: 24, unidade: 'mês', custo_unit: 6500, custo_total: 156000,  fase: 'Operação',    fornecedor: 'ProSafety FOR-012' }
      ],
      medicoes: [
        { id: 'MED-001', numero: 1, periodo: 'Fev-Mar/2024', descricao: 'Mobilização e início de operações – Mês 1-2', valor_medido: 320000, valor_acumulado: 320000, avanco_fisico: 7, status: 'Aprovada', data: '31/03/2024', responsavel: 'Ricardo Almeida', os_ids: [] },
        { id: 'MED-002', numero: 2, periodo: 'Abr/2024',     descricao: 'Operação plena – Mês 3 – 18.200 t lavradas', valor_medido: 200000, valor_acumulado: 520000, avanco_fisico: 11, status: 'Aprovada', data: '30/04/2024', responsavel: 'Ricardo Almeida', os_ids: ['OS-2025-0001'] },
        { id: 'MED-003', numero: 3, periodo: 'Mai-Jun/2024', descricao: 'Operação – Mês 4-5 – Manutenção PC800 incluída', valor_medido: 400000, valor_acumulado: 920000, avanco_fisico: 19, status: 'Aprovada', data: '30/06/2024', responsavel: 'Ricardo Almeida', os_ids: ['OS-2025-0001','OS-2025-0002'] },
        { id: 'MED-004', numero: 4, periodo: 'Jul-Set/2024', descricao: 'Operação Q3/2024 – produção acima da meta', valor_medido: 600000, valor_acumulado: 1520000, avanco_fisico: 32, status: 'Aprovada', data: '30/09/2024', responsavel: 'Ricardo Almeida', os_ids: [] },
        { id: 'MED-005', numero: 5, periodo: 'Out-Dez/2024', descricao: 'Operação Q4/2024', valor_medido: 400000, valor_acumulado: 1920000, avanco_fisico: 40, status: 'Aprovada', data: '31/12/2024', responsavel: 'Ricardo Almeida', os_ids: ['OS-2025-0005'] },
        { id: 'MED-006', numero: 6, periodo: 'Jan-Mar/2025', descricao: 'Operação Q1/2025 – em análise pelo cliente', valor_medido: 0, valor_acumulado: 1920000, avanco_fisico: 0, status: 'Pendente', data: '31/03/2025', responsavel: 'Ricardo Almeida', os_ids: [] }
      ],
      curva_planejada: [
        { mes: 'Jan/24', pct_plan: 2,  pct_real: 0 },
        { mes: 'Mar/24', pct_plan: 8,  pct_real: 7 },
        { mes: 'Jun/24', pct_plan: 19, pct_real: 19 },
        { mes: 'Set/24', pct_plan: 33, pct_real: 32 },
        { mes: 'Dez/24', pct_plan: 42, pct_real: 40 },
        { mes: 'Mar/25', pct_plan: 54, pct_real: 42 },
        { mes: 'Jun/25', pct_plan: 65, pct_real: null },
        { mes: 'Set/25', pct_plan: 78, pct_real: null },
        { mes: 'Dez/25', pct_plan: 90, pct_real: null },
        { mes: 'Jan/26', pct_plan: 100,pct_real: null }
      ],
      os_ids: ['OS-2025-0001','OS-2025-0002','OS-2025-0005'],
      criado_em: '10/01/2024',
      criado_por: 'Ricardo Almeida'
    },

    // ── PROJ-002: Cobre & Ouro – Terraplanagem Fase 3 ─────────────────────────
    {
      id: 'PROJ-002',
      nome: 'Cobre & Ouro – Terraplanagem Fase 3',
      descricao: 'Terraplanagem e Estradas de Mina – Fase 3 – Ampliação',
      contrato_id: 'CONT-002',
      cliente: 'Cobre & Ouro Mineração S/A',
      status: 'Em Andamento',
      data_inicio: '01/03/2024',
      data_fim: '31/08/2025',
      valor_contrato: 2350000,
      avanco_geral: 45,
      gerente: 'Fernanda Costa',
      fases: [
        {
          id: 'FASE-MOB-2', nome: 'Mobilização',
          tarefas: [
            { id: 'T-021', nome: 'Instalação de Base de Campo – PA', tipo: 'Tarefa', inicio: '01/03/2024', fim: '20/03/2024', responsavel: 'Fernanda Costa', avanco: 100, status: 'Concluída', descricao: 'Montagem de escritório e base operacional no PA', recursos: ['Equipe Infra x5'], custo_previsto: 28000, custo_real: 26500 },
            { id: 'T-022', nome: 'Mobilização GD655 e D155', tipo: 'Tarefa', inicio: '10/03/2024', fim: '25/03/2024', responsavel: 'Fernanda Costa', avanco: 100, status: 'Concluída', descricao: 'Envio de motoniveladora e trator de esteiras ao PA', recursos: ['EQP-003','EQP-006','Transportadora'], custo_previsto: 22000, custo_real: 24100 },
            { id: 'T-023', nome: 'Marco: Liberação de Frente de Trabalho', tipo: 'Marco', inicio: '25/03/2024', fim: '25/03/2024', responsavel: 'Fernanda Costa', avanco: 100, status: 'Concluída', descricao: 'Aprovação ambiental para início dos cortes', recursos: [], custo_previsto: 0, custo_real: 0 }
          ]
        },
        {
          id: 'FASE-CONST-2', nome: 'Construção',
          tarefas: [
            { id: 'T-024', nome: 'Corte e Aterro – Km 0+000 a Km 3+500', tipo: 'Tarefa', inicio: '26/03/2024', fim: '30/06/2024', responsavel: 'Fernanda Costa', avanco: 100, status: 'Concluída', descricao: 'Movimentação de 120.000 m³ – estrada principal', recursos: ['EQP-003','EQP-006','Motoristas x6'], custo_previsto: 380000, custo_real: 362000 },
            { id: 'T-025', nome: 'Corte e Aterro – Km 3+500 a Km 7+200', tipo: 'Tarefa', inicio: '01/07/2024', fim: '30/09/2024', responsavel: 'Fernanda Costa', avanco: 100, status: 'Concluída', descricao: 'Movimentação de 95.000 m³ – trecho B', recursos: ['EQP-003','EQP-006','InflaMax FOR-005'], custo_previsto: 310000, custo_real: 298000 },
            { id: 'T-026', nome: 'Drenagem e Bueiros – Trechos A e B', tipo: 'Tarefa', inicio: '15/07/2024', fim: '31/10/2024', responsavel: 'Diego Fonseca', avanco: 100, status: 'Concluída', descricao: 'Instalação de 48 bueiros metálicos e valetamento', recursos: ['Equipe Civil x6', 'HidroMax FOR-018'], custo_previsto: 145000, custo_real: 138000 }
          ]
        },
        {
          id: 'FASE-INST-2', nome: 'Instalações',
          tarefas: [
            { id: 'T-027', nome: 'Pavimentação Primária – Trecho C (Km 7+200 a 10+000)', tipo: 'Tarefa', inicio: '01/11/2024', fim: '28/02/2025', responsavel: 'Fernanda Costa', avanco: 80, status: 'Em Andamento', descricao: 'Aplicação de brita graduada e compactação', recursos: ['Motoniveladora','Rolo Compactador','Material Brita'], custo_previsto: 280000, custo_real: 215000 },
            { id: 'T-028', nome: 'Sinalização e Segurança Viária', tipo: 'Tarefa', inicio: '01/02/2025', fim: '31/03/2025', responsavel: 'Patrícia Souza', avanco: 40, status: 'Em Andamento', descricao: 'Placas, defensas e iluminação de emergência', recursos: ['ProSafety FOR-012','Equipe Sinalização x3'], custo_previsto: 65000, custo_real: 24000 },
            { id: 'T-029', nome: 'Pneus OTR – Substituição Programada', tipo: 'Tarefa', inicio: '15/03/2025', fim: '30/04/2025', responsavel: 'Carlos Mendes', avanco: 0, status: 'Não Iniciada', descricao: 'Troca de 4 pneus 23.5R25 GD655', recursos: ['InflaMax FOR-005','Mecânicos x2'], custo_previsto: 11200, custo_real: 0 }
          ]
        },
        {
          id: 'FASE-OP-2', nome: 'Operação',
          tarefas: [
            { id: 'T-030', nome: 'Operação Plena – Manutenção da Via', tipo: 'Tarefa', inicio: '01/05/2025', fim: '31/08/2025', responsavel: 'Fernanda Costa', avanco: 0, status: 'Não Iniciada', descricao: 'Manutenção contínua da estrada – 4 meses', recursos: ['GD655','D155','Equipe x4'], custo_previsto: 180000, custo_real: 0 },
            { id: 'T-031', nome: 'Marco: Entrega Final e Aceite Cliente', tipo: 'Marco', inicio: '31/08/2025', fim: '31/08/2025', responsavel: 'Fernanda Costa', avanco: 0, status: 'Não Iniciada', descricao: 'Termo de recebimento definitivo', recursos: [], custo_previsto: 0, custo_real: 0 }
          ]
        }
      ],
      recursos: [
        { id: 'R-021', tipo: 'Equipe',      nome: 'Operadores de Motoniveladora/Trator', funcao: 'Operação e Controle',     quantidade: 4, unidade: 'pessoas', custo_unit: 5400, custo_total: 259200, fase: 'Construção', fornecedor: '' },
        { id: 'R-022', tipo: 'Equipamento', nome: 'Motoniveladora GD655 (MN-001)',       especificacao: 'Komatsu GD655-5',  quantidade: 1, unidade: 'un',     custo_unit: 45000, custo_total: 810000, fase: 'Construção', fornecedor: 'Fraser Alexander' },
        { id: 'R-023', tipo: 'Equipamento', nome: 'Trator de Esteiras D155 (TR-001)',    especificacao: 'Komatsu D155AX-8', quantidade: 1, unidade: 'un',     custo_unit: 38000, custo_total: 684000, fase: 'Construção', fornecedor: 'Fraser Alexander' },
        { id: 'R-024', tipo: 'Material',    nome: 'Pneus OTR 23.5R25',                  especificacao: '4 unidades GD655',  quantidade: 4, unidade: 'un',     custo_unit: 2800, custo_total: 11200,  fase: 'Instalações', fornecedor: 'InflaMax FOR-005' },
        { id: 'R-025', tipo: 'Material',    nome: 'Brita Graduada e Rachão',             especificacao: '3.500 m³',          quantidade: 3500, unidade: 'm³', custo_unit: 48, custo_total: 168000,  fase: 'Instalações', fornecedor: 'SteelMax FOR-016' },
        { id: 'R-026', tipo: 'Serviço',     nome: 'Bueiros e Drenagem – HidroMax',       especificacao: '48 bueiros ø60',   quantidade: 48, unidade: 'un',   custo_unit: 2800, custo_total: 134400, fase: 'Construção', fornecedor: 'HidroMax FOR-018' }
      ],
      medicoes: [
        { id: 'MED-011', numero: 1, periodo: 'Mar-Mai/2024', descricao: 'Mobilização + Corte 0-3.5 km iniciado', valor_medido: 188000, valor_acumulado: 188000, avanco_fisico: 8, status: 'Aprovada', data: '31/05/2024', responsavel: 'Fernanda Costa', os_ids: [] },
        { id: 'MED-012', numero: 2, periodo: 'Jun-Set/2024', descricao: 'Corte 0-7.2 km concluído + Drenagem 60%', valor_medido: 376000, valor_acumulado: 564000, avanco_fisico: 24, status: 'Aprovada', data: '30/09/2024', responsavel: 'Fernanda Costa', os_ids: [] },
        { id: 'MED-013', numero: 3, periodo: 'Out-Dez/2024', descricao: 'Drenagem concluída + Pavimentação iniciada', valor_medido: 376000, valor_acumulado: 940000, avanco_fisico: 40, status: 'Aprovada', data: '31/12/2024', responsavel: 'Fernanda Costa', os_ids: [] },
        { id: 'MED-014', numero: 4, periodo: 'Jan-Mar/2025', descricao: 'Pavimentação trecho C + Sinalização 40%', valor_medido: 0, valor_acumulado: 940000, avanco_fisico: 0, status: 'Pendente', data: '31/03/2025', responsavel: 'Fernanda Costa', os_ids: ['OS-2025-0003'] }
      ],
      curva_planejada: [
        { mes: 'Mar/24', pct_plan: 5,  pct_real: 4 },
        { mes: 'Jun/24', pct_plan: 22, pct_real: 22 },
        { mes: 'Set/24', pct_plan: 42, pct_real: 40 },
        { mes: 'Dez/24', pct_plan: 60, pct_real: 58 },
        { mes: 'Mar/25', pct_plan: 72, pct_real: 62 },
        { mes: 'Jun/25', pct_plan: 88, pct_real: null },
        { mes: 'Ago/25', pct_plan: 100,pct_real: null }
      ],
      os_ids: ['OS-2025-0003'],
      criado_em: '20/02/2024',
      criado_por: 'Fernanda Costa'
    },

    // ── PROJ-003: Bauxita do Norte – Britagem ─────────────────────────────────
    {
      id: 'PROJ-003',
      nome: 'Bauxita do Norte – Britagem Primária/Sec.',
      descricao: 'Serviços de Britagem Primária e Secundária – Operação Contínua',
      contrato_id: 'CONT-003',
      cliente: 'Bauxita do Norte Ind. e Com.',
      status: 'Em Andamento',
      data_inicio: '01/08/2023',
      data_fim: '31/07/2025',
      valor_contrato: 1800000,
      avanco_geral: 80,
      gerente: 'Carlos Mendes',
      fases: [
        {
          id: 'FASE-MOB-3', nome: 'Mobilização',
          tarefas: [
            { id: 'T-041', nome: 'Instalação e Comissionamento – Britador C160', tipo: 'Tarefa', inicio: '01/08/2023', fim: '31/08/2023', responsavel: 'Carlos Mendes', avanco: 100, status: 'Concluída', descricao: 'Montagem mecânica, elétrica e testes iniciais', recursos: ['Metso FOR-010','Equipe Mecânica x6'], custo_previsto: 85000, custo_real: 91200 },
            { id: 'T-042', nome: 'Treinamento Equipe de Britagem – 10 operadores', tipo: 'Tarefa', inicio: '15/08/2023', fim: '31/08/2023', responsavel: 'Carlos Mendes', avanco: 100, status: 'Concluída', descricao: 'Qualificação NR-12 e operação de britadores', recursos: ['Instrutores','AirTec FOR-017'], custo_previsto: 12000, custo_real: 11500 },
            { id: 'T-043', nome: 'Marco: Start-up da Planta', tipo: 'Marco', inicio: '01/09/2023', fim: '01/09/2023', responsavel: 'Carlos Mendes', avanco: 100, status: 'Concluída', descricao: 'Primeira corrida de produção aprovada', recursos: [], custo_previsto: 0, custo_real: 0 }
          ]
        },
        {
          id: 'FASE-OP-3', nome: 'Operação',
          tarefas: [
            { id: 'T-044', nome: 'Britagem Primária – 180 t/h meta', tipo: 'Tarefa', inicio: '01/09/2023', fim: '31/07/2025', responsavel: 'Carlos Mendes', avanco: 85, status: 'Em Andamento', descricao: 'Operação contínua 3 turnos – 6 dias/semana', recursos: ['Operadores x6','EQP-004','Diesel S-10'], custo_previsto: 900000, custo_real: 756000 },
            { id: 'T-045', nome: 'Britagem Secundária e Peneiramento', tipo: 'Tarefa', inicio: '01/09/2023', fim: '31/07/2025', responsavel: 'Diego Fonseca', avanco: 82, status: 'Em Andamento', descricao: 'Redução para fração -19mm e +12mm', recursos: ['Operadores x4','Grelha Vibratória'], custo_previsto: 540000, custo_real: 449000 },
            { id: 'T-046', nome: 'Controle de Granulometria e Teores', tipo: 'Tarefa', inicio: '01/09/2023', fim: '31/07/2025', responsavel: 'Diego Fonseca', avanco: 80, status: 'Em Andamento', descricao: 'Análises diárias de amostras – laboratório in loco', recursos: ['Técnico Lab x1','LabGeoChem FOR-048'], custo_previsto: 120000, custo_real: 97000 }
          ]
        },
        {
          id: 'FASE-MAN-3', nome: 'Instalações',
          tarefas: [
            { id: 'T-047', nome: 'Troca de Mandíbulas Britador – Desgaste', tipo: 'Tarefa', inicio: '01/01/2024', fim: '31/07/2025', responsavel: 'Carlos Mendes', avanco: 60, status: 'Em Andamento', descricao: 'Substituição programada a cada 120 dias – 6 ciclos', recursos: ['Metso FOR-010','Abrasivos FOR-008'], custo_previsto: 111000, custo_real: 74000 },
            { id: 'T-048', nome: 'Manutenção Sistema Hidráulico e Pneumático', tipo: 'Tarefa', inicio: '01/09/2023', fim: '31/07/2025', responsavel: 'Carlos Mendes', avanco: 78, status: 'Em Andamento', descricao: 'Revisão mensal de cilindros e compressores', recursos: ['HidroMax FOR-018','AirTec FOR-017'], custo_previsto: 96000, custo_real: 73000 }
          ]
        }
      ],
      recursos: [
        { id: 'R-041', tipo: 'Equipe',      nome: 'Operadores de Britagem',       funcao: 'Operação 3 turnos',       quantidade: 10, unidade: 'pessoas', custo_unit: 4500, custo_total: 1080000, fase: 'Operação',     fornecedor: '' },
        { id: 'R-042', tipo: 'Equipamento', nome: 'Britador Primário Metso C160', especificacao: 'Nordberg C160 2018', quantidade: 1, unidade: 'un',    custo_unit: 0, custo_total: 0, fase: 'Operação',     fornecedor: 'Fraser Alexander' },
        { id: 'R-043', tipo: 'Material',    nome: 'Mandíbulas Britador (desgaste)',especificacao: 'Par – 6 ciclos',   quantidade: 6, unidade: 'par',    custo_unit: 18500, custo_total: 111000, fase: 'Instalações', fornecedor: 'Metso FOR-010' },
        { id: 'R-044', tipo: 'Serviço',     nome: 'Análises LabGeoChem',          especificacao: 'Diárias + relatório', quantidade: 24, unidade: 'mês', custo_unit: 5000, custo_total: 120000, fase: 'Operação',     fornecedor: 'LabGeoChem FOR-048' }
      ],
      medicoes: [
        { id: 'MED-021', numero: 1, periodo: 'Set-Nov/2023', descricao: 'Início de Operação – 3 meses / 185.000 t processadas', valor_medido: 450000, valor_acumulado: 450000, avanco_fisico: 25, status: 'Aprovada', data: '30/11/2023', responsavel: 'Carlos Mendes', os_ids: [] },
        { id: 'MED-022', numero: 2, periodo: 'Dez/23-Mar/24', descricao: 'Operação Q4/23-Q1/24 + Troca mandíbulas', valor_medido: 450000, valor_acumulado: 900000, avanco_fisico: 50, status: 'Aprovada', data: '31/03/2024', responsavel: 'Carlos Mendes', os_ids: ['OS-2025-0004'] },
        { id: 'MED-023', numero: 3, periodo: 'Abr-Jul/2024', descricao: 'Operação Q2/2024 – 195.000 t – acima da meta', valor_medido: 270000, valor_acumulado: 1170000, avanco_fisico: 65, status: 'Aprovada', data: '31/07/2024', responsavel: 'Carlos Mendes', os_ids: [] },
        { id: 'MED-024', numero: 4, periodo: 'Ago-Dez/2024', descricao: 'Operação Q3-Q4/2024 – 2ª troca de mandíbulas', valor_medido: 270000, valor_acumulado: 1440000, avanco_fisico: 80, status: 'Aprovada', data: '31/12/2024', responsavel: 'Carlos Mendes', os_ids: ['OS-2025-0004'] },
        { id: 'MED-025', numero: 5, periodo: 'Jan-Jul/2025', descricao: 'Encerramento – operação final + desmobilização', valor_medido: 0, valor_acumulado: 1440000, avanco_fisico: 0, status: 'Pendente', data: '31/07/2025', responsavel: 'Carlos Mendes', os_ids: [] }
      ],
      curva_planejada: [
        { mes: 'Set/23', pct_plan: 12, pct_real: 11 },
        { mes: 'Dez/23', pct_plan: 25, pct_real: 25 },
        { mes: 'Mar/24', pct_plan: 50, pct_real: 50 },
        { mes: 'Jun/24', pct_plan: 65, pct_real: 65 },
        { mes: 'Set/24', pct_plan: 75, pct_real: 72 },
        { mes: 'Dez/24', pct_plan: 85, pct_real: 80 },
        { mes: 'Mar/25', pct_plan: 93, pct_real: null },
        { mes: 'Jul/25', pct_plan: 100,pct_real: null }
      ],
      os_ids: ['OS-2025-0004','OS-2025-0006'],
      criado_em: '15/07/2023',
      criado_por: 'Carlos Mendes'
    },

    // ── PROJ-004: Ferro Bruto – Desmonte a Fogo ───────────────────────────────
    {
      id: 'PROJ-004',
      nome: 'Ferro Bruto – Perfuração e Desmonte',
      descricao: 'Perfuração, Desmonte a Fogo e Carregamento de Minério',
      contrato_id: 'CONT-004',
      cliente: 'Ferro Bruto Extração Ltda',
      status: 'Em Andamento',
      data_inicio: '01/02/2025',
      data_fim: '31/01/2027',
      valor_contrato: 3200000,
      avanco_geral: 10,
      gerente: 'Ana Paula Rocha',
      fases: [
        {
          id: 'FASE-MOB-4', nome: 'Mobilização',
          tarefas: [
            { id: 'T-061', nome: 'Montagem de Base Operacional – GO', tipo: 'Tarefa', inicio: '01/02/2025', fim: '20/02/2025', responsavel: 'Ana Paula Rocha', avanco: 100, status: 'Concluída', descricao: 'Canteiro, alojamento e refeitório – 20 colaboradores', recursos: ['Equipe Infra x6','MotorFrota FOR-054'], custo_previsto: 35000, custo_real: 37200 },
            { id: 'T-062', nome: 'Mobilização Perfuratriz DM45 + Trator', tipo: 'Tarefa', inicio: '10/02/2025', fim: '28/02/2025', responsavel: 'Pedro Castilho', avanco: 100, status: 'Concluída', descricao: 'Transporte da perfuratriz e equipamentos de apoio', recursos: ['EQP-005','Prancha 80t','BrasTrans FOR-020'], custo_previsto: 28000, custo_real: 31500 },
            { id: 'T-063', nome: 'Licenças e APRs de Desmonte – ANTT/ANM', tipo: 'Tarefa', inicio: '01/02/2025', fim: '15/03/2025', responsavel: 'Ana Paula Rocha', avanco: 80, status: 'Em Andamento', descricao: 'Regularização junto ao ANM e ANTT para uso de explosivos', recursos: ['JurisMinas FOR-047','ExploBras FOR-053'], custo_previsto: 18000, custo_real: 14000 },
            { id: 'T-064', nome: 'Treinamento NR-22 e Explosivos – 20 colaboradores', tipo: 'Tarefa', inicio: '01/03/2025', fim: '20/03/2025', responsavel: 'Patrícia Souza', avanco: 40, status: 'Em Andamento', descricao: 'Capacitação para desmonte a fogo e manuseio de explosivos', recursos: ['Instrutores NR-22','ExploBras FOR-053'], custo_previsto: 24000, custo_real: 9600 },
            { id: 'T-065', nome: 'Marco: Licença de Operação ANM Emitida', tipo: 'Marco', inicio: '20/03/2025', fim: '20/03/2025', responsavel: 'Ana Paula Rocha', avanco: 0, status: 'Não Iniciada', descricao: 'Condicionante para início do desmonte', recursos: [], custo_previsto: 0, custo_real: 0 }
          ]
        },
        {
          id: 'FASE-CONST-4', nome: 'Construção',
          tarefas: [
            { id: 'T-066', nome: 'Perfuração e Desmonte – Bancada 1 (Frente Sul)', tipo: 'Tarefa', inicio: '01/04/2025', fim: '31/10/2025', responsavel: 'Pedro Castilho', avanco: 0, status: 'Não Iniciada', descricao: 'Perfuração de 8.500 m + 12 desmontes programados', recursos: ['EQP-005','Perfuradores x4','ExploBras FOR-053'], custo_previsto: 680000, custo_real: 0 },
            { id: 'T-067', nome: 'Carregamento e Transporte – Frente Sul', tipo: 'Tarefa', inicio: '01/04/2025', fim: '31/10/2025', responsavel: 'Pedro Castilho', avanco: 0, status: 'Não Iniciada', descricao: 'Carregamento e remoção de 250.000 t de minério', recursos: ['Carregadeiras x2','Motoristas x6'], custo_previsto: 520000, custo_real: 0 },
            { id: 'T-068', nome: 'Marco: Entrega Bancada 1', tipo: 'Marco', inicio: '31/10/2025', fim: '31/10/2025', responsavel: 'Ana Paula Rocha', avanco: 0, status: 'Não Iniciada', descricao: 'Relatório de produção e avanço Bancada 1', recursos: [], custo_previsto: 0, custo_real: 0 }
          ]
        },
        {
          id: 'FASE-INST-4', nome: 'Comissionamento',
          tarefas: [
            { id: 'T-069', nome: 'Perfuração Bancada 2 – Frente Norte', tipo: 'Tarefa', inicio: '01/11/2025', fim: '30/06/2026', responsavel: 'Pedro Castilho', avanco: 0, status: 'Não Iniciada', descricao: 'Continuação – 7.800 m perfuração + 10 desmontes', recursos: ['EQP-005','ExploBras FOR-053'], custo_previsto: 580000, custo_real: 0 },
            { id: 'T-070', nome: 'Gestão de Riscos e SSMA Contínuo', tipo: 'Tarefa', inicio: '01/04/2025', fim: '31/01/2027', responsavel: 'Patrícia Souza', avanco: 0, status: 'Não Iniciada', descricao: 'DDS diários, FISPQ, plano de emergência e auditorias', recursos: ['ClínicaMinas FOR-055','ProSafety FOR-012'], custo_previsto: 288000, custo_real: 0 }
          ]
        },
        {
          id: 'FASE-OP-4', nome: 'Operação',
          tarefas: [
            { id: 'T-071', nome: 'Perfuração Bancada 3 + Encerramento', tipo: 'Tarefa', inicio: '01/07/2026', fim: '31/01/2027', responsavel: 'Pedro Castilho', avanco: 0, status: 'Não Iniciada', descricao: 'Último ciclo + Relatório Final e desmobilização', recursos: ['EQP-005','ExploBras FOR-053'], custo_previsto: 430000, custo_real: 0 },
            { id: 'T-072', nome: 'Marco: Entrega Final – Contrato Concluído', tipo: 'Marco', inicio: '31/01/2027', fim: '31/01/2027', responsavel: 'Ana Paula Rocha', avanco: 0, status: 'Não Iniciada', descricao: 'Termo de encerramento e aceite do cliente', recursos: [], custo_previsto: 0, custo_real: 0 }
          ]
        }
      ],
      recursos: [
        { id: 'R-061', tipo: 'Equipe',      nome: 'Perfuradores e Operadores Fogo', funcao: 'Perfuração e Desmonte',    quantidade: 8, unidade: 'pessoas', custo_unit: 6200, custo_total: 595200, fase: 'Construção', fornecedor: '' },
        { id: 'R-062', tipo: 'Equipamento', nome: 'Perfuratriz DM45 (PF-001)',       especificacao: 'Caterpillar DM45',  quantidade: 1, unidade: 'un',    custo_unit: 0, custo_total: 0, fase: 'Construção', fornecedor: 'Fraser Alexander' },
        { id: 'R-063', tipo: 'Material',    nome: 'Explosivos ANFO e Acessórios',    especificacao: '24 desmontes tot.', quantidade: 24, unidade: 'vb',  custo_unit: 28000, custo_total: 672000, fase: 'Construção', fornecedor: 'ExploBras FOR-053' },
        { id: 'R-064', tipo: 'Serviço',     nome: 'Consultoria Jurídica – JurisMinas', especificacao: 'Licenças ANM',   quantidade: 12, unidade: 'mês', custo_unit: 8500, custo_total: 102000, fase: 'Mobilização', fornecedor: 'JurisMinas FOR-047' },
        { id: 'R-065', tipo: 'Serviço',     nome: 'Saúde Ocupacional – ClínicaMinas', especificacao: 'ASO + PCMSOs',    quantidade: 24, unidade: 'mês', custo_unit: 4200, custo_total: 100800, fase: 'Operação',    fornecedor: 'ClínicaMinas FOR-055' }
      ],
      medicoes: [
        { id: 'MED-031', numero: 1, periodo: 'Fev-Mar/2025', descricao: 'Mobilização – 30% concluída', valor_medido: 160000, valor_acumulado: 160000, avanco_fisico: 5, status: 'Aprovada', data: '31/03/2025', responsavel: 'Ana Paula Rocha', os_ids: [] },
        { id: 'MED-032', numero: 2, periodo: 'Abr/2025', descricao: 'Licenciamento e Treinamentos – em andamento', valor_medido: 0, valor_acumulado: 160000, avanco_fisico: 0, status: 'Pendente', data: '30/04/2025', responsavel: 'Ana Paula Rocha', os_ids: ['OS-2025-0007','OS-2025-0008'] }
      ],
      curva_planejada: [
        { mes: 'Fev/25', pct_plan: 3,  pct_real: 3 },
        { mes: 'Abr/25', pct_plan: 8,  pct_real: 5 },
        { mes: 'Jul/25', pct_plan: 22, pct_real: null },
        { mes: 'Out/25', pct_plan: 40, pct_real: null },
        { mes: 'Jan/26', pct_plan: 55, pct_real: null },
        { mes: 'Abr/26', pct_plan: 68, pct_real: null },
        { mes: 'Jul/26', pct_plan: 80, pct_real: null },
        { mes: 'Out/26', pct_plan: 92, pct_real: null },
        { mes: 'Jan/27', pct_plan: 100,pct_real: null }
      ],
      os_ids: ['OS-2025-0007','OS-2025-0008'],
      criado_em: '25/01/2025',
      criado_por: 'Ana Paula Rocha'
    }
  ];

  // Salva os projetos Gantt apenas se não existirem (preserva edições do usuário)
  const pgAtual = JSON.parse(localStorage.getItem('fa_projetos_gantt') || '[]');
  let pgChanged = false;
  projetosGantt.forEach(p => {
    if (!pgAtual.find(x => x.id === p.id)) {
      pgAtual.push(p);
      pgChanged = true;
    }
  });
  if (pgChanged) {
    localStorage.setItem('fa_projetos_gantt', JSON.stringify(pgAtual));
    console.log('[SEED] ✅ Projetos Gantt carregados: PROJ-001 a PROJ-004 (fases WBS + tarefas + recursos + medições)');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── v12: PROJETO COMPLETO "LITHIUM POWER" – Ciclo Integral ───────────────
  // CRM → Proposta → Contrato → WBS → OS → RC → RFQ → Mapa → Pedido →
  // Medição → Faturamento → Contas a Pagar → Gantt → Financeiro
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 12.1 CRM: Lead + Proposta + Atividades ──────────────────────────────
  const crmAtual = JSON.parse(localStorage.getItem('fa_crm_data') || '{"leads":[],"propostas":[],"atividades":[],"contatos":[],"oportunidades":[]}');

  const litLead = {
    id: 'LEAD-006', empresa: 'Lithium Power Mineração S/A', segmento: 'Mineração de Lítio',
    contato: 'Dr. Henrique Carvalho', cargo: 'Diretor de Operações',
    email: 'hcarvalho@lithiumpower.com.br', telefone: '(11) 3400-8800',
    origem: 'Prospecção Ativa', potencial: 8500000, probabilidade: 100,
    etapa: 'Fechado Ganho', responsavel: 'Ana Paula Rocha',
    criado: '10/01/2025', ultimaAcao: '10/04/2025',
    obs: 'Proposta técnica aprovada – Contrato CONT-006 assinado em 10/04/2025.',
    contrato_vinculado: 'CONT-006'
  };
  const litProposta = {
    id: 'PROP-006', numero: 'PROP-006', lead: 'LEAD-006',
    cliente: 'Lithium Power Mineração S/A',
    descricao: 'Operação de Mina Subterrânea – Camadas Espodumênio Fase 1',
    objeto: 'Operação, Manutenção e SSMA – Mina Subterrânea',
    valor: 8500000, status: 'Aprovada', data: '15/02/2025', validade: '15/05/2025',
    responsavel: 'Ana Paula Rocha', margem: 22,
    escopo: 'Operação de 2 frentes de lavra subterrânea + manutenção de frota + SSMA + laboratório',
    contrato_vinculado: 'CONT-006',
    obs: 'Proposta revisada com prazo de mobilização de 75 dias'
  };
  const litAtividades = [
    { id: 'ATI-006', lead: 'LEAD-006', tipo: 'Prospecção', descricao: 'Primeiro contato – evento ABM Mineração 2024', data: '05/11/2024', responsavel: 'Ana Paula Rocha', status: 'Realizada', resultado: 'Cliente demonstrou interesse em operação subterrânea' },
    { id: 'ATI-007', lead: 'LEAD-006', tipo: 'Visita Técnica', descricao: 'Visita ao site – Mina Lithium Power – Araçuaí/MG', data: '15/01/2025', responsavel: 'Ana Paula Rocha', status: 'Realizada', resultado: 'Levantamento de escopo concluído; 2 frentes ativas' },
    { id: 'ATI-008', lead: 'LEAD-006', tipo: 'Reunião', descricao: 'Apresentação proposta técnica + financeira – São Paulo', data: '20/02/2025', responsavel: 'Ana Paula Rocha', status: 'Realizada', resultado: 'Cliente aprovou escopo; pediu revisão de prazo de mobilização' },
    { id: 'ATI-009', lead: 'LEAD-006', tipo: 'Negociação', descricao: 'Negociação final – prazo 75 dias + reajuste IPCA semestral', data: '10/03/2025', responsavel: 'Ana Paula Rocha', status: 'Realizada', resultado: 'Acordo fechado. Minuta contratual enviada para jurídico' },
    { id: 'ATI-010', lead: 'LEAD-006', tipo: 'Assinatura', descricao: 'Assinatura do CONT-006 – São Paulo / presencial', data: '10/04/2025', responsavel: 'Ana Paula Rocha', status: 'Realizada', resultado: 'Contrato assinado. Ordem de Serviço inicial emitida' }
  ];
  const litOportunidade = {
    id: 'OPP-006', cliente: 'Lithium Power Mineração S/A',
    servico: 'Operação de Mina Subterrânea – Fase 1',
    valor_estimado: 8500000, fase: 'Contrato Assinado', probabilidade: 100,
    responsavel: 'Ana Paula Rocha', previsao_fechamento: '2025-04-10',
    criado_em: iso('2025-01-10'), observacoes: 'CONT-006 assinado – mobilização em andamento'
  };
  const litContato = {
    id: 'CONT-CRM-006', nome: 'Dr. Henrique Carvalho', cargo: 'Diretor de Operações',
    empresa: 'Lithium Power Mineração S/A', email: 'hcarvalho@lithiumpower.com.br',
    telefone: '(11) 3400-8800', cidade: 'São Paulo', decisor: true
  };

  if (!crmAtual.leads.find(l => l.id === 'LEAD-006')) crmAtual.leads.push(litLead);
  if (!crmAtual.propostas.find(p => p.id === 'PROP-006')) crmAtual.propostas.push(litProposta);
  litAtividades.forEach(a => { if (!crmAtual.atividades.find(x => x.id === a.id)) crmAtual.atividades.push(a); });
  if (!crmAtual.oportunidades.find(o => o.id === 'OPP-006')) crmAtual.oportunidades.push(litOportunidade);
  if (!crmAtual.contatos.find(c => c.id === 'CONT-CRM-006')) crmAtual.contatos.push(litContato);
  localStorage.setItem('fa_crm_data', JSON.stringify(crmAtual));
  localStorage.setItem('fraser_crm_oportunidades', JSON.stringify(crmAtual.oportunidades));

  // ── 12.2 CONTRATO CONT-006 ──────────────────────────────────────────────
  const contratosAtual = JSON.parse(localStorage.getItem('fa_contratos') || '[]');
  const cont006 = {
    id: 'CONT-006', cliente: 'Lithium Power Mineração S/A',
    objeto: 'Operação de Mina Subterrânea – Camadas Espodumênio Fase 1',
    descricao: 'Operação de 2 frentes de lavra subterrânea + manutenção de frota + SSMA + laboratório',
    valor: 8500000, medidoAcum: 340000, custoAcum: 270000, status: 'Mobilização',
    inicio: '2025-04-15', fim: '2028-04-14', equipe: 35, equipamentos: 8,
    gestor: 'Ana Paula Rocha', contato_cliente: 'Dr. Henrique Carvalho',
    tipo: 'Mina Subterrânea', unidade: 'Mina Lithium Power – Araçuaí/MG', moeda: 'BRL',
    margem: 22, progress: 4, ssmaStatus: 'Pendente',
    observacoes: 'Contrato de 36 meses – mobilização iniciada em 15/04/2025',
    proposta_origem: 'PROP-006', lead_origem: 'LEAD-006',
    reajuste: 'IPCA semestral', prazo_mobilizacao: '75 dias',
    data_assinatura: '10/04/2025', data_inicio_operacao: '2025-07-01'
  };
  if (!contratosAtual.find(c => c.id === 'CONT-006')) contratosAtual.push(cont006);
  localStorage.setItem('fa_contratos', JSON.stringify(contratosAtual));

  // Atualiza ERP_DATA.contratos se disponível
  try {
    if (window.ERP_DATA && window.ERP_DATA.contratos && !window.ERP_DATA.contratos.find(c => c.id === 'CONT-006')) {
      window.ERP_DATA.contratos.push(cont006);
    }
  } catch(e) {}

  // ── 12.3 WBS / CUSTOS PROJ-006 ──────────────────────────────────────────
  const wbsAtual = JSON.parse(localStorage.getItem('fraser_custos_projetos') || '[]');
  const wbs006 = [
    // Nível 1 – Grupos
    { id: 'P6-1',    projeto_id:'PROJ-006', nivel:1, g1:'1', g2:'', g3:'', item:'', descricao:'Equipamentos e Operação', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0, custo_real:0, custo_proj:0, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:0, nao_previsto:false },
    { id: 'P6-2',    projeto_id:'PROJ-006', nivel:1, g1:'2', g2:'', g3:'', item:'', descricao:'Pessoal e Mão de Obra', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0, custo_real:0, custo_proj:0, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:0, nao_previsto:false },
    { id: 'P6-3',    projeto_id:'PROJ-006', nivel:1, g1:'3', g2:'', g3:'', item:'', descricao:'Materiais e Insumos', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0, custo_real:0, custo_proj:0, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:0, nao_previsto:false },
    { id: 'P6-4',    projeto_id:'PROJ-006', nivel:1, g1:'4', g2:'', g3:'', item:'', descricao:'Alimentação e Acomodação', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0, custo_real:0, custo_proj:0, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:0, nao_previsto:false },
    { id: 'P6-5',    projeto_id:'PROJ-006', nivel:1, g1:'5', g2:'', g3:'', item:'', descricao:'SSMA e Segurança', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0, custo_real:0, custo_proj:0, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:0, nao_previsto:false },
    { id: 'P6-6',    projeto_id:'PROJ-006', nivel:1, g1:'6', g2:'', g3:'', item:'', descricao:'Laboratório e Análises', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0, custo_real:0, custo_proj:0, custo_spot:0, variacao:0, variacao_pct:0, preco_venda:0, nao_previsto:false },
    // Nível 2 – Itens de custo
    { id: 'P6-1.1',  projeto_id:'PROJ-006', nivel:2, g1:'1', g2:'1', g3:'', item:'', descricao:'Jumbos de Perfuração – 2 unidades', natureza:'EQP', expenditure:'OPEX', tipo:'OPEX', unidade:'mês', qtd:36, v_unit_est:85000, v_total_est:3060000, est_total:3060000, custo_real:85000, custo_proj:3060000, custo_spot:0, custo_contrato:3060000, variacao:2975000, variacao_pct:97, preco_venda:3825000, nao_previsto:false, fornecedor:'Fraser Alexander', obs:'Jumbo elétrico Sandvik DD420 + Atlas Copco Boomer' },
    { id: 'P6-1.2',  projeto_id:'PROJ-006', nivel:2, g1:'1', g2:'2', g3:'', item:'', descricao:'LHD Scoop Elétrico – 4 unidades', natureza:'EQP', expenditure:'OPEX', tipo:'OPEX', unidade:'mês', qtd:36, v_unit_est:52000, v_total_est:1872000, est_total:1872000, custo_real:52000, custo_proj:1872000, custo_spot:0, custo_contrato:1872000, variacao:1820000, variacao_pct:97, preco_venda:2340000, nao_previsto:false, fornecedor:'Fraser Alexander', obs:'Sandvik LH514E' },
    { id: 'P6-1.3',  projeto_id:'PROJ-006', nivel:2, g1:'1', g2:'3', g3:'', item:'', descricao:'Manutenção de Frota Subterrânea', natureza:'MAN', expenditure:'OPEX', tipo:'OPEX', unidade:'mês', qtd:36, v_unit_est:18000, v_total_est:648000, est_total:648000, custo_real:18000, custo_proj:648000, custo_spot:0, custo_contrato:648000, variacao:630000, variacao_pct:97, preco_venda:810000, nao_previsto:false, fornecedor:'TurbineServ FOR-041', obs:'OS-CONT-006' },
    { id: 'P6-2.1',  projeto_id:'PROJ-006', nivel:2, g1:'2', g2:'1', g3:'', item:'', descricao:'Mão de Obra Direta – 35 colaboradores', natureza:'MOD', expenditure:'OPEX', tipo:'OPEX', unidade:'mês', qtd:35, v_unit_est:7800, v_total_est:9828000, est_total:9828000, custo_real:218800, custo_proj:9828000, custo_spot:0, custo_contrato:9828000, variacao:9609200, variacao_pct:98, preco_venda:12285000, nao_previsto:false, fornecedor:'Fraser Alexander', obs:'28 operadores + 4 mecânicos + 2 supervisores + 1 gerente' },
    { id: 'P6-3.1',  projeto_id:'PROJ-006', nivel:2, g1:'3', g2:'1', g3:'', item:'', descricao:'Explosivos e Acessórios de Desmonte', natureza:'INS', expenditure:'OPEX', tipo:'OPEX', unidade:'mês', qtd:36, v_unit_est:12500, v_total_est:450000, est_total:450000, custo_real:12500, custo_proj:450000, custo_spot:0, custo_contrato:450000, variacao:437500, variacao_pct:97, preco_venda:562500, nao_previsto:false, fornecedor:'ExploBras FOR-053', obs:'ANFO + detonadores + acessórios' },
    { id: 'P6-3.2',  projeto_id:'PROJ-006', nivel:2, g1:'3', g2:'2', g3:'', item:'', descricao:'Lubrificantes e Óleos Especiais', natureza:'INS', expenditure:'OPEX', tipo:'OPEX', unidade:'mês', qtd:36, v_unit_est:4800, v_total_est:172800, est_total:172800, custo_real:4800, custo_proj:172800, custo_spot:0, custo_contrato:172800, variacao:168000, variacao_pct:97, preco_venda:216000, nao_previsto:false, fornecedor:'RefinaçãoSul FOR-022', obs:'ISO VG 46/68 para jumbos e LHDs' },
    { id: 'P6-3.3',  projeto_id:'PROJ-006', nivel:2, g1:'3', g2:'3', g3:'', item:'', descricao:'EPI – Subterrâneo (capacetes, lanternas, self-rescuer)', natureza:'SSMA', expenditure:'OPEX', tipo:'OPEX', unidade:'trim.', qtd:12, v_unit_est:6800, v_total_est:81600, est_total:81600, custo_real:6800, custo_proj:81600, custo_spot:0, custo_contrato:81600, variacao:74800, variacao_pct:92, preco_venda:102000, nao_previsto:false, fornecedor:'SegMax / ProSafety FOR-012', obs:'Self-rescuer obrigatório para todos' },
    { id: 'P6-4.1',  projeto_id:'PROJ-006', nivel:2, g1:'4', g2:'1', g3:'', item:'', descricao:'Catering – 35 pax/dia', natureza:'ALM', expenditure:'OPEX', tipo:'OPEX', unidade:'mês', qtd:36, v_unit_est:105000, v_total_est:3780000, est_total:3780000, custo_real:105000, custo_proj:3780000, custo_spot:0, custo_contrato:3780000, variacao:3675000, variacao_pct:97, preco_venda:4725000, nao_previsto:false, fornecedor:'Aliminas Catering', obs:'Regime de trabalho 28×14' },
    { id: 'P6-4.2',  projeto_id:'PROJ-006', nivel:2, g1:'4', g2:'2', g3:'', item:'', descricao:'Alojamento – 35 colaboradores', natureza:'ALM', expenditure:'OPEX', tipo:'OPEX', unidade:'mês', qtd:36, v_unit_est:22000, v_total_est:792000, est_total:792000, custo_real:22000, custo_proj:792000, custo_spot:0, custo_contrato:792000, variacao:770000, variacao_pct:97, preco_venda:990000, nao_previsto:false, fornecedor:'HospedaMinas', obs:'Alojamento próximo à mina' },
    { id: 'P6-5.1',  projeto_id:'PROJ-006', nivel:2, g1:'5', g2:'1', g3:'', item:'', descricao:'SSMA – Técnico de Segurança do Trabalho Subterrânea', natureza:'SSMA', expenditure:'OPEX', tipo:'OPEX', unidade:'mês', qtd:36, v_unit_est:8500, v_total_est:306000, est_total:306000, custo_real:8500, custo_proj:306000, custo_spot:0, custo_contrato:306000, variacao:297500, variacao_pct:97, preco_venda:382500, nao_previsto:false, fornecedor:'ProSafety FOR-012', obs:'NR-22 – Mineração Subterrânea' },
    { id: 'P6-5.2',  projeto_id:'PROJ-006', nivel:2, g1:'5', g2:'2', g3:'', item:'', descricao:'Saúde Ocupacional – ASO e PCMSOs', natureza:'SSMA', expenditure:'OPEX', tipo:'OPEX', unidade:'mês', qtd:36, v_unit_est:4200, v_total_est:151200, est_total:151200, custo_real:4200, custo_proj:151200, custo_spot:0, custo_contrato:151200, variacao:147000, variacao_pct:97, preco_venda:189000, nao_previsto:false, fornecedor:'ClínicaMinas FOR-055', obs:'PCMSO mensal + ASO admissional' },
    { id: 'P6-6.1',  projeto_id:'PROJ-006', nivel:2, g1:'6', g2:'1', g3:'', item:'', descricao:'Análises Geoquímicas – Teores de Lítio (Li₂O)', natureza:'LAB', expenditure:'OPEX', tipo:'OPEX', unidade:'mês', qtd:36, v_unit_est:6500, v_total_est:234000, est_total:234000, custo_real:6500, custo_proj:234000, custo_spot:0, custo_contrato:234000, variacao:227500, variacao_pct:97, preco_venda:292500, nao_previsto:false, fornecedor:'LabGeoChem FOR-048', obs:'50 amostras/mês + relatório mensal' },
    // Nível 3 – Subitens (manutenção detalhada)
    { id: 'P6-1.3.1',projeto_id:'PROJ-006', nivel:3, g1:'1', g2:'3', g3:'1', item:'', descricao:'Preventiva Mensal – Jumbos (filtros, óleos, brocas)', natureza:'MAN', expenditure:'OPEX', tipo:'OPEX', unidade:'serv.', qtd:36, v_unit_est:8000, v_total_est:288000, est_total:288000, custo_real:8000, custo_proj:288000, custo_spot:0, custo_contrato:288000, variacao:280000, variacao_pct:97, preco_venda:360000, nao_previsto:false, fornecedor:'TurbineServ FOR-041', obs:'OS-006-001 e OS-006-002', os_vinculadas:['OS-006-001','OS-006-002'] },
    { id: 'P6-1.3.2',projeto_id:'PROJ-006', nivel:3, g1:'1', g2:'3', g3:'2', item:'', descricao:'Corretiva / Emergencial – LHD Scoop', natureza:'MAN', expenditure:'OPEX', tipo:'OPEX', unidade:'vb', qtd:4, v_unit_est:12500, v_total_est:50000, est_total:50000, custo_real:12500, custo_proj:50000, custo_spot:0, custo_contrato:50000, variacao:37500, variacao_pct:75, preco_venda:62500, nao_previsto:false, fornecedor:'AmpereMax FOR-042', obs:'OS-006-003', os_vinculadas:['OS-006-003'] }
  ];
  const wbsFiltered006 = wbs006.filter(w => !wbsAtual.find(x => x.id === w.id && x.projeto_id === w.projeto_id));
  if (wbsFiltered006.length) {
    const merged = [...wbsAtual, ...wbsFiltered006];
    localStorage.setItem('fraser_custos_projetos', JSON.stringify(merged));
    try { if (window.ERP_DATA) window.ERP_DATA.custosProjetos = merged; } catch(e) {}
  }

  // Mapa WBS de CONT-006 → PROJ-006
  const wbsMapAtual = JSON.parse(localStorage.getItem('fraser_wbs_contrato_map') || '{}');
  if (!wbsMapAtual['CONT-006']) {
    wbsMapAtual['CONT-006'] = 'PROJ-006';
    localStorage.setItem('fraser_wbs_contrato_map', JSON.stringify(wbsMapAtual));
  }

  // ── 12.4 ORDENS DE SERVIÇO (6 OS) ──────────────────────────────────────
  // OS simples (fa_os_list)
  const osSimples = JSON.parse(localStorage.getItem('fa_os_list') || '[]');
  const osSimples006 = [
    { id:'OS-006-001', contrato:'CONT-006', tipo:'Preventiva', descricao:'Revisão Geral Jumbo DD420 – 250h operação', status:'Concluída', prioridade:'Alta', responsavel:'Ricardo Almeida', equipe:3, prazo:'2025-05-10', horas:12, progresso:100, local:'Oficina Mina Subterrânea' },
    { id:'OS-006-002', contrato:'CONT-006', tipo:'Preventiva', descricao:'Revisão Geral Jumbo Atlas Copco Boomer – 250h', status:'Concluída', prioridade:'Alta', responsavel:'Ricardo Almeida', equipe:3, prazo:'2025-05-15', horas:12, progresso:100, local:'Oficina Mina Subterrânea' },
    { id:'OS-006-003', contrato:'CONT-006', tipo:'Corretiva',  descricao:'Reparo sistema hidráulico LHD Scoop LH514E #3', status:'Em Andamento', prioridade:'Crítica', responsavel:'Carlos Mendes', equipe:4, prazo:'2025-06-05', horas:24, progresso:65, local:'Oficina Subterrânea Level-2' },
    { id:'OS-006-004', contrato:'CONT-006', tipo:'Inspeção',   descricao:'Inspeção de ventilação e sistema contra incêndio', status:'Concluída', prioridade:'Alta', responsavel:'Patrícia Souza', equipe:2, prazo:'2025-05-20', horas:6, progresso:100, local:'Rampa Principal + Galeria A' },
    { id:'OS-006-005', contrato:'CONT-006', tipo:'Preventiva', descricao:'Lubrificação geral frota subterrânea – Lote Mai/2025', status:'Em Andamento', prioridade:'Normal', responsavel:'Carlos Mendes', equipe:2, prazo:'2025-06-10', horas:8, progresso:50, local:'Pátio de Manutenção Sub.' },
    { id:'OS-006-006', contrato:'CONT-006', tipo:'Mobilização', descricao:'Montagem e comissionamento ventilação auxiliar Galeria B', status:'Concluída', prioridade:'Alta', responsavel:'Ana Paula Rocha', equipe:6, prazo:'2025-04-30', horas:40, progresso:100, local:'Galeria B – 180m' }
  ];
  osSimples006.forEach(o => { if (!osSimples.find(x => x.id === o.id)) osSimples.push(o); });
  localStorage.setItem('fa_os_list', JSON.stringify(osSimples));

  // OS detalhadas (fa_fluxo_os)
  const osFluxo = JSON.parse(localStorage.getItem('fa_fluxo_os') || '[]');
  const osFluxo006 = [
    {
      id:'OS-006-001', numero:'OS-006-001', contrato_id:'CONT-006', descricao:'Revisão Geral Jumbo DD420 – 250h operação',
      tipo:'Preventiva', status:'Concluída', prioridade:'Alta',
      criado_por:'Ricardo Almeida', data_criacao:'05/05/2025', prazo:'10/05/2025',
      itens_compra:[
        { id:'IT-OS006-001', descricao:'Filtro de Óleo Jumbo DD420', qtd:4, unidade:'un', status_item:'Aprovado', rc_criada:true, rc_id:'RC-006-001' },
        { id:'IT-OS006-002', descricao:'Óleo Motor 15W40 Jumbo', qtd:20, unidade:'L', status_item:'Aprovado', rc_criada:true, rc_id:'RC-006-001' },
        { id:'IT-OS006-003', descricao:'Filtro Hidráulico DD420', qtd:2, unidade:'un', status_item:'Aprovado', rc_criada:true, rc_id:'RC-006-001' }
      ],
      rcs_geradas:['RC-006-001'], status_aprovacao:'Aprovada', aprovado_por:'Ana Paula Rocha',
      atualizado_em: iso('2025-05-10'), observacoes:'Concluída sem intercorrências – máquina liberada'
    },
    {
      id:'OS-006-002', numero:'OS-006-002', contrato_id:'CONT-006', descricao:'Revisão Geral Jumbo Atlas Copco Boomer – 250h',
      tipo:'Preventiva', status:'Concluída', prioridade:'Alta',
      criado_por:'Ricardo Almeida', data_criacao:'08/05/2025', prazo:'15/05/2025',
      itens_compra:[
        { id:'IT-OS006-004', descricao:'Filtro de Ar Atlas Copco Boomer', qtd:2, unidade:'un', status_item:'Aprovado', rc_criada:true, rc_id:'RC-006-002' },
        { id:'IT-OS006-005', descricao:'Kit Vedação Cilindro Perfuração', qtd:1, unidade:'kit', status_item:'Aprovado', rc_criada:true, rc_id:'RC-006-002' }
      ],
      rcs_geradas:['RC-006-002'], status_aprovacao:'Aprovada', aprovado_por:'Ana Paula Rocha',
      atualizado_em: iso('2025-05-16'), observacoes:'Boomer operacional – 100h até próxima revisão'
    },
    {
      id:'OS-006-003', numero:'OS-006-003', contrato_id:'CONT-006', descricao:'Reparo sistema hidráulico LHD Scoop LH514E #3',
      tipo:'Corretiva', status:'Em Andamento', prioridade:'Crítica',
      criado_por:'Carlos Mendes', data_criacao:'28/05/2025', prazo:'05/06/2025',
      itens_compra:[
        { id:'IT-OS006-006', descricao:'Cilindro Hidráulico LH514E (caçamba)', qtd:1, unidade:'un', status_item:'Aprovado', rc_criada:true, rc_id:'RC-006-003' },
        { id:'IT-OS006-007', descricao:'Mangueira Hidráulica 1.5" – 3m', qtd:4, unidade:'un', status_item:'Aprovado', rc_criada:true, rc_id:'RC-006-003' },
        { id:'IT-OS006-008', descricao:'Fluido Hidráulico ISO VG 46 – 50L', qtd:50, unidade:'L', status_item:'Aprovado', rc_criada:true, rc_id:'RC-006-003' }
      ],
      rcs_geradas:['RC-006-003'], status_aprovacao:'Aprovada', aprovado_por:'Ana Paula Rocha',
      atualizado_em: iso('2025-06-01'), observacoes:'Aguardando chegada do cilindro (PED-006-003) – 65% concluído'
    }
  ];
  osFluxo006.forEach(o => { if (!osFluxo.find(x => x.id === o.id)) osFluxo.push(o); });
  localStorage.setItem('fa_fluxo_os', JSON.stringify(osFluxo));

  // ── 12.5 REQUISIÇÕES DE COMPRA (RC) ─────────────────────────────────────
  const rcAtual = JSON.parse(localStorage.getItem('fa_rc_list') || '[]');
  const rc006 = [
    {
      id:'RC-006-001', numero:'RC-006-001', contrato_id:'CONT-006', os_id:'OS-006-001',
      descricao:'Filtros, óleos e peças – Manutenção Preventiva Jumbo DD420',
      status:'Pedido Emitido', prioridade:'Alta', solicitante:'Ricardo Almeida',
      aprovador:'Ana Paula Rocha', data:'10/05/2025', valor_total:3840,
      itens:[
        { descricao:'Filtro de Óleo Jumbo DD420', qtd:4, unidade:'un', valor_unit:280, valor_total:1120, fornecedor_sug:'AmpereMax FOR-042' },
        { descricao:'Óleo Motor 15W40 Jumbo', qtd:20, unidade:'L', valor_unit:42, valor_total:840, fornecedor_sug:'RefinaçãoSul FOR-022' },
        { descricao:'Filtro Hidráulico DD420', qtd:2, unidade:'un', valor_unit:940, valor_total:1880, fornecedor_sug:'HidroMax FOR-018' }
      ]
    },
    {
      id:'RC-006-002', numero:'RC-006-002', contrato_id:'CONT-006', os_id:'OS-006-002',
      descricao:'Filtros e kit vedação – Revisão Jumbo Atlas Copco Boomer',
      status:'Pedido Emitido', prioridade:'Alta', solicitante:'Ricardo Almeida',
      aprovador:'Ana Paula Rocha', data:'10/05/2025', valor_total:3180,
      itens:[
        { descricao:'Filtro de Ar Atlas Copco Boomer', qtd:2, unidade:'un', valor_unit:390, valor_total:780, fornecedor_sug:'AirTec FOR-017' },
        { descricao:'Kit Vedação Cilindro Perfuração', qtd:1, unidade:'kit', valor_unit:2400, valor_total:2400, fornecedor_sug:'HidroMax FOR-018' }
      ]
    },
    {
      id:'RC-006-003', numero:'RC-006-003', contrato_id:'CONT-006', os_id:'OS-006-003',
      descricao:'Cilindro hidráulico e acessórios – LHD LH514E #3 (Corretiva)',
      status:'Pedido Emitido', prioridade:'Crítica', solicitante:'Carlos Mendes',
      aprovador:'Ana Paula Rocha', data:'29/05/2025', valor_total:18750,
      itens:[
        { descricao:'Cilindro Hidráulico LH514E caçamba', qtd:1, unidade:'un', valor_unit:14500, valor_total:14500, fornecedor_sug:'MegaParts FOR-044' },
        { descricao:'Mangueira Hidráulica 1.5" – 3m', qtd:4, unidade:'un', valor_unit:380, valor_total:1520, fornecedor_sug:'HidroMax FOR-018' },
        { descricao:'Fluido Hidráulico ISO VG 46 – 50L', qtd:50, unidade:'L', valor_unit:54.60, valor_total:2730, fornecedor_sug:'RefinaçãoSul FOR-022' }
      ]
    },
    {
      id:'RC-006-004', numero:'RC-006-004', contrato_id:'CONT-006', os_id:'OS-006-005',
      descricao:'Lubrificantes – Manutenção Preventiva Lote Mai/Jun 2025',
      status:'Aprovada – Aguardando Comprador', prioridade:'Normal', solicitante:'Carlos Mendes',
      aprovador:'Ana Paula Rocha', data:'01/06/2025', valor_total:6840,
      itens:[
        { descricao:'Graxa Lítio MP2 – Balde 18kg', qtd:6, unidade:'bd', valor_unit:320, valor_total:1920, fornecedor_sug:'RefinaçãoSul FOR-022' },
        { descricao:'Óleo Hidráulico ISO VG 68 – 20L', qtd:8, unidade:'gl', valor_unit:295, valor_total:2360, fornecedor_sug:'RefinaçãoSul FOR-022' },
        { descricao:'Óleo de Transmissão SAE 80W90', qtd:10, unidade:'L', valor_unit:82, valor_total:820, fornecedor_sug:'Lubrax FOR-002' },
        { descricao:'Fluido de Freio DOT 4', qtd:4, unidade:'L', valor_unit:43.50, valor_total:174, fornecedor_sug:'Lubrax FOR-002' },
        { descricao:'Anticongelante Radiador 50%', qtd:20, unidade:'L', valor_unit:57, valor_total:1140, fornecedor_sug:'RefinaçãoSul FOR-022' },
        { descricao:'Estopa de Limpeza – Rolo 10kg', qtd:4, unidade:'rl', valor_unit:106.50, valor_total:426, fornecedor_sug:'N/A' }
      ]
    }
  ];
  rc006.forEach(r => { if (!rcAtual.find(x => x.id === r.id)) rcAtual.push(r); });
  localStorage.setItem('fa_rc_list', JSON.stringify(rcAtual));

  // ── 12.6 RFQs (Solicitações de Cotação) ──────────────────────────────────
  const rfqsAtual2 = JSON.parse(localStorage.getItem('fa_rfqs') || '[]');
  const rfqs006 = [
    {
      id:'RFQ-006-001', numero:'RFQ-006-001', rc_id:'RC-006-001', contrato_id:'CONT-006',
      descricao:'Cotação Filtros e Óleos Jumbo DD420', status:'Encerrada',
      data:'12/05/2025', prazo_respostas:'16/05/2025', responsavel:'Carlos Mendes',
      fornecedores_convidados:['RefinaçãoSul FOR-022','HidroMax FOR-018','AmpereMax FOR-042'],
      cotacoes:[
        { fornecedor:'RefinaçãoSul FOR-022', valor_total:3650, prazo_entrega:3, status:'Respondida', observacao:'Entrega em Araçuaí' },
        { fornecedor:'HidroMax FOR-018', valor_total:3920, prazo_entrega:5, status:'Respondida', observacao:'Frete incluso' },
        { fornecedor:'AmpereMax FOR-042', valor_total:3840, prazo_entrega:4, status:'Respondida', observacao:'Filial BH' }
      ],
      fornecedor_vencedor:'RefinaçãoSul FOR-022', valor_aprovado:3650, economia:190
    },
    {
      id:'RFQ-006-002', numero:'RFQ-006-002', rc_id:'RC-006-002', contrato_id:'CONT-006',
      descricao:'Cotação Kit Revisão Atlas Copco Boomer', status:'Encerrada',
      data:'12/05/2025', prazo_respostas:'16/05/2025', responsavel:'Carlos Mendes',
      fornecedores_convidados:['AirTec FOR-017','HidroMax FOR-018','MegaParts FOR-044'],
      cotacoes:[
        { fornecedor:'AirTec FOR-017', valor_total:3050, prazo_entrega:4, status:'Respondida', observacao:'Em estoque' },
        { fornecedor:'HidroMax FOR-018', valor_total:3180, prazo_entrega:3, status:'Respondida', observacao:'' },
        { fornecedor:'MegaParts FOR-044', valor_total:3400, prazo_entrega:7, status:'Respondida', observacao:'Importado' }
      ],
      fornecedor_vencedor:'AirTec FOR-017', valor_aprovado:3050, economia:130
    },
    {
      id:'RFQ-006-003', numero:'RFQ-006-003', rc_id:'RC-006-003', contrato_id:'CONT-006',
      descricao:'Cotação Cilindro Hidráulico LH514E – Corretiva Urgente', status:'Encerrada',
      data:'29/05/2025', prazo_respostas:'01/06/2025', responsavel:'Ana Paula Rocha',
      fornecedores_convidados:['MegaParts FOR-044','HidroMax FOR-018','TurbineServ FOR-041'],
      cotacoes:[
        { fornecedor:'MegaParts FOR-044', valor_total:17900, prazo_entrega:5, status:'Respondida', observacao:'Peça original' },
        { fornecedor:'HidroMax FOR-018', valor_total:18750, prazo_entrega:3, status:'Respondida', observacao:'Entrega expressa' },
        { fornecedor:'TurbineServ FOR-041', valor_total:19200, prazo_entrega:7, status:'Respondida', observacao:'Remanufaturado + garantia 1 ano' }
      ],
      fornecedor_vencedor:'MegaParts FOR-044', valor_aprovado:17900, economia:850
    },
    {
      id:'RFQ-006-004', numero:'RFQ-006-004', rc_id:'RC-006-004', contrato_id:'CONT-006',
      descricao:'Cotação Lubrificantes – Lote Mai/Jun 2025', status:'Aguardando Cotações',
      data:'01/06/2025', prazo_respostas:'05/06/2025', responsavel:'Carlos Mendes',
      fornecedores_convidados:['RefinaçãoSul FOR-022','Lubrax FOR-002'],
      cotacoes:[
        { fornecedor:'RefinaçãoSul FOR-022', valor_total:0, prazo_entrega:0, status:'Aguardando', observacao:'' },
        { fornecedor:'Lubrax FOR-002', valor_total:0, prazo_entrega:0, status:'Aguardando', observacao:'' }
      ],
      fornecedor_vencedor:'', valor_aprovado:0, economia:0
    }
  ];
  rfqs006.forEach(r => { if (!rfqsAtual2.find(x => x.id === r.id)) rfqsAtual2.push(r); });
  localStorage.setItem('fa_rfqs', JSON.stringify(_fixRFQStatus(rfqsAtual2)));
  localStorage.setItem('fa_rfq_flow', JSON.stringify(_fixRFQStatus(rfqsAtual2)));

  // ── 12.7 MAPAS DE COTAÇÃO ────────────────────────────────────────────────
  const mapasAtual2 = JSON.parse(localStorage.getItem('fa_mapas_comp') || '[]');
  const mapas006 = [
    {
      id:'MAPA-006-001', numero:'MAPA-006-001', rfq_id:'RFQ-006-001', rc_id:'RC-006-001', contrato_id:'CONT-006',
      descricao:'Mapa Comparativo – Filtros e Óleos Jumbo DD420',
      data:'17/05/2025', responsavel:'Carlos Mendes', status:'Aprovado',
      aprovado_por:'Ana Paula Rocha', data_aprovacao:'18/05/2025',
      fornecedores:['RefinaçãoSul FOR-022','HidroMax FOR-018','AmpereMax FOR-042'],
      itens:[
        { descricao:'Filtro Óleo DD420', unidade:'un', qtd:4, valores:[{f:'RefinaçãoSul FOR-022',v:265},{f:'HidroMax FOR-018',v:290},{f:'AmpereMax FOR-042',v:280}], melhor:'RefinaçãoSul FOR-022', valor_aprovado:265 },
        { descricao:'Óleo Motor 15W40', unidade:'L', qtd:20, valores:[{f:'RefinaçãoSul FOR-022',v:38},{f:'HidroMax FOR-018',v:42},{f:'AmpereMax FOR-042',v:41}], melhor:'RefinaçãoSul FOR-022', valor_aprovado:38 },
        { descricao:'Filtro Hidráulico', unidade:'un', qtd:2, valores:[{f:'RefinaçãoSul FOR-022',v:870},{f:'HidroMax FOR-018',v:940},{f:'AmpereMax FOR-042',v:920}], melhor:'RefinaçãoSul FOR-022', valor_aprovado:870 }
      ],
      valor_total_melhor:3650, valor_total_proposto:3840, economia:190,
      observacoes:'RefinaçãoSul venceu em todos os itens. Prazo 3 dias – adequado.'
    },
    {
      id:'MAPA-006-002', numero:'MAPA-006-002', rfq_id:'RFQ-006-002', rc_id:'RC-006-002', contrato_id:'CONT-006',
      descricao:'Mapa Comparativo – Kit Revisão Atlas Copco Boomer',
      data:'17/05/2025', responsavel:'Carlos Mendes', status:'Aprovado',
      aprovado_por:'Ana Paula Rocha', data_aprovacao:'18/05/2025',
      fornecedores:['AirTec FOR-017','HidroMax FOR-018','MegaParts FOR-044'],
      itens:[
        { descricao:'Filtro Ar Boomer', unidade:'un', qtd:2, valores:[{f:'AirTec FOR-017',v:370},{f:'HidroMax FOR-018',v:390},{f:'MegaParts FOR-044',v:450}], melhor:'AirTec FOR-017', valor_aprovado:370 },
        { descricao:'Kit Vedação Cilindro', unidade:'kit', qtd:1, valores:[{f:'AirTec FOR-017',v:2310},{f:'HidroMax FOR-018',v:2400},{f:'MegaParts FOR-044',v:2500}], melhor:'AirTec FOR-017', valor_aprovado:2310 }
      ],
      valor_total_melhor:3050, valor_total_proposto:3180, economia:130,
      observacoes:'AirTec com prazo 4 dias e melhor preço em todos os itens.'
    },
    {
      id:'MAPA-006-003', numero:'MAPA-006-003', rfq_id:'RFQ-006-003', rc_id:'RC-006-003', contrato_id:'CONT-006',
      descricao:'Mapa Comparativo – Cilindro Hidráulico LH514E (URGENTE)',
      data:'02/06/2025', responsavel:'Ana Paula Rocha', status:'Aprovado',
      aprovado_por:'Ana Paula Rocha', data_aprovacao:'02/06/2025',
      fornecedores:['MegaParts FOR-044','HidroMax FOR-018','TurbineServ FOR-041'],
      itens:[
        { descricao:'Cilindro Hid. LH514E', unidade:'un', qtd:1, valores:[{f:'MegaParts FOR-044',v:14500},{f:'HidroMax FOR-018',v:15200},{f:'TurbineServ FOR-041',v:15800}], melhor:'MegaParts FOR-044', valor_aprovado:14500 },
        { descricao:'Mangueira Hid. 1.5"', unidade:'un', qtd:4, valores:[{f:'MegaParts FOR-044',v:370},{f:'HidroMax FOR-018',v:380},{f:'TurbineServ FOR-041',v:395}], melhor:'MegaParts FOR-044', valor_aprovado:370 },
        { descricao:'Fluido Hid. ISO VG 46', unidade:'L', qtd:50, valores:[{f:'MegaParts FOR-044',v:52},{f:'HidroMax FOR-018',v:54.60},{f:'TurbineServ FOR-041',v:56}], melhor:'MegaParts FOR-044', valor_aprovado:52 }
      ],
      valor_total_melhor:17900, valor_total_proposto:18750, economia:850,
      observacoes:'MegaParts aprovado – peça original com entrega em 5 dias. Urgência justifica aprovação direta.'
    }
  ];
  mapas006.forEach(m => { if (!mapasAtual2.find(x => x.id === m.id)) mapasAtual2.push(m); });
  // Mescla mapas CONT-006 com matrizes existentes no fa_matrizes
  const _matrizesExist3 = (() => { try { return JSON.parse(localStorage.getItem('fa_matrizes') || '[]'); } catch(e) { return []; } })();
  const _seedIds3 = new Set(mapas006.map(m => m.id));
  const _mapas006Novos = mapas006.filter(m => !_matrizesExist3.find(x => x.id === m.id));
  const _matrizesFinais3 = [..._matrizesExist3, ..._mapas006Novos];
  localStorage.setItem('fa_matrizes', JSON.stringify(_matrizesFinais3));
  // Sincroniza fa_mapas_comp com fa_matrizes para manter consistência
  localStorage.setItem('fa_mapas_comp', JSON.stringify(_matrizesFinais3));

  // ── 12.8 PEDIDOS DE COMPRA ───────────────────────────────────────────────
  const pedidosAtual2 = JSON.parse(localStorage.getItem('fa_pedidos') || '[]');
  const pedidos006 = [
    {
      id:'PED-006-001', numero:'PED-006-001', rc_id:'RC-006-001', rfq_id:'RFQ-006-001',
      mapa_id:'MAPA-006-001', contrato_id:'CONT-006',
      fornecedor_id:'FOR-022', fornecedor:'RefinaçãoSul Óleos Especiais',
      descricao:'Filtros e óleos – Manutenção Preventiva Jumbos Mai/2025',
      status:'Recebida', data_emissao:'18/05/2025', data_entrega_prev:'21/05/2025',
      data_entrega_real:'20/05/2025', prazo_dias:3, valor_total:3650,
      condicao_pagamento:'30 dias NF', responsavel:'Carlos Mendes',
      nota_fiscal:'NF-006-0001', observacoes:'Recebido 1 dia antes do prazo',
      itens:[
        { descricao:'Filtro de Óleo Jumbo DD420', qtd:4, unidade:'un', valor_unit:265, valor_total:1060 },
        { descricao:'Óleo Motor 15W40', qtd:20, unidade:'L', valor_unit:38, valor_total:760 },
        { descricao:'Filtro Hidráulico DD420', qtd:2, unidade:'un', valor_unit:870, valor_total:1740 },
        { descricao:'Frete Araçuaí', qtd:1, unidade:'vb', valor_unit:90, valor_total:90 }
      ],
      avaliacao_fornecedor:{ nota:95, prazo:'Antecipou 1 dia', qualidade:'Peças originais', observacao:'Excelente atendimento' }
    },
    {
      id:'PED-006-002', numero:'PED-006-002', rc_id:'RC-006-002', rfq_id:'RFQ-006-002',
      mapa_id:'MAPA-006-002', contrato_id:'CONT-006',
      fornecedor_id:'FOR-017', fornecedor:'AirTec Compressores Industriais',
      descricao:'Kit revisão Atlas Copco Boomer – Preventiva Mai/2025',
      status:'Recebida', data_emissao:'19/05/2025', data_entrega_prev:'23/05/2025',
      data_entrega_real:'22/05/2025', prazo_dias:4, valor_total:3050,
      condicao_pagamento:'30 dias NF', responsavel:'Carlos Mendes',
      nota_fiscal:'NF-006-0002', observacoes:'Recebido com antecedência',
      itens:[
        { descricao:'Filtro de Ar Atlas Copco Boomer', qtd:2, unidade:'un', valor_unit:370, valor_total:740 },
        { descricao:'Kit Vedação Cilindro Perfuração', qtd:1, unidade:'kit', valor_unit:2310, valor_total:2310 }
      ],
      avaliacao_fornecedor:{ nota:92, prazo:'1 dia antes', qualidade:'Peças originais Atlas Copco', observacao:'Bom atendimento' }
    },
    {
      id:'PED-006-003', numero:'PED-006-003', rc_id:'RC-006-003', rfq_id:'RFQ-006-003',
      mapa_id:'MAPA-006-003', contrato_id:'CONT-006',
      fornecedor_id:'FOR-044', fornecedor:'MegaParts Peças para Equipamentos',
      descricao:'Cilindro hidráulico + acessórios LHD LH514E – Corretiva Urgente',
      status:'Em Trânsito', data_emissao:'03/06/2025', data_entrega_prev:'08/06/2025',
      data_entrega_real:null, prazo_dias:5, valor_total:17900,
      condicao_pagamento:'28 dias NF', responsavel:'Ana Paula Rocha',
      nota_fiscal:'NF-006-0003', observacoes:'Peça em trânsito – previsão 08/06/2025',
      itens:[
        { descricao:'Cilindro Hidráulico LH514E caçamba', qtd:1, unidade:'un', valor_unit:14500, valor_total:14500 },
        { descricao:'Mangueira Hidráulica 1.5" – 3m', qtd:4, unidade:'un', valor_unit:370, valor_total:1480 },
        { descricao:'Fluido Hidráulico ISO VG 46 – 50L', qtd:50, unidade:'L', valor_unit:52, valor_total:2600 },
        { descricao:'Frete Expresso Araçuaí', qtd:1, unidade:'vb', valor_unit:320, valor_total:320 }
      ],
      avaliacao_fornecedor:null
    }
  ];
  pedidos006.forEach(p => { if (!pedidosAtual2.find(x => x.id === p.id)) pedidosAtual2.push(p); });
  localStorage.setItem('fa_pedidos', JSON.stringify(pedidosAtual2));
  localStorage.setItem('fa_pedidos_v2', JSON.stringify(pedidosAtual2));

  // ── 12.9 MEDIÇÕES + FATURAMENTO ──────────────────────────────────────────
  const erp = window.ERP_DATA || {};
  const medicoes006 = [
    {
      id:'MED-006-001', contrato_id:'CONT-006', numero:1, periodo:'Abr-Mai/2025',
      descricao:'Mobilização – Canteiro, infraestrutura e início de operação Galeria A',
      valor_medido:340000, valor_acumulado:340000, avanco_fisico:4,
      status:'Aprovada', data:'31/05/2025', responsavel:'Ana Paula Rocha',
      os_ids:['OS-006-004','OS-006-006'], aprovado_por:'Dr. Henrique Carvalho',
      nota_debito:'ND-006-001', observacoes:'Medição inicial – mobilização 100% concluída'
    },
    {
      id:'MED-006-002', contrato_id:'CONT-006', numero:2, periodo:'Jun/2025',
      descricao:'Operação Mês 1 – 2 frentes ativas + manutenção preventiva jumbos',
      valor_medido:0, valor_acumulado:340000, avanco_fisico:0,
      status:'Pendente', data:'30/06/2025', responsavel:'Ana Paula Rocha',
      os_ids:['OS-006-001','OS-006-002','OS-006-003','OS-006-005'],
      aprovado_por:'', nota_debito:'', observacoes:'Em apuração – fecha 30/06/2025'
    }
  ];

  const faturasAtual = JSON.parse(localStorage.getItem('fa_faturas') || '[]');
  const faturas006 = [
    {
      id:'FAT-006-001', contrato_id:'CONT-006', medicao_id:'MED-006-001', numero:'FAT-006-001',
      cliente:'Lithium Power Mineração S/A', descricao:'Mobilização CONT-006 – Abr-Mai/2025',
      valor:340000, status:'Emitida', data_emissao:'01/06/2025', data_vencimento:'01/07/2025',
      data_pagamento:null, nota_fiscal:'NFS-006-0001',
      observacoes:'Aprovada pelo cliente em 31/05/2025'
    }
  ];

  const medsAtual = JSON.parse(localStorage.getItem('fa_medicoes') || '[]');
  medicoes006.forEach(m => { if (!medsAtual.find(x => x.id === m.id)) medsAtual.push(m); });
  localStorage.setItem('fa_medicoes', JSON.stringify(medsAtual));
  localStorage.setItem('fa_medicoes_v2', JSON.stringify(medsAtual));
  faturas006.forEach(f => { if (!faturasAtual.find(x => x.id === f.id)) faturasAtual.push(f); });
  localStorage.setItem('fa_faturas', JSON.stringify(faturasAtual));
  if (erp) {
    try {
      if (!erp.medicoes) erp.medicoes = [];
      medicoes006.forEach(m => { if (!erp.medicoes.find(x => x.id === m.id)) erp.medicoes.push(m); });
      if (!erp.faturas) erp.faturas = [];
      faturas006.forEach(f => { if (!erp.faturas.find(x => x.id === f.id)) erp.faturas.push(f); });
    } catch(e) {}
  }

  // ── 12.10 CONTAS A PAGAR (financeiro) ───────────────────────────────────
  const cpAtual2 = JSON.parse(localStorage.getItem('fa_contas_pagar') || '[]');
  const cp006 = [
    // Pedidos de compra
    { id:'CP-006-001', contrato_id:'CONT-006', pedido_id:'PED-006-001', fornecedor:'RefinaçãoSul Óleos Especiais', descricao:'Filtros e óleos – Jumbos Mai/2025', valor:3650, vencimento:'20/06/2025', status:'A Vencer', categoria:'Materiais', data_pagamento:null, nota_fiscal:'NF-006-0001', centro_custo:'CONT-006' },
    { id:'CP-006-002', contrato_id:'CONT-006', pedido_id:'PED-006-002', fornecedor:'AirTec Compressores Industriais', descricao:'Kit revisão Boomer Mai/2025', valor:3050, vencimento:'22/06/2025', status:'A Vencer', categoria:'Materiais', data_pagamento:null, nota_fiscal:'NF-006-0002', centro_custo:'CONT-006' },
    { id:'CP-006-003', contrato_id:'CONT-006', pedido_id:'PED-006-003', fornecedor:'MegaParts Peças para Equipamentos', descricao:'Cilindro LH514E – Corretiva Urgente', valor:17900, vencimento:'06/07/2025', status:'A Vencer', categoria:'Peças e Manutenção', data_pagamento:null, nota_fiscal:'NF-006-0003', centro_custo:'CONT-006' },
    // Contratos de serviço mensais
    { id:'CP-006-004', contrato_id:'CONT-006', pedido_id:'', fornecedor:'ProSafety Soluções em SSMA', descricao:'SSMA Subterrâneo – Abr+Mai/2025 (2 meses)', valor:17000, vencimento:'10/06/2025', status:'Pago', categoria:'Serviços SSMA', data_pagamento:'09/06/2025', nota_fiscal:'NF-PRO-2025-441', centro_custo:'CONT-006' },
    { id:'CP-006-005', contrato_id:'CONT-006', pedido_id:'', fornecedor:'ClínicaMinas Saúde Ocupacional', descricao:'Saúde Ocupacional – Abr+Mai/2025 (ASO admissional 35 col.)', valor:12600, vencimento:'15/06/2025', status:'Pago', categoria:'Serviços Saúde', data_pagamento:'14/06/2025', nota_fiscal:'NF-CLIN-2025-188', centro_custo:'CONT-006' },
    { id:'CP-006-006', contrato_id:'CONT-006', pedido_id:'', fornecedor:'LabGeoChem Análises Geoquímicas', descricao:'Análises Geoquímicas Li₂O – Mai/2025 (50 amostras)', valor:6500, vencimento:'30/06/2025', status:'A Vencer', categoria:'Laboratório', data_pagamento:null, nota_fiscal:'NF-LAB-2025-092', centro_custo:'CONT-006' },
    { id:'CP-006-007', contrato_id:'CONT-006', pedido_id:'', fornecedor:'ExploBras Serviços de Desmonte', descricao:'Explosivos ANFO + acessórios – Mai/2025', valor:12500, vencimento:'15/06/2025', status:'A Vencer', categoria:'Explosivos', data_pagamento:null, nota_fiscal:'NF-EXP-2025-034', centro_custo:'CONT-006' },
    { id:'CP-006-008', contrato_id:'CONT-006', pedido_id:'', fornecedor:'JurisMinas Consultoria Jurídica', descricao:'Licenças ANM + regularização DNPM – Abr/2025', valor:8500, vencimento:'30/05/2025', status:'Pago', categoria:'Jurídico/Regulatório', data_pagamento:'28/05/2025', nota_fiscal:'NF-JUR-2025-067', centro_custo:'CONT-006' }
  ];
  cp006.forEach(c => { if (!cpAtual2.find(x => x.id === c.id)) cpAtual2.push(c); });
  localStorage.setItem('fa_contas_pagar', JSON.stringify(cpAtual2));
  localStorage.setItem('fa_contas_pagar_v2', JSON.stringify(cpAtual2));

  // ── 12.11 COLABORADORES E SSMA ───────────────────────────────────────────
  const colsAtual = JSON.parse(localStorage.getItem('fa_colaboradores') || '[]');
  const cols006 = [
    { id:'COL-016', nome:'Pedro Henrique Lima',   cargo:'Supervisor de Produção Subterrânea', contrato:'CONT-006', status:'Mobilizando', docs:'OK', admissao:'2025-04-15', salario:9200, cpf:'100.200.300-40' },
    { id:'COL-017', nome:'Tatiane Rezende',        cargo:'Operadora de Jumbo',                 contrato:'CONT-006', status:'Ativo',        docs:'OK', admissao:'2025-04-20', salario:5600, cpf:'200.300.400-50' },
    { id:'COL-018', nome:'Roberto Saraiva',        cargo:'Operador de LHD Scoop',              contrato:'CONT-006', status:'Ativo',        docs:'OK', admissao:'2025-04-20', salario:5400, cpf:'300.400.500-60' },
    { id:'COL-019', nome:'Déborah Figueiredo',     cargo:'Técnica de Segurança NR-22',         contrato:'CONT-006', status:'Ativo',        docs:'OK', admissao:'2025-04-15', salario:7200, cpf:'400.500.600-70' },
    { id:'COL-020', nome:'Márcio Augusto Freitas', cargo:'Mecânico de Equipamentos Sub.',      contrato:'CONT-006', status:'Ativo',        docs:'Atenção', admissao:'2025-04-22', salario:5800, cpf:'500.600.700-80' }
  ];
  cols006.forEach(c => { if (!colsAtual.find(x => x.id === c.id)) colsAtual.push(c); });
  localStorage.setItem('fa_colaboradores', JSON.stringify(colsAtual));
  localStorage.setItem('fraser_colaboradores', JSON.stringify(colsAtual));

  // Incidente SSMA novo
  const incAtual = JSON.parse(localStorage.getItem('fa_incidentes') || '[]');
  const inc006 = { id:'INC-005', data:'2025-05-12', tipo:'Quase Acidente', descricao:'Projeção de fragmento de rocha na galeria A durante detonação – EPI evitou lesão', gravidade:'Média', contrato:'CONT-006', envolvidos:['COL-017'], acoes:'Revisão do perímetro de segurança + treinamento DDS específico para detonações subterrâneas', status:'Fechado' };
  if (!incAtual.find(x => x.id === 'INC-005')) incAtual.push(inc006);
  localStorage.setItem('fa_incidentes', JSON.stringify(incAtual));
  localStorage.setItem('fraser_incidentes', JSON.stringify(incAtual));

  // ── 12.12 PROJETO GANTT (PROJ-006) ──────────────────────────────────────
  const pgAtual2 = JSON.parse(localStorage.getItem('fa_projetos_gantt') || '[]');
  const proj006 = {
    id: 'PROJ-006',
    nome: 'Lithium Power – Op. Mina Subterrânea',
    descricao: 'Operação de 2 frentes de lavra subterrânea + Manutenção + SSMA + Laboratório',
    contrato_id: 'CONT-006', cliente: 'Lithium Power Mineração S/A',
    status: 'Em Andamento', data_inicio: '15/04/2025', data_fim: '14/04/2028',
    valor_contrato: 8500000, avanco_geral: 7, gerente: 'Ana Paula Rocha',
    fases: [
      {
        id: 'FASE-MOB-6', nome: 'Mobilização',
        tarefas: [
          { id:'T6-001', nome:'Montagem do Canteiro de Superfície', tipo:'Tarefa', inicio:'15/04/2025', fim:'30/04/2025', responsavel:'Ana Paula Rocha', avanco:100, status:'Concluída', descricao:'Escritório, almoxarifado, refeitório e alojamentos – 35 colaboradores', recursos:['Equipe Infra x8','MotorFrota FOR-054'], custo_previsto:45000, custo_real:47200 },
          { id:'T6-002', nome:'Mobilização Jumbos DD420 + Boomer', tipo:'Tarefa', inicio:'18/04/2025', fim:'05/05/2025', responsavel:'Pedro H. Lima', avanco:100, status:'Concluída', descricao:'Transporte e montagem dos jumbos no Level -1', recursos:['Equipe Mecânica x5','BrasTrans FOR-020','TurbineServ FOR-041'], custo_previsto:62000, custo_real:65800 },
          { id:'T6-003', nome:'Mobilização 4× LHD Scoop LH514E', tipo:'Tarefa', inicio:'18/04/2025', fim:'05/05/2025', responsavel:'Roberto Saraiva', avanco:100, status:'Concluída', descricao:'Descida de 4 scoops elétricos – Level -1 e -2', recursos:['Equipe Mecânica x4','AmpereMax FOR-042'], custo_previsto:38000, custo_real:41200 },
          { id:'T6-004', nome:'Sistema de Ventilação – Galeria A e B', tipo:'Tarefa', inicio:'20/04/2025', fim:'30/04/2025', responsavel:'Déborah Figueiredo', avanco:100, status:'Concluída', descricao:'Instalação de exaustores e ventiladores auxiliares', recursos:['AirTec FOR-017','Equipe Elétrica x3'], custo_previsto:28000, custo_real:27500 },
          { id:'T6-005', nome:'Licenciamento ANM + Treinamentos NR-22', tipo:'Tarefa', inicio:'15/04/2025', fim:'20/05/2025', responsavel:'Déborah Figueiredo', avanco:100, status:'Concluída', descricao:'Regularização ANM, NR-22 para 35 colaboradores + self-rescuer', recursos:['JurisMinas FOR-047','ClínicaMinas FOR-055'], custo_previsto:32000, custo_real:29800 },
          { id:'T6-006', nome:'Marco: Licença Operação ANM – Emitida', tipo:'Marco', inicio:'20/05/2025', fim:'20/05/2025', responsavel:'Ana Paula Rocha', avanco:100, status:'Concluída', descricao:'LO emitida – autorização para início do desmonte subterrâneo', recursos:[], custo_previsto:0, custo_real:0 }
        ]
      },
      {
        id: 'FASE-CONST-6', nome: 'Construção',
        tarefas: [
          { id:'T6-007', nome:'Desenvolvimento de Galeria A – 150m', tipo:'Tarefa', inicio:'21/05/2025', fim:'31/08/2025', responsavel:'Pedro H. Lima', avanco:15, status:'Em Andamento', descricao:'Avanço de 150m na galeria A – Jumbo DD420 (ciclo 4m/dia)', recursos:['Jumbo DD420','Operadores x4','ExploBras FOR-053'], custo_previsto:380000, custo_real:57000 },
          { id:'T6-008', nome:'Desenvolvimento de Galeria B – 120m', tipo:'Tarefa', inicio:'21/05/2025', fim:'31/07/2025', responsavel:'Tatiane Rezende', avanco:12, status:'Em Andamento', descricao:'Avanço de 120m na galeria B – Atlas Copco Boomer', recursos:['Boomer AC','Operadores x4','ExploBras FOR-053'], custo_previsto:280000, custo_real:33600 },
          { id:'T6-009', nome:'Suporte Rocha – Tirantes e Tela Metálica', tipo:'Tarefa', inicio:'22/05/2025', fim:'31/08/2025', responsavel:'Déborah Figueiredo', avanco:10, status:'Em Andamento', descricao:'Instalação de tirantes de ancoragem e tela de suporte', recursos:['Equipe Suporte x4','SteelMax FOR-016'], custo_previsto:145000, custo_real:14500 },
          { id:'T6-010', nome:'Drenagem Subterrânea – Level -1', tipo:'Tarefa', inicio:'01/06/2025', fim:'30/09/2025', responsavel:'Pedro H. Lima', avanco:5, status:'Em Andamento', descricao:'Instalação de bombeamento e valetamento de drenagem', recursos:['HidroMax FOR-018','Equipe Civil x3'], custo_previsto:92000, custo_real:4600 },
          { id:'T6-011', nome:'Marco: Acesso ao Corpo Mineralizado', tipo:'Marco', inicio:'01/09/2025', fim:'01/09/2025', responsavel:'Ana Paula Rocha', avanco:0, status:'Não Iniciada', descricao:'Intersecção com a camada de espodumênio confirmada', recursos:[], custo_previsto:0, custo_real:0 }
        ]
      },
      {
        id: 'FASE-INST-6', nome: 'Instalações',
        tarefas: [
          { id:'T6-012', nome:'Instalação Elétrica – Cabines + Transformadores Sub.', tipo:'Tarefa', inicio:'01/07/2025', fim:'31/08/2025', responsavel:'Márcio Freitas', avanco:0, status:'Não Iniciada', descricao:'Subestação subterrânea 380V – 2 transformadores 315kVA', recursos:['AmpereMax FOR-042','FieldTech FOR-051'], custo_previsto:185000, custo_real:0 },
          { id:'T6-013', nome:'Instalação Sistema de Comunicação Sub.', tipo:'Tarefa', inicio:'15/07/2025', fim:'31/08/2025', responsavel:'Márcio Freitas', avanco:0, status:'Não Iniciada', descricao:'Rádio digital DAS e telefonia subterrânea', recursos:['RadioComm FOR-045','FieldTech FOR-051'], custo_previsto:68000, custo_real:0 },
          { id:'T6-014', nome:'Montagem Câmara de Britagem Subterrânea', tipo:'Tarefa', inicio:'01/09/2025', fim:'30/11/2025', responsavel:'Ana Paula Rocha', avanco:0, status:'Não Iniciada', descricao:'Britador terciário para redução subterrânea do minério', recursos:['Metso FOR-010','Equipe Montagem x8'], custo_previsto:420000, custo_real:0 }
        ]
      },
      {
        id: 'FASE-COM-6', nome: 'Comissionamento',
        tarefas: [
          { id:'T6-015', nome:'Comissionamento Britador Sub. – Testes', tipo:'Tarefa', inicio:'01/12/2025', fim:'31/12/2025', responsavel:'Carlos Mendes', avanco:0, status:'Não Iniciada', descricao:'Corridas de teste + ajuste de granulometria', recursos:['Metso FOR-010','LabGeoChem FOR-048'], custo_previsto:85000, custo_real:0 },
          { id:'T6-016', nome:'Marco: Início Operação Plena – Fase 1', tipo:'Marco', inicio:'01/01/2026', fim:'01/01/2026', responsavel:'Ana Paula Rocha', avanco:0, status:'Não Iniciada', descricao:'Operação em plena capacidade nas 2 frentes + britagem', recursos:[], custo_previsto:0, custo_real:0 }
        ]
      },
      {
        id: 'FASE-OP-6', nome: 'Operação',
        tarefas: [
          { id:'T6-017', nome:'Operação Plena Frente A + B – Produção 8.000 t/mês', tipo:'Tarefa', inicio:'01/01/2026', fim:'14/04/2028', responsavel:'Pedro H. Lima', avanco:0, status:'Não Iniciada', descricao:'Meta: 8.000 t/mês de espodumênio – turno 3×8', recursos:['Jumbos x2','LHDs x4','Operadores x28','ExploBras FOR-053'], custo_previsto:4500000, custo_real:0 },
          { id:'T6-018', nome:'Manutenção Preventiva Mensal – Frota Sub.', tipo:'Tarefa', inicio:'01/01/2026', fim:'14/04/2028', responsavel:'Márcio Freitas', avanco:0, status:'Não Iniciada', descricao:'PM mensal Jumbos + LHDs + sistema hidráulico/elétrico', recursos:['TurbineServ FOR-041','AmpereMax FOR-042','Mecânicos x4'], custo_previsto:648000, custo_real:0 },
          { id:'T6-019', nome:'Análises Geoquímicas e Controle de Teores', tipo:'Tarefa', inicio:'01/01/2026', fim:'14/04/2028', responsavel:'Pedro H. Lima', avanco:0, status:'Não Iniciada', descricao:'50 amostras/mês – laudo mensal Li₂O', recursos:['LabGeoChem FOR-048'], custo_previsto:234000, custo_real:0 },
          { id:'T6-020', nome:'SSMA Contínuo – NR-22 e Relatórios', tipo:'Tarefa', inicio:'01/01/2026', fim:'14/04/2028', responsavel:'Déborah Figueiredo', avanco:0, status:'Não Iniciada', descricao:'DDS diários, FISPQ explosivos, programa saúde ocupacional', recursos:['ProSafety FOR-012','ClínicaMinas FOR-055'], custo_previsto:457200, custo_real:0 }
        ]
      }
    ],
    recursos: [
      { id:'R6-001', tipo:'Equipe', nome:'Operadores de Jumbo e LHD', funcao:'Lavra Subterrânea', quantidade:20, unidade:'pessoas', custo_unit:5500, custo_total:1320000, fase:'Operação', fornecedor:'' },
      { id:'R6-002', tipo:'Equipe', nome:'Mecânicos Subterrâneos', funcao:'Manutenção Frota Sub.', quantidade:4, unidade:'pessoas', custo_unit:5800, custo_total:278400, fase:'Instalações', fornecedor:'' },
      { id:'R6-003', tipo:'Equipe', nome:'Supervisores e Gerente', funcao:'Gestão e Controle', quantidade:3, unidade:'pessoas', custo_unit:10000, custo_total:1080000, fase:'Operação', fornecedor:'' },
      { id:'R6-004', tipo:'Equipe', nome:'Técnica de Segurança NR-22', funcao:'SSMA Subterrânea', quantidade:1, unidade:'pessoas', custo_unit:7200, custo_total:259200, fase:'Operação', fornecedor:'' },
      { id:'R6-005', tipo:'Equipamento', nome:'Jumbo Sandvik DD420', especificacao:'Elétrico – 2 braços', quantidade:1, unidade:'un', custo_unit:85000, custo_total:3060000, fase:'Operação', fornecedor:'Fraser Alexander' },
      { id:'R6-006', tipo:'Equipamento', nome:'Jumbo Atlas Copco Boomer', especificacao:'Hidráulico', quantidade:1, unidade:'un', custo_unit:72000, custo_total:2592000, fase:'Operação', fornecedor:'Fraser Alexander' },
      { id:'R6-007', tipo:'Equipamento', nome:'LHD Scoop LH514E (4 un.)', especificacao:'Elétrico Sandvik', quantidade:4, unidade:'un', custo_unit:52000, custo_total:7488000, fase:'Operação', fornecedor:'Fraser Alexander' },
      { id:'R6-008', tipo:'Material', nome:'Explosivos ANFO + Acessórios', especificacao:'36 meses', quantidade:36, unidade:'mês', custo_unit:12500, custo_total:450000, fase:'Construção', fornecedor:'ExploBras FOR-053' },
      { id:'R6-009', tipo:'Material', nome:'Lubrificantes Especiais', especificacao:'ISO VG 46/68', quantidade:36, unidade:'mês', custo_unit:4800, custo_total:172800, fase:'Operação', fornecedor:'RefinaçãoSul FOR-022' },
      { id:'R6-010', tipo:'Serviço', nome:'Análises Geoquímicas – LabGeoChem', especificacao:'50 amostras/mês', quantidade:36, unidade:'mês', custo_unit:6500, custo_total:234000, fase:'Operação', fornecedor:'LabGeoChem FOR-048' },
      { id:'R6-011', tipo:'Serviço', nome:'SSMA – ProSafety', especificacao:'NR-22 mensal', quantidade:36, unidade:'mês', custo_unit:8500, custo_total:306000, fase:'Operação', fornecedor:'ProSafety FOR-012' },
      { id:'R6-012', tipo:'Serviço', nome:'Saúde Ocupacional – ClínicaMinas', especificacao:'PCMSO + ASO', quantidade:36, unidade:'mês', custo_unit:4200, custo_total:151200, fase:'Operação', fornecedor:'ClínicaMinas FOR-055' }
    ],
    medicoes: [
      { id:'MED-006-001', numero:1, periodo:'Abr-Mai/2025', descricao:'Mobilização completa – canteiro, equipamentos e licenças', valor_medido:340000, valor_acumulado:340000, avanco_fisico:4, status:'Aprovada', data:'31/05/2025', responsavel:'Ana Paula Rocha', os_ids:['OS-006-004','OS-006-006'] },
      { id:'MED-006-002', numero:2, periodo:'Jun/2025', descricao:'Operação Mês 1 – desenvolvimento galerias A e B (15% avanço)', valor_medido:0, valor_acumulado:340000, avanco_fisico:0, status:'Pendente', data:'30/06/2025', responsavel:'Ana Paula Rocha', os_ids:['OS-006-001','OS-006-002','OS-006-003','OS-006-005'] }
    ],
    curva_planejada: [
      { mes:'Abr/25', pct_plan:2,  pct_real:2 },
      { mes:'Jun/25', pct_plan:7,  pct_real:4 },
      { mes:'Set/25', pct_plan:18, pct_real:null },
      { mes:'Dez/25', pct_plan:28, pct_real:null },
      { mes:'Mar/26', pct_plan:38, pct_real:null },
      { mes:'Jun/26', pct_plan:50, pct_real:null },
      { mes:'Set/26', pct_plan:63, pct_real:null },
      { mes:'Dez/26', pct_plan:76, pct_real:null },
      { mes:'Mar/27', pct_plan:86, pct_real:null },
      { mes:'Jun/27', pct_plan:94, pct_real:null },
      { mes:'Abr/28', pct_plan:100,pct_real:null }
    ],
    os_ids:['OS-006-001','OS-006-002','OS-006-003','OS-006-004','OS-006-005','OS-006-006'],
    criado_em:'10/04/2025', criado_por:'Ana Paula Rocha'
  };

  if (!pgAtual2.find(p => p.id === 'PROJ-006')) {
    pgAtual2.push(proj006);
    localStorage.setItem('fa_projetos_gantt', JSON.stringify(pgAtual2));
    console.log('[SEED] ✅ PROJ-006 Lithium Power carregado: 20 tarefas em 5 fases + 12 recursos + 2 medições');
  }

  // ── 12.13 Atualizar ERP_DATA global ─────────────────────────────────────
  try {
    if (window.ERP_DATA) {
      if (!window.ERP_DATA.ordens) window.ERP_DATA.ordens = [];
      osSimples006.forEach(o => { if (!window.ERP_DATA.ordens.find(x => x.id === o.id)) window.ERP_DATA.ordens.push(o); });
      if (!window.ERP_DATA.colaboradores) window.ERP_DATA.colaboradores = [];
      cols006.forEach(c => { if (!window.ERP_DATA.colaboradores.find(x => x.id === c.id)) window.ERP_DATA.colaboradores.push(c); });
      if (!window.ERP_DATA.incidentes) window.ERP_DATA.incidentes = [];
      if (!window.ERP_DATA.incidentes.find(x => x.id === 'INC-005')) window.ERP_DATA.incidentes.push(inc006);
    }
  } catch(e) {}

  // ─── BLOCO v13: Dados faltantes para Meu Painel (fa_documentos, fa_treinamentos, fa_fornecedores) ───
  const hoje13 = new Date();
  const dt13 = (d) => { const x = new Date(hoje13); x.setDate(x.getDate()+d); return x.toISOString().split('T')[0]; };

  // fa_documentos – documentos controlados (NR-35, PGR, LTCAT, etc.)
  if (!localStorage.getItem('fa_documentos')) {
    const documentos = [
      { id:'DOC-001', titulo:'PGR – Programa de Gerenciamento de Riscos',       tipo:'PGR',    status:'Vigente',  validade: dt13(120),  contrato:'CONT-001', responsavel:'Eng. Segurança' },
      { id:'DOC-002', titulo:'LTCAT – Laudo Técnico Condições Ambientais',       tipo:'LTCAT',  status:'Vigente',  validade: dt13(90),   contrato:'CONT-001', responsavel:'Eng. Segurança' },
      { id:'DOC-003', titulo:'PCMSO – Programa Controle Médico Saúde Ocup.',    tipo:'PCMSO',  status:'Vigente',  validade: dt13(60),   contrato:'CONT-002', responsavel:'Médico do Trabalho' },
      { id:'DOC-004', titulo:'Procedimento Trabalho em Altura NR-35',           tipo:'POP',    status:'Vigente',  validade: dt13(30),   contrato:'CONT-002', responsavel:'SSMA' },
      { id:'DOC-005', titulo:'Plano de Emergência e Evacuação',                 tipo:'Plano',  status:'Vencido',  validade: dt13(-15),  contrato:'CONT-001', responsavel:'SSMA' },
      { id:'DOC-006', titulo:'Permissão de Trabalho – Espaço Confinado NR-33', tipo:'PT',     status:'Vencido',  validade: dt13(-30),  contrato:'CONT-003', responsavel:'Supervisor' },
      { id:'DOC-007', titulo:'Manual de Bloqueio e Etiquetagem NR-10',         tipo:'Manual', status:'Vigente',  validade: dt13(200),  contrato:'CONT-001', responsavel:'Elétrica' },
      { id:'DOC-008', titulo:'Relatório de Auditoria ISO 9001:2015 Q1 2025',   tipo:'Auditoria', status:'Vigente', validade: dt13(300), contrato:'ALL', responsavel:'Qualidade' },
      { id:'DOC-009', titulo:'Política de SSMA',                               tipo:'Política', status:'Vigente', validade: dt13(365), contrato:'ALL', responsavel:'Diretor' },
      { id:'DOC-010', titulo:'Avaliação de Risco – Manutenção Mecânica',       tipo:'APR',    status:'Vencido',  validade: dt13(-5),   contrato:'CONT-004', responsavel:'Manutenção' },
    ];
    localStorage.setItem('fa_documentos', JSON.stringify(documentos));
  }

  // fa_treinamentos – treinamentos da equipe
  if (!localStorage.getItem('fa_treinamentos')) {
    const colabs = JSON.parse(localStorage.getItem('fa_colaboradores') || '[]');
    const nrs = ['NR-35 Trabalho em Altura','NR-10 Eletricidade','NR-33 Espaço Confinado','NR-12 Segurança Máquinas','Primeiros Socorros','Combate a Incêndio','ISO 9001 Sensibilização','eSocial – SST Obrigações'];
    const treinamentos = [];
    let tIdx = 1;
    colabs.slice(0, 15).forEach((col, ci) => {
      nrs.slice(0, 3 + (ci % 3)).forEach((nr, ni) => {
        const venc = dt13(-30 + (ci * 20 + ni * 15));  // alguns vencidos, outros ok
        treinamentos.push({
          id: `TREI-${String(tIdx).padStart(3,'0')}`,
          colaborador_id: col.id,
          colaborador: col.nome || col.name || 'Colaborador',
          treinamento: nr,
          validade: venc,
          status: new Date(venc) < new Date() ? 'Vencido' : 'Vigente',
          carga_horaria: 8 + (ni * 4),
          contrato: col.contrato || 'CONT-001'
        });
        tIdx++;
      });
    });
    // Adicionar alguns treinamentos avulsos vencidos para alertas reais
    for (let i = 0; i < 5; i++) {
      treinamentos.push({
        id: `TREI-${String(tIdx++).padStart(3,'0')}`,
        colaborador_id: `COL-0${i+1}`,
        colaborador: `Colaborador ${i+1}`,
        treinamento: nrs[i],
        validade: dt13(-60 - i*10),
        status: 'Vencido',
        carga_horaria: 8,
        contrato: 'CONT-001'
      });
    }
    localStorage.setItem('fa_treinamentos', JSON.stringify(treinamentos));
    console.log(`[SEED] ✅ ${treinamentos.length} treinamentos carregados (${treinamentos.filter(t=>t.status==='Vencido').length} vencidos)`);
  }

  // fa_fornecedores – alias para fa_fornecedores_cache (chave usada pelo painel)
  if (!localStorage.getItem('fa_fornecedores')) {
    const fornCache = JSON.parse(localStorage.getItem('fa_fornecedores_cache') || '[]');
    if (fornCache.length > 0) {
      localStorage.setItem('fa_fornecedores', JSON.stringify(fornCache));
    }
  }

  // Marca seed v13 como completo
  localStorage.setItem('_fa_demo_seed_v13', '1');
  // ─── Migração: 'Aguardando Envio' → 'Em Cotação' (status removido do fluxo RFQ) ───
  try {
    ['fa_rfqs', 'fa_rfq_flow'].forEach(function(chave) {
      var raw = localStorage.getItem(chave);
      if (!raw) return;
      var lista = JSON.parse(raw);
      var alterado = false;
      lista = lista.map(function(r) {
        if (r.status === 'Aguardando Envio') { alterado = true; return Object.assign({}, r, { status: 'Em Cotação' }); }
        return r;
      });
      if (alterado) localStorage.setItem(chave, JSON.stringify(lista));
    });
  } catch(e) {}

  localStorage.setItem('_fa_demo_seed_v15', '1');
  localStorage.setItem('_fa_demo_seed_v14', '1');
  localStorage.setItem('_fa_demo_seed_v12', '1');
  localStorage.setItem('_fa_demo_seed_v11', '1');
  localStorage.setItem('_fa_demo_seed_v10', '1');

  // ─── Seed Módulo DRE ──────────────────────────────────────────────────────
  if (!localStorage.getItem('fa_dre_lancamentos')) {
    const lancDRE = [];
    const meses = [
      {m:'01',a:2025},{m:'02',a:2025},{m:'03',a:2025},
      {m:'04',a:2025},{m:'01',a:2026},{m:'02',a:2026},{m:'03',a:2026}
    ];
    const base = {
      rec_bruta: [2100000,2350000,2820000,2640000,2900000,3050000,3120000],
      ded_rec:   [163800,183300,219960,205920,226200,237900,243360],
      cpmv:      [1050000,1175000,1410000,1320000,1450000,1525000,1560000],
      desp_adm:  [210000,235000,282000,264000,290000,305000,312000],
      desp_pessoal:[420000,470000,564000,528000,580000,610000,624000],
      desp_vendas:[84000,94000,112800,105600,116000,122000,124800],
      depreciacao:[35000,35000,35000,35000,38000,38000,38000],
      res_fin:   [-18000,-22000,-25000,-20000,-15000,-18000,-12000],
    };
    meses.forEach(({m,a}, i) => {
      Object.entries(base).forEach(([cat, vals]) => {
        lancDRE.push({
          id: `DRE-${a}-${m}-${cat}`,
          categoria: cat, valor: vals[i],
          competencia: `${m}/${a}`,
          descricao: `Apuração ${cat} ${m}/${a}`,
          criado_em: new Date().toISOString()
        });
      });
    });
    localStorage.setItem('fa_dre_lancamentos', JSON.stringify(lancDRE));
  }

  // ─── Seed Módulo Ativo Fixo ───────────────────────────────────────────────
  if (!localStorage.getItem('fa_ativos_fixos')) {
    const ativos = [
      { id:'AF-001', codigo:'VEI-001', descricao:'Caminhão Prancha Volvo FH 540', categoria:'Caminhões e Frota Pesada', data_aquisicao:'2021-03-15', valor_aquisicao:480000, taxa_deprec:20, responsavel:'José Silva', localizacao:'Pátio Central', status:'Ativo', obs:'Utilizado em obras SP e RJ', criado_em:new Date().toISOString() },
      { id:'AF-002', codigo:'VEI-002', descricao:'Pick-up Toyota Hilux CD 4x4', categoria:'Veículos/Automóveis', data_aquisicao:'2022-06-20', valor_aquisicao:185000, taxa_deprec:20, responsavel:'Carlos Lima', localizacao:'Filial SP', status:'Ativo', obs:'', criado_em:new Date().toISOString() },
      { id:'AF-003', codigo:'MAQ-001', descricao:'Escavadeira Hidráulica CAT 320', categoria:'Máquinas e Equipamentos', data_aquisicao:'2020-01-10', valor_aquisicao:950000, taxa_deprec:10, responsavel:'Marcos Vieira', localizacao:'Obra CONT-001', status:'Ativo', obs:'Revisão anual em fev/2026', criado_em:new Date().toISOString() },
      { id:'AF-004', codigo:'MAQ-002', descricao:'Guindaste Liebherr LTM 1100', categoria:'Máquinas e Equipamentos', data_aquisicao:'2019-07-15', valor_aquisicao:2800000, taxa_deprec:10, responsavel:'Marcos Vieira', localizacao:'Pátio Central', status:'Ativo', obs:'', criado_em:new Date().toISOString() },
      { id:'AF-005', codigo:'TI-001', descricao:'Servidor Dell PowerEdge R750', categoria:'Computadores e Periféricos', data_aquisicao:'2023-02-28', valor_aquisicao:42000, taxa_deprec:20, responsavel:'TI Corporativo', localizacao:'Sala Servidores', status:'Ativo', obs:'', criado_em:new Date().toISOString() },
      { id:'AF-006', codigo:'TI-002', descricao:'Estações de Trabalho (10 un.)', categoria:'Computadores e Periféricos', data_aquisicao:'2023-03-15', valor_aquisicao:68000, taxa_deprec:20, responsavel:'TI Corporativo', localizacao:'Escritório Central', status:'Ativo', obs:'', criado_em:new Date().toISOString() },
      { id:'AF-007', codigo:'MOV-001', descricao:'Mobiliário Escritório – Conjunto A', categoria:'Móveis e Utensílios', data_aquisicao:'2020-09-01', valor_aquisicao:28000, taxa_deprec:10, responsavel:'Administração', localizacao:'Escritório Central', status:'Ativo', obs:'', criado_em:new Date().toISOString() },
      { id:'AF-008', codigo:'INS-001', descricao:'Instalações Elétricas Sede', categoria:'Instalações', data_aquisicao:'2018-12-20', valor_aquisicao:95000, taxa_deprec:10, responsavel:'Infraestrutura', localizacao:'Sede Administrativa', status:'Ativo', obs:'Manutenção preventiva anual', criado_em:new Date().toISOString() },
      { id:'AF-009', codigo:'VEI-003', descricao:'Ônibus Volvo 9700 Executivo', categoria:'Caminhões e Frota Pesada', data_aquisicao:'2021-11-30', valor_aquisicao:620000, taxa_deprec:20, responsavel:'RH/Logística', localizacao:'Pátio Central', status:'Ativo', obs:'Translado de equipe', criado_em:new Date().toISOString() },
      { id:'AF-010', codigo:'SW-001', descricao:'Licença ERP Plataforma', categoria:'Software/Intangível', data_aquisicao:'2024-01-01', valor_aquisicao:180000, taxa_deprec:20, responsavel:'TI Corporativo', localizacao:'Cloud', status:'Ativo', obs:'Contrato SaaS anual', criado_em:new Date().toISOString() },
    ];
    localStorage.setItem('fa_ativos_fixos', JSON.stringify(ativos));
  }

  // ─── Seed Módulo Fiscal ───────────────────────────────────────────────────
  if (!localStorage.getItem('fa_notas_fiscais')) {
    const notas = [
      { id:'NF-001', tipo:'NFS-e', numero:'NFS-2025-001', tomador:'Construtora Alfa Ltda', cnpj:'11.222.333/0001-44', descricao:'Serviços de Engenharia – Obra CONT-001 – Março/2025', data_emissao:'2025-03-31', valor_total:420000, iss:3, pis:0.65, cofins:3, status:'Emitida', chave_acesso:'35250312345678000195650010000000011000000015', criado_em:new Date().toISOString() },
      { id:'NF-002', tipo:'NFS-e', numero:'NFS-2025-002', tomador:'Mineradora Sol Nascente S.A.', cnpj:'55.666.777/0001-88', descricao:'Serviços de Manutenção Industrial – Fev/2025', data_emissao:'2025-02-28', valor_total:186000, iss:3, pis:0.65, cofins:3, status:'Emitida', chave_acesso:'', criado_em:new Date().toISOString() },
      { id:'NF-003', tipo:'NF-e', numero:'NF-2025-003', tomador:'Fraser Alexander Indústria e Comércio', cnpj:'00.111.222/0001-33', descricao:'Fornecimento de Insumos – Projeto Lithium', data_emissao:'2025-03-15', valor_total:94500, iss:0, pis:0.65, cofins:3, status:'Emitida', chave_acesso:'', criado_em:new Date().toISOString() },
      { id:'NF-004', tipo:'NFS-e', numero:'NFS-2025-004', tomador:'Construtora Alfa Ltda', cnpj:'11.222.333/0001-44', descricao:'Medição #02 – Obra CONT-001 – Abr/2025', data_emissao:'2025-04-30', valor_total:385000, iss:3, pis:0.65, cofins:3, status:'Emitida', chave_acesso:'', criado_em:new Date().toISOString() },
      { id:'NF-005', tipo:'NFS-e', numero:'NFS-2025-005', tomador:'Vale S.A.', cnpj:'33.592.510/0001-54', descricao:'Serviços de Terraplanagem – Contrato CONT-003', data_emissao:'2025-01-31', valor_total:520000, iss:3, pis:0.65, cofins:3, status:'Emitida', chave_acesso:'', criado_em:new Date().toISOString() },
    ];
    localStorage.setItem('fa_notas_fiscais', JSON.stringify(notas));
  }

  if (!localStorage.getItem('fa_guias_tributos')) {
    const hoje = new Date();
    const guias = [
      { id:'GUI-001', tributo:'ISS', competencia:'03/2025', vencimento:'2025-04-15', valor:12600, codigo:'ISS-SP-03/2025', status:'Pago', data_pagamento:'2025-04-14', criado_em:new Date().toISOString() },
      { id:'GUI-002', tributo:'PIS', competencia:'03/2025', vencimento:'2025-04-25', valor:7280, codigo:'DARF-PIS-032025', status:'Pago', data_pagamento:'2025-04-24', criado_em:new Date().toISOString() },
      { id:'GUI-003', tributo:'COFINS', competencia:'03/2025', vencimento:'2025-04-25', valor:33580, codigo:'DARF-COFINS-032025', status:'Pago', data_pagamento:'2025-04-24', criado_em:new Date().toISOString() },
      { id:'GUI-004', tributo:'INSS', competencia:'03/2025', vencimento:'2025-04-20', valor:42000, codigo:'GPS-1201-032025', status:'Pago', data_pagamento:'2025-04-18', criado_em:new Date().toISOString() },
      { id:'GUI-005', tributo:'ISS', competencia:'04/2025', vencimento:`${hoje.getFullYear()}-${String(hoje.getMonth()+2).padStart(2,'0')}-15`, valor:11550, codigo:'ISS-SP-04/2025', status:'Pendente', criado_em:new Date().toISOString() },
      { id:'GUI-006', tributo:'PIS', competencia:'04/2025', vencimento:`${hoje.getFullYear()}-${String(hoje.getMonth()+2).padStart(2,'0')}-25`, valor:6825, codigo:'DARF-PIS-042025', status:'Pendente', criado_em:new Date().toISOString() },
      { id:'GUI-007', tributo:'COFINS', competencia:'04/2025', vencimento:`${hoje.getFullYear()}-${String(hoje.getMonth()+2).padStart(2,'0')}-25`, valor:31500, codigo:'DARF-COFINS-042025', status:'Pendente', criado_em:new Date().toISOString() },
      { id:'GUI-008', tributo:'SIMPLES', competencia:'03/2026', vencimento:`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-20`, valor:48250, codigo:'PGDAS-D-032026', status:'Pendente', criado_em:new Date().toISOString() },
    ];
    localStorage.setItem('fa_guias_tributos', JSON.stringify(guias));
  }

  if (!localStorage.getItem('fa_certificados')) {
    const certs = [
      { id:'CERT-001', tipo:'e-CNPJ A1', cnpj:'00.000.000/0001-00', emissora:'Certisign', validade:'2026-08-15', entidade:'Fraser Alexander Eng. Ltda', criado_em:new Date().toISOString() },
      { id:'CERT-002', tipo:'e-CPF A1', cnpj:'000.000.000-00', emissora:'Serpro', validade:'2025-12-31', entidade:'Carlos Eduardo Lima – Sócio', criado_em:new Date().toISOString() },
      { id:'CERT-003', tipo:'NF-e', cnpj:'00.000.000/0001-00', emissora:'Valid', validade:'2026-03-20', entidade:'Fraser Alexander Eng. Ltda – NF-e', criado_em:new Date().toISOString() },
    ];
    localStorage.setItem('fa_certificados', JSON.stringify(certs));
  }

  console.log('[SEED] ✅ Módulos DRE, Ativo Fixo e Fiscal carregados com dados demo!');
  console.log('[SEED] CONT-006 | PROJ-006 | 6 OS | 4 RC | 4 RFQ | 3 Mapas | 3 Pedidos | 2 Medições | 8 CP | 1 Fatura');
  console.log('[SEED] CRM: LEAD-006 → PROP-006 → CONT-006 → PROJ-006 (ciclo integral simulado)');
  console.log('[SEED] Resumo: 5 contratos | 15 colaboradores | 4 incidentes | 8 equipamentos');
  console.log('[SEED] 8 OS | 11 apontamentos | 8 RCs | 7 RFQs | 8 pedidos | 10 contas a pagar');
  console.log('[SEED] 55 fornecedores | 55 IDF | 14 materiais | WBS: 4 projetos + 1 proposta vinculados (sync automático ativo)');
  console.log('[SEED] 4 Projetos Gantt: PROJ-001(30 tarefas) | PROJ-002(11 tarefas) | PROJ-003(8 tarefas) | PROJ-004(12 tarefas)');
  console.log('[SEED] 6 mapas de cotação | 7 fluxos OS | 7 requisições | 5 contratos fornecimento');
  console.log('[SEED] CRM: 5 leads, 3 propostas, 5 atividades, 5 contatos, 5 oportunidades');
  console.log('[SEED] WBS: CONT-001→PROJ-001, CONT-002→PROJ-002, CONT-003→PROJ-003, CONT-004→PROJ-004');
  console.log('[SEED] Fluxo completo: OS→RC→RFQ→MAPA→PED cobertos em todos os contratos ativos');

}

// Executa após o db.js ter finalizado a limpeza (setTimeout > 200ms do db.js)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(_runSeedDemoData, 400));
} else {
  setTimeout(_runSeedDemoData, 400);
}
