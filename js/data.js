// =====================================================
// Fraser Alexander ERP – Dados do Sistema
// =====================================================
// Todos os dados são carregados do banco D1 via API REST (/api/*)
// Este arquivo mantém a estrutura de dados para compatibilidade
// com módulos que ainda referenciam ERP_DATA diretamente.
// =====================================================

const ERP_DATA = {

  // Perfis de usuário (sem dados pessoais fixos)
  profiles: {
    admin:      { name: 'Administrador',    role: 'Administrador do Sistema',  avatar: 'AD', email: '' },
    diretor:    { name: 'Diretor',          role: 'Diretor Geral',             avatar: 'DI', email: '' },
    financeiro: { name: 'Financeiro',       role: 'Gerente Financeiro',        avatar: 'FI', email: '' },
    operacao:   { name: 'Operação',         role: 'Gestor de Operações',       avatar: 'OP', email: '' },
    compras:    { name: 'Compras',          role: 'Analista de Suprimentos',   avatar: 'CO', email: '' },
    ssma:       { name: 'SSMA',             role: 'Técnico(a) de SSMA',        avatar: 'SS', email: '' },
    rh:         { name: 'RH',               role: 'Analista de RH',            avatar: 'RH', email: '' },
    supervisor: { name: 'Supervisor',       role: 'Supervisor de Campo',       avatar: 'SU', email: '' }
  },

  // Dados operacionais iniciais (seed Fraser Alexander – Mina do Cerrado e demais contratos)
  contratos: [
    { id: 'CONT-001', cliente: 'Mineração Vale Verde Ltda',   objeto: 'Operação e Manutenção de Equipamentos de Mineração', valor: 4800000, medidoAcum: 1920000, status: 'Ativo',       inicio: '2024-01-15', fim: '2026-01-14', equipe: 28, gestor: 'Ricardo Almeida',  contato_cliente: 'Eng. Paulo Henrique',     tipo: 'Operação',           moeda: 'BRL' },
    { id: 'CONT-002', cliente: 'Cobre & Ouro Mineração S/A', objeto: 'Terraplanagem e Estradas de Mina',                   valor: 2350000, medidoAcum:  940000, status: 'Ativo',       inicio: '2024-03-01', fim: '2025-08-31', equipe: 14, gestor: 'Fernanda Costa',   contato_cliente: 'Diretora Maria Clara',     tipo: 'Construção',         moeda: 'BRL' },
    { id: 'CONT-003', cliente: 'Bauxita do Norte Ind. e Com.',objeto: 'Serviços de Britagem Primária e Secundária',         valor: 1800000, medidoAcum: 1440000, status: 'Ativo',       inicio: '2023-08-01', fim: '2025-07-31', equipe: 10, gestor: 'Carlos Mendes',    contato_cliente: 'Diretor Técnico João Silva',tipo: 'Processamento',      moeda: 'BRL' },
    { id: 'CONT-004', cliente: 'Ferro Bruto Extração Ltda',   objeto: 'Desmonte a Fogo e Carregamento',                    valor: 3200000, medidoAcum:  320000, status: 'Mobilização', inicio: '2025-02-01', fim: '2027-01-31', equipe: 20, gestor: 'Ana Paula Rocha', contato_cliente: 'Gerente de Operações Sérgio',tipo:'Perfuração e Fogo',  moeda: 'BRL' },
    { id: 'CONT-005', cliente: 'Granito Serrano Cia.',        objeto: 'Gestão de Pátio e Expedição',                       valor:  980000, medidoAcum:  980000, status: 'Encerrado',   inicio: '2023-01-01', fim: '2024-12-31', equipe:  6, gestor: 'Marcos Vieira',   contato_cliente: 'Sr. Antônio Pereira',      tipo: 'Logística',          moeda: 'BRL' }
  ],

  colaboradores: [
    { id: 'COL-001', nome: 'Ricardo Almeida',    cargo: 'Gerente de Operações',      contrato: 'CONT-001', status: 'Ativo',      docs: 'OK',      admissao: '2022-01-10', salario: 12500 },
    { id: 'COL-002', nome: 'Fernanda Costa',     cargo: 'Engenheira de Minas',       contrato: 'CONT-002', status: 'Ativo',      docs: 'OK',      admissao: '2023-03-15', salario: 11000 },
    { id: 'COL-003', nome: 'Carlos Mendes',      cargo: 'Supervisor de Campo',       contrato: 'CONT-003', status: 'Ativo',      docs: 'Atenção', admissao: '2022-08-01', salario:  8500 },
    { id: 'COL-004', nome: 'Jair Oliveira',      cargo: 'Operador de Escavadeira',   contrato: 'CONT-001', status: 'Ativo',      docs: 'OK',      admissao: '2023-01-05', salario:  5200 },
    { id: 'COL-005', nome: 'Patrícia Souza',     cargo: 'Técnica de SSMA',           contrato: 'CONT-001', status: 'Ativo',      docs: 'OK',      admissao: '2023-05-20', salario:  6800 },
    { id: 'COL-006', nome: 'Antônio Ferreira',   cargo: 'Motorista de Caminhão',     contrato: 'CONT-001', status: 'Ativo',      docs: 'OK',      admissao: '2022-11-15', salario:  4800 },
    { id: 'COL-007', nome: 'Marcos Vieira',      cargo: 'Mecânico de Manutenção',    contrato: 'CONT-002', status: 'Ativo',      docs: 'Crítico', admissao: '2024-03-01', salario:  5500 },
    { id: 'COL-008', nome: 'Luciana Barros',     cargo: 'Analista de Custos',        contrato: 'CONT-001', status: 'Ativo',      docs: 'OK',      admissao: '2023-07-10', salario:  7200 },
    { id: 'COL-009', nome: 'Pedro Castilho',     cargo: 'Operador de Perfuratriz',   contrato: 'CONT-004', status: 'Mobilizando',docs: 'OK',      admissao: '2025-02-01', salario:  5800 },
    { id: 'COL-010', nome: 'Ana Paula Rocha',    cargo: 'Gerente de Contratos',      contrato: 'CONT-004', status: 'Mobilizando',docs: 'OK',      admissao: '2024-12-15', salario: 13000 },
    { id: 'COL-011', nome: 'José Rodrigues',     cargo: 'Operador de Motoniveladora',contrato: 'CONT-002', status: 'Ativo',      docs: 'OK',      admissao: '2024-03-10', salario:  5100 },
    { id: 'COL-012', nome: 'Simone Lacerda',     cargo: 'Auxiliar Administrativo',   contrato: 'CONT-001', status: 'Ativo',      docs: 'Atenção', admissao: '2023-09-01', salario:  3200 },
    { id: 'COL-013', nome: 'Roberto Lima',       cargo: 'Eletricista Industrial',    contrato: 'CONT-003', status: 'Ativo',      docs: 'OK',      admissao: '2023-08-15', salario:  5900 },
    { id: 'COL-014', nome: 'Cláudia Martins',    cargo: 'Enfermeira do Trabalho',    contrato: 'CONT-001', status: 'Ativo',      docs: 'OK',      admissao: '2022-06-01', salario:  6200 },
    { id: 'COL-015', nome: 'Diego Fonseca',      cargo: 'Operador de Britagem',      contrato: 'CONT-003', status: 'Ativo',      docs: 'OK',      admissao: '2023-08-01', salario:  4700 }
  ],

  incidentes: [
    { id: 'INC-001', data: '2025-02-10', tipo: 'Quase Acidente',          descricao: 'Veículo passou próximo a pedestre na pista de acesso – Mina do Cerrado', gravidade: 'Baixa', contrato: 'CONT-001', envolvidos: ['COL-006'], acoes: 'Treinamento de sinalização e novos cones', status: 'Fechado' },
    { id: 'INC-002', data: '2025-03-05', tipo: 'Acidente Sem Afastamento',descricao: 'Corte leve na mão durante manutenção – falta de EPI adequado',            gravidade: 'Média', contrato: 'CONT-002', envolvidos: ['COL-007'], acoes: 'Investigação em andamento – troca de luvas corte 5', status: 'Aberto' },
    { id: 'INC-003', data: '2025-01-22', tipo: 'Condição Insegura',       descricao: 'Derramamento de óleo hidráulico na área de manutenção',                    gravidade: 'Baixa', contrato: 'CONT-001', envolvidos: [],          acoes: 'Área limpa e kit de contenção instalado',         status: 'Fechado' },
    { id: 'INC-004', data: '2025-03-15', tipo: 'Quase Acidente',          descricao: 'Falha no freio de estacionamento do caminhão HD785',                        gravidade: 'Alta',  contrato: 'CONT-001', envolvidos: ['COL-004'], acoes: 'Caminhão retirado – manutenção emergencial',       status: 'Aberto' }
  ],

  equipamentos: [
    { id: 'EQP-001', codigo: 'EX-001', descricao: 'Escavadeira Hidráulica PC800',    tipo: 'Equipamento', marca: 'Komatsu',    modelo: 'PC800-8',       ano: 2020, placa: 'MG-001', contrato: 'CONT-001', status: 'Operacional', horasAcum: 8450,  ultimaManut: '2025-03-01', proxManut: '2025-05-01' },
    { id: 'EQP-002', codigo: 'HD-001', descricao: 'Caminhão Fora-de-Estrada HD785',  tipo: 'Veículo',     marca: 'Komatsu',    modelo: 'HD785-7',       ano: 2019, placa: 'MG-002', contrato: 'CONT-001', status: 'Manutenção',  horasAcum: 12300, ultimaManut: '2025-03-20', proxManut: '2025-04-10' },
    { id: 'EQP-003', codigo: 'MN-001', descricao: 'Motoniveladora GD655',            tipo: 'Equipamento', marca: 'Komatsu',    modelo: 'GD655-5',       ano: 2021, placa: 'MG-003', contrato: 'CONT-002', status: 'Operacional', horasAcum: 5200,  ultimaManut: '2025-02-15', proxManut: '2025-04-15' },
    { id: 'EQP-004', codigo: 'BT-001', descricao: 'Britador Primário 42×65',         tipo: 'Equipamento', marca: 'Metso',      modelo: 'Nordberg C160', ano: 2018, placa: 'N/A',    contrato: 'CONT-003', status: 'Operacional', horasAcum: 18700, ultimaManut: '2025-03-10', proxManut: '2025-04-30' },
    { id: 'EQP-005', codigo: 'PF-001', descricao: 'Perfuratriz Rotativa DM45',       tipo: 'Equipamento', marca: 'Caterpillar',modelo: 'DM45-HP',       ano: 2022, placa: 'N/A',    contrato: 'CONT-004', status: 'Operacional', horasAcum: 1200,  ultimaManut: '2025-03-25', proxManut: '2025-05-25' },
    { id: 'EQP-006', codigo: 'TR-001', descricao: 'Trator de Esteiras D155',         tipo: 'Equipamento', marca: 'Komatsu',    modelo: 'D155AX-8',      ano: 2020, placa: 'MG-005', contrato: 'CONT-001', status: 'Operacional', horasAcum: 7800,  ultimaManut: '2025-02-28', proxManut: '2025-04-28' },
    { id: 'EQP-007', codigo: 'PP-001', descricao: 'Pá Carregadeira WA600',           tipo: 'Equipamento', marca: 'Komatsu',    modelo: 'WA600-8',       ano: 2021, placa: 'MG-006', contrato: 'CONT-001', status: 'Operacional', horasAcum: 6100,  ultimaManut: '2025-03-05', proxManut: '2025-05-05' },
    { id: 'EQP-008', codigo: 'CT-001', descricao: 'Caminhão Basculante Volvo FMX',   tipo: 'Veículo',     marca: 'Volvo',      modelo: 'FMX 500',       ano: 2022, placa: 'MG-007', contrato: 'CONT-002', status: 'Operacional', horasAcum: 4300,  ultimaManut: '2025-03-18', proxManut: '2025-05-18' }
  ],

  medicoes: [
    { id: 'MED-001', contrato: 'CONT-001', referencia: 'Jan/2025', dataEnvio: '2025-02-05', dataPagamento: '2025-02-25', bruto: 380000, glosa: 8500, liquido: 371500, status: 'Paga',      observacoes: 'Medição aprovada sem ressalvas' },
    { id: 'MED-002', contrato: 'CONT-001', referencia: 'Fev/2025', dataEnvio: '2025-03-05', dataPagamento: '2025-03-25', bruto: 395000, glosa: 4200, liquido: 390800, status: 'Paga',      observacoes: 'Glosa por hora parada EQP-002' },
    { id: 'MED-003', contrato: 'CONT-001', referencia: 'Mar/2025', dataEnvio: '2025-04-02', dataPagamento: '',           bruto: 410000, glosa: 0,    liquido: 410000, status: 'Enviada',   observacoes: 'Aguardando aprovação cliente' },
    { id: 'MED-004', contrato: 'CONT-002', referencia: 'Fev/2025', dataEnvio: '2025-03-07', dataPagamento: '2025-03-28', bruto: 195000, glosa: 0,    liquido: 195000, status: 'Paga',      observacoes: '' },
    { id: 'MED-005', contrato: 'CONT-002', referencia: 'Mar/2025', dataEnvio: '2025-04-04', dataPagamento: '',           bruto: 198000, glosa: 0,    liquido: 198000, status: 'Enviada',   observacoes: '' },
    { id: 'MED-006', contrato: 'CONT-003', referencia: 'Mar/2025', dataEnvio: '2025-04-01', dataPagamento: '',           bruto: 148000, glosa: 2100, liquido: 145900, status: 'Contestada',observacoes: 'Cliente contestou horas de britagem' }
  ],

  faturas: [
    { id: 'FAT-001', contrato: 'CONT-001', numero: 'NF-000345', referencia: 'Jan/2025', emissao: '2025-02-06', vencimento: '2025-02-28', bruto: 380000, glosa: 8500, liquido: 371500, status: 'Paga',       pagamento: '2025-02-25' },
    { id: 'FAT-002', contrato: 'CONT-001', numero: 'NF-000389', referencia: 'Fev/2025', emissao: '2025-03-06', vencimento: '2025-03-28', bruto: 395000, glosa: 4200, liquido: 390800, status: 'Paga',       pagamento: '2025-03-25' },
    { id: 'FAT-003', contrato: 'CONT-001', numero: 'NF-000421', referencia: 'Mar/2025', emissao: '2025-04-03', vencimento: '2025-04-30', bruto: 410000, glosa: 0,    liquido: 410000, status: 'Em Aberto',  pagamento: '' },
    { id: 'FAT-004', contrato: 'CONT-002', numero: 'NF-000392', referencia: 'Fev/2025', emissao: '2025-03-08', vencimento: '2025-03-30', bruto: 195000, glosa: 0,    liquido: 195000, status: 'Paga',       pagamento: '2025-03-28' },
    { id: 'FAT-005', contrato: 'CONT-002', numero: 'NF-000425', referencia: 'Mar/2025', emissao: '2025-04-05', vencimento: '2025-05-05', bruto: 198000, glosa: 0,    liquido: 198000, status: 'Em Aberto',  pagamento: '' },
    { id: 'FAT-006', contrato: 'CONT-003', numero: 'NF-000387', referencia: 'Fev/2025', emissao: '2025-03-02', vencimento: '2025-03-30', bruto: 148000, glosa: 2100, liquido: 145900, status: 'Atrasada',   pagamento: '' }
  ],

  ordens: [
    { id: 'OS-2025-0001', contrato: 'CONT-001', tipo: 'Preventiva', descricao: 'Revisão geral Escavadeira PC800 – 500h',        status: 'Concluída',    prioridade: 'Normal',  responsavel: 'Marcos Vieira',  equipe: 2, prazo: '2025-03-10', horas: 8,  progresso: 100, local: 'Oficina Central' },
    { id: 'OS-2025-0002', contrato: 'CONT-001', tipo: 'Corretiva',  descricao: 'Reparo freio estacionamento HD785',              status: 'Em Andamento', prioridade: 'Crítica', responsavel: 'Marcos Vieira',  equipe: 3, prazo: '2025-04-02', horas: 16, progresso:  60, local: 'Oficina Central' },
    { id: 'OS-2025-0003', contrato: 'CONT-002', tipo: 'Preventiva', descricao: 'Troca de pneus Motoniveladora GD655',            status: 'Agendada',     prioridade: 'Normal',  responsavel: 'José Rodrigues', equipe: 2, prazo: '2025-04-10', horas: 6,  progresso:   0, local: 'Canteiro CONT-002' },
    { id: 'OS-2025-0004', contrato: 'CONT-003', tipo: 'Inspeção',   descricao: 'Inspeção mandíbulas britador primário',          status: 'Concluída',    prioridade: 'Alta',    responsavel: 'Diego Fonseca', equipe: 2, prazo: '2025-03-20', horas: 4,  progresso: 100, local: 'Planta Britagem' },
    { id: 'OS-2025-0005', contrato: 'CONT-001', tipo: 'Preventiva', descricao: 'Lubrificação geral equipamentos – lote Março',   status: 'Em Andamento', prioridade: 'Normal',  responsavel: 'Jair Oliveira',  equipe: 2, prazo: '2025-04-05', horas: 12, progresso:  45, local: 'Pátio de Manutenção' },
    { id: 'OS-2025-0006', contrato: 'CONT-004', tipo: 'Projeto',    descricao: 'Instalação e comissionamento perfuratriz DM45', status: 'Em Andamento', prioridade: 'Alta',    responsavel: 'Pedro Castilho', equipe: 4, prazo: '2025-04-15', horas: 32, progresso:  30, local: 'Área de Perfuração' }
  ]
};

// Dados para gráficos – Fraser Alexander 2025
const CHART_DATA = {
  faturamentoMensal: {
    labels: ['Out/24', 'Nov/24', 'Dez/24', 'Jan/25', 'Fev/25', 'Mar/25'],
    previsto:   [580000, 595000, 610000, 620000, 630000, 640000],
    realizado:  [562000, 588000, 603000, 566500, 585800, 608900]
  },
  custoReceita: {
    labels: ['Out/24', 'Nov/24', 'Dez/24', 'Jan/25', 'Fev/25', 'Mar/25'],
    receita: [562000, 588000, 603000, 566500, 585800, 608900],
    custo:   [438000, 456000, 468000, 441000, 456000, 474000]
  },
  osStatus: {
    labels: ['Concluídas', 'Em Andamento', 'Agendadas', 'Pausadas', 'Aguard. Peça'],
    values: [2, 3, 1, 0, 0],
    colors: ['#22c55e', '#1a73e8', '#f59e0b', '#8b949e', '#ef4444']
  },
  contratoValor: {
    labels: ['CONT-001 Vale Verde', 'CONT-002 Cobre & Ouro', 'CONT-003 Bauxita Norte', 'CONT-004 Ferro Bruto'],
    values: [4800000, 2350000, 1800000, 3200000]
  }
};
