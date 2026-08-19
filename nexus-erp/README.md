# Hórus ERP — Runtime Express

Esta pasta contém o **runtime operacional atual do Hórus ERP**: backend Express/SQLite, frontend estático e suíte automatizada de testes.

> O nome `NEXUS` permanece em nomes internos por compatibilidade histórica. Não use documentação antiga para decidir o runtime de produção; consulte `../docs/ARQUITETURA_ATUAL.md`.

## Principais capacidades

- fluxo de compras OS/RC → RFQ → cotações → mapa → aprovações → pedido;
- fornecedores e avaliação de desempenho;
- contratos e alertas;
- recebimento, conferência e 3-way match;
- contas a pagar e controles financeiros;
- estoque e movimentações;
- multiempresa/tenant isolation;
- perfis, permissões e trilha de auditoria;
- dashboards e indicadores.

## Execução local

```bash
npm ci
npm test
npm start
```

O servidor usa `PORT` ou, na ausência dela, a porta `3002`.

## Credenciais e seed

**Não existe senha de produção documentada no repositório.**

Defina `SEED_PASSWORD` no ambiente. O `scripts/runtime_guard.js` impede o boot de produção quando a senha está ausente, fraca ou corresponde a uma credencial histórica insegura.

Exemplo local somente para desenvolvimento:

```bash
SEED_PASSWORD='defina-uma-senha-local-forte' npm start
```

Nunca faça commit de `.env` ou credenciais reais.

## Persistência

O backend utiliza SQLite.

- desenvolvimento/testes: banco local/temporário conforme o ambiente;
- produção real: configure `DB_PATH` apontando para armazenamento persistente;
- demonstração descartável: `ALLOW_EPHEMERAL_DB=1` pode ser usado conscientemente, aceitando perda de dados após recriação/redeploy.

## Testes

```bash
npm test
```

A suíte cobre regras de negócio, autenticação, multiempresa, aprovações, compras, contratos, financeiro, estoque e guardas de produção.

O CI do repositório executa os testes em Node 20 e 22.

## Frontend

A fonte de verdade do frontend servido está em:

```text
public/
```

`dist/` deve ser tratado como saída/artefato gerado. Não implemente correções diretamente ali.

## Cloudflare

A implementação alternativa Worker + D1 está em `../nexus-cf/`. Ela só deve ser considerada produção após:

1. configurar o `database_id` real do D1;
2. aplicar schema/migrations;
3. configurar secrets e origens;
4. executar smoke tests de autenticação e fluxos críticos;
5. formalizar o cutover e retirar o runtime anterior.

Até lá, não mantenha dois backends como fontes de verdade concorrentes.
