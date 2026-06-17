# ERP Fraser Alexander – Sistema de Gestão Integrado

## Visão Geral
Sistema ERP completo para a Fraser Alexander, cobrindo o ciclo completo de suprimentos: **OS → Aprovação → RC → RFQ → Mapa Comparativo → Pedido de Compra**.

---

## 🟢 Funcionalidades Implementadas

### Módulos Principais
| Módulo | Status | Descrição |
|--------|--------|-----------|
| **Fluxo Aprovação (OS→RC→RFQ→Mapa→PC)** | ✅ Completo | Ciclo completo de compras |
| **Pedidos de Compra** | ✅ v3.0 | Lista, edição, envio ao fornecedor, cancelamento |
| **Admin / Usuários** | ✅ Completo | Gestão de perfis e permissões granulares |
| **Fornecedores** | ✅ Com D1 | CRUD + avaliações + score |
| **OS – Ordens de Serviço** | ✅ | Criação, aprovação multi-estágio |
| **RC – Requisição de Compra** | ✅ | Emissão, itens, aprovação |
| **RFQ – Cotações** | ✅ | Criação, envio, recebimento de propostas |
| **Mapa Comparativo** | ✅ | Comparação de fornecedores, aprovação |
| **Dashboard** | ✅ | KPIs em tempo real do D1 |
| **Financeiro / Contas a Pagar** | ✅ | Criado automaticamente ao emitir PC |

### Aba Pedidos de Compra v3.0
- **Pipeline visual** com contadores por status (Emitido, Aguardando Envio, Enviado, Entregue, Cancelado)
- **KPI cards**: total de pedidos, pendentes de envio, concluídos, volume financeiro
- **Tabela expandível**: clique na linha para ver detalhes inline (pipeline, itens, histórico)
- **Alertas de prazo**: pedidos vencidos aparecem com borda vermelha + badge "VENCIDO"
- **Alertas no topo**: aviso de pedidos vencidos e pedidos enviados sem confirmação de entrega
- **Cancelamento com motivo**: seleção de motivo + campo livre, registro em histórico
- **Modal "Ver Pedido"** enriquecido: badges de status, envio, pagamento; grid de info; histórico completo
- **Envio ao fornecedor**: email/PDF/ambos, imediato ou agendado
- **Registro de entrega**: data, recebedor, observações, status final
- **Edição completa**: itens, valores, datas, condições

---

## 🏗️ Arquitetura

### Stack Tecnológico
- **Frontend**: HTML/CSS/JS puro (SPA multi-módulo) + Tailwind CSS CDN + FontAwesome
- **Backend**: Hono (TypeScript) compilado como Cloudflare Worker
- **Banco de dados**: Cloudflare D1 (SQLite distribuído globalmente)
- **Hospedagem**: Cloudflare Pages
- **Build**: Vite + @hono/vite-cloudflare-pages

### Estrutura do Projeto
```
webapp/
├── src/
│   └── index.tsx          # Backend Hono – 47 endpoints REST
├── public/
│   ├── index.html         # SPA principal
│   ├── js/
│   │   ├── db.js          # Cliente D1 (API/localStorage híbrido)
│   │   ├── app.js         # Core da aplicação
│   │   ├── permissoes.js  # Sistema de permissões
│   │   └── pages/
│   │       ├── fluxo_aprovacao_rc.js  # Fluxo OS→PC (~5800 linhas)
│   │       ├── admin.js               # Admin/usuários (~1500 linhas)
│   │       └── ...                    # 20+ módulos
│   └── _routes.json       # Worker só processa /api/*
├── migrations/
│   ├── 0001_schema_inicial.sql  # Schema completo (20+ tabelas)
│   └── 0002_seed_inicial.sql    # Dados iniciais
├── dist/                  # Build output (Cloudflare Pages)
├── ecosystem.config.cjs   # PM2 (desenvolvimento local)
├── wrangler.jsonc         # Config Cloudflare
├── vite.config.ts         # Build config
└── deploy.sh              # Script de deploy produção
```

---

## 🗄️ Modelo de Dados (D1)

### Tabelas Principais
| Tabela | Descrição |
|--------|-----------|
| `usuarios` | Usuários do sistema (perfis: admin, compras, diretor, supervisor, operacao, financeiro) |
| `sessoes` | Tokens de sessão com expiração (8h) |
| `permissoes_usuario` | Permissões granulares por usuário/módulo/ação |
| `fornecedores` | Cadastro de fornecedores com score médio |
| `avaliacoes_fornecedor` | Avaliações por critério (qualidade, prazo, preço, atendimento) |
| `ordens_servico` | OS com fluxo de aprovação multi-estágio |
| `fluxo_aprovacao` | Estágios de aprovação de cada OS |
| `requisicoes_compra` | RC com itens e valores |
| `rfq` | Request for Quotation com fornecedores convidados |
| `cotacoes` | Propostas recebidas por fornecedor/RFQ |
| `mapas_comparativos` | Análise comparativa de cotações |
| `pedidos_compra` | PC com status completo do ciclo |
| `pc_itens` | Itens do pedido de compra |
| `pc_historico` | Log de ações no pedido |
| `pc_envio_log` | Registro de envios ao fornecedor |
| `contas_pagar` | Geradas automaticamente ao emitir PC |
| `logs_sistema` | Auditoria de todas as ações |
| `config_aprovacao` | Configuração dos estágios de aprovação |

---

## 🔌 API REST (47 endpoints)

### Auth
- `POST /api/auth/login` – Login com email/senha
- `POST /api/auth/logout` – Logout
- `GET /api/auth/me` – Dados do usuário logado

### Fornecedores
- `GET /api/fornecedores?q=busca&ativo=1` – Lista com score
- `GET /api/fornecedores/:id` – Detalhes + avaliações
- `POST /api/fornecedores` – Criar
- `PUT /api/fornecedores/:id` – Atualizar
- `POST /api/fornecedores/:id/avaliacoes` – Avaliar

### Fluxo Completo
- `GET /api/os`, `POST /api/os`, `PUT /api/os/:id`
- `POST /api/os/:id/iniciar-fluxo`
- `GET /api/fluxo`, `POST /api/fluxo/:id/aprovar`, `POST /api/fluxo/:id/reprovar`
- `GET /api/rc`, `POST /api/rc`, `PUT /api/rc/:id`
- `GET /api/rfq`, `POST /api/rfq`, `PUT /api/rfq/:id`
- `POST /api/rfq/:id/cotacoes`
- `GET /api/mapas`, `POST /api/mapas`, `POST /api/mapas/:id/aprovar`, `POST /api/mapas/:id/reprovar`

### Pedidos de Compra
- `GET /api/pedidos?status=Emitido&fornecedor_id=x`
- `GET /api/pedidos/:id` – Detalhes com itens e histórico
- `POST /api/pedidos` – Emitir pedido
- `PUT /api/pedidos/:id` – Editar pedido
- `POST /api/pedidos/:id/envio` – Registrar envio
- `POST /api/pedidos/:id/entrega` – Registrar entrega
- `POST /api/pedidos/:id/cancelar` – Cancelar com motivo

### Utilitários
- `GET /api/dashboard` – KPIs consolidados
- `GET /api/logs`, `POST /api/logs`
- `GET/PUT /api/config/aprovacao`
- `GET/POST/PUT /api/usuarios`

---

## 👥 Usuários Padrão (seed)

| Email | Perfil | Senha Padrão |
|-------|--------|--------------|
| admin@fraseralexander.com.br | admin | Fraser@2025 |
| compras@fraseralexander.com.br | compras | Fraser@2025 |
| diretor@fraseralexander.com.br | diretor | Fraser@2025 |
| operacao@fraseralexander.com.br | operacao | Fraser@2025 |
| financeiro@fraseralexander.com.br | financeiro | Fraser@2025 |
| supervisor@fraseralexander.com.br | supervisor | Fraser@2025 |

> ⚠️ Altere as senhas em produção!

---

## 🚀 Desenvolvimento Local

```bash
# 1. Instalar dependências
npm install

# 2. Aplicar migrations D1 local
npx wrangler d1 migrations apply erp-fraser-production --local

# 3. Build
npm run build
cp public/_routes.json dist/_routes.json

# 4. Iniciar servidor (com D1 local)
pm2 start ecosystem.config.cjs

# 5. Acessar
open http://localhost:3000
```

---

## 🌐 Deploy em Produção

### Pré-requisitos
- Conta Cloudflare com API token configurado
- `CLOUDFLARE_API_TOKEN` no ambiente

```bash
# Deploy completo (cria D1 + aplica migrations + deploy Pages)
./deploy.sh

# Ou manualmente:
npm run build
cp public/_routes.json dist/_routes.json
npx wrangler pages deploy dist --project-name erp-fraser
```

### URLs de Produção
- **App**: https://erp-fraser.pages.dev
- **API**: https://erp-fraser.pages.dev/api/

---

## 📋 Próximas Melhorias Sugeridas

1. **Autenticação robusta**: bcrypt para senha + JWT com refresh token
2. **Módulo de Cotações**: interface para fornecedor responder RFQ via link público
3. **Notificações**: webhook/email para aprovações pendentes
4. **Relatórios**: exportação Excel + PDF de relatórios gerenciais
5. **App mobile**: PWA para aprovações rápidas no celular
6. **Integração CNPJ**: busca automática de dados do fornecedor

---

**Última atualização**: 2026-03-28  
**Stack**: Hono + Cloudflare D1 + Pages + Vite  
**Status**: ✅ D1 online – Desenvolvimento local funcional
