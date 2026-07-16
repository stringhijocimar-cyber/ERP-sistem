# Plano Robusto de Verificação e Implementação — NEXUS ERP

> **Base deste plano:** auditoria direta do código-fonte (`nexus-erp/` = backend Express
> testado; `nexus-cf/` = Worker Cloudflare/D1 em paridade) realizada em 2026-06-18.
> Nada aqui é presumido: cada "Feito" foi conferido contra o código e a suíte de testes
> (26 arquivos, 134 testes verdes). Onde a alegação não tem lastro no código, está
> marcado como **AUSENTE (marcado como feito, não implementado)**.

## Legenda de status (rigorosa)

| Selo | Significado |
|------|-------------|
| ✅ **Validado** | Código presente **e** coberto por teste automatizado nesta base. |
| 🟡 **Implementado, não validado** | Código presente, **sem** teste — requer validação funcional. |
| 🟥 **AUSENTE** | Marcado como feito na documentação/briefing, **mas não existe no código**. |
| ⬜ **Planejado** | Nunca existiu; é backlog declarado. |

---

## A. Sumário executivo

**Situação atual.** O núcleo *transacional e de compliance financeiro* do ERP é real e
testado: o **gate de pagamento** (exige NF + contrato + conciliação 3-way por item),
**numeração atômica** sem corrida (PC/RC/RFQ), **recebimento auto-feed** no 3-way,
**trilha de auditoria imutável** (hash encadeado), **bureau de crédito**, **LGPD**
(anonimização + retenção), **Portal do Fornecedor** com isolamento de acesso, **Central
de Alertas** e **Dashboard BI**. Há paridade Express + Worker nas últimas frentes.

**O alerta principal.** Boa parte das ações de compliance de **Compras** e **Contratos**
listadas como "já implementadas" **não está no código**: a RC não tem `tipo`
(Material/Serviço/Equipamento) nem `wbs`; não há bloqueio de "<3 fornecedores acima de
R$10.000"; não há fluxo de compra emergencial; não há alertas de vencimento de contrato
(90/60/30); não há alçada financeira por valor (R$50k). Esses itens precisam ser
**reclassificados de "Feito" para backlog** — é o maior risco de governança hoje:
acreditar que um controle existe quando ele não existe.

**Top 10 prioridades (por risco × esforço):**

| # | Ação | Módulo | Criticidade | Esforço | Onda |
|---|------|--------|-------------|---------|------|
| 1 | `tipo` obrigatório na RC (Material/Serviço/Equipamento) | Compras | Alta | Baixo | 1 |
| 2 | Vínculo **WBS** obrigatório em RC e OS (rastreabilidade custo) | Compras/Projetos | Crítica | Baixo | 1 |
| 3 | Bloqueio **<3 cotações** acima de R$10.000 (exceção c/ justificativa+Diretor) | Compras | Alta | Baixo | 1 |
| 4 | **RCA obrigatório** para encerrar incidente SSMA | SSMA | Alta | Baixo | 1 |
| 5 | **Alçada financeira** por valor (R$50k → Diretor Financeiro) | Financeiro | Alta | Baixo | 1 |
| 6 | Alertas de **vencimento de contrato** 90/60/30 na Central de Alertas | Contratos | Alta | Baixo | 1 |
| 7 | Validação **CNPJ/situação cadastral** (Receita/SEFAZ) antes da PO | Compras/Qualidade | Alta | Médio | 2 |
| 8 | **Emissão NF-e/NFS-e/CT-e** (Focus NF-e/eNotas) — *quick win* | Fiscal | Alta | Médio | 2 |
| 9 | **Conciliação bancária** CNAB 240/OFX + PIX/Open Finance | Financeiro | Alta | Alto | 3 |
| 10 | **Offline-first** robusto (Service Worker + IndexedDB + sync) para campo | Tecnologia | Crítica (campo) | Alto | 3 |

**Riscos de não implementar:** compra sem concorrência mínima (fraude/sobrepreço),
pagamento indevido, fornecedor irregular, perda de rastreabilidade custo-projeto,
contrato vencido sem aviso, incidente sem causa raiz (reincidência), e — o mais grave —
**falsa sensação de controle** sobre itens "Feito" que não existem.

---

## B. Matriz consolidada de verificação

> Status conferido no código. "Teste obrigatório" = o que provar dentro do ERP.

| Módulo | Funcionalidade | Status | Crit. | Esforço | Prazo | Risco mitigado | Teste obrigatório | Evidência | KPI | Responsável |
|--------|----------------|--------|-------|---------|-------|----------------|-------------------|-----------|-----|-------------|
| Financeiro | Gate de pagamento (NF+contrato+3-way) | ✅ Validado | Crítica | — | feito | Pagamento indevido | Pagar conta sem NF → bloqueio 409 | Log `payment_blocked` + ID | % pagamentos com gate | TI/Financeiro |
| Compras | Numeração atômica PC/RC/RFQ | ✅ Validado | Alta | — | feito | Duplicidade de número | 100 chamadas concorrentes | Sequência única | nº colisões=0 | TI |
| Compras | 3-way match por item | ✅ Validado | Alta | — | feito | Pagto divergente | NF≠pedido → bloqueio | Divergências no log | % NF conciliada | Financeiro |
| Auditoria | Trilha imutável (hash chain) | ✅ Validado | Alta | — | feito | Adulteração de log | Quebrar hash → detecção | Cadeia de hash | Integridade=100% | Auditoria |
| Fornecedores | Bureau de crédito | ✅ Validado | Média | — | feito | Fornecedor inadimplente | Consultar CNPJ | Resposta do provedor | % consultados | Compras |
| LGPD | Anonimização + retenção | ✅ Validado | Alta | — | feito | Exposição de dado pessoal | Executar retenção | Registro anonimizado | % vencidos tratados | DPO/Auditoria |
| Fornecedores | Portal self-service (isolamento) | ✅ Validado | Média | — | feito | Vazamento entre fornecedores | Acessar pedido de outro → 403 | 403 + log | — | TI |
| Gestão | Central de Alertas | ✅ Validado | Média | — | feito | Pendência despercebida | `GET /api/alertas` | JSON consolidado | nº alertas/sev. | Operações |
| Gestão | Dashboard BI | ✅ Validado | Média | — | feito | Decisão sem dado | `GET /api/bi` | KPIs consolidados | — | Diretoria |
| Compras | Cotações/Mapa comparativo (CRUD) | 🟡 Não validado | Alta | Baixo | — | Compra sem mapa | Emitir PC sem mapa aprovado | Bloqueio | % PC c/ mapa | Compras |
| Contratos | CRUD + responsável | 🟡 Não validado | Média | Baixo | — | Contrato sem dono | Criar contrato sem responsável | Campo obrigatório | % c/ gestor | Contratos |
| SSMA | Registro de ocorrências (tabela) | 🟡 Não validado | Alta | Médio | — | Incidente não tratado | Registrar ocorrência | Registro | nº ocorrências | SSMA |
| Almoxarifado | Estoque básico + estoque baixo | 🟡 Não validado | Média | Médio | — | Ruptura | Mov. abaixo do mínimo | Alerta estoque | % ruptura | Suprimentos |
| **Compras** | **`tipo` obrigatório na RC** | ✅ **Validado** | Alta | Baixo | feito | Classificação de gasto | RC sem tipo → 400 | Teste `rc_compliance` | % RC c/ tipo | Compras |
| **Compras** | **Vínculo WBS na RC** | ✅ **Validado** | Crítica | Baixo | feito | Rastreabilidade custo | RC sem WBS → 400 | Teste `rc_compliance` | % vinculadas | Projetos |
| **Compras** | **Vínculo WBS em OS** | ✅ **Validado** | Crítica | Baixo | feito | Rastreabilidade custo | OS sem WBS → 400 | Teste `os_compliance` | % vinculadas | Projetos |
| **Compras** | **Bloqueio <3 cotações >R$10k** | ✅ **Validado** | Alta | Baixo | feito | Compra sem concorrência | Mapa 2 cotações >10k → 409 | Teste `concorrencia` | % c/ 3+ | Compras |
| **Compras** | **Compra emergencial c/ aprovação Diretor** | 🟥 **AUSENTE** | Alta | Baixo | Onda 1 | Abuso de exceção | Emergencial sem Diretor → bloqueio | (a criar) | % emergenciais | Diretoria |
| **Compras** | **Alerta RFQ aberta >15/30 dias** | 🟥 **AUSENTE** | Média | Baixo | Onda 1 | RFQ parada | RFQ antiga aparece em alertas | (a criar) | tempo médio RFQ | Compras |
| **Contratos** | **Alertas vencimento 90/60/30** | ✅ **Validado** | Alta | Baixo | feito | Contrato vencido | Contrato a vencer → alerta | Teste `alertas_contrato` | % avisados | Contratos |
| **Contratos** | **Checklist de aceite** | 🟥 **AUSENTE** | Média | Médio | Onda 2 | Aceite incompleto | Aceitar sem itens → bloqueio | (a criar) | % checklist | Contratos |
| **Contratos** | **Controle de seguro vigente** | 🟥 **AUSENTE** | Média | Médio | Onda 2 | Risco sem cobertura | Contrato sem seguro → alerta | (a criar) | % c/ seguro | Contratos |
| **Financeiro** | **Alçada por valor (R$50k→Diretor)** | ✅ **Validado** | Alta | Baixo | feito | Pagto alto sem aprovação | Pagar >50k sem Diretor → 409 | Teste `alcada` | % >50k aprovados | Financeiro |
| **Financeiro** | **AP vencido c/ justificativa** | 🟥 **AUSENTE** | Média | Baixo | Onda 1 | Inadimplência oculta | Reabrir AP vencido exige justificativa | (a criar) | % AP>30d | Financeiro |
| **Qualidade** | **Validação CNPJ Receita/SEFAZ** | ✅ **Validado** | Alta | Médio | feito | Fornecedor irregular | PC p/ CNPJ irregular → 409 | Teste `receita` | % irregulares | Qualidade |
| **Qualidade** | **Detecção de duplicatas** | ✅ **Validado** | Média | Médio | feito | Cadastro duplicado | Duplicar CNPJ → 409 + `/api/duplicatas` | Teste `duplicatas` | nº duplicatas | Qualidade |
| **Qualidade** | **Dupla aprovação dados bancários** | ✅ **Validado** | Alta | Médio | feito | Desvio de pagamento | Alterar conta exige 2 aprovações | Teste `banco_dupla_aprovacao` | % alterações 2N | Financeiro/SI |
| **SSMA** | **RCA obrigatório p/ encerrar incidente** | ✅ **Validado** | Alta | Baixo | feito | Reincidência | Encerrar sem RCA → 400 | Teste `ssma_rca` | % c/ RCA | SSMA |
| **SSMA** | **Alertas treinamento/doc vencido (ASO/NRs)** | 🟥 **AUSENTE** | Alta | Médio | Onda 2 | Não conformidade legal | Doc vencido → alerta | (a criar) | % vencidos | SSMA |
| **WMS** | **Endereçamento + FEFO/FIFO + lote** | 🟥 **AUSENTE** | Média | Alto | Onda 3 | Perda/validade | Saída FEFO | (a criar) | % FEFO | Suprimentos |
| **Fiscal** | **NF-e/NFS-e/CT-e** | ✅ **Validado** | Alta | Médio | feito | Bloqueio fiscal | Emitir → autorizada; cancelar exige 15+ | Teste `nfe` | % emitidas no ERP | Fiscal |
| **Financeiro** | **CNAB/OFX/PIX/Open Finance** | ⬜ Planejado | Alta | Alto | Onda 3 | Erro manual/conciliação | Importar OFX e conciliar | (a criar) | % conciliação auto | Financeiro |
| **Fiscal/Contábil** | **Contabilidade + SPED** | ⬜ Planejado | Crítica | Muito alto | Onda 4 | Não substitui externos | Gerar SPED válido | (a criar) | % SPED aceito | Contabilidade |
| **RH** | **Folha + eSocial (S-2200/2210/2245)** | ⬜ Planejado | Crítica | Muito alto | Onda 4 | Multa trabalhista | Evento eSocial homolog. | (a criar) | % eventos ok | RH |
| **Tecnologia** | **Offline-first (PWA avançado)** | ⬜ Planejado | Crítica (campo) | Alto | Onda 3 | Perda dado em campo | Apontar offline e sincronizar | (a criar) | % sync ok | TI |
| **Plataforma** | **Marketplace de extensões / API pública** | ⬜ Planejado | Estratégica | Muito alto | Onda 4 | Escalabilidade | — | — | nº ISVs | Produto |
| **Manufatura** | **MRP/PP** | ⬜ Fora de escopo | Baixa | Muito alto | — | — | Integração externa se houver demanda | — | — | Produto |

---

## C. Plano de verificação funcional dentro do ERP

> Roteiros prontos. Onde o status é 🟥/⬜, o **resultado esperado hoje é REPROVADO** —
> isso é proposital: comprova a lacuna e alimenta o backlog. Endpoints reais entre `código`.

### Compras
**T1 — RC sem tipo de compra** — *cobre 🟥 AUSENTE*
1. Criar RC sem `tipo`. 2. Salvar. 3. Observar.
**Esperado (alvo):** bloqueio + mensagem "tipo obrigatório". **Hoje:** REPROVA (campo não existe). **Evidência:** print + corpo da resposta. 

**T2 — RC sem WBS** — *🟥* — criar RC sem `wbs` → **alvo:** bloqueio. **Hoje:** REPROVA.

**T3 — Cotação >R$10.000 com <3 fornecedores** — *🟥* — montar cotação 2 fornecedores, valor 12.000 → **alvo:** bloqueio salvo exceção c/ justificativa + Diretor. **Hoje:** REPROVA.

**T4 — Compra emergencial sem Diretor** — *🟥* — marcar emergencial sem aprovação Diretor → **alvo:** bloqueio. **Hoje:** REPROVA.

**T5 — RFQ aberta >15 dias** — *🟥* — criar RFQ com data antiga → **alvo:** surge na Central de Alertas. **Hoje:** REPROVA (regra não existe; a Central já suporta o padrão, falta a fonte).

**T6 — PO sem mapa comparativo aprovado** — *🟡* — emitir PC sem mapa aprovado via `POST /api/pedidos` → **alvo:** bloqueio. **Validar:** no Worker há checagem de estágio (`papelPodeNoEstagio`); confirmar no Express.

**T7 — Pedido entregue sem confirmação de recebimento** — *🟡/✅* — pagar conta de PC sem recebimento lançado: `POST .../pagar` aciona auto-feed e 3-way; sem itens recebidos → divergência. **Evidência:** log `payment_blocked` motivo 3-way.

### Contratos
**T8 — Contrato sem gestor** — *🟡* — `POST /api/contratos` sem `responsavel_id` → **alvo:** obrigatório. **Validar:** hoje aceita nulo; tornar obrigatório.

**T9 — Contrato vencendo em 90/60/30** — *🟥* — contrato com `data_fim` próxima → **alvo:** alerta. **Hoje:** REPROVA.

**T10 — Medição sem aprovação do cliente** — *🟡* — registrar medição e tentar faturar sem aprovação → **alvo:** bloqueio. **Validar:** tabela `medicoes` existe; regra não confirmada.

### Financeiro
**T11 — AP acima de R$50.000 sem aprovação** — *🟥* — pagar conta 60.000 sem Diretor → **alvo:** bloqueio por alçada. **Hoje:** REPROVA (gate atual checa NF/contrato/3-way, **não** valor).

**T12 — Conta a pagar sem NF** — *✅* — `POST /api/contas-pagar/:id/pagar` sem `nota_fiscal` → **bloqueio 409**. **Evidência:** log `payment_blocked`.

**T13 — Pedido emitido sem conta a pagar** — *🟡* — relatório de PCs sem CP vinculada (regra de auditoria a implementar como consulta).

**T14 — NF sem CNPJ válido** — *🟥* — lançar NF com CNPJ inválido → **alvo:** bloqueio de campo. **Hoje:** REPROVA.

### Qualidade de dados
**T15 — Cadastro duplicado de fornecedor (CNPJ)** — *🟥* — cadastrar 2 fornecedores mesmo CNPJ → **alvo:** alerta/bloqueio. **Hoje:** REPROVA.

**T16 — Alteração de dados bancários sem dupla aprovação** — *🟥* — alterar `banco/agencia/conta` → **alvo:** exige 2 aprovações. **Hoje:** REPROVA (no portal o fornecedor altera direto; internamente também).

### SSMA
**T17 — Incidente sem RCA** — *🟥* — encerrar ocorrência SSMA sem causa raiz → **alvo:** bloqueio. **Hoje:** REPROVA.

**T18 — Colaborador/documento com treinamento vencido (ASO/NR-10/35/33)** — *🟥/⬜* — **alvo:** alerta. **Hoje:** REPROVA (sem módulo de pessoas/treinamentos).

### Fiscal / Bancário / Campo
**T19 — NF-e emitida dentro do ERP** — *⬜* — **alvo:** emissão homologada. **Hoje:** REPROVA.
**T20 — Conciliação bancária automática (OFX/CNAB)** — *⬜* — **alvo:** importar e conciliar. **Hoje:** REPROVA.
**T21 — Apontamento offline sincronizado** — *⬜* — **alvo:** registrar offline e sincronizar ao reconectar. **Hoje:** REPROVA (PWA parcial).

### Plataforma (validar o que JÁ existe)
**T22 — Isolamento do Portal do Fornecedor** — *✅* — logar como fornecedor A e acessar pedido de B → **403**. **Evidência:** 403 + log.
**T23 — Central de Alertas por severidade** — *✅* — `GET /api/alertas?dias=7` → JSON com `resumo` + `alertas[]`.
**T24 — Dashboard BI** — *✅* — `GET /api/bi` → exposição financeira, taxa de bloqueio do gate, entrega, alertas.
**T25 — Trilha imutável** — *✅* — adulterar registro e rodar verificação de cadeia → detecção.

---

## D. Plano de implementação (4 ondas)

### Onda 1 — 0 a 30 dias · Quick wins e bloqueios críticos (esforço baixo, alto impacto)
Todos cabem na arquitetura atual (campo + validação no `POST`/`PUT`, e a Central de Alertas
já existe como destino dos avisos):
1. `tipo` obrigatório na RC (enum Material/Serviço/Equipamento).
2. `wbs` obrigatório em RC e OS (+ índice p/ rastreabilidade custo→projeto).
3. Bloqueio de cotação <3 fornecedores acima de R$10.000 (exceção c/ justificativa + perfil Diretor; registrar na trilha).
4. RCA obrigatório para encerrar incidente SSMA (campo `causa_raiz` + `plano_acao`).
5. Alçada financeira por valor no gate (>R$50k exige aprovação Diretor Financeiro).
6. Alertas de vencimento de contrato 90/60/30 → **estender `coletarAlertas`/`montarAlertasWorker`** (já entregam o padrão).
7. AP vencido só reabre/posterga com justificativa obrigatória (na trilha).
8. Relatórios de auditoria como consultas: fornecedores sem avaliação 12m, PC sem mapa, cadastros incompletos.

### Onda 2 — 1 a 3 meses · Integrações simples e automações
1. Validação **CNPJ/situação cadastral** (Receita/SEFAZ) antes da PO — reusar o padrão do adaptador de bureau (`lib/credit_bureau.js`).
2. **Emissão NF-e/NFS-e/CT-e** via Focus NF-e/eNotas/NFe.io (REST) — *quick win* fiscal.
3. ✅ **Dashboard fluxo de caixa real vs. planejado por contrato** (`GET /api/fluxo-caixa`, bloco no BI — entregue).
4. Rotina de **detecção de duplicatas** (fornecedor/material/NF).
5. **Dupla aprovação** para CNPJ/conta bancária/e-mail de fornecedor.
6. Checklist de aceite de contrato + controle de seguro (alerta).
7. ✅ **Notificações por e-mail/sistema** (store + sino + eventos de homologação/banco — entregue).

### Onda 3 — 3 a 6 meses · Financeiro bancário e operação de campo
1. **CNAB 240/150**, **OFX**, **conciliação automática**, **pagamento em lote**, **DDA**, **PIX/Open Finance** (Sicoob/Bradesco).
2. **PWA offline-first**: Service Worker + IndexedDB + fila de sync + push.
3. **WMS**: endereçamento prateleira.corredor.posição + lote/validade + FEFO/FIFO + QR/Barcode.
4. BI executivo embarcado (drill-down por contrato/projeto).

### Onda 4 — 6 a 18 meses · Estrutura corporativa
1. **Contabilidade formal** + **SPED** (Contábil, EFD ICMS/IPI, Contribuições) + apuração tributária.
2. **Folha + eSocial** (S-2200/2210/2245, RAIS/DIRF/CAGED) — integrar Senior/TOTVS ou módulo próprio (homologação SEPRT/RFB).
3. **Marketplace de extensões** + **API pública REST/GraphQL** (SDK, OAuth2, webhooks, revenue share).
4. Integrações industriais (TOTVS/SAP PP) **apenas sob demanda estratégica**.

---

## E. Backlog técnico (histórias de usuário)

**US-01 — Tipo obrigatório na RC.** *Como comprador, quero que a RC exija o tipo
(Material/Serviço/Equipamento), para classificar o gasto.* **Aceite:** salvar sem tipo é
bloqueado; valor restrito ao enum; alteração registrada na trilha.

**US-02 — WBS obrigatória.** *Como controller, quero RC e OS vinculadas a uma linha WBS,
para rastrear custo por projeto/contrato.* **Aceite:** RC/OS sem WBS bloqueadas; relatório
de custo por WBS; meta de 100% de vinculação a partir da ativação.

**US-03 — Concorrência mínima.** *Como comprador, quero bloqueio de cotação acima de
R$10.000 com menos de 3 fornecedores, para garantir concorrência.* **Aceite:** sistema soma
o valor; conta fornecedores convidados e propostas; <3 bloqueia; exceção exige justificativa
formal + aprovação de Diretor; exceção fica na trilha de auditoria.

**US-04 — Compra emergencial.** *Como diretor, quero que toda compra emergencial passe por
minha aprovação, para controlar exceções.* **Aceite:** flag emergencial → workflow
obrigatório Diretor; sem aprovação não avança; registro na trilha.

**US-05 — Alçada financeira.** *Como diretor financeiro, quero aprovar pagamentos acima de
R$50.000, para controle de desembolso.* **Aceite:** o gate calcula o valor; >50k sem minha
aprovação é bloqueado; aprovação registrada com usuário/data.

**US-06 — RCA obrigatório (SSMA).** *Como SSMA, quero impedir encerrar incidente sem causa
raiz, para reduzir reincidência.* **Aceite:** encerrar exige `causa_raiz` + `plano_acao`;
sem isso, bloqueio; KPI % incidentes com RCA validada.

**US-07 — Vencimento de contrato.** *Como gestor de contratos, quero alertas em 90/60/30
dias, para renovar a tempo.* **Aceite:** contrato com `data_fim` próxima aparece na Central
de Alertas com a severidade crescente.

**US-08 — Dupla aprovação bancária.** *Como segurança da informação, quero que alteração de
conta bancária de fornecedor exija dois aprovadores, para evitar desvio.* **Aceite:** mudança
fica "pendente" até 2ª aprovação; trilha registra ambos.

*(Demais itens das ondas 2–4 seguem o mesmo formato; priorizar US-01..US-08.)*

---

## F. Matriz de risco

| Risco | Causa | Consequência | Prob. | Impacto | Nível | Controle atual | Controle recomendado | Dono | Prazo |
|-------|-------|--------------|-------|---------|-------|----------------|----------------------|------|-------|
| Compra sem concorrência | Sem bloqueio <3 cotações | Sobrepreço/fraude | Alta | Alto | **Crítico** | Nenhum | US-03 | Compras | 30d |
| Pagamento indevido | Falha de aprovação/lastro | Perda financeira | Média | Alto | Alto | Gate NF+contrato+3-way ✅ | + Alçada US-05 | Financeiro | 30d |
| Fornecedor irregular | Sem checagem Receita | Multa/contrato nulo | Média | Alto | Alto | Bureau crédito (parcial) | Validação SEFAZ Onda 2 | Qualidade | 90d |
| Sem rastreabilidade custo | RC/OS sem WBS | Custo-projeto irreal | Alta | Alto | **Crítico** | Nenhum | US-02 | Projetos | 30d |
| Contrato vencido | Sem alerta 90/60/30 | Operação sem cobertura | Média | Alto | Alto | Nenhum | US-07 | Contratos | 30d |
| Medição sem aprovação | Faturar sem aceite | Glosa/retrabalho | Média | Médio | Médio | Tabela `medicoes` 🟡 | Bloqueio de aceite | Contratos | 60d |
| Incidente sem RCA | Encerramento livre | Reincidência/acidente | Alta | Alto | **Crítico** | Nenhum | US-06 | SSMA | 30d |
| Treinamento vencido | Sem controle ASO/NR | Embargo/multa | Média | Alto | Alto | Nenhum | Alertas Onda 2 | SSMA | 90d |
| Dados cadastrais inconsistentes | Sem validação/dedup | Pagto errado | Alta | Médio | Alto | Validação parcial | Dedup + 2N bancário | Qualidade | 90d |
| Falha fiscal/contábil | Sem SPED/apuração | Autuação | Média | Alto | Alto | Nenhum | Onda 4 | Contabilidade | 12m |
| Erro folha/eSocial | Sem módulo RH | Multa trabalhista | Média | Alto | Alto | Nenhum | Onda 4 | RH | 18m |
| Perda de dado offline | PWA parcial | Apontamento perdido | Alta | Médio | Alto | Nenhum robusto | Onda 3 offline-first | TI | 120d |
| Falta de trilha | — | Sem auditabilidade | Baixa | Alto | Médio | **Trilha imutável ✅** | Manter + estender | Auditoria | — |

---

## G. Indicadores de controle (KPIs por módulo)

- **Compras:** % RC com tipo; % RC com WBS; % cotações com 3+ fornecedores; tempo médio resposta RFQ; % compras emergenciais; % PC com mapa aprovado.
- **Contratos:** % com gestor; % checklist completo; % com reunião mensal registrada; % OS com WBS; % medições aprovadas no prazo.
- **Financeiro:** % AP vencido >30d; % pagamentos >R$50k com aprovação; % NF rejeitada por dado inválido; % conciliação automática; desvio orçado×real. *(BI atual já entrega exposição, taxa de bloqueio do gate e taxa de entrega.)*
- **Fornecedores:** % cadastro completo; % avaliação vigente; % bloqueados por irregularidade; IDF médio; % alterações bancárias com dupla aprovação.
- **SSMA:** TFA; % incidentes com RCA; % planos de ação no prazo; % treinamentos vencidos; % documentos vencidos; % DDS realizados.
- **Fiscal/Contábil:** % notas emitidas no ERP; % SPED sem rejeição; erros de apuração; % lançamentos automáticos.
- **Tecnologia:** uptime API; % integrações sem erro; % apontamentos offline sincronizados; tempo médio de sync; % decisões com dashboard em tempo real.

---

## H. Evidências mínimas de auditoria

Para cada controle, coletar: **print da tela**, **log sistêmico**, **ID da transação**,
**data/hora**, **usuário executor**, **aprovador**, **justificativa**, **workflow
percorrido**, **relatório exportado**, **registro de bloqueio/exceção**, **histórico
imutável** (cadeia de hash já existente), **evidência de notificação**, **de integração
API**, **de conciliação** e **de sincronização offline**. A **trilha imutável** já provê
hash encadeado por registro — usá-la como fonte primária de evidência forense.

---

## I. Matriz RACI (resumo)

| Atividade | Sponsor | PO ERP | Compras | Contratos | Financ. | Fiscal | Contab. | RH | SSMA | Operações | TI/Dev | SI | Auditoria | Forn. ERP |
|-----------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Bloqueios compras (Onda 1) | A | R | C | I | I | – | – | – | – | I | R | C | C | I |
| Alçada financeira | A | R | I | I | C | – | – | – | – | I | R | C | C | – |
| RCA SSMA | A | R | – | I | – | – | – | – | C | I | R | – | C | – |
| Vencimento contratos | A | R | I | C | I | – | – | – | – | I | R | – | C | – |
| CNPJ/SEFAZ + NF-e (Onda 2) | A | R | C | I | C | C | I | – | – | I | R | C | I | C |
| Bancário CNAB/PIX (Onda 3) | A | R | – | – | C | – | I | – | – | I | R | C | I | C |
| Offline-first (Onda 3) | A | R | I | I | – | – | – | – | I | C | R | C | I | – |
| Contábil/SPED + Folha/eSocial (Onda 4) | A | R | – | – | C | C | C | C | – | I | R | C | C | C |

*(R=Responsável, A=Aprovador, C=Consultado, I=Informado.)*

---

## J. Conclusão executiva

**Diagnóstico.** O ERP tem um **núcleo financeiro-transacional sólido e testado** (gate de
pagamento, 3-way, numeração atômica, trilha imutável, LGPD, portal, alertas, BI). O risco
não está nesse núcleo — está na **camada de compliance de Compras/Contratos/SSMA marcada
como "feita" sem lastro no código**. A prioridade #0 é **reconciliar o status** e fechar os
bloqueios de baixo esforço.

**5 ações imediatas (≤30 dias):** (1) `tipo` na RC; (2) WBS obrigatória RC/OS; (3) bloqueio
<3 cotações >R$10k; (4) RCA obrigatório SSMA; (5) alçada financeira >R$50k.

**5 ações de médio prazo (1–3 meses):** validação CNPJ/SEFAZ; emissão NF-e; fluxo de caixa
real×planejado; detecção de duplicatas; dupla aprovação bancária.

**5 ações estruturais (6–18 meses):** contabilidade+SPED; folha+eSocial; CNAB/PIX/Open
Finance; offline-first; API pública/marketplace.

**Dependências técnicas:** adaptadores REST (Receita/SEFAZ, NF-e, bancos) seguindo o padrão
já existente do bureau de crédito; manter **paridade Express + Worker**; persistência
server-side para anomalias/CAPA antes de levá-las ao BI/alertas.

**Risco de não avançar:** manter controles "fantasma" mascara exposição a fraude, pagamento
indevido, autuação fiscal/trabalhista e perda de rastreabilidade — com agravante de
auditoria, pois hoje há itens reportados como prontos que não resistem a um teste.

**Governança recomendada:** ritual **semanal** de 30 min acompanhando (a) % de itens 🟥
convertidos em ✅ por onda, (b) KPIs de compliance de Compras, (c) backlog US-01..US-08, com
a **Central de Alertas** e o **Dashboard BI** como telas oficiais de acompanhamento.

---

> **Como este plano é aplicável dentro deste ERP:** as ações da Onda 1 reaproveitam a
> arquitetura já entregue — validações nos handlers `POST`/`PUT`, novos campos via
> `ensureColumns`, e os avisos plugando em `coletarAlertas`/`montarAlertasWorker` (Central
> de Alertas) e nos KPIs de `coletarKPIs`/`montarKPIsWorker` (Dashboard BI). Cada item
> entra com **teste automatizado** (padrão dos 134 testes atuais) e **paridade
> Express + Worker**, na mesma cadência de PRs pequenos já em curso.
