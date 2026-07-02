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
| Testes | ✅ 457/457 (segurança, gate, bridge, crédito, sync genérico, NexusAPI, compras E2E, nav_safety, multi-tenant Express+Worker, hardening, dashboard dados reais, badge tenant real, **health/dashboard**, paridade Express⇄Worker) |

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
