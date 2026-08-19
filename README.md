# Hórus ERP

ERP multiempresa voltado à gestão integrada de **compras, contratos, fornecedores, estoque, financeiro, aprovações e auditoria**.

> O nome técnico legado `NEXUS` ainda aparece em alguns arquivos e módulos. A marca funcional do produto é **Hórus ERP**.

## Estado atual da arquitetura

O repositório possui três trilhas históricas, mas apenas uma deve ser tratada como runtime operacional atual:

| Pasta | Papel atual |
|---|---|
| `nexus-erp/` | **Runtime operacional**: API Express + SQLite e frontend estático. É o alvo configurado em `render.yaml`. |
| `nexus-cf/` | Alvo alternativo Cloudflare Worker + D1. **Não é produção até o D1 ser configurado e o cutover ser formalizado.** |
| `erp-app/` | Protótipo React/Vite legado. Não é a fonte de verdade do Hórus. |

A decisão arquitetural vigente está documentada em `docs/ARQUITETURA_ATUAL.md`.

## Fluxo de negócio principal

O Hórus cobre o ciclo de suprimentos ponta a ponta, incluindo:

**OS / demanda → RC → RFQ → cotações → mapa comparativo → aprovações → pedido de compra → recebimento → conferência / 3-way match → contas a pagar → indicadores e auditoria**.

O sistema também possui módulos de contratos, fornecedores, estoque, multiempresa, permissões, dashboards e controles de compliance.

## Desenvolvimento local

Pré-requisito: Node.js 20+ recomendado.

```bash
npm install
npm run repo:guard
npm test
npm start
```

Por padrão o servidor utiliza a porta definida em `PORT` ou `3002`.

## Segurança de runtime

Em produção o Hórus opera em modo **fail closed**. O processo não deve iniciar sem uma política explícita de credenciais e persistência.

Variáveis relevantes:

- `SEED_PASSWORD`: senha inicial forte, com no mínimo 12 caracteres; não versionar credenciais.
- `DB_PATH`: caminho do SQLite persistente em produção.
- `ALLOW_EPHEMERAL_DB=1`: permitido somente para demonstração/ambiente descartável. Não usar para dados reais.
- `PORT`: porta fornecida pela plataforma de hospedagem.

## Deploy

O deploy operacional está descrito em `render.yaml`, com health check em `/api/health` e auto-deploy do branch `main`.

Para produção real, utilize **disco persistente + `DB_PATH`**. O plano com banco efêmero serve apenas para demonstração e perde dados quando a instância é recriada.

O workflow `.github/workflows/live-smoke.yml` verifica o endpoint público do Hórus sem expor credenciais.

## Qualidade e CI

A cada push/PR, o GitHub Actions executa:

1. `Repository Guard` para bloquear segredos, bancos locais, caches e artefatos gerados indevidos;
2. validação de sintaxe dos dois backends;
3. suíte automatizada do `nexus-erp` em Node 20 e 22.

Comandos úteis:

```bash
npm run repo:guard
npm test
npm run verify
```

## Regras de fonte de verdade

- Código funcional: `nexus-erp/`.
- Frontend servido: `nexus-erp/public/`.
- `nexus-erp/dist/` é saída/artefato gerado e **não deve ser editado manualmente**.
- `nexus-cf/` só assume produção depois de D1, secrets, smoke tests e cutover aprovados.
- Não versionar `.env`, bancos SQLite, `node_modules`, caches ou exportações integrais de código-fonte.

## Próximas prioridades funcionais

Após a estabilização técnica, as melhorias de maior valor estão concentradas em:

- governança de compra emergencial/exceções;
- aging e escalonamento de RFQs sem resposta;
- checklist documental, seguros e garantias de contratos;
- controles documentais de SSMA;
- evolução do estoque transacional e previsibilidade de abastecimento.

Essas evoluções devem preservar o princípio do Hórus: **um módulo só é considerado pronto quando participa corretamente do fluxo ponta a ponta**.
