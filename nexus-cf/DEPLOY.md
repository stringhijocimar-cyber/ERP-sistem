# Deploy do NEXUS ERP — Cloudflare Workers + D1

Guia passo a passo para subir o backend canônico (`nexus-cf`) com banco
Cloudflare D1. Este é o **alvo de produção** decidido na consolidação; o
servidor Express (`nexus-erp/server.js`) é legado e será aposentado.

> Pré-requisitos: conta Cloudflare (plano gratuito serve para começar),
> Node.js 18+ e `npx`. Não precisa instalar o wrangler globalmente.

---

## 1. Login no Cloudflare

```bash
cd nexus-cf
npx wrangler login
```
Abre o navegador para autorizar. Em ambiente headless, use um API Token:
`export CLOUDFLARE_API_TOKEN=...` (permissões: Workers Scripts:Edit, D1:Edit).

## 2. Criar o banco D1

```bash
npx wrangler d1 create nexus-erp-db
```
A saída traz um bloco `[[d1_databases]]` com um `database_id`. **Copie esse
`database_id`** para o `wrangler.toml` (substitui `PREENCHER_APOS_CRIAR`):

```toml
[[d1_databases]]
binding = "DB"
database_name = "nexus-erp-db"
database_id = "<cole-o-id-aqui>"
```

## 3. Aplicar o schema

```bash
# Banco remoto (produção)
npx wrangler d1 execute nexus-erp-db --remote --file=./schema.sql
# Banco local (para `wrangler dev`)
npx wrangler d1 execute nexus-erp-db --local  --file=./schema.sql
```

## 4. Definir os segredos (NUNCA no wrangler.toml)

```bash
# Segredo HS256 para assinar JWT (mín. 16 chars; gere algo forte)
npx wrangler secret put JWT_SECRET
# Senha inicial do seed (admin e contas-base)
npx wrangler secret put SEED_PASSWORD
```
Sem `JWT_SECRET`, o Worker **falha fechado** (não emite/valida token). Sem
`SEED_PASSWORD`, o seed gera uma senha aleatória e a registra no log
(`wrangler tail`).

## 5. Deploy

```bash
npx wrangler deploy
```
Publica o Worker + serve a SPA de `../nexus-erp/public`. A URL aparece na saída.

## 6. Desenvolvimento local

```bash
npx wrangler dev
```
Sobe em `http://localhost:8787` usando o D1 local.

---

## 7. Verificação (a regra de ouro: nada paga sem lastro)

Após o deploy, o seed cria duas contas de teste do gate de pagamento:

```bash
BASE=https://<seu-worker>.workers.dev   # ou http://localhost:8787

# Login (usa o email do admin + a SEED_PASSWORD)
TOKEN=$(curl -s $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@fraseralexander.com.br","senha":"<SEED_PASSWORD>"}' \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')

# CP com lastro completo (NF + origem) -> deve PAGAR (200)
curl -s -X POST $BASE/api/contas-pagar/CP-OK-001/pagar \
  -H "Authorization: Bearer $TOKEN"

# CP sem NF -> deve BLOQUEAR (409 "sem nota fiscal")
curl -s -X POST $BASE/api/contas-pagar/CP-BLOQ-001/pagar \
  -H "Authorization: Bearer $TOKEN"
```

Esperado: `CP-OK-001` paga; `CP-BLOQ-001` retorna **409** com o motivo do gate.

---

## 8. Flags do gate (`[vars]` no wrangler.toml)

| Var | Default | Efeito |
|-----|---------|--------|
| `ENFORCE_NF`     | `1` | Exige nota fiscal para pagar. `0` desliga (ex.: migrar dados antigos). |
| `ENFORCE_ORIGIN` | `1` | Exige pedido/contrato de origem (lastro). |
| `ENFORCE_SOD`    | `1` | Segregação de funções: o mesmo usuário não aprova 2 estágios. |

Mantenha tudo em `1` em produção. Use `0` apenas em janelas de migração.
