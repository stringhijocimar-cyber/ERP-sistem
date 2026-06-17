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
| Testes | ✅ 23/23 (segurança, gate, bridge, crédito, integração fornecedores) |

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
- ⬜ **Fornecedores+**: consulta automática de situação fiscal/credit bureau real
  (hoje a análise usa dados informados + CNPJ; integrar Serasa/SPC/Receita).
- ✅ **Numeração atômica no servidor** — endpoint `POST /api/sequencia/:tipo`
  (Express + Worker/D1) com UPSERT+RETURNING; PC já usa, com fallback offline.
  Testado com 100 chamadas concorrentes → 100 números únicos. RC/RFQ/MAPA
  podem usar o mesmo helper (`DB.sequencia`).
- ⬜ **Recebimento ↔ 3-way match completo** (qtd e preço por item, não só total).
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
- ⬜ **Trilha de auditoria imutável** (hash encadeado em `audit_log`).
- ⬜ **LGPD**: base legal, retenção e anonimização.

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
