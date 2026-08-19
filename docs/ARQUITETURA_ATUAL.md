# Hórus ERP — Arquitetura Atual

**Decisão vigente:** 18/08/2026

## 1. Fonte de verdade operacional

O runtime operacional do Hórus é hoje:

- backend: `nexus-erp/server.js` (Express);
- banco: SQLite, com persistência obrigatória em produção real;
- frontend: `nexus-erp/public/`;
- hospedagem declarada no repositório: Render (`render.yaml`);
- branch de deploy: `main`.

Essa decisão reflete a configuração efetivamente presente no repositório e as proteções de runtime adicionadas ao Express.

## 2. Cloudflare Worker + D1

`nexus-cf/` é uma arquitetura alternativa/objetivo de migração, não a fonte de verdade operacional enquanto houver `database_id` placeholder em `wrangler.toml` e não existir um cutover validado.

Para promover essa arquitetura a produção são necessários, no mínimo:

1. D1 real criado e identificado no `wrangler.toml`;
2. schema/migrations aplicados;
3. secrets de autenticação e CORS configurados;
4. equivalência funcional dos endpoints críticos validada;
5. testes E2E de OS/RC → RFQ → mapa → PC → recebimento → financeiro;
6. plano de migração de dados e rollback;
7. desativação explícita do runtime anterior.

## 3. Código legado

`erp-app/` é protótipo histórico React/Vite e não deve receber novas regras de negócio.

Documentos anteriores que descrevam o Worker/D1 como backend canônico devem ser interpretados como decisões históricas anteriores a esta revisão.

## 4. Regra de edição

- editar frontend somente em `nexus-erp/public/`;
- editar backend operacional em `nexus-erp/`;
- não editar `nexus-erp/dist/` manualmente;
- não duplicar uma nova regra simultaneamente nos dois backends sem plano de migração;
- toda mudança em regra financeira, aprovação, tenant ou estoque deve incluir teste automatizado.

## 5. Produção e persistência

O `runtime_guard` opera em fail closed. Produção exige:

- `SEED_PASSWORD` forte e não versionado;
- `DB_PATH` persistente para uso real; ou
- `ALLOW_EPHEMERAL_DB=1` apenas para demonstrações descartáveis, com aceite explícito de perda de dados.

Um ERP com banco efêmero pode ser útil para demonstração, mas não atende continuidade operacional, auditoria nem integridade de registros.

## 6. Health e smoke test

- health interno: `GET /api/health`;
- smoke externo: `.github/workflows/live-smoke.yml`;
- CI técnico: `.github/workflows/ci.yml`.

A aprovação de uma mudança não deve depender apenas de telas abrindo. O critério é fluxo ponta a ponta + testes + saúde do runtime.

## 7. Próximos alvos de arquitetura

1. decompor gradualmente `server.js` por domínios sem reescrita total;
2. reduzir arquivos JavaScript monolíticos de páginas por feature/service;
3. tornar a persistência de produção explícita e observável;
4. consolidar um único backend antes de expandir integrações externas;
5. adicionar E2E de smoke para os fluxos de maior risco financeiro e de compliance.
