# Consolidação de Backends e Migrations

> **Documento histórico — decisão supersedida em 18/08/2026.** Este arquivo registra a estratégia anterior de cutover para Cloudflare Worker + D1. A fonte de verdade operacional atual está em `docs/ARQUITETURA_ATUAL.md`: `nexus-erp/` (Express + SQLite) é o runtime implantado pelo `render.yaml`; `nexus-cf/` permanece como alvo de migração até D1, secrets, equivalência funcional e cutover serem efetivamente validados.

> Registro de decisão e plano de cutover anterior. Decisão histórica: **backend único =
> Cloudflare Workers + D1** (`nexus-cf`). O Express seria aposentado.

## 1. Situação encontrada (dois backends, dois modelos)

| Backend | Arquivo | Modelo de dados | Status histórico |
|---------|---------|-----------------|------------------|
| **Cloudflare Worker** | `nexus-cf/src/index.js` + `schema.sql` | **Documento** (`id` + `payload` JSON) | Alvo canônico da decisão anterior |
| Express + better-sqlite3 | `nexus-erp/server.js` + `migrations/*` | Relacional (coluna por campo) | Tratado como legado na decisão anterior |
| Estático | `nexus-erp/serve.js` | — (serve `public/`) | Substituído pelos assets do Worker no plano anterior |

Os dois bancos **nunca conversaram**: têm schemas e até envelopes de resposta
diferentes (`{data}` no Worker × `{success,data}` no Express).

## 2. Por que o Worker foi escolhido no plano anterior

O Worker já implementava, **server-authoritative**, o núcleo do negócio:
- Auth forte (PBKDF2 + JWT HS256), `JWT_SECRET` obrigatório (falha fechada).
- Aprovação multi-estágio de RC e Mapa com **autoridade rechecada na ação** e
  **no-double-approval** (SoD).
- Emissão de PC só de mapa **Aprovado**.
- **Gate de pagamento** (`gateContaPagar`/`pagarConta`): NF + lastro + 3-way
  match. É a materialização de "nada paga sem lastro".
- Trilha de auditoria **append-only** (`audit_log`).

O Express comparava senha em texto plano naquele estágio (corrigido posteriormente) e era tratado como sandbox naquele plano.

## 3. Migrations — diagnóstico histórico

As migrations em `nexus-erp/migrations/` eram do **modelo relacional legado**:
- **Duplicatas de numeração**: dois `0001_*` (`schema_inicial` × `schema_completo`)
  e dois `0006_*` (`almoxarifado_v2` × `recebimentos_sem_fk`) → ordem
  não-determinística.
- **Incompatibilidade de seed**: `0002_seed_inicial.sql` foi escrito para
  `0001_schema_inicial` (id TEXT) e quebra com `0001_schema_completo`
  (id INTEGER) — derrubava o boot em banco limpo (mitigado no Sprint 1 com
  runner resiliente + `ensureAdmin`).
- **Relíquias**: `0003`–`0031` **não são carregadas** pelo `server.js` (que só
  usa `0001_schema_completo` + `0002_seed_inicial`). São de uma tentativa
  relacional antiga em D1.
- `0006_recebimentos_sem_fk` removeu a FK de propósito ("pedidos criados via
  localStorage não existem no D1") — workaround do split que **deixa de existir**
  no modelo documento.

A decisão daquele plano era congelar as migrations relacionais e usar `nexus-cf/schema.sql` como fonte de verdade no alvo Cloudflare. Essa decisão **não representa o runtime operacional vigente**; consulte `docs/ARQUITETURA_ATUAL.md`.

## 4. O que foi feito naquela consolidação

- `nexus-cf/schema.sql`: **absorveu** as entidades que só existiam no Express
  (`contratos`, `crm`, `projetos`, `ssma`, `almoxarifado`, `recebimentos`) no
  mesmo modelo documento.
- `nexus-cf/src/index.js`: a whitelist `TABLES` passou a servir essas entidades
  pelo CRUD genérico (com auth + auditoria).
- `nexus-cf/wrangler.toml`: corrigido o caminho dos assets (`../nexus-erp/public`).
- `nexus-cf/DEPLOY.md` + `nexus-cf/setup.sh`: guia e script de ambiente (criar
  D1, schema, secrets, deploy, verificação do gate).
- `nexus-cf/schema.sql` **validado** num SQLite real (aplica limpo, 19 tabelas,
  CRUD documento OK) antes de qualquer deploy.
- **Migrations relacionais decluttered**: o set legado foi movido para
  `nexus-erp/migrations/legacy/` (com README). Ficam ativos só os dois arquivos
  que o `server.js` carrega (`0001_schema_completo`, `0002_seed_inicial`),
  eliminando a ambiguidade das numerações duplicadas.
- **`db.js` religado ao caminho do dinheiro** (atrás de `NEXUS_SERVER_MODE`):
  módulo `DB.contas` com o gate `pagar()`, `DB.mapas.emitirPC()` e aprovação de
  mapa server-authoritative (sem fallback que forje "Aprovado").
- **Call-sites da UI religados** (aditivo, via `fluxo_server_bridge.js`): com o
  modo servidor ligado, `aprovarMapa2`, `emitirPedidoDoMapa`, `gerarPedidoDeMapa`
  delegam ao servidor; `financeiro.js` paga via `DB.contas.pagar`. Modo desligado
  preserva o comportamento legado. Cobertos por testes jsdom (15/15 na suíte daquele ciclo).

## 5. Plano de cutover histórico

1. **Deploy do Worker + D1** (ver `DEPLOY.md`) e validar o gate de pagamento.
2. **Religar o cliente ao servidor** (`db.js`/módulos) atrás da flag
   `NEXUS_SERVER_MODE`, começando pelo **caminho do dinheiro** (aprovar mapa →
   emitir PC → pagar), depois RC/OS, depois os módulos absorvidos.
3. Provar cada módulo (inclusive **teste multiusuário em 2 navegadores**) antes
   de aposentar o `localStorage` correspondente.
4. Quando todos os módulos estivessem no servidor: **remover** `server.js`,
   `serve.js` e `migrations/*` relacionais; o Express sairia do repositório.

Esse plano só volta a ser executável depois que os pré-requisitos atuais de Cloudflare descritos em `docs/ARQUITETURA_ATUAL.md` forem atendidos.

## 6. Pendências registradas naquele momento

- Ações especiais ainda não portadas ao Worker: movimentação de estoque
  (`almoxarifado/:id/movimentar`), numeração atômica de documentos
  (naquele momento `{length+1}` no cliente → corrida).
- Matriz de cotação com auditoria de preço em nível de campo e segregação.
- IDF/score do fornecedor lido do servidor (não do `localStorage`).

> Algumas dessas pendências foram implementadas depois. Use testes e o roadmap atual, e não esta seção histórica isoladamente, para determinar o estado presente de cada função.
