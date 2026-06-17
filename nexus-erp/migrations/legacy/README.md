# Migrations legadas (modelo relacional Express)

Estes arquivos são do **backend Express legado** (`nexus-erp/server.js`) e do
modelo relacional antigo. **Não são a fonte de verdade** — o backend canônico é
o Cloudflare Worker (`nexus-cf`), cujo schema é `nexus-cf/schema.sql` (modelo
documento). Ver `CONSOLIDACAO.md` na raiz.

Foram movidos para cá porque:
- **Não são carregados** pelo `server.js` (que só usa `0001_schema_completo.sql`
  e `0002_seed_inicial.sql`, mantidos um nível acima).
- Tinham **numeração duplicada** (`0001_schema_inicial` × `0001_schema_completo`;
  `0006_almoxarifado_v2` × `0006_recebimentos_sem_fk`), gerando ordem
  não-determinística.
- `0003`–`0031` eram relíquias de uma tentativa relacional em D1.

Mantidos apenas como referência histórica até o cutover completo, quando o
Express e este diretório serão removidos.
