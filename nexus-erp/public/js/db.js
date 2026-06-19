/**
 * db.js – Camada de acesso a dados do ERP Fraser Alexander
 * ─────────────────────────────────────────────────────────
 * Estratégia Híbrida:
 *   • Tenta sempre a API REST (/api/...) primeiro
 *   • Se a API falhar (offline / sem D1), cai para localStorage como fallback
 *   • Mantém compatibilidade total com o código legado
 *
 * Uso:
 *   const pedidos = await DB.pedidos.listar()
 *   const pc      = await DB.pedidos.buscar(id)
 *   await DB.pedidos.criar(dados)
 *   await DB.pedidos.atualizar(id, dados)
 */

// ─── CONFIG ─────────────────────────────────────────────────
const DB_CONFIG = {
  baseUrl: '', // mesmo origin
  timeout: 8000,
  useApiIfAvailable: true,
  // Chaves de fallback localStorage
  keys: {
    pedidos:       'fa_pedidos',
    rc:            'fa_rcs',
    rfq:           'fa_rfq_flow',
    mapas:         'fa_mapas_comp',
    os:            'fa_ordens_servico',
    fluxo:         'fa_fluxo_os',
    fornecedores:  'fa_fornecedores_cache',
    logs:          'fa_logs_sistema',
    config:        'fa_aprovacao_config',
  }
};

// ─── TOKEN DE SESSÃO ─────────────────────────────────────────
const _getToken = () => sessionStorage.getItem('fa_token') || localStorage.getItem('fa_token') || '';
const _setToken = (t) => { sessionStorage.setItem('fa_token', t); localStorage.setItem('fa_token', t); };

// ─── FETCH BASE ──────────────────────────────────────────────
async function _apiFetch(path, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DB_CONFIG.timeout);
  try {
    const res = await fetch(DB_CONFIG.baseUrl + path, {
      ...opts,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${_getToken()}`,
        ...(opts.headers || {})
      }
    });
    clearTimeout(timer);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json.data;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ─── MODO SERVIDOR (server-authoritative) ───────────────────
// Quando window.NEXUS_SERVER_MODE === true, o CAMINHO DO DINHEIRO
// (aprovar mapa → emitir PC → pagar conta) é autoritativo no servidor:
// erros (inclusive o 409 do gate de pagamento) PROPAGAM e NÃO há fallback
// para localStorage — porque cair no localStorage forjaria o resultado.
const _serverMode = () => window.NEXUS_SERVER_MODE === true;

// Executa uma ação do caminho do dinheiro. Em server mode, propaga o erro.
// Fora dele (legado/demo), usa o fallback informado.
async function _moneyAction(apiCall, legacyFallback) {
  if (_serverMode()) return await apiCall();
  try { return await apiCall(); }
  catch (e) {
    if (typeof legacyFallback === 'function') return legacyFallback(e);
    throw e;
  }
}

// ─── STORAGE LOCAL (fallback) ─────────────────────────────────
function _lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function _lsSet(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {}
}
function _lsGetObj(key, def = {}) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); } catch { return def; }
}

// ─── API STATUS ───────────────────────────────────────────────
let _apiOk = null; // null = não testado, true/false
async function _checkApi() {
  if (_apiOk !== null) return _apiOk;
  try {
    const r = await fetch('/api/dashboard', { signal: AbortSignal.timeout(3000) });
    _apiOk = r.ok;
  } catch { _apiOk = false; }
  return _apiOk;
}

// ─── SINCRONIZADOR: migra localStorage → D1 ──────────────────
async function _migrarLocalParaDB(entidade, dados) {
  if (!dados || !dados.length) return;
  console.info(`[DB] Sincronizando ${dados.length} ${entidade} do localStorage para D1...`);
  // Apenas registra, não força migração automática em produção
}

// ════════════════════════════════════════════════════════════
// MÓDULO: AUTH
// ════════════════════════════════════════════════════════════
const Auth = {
  async login(email, senha) {
    try {
      const data = await _apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, senha })
      });
      if (data?.token) {
        _setToken(data.token);
        if (data.user) localStorage.setItem('fa_current_user', JSON.stringify(data.user));
      }
      return data;
    } catch (e) {
      // -- Login OFFLINE so para DEMONSTRACAO (secure-by-default) ------------
      // So funciona com window.NEXUS_DEMO_MODE === true (padrao: DESLIGADO).
      // Em producao (flag off) o login depende SO do servidor e falha de
      // forma honesta se ele estiver fora. Removida a senha-mestra universal.
      if (window.NEXUS_DEMO_MODE !== true) throw e;
      const users = _lsGet('fa_usuarios');
      const u = users.find(u => u.email === email || u.username === email);
      const DEMO_PASS = 'Fraser@2025'; // conveniencia da demo; NUNCA em producao
      if (u && (u.senha === senha || senha === DEMO_PASS)) {
        return { token: 'demo-' + (u.id || u.email), user: u, _demo: true };
      }
      throw e;
    }
  },
  async logout() {
    try { await _apiFetch('/api/auth/logout', { method: 'POST' }); } catch {}
    _setToken('');
    sessionStorage.removeItem('fa_token');
  },
  async me() {
    try { return await _apiFetch('/api/auth/me'); } catch {
      const u = localStorage.getItem('fa_current_user');
      return u ? JSON.parse(u) : null;
    }
  }
};

// ════════════════════════════════════════════════════════════
// FÁBRICA DE CRUD GENÉRICO
// ════════════════════════════════════════════════════════════
function _makeCrud(apiPath, lsKey, idField = 'id') {
  return {
    async listar(params = {}) {
      const q = new URLSearchParams(params).toString();
      const url = q ? `${apiPath}?${q}` : apiPath;
      try {
        const data = await _apiFetch(url);
        // Salva cache local
        if (Array.isArray(data)) _lsSet(lsKey, data);
        return data;
      } catch(e) {
        console.warn(`[DB] API indisponível para ${apiPath}, usando localStorage:`, e.message);
        return _lsGet(lsKey);
      }
    },
    async buscar(id) {
      try {
        return await _apiFetch(`${apiPath}/${id}`);
      } catch {
        const lista = _lsGet(lsKey);
        return lista.find(x => x[idField] === id) || null;
      }
    },
    async criar(dados) {
      try {
        const result = await _apiFetch(apiPath, { method: 'POST', body: JSON.stringify(dados) });
        // Invalida cache local
        try { localStorage.removeItem(lsKey); } catch {}
        return result;
      } catch(e) {
        // Fallback: salva no localStorage com ID gerado localmente
        console.warn(`[DB] Fallback localStorage para criar em ${apiPath}`);
        const lista = _lsGet(lsKey);
        const novoId = dados[idField] || `${idField}-local-${Date.now()}`;
        const novo = { ...dados, [idField]: novoId, _local: true };
        lista.unshift(novo);
        _lsSet(lsKey, lista);
        return { id: novoId, _local: true };
      }
    },
    async atualizar(id, dados) {
      try {
        const result = await _apiFetch(`${apiPath}/${id}`, { method: 'PUT', body: JSON.stringify(dados) });
        try { localStorage.removeItem(lsKey); } catch {}
        return result;
      } catch(e) {
        const lista = _lsGet(lsKey);
        const idx = lista.findIndex(x => x[idField] === id);
        if (idx >= 0) { lista[idx] = { ...lista[idx], ...dados }; _lsSet(lsKey, lista); }
        return { id, _local: true };
      }
    },
    async deletar(id) {
      try {
        return await _apiFetch(`${apiPath}/${id}`, { method: 'DELETE' });
      } catch {
        const lista = _lsGet(lsKey).filter(x => x[idField] !== id);
        _lsSet(lsKey, lista);
        return { id, _local: true };
      }
    }
  };
}

// ════════════════════════════════════════════════════════════
// MÓDULOS ESPECÍFICOS
// ════════════════════════════════════════════════════════════

// ─── FORNECEDORES ─────────────────────────────────────────────
const Fornecedores = {
  ..._makeCrud('/api/fornecedores', DB_CONFIG.keys.fornecedores),
  async avaliar(id, dados) {
    try { return await _apiFetch(`/api/fornecedores/${id}/avaliacoes`, { method: 'POST', body: JSON.stringify(dados) }); }
    catch(e) { console.warn('[DB] Erro ao avaliar fornecedor:', e.message); throw e; }
  },
  // Cache em memória para autocompletar
  _cache: null,
  async listarNomes() {
    if (this._cache) return this._cache;
    try {
      const lista = await this.listar({ ativo: '1' });
      this._cache = lista.map(f => ({ id: f.id, nome: f.nome, email: f.email, score: f.score_medio }));
      setTimeout(() => { this._cache = null; }, 5 * 60 * 1000); // cache 5min
      return this._cache;
    } catch { return []; }
  }
};

// ─── ORDENS DE SERVIÇO ────────────────────────────────────────
const OS = {
  ..._makeCrud('/api/os', DB_CONFIG.keys.os),
  async iniciarFluxo(osId) {
    try { return await _apiFetch(`/api/os/${osId}/iniciar-fluxo`, { method: 'POST' }); }
    catch(e) { throw e; }
  }
};

// ─── FLUXO DE APROVAÇÃO ───────────────────────────────────────
const FluxoAprovacao = {
  async listar(params = {}) {
    const q = new URLSearchParams(params).toString();
    try {
      const data = await _apiFetch(`/api/fluxo${q?'?'+q:''}`);
      _lsSet(DB_CONFIG.keys.fluxo, data);
      return data;
    } catch { return _lsGet(DB_CONFIG.keys.fluxo); }
  },
  async aprovar(fluxoId, dados) {
    try { return await _apiFetch(`/api/fluxo/${fluxoId}/aprovar`, { method: 'POST', body: JSON.stringify(dados) }); }
    catch(e) {
      // Fallback localStorage
      const lista = _lsGet(DB_CONFIG.keys.fluxo);
      const idx = lista.findIndex(x => x.id === fluxoId);
      if (idx >= 0) {
        const estagioAtual = lista[idx].estagio_atual || 1;
        const estagios = lista[idx].estagios || [];
        const eIdx = estagios.findIndex(e => e.estagio === estagioAtual);
        if (eIdx >= 0) { estagios[eIdx].status = 'Aprovado'; estagios[eIdx].aprovador = dados.aprovador; estagios[eIdx].data = new Date().toLocaleString('pt-BR'); }
        const proximo = estagios.find(e => e.estagio === estagioAtual + 1);
        if (proximo) { lista[idx].estagio_atual = estagioAtual + 1; }
        else { lista[idx].status = 'Aprovado'; }
        _lsSet(DB_CONFIG.keys.fluxo, lista);
      }
      return { aprovado: true, _local: true };
    }
  },
  async reprovar(fluxoId, dados) {
    try { return await _apiFetch(`/api/fluxo/${fluxoId}/reprovar`, { method: 'POST', body: JSON.stringify(dados) }); }
    catch(e) {
      const lista = _lsGet(DB_CONFIG.keys.fluxo);
      const idx = lista.findIndex(x => x.id === fluxoId);
      if (idx >= 0) { lista[idx].status = 'Reprovado'; _lsSet(DB_CONFIG.keys.fluxo, lista); }
      return { reprovado: true, _local: true };
    }
  }
};

// ─── REQUISIÇÕES DE COMPRA ────────────────────────────────────
const RC = {
  ..._makeCrud('/api/rc', DB_CONFIG.keys.rc),
};

// ─── RFQ ──────────────────────────────────────────────────────
const RFQ = {
  ..._makeCrud('/api/rfq', DB_CONFIG.keys.rfq),
  async adicionarCotacao(rfqId, dados) {
    try { return await _apiFetch(`/api/rfq/${rfqId}/cotacoes`, { method: 'POST', body: JSON.stringify(dados) }); }
    catch(e) {
      // Fallback localStorage
      const lista = _lsGet(DB_CONFIG.keys.rfq);
      const idx = lista.findIndex(x => x.id === rfqId);
      if (idx >= 0) {
        lista[idx].cotacoes = lista[idx].cotacoes || [];
        lista[idx].cotacoes.push({ id: `cot-local-${Date.now()}`, ...dados });
        _lsSet(DB_CONFIG.keys.rfq, lista);
      }
      return { id: `cot-local-${Date.now()}`, _local: true };
    }
  }
};

// ─── MAPAS COMPARATIVOS ───────────────────────────────────────
const Mapas = {
  ..._makeCrud('/api/mapas', DB_CONFIG.keys.mapas),
  async aprovar(mapaId, dados) {
    // Server-authoritative sob NEXUS_SERVER_MODE: o servidor recheca papel,
    // alçada por estágio e no-double-approval. Sem fallback que forje o status.
    return _moneyAction(
      () => _apiFetch(`/api/mapas/${mapaId}/aprovar`, { method: 'POST', body: JSON.stringify(dados) }),
      () => {
        const lista = _lsGet(DB_CONFIG.keys.mapas);
        const idx = lista.findIndex(x => x.id === mapaId);
        if (idx >= 0) { lista[idx].status = 'Aprovado'; lista[idx].aprovado_por = dados.aprovador; lista[idx].aprovado_em = new Date().toISOString(); _lsSet(DB_CONFIG.keys.mapas, lista); }
        return { aprovado: true, _local: true };
      }
    );
  },
  async reprovar(mapaId, dados) {
    return _moneyAction(
      () => _apiFetch(`/api/mapas/${mapaId}/reprovar`, { method: 'POST', body: JSON.stringify(dados) }),
      () => {
        const lista = _lsGet(DB_CONFIG.keys.mapas);
        const idx = lista.findIndex(x => x.id === mapaId);
        if (idx >= 0) { lista[idx].status = 'Reprovado'; lista[idx].motivo_reprovacao = dados.motivo; _lsSet(DB_CONFIG.keys.mapas, lista); }
        return { reprovado: true, _local: true };
      }
    );
  },
  // Emissão de PC: ação de servidor (trava de status "Aprovado" no Worker).
  // Sem equivalente local seguro — sempre vai à API e propaga erros.
  async emitirPC(mapaId, dados = {}) {
    return await _apiFetch(`/api/mapas/${mapaId}/emitir-pc`, { method: 'POST', body: JSON.stringify(dados) });
  }
};

// ─── PEDIDOS DE COMPRA ────────────────────────────────────────
const Pedidos = {
  ..._makeCrud('/api/pedidos', DB_CONFIG.keys.pedidos),
  async registrarEnvio(pedidoId, dados) {
    try { return await _apiFetch(`/api/pedidos/${pedidoId}/envio`, { method: 'POST', body: JSON.stringify(dados) }); }
    catch(e) { return _updateLocal(DB_CONFIG.keys.pedidos, pedidoId, { status: dados.agendado ? 'Aguardando Envio' : 'Enviado ao Fornecedor', envio_canal: dados.canal, envio_email: dados.email, _local: true }); }
  },
  async registrarEntrega(pedidoId, dados) {
    try { return await _apiFetch(`/api/pedidos/${pedidoId}/entrega`, { method: 'POST', body: JSON.stringify(dados) }); }
    catch(e) { return _updateLocal(DB_CONFIG.keys.pedidos, pedidoId, { status: dados.status || 'Entregue', data_entrega: dados.data_entrega, _local: true }); }
  },
  async cancelar(pedidoId, dados) {
    try { return await _apiFetch(`/api/pedidos/${pedidoId}/cancelar`, { method: 'POST', body: JSON.stringify(dados) }); }
    catch(e) { return _updateLocal(DB_CONFIG.keys.pedidos, pedidoId, { status: 'Cancelado', motivo_cancelamento: dados.motivo, _local: true }); }
  }
};

function _updateLocal(lsKey, id, changes) {
  const lista = _lsGet(lsKey);
  const idx = lista.findIndex(x => x.id === id);
  if (idx >= 0) { lista[idx] = { ...lista[idx], ...changes }; _lsSet(lsKey, lista); }
  return { id, _local: true };
}

// ─── CONTAS A PAGAR (com GATE de pagamento) ──────────────────
const Contas = {
  ..._makeCrud('/api/contas-pagar', 'fa_contas_pagar'),
  // GATE: "nada paga sem lastro". SEMPRE no servidor (NF + origem + 3-way +
  // segregação). Nunca cai para localStorage — pagar localmente dribraria o
  // controle. Em bloqueio, o servidor responde 409 e o erro propaga com o motivo.
  async pagar(contaId, dados = {}) {
    return await _apiFetch(`/api/contas-pagar/${contaId}/pagar`, { method: 'POST', body: JSON.stringify(dados) });
  }
};

// ─── LOGS ─────────────────────────────────────────────────────
const Logs = {
  async registrar(acao, modulo, descricao) {
    const entrada = {
      id: `log-${Date.now()}`, acao, modulo, descricao,
      usuario_nome: (_getCurrentUser()?.name || _getCurrentUser()?.nome || '—'),
      criado_em: new Date().toISOString(),
      sincronizado: false
    };
    try {
      await _apiFetch('/api/logs', { method: 'POST', body: JSON.stringify({ acao, modulo, descricao }) });
      entrada.sincronizado = true;
    } catch (e) {
      // Nao trava a acao do usuario, mas TAMBEM nao some: marca pendente e avisa.
      console.warn('[DB] Log nao sincronizado (mantido local como pendente):', e.message);
    }
    const logs = _lsGet(DB_CONFIG.keys.logs);
    logs.unshift(entrada);
    _lsSet(DB_CONFIG.keys.logs, logs.slice(0, 2000)); // cap maior (antes 500)
  },
  async listar(modulo = '', limit = 100) {
    try { return await _apiFetch(`/api/logs?${new URLSearchParams({ modulo, limit: String(limit) })}`); }
    catch { return _lsGet(DB_CONFIG.keys.logs).slice(0, limit); }
  }
};

// ─── USUÁRIOS ─────────────────────────────────────────────────
const Usuarios = {
  ..._makeCrud('/api/usuarios', 'fa_usuarios'),
  async getPermissoes(userId) {
    try { return await _apiFetch(`/api/usuarios/${userId}/permissoes`); }
    catch { return _lsGet(`fa_perm_${userId}`); }
  },
  async setPermissoes(userId, permissoes) {
    try { return await _apiFetch(`/api/usuarios/${userId}/permissoes`, { method: 'PUT', body: JSON.stringify({ permissoes }) }); }
    catch { _lsSet(`fa_perm_${userId}`, permissoes); return { _local: true }; }
  }
};

// ─── CONFIG APROVAÇÃO ─────────────────────────────────────────
const Config = {
  async getAprovacao() {
    try { return await _apiFetch('/api/config/aprovacao'); }
    catch { return _lsGetObj(DB_CONFIG.keys.config, {}); }
  },
  async setAprovacao(dados) {
    try { return await _apiFetch('/api/config/aprovacao', { method: 'PUT', body: JSON.stringify(dados) }); }
    catch { _lsSet(DB_CONFIG.keys.config, dados); return { _local: true }; }
  }
};

// ─── DASHBOARD ────────────────────────────────────────────────
const Dashboard = {
  async kpis() {
    try { return await _apiFetch('/api/dashboard'); }
    catch { return null; }
  }
};

// ─── HELPER: current user ─────────────────────────────────────
function _getCurrentUser() {
  try {
    const u = localStorage.getItem('fa_current_user');
    if (u) return JSON.parse(u);
    // Compatibilidade com formato antigo
    if (typeof currentUser !== 'undefined') return currentUser;
    return null;
  } catch { return null; }
}

// ════════════════════════════════════════════════════════════
// OBJETO GLOBAL DB
// ════════════════════════════════════════════════════════════
window.DB = {
  auth:       Auth,
  fornecedores: Fornecedores,
  os:         OS,
  fluxo:      FluxoAprovacao,
  rc:         RC,
  rfq:        RFQ,
  mapas:      Mapas,
  pedidos:    Pedidos,
  contas:     Contas,
  logs:       Logs,
  usuarios:   Usuarios,
  config:     Config,
  dashboard:  Dashboard,

  // Utilitários
  token: { get: _getToken, set: _setToken },
  checkApi: _checkApi,
  isOnline: () => _apiOk !== false,
  // Caminho do dinheiro autoritativo no servidor quando ligado.
  serverMode: { get: _serverMode, set: (v) => { window.NEXUS_SERVER_MODE = v === true; } },

  // Numeração atômica no servidor (sem corrida do length+1). Retorna
  // { numero, valor, tipo, ano } ou null se o servidor estiver indisponível.
  async sequencia(tipo, ano) {
    try { return await _apiFetch('/api/sequencia/' + tipo, { method: 'POST', body: JSON.stringify({ ano: ano || null }) }); }
    catch (e) { return null; }
  },

  // Consulta a bureau de crédito (servidor; mock por padrão). Retorna os dados
  // normalizados ou null se indisponível.
  async consultarCredito(cnpj) {
    try { return await _apiFetch('/api/credito/consultar', { method: 'POST', body: JSON.stringify({ cnpj }) }); }
    catch (e) { return null; }
  },

  async consultarReceita(cnpj) {
    try { return await _apiFetch('/api/receita/consultar', { method: 'POST', body: JSON.stringify({ cnpj }) }); }
    catch (e) { return null; }
  },

  async homologarFornecedor(id, etapa) {
    return await _apiFetch(`/api/fornecedores/${id}/homologar/${etapa}`, { method: 'POST', body: '{}' });
  },
  async reprovarHomologacao(id, motivo) {
    return await _apiFetch(`/api/fornecedores/${id}/reprovar-homologacao`, { method: 'POST', body: JSON.stringify({ motivo: motivo || '' }) });
  },

  // Compatibilidade com código legado que usa logAction()
  log: (acao, modulo, desc) => Logs.registrar(acao, modulo, desc),
};

// ════════════════════════════════════════════════════════════
// BRIDGE PARA FUNÇÕES LEGADAS (localStorage → API D1)
// Mantém compatibilidade total com o código existente.
// As funções _get* retornam do localStorage (cache local).
// As funções _save* salvam no localStorage E disparam sync assíncrona para o D1.
// ════════════════════════════════════════════════════════════

// ── Fila de sync para evitar condições de corrida ────────────
const _syncQueue = {};
function _queueSync(key, fn) {
  if (_syncQueue[key]) return; // Já tem sync pendente
  _syncQueue[key] = setTimeout(() => {
    delete _syncQueue[key];
    fn().catch(e => console.warn('[DB] Sync erro:', e.message));
  }, 300); // Debounce 300ms
}

// ── Sync bidirecional: salva localmente + sincroniza com D1 ──
async function _syncEntityToD1(apiPath, lsKey, data) {
  if (!_apiOk) return; // Não tenta se API offline
  // data é array; faz upsert de cada item modificado
  // Por ora envia o array completo (otimização futura: delta)
  try {
    await _apiFetch(`${apiPath}/sync`, {
      method: 'POST',
      body: JSON.stringify({ data })
    });
  } catch(e) {
    console.debug(`[DB] Sync ${apiPath} adiada (será tentada na próxima sessão):`, e.message);
  }
}

// ─── PEDIDOS ──────────────────────────────────────────────────
window._getPedidos = () => _lsGet(DB_CONFIG.keys.pedidos);
window._savePedidos = (d) => {
  _lsSet(DB_CONFIG.keys.pedidos, d);
  // Sem sync imediato – operações de pedidos são feitas via DB.pedidos.*
};
window._getPedidosAsync = async () => {
  try {
    const data = await _apiFetch('/api/pedidos');
    if (Array.isArray(data)) _lsSet(DB_CONFIG.keys.pedidos, data);
    return data;
  } catch { return _lsGet(DB_CONFIG.keys.pedidos); }
};

// ─── RC ───────────────────────────────────────────────────────
window._getRC = () => _lsGet(DB_CONFIG.keys.rc);
window._saveRC = (d) => {
  _lsSet(DB_CONFIG.keys.rc, d);
  _queueSync('rc', () => _syncEntityToD1('/api/rc', DB_CONFIG.keys.rc, d));
};

// ─── RFQ ──────────────────────────────────────────────────────
window._getRFQFlow = () => _lsGet(DB_CONFIG.keys.rfq);
window._saveRFQFlow = (d) => {
  _lsSet(DB_CONFIG.keys.rfq, d);
  _queueSync('rfq', () => _syncEntityToD1('/api/rfq', DB_CONFIG.keys.rfq, d));
};

// ─── MAPAS COMPARATIVOS ───────────────────────────────────────
window._getMapasComp = () => _lsGet(DB_CONFIG.keys.mapas);
window._saveMapasComp = (d) => {
  _lsSet(DB_CONFIG.keys.mapas, d);
  _queueSync('mapas', () => _syncEntityToD1('/api/mapas', DB_CONFIG.keys.mapas, d));
};

// ─── FLUXO OS ─────────────────────────────────────────────────
window._getFluxoOS = () => _lsGet(DB_CONFIG.keys.fluxo);
window._saveFluxoOS = (d) => {
  _lsSet(DB_CONFIG.keys.fluxo, d);
};
window._getFluxo = window._getFluxoOS;
window._saveFluxo = window._saveFluxoOS;

// ─── FORNECEDORES ─────────────────────────────────────────────
window._getFornecedores = () => _lsGet(DB_CONFIG.keys.fornecedores);
window._saveFornecedores = (d) => _lsSet(DB_CONFIG.keys.fornecedores, d);

// ─── FUNÇÃO PÚBLICA PARA BUSCAR FORNECEDORES COM NOME ────────
window._getFornecedoresComNome = async () => {
  try {
    const data = await _apiFetch('/api/fornecedores?ativo=1');
    if (Array.isArray(data)) {
      _lsSet(DB_CONFIG.keys.fornecedores, data);
      return data;
    }
  } catch {}
  return _lsGet(DB_CONFIG.keys.fornecedores);
};

// ─── logAction GLOBAL ─────────────────────────────────────────
window.logAction = (acao, modulo, desc) => {
  DB.logs.registrar(acao, modulo || 'geral', desc);
};

// ─── INICIALIZAÇÃO: carrega dados do D1 para cache local ──────
window.DB._init = async function() {
  const apiDisponivel = await _checkApi();
  console.info(`[DB] API disponível: ${apiDisponivel ? '✅ D1 online' : '⚠️ offline (localStorage)'}`);

  if (!apiDisponivel) {
    console.warn('[DB] Operando em modo offline. Dados do localStorage serão usados.');
    return;
  }

  // Pré-carrega fornecedores no cache (muito usado em RFQ e Mapas)
  try {
    const forn = await _apiFetch('/api/fornecedores?ativo=1');
    if (Array.isArray(forn)) {
      // Normaliza para o formato esperado pelo código legado:
      // O código legado usa f.status === 'Ativo' || f.status === 'Homologado'
      // O D1 usa f.ativo === 1
      const fornNorm = forn.map(f => ({
        ...f,
        status: f.ativo === 1 ? 'Ativo' : 'Inativo',
        // Garante campos de email/telefone presentes
        email: f.email || '',
        telefone: f.telefone || '',
        contato_nome: f.contato_nome || '',
        score: f.score_medio || 0,
      }));
      _lsSet(DB_CONFIG.keys.fornecedores, fornNorm);
      console.info(`[DB] ${forn.length} fornecedores carregados do D1`);
    }
  } catch(e) {
    console.warn('[DB] Não foi possível carregar fornecedores:', e.message);
  }

  // Pré-carrega pedidos de compra
  try {
    const pedidos = await _apiFetch('/api/pedidos?limit=200');
    if (Array.isArray(pedidos)) {
      _lsSet(DB_CONFIG.keys.pedidos, pedidos);
      console.info(`[DB] ${pedidos.length} pedidos carregados do D1`);
    }
  } catch {}

  // Verifica sessão de usuário
  try {
    const me = await _apiFetch('/api/auth/me');
    if (me) {
      localStorage.setItem('fa_current_user', JSON.stringify(me));
    }
  } catch {}

  // Dispara evento para notificar módulos que o DB está pronto
  window.dispatchEvent(new CustomEvent('db:ready', { detail: { online: true } }));
};

// ─── LIMPEZA DE DADOS FICTÍCIOS DO localStorage ───────────────
// Remove qualquer dado fictício/demo que possa ter ficado em cache.
// Executa na primeira vez após a atualização do sistema.
window.DB._limparDemoData = function() {
  const VERSAO_CLEAN = 'v3.3-fiscal';
  const jaLimpo = localStorage.getItem('fa_clean_version');
  if (jaLimpo === VERSAO_CLEAN) return; // Já foi limpo nesta versão

  // ── Preserva dados criados pelo usuário (não são da seed) ──────────────
  // IDs da seed para cada tipo de dado
  const _seedMatrizIds = new Set(['MAP-001','MAP-002','MAP-003','MAP-004','MAP-005',
    'MAPA-006-001','MAPA-006-002','MAPA-006-003','MAPA-2025-0001','MAPA-2025-0002','MAPA-2025-0003']);
  const _seedPedidoIds = new Set(['PED-2025-001','PED-2025-002','PED-2025-003',
    'PED-2025-004','PED-2025-005','PED-2025-006','PED-006-001','PED-006-002','PED-006-003']);
  const _seedRfqIds = new Set(['RFQ-2025-001','RFQ-2025-002','RFQ-2025-003',
    'RFQ-2025-004','RFQ-2025-005','RFQ-2025-006','RFQ-2025-007',
    'RFQ-006-001','RFQ-006-002','RFQ-006-003','RFQ-006-004']);
  const _seedRcIds = new Set(['RC-2025-0001','RC-2025-0002','RC-2025-0003',
    'RC-2025-0004','RC-2025-0005','RC-2025-0006','RC-2025-0007']);

  // Função auxiliar para filtrar itens não-seed de uma chave do localStorage
  function _preservarNaoSeed(chave, seedSet) {
    try {
      const arr = JSON.parse(localStorage.getItem(chave) || '[]');
      return arr.filter(item => item && item.id && !seedSet.has(item.id));
    } catch(e) { return []; }
  }

  // Preserva: mapas, pedidos, RFQs e RCs do usuário
  const _mapasSalvos   = _preservarNaoSeed('fa_matrizes',  _seedMatrizIds)
    .concat(_preservarNaoSeed('fa_mapas_comp', _seedMatrizIds))
    .filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i); // deduplica

  const _pedidosSalvos = _preservarNaoSeed('fa_pedidos', _seedPedidoIds);

  const _rfqsSalvos    = _preservarNaoSeed('fa_rfq_flow', _seedRfqIds)
    .concat(_preservarNaoSeed('fa_rfqs', _seedRfqIds))
    .filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i);

  const _rcsSalvos     = _preservarNaoSeed('fa_rcs', _seedRcIds);

  const chaves = [
    // Módulos operacionais
    'fa_pedidos', 'fa_rcs', 'fa_rfq_flow', 'fa_mapas_comp',
    'fa_fluxo_os', 'fa_ordens_servico', 'fa_os_list',
    'fa_fornecedores_cache', 'fa_contas_pagar', 'fa_logs_sistema',
    'fa_usuarios', 'fa_colaboradores', 'fa_equipamentos',
    'fa_contratos', 'fa_materiais', 'fa_matrizes',
    'fa_idf_avaliacoes', 'fa_avaliacoes_forn', 'fa_historico_compras',
    'fa_mov_almox', 'fa_recebimentos', 'fa_requisicoes',
    'fa_aprovacao_config', 'fa_config_perfis_os', 'fa_config_perfis_emissao_rc',
    'fa_mapas_cotacao', 'fa_incidentes', 'fa_medicoes',
    'fa_permissoes_matrix',
    // Almoxarifado v2
    'fa_almox_movimentos', 'fa_estoque_v2', 'fa_emprestimos', 'fa_inventarios',
    // CRM e Suprimentos
    'fa_crm_data', 'fa_contratos_fornecimento',
    // Legado
    'fa_os', 'fa_rc', 'fa_rfq', 'fa_mapas', 'fa_fornecedores'
  ];

  chaves.forEach(k => {
    try { localStorage.removeItem(k); } catch(e) {}
  });

  // ── Restaura dados do usuário preservados no backup ──────────────────────
  const _backup = {
    matrizes: _mapasSalvos,
    pedidos:  _pedidosSalvos,
    rfqs:     _rfqsSalvos,
    rcs:      _rcsSalvos
  };
  const _totalPreservados = _mapasSalvos.length + _pedidosSalvos.length + _rfqsSalvos.length + _rcsSalvos.length;

  if (_totalPreservados > 0) {
    try {
      // Salva backup consolidado
      localStorage.setItem('_fa_user_data_backup', JSON.stringify(_backup));
      // Também restaura imediatamente nas chaves corretas para uso imediato
      if (_mapasSalvos.length   > 0) localStorage.setItem('_fa_user_matrizes_backup', JSON.stringify(_mapasSalvos));
      if (_pedidosSalvos.length > 0) localStorage.setItem('fa_pedidos',   JSON.stringify(_pedidosSalvos));
      if (_rfqsSalvos.length    > 0) localStorage.setItem('fa_rfq_flow',  JSON.stringify(_rfqsSalvos));
      if (_rcsSalvos.length     > 0) localStorage.setItem('fa_rcs',       JSON.stringify(_rcsSalvos));
      console.info('[DB] Preservados pelo usuário: ' + _mapasSalvos.length + ' mapa(s), ' +
        _pedidosSalvos.length + ' pedido(s), ' + _rfqsSalvos.length + ' RFQ(s), ' + _rcsSalvos.length + ' RC(s).');
    } catch(eRest) {}
  }

  // Marcar como limpo para não repetir
  localStorage.setItem('fa_clean_version', VERSAO_CLEAN);
  console.info('[DB] Cache local de dados fictícios limpo ✅ v3.3-fiscal');
};

// Auto-inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.DB._limparDemoData();
    window.DB._init();
  });
} else {
  setTimeout(() => {
    window.DB._limparDemoData();
    window.DB._init();
  }, 200);
}
