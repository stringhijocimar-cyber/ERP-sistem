# Verificação multiusuário — caminho do dinheiro (pós-deploy)

Roteiro para validar, **com o Worker no ar**, que o caminho do dinheiro é
server-authoritative: aprovação multi-estágio, no-double-approval, segregação de
funções e o gate de pagamento ("nada paga sem lastro").

Use **dois navegadores/abas anônimas** (aprovador ≠ pagador) para o teste de UI,
e os `curl` abaixo para o teste direto da API (mais rápido e determinístico).

---

## 0. Pré-requisitos

- Deploy feito (`./setup.sh`) e os 6 usuários da seed criados com `SEED_PASSWORD`.
- URL do Worker (algo como `https://nexus-erp.<subdominio>.workers.dev`).

```bash
export BASE="https://nexus-erp.SEU-SUBDOMINIO.workers.dev"   # ajuste
export PASS="SUA_SEED_PASSWORD"                              # a mesma do setup
```

Usuários da seed (todos com a `SEED_PASSWORD`):

| email | role | papel no caminho do dinheiro |
|---|---|---|
| `operacao@fraseralexander.com.br` | operacao | aprova mapa estágio 1 |
| `diretor@fraseralexander.com.br` | diretor | aprova mapa estágio 2 |
| `compras@fraseralexander.com.br` | compras | emite o PC |
| `financeiro@fraseralexander.com.br` | financeiro | **paga** (gate) |
| `admin@fraseralexander.com.br` | admin | curinga (todos os estágios) |

### Helper de login (captura o token de cada papel)

Requer `jq` (senão troque por `python3 -c`/grep). O token vem em `.data.token`.

```bash
login(){ curl -s "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"senha\":\"$PASS\"}" | jq -r '.data.token'; }

T_OP=$(login operacao@fraseralexander.com.br)
T_DIR=$(login diretor@fraseralexander.com.br)
T_COM=$(login compras@fraseralexander.com.br)
T_FIN=$(login financeiro@fraseralexander.com.br)
T_ADM=$(login admin@fraseralexander.com.br)
echo "ok: ${T_OP:0:12}… ${T_FIN:0:12}…"   # devem aparecer prefixos de JWT
```

Atalho para chamadas autenticadas:

```bash
api(){ local tok="$1" m="$2" path="$3" body="${4:-}"; \
  curl -s -o /tmp/r.json -w "%{http_code}" -X "$m" "$BASE/api$path" \
    -H "Authorization: Bearer $tok" -H 'Content-Type: application/json' \
    ${body:+-d "$body"}; echo; cat /tmp/r.json; echo; }
```

---

## 1. Gate de pagamento (DB.contas.pagar → `/contas-pagar/:id/pagar`)

A seed já cria dois títulos: **`CP-OK-001`** (contrato + NF = lastro completo) e
**`CP-BLOQ-001`** (origem "Geral" e sem NF).

| # | Quem | Ação | Esperado |
|---|---|---|---|
| 1.1 | financeiro | pagar `CP-OK-001` | **200** · `status:"Pago"` |
| 1.2 | financeiro | pagar `CP-BLOQ-001` | **409** · `sem nota fiscal; sem pedido ou contrato de origem (lastro)` |
| 1.3 | operacao | pagar `CP-OK-002`* | **403** · segregação (só financeiro/admin paga) |

```bash
# 1.1 — deve pagar
api "$T_FIN" POST /contas-pagar/CP-OK-001/pagar          # → 200, status Pago
# 1.2 — deve bloquear
api "$T_FIN" POST /contas-pagar/CP-BLOQ-001/pagar        # → 409 + motivos
# 1.3 — segregação (cria um título com lastro e tenta pagar como operação)
api "$T_ADM" POST /contas-pagar \
  '{"id":"CP-OK-002","descricao":"Lastro ok 2","contrato_id":"CT-2025-001","valor":800,"vencimento":"2025-12-31","status":"Aprovado","nota_fiscal":"NF-22222"}'
api "$T_OP"  POST /contas-pagar/CP-OK-002/pagar          # → 403 segregação
```

### 1.4 (opcional) 3-way — valor acima do pedido de origem

```bash
api "$T_ADM" POST /pedidos '{"id":"PED-3WAY","valor":1000,"status":"Emitido"}'
api "$T_ADM" POST /contas-pagar \
  '{"id":"CP-3WAY","descricao":"Acima do pedido","pedido_id":"PED-3WAY","valor":2000,"status":"Aprovado","nota_fiscal":"NF-33333"}'
api "$T_FIN" POST /contas-pagar/CP-3WAY/pagar            # → 409 valor acima do pedido de origem
```

---

## 2. Aprovação multi-estágio do mapa (`/mapas/:id/aprovar`)

São **2 estágios**: estágio 1 = operação/compras/admin; estágio 2 = diretoria/admin.

```bash
# Cria um mapa aguardando aprovação
api "$T_ADM" POST /mapas '{"id":"MAPA-TST-1","status":"Aguardando Aprovação","estagio_atual":1,"valor":5000}'
```

| # | Quem | Ação | Esperado |
|---|---|---|---|
| 2.1 | operacao | aprovar `MAPA-TST-1` | **200** · ainda **não** "Aprovado" (vai p/ estágio 2) |
| 2.2 | diretor | aprovar `MAPA-TST-1` | **200** · `status:"Aprovado"` |

```bash
api "$T_OP"  POST /mapas/MAPA-TST-1/aprovar              # → 200, estagio_atual 2
api "$T_DIR" POST /mapas/MAPA-TST-1/aprovar              # → 200, status Aprovado
```

### 2.3 No-double-approval (mesmo usuário não aprova dois estágios)

```bash
api "$T_ADM" POST /mapas '{"id":"MAPA-TST-2","status":"Aguardando Aprovação","estagio_atual":1,"valor":4000}'
api "$T_ADM" POST /mapas/MAPA-TST-2/aprovar             # → 200 (estágio 1)
api "$T_ADM" POST /mapas/MAPA-TST-2/aprovar             # → 409 "já aprovou um estágio deste mapa"
```

---

## 3. Emissão de PC (`/mapas/:id/emitir-pc`)

Só com o mapa **Aprovado** e **só pelo perfil emissor** (compras/admin).

| # | Quem | Alvo | Esperado |
|---|---|---|---|
| 3.1 | compras | `MAPA-TST-2` (parcial) | **409** · mapa não está aprovado |
| 3.2 | operacao | `MAPA-TST-1` (aprovado) | **403** · perfil não pode emitir PC |
| 3.3 | compras | `MAPA-TST-1` (aprovado) | **200** · cria `PED-…` e mapa vira "PC Emitido" |

```bash
api "$T_COM" POST /mapas/MAPA-TST-2/emitir-pc           # → 409 não aprovado
api "$T_OP"  POST /mapas/MAPA-TST-1/emitir-pc           # → 403 perfil
api "$T_COM" POST /mapas/MAPA-TST-1/emitir-pc           # → 200 PC emitido
```

---

## 4. Roteiro pela UI (com `NEXUS_SERVER_MODE = true`)

Pré-condição: em `nexus-erp/public/index.html`, ligar
`window.NEXUS_SERVER_MODE = true;` e servir a UI pelo mesmo domínio do Worker.

1. **Aba A — operação** loga; em Fluxo de Compras, aprova o estágio 1 do mapa.
   → toast "Estágio do mapa aprovado".
2. **Aba B — diretoria** loga; aprova o estágio 2. → mapa fica "Aprovado".
3. **Aba B (ou compras)** tenta aprovar de novo o mesmo estágio →
   erro de segregação/no-double (o servidor recusa).
4. **Compras** clica "Emitir PC" no mapa aprovado → PC gerado (vem do servidor).
5. **Operação** tenta "Emitir PC" → bloqueado (403).
6. **Financeiro** abre Contas a Pagar, paga `CP-OK-001` → sucesso;
   tenta `CP-BLOQ-001` → toast "Pagamento bloqueado: sem nota fiscal; …".
7. **Operação** tenta pagar → bloqueado (segregação).

---

## 5. Tabela-resumo (marque ao validar)

- [ ] 1.1 paga com lastro (200)
- [ ] 1.2 bloqueia sem NF/lastro (409)
- [ ] 1.3 segregação no pagamento (403)
- [ ] 1.4 3-way valor acima do pedido (409) — opcional
- [ ] 2.1/2.2 aprovação em 2 estágios (200 → Aprovado)
- [ ] 2.3 no-double-approval (409)
- [ ] 3.1 emitir PC sem aprovação (409)
- [ ] 3.2 emitir PC com perfil errado (403)
- [ ] 3.3 emitir PC ok (200)
- [ ] 4. fluxo equivalente pela UI

Qualquer divergência (ex.: um 200 onde se esperava 409) indica que aquele
controle não está ativo no ambiente — anote o caso e o corpo da resposta.
