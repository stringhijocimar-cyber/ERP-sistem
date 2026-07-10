# NEXUS ERP — Análise Profunda, Benchmark de Mercado e Roadmap

> Documento vivo. Objetivo declarado pelo dono do produto: **ser o melhor ERP da
> atualidade**, com tudo interligado, funcional e inteligente. Este documento
> traça onde estamos, como nos comparamos ao mercado, e o caminho prático para
> chegar lá — com decisões de engenharia já tomadas e justificadas.

---

## 1. Sumário executivo

O NEXUS já tem uma **amplitude de módulos rara** para um produto deste estágio
(compras ponta a ponta, RC→RFQ→Mapa→PC→Recebimento→Financeiro, IDF de
fornecedores, SSMA, almoxarifado, contratos, CRM, projetos). Os ganhos recentes
endereçaram a **fundação de confiança**: autenticação segura, gate de pagamento
("nada paga sem lastro"), backend único no Cloudflare e religação do caminho do
dinheiro ao servidor.

O foco agora vira para **profundidade e inteligência**: tornar cada módulo
realmente funcional (começando por Fornecedores), interligar os dados e embutir
**inteligência adaptativa** e **conformidade (ISO)** como diferenciais.

---

## 2. Entregue nesta fase

| Item | Estado |
|---|---|
| **Cadastro de fornecedores funcional** (bug do `json.success` + perda de campos) | ✅ corrigido, via camada `DB` robusta nos 2 backends |
| **Validação de dados** (CNPJ com dígitos verificadores, e-mail, duplicidade) | ✅ |
| **Dados financeiros** (faturamento, banco/agência/conta, limite) | ✅ persistidos |
| **Análise de crédito do fornecedor** (motor transparente 0–100 + classe A–D + limite sugerido) | ✅ `js/lib/credito.js` + testes |
| **Rodar/visualizar no Genspark** (`package.json` na raiz → `npm start`) | ✅ |
| **`/sync` genérico no Express** (RC/RFQ/mapas/contratos/projetos/crm já enviavam snapshot → caíam em 404 silencioso e nunca persistiam) | ✅ corrigido + paridade no Worker + reconcile de boot no front |
| **`NexusAPI` (cliente das 11 páginas "enterprise")** — o objeto era referenciado mas **nunca definido**, então notifications/crm_pipeline/commercial/lowcode/customer_*/production/security/workflow/data_platform/consolidation **quebravam no mount** | ✅ cliente resiliente (get/post tolerantes a 404, desembrulho de envelope, escape) — páginas degradam para estado vazio honesto em vez de tela quebrada |
| **Caminho do dinheiro provado E2E** (RC → RFQ → Cotações → Mapa → Aprovação → PC → Conta a Pagar) | ✅ teste de integração ponta a ponta dirige a cadeia via API e verifica persistência + gates (WBS na RC, concorrência mínima, homologação na PC, conta a pagar automática) |
| **Rede de segurança de navegação (anti-crash / anti-spinner)** — `navigate()` envolve todo render em try/catch + `.catch` assíncrono + watchdog de spinner; qualquer módulo que quebre ou trave vira card de erro com "Tentar novamente" (a causa-raiz do bug histórico de Fornecedores, agora coberta globalmente para as 60 páginas) | ✅ `js/nav_safety.js` + testes |
| **Multi-tenant (fundação SaaS)** — tabela `empresas`, `usuarios.empresa_id`, escopo de tenant vindo SEMPRE de `req.user.empresa_id` (não spoofável). `sync_store` isolado por empresa (contratos/projetos/crm/rc/rfq/mapas…). Endpoints `/api/empresas` (mestre provisiona; demais só a própria). Usuários herdam a empresa do criador | ✅ Express + testes de isolamento |
| **Isolamento de fornecedores por tenant** (dados bancários, CNPJ, crédito) — listagem, leitura, IDF, edição, homologação, alteração bancária e relatório de duplicatas todos escopados por empresa; CNPJ duplicado avaliado só dentro do tenant | ✅ Express + testes de vazamento cruzado |
| **Isolamento do caminho do dinheiro por tenant** — RC, RFQ, mapas, pedidos e contas a pagar escopados por empresa: listas, GET/:id, edição, aprovação de mapa, cotações, envio/entrega/cancelamento de PC, aprovação de alçada e pagamento. `rowScoped()` reutilizável (404 se de outro tenant) | ✅ Express + testes de vazamento cruzado |
| **Isolamento de OS e dos agregados por tenant** — ordens de serviço (lista/GET/PUT/iniciar/concluir) escopadas; dashboard, BI e fluxo de caixa consolidam apenas os dados da própria empresa (OS/RC/PC/financeiro/fornecedores). Contratos e trilha de logs ficam para o próximo slice | ✅ Express + testes |
| **Isolamento de Contratos, CRM, Projetos, WBS e Propostas por tenant** — listas/CRUD escopados; rollup de WBS e alerta de vencimento de contrato por empresa; proposta só de lead do próprio tenant (com estimativa WBS) | ✅ Express + testes |
| **Isolamento de Almoxarifado e da trilha de logs por tenant** — itens (lista/CRUD/movimentação) e recursos doc-model (materiais/movimentos/empréstimos/inventários) escopados; `log()` atribui a empresa do autor; `/api/logs` mostra só a própria trilha (mestre vê tudo); verificação da cadeia restrita ao mestre | ✅ Express + testes — **isolamento operacional do Express completo** |
| **Paridade multi-tenant no Worker (D1)** — `empresa_id` no JWT; CRUD genérico e `/sync` carimbam a empresa no payload (spoof sobrescrito), listas filtram e operações por id devolvem 404 cross-tenant; `/api/empresas` (mestre provisiona); usuários herdam a empresa do criador; migração preguiçosa idempotente p/ bancos implantados | ✅ **isolamento ponta-a-ponta nos 2 backends** + testes |
| **SSMA + Medições persistindo** — incidentes (`_ssSaveIncidentes`) e medições (`_saveMedicoes`) sincronizam via `/sync` a cada salvamento; reconcile de boot amplia para ssma/medições (empurra o snapshot local quando o servidor está vazio) | ✅ front + teste comportamental do reconcile |
| **Hardening de segurança (nível SAP)** — headers de segurança em toda resposta (nosniff, X-Frame DENY, Referrer-Policy, Permissions-Policy, HSTS opt-in); política de senha forte na criação/troca de usuários (Express + Worker, paridade testada); **sessão expirada deixa de autenticar** (bug real: o token continuava válido após `expira_em`) + limpeza oportunista de sessões vencidas no login | ✅ Express + Worker + testes |
| **Dashboard com dados reais do servidor** — o boot pré-carrega contas a pagar, OS e contratos (tenant-isolados) para os caches que o dashboard lê; contratos REAIS têm precedência sobre o seed demo `ERP_DATA` (que antes era a única fonte dos KPIs de contrato); lista vazia do servidor não apaga o cache local | ✅ front + testes |
| **Badge multi-empresa com o tenant REAL** — o boot cacheia `/api/empresas/atual`; `getEmpresaAtiva` usa a identidade do servidor (nome/CNPJ do tenant logado) em vez do seletor cosmético do localStorage; fallback preservado quando offline | ✅ front + testes |
| **`/api/health` público + dashboard do Worker protegido** — o Worker expunha `/dashboard` SEM token (vazava contadores globais); agora exige auth e conta só o tenant do usuário. Novo health-check público e sem dados nos 2 backends; o front (`_checkApi`) sonda o health em vez do dashboard (usuário deslogado não vê mais a API como "offline") | ✅ Express + Worker + front + testes + smoke |
| **Gestão de tenants no front** — o modal de empresas ganha a seção "Tenants no servidor": lista os tenants reais via `/api/empresas` e o mestre provisiona novos ("Novo tenant" → razão social/fantasia/CNPJ → POST). Escape de HTML, detecção do mestre pelo cache do servidor, seção some quando offline | ✅ front + testes |
| **Anomalias de compra na Central de Alertas** — o motor puro (fracionamento de alçada, valor fora da curva, fornecedor novo/crédito ruim com valor alto, duplicidade) roda server-side sobre os pedidos do tenant e publica alertas proativos (`anomalia_*`), com dedupe por (tipo, fornecedor) e isolamento entre tenants | ✅ Express + testes |
| **Notificação proativa de anomalias + notificações por tenant** — anomalia de severidade ALTA na emissão do pedido notifica o Financeiro (com e-mail) e o Compliance do tenant no momento do evento, com trilha de auditoria; e as notificações ganharam `empresa_id` (vazamento fechado: notificação por perfil ia para o mesmo perfil de OUTRO tenant) | ✅ Express + testes |
| **Relatório executivo de riscos no BI** — `/api/bi` ganha a seção `riscos`: total de anomalias, contagem de severidade alta, distribuição por tipo (fracionamento, duplicidade, fora da curva…) e as 5 principais ocorrências — pronto para o painel gerencial, escopado por tenant | ✅ Express + testes |
| **Varredura de qualidade + correções** — code review dos PRs #64–#73 achou e corrigiu: rotas especializadas do Worker sem carimbo/checagem de tenant (RC/OS/mapas/pedidos/recebimentos/aceites/propostas/WBS/NF/fornecedores/aprovações/gate — agora `getDocDoTenant` + carimbo em toda criação), alertas/BI do Worker filtrados por tenant, LGPD (Express e Worker) escopado, PC não referencia fornecedor de outro tenant, `notificar()` deriva a empresa do destinatário, dashboard normaliza `valor_total`→`valor` (KPI não zera), ALTER de `users.empresa_id` roda no boot do Worker, paridade de senha vazia | ✅ Express + Worker + front + testes |
| **Riscos visíveis no Dashboard BI (front)** — bloco "Riscos de compra (anomalias)" no painel gerencial: contadores (total/alta), chips por tipo traduzidos, principais ocorrências com severidade e valor, link para a central; estado verde quando não há riscos; escape de HTML | ✅ front + testes |
| **Contratos first-class no front** — o botão "Novo Contrato" era FAKE (só toast, não criava nada) e a edição só mudava memória. Agora: criação via POST `/api/contratos` (fallback local honesto offline), edição de contrato real via PUT + cache, e a página (KPIs, tabela, filtro, detalhe, edição) lê a fonte mesclada — contratos reais do servidor normalizados + seed demo | ✅ front + testes (inclui render completo da página em jsdom) |
| **Conta a pagar visível no ato do recebimento (B1 no front)** — o modal "Recebimento Registrado" agora lista as contas REAIS do servidor (número, valor, vencimento, status) e ganha o botão "Ir para Contas a Pagar"; antes a informação era só um toast transitório | ✅ front + testes |
| **Projetos/Gantt vinculando contratos REAIS** — o seletor "Contrato Vinculado" normaliza o shape do servidor (contratos reais apareciam sem nome), mescla com o seed, e sugere o valor contratual ao selecionar (sem sobrescrever digitação); com o sync de projetos já ativo, o ciclo contrato→projeto fecha com dados reais | ✅ front + testes |
| **CRM first-class no front** — criar/editar/mover lead NÃO persistia nem no localStorage (perdia tudo no refresh); agora todo salvamento persiste + sincroniza com `/api/crm` (POST na criação com `_srvId`, PUT nas mudanças — que dispara o gatilho C1 de orçamentação no servidor quando o lead passa de Qualificação); reconcile de boot do CRM corrigido (o shape objeto `{leads}` nunca era empurrado) | ✅ front + testes |
| **Proposta do CRM ligada ao C2 real** — o botão "Gerar Proposta" do CRM agora cria via `POST /api/propostas`: o servidor impõe o gate "lead sem estimativa WBS → bloqueia" (usuário orientado ao Controle de Custos), calcula o custo estimado e devolve o número oficial (PROP-AAAA-NNN); bônus: a proposta local só persistia se a etapa mudasse (bug corrigido) | ✅ front + testes |
| **CI (GitHub Actions)** — todo push/PR roda os 509 testes + `node --check` dos 2 backends (Node 20 e 22); fecha o gap "os testes só rodavam local" | ✅ `.github/workflows/ci.yml` |
| **Varredura de qualidade #2 + correções** — review adversarial dos PRs #75–#80 achou e corrigiu: filtro de contratos quebrava com id numérico de contrato real; `_ctrContratos`/`_pgContratosDisponiveis` quebravam com JSON não-array em `fa_contratos`; `_crmSyncLeadServidor` podia POSTar o lead 2× (guarda de in-flight); toast "módulo não conectado" enganoso em 409 de negócio (restrito a 404/rede) | ✅ front + testes |
| **Modo demo comercial** — `POST /api/demo/seed` (admin, idempotente, isolado por tenant) popula o tenant atual com um cenário coerente que materializa os 4 momentos de valor: (1) conta a pagar sem NF bloqueada no gate, (2) fracionamento de alçada na Central de Alertas + e-mail, (3) lead em Qualificação disparando orçamentação, (4) custo real da OS na linha WBS do contrato. Devolve o roteiro de demonstração; botão "Cenário demo" no modal de empresas | ✅ Express + front + testes + smoke |
| **Fiscal real — fundação + adapter PlugNotas (NFS-e)** — `lib/nfe.js` vira provider-agnóstico (`mock` default → nada quebra; `plugnotas` real). Payload builder e parser são funções PURAS testadas sem credencial; emissão assíncrona persiste `processando` e `POST /api/nfe/:id/status` consulta e vira `autorizada` (com chave/PDF/XML). Notas isoladas por tenant. Env `NFE_PROVIDER/API_KEY/BASE_URL/AMBIENTE` | ✅ Express + testes (adapter + endpoint com fetch mockado) |
| **Contas a Receber (nova modalidade — dinheiro que entra)** — backend completo espelhando Contas a Pagar, isolado por tenant: `/api/contas-receber` (lista/criar/editar), `faturar` (vincula NF) e `receber` (baixa o título, bloqueia duplicidade). Numeração CR-AAAA-NNN por empresa. Dashboard ganha `a_receber_total`/`recebido_total`. Completa o ciclo Contrato→Medição→Faturamento→Recebimento | ✅ Express + testes |
| **Página Faturamento REAL** — era 100% fake (pipeline com números fixos + tabela do seed); agora consome `/api/contas-receber` do tenant: pipeline por status (A Faturar/A Receber/Em Atraso/Recebida), tabela real, totais, detecção de atraso; ações **Nova cobrança** (POST), **Faturar** e **Receber** (baixa) persistem de verdade; escape de HTML | ✅ front + testes jsdom |
| **Elos do faturamento — medição→cobrança→NFS-e** — `POST /api/contas-receber/de-medicao` gera a conta a receber a partir de uma medição aprovada (idempotente por medicao_id, não duplica); `POST /api/contas-receber/:id/emitir-nfse` emite a NFS-e da conta (emitente = CNPJ da empresa/tenant, tomador = cliente), persiste a nota, vincula à conta e coloca em cobrança — liga o faturamento ao fiscal (#84). Botão "Emitir NFS-e" no front. Isolado por tenant | ✅ Express + front + testes |
| **DRE real (Demonstração de Resultado dos livros)** — `GET /api/dre?ano&mes` deriva a DRE dos livros do tenant: Receita (AR faturada) − Custos (AP de pedidos) − Despesas (AP overhead), com margens e visão CAIXA (recebido−pago); filtro por período; isolado por tenant. Card "DRE Real — da operação" no topo da página DRE (antes 100% manual/mock) | ✅ Express + front + testes |
| **Conciliação bancária** — importa extrato **CSV/OFX** (parser puro pt-BR/en-US: valor `1.234,56`/`1,234.56`, datas ISO/BR/OFX, colunas crédito/débito ou sinal), grava lançamentos; `GET /api/conciliacao/sugestoes` casa débito↔conta a pagar e crédito↔conta a receber por **valor exato + janela de datas** (score por proximidade); `POST /:id/conciliar` **baixa o título** (Pago/Recebida) e marca o lançamento; `/ignorar` (tarifas/transferências); `/resumo`. Nova página "Conciliação Bancária" no menu Financeiro. Isolado por tenant | ✅ lib pura + Express + front + testes |
| **RH — colaboradores & apontamento de horas** — cadastro de colaboradores com **custo/hora** (`/api/colaboradores` CRUD); apontamento de horas em contratos (`POST /api/apontamentos-hora`) gera **custo = horas × custo/hora** com **snapshot** (histórico não muda se o salário mudar); rollup de mão de obra por contrato (`/api/contratos/:id/custo-mao-de-obra`). **ELO com a DRE real**: a mão de obra apontada entra no **custo dos serviços** (`custo_mao_obra` + linha própria) — a maior despesa de uma empresa de serviços deixa de ser invisível na margem. Nova página "RH / Colaboradores". Isolado por tenant | ✅ Express + DRE + front + testes |
| **Margem real por contrato** — `GET /api/contratos/:id/margem` monta o P&L do contrato: Receita (AR faturada) − Custo de pedidos (AP do contrato) − Custo de mão de obra (apontamentos), com resultado e margem %; casa o contrato tanto pelo **id numérico** quanto pelo **número** (livros referenciam qualquer um). Card "Margem real do contrato" na tela de detalhe do Contrato (silencioso se o contrato não existir no backend). Isolado por tenant | ✅ Express + front + testes |
| **Fluxo de caixa projetado** — `GET /api/fluxo-caixa-projetado?semanas&saldo_inicial` combina **entradas** (AR em aberto) × **saídas** (AP em aberto) por semana com **saldo acumulado** a partir de um saldo inicial; vencidos em aberto caem na 1ª semana e são expostos à parte; **detecta aperto de caixa** (semana crítica = menor saldo). Card "Fluxo de Caixa Projetado" na página DRE, ao lado da visão histórica. Isolado por tenant | ✅ lib pura + Express + front + testes |
| **Dashboard financeiro consolidado (cockpit)** — `GET /api/dashboard-financeiro` reúne numa só resposta: DRE real do ano, projeção de caixa (12 semanas, com alerta de aperto), posição de AR/AP (aberto/vencido) + capital de giro, ranking de contratos por resultado (top 5 e os no prejuízo) e conciliação pendente. Nova página "Dashboard Financeiro" (KPIs + projeção + posição + top contratos). Reaproveita `_montarDRE`/`montarFluxoProjetado`/`_margemDoContrato`. Isolado por tenant | ✅ Express + front + testes |
| **Exportação financeira (CSV/PDF)** — `GET /api/dre/export.csv` e `GET /api/dashboard-financeiro/export.csv` geram CSV (lib pura `csv_export.js`: separador `;`, BOM p/ acentos, decimais pt-BR, escaping RFC-4180) para a diretoria/contador abrir no Excel; download autenticado no front (fetch+blob) + botão **Imprimir/PDF** (`window.print`). Botões na DRE ("Exportar DRE real") e no Dashboard Financeiro. Isolado por tenant | ✅ lib pura + Express + front + testes |
| **Orçamento anual (budget × realizado)** — `GET /api/orcamento?ano` compara **metas mensais** (receita/custo/despesa) com o **realizado da DRE** por mês, com **desvio** e **% atingido**, mais totais anuais; `POST /api/orcamento` faz upsert das metas por (ano, mês) — tabela `orcamento_metas` com UNIQUE(empresa, ano, mês). Lib pura `orcamento.js`. Nova página "Orçamento Anual" (grade 12 meses + edição de metas). Isolado por tenant | ✅ lib pura + Express + front + testes |
| **Varredura de qualidade #3 (frente financeira)** — revisão adversarial dos parsers/agregadores das PRs #89–#95. Correção real: **injeção de fórmula no CSV (CWE-1236)** — títulos de contrato/labels que começam com `= + - @` eram interpretados como fórmula pelo Excel (título de contrato é dado do usuário → exploit ao abrir o export). `csv_export.js` passa a prefixar apóstrofo nessas células, **sem** afetar números negativos legítimos (`-1234,56`). Também corrige labels da DRE que começam com `=` | ✅ fix + testes de regressão |
| **Estoque first-class (custo médio + reposição)** — reescreve `POST /api/almoxarifado/:id/movimentar` com regras reais: **custo médio ponderado** na entrada e **bloqueio de saída sem lastro** (409 — antes zerava o saldo silenciosamente, perdendo a discrepância); grava a trilha de movimentos por tenant com **saldo resultante**. Novos endpoints: `/:id/movimentos` (histórico), `/reposicao` (itens ≤ mínimo + sugestão de compra) e `/valorizacao` (Σ saldo × custo médio, por categoria). **Bug corrigido**: `quantidade_maxima` default de schema (999) tornava a sugestão de reposição absurda → create/update passam a controlá-la (default 0 → alvo 2×min). Lib pura `estoque.js`. Painel "Estoque real" na página Almoxarifado. Isolado por tenant | ✅ lib pura + Express + front + testes |
| **Elo estoque → suprimentos (RC de reposição)** — `POST /api/almoxarifado/requisicao-reposicao` gera uma **requisição de compra** (tipo Material) a partir dos itens em ponto de reposição, com a quantidade sugerida e o custo médio como estimativa; aceita seleção por `item_ids` e WBS (default `ESTOQUE`). Reaproveita `itensParaRepor` + refatora a criação de RC no helper `inserirRC` (compartilhado com `POST /api/rc`). Botão "Gerar requisição de compra" no painel de reposição. Isolado por tenant | ✅ Express + front + testes |
| **Aprovar RC → gerar Pedido de Compra** — `POST /api/rc/:id/aprovar` (registra aprovador; gate por perfil) e `POST /api/rc/:id/gerar-pedido` transformam a requisição aprovada num **PC ao fornecedor**: itens da RC viram itens do PC, aplicando os **gates de compliance** (homologação + Receita), gerando a **conta a pagar automática** e o motor de anomalias; a RC é marcada **Atendida**. Refatora a criação de PC no helper async `criarPedidoCompra` (compartilhado com `POST /api/pedidos`). Ações `aprovarRequisicao`/`gerarPedidoDaRequisicao` no front. Fecha o caminho requisição→pedido. Isolado por tenant | ✅ Express + front + testes |
| **Portal do Fornecedor · RFQ self-service (MVP)** — o fornecedor cota pelo portal: `GET /api/portal/rfq` (só RFQs onde foi **convidado**, com `pode_responder`/`prazo_expirado`), `GET /api/portal/rfq/:id` (detalhe + **só a própria cotação** — a de concorrente NUNCA sai pelo portal) e `POST /api/portal/rfq/:id/cotacao` (itens→valor, prazo, condição; **trava dura de prazo_resposta** 409; **revisão dentro do prazo substitui** sem duplicar; convite→Respondida; notifica o comprador). Front: seção "Cotações (RFQ)" no portal com formulário de itens. Isolado por convite/fornecedor_id | ✅ Express + front + testes (anti-vazamento) |
| **Portal do Fornecedor · Financeiro read-only + Dashboard** — `GET /api/portal/financeiro` (faturas do fornecedor: pedido, NF, valor, vencimento, status pago/pendente + resumo recebido/a receber/próximo pagamento — **somente leitura**) e `GET /api/portal/dashboard` (cotações a responder, pedidos ativos, NF a enviar, recebíveis 30 dias). Front: 4 cards de dashboard + seção "Meu Financeiro" no portal. Escopo por fornecedor_id (concorrente vê zero) | ✅ Express + front + testes |
| **Portal do Fornecedor · Entregas & OTIF (F2)** — `programacao_entregas` nasce na **emissão do PC** (promessa original); o fornecedor **confirma** o prazo ou **replaneja com justificativa obrigatória** (`POST /api/portal/entregas/:id/confirmar`, comprador avisado com e-mail); o recebimento interno grava `data_entregue`. **OTIF sobre a promessa ORIGINAL** (replanejar não conserta o indicador; `otif_revisado_pct` sai à parte) — lib pura `otif.js`. Card OTIF no dashboard + seção "Minhas Entregas" (confirmar/replanejar). Isolado por fornecedor | ✅ lib pura + Express + front + testes |
| **Portal do Fornecedor · Documentos com validade + segurança (F3)** — `fornecedor_documentos` (**append-only**: reenvio do tipo substitui o **vigente** sem apagar a trilha; empate por id) com situação Válido/**A vencer** (janela 30d)/**Vencido** — lib pura `documentos.js`; `POST /api/portal/documentos` notifica o compliance; visão interna `/api/fornecedores/:id/documentos`; **gate opcional** `PORTAL_BLOQUEIA_DOC_VENCIDO=1` (certidão vencida → cotação 409, renovar desbloqueia). **Histórico de acessos** (`portal_acessos` gravado no login, visível ao fornecedor) e **troca de senha self-service** (exige senha atual + política forte; **derruba as outras sessões**). Front: "Meus Documentos" + "Acessos & senha" | ✅ lib pura + Express + front + testes |
| **Portal do Fornecedor · Qualidade + notificações (F4 — portal completo)** — `notificarFornecedor()` avisa os usuários do portal (in-app + e-mail) nos **3 eventos-chave**: nova RFQ convidada, pedido emitido e **pagamento realizado**; o feed padrão `/api/notificacoes` já entrega ao fornecedor. `GET /api/portal/qualidade`: médias por dimensão (qualidade/prazo/preço/atendimento), avaliações com comentários da contratante (feedback!), **alertas** (nota baixa + documentos vencidos/a vencer) e OTIF. Front: seção "Minha Qualidade" | ✅ Express + front + testes |
| **Varredura de qualidade #5 (portal #100–#104)** — sondas adversariais acharam e corrigiram **3 bugs reais**: (1) **isolamento furado** — tenant B convidava fornecedor do tenant A na RFQ (fornecedor de A via a RFQ de B no portal!) → convite agora valida `empresa_id`; (2) `data_confirmada` aceitava lixo ("not-a-date") corrompendo OTIF/ordenação → regex ISO obrigatório; (3) cotação aceitava **item com preço negativo embutido** (total positivo) distorcendo o mapa comparativo → item ≥ 0 e quantidade > 0 obrigatórios | ✅ fixes + testes de regressão |
| **Portal · Detalhe de pedido + anexos técnicos (G1)** — `GET /api/portal/pedidos/:id` (itens do PC + entrega programada + situação do pagamento, read-only, ownership 404); **anexos técnicos na cotação** (`cotacao_anexos`: datasheet/desenho/certificado; revisão substitui; visíveis ao comprador no mapa). Front: pedido vira link→modal; formulário de cotação com linhas de anexo | ✅ Express + front + testes |
| **Portal · Papéis por usuário + tendência de OTIF (G2 → ~100%)** — **multiusuário do fornecedor**: `usuarios.papel_fornecedor` (comercial/financeiro/logistica; vazio = completo) com `requirePapelPortal` gateando RFQ→comercial, financeiro→financeiro, entregas→logística (áreas comuns livres); 403 com mensagem clara. `GET /api/portal/otif-tendencia` — 6 buckets mensais (competência = data_entregue) via lib pura `tendenciaOTIF` (vira o ano sem `Date`). Front: **gráfico de barras** de OTIF na seção Entregas | ✅ lib pura + Express + front + testes |
| **Varredura de qualidade #6 (portal G1+G2)** — sondas nos papéis/anexos/OTIF/ownership: gates confirmados sólidos (área comum 200, logística-only 403, cap de anexos em 10, sem self-escalation de papel, 404 cross-supplier). **1 achado real de integridade**: entrega **sem data prometida** (pedido com prazo textual "30 dias" → `data_prometida` NULL) contava como **pontual** e inflava o OTIF a 100% — vetor de gaming. Corrigido em `calcularOTIF` **e** `tendenciaOTIF`: sem compromisso de data a entrega é **não-mensurável** (`sem_prazo`, fora do numerador **e** denominador); OTIF só mede o que tem prazo real | ✅ fix na lib pura + testes de regressão |
| **Portal · Storage binário real (G3 → ~100%)** — os anexos/documentos deixam de ser **ponteiro por nome**: `POST /api/portal/arquivos` grava os **bytes de verdade** (BLOB; provider-agnóstico via `STORAGE_MAX_MB`/futuro S3-R2). Lib pura `storage.js` (decode base64 sem prefixo data-URI, **allowlist de extensão** — pdf/office/imagem/engenharia/dados —, cap de 5 MB). Download com isolamento: dono baixa (`/api/portal/arquivos/:id`), comprador do **mesmo tenant** baixa (`/api/arquivos/:id`), concorrente/outro tenant → 404; `nosniff` + Content-Disposition. `arquivo_id` ligado a `cotacao_anexos` e `fornecedor_documentos` (vínculo recusado se o arquivo for de outro fornecedor). Front: upload real (File→base64) no envio de documento + link de download | ✅ lib pura + Express + front + testes (bytes reais) |
| **Varredura de qualidade #7 (storage) — limite de corpo** — **bug de produção** achado na sonda: `express.json()` global sem `limit` = padrão **100 KB**, então o upload de G3 (cap 5 MB) rejeitava **qualquer arquivo real** (>~75 KB) com **413 antes da validação** — quebrado na prática, mas verde nos unit tests (payloads minúsculos). Fix: parser dedicado da rota de upload (`STORAGE_MAX_MB × 2` de folga, para o excedente cair no **400 amigável** e não no 413 cru) montado ANTES do global; global subiu de 100 KB → **1 MB** (também evitava falha silenciosa em snapshots grandes do `/sync`) | ✅ fix + testes de regressão (300 KB passa, 6 MB → 400, rota comum → 413) |
| **Portal · Onboarding self-service (G4 → ~100%)** — o comprador convida o fornecedor por e-mail (`POST /api/fornecedor-convites` — novo por nome/CNPJ ou existente por id; **token de 24 bytes** inadivinhável, validade 7 dias) e o fornecedor **cria o próprio acesso** por um link público: `GET /api/convites/:token` (valida, sem auth) e `POST /:token/aceitar` (cria fornecedor 'Em Análise' + usuário perfil fornecedor, **uso único**, **auto-login**), com rate-limit e senha forte. Front: **tela pública de aceite** que aparece quando a URL traz `?token=` (`portal_convite.js`) e entra direto no portal. Isolado por tenant | ✅ Express + front + testes (fluxo E2E) |
| **Onboarding · UI do comprador (G5)** — página "Onboarding Fornecedor" no menu: botão **"Convidar fornecedor"** (modal e-mail + nome/CNPJ) que gera o convite e mostra o **link copiável** (válido 7 dias); lista de convites com situação (pendente/aceito/expirado). Fecha o G4 no lado do comprador. Escape de HTML | ✅ front + testes |
| **Varredura de qualidade #8 (onboarding G4+G5)** — sondas no convite/aceite: takeover prevenido (aceite ignora e-mail do corpo, usa o do convite), senha forte validada, colisão de e-mail cross-tenant → 409, token inadivinhável/uso único — todos sólidos. **1 achado real de integridade**: o aceite de convite "novo" com **CNPJ já existente** criava fornecedor **DUPLICADO** (furava a dedup do cadastro normal). Fix: se o CNPJ já existe no tenant, o aceite **reaproveita** o fornecedor (vincula o usuário ao existente) | ✅ fix + testes de regressão |
| **Painel Executivo do CEO (visão consolidada)** — `GET /api/painel-executivo?ano` costura numa só tela: **Financeiro** (receita, resultado/margem, capital de giro, caixa projetado com aperto), **Suprimentos** (pedidos ativos, RCs pendentes, valor de estoque + itens a repor, anomalias abertas), **Fornecedores/Entregas** (OTIF do tenant, homologados, cotações/convites pendentes) e uma lista de **riscos priorizados** (alto→baixo: aperto de caixa, contratos no prejuízo, contas vencidas, OTIF < meta, reposição, anomalias). Reaproveita `_montarDashboardFinanceiro`/`calcularOTIF`/`valorizarEstoque`/`itensParaRepor`. Página "Painel Executivo" no menu. Isolado por tenant; gate de perfil | ✅ Express + front + testes |
| **SSMA first-class · isolamento + indicadores TF/TG** — **bug real fechado**: `ssma_ocorrencias` não tinha `empresa_id` e as 4 rotas (GET/POST/PUT/encerrar) **não filtravam por tenant** — vazamento cross-tenant de incidentes; agora escopadas (`empresa_id` + `rowScoped`, legado→empresa 1). Novos campos HSE (com_afastamento, dias_perdidos, colaborador_id). **Indicadores NBR 14280** (`GET /api/ssma/indicadores?ano&hht`): **TF** (acid. c/ afast. × 1M/HHT), **TG** (dias perdidos × 1M/HHT), **dias sem acidente** e quebra por gravidade — lib pura `ssma_indicadores.js`; HHT informado ou proxy das horas do RH. Painel HSE na página SSMA | ✅ fix + lib pura + Express + front + testes |
| **SSMA fase 2 · EPIs por colaborador (NR-6)** — tabela `epi_entregas` (colaborador, EPI, CA, entrega, validade, quantidade) ligada ao RH e isolada por tenant. `POST /api/ssma/epis` valida que o colaborador é do próprio tenant; `GET /api/ssma/epis` traz a **situação** (Válido/A vencer/Vencido/Sem validade) reusando `statusDocumento`; `GET /api/ssma/epis/alertas` lista vencidos (troca imediata) e a vencer (mais crítico primeiro) — lib pura `epi.js`. Painel de EPIs + registro de entrega na página SSMA. EPI vencido em uso é passivo de segurança/legal → validade vira alerta | ✅ lib pura + Express + front + testes |
| **SSMA fase 3 · Treinamentos/matriz NR + bloqueio de risco (NR-1 §1.7)** — tabela `treinamentos_colaborador` (tipo/NR, descrição, realização, validade, CH, instrutor) ligada ao RH e isolada por tenant. Lib pura `treinamentos.js`: classifica situação e marca **bloqueante de risco** (NR-10/35/33/34/18/22/ASO), com `aptidaoColaborador` (apto/**bloqueado** quando há NR de risco vencida) e `alertasTreinamentos` (conta bloqueantes). `POST /api/ssma/treinamentos` (valida colaborador do tenant), `GET /api/ssma/treinamentos` (situação + filtro), `GET /api/ssma/treinamentos/alertas`, `GET /api/ssma/colaboradores/:id/aptidao`. Painel de matriz NR + registro na página SSMA. Habilitação vencida → colaborador não pode exercer atividade de risco | ✅ lib pura + Express + front + testes |
| **SSMA fase 4 · CAT/eSocial S-2210 (Lei 8.213/91)** — fecha o ciclo **incidente → obrigação legal**: tabela `cat_comunicacoes` isolada por tenant. Lib pura `cat.js`: `prazoCAT` (1º dia útil seguinte; óbito=imediato; rola fim de semana), `statusPrazoCAT` (Pendente/Atrasada/Emitida no prazo/com atraso), `validarCAT`, `montarS2210` (evento eSocial evtCAT com ideEvento/ideEmpregador/ideVinculo/infoCAT, CPF/CNPJ só dígitos, tpCat, atestado/CID). `POST /api/ssma/:id/gerar-cat` gera a CAT a partir do incidente com afastamento (pré-preenche, calcula prazo, bloqueia sem afastamento e duplicata), `GET /api/ssma/cat` (lista + status), `GET /api/ssma/cat/:id` (+ payload S-2210), `GET /api/ssma/cat/pendentes/alertas` (acidentes c/ afastamento SEM CAT, atrasados). Painel de CAT + emissão a partir do incidente na página SSMA | ✅ lib pura + Express + front + testes |
| **MM fase 1 · Material master + BOM multinível + gate de engenharia** — módulo Materials Management (inspirado em SAP MM) sobre o Suprimentos existente. Tabela `mm_materiais` (part number único/tenant, sistema/subsistema, make/buy, criticidade, peça pai + qtd/veículo = a BOM) isolada por tenant. Lib pura `mm_bom.js`: `explodirBOM` (multiplica qtd pelo caminho raiz→folha e pelo volume de veículos = base do MRP, protegida contra ciclos), `gateCompra` (**item BUY só compra com engenharia liberada; MAKE não vai a sourcing**), `podeLiberarEngenharia`. `POST/GET/PUT /api/mm/materiais` (dedup PN, valida pai do tenant), `GET /api/mm/materiais/:id/explosao` e `/api/mm/bom/explosao?veiculos=N`, `POST /api/mm/materiais/:id/liberar-engenharia` (exige desenho+revisão), `GET /api/mm/materiais/:id/gate-compra`. Página "MM — Materiais / BOM" (árvore indentada, KPIs, explosão de necessidade, liberação de engenharia) | ✅ lib pura + Express + front + testes |
| **MM fase 2 · Explosão → RFQ automática** — dos itens BUY com engenharia liberada, gera RFQ direto no Sourcing existente (o comprador deixa de digitar item a item). Lib pura `mm_sourcing.js`: `statusSourcing` (MAKE/Bloqueado/A cotar/Em cotação), `itensParaCotar`, `resumoSourcing`, `montarRFQdeMaterial` (título + necessidade explodida). `rfq.mm_material_id` liga a RFQ ao material. `POST /api/mm/materiais/:id/gerar-rfq` (gate 409 se não liberado; qtd = explosão × veículos; convida fornecedor do tenant), `POST /api/mm/bom/gerar-rfqs` (lote: cria dos liberados c/ fornecedor homologado, pula bloqueados/sem fornecedor), `GET /api/mm/sourcing` (status por material). Painel de sourcing na página MM (KPIs + gerar RFQ unitária/lote) | ✅ lib pura + Express + front + testes |
| **MM fase 3 · PPAP (gate de produção) + amostras/APQP** — segundo gate do MM: **sem PPAP aprovado não se produz**. Lib pura `mm_ppap.js`: `avaliarPPAP` (4 pilares: dimensional/material/funcional/documentação), `resolverStatusPPAP` (Aprovado/Condicional-c/PSW/Rejeitado), `gateProducao` (MAKE ok; BUY exige PPAP que libere), `bloqueiosProducao`, `statusQualidade`. Tabelas `mm_amostras` (APQP: solicitada→em teste→aprovada) e `mm_ppap`, isoladas por tenant. `POST /api/mm/materiais/:id/amostra` + `PUT /api/mm/amostras/:id`; `POST /api/mm/materiais/:id/ppap` (bloqueia MAKE), `PUT /api/mm/ppap/:id`, `POST /api/mm/ppap/:id/decidir` (condicional exige PSW), `GET /api/mm/materiais/:id/gate-producao`, `GET /api/mm/producao/bloqueios`. Painel de qualidade na página MM (bloqueios + submeter PPAP) | ✅ lib pura + Express + front + testes |
| **MM fase 4 · MRP (necessidade × saldo → faltantes)** — cruza a BOM explodida (× plano de produção) com o **saldo do almoxarifado** (elo `part_number` ↔ `código`). Lib pura `mm_mrp.js`: `indexarEstoque`, `calcularMRP` → por item: necessidade, disponível, **faltante**, cobertura %, veículos cobertos; resumo com **% de disponibilidade** e **veículos possíveis** (o item BUY mais restritivo é o gargalo do plano). `GET /api/mm/mrp?veiculos=N`. Painel de MRP na página MM (KPIs + tabela de faltantes ordenada por maior falta + alerta de gargalo) | ✅ lib pura + Express + front + testes |
| Testes | ✅ 975/975 (segurança, gate, bridge, crédito, sync genérico, NexusAPI, compras E2E, nav_safety, multi-tenant Express+Worker, hardening, dashboard dados reais, badge tenant real, health/dashboard, gestão de tenants, anomalias em alertas, DRE real, conciliação bancária CSV/OFX, RH/mão de obra na DRE, margem real por contrato, fluxo de caixa projetado, dashboard financeiro consolidado, exportação CSV/PDF, orçamento anual budget×realizado, CSV formula injection, estoque custo médio+reposição, reposição→RC, RC→pedido de compra, **portal RFQ self-service**, SSMA TF/TG + EPIs/NR-6 + matriz NR/aptidão + CAT/S-2210, **MM BOM+engenharia gate + explosão→RFQ + PPAP/gate produção + MRP**, paridade Express⇄Worker) |

O **motor de crédito** é a primeira peça de "inteligência adaptativa": explica
cada fator que compôs a nota (não é caixa-preta), e o resultado é reusável em
RFQ, pedidos e fechamento comercial.

---

## 3. Benchmark de mercado

Comparação honesta com os líderes no contexto de uma operação industrial/serviços
no Brasil. ✅ = forte, 🟡 = parcial, ❌ = ausente.

| Capacidade | SAP S/4 | TOTVS | Sankhya | Senior | **NEXUS (hoje)** | **NEXUS (meta)** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Compras P2P (RC→PC→Recebimento) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aprovação multi-estágio + segregação | ✅ | ✅ | 🟡 | 🟡 | ✅ | ✅ |
| Gate fiscal de pagamento (3-way match) | ✅ | ✅ | 🟡 | 🟡 | ✅ | ✅ |
| Gestão/score de fornecedores (IDF) | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ |
| **Análise de crédito de fornecedor** | ✅ | 🟡 | ❌ | 🟡 | 🟡 *(novo)* | ✅ |
| Conformidade ISO integrada (9001/14001/45001/27001) | 🟡 | 🟡 | ❌ | 🟡 | ❌ | ✅ |
| Inteligência adaptativa / ML embutido | 🟡 | 🟡 | ❌ | 🟡 | 🟡 *(início)* | ✅ |
| Trilha de auditoria imutável | ✅ | ✅ | 🟡 | 🟡 | 🟡 *(audit_log)* | ✅ |
| Custo de implantação / TCO | ❌ (alto) | 🟡 | 🟡 | 🟡 | ✅ (baixo) | ✅ |
| Tempo de adoção | ❌ | 🟡 | 🟡 | 🟡 | ✅ | ✅ |

**Leitura estratégica:** não vencemos os incumbentes em "tudo". Vencemos em
**TCO + velocidade de adoção + inteligência prática e explicável**, e em
**conformidade nativa** (a maioria trata ISO como módulo caro à parte). Esse é o
posicionamento a perseguir.

---

## 4. Gaps priorizados

### P0 — Confiança (concluído)
- ✅ Auth segura, gate de pagamento, backend único, religação do dinheiro.

### P1 — Funcionalidade real por módulo (em andamento)
- ✅ **Fornecedores**: cadastro + validação + financeiro + crédito.
- ✅ **Almoxarifado conectado** (programa "fazer funcionar"): as telas de
  materiais, movimentos de estoque, empréstimos e inventários **deixam de ser
  endpoints fantasma** — `/api/materiais`, `/api/movimentos-estoque`,
  `/api/emprestimos`, `/api/inventarios` passam a existir e **persistir** o
  objeto enviado pelo front (CRUD completo). **Paridade Express + Worker**
  (TABLES/CRUD genérico). Coberto por testes.
- ✅ **Controle de Custos — rollup estimado × realizado** (`GET /api/wbs/rollup`):
  consolida as linhas WBS por contrato (estimado, realizado, desvio, % executado)
  e mostra a seção "Custos por contrato (servidor)" na tela de Controle de
  Custos. Fecha visualmente o ciclo conectado na OS. Lib pura `lib/wbs_rollup.js`;
  **paridade Express + Worker**. Coberto por testes.
- ✅ **OS completa — conclusão lança custo na WBS**: `POST /api/os/:id/concluir`
  conclui a OS e **acumula o custo realizado na linha WBS** (`custo_real`),
  permitindo o comparativo **estimado × realizado** por linha. Ação "Concluir
  (lançar custo)" no detalhe da OS; o id de backend é capturado ao salvar.
  **Paridade Express + Worker**. Coberto por testes.
- ✅ **OS ↔ WBS do backend (A2.1)**: o seletor de WBS da OS agora **lê de**
  `/api/wbs?contrato_id=`** (entidade real), permite **criar linha WBS no
  contrato** ali mesmo, e a OS é **persistida no `/api/os`** (dual-write) —
  disparando a validação A2 (WBS de outro contrato → 409). Resolve a desconexão
  "custos da OS só no localStorage". *(Diagnóstico geral: o front é
  localStorage-first e várias telas chamam endpoints inexistentes; conectar
  módulo a módulo ao backend é o programa em curso — OS é o primeiro.)*
- ✅ **Orçamentação → Proposta** (Épico C, Fatia C2 — fecha CRM↔Custos↔Proposta):
  o comercial só cria a proposta (`POST /api/propostas`) quando o lead tem
  **estimativa de custos (WBS) vinculada** — senão bloqueia (409). O valor sai
  do **custo estimado × margem**; criar a proposta marca a orçamentação do lead
  como **concluída**. `GET /api/propostas?lead_id=`. **Paridade Express +
  Worker** (helper puro `podeGerarProposta`). Coberto por testes.
- ✅ **CRM → Orçamentação** (Épico C, Fatia C1): quando a oportunidade passa para
  **Qualificação** (ou além, até Negociação), a orçamentação é marcada
  **pendente** e o **orçamentista é alertado** (notificação + e-mail). Endpoint
  `GET /api/crm/orcamentacao?status=` lista os leads a precificar; criar uma WBS
  vinculada ao lead (`lead_id`, origem `orcamentacao`) marca a estimativa
  **em andamento**. Banner no Controle de Custos com a ação "Criar estimativa".
  **Paridade Express + Worker** (helper puro `precisaOrcamentacao`). Coberto por testes.
- ✅ **Fluxo de serviço + aceite do requisitante** (Épico B, Fatia B2): pedido de
  serviço não entra no almoxarifado — o requisitante atesta a prestação com
  **checklist técnico** (`POST /api/pedidos/:id/aceite-servico`, só aceita com
  todos os itens conformes). O **gate de pagamento exige o aceite** para
  serviços (em vez do recebimento físico/3-way) — sem aceite, bloqueia.
  `GET /api/aceites-servico`. Modal de aceite no front. **Paridade Express +
  Worker** (helper puro `exigeAceiteServico`). Coberto por testes.
- ✅ **Visibilidade do Contas a Pagar pós-recebimento** (Épico B, Fatia B1): a
  conta a pagar nasce na emissão do PC; ao registrar o recebimento, a **NF é
  anexada à conta** (gate enxerga a nota) e a conta é **devolvida na resposta**.
  Filtro `GET /api/contas-pagar?pc_id=`; o **detalhe do pedido** lista as contas
  geradas. Front: toast com a conta vinculada após o recebimento. **Paridade
  Express + Worker**. Coberto por testes.
- ✅ **WBS como entidade no backend** (Épico A, Fatia A1 — fundação): tabela
  `wbs_linhas` com vínculo a `contrato_id`/`projeto_id`/`centro_custo`/`lead_id`,
  CRUD (`/api/wbs`), cálculo de total e exclusão lógica. Validador puro
  `wbsPertenceAoContrato`. **Paridade Express + Worker**. Coberto por testes.
- ✅ **OS amarrada a Contrato/Overhead + WBS coerente** (Épico A, Fatia A2): a OS
  exige **Contrato** OU **centro de custo de overhead** (lista fixa,
  `/api/overhead-centros`); a linha WBS referenciada (`wbs_linha_id`) precisa
  **pertencer ao contrato** da OS (409 se de outro contrato — fim da alocação
  errada); tipo de recurso inclui **"Mão de Obra"** (`material|servico|locacao|
  mao_obra`). Front com a opção "Somente Mão de Obra". **Paridade Express +
  Worker**. Coberto por testes.
- ✅ **Notificações (in-app + e-mail)** (Onda 2): store de notificações com alvo
  por usuário, perfil ou global; sino no topbar com contador de não-lidas;
  página de notificações (marcar lida / todas). Adaptador de e-mail
  `lib/email.js` (provedor por `EMAIL_PROVIDER`, mock). Disparos em eventos
  reais: novo fornecedor → Financeiro + Compliance (homologação); alteração
  bancária pendente → Financeiro. **Paridade Express + Worker** (adaptador de
  e-mail + escopo `notificacaoNoEscopo`). Coberto por testes.
- ✅ **Emissão fiscal NF-e/NFS-e/CT-e** (Onda 2): adaptador server-side
  `lib/nfe.js` (provedor por `NFE_PROVIDER`, mock determinístico; Focus NF-e/
  eNotas/NFe.io plugáveis). Endpoints `/api/nfe/emitir`, `/api/nfe`,
  `/api/nfe/:id/cancelar` — validação de campos, chave de acesso de 44 dígitos,
  DANFE e **cancelamento com justificativa mínima de 15 caracteres (regra
  SEFAZ)**. Página "Documentos Fiscais" (emitir/listar/cancelar). Persistência
  em `notas_fiscais`. **Paridade Express + Worker** (emissão idêntica, provada
  por teste).
- ✅ **IDF — Índice de Desempenho do Fornecedor** (`GET /api/fornecedores/:id/idf`):
  consolida sinais reais — **OTD** (entregas no prazo, de `pedidos_compra`) +
  **avaliações** — num score 0–100 e classificação A/B/C/D. Exibido no detalhe
  do fornecedor (junto da homologação) e incluído no payload do cadastro. Lib
  pura `lib/idf.js`; **paridade Express + Worker** (índice idêntico, provado por teste).
- ✅ **Análise financeira prévia** (`POST /api/analise-financeira`): combina
  bureau de crédito (dados de mercado) + situação cadastral (Receita) num parecer
  automático — score consolidado (0–100), nível de risco e recomendação
  (Aprovar / Aprovar com ressalvas / Recusar), com os fatores que pesaram.
  Situação irregular força Recusar. Botão "Análise financeira" no cadastro
  (apoio à homologação). Lib pura `lib/analise_financeira.js`; **paridade
  Express + Worker** (parecer idêntico, provado por teste).
- ✅ **Gate de homologação de fornecedor** (Financeiro + Compliance): fornecedor
  novo nasce "Em Homologação" e **só pode ser usado em PC após aprovação das
  duas funções** (`/homologar/financeiro` + `/homologar/compliance`,
  `/reprovar-homologacao`). Emissão de PC bloqueada (409) para não homologado
  (default-deny). Painel de homologação no detalhe do fornecedor (botões por
  perfil). **Paridade Express + Worker** (helper puro `fornecedorHomologado`).
  Coberto por testes.
- ✅ **Cadastro por CNPJ (autofill estilo Omie)** — FIX: a aba de cadastro
  dependia de APIs públicas direto do browser (falhavam por CORS). Agora há o
  proxy server-side `GET /api/cnpj/:cnpj` (adaptador `lib/receita.js` ampliado:
  razão, fantasia, endereço, situação, porte, CNAE, abertura, capital — provedor
  por env, mock determinístico). O formulário preenche automaticamente.
  **Paridade Express + Worker** (cadastro idêntico por CNPJ, provado por teste).
- ✅ **Fluxo de caixa planejado × realizado** (Onda 2): `GET /api/fluxo-caixa`
  compara, por semana e por contrato, o planejado (vencimentos) contra o
  realizado (pagamentos), com desvios. Lib pura `lib/fluxo_caixa.js`; bloco no
  Dashboard BI (tabela semanal + maiores desvios por contrato). **Paridade
  Express + Worker** (saída idêntica, provada por teste). Coberto por testes.
- ✅ **Dupla aprovação de dados bancários** (Onda 2): alteração de
  banco/agência/conta de fornecedor (interna ou via portal) não vale na hora —
  fica **pendente** até a aprovação de uma 2ª pessoa
  (`POST /api/fornecedores/:id/aprovar-banco` | `rejeitar-banco`, perfil
  admin/diretor/financeiro, **solicitante ≠ aprovador**). Fecha o risco de
  desvio de pagamento. **Paridade Express + Worker** (helper puro
  `alteracaoBancariaSolicitada`). Coberto por testes.
- ✅ **Detecção de duplicatas** (Onda 2): prevenção de CNPJ duplicado no cadastro
  de fornecedor (409, compara só dígitos) + relatório `GET /api/duplicatas`
  (fornecedores por CNPJ e NFs repetidas em contas a pagar). **Paridade Express
  + Worker** (helper puro `detectarDuplicatas`). Coberto por testes.
- ✅ **Validação de situação cadastral (Receita/SEFAZ)** (Onda 2): adaptador
  server-side `lib/receita.js` (provedor selecionável por `RECEITA_PROVIDER`,
  mock determinístico por padrão). Endpoint `/api/receita/consultar` (Express +
  Worker) e botão "Situação cadastral" no cadastro. **Gate**: a emissão de PC é
  bloqueada (409) para fornecedor com CNPJ irregular (INAPTA/SUSPENSA/BAIXADA/
  NULA). Paridade Express + Worker (mesma distribuição por CNPJ). Coberto por testes.
- ✅ **Alçada de pagamento >R$50k** (Onda 1 — conclui a onda): o gate de pagamento
  bloqueia contas acima do limiar sem aprovação prévia de Diretor
  (`POST /api/contas-pagar/:id/aprovar-alcada`, perfil diretor/admin — distinto
  do pagador financeiro/admin, segregação de funções). Limiar por env
  (`ALCADA_PAGAMENTO_VALOR`). **Paridade Express + Worker** (helper puro
  `alcadaPendente`). Coberto por testes.
- ✅ **SSMA: RCA obrigatório para encerrar** (Onda 1): `POST /api/ssma/:id/encerrar`
  bloqueia o encerramento de incidente sem causa raiz **e** plano de ação
  (reduz reincidência — gargalo dos 5 incidentes sem RCA). `PUT` permite
  preencher a RCA antes; trilha registra o encerramento. **Paridade Express +
  Worker** (helper puro `rcaCompleto`). Coberto por testes.
- ✅ **Concorrência mínima** (Onda 1): a criação do mapa comparativo bloqueia
  compras acima de R$ 10.000 com menos de 3 cotações; exceção apenas com
  justificativa **e** perfil Diretor/admin, registrada na trilha de auditoria
  (`concorrencia_excecao`). Limiares por env. **Paridade Express + Worker**
  (helper puro `avaliarConcorrencia`). Coberto por testes.
- ✅ **RC: `tipo` + `WBS` obrigatórios** (Onda 1 do plano de verificação): a
  requisição exige classificação de gasto (Material/Serviço/Equipamento,
  tolerando acento/caixa → canônico) e vínculo WBS, fechando o gargalo de
  rastreabilidade custo→contrato→projeto. Bloqueio no `POST`/`PUT` (não permite
  remover WBS nem gravar tipo inválido). **Paridade Express + Worker** +
  campos no formulário do front. Coberto por testes (RC compliance + `normalizarTipoRC`).
- ✅ **OS: `WBS` obrigatória** (Onda 1): a ordem de serviço — origem da demanda —
  também exige vínculo WBS, completando a rastreabilidade de custo na ponta.
  Bloqueio no `POST`/`PUT` (não remove WBS). **Paridade Express + Worker**; o
  front já tinha o bloqueio de WBS, agora com campo canônico `wbs` no sync.
  Coberto por testes (OS compliance).
- ✅ **Alertas de vencimento de contrato 90/60/30** (Onda 1): contratos Ativos
  com `data_fim` próxima entram na Central de Alertas com severidade crescente
  (≤90d baixa, ≤60d média, ≤30d/vencido alta), também refletidos no Dashboard BI.
  **Paridade Express + Worker** (helper puro `classificarVencimentoContrato`).
  Coberto por testes.
- ✅ **Dashboard BI** (`GET /api/bi`): KPIs gerenciais consolidados — exposição
  financeira (a pagar / vencido / a vencer / pago), governança do gate (taxa de
  bloqueio via trilha de logs), homologação e score de fornecedores, taxa de
  entrega de pedidos e alertas por severidade. Dados 100% server-side; fornecedor
  barrado. Página com cartões + barras de progresso. **Paridade Express + Worker**:
  o Worker (nexus-cf) replica `/api/bi` sobre o modelo documento (gate via
  `audit_log`), com a montagem extraída em função pura (`montarKPIsWorker`)
  coberta por testes unitários.
- ✅ **Central de Alertas** (`GET /api/alertas`): feed único e priorizado por
  severidade reunindo contas vencidas/a vencer (janela configurável), entregas
  atrasadas (prazo do pedido estourado) e retenção LGPD pendente. Dados 100%
  server-side; alerta sensível de LGPD só para admin; fornecedor (portal) é
  barrado. Página com resumo + lista colorida por severidade. **Paridade
  Express + Worker**: o Worker (nexus-cf) replica `/api/alertas` sobre o modelo
  documento, com a montagem extraída em função pura (`montarAlertasWorker`)
  coberta por testes unitários.
- ✅ **Portal do Fornecedor** (self-service, escopo restrito): usuário com perfil
  `fornecedor` vinculado a um `fornecedor_id`. Rotas `/api/portal/*` (pedidos,
  enviar NF, perfil) sempre filtradas pelo vínculo — um fornecedor nunca vê
  dados de outro (ownership enforced + testes). **Paridade Express + Worker**:
  o Worker (nexus-cf) carrega `fornecedor_id` no JWT, provisiona usuário-fornecedor
  via `POST /api/usuarios` e replica as rotas de portal com a mesma regra de
  isolamento (`portalScope`/`pedidoPertence`), coberta por testes unitários.
- ✅ **Fornecedores+ / credit bureau**: adaptador server-side `lib/credit_bureau.js`
  com provedor selecionável por env (mock determinístico por padrão, Serasa/SPC
  plugáveis com credencial). Endpoint `/api/credito/consultar` (Express + Worker)
  e botão "Consultar bureau" no cadastro, realimentando a análise de crédito
  (situação, pendências/protestos, faturamento estimado).
- ✅ **Numeração atômica no servidor** — endpoint `POST /api/sequencia/:tipo`
  (Express + Worker/D1) com UPSERT+RETURNING; **PC, RC e RFQ** usam, com
  fallback offline. Testado com 100 chamadas concorrentes → 100 números únicos.
  (MAPA herda o número do RFQ/RC.)
- ✅ **3-way match por item** (`js/lib/three_way.js`): confere a nota contra o
  pedido e o recebimento item a item (qtd e preço, com tolerância). Integrado
  ao gate de pagamento no Worker e no Express (rota `/pagar` com gate completo,
  que antes só existia no Worker). Bloqueios respondem 409 e vão à auditoria.
- ✅ **Recebimento por item** (Express: tabelas `recebimentos`/`recebimento_itens`
  + endpoints + modal com quantidades): o gate **puxa automaticamente** o
  recebido acumulado do pedido e o usa no 3-way (sem precisar informar no
  pagamento). "Não paga o que não chegou" passa a ser automático.
  **Paridade no Worker**: o gate agrega os docs de recebimento por `pc_id`
  (`json_extract`) e alimenta o 3-way igualmente — validado em SQLite real.
- ⬜ **Almoxarifado**: movimentação atômica de estoque no servidor.

### P2 — Inteligência adaptativa
- ✅ **Crédito de fornecedor** (entregue, base para o resto).
- ✅ **Detecção de anomalias** em pedidos (`js/lib/anomalias.js`): fracionamento
  para furar alçada, valor fora da curva, fornecedor novo + valor alto, crédito
  ruim + valor alto (integra o motor de crédito) e duplicidade. Ligado à criação
  de pedido: risco alto pede confirmação e fica no log de auditoria.
- ⬜ **Sugestão de aprovação** (recomenda aprovar/revisar com base em histórico).
- ⬜ **Previsão de prazo de entrega** por fornecedor/categoria.
- ✅ **Recomendação de fornecedor** em RFQ (`js/lib/recomendador.js`): ranking
  multicritério custo × IDF × crédito × prazo, explicável, ligado ao mapa de
  cotações (botão "Aplicar recomendação"). Pesos configuráveis.

### P3 — Conformidade e governança
- ✅ **Auditoria ISO integrada** (esqueleto): `js/lib/iso.js` + página `iso`.
  Evidências derivadas automaticamente de IDF/SSMA/RBAC/logs/documentos,
  cobertura por norma (9001/14001/45001/27001), lacunas e CAPA. Ver §6.
- ✅ **Trilha de auditoria imutável** (`js/lib/auditoria.js`): hash SHA-256
  encadeado no Express (`logs_sistema`) e no Worker (`audit_log`), com endpoint
  `GET /api/auditoria/verificar` e botão na página ISO. Detecta adulteração,
  remoção e reordenação. Express e Worker geram hashes idênticos.
- ✅ **CAPA com workflow + ISO 14001** (`js/lib/capa.js` + página ISO): ciclo
  Aberta → Em Ação → Verificação → Fechada, detecção de atraso por prazo e KPIs
  (% no prazo). Aspectos/impactos ambientais (14001 §6.1) registráveis e
  contados como evidência. CAPA e aspectos realimentam a cobertura ISO.
- ✅ **LGPD** (`js/lib/lgpd.js` + página `lgpd`): RoPA com base legal (art. 7) e
  retenção, solicitações do titular (DSAR) e **anonimização irreversível** de
  dados pessoais de fornecedor (endpoint admin no Express e no Worker, com
  trilha de auditoria). Direito de eliminação operacional.
- ✅ **Retenção automatizada**: preview (dry-run) + execução por política
  (`RETENCAO_FORNECEDOR_MESES`, padrão 60m) — anonimiza fornecedores inativos
  além do período de guarda, no Express e no Worker. UI com lista antes de
  expurgar.

---

## 5. Inteligência adaptativa — arquitetura

Princípio: **inteligência explicável e barata primeiro** (heurísticas
transparentes que o usuário entende e confia), evoluindo para ML quando houver
volume de dados. Nada de caixa-preta no caminho do dinheiro.

```
            dados do ERP (D1)                  motores (js/lib + Worker)
  ┌─────────────────────────────┐       ┌──────────────────────────────────┐
  │ fornecedores, pedidos,       │  ──▶  │ credito.js      (entregue)        │
  │ contas, avaliações IDF,      │       │ anomalias.js    (P2)              │
  │ recebimentos, audit_log      │       │ recomendador.js (P2)              │
  └─────────────────────────────┘       │ previsao_prazo.js (P2)            │
                                         └──────────────────────────────────┘
                                                   │  score + fatores
                                                   ▼
                                      UI explica "por quê" + sugere ação
```

Cada motor é uma **função pura testável** (como `credito.js`), reutilizável no
browser e no Worker, sempre devolvendo `{score, classificação, fatores[]}`.

---

## 6. Auditoria ISO integrada — design

Em vez de um "módulo de qualidade" isolado, a conformidade é **transversal**: cada
processo já existente emite evidências para as normas.

| Norma | O que o ERP já gera | O que falta |
|---|---|---|
| **ISO 9001** (Qualidade) | IDF, avaliações de fornecedor, não-conformidades | Plano de ação (CAPA), ciclo PDCA |
| **ISO 14001** (Ambiental) | SSMA, licenças/contratos | Aspectos/impactos, metas ambientais |
| **ISO 45001** (SST) | SSMA, incidentes | Investigação de incidente, EPIs por função |
| **ISO 27001** (Infosec) | auth, audit_log, RBAC | Política, gestão de acessos, trilha imutável |

**Modelo de dados proposto** (documento no Worker, sem migration destrutiva):
- `iso_requisitos` — cláusulas das normas (catálogo).
- `iso_evidencias` — liga uma cláusula a um registro real do ERP
  (ex.: avaliação IDF → 9001 §8.4 "controle de fornecedores").
- `iso_nao_conformidades` / `iso_acoes` — CAPA com prazo e responsável.

**Painel de auditoria**: % de cláusulas com evidência, NCs abertas por norma,
ações vencidas — alimentado automaticamente pelos módulos existentes.

---

## 7. Como rodar e visualizar (Genspark / local)

```bash
# Na raiz do repositório
npm install      # instala deps (postinstall cuida do nexus-erp)
npm start        # sobe o sistema em http://localhost:3002
```
Login inicial: `admin@fraseralexander.com.br` / senha do `SEED_PASSWORD`
(padrão de dev: `Fraser@2025`). No Genspark, aponte o Run/Preview para
`npm start` na raiz (porta 3002, bind `0.0.0.0`).

Para produção (gate de pagamento blindado), publique o Worker:
`cd nexus-cf && ./setup.sh` e siga `nexus-cf/VERIFICACAO.md`.

---

## 8. Próximas decisões recomendadas (ordem prática)

1. **Numeração atômica** + **3-way por item** — fecham o caminho do dinheiro de vez.
2. **Anomalias.js** — primeiro motor de risco operacional (alto valor, baixo custo).
3. **Esqueleto ISO** (catálogo + evidências) ligado ao IDF e ao SSMA.
4. **Integração credit bureau** real no cadastro de fornecedor.

Cada item é uma fatia independente, testável e entregável sem quebrar o que já
funciona — exatamente como esta fase foi conduzida.
