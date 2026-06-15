# Consolidação de Backends e Migrations

> Registro de decisão e plano de cutover. Decisão: **backend único =
> Cloudflare Workers + D1** (`nexus-cf`). O Express é aposentado.

## 1. Situação encontrada (dois backends, dois modelos)

| Backend | Arquivo | Modelo de dados | Status |
|---------|---------|-----------------|--------|
| **Cloudflare Worker** | `nexus-cf/src/index.js` + `schema.sql` | **Documento** (`id` + `payload` JSON) | ✅ **Canônico** |
| Express + better-sqlite3 | `nexus-erp/server.js` + `migrations/*` | Relacional (coluna por campo) | ⚠️ **Legado** (sandbox) |
| Estático | `nexus-erp/serve.js` | — (serve `public/`) | Substituído pelos assets do Worker |

Os dois bancos **nunca conversaram**: têm schemas e até envelopes de resposta
diferentes (`{data}` no Worker × `{success,data}` no Express).

## 2. Por que o Worker é o canônico

O Worker já implementa, **server-authoritative**, o núcleo do negócio:
- Auth forte (PBKDF2 + JWT HS256), `JWT_SECRET` obrigatório (falha fechada).
- Aprovação multi-estágio de RC e Mapa com **autoridade rechecada na ação** e
  **no-double-approval** (SoD).
- Emissão de PC só de mapa **Aprovado**.
- **Gate de pagamento** (`gateContaPagar`/`pagarConta`): NF + lastro + 3-way
  match. É a materialização de "nada paga sem lastro".
- Trilha de auditoria **append-only** (`audit_log`).

O Express compara senha em texto plano (corrigido no Sprint 1, mas é sandbox) e
não tem gate de pagamento equivalente.

## 3. Migrations — diagnóstico

As migrations em `nexus-erp/migrations/` são do **modelo relacional legado**:
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

**Decisão:** no alvo canônico não há migrations relacionais. O schema do D1 é
um arquivo único versionado: `nexus-cf/schema.sql`. As migrations relacionais
ficam **congeladas como legado** (não são renomeadas/apagadas para preservar
histórico do sandbox), e deixam de ser a fonte de verdade.

## 4. O que já foi feito nesta consolidação

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

## 5. Plano de cutover (não-destrutivo, por módulo)

1. **Deploy do Worker + D1** (ver `DEPLOY.md`) e validar o gate de pagamento.
2. **Religar o cliente ao servidor** (`db.js`/módulos) atrás da flag
   `NEXUS_SERVER_MODE`, começando pelo **caminho do dinheiro** (aprovar mapa →
   emitir PC → pagar), depois RC/OS, depois os módulos absorvidos.
3. Provar cada módulo (inclusive **teste multiusuário em 2 navegadores**) antes
   de aposentar o `localStorage` correspondente.
4. Quando todos os módulos estiverem no servidor: **remover** `server.js`,
   `serve.js` e `migrations/*` relacionais; o Express sai do repositório.

## 6. Pendências conhecidas (futuro)

- Ações especiais ainda não portadas ao Worker: movimentação de estoque
  (`almoxarifado/:id/movimentar`), numeração atômica de documentos
  (hoje `{length+1}` no cliente → corrida).
- Matriz de cotação com auditoria de preço em nível de campo e segregação.
- IDF/score do fornecedor lido do servidor (não do `localStorage`).
