/**
 * NEXUS ERP — Backend Cloudflare Worker + D1
 * Responde aos endpoints /api/... que o front-end (js/db.js) ja chama.
 * Auth (PBKDF2 + JWT HS256 via Web Crypto), CRUD generico, acoes especiais,
 * trilha de auditoria e o GATE DE PAGAMENTO server-side.
 */

// ===== Respostas (envelope que o db.js espera: {data} ok / {error} erro) =====
const J = (data, status = 200) => new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } });
const E = (error, status = 400) => new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json' } });

// ===== Base64url / hex =====
function bytesToB64url(b){let s='';for(const x of b)s+=String.fromCharCode(x);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function strToB64url(s){return bytesToB64url(new TextEncoder().encode(s));}
function b64urlToBytes(b){b=b.replace(/-/g,'+').replace(/_/g,'/');const bin=atob(b);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a;}
function b64urlToStr(b){return new TextDecoder().decode(b64urlToBytes(b));}
function bytesToHex(b){return [...b].map(x=>x.toString(16).padStart(2,'0')).join('');}
function hexToBytes(h){const a=new Uint8Array(h.length/2);for(let i=0;i<a.length;i++)a[i]=parseInt(h.substr(i*2,2),16);return a;}

// ===== Senha (PBKDF2-SHA256, 100k iteracoes) =====
async function hashPassword(password, saltHex){
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', salt, iterations:100000, hash:'SHA-256' }, baseKey, 256);
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt) };
}
async function verifyPassword(password, saltHex, hashHex){
  const { hash } = await hashPassword(password, saltHex);
  if (hash.length !== hashHex.length) return false;
  let r = 0; for (let i=0;i<hash.length;i++) r |= hash.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return r === 0;
}

// ===== JWT HS256 =====
async function hmacKey(secret){ return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign','verify']); }
async function signJWT(payload, secret){
  const data = strToB64url(JSON.stringify({alg:'HS256',typ:'JWT'})) + '.' + strToB64url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(data));
  return data + '.' + bytesToB64url(new Uint8Array(sig));
}
async function verifyJWT(token, secret){
  const p = token.split('.'); if (p.length !== 3) throw new Error('token invalido');
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), b64urlToBytes(p[2]), new TextEncoder().encode(p[0]+'.'+p[1]));
  if (!ok) throw new Error('assinatura invalida');
  const payload = JSON.parse(b64urlToStr(p[1]));
  if (payload.exp && Math.floor(Date.now()/1000) > payload.exp) throw new Error('token expirado');
  return payload;
}
function getSecret(env){
  const s = env.JWT_SECRET;
  // Falha fechada: sem segredo configurado, nenhum token é assinado/validado.
  if (!s || s.length < 16) throw { code:500, msg:'JWT_SECRET não configurado (defina via `wrangler secret put JWT_SECRET`)' };
  return s;
}

async function requireAuth(request, env){
  const h = request.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) throw { code:401, msg:'sem token' };
  try { return await verifyJWT(token, getSecret(env)); }
  catch(e){ throw { code:401, msg:'token invalido ou expirado' }; }
}
function requireRole(user, roles){
  if (!roles.includes(user.role)) throw { code:403, msg:'papel sem permissao para esta acao' };
}

// ===== Auditoria (append-only + hash encadeado, tamper-evident) =====
async function sha256hex(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
// Mesmo canônico do motor js/lib/auditoria.js (ator|acao|entity|payload|created_at).
function _canonicalAudit(r){
  return [r.actor_id ?? '', r.action ?? '', r.entity ?? '', r.payload ?? '', r.created_at ?? ''].join('|');
}
async function audit(env, actorId, action, entity, entityId, payloadObj){
  try {
    const created_at = new Date().toISOString();
    const payload = payloadObj ? JSON.stringify(payloadObj) : null;
    const last = await env.DB.prepare('SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1').first();
    const prev = (last && last.hash) ? last.hash : 'GENESIS';
    const hash = await sha256hex(prev + '|' + _canonicalAudit({ actor_id: actorId, action, entity, payload, created_at }));
    await env.DB.prepare('INSERT INTO audit_log (actor_id, action, entity, entity_id, payload, created_at, hash, hash_anterior) VALUES (?,?,?,?,?,?,?,?)')
      .bind(actorId||null, action, entity||null, entityId||null, payload, created_at, hash, prev).run();
  } catch(e){ /* nunca quebra a operacao por causa do log */ }
}
async function verificarAuditoria(env){
  const rs = await env.DB.prepare('SELECT id, actor_id, action, entity, payload, created_at, hash, hash_anterior FROM audit_log ORDER BY id ASC').all();
  // Ignora registros legados sem hash (anteriores à ativação da trilha).
  const rows = (rs.results || []).filter(r => r && r.hash);
  let prev = rows.length ? (rows[0].hash_anterior || 'GENESIS') : 'GENESIS';
  for (const r of rows){
    if ((r.hash_anterior || 'GENESIS') !== prev) return J({ integra:false, total:rows.length, quebraEm:r.id, motivo:'elo quebrado (remoção/reordenação)' });
    const esperado = await sha256hex((r.hash_anterior || 'GENESIS') + '|' + _canonicalAudit(r));
    if (r.hash !== esperado) return J({ integra:false, total:rows.length, quebraEm:r.id, motivo:'conteúdo adulterado' });
    prev = r.hash;
  }
  return J({ integra:true, total:rows.length, quebraEm:null, motivo:'' });
}

// ===== CRUD generico (entidades "documento") =====
const TABLES = {
  fornecedores:'fornecedores', os:'os', rc:'rc', rfq:'rfq', mapas:'mapas', pedidos:'pedidos', fluxo:'fluxo',
  'contas-pagar':'contas_pagar',
  // Absorvidos do Express legado (consolidação onto D1):
  contratos:'contratos', crm:'crm', projetos:'projetos', ssma:'ssma', almoxarifado:'almoxarifado', recebimentos:'recebimentos',
};
const sanitizeKey = (k) => String(k).replace(/[^a-zA-Z0-9_]/g,'');

async function listDocs(env, table, url){
  let sql = `SELECT payload FROM ${table}`;
  const where = []; const binds = []; let limit = null;
  for (const [k,v] of url.searchParams){
    if (k === 'limit'){ limit = parseInt(v) || null; continue; }
    if (k === 'offset') continue;
    const key = sanitizeKey(k); if (!key) continue;
    where.push(`CAST(json_extract(payload,'$.${key}') AS TEXT)=?`); binds.push(String(v));
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY created_at DESC';
  if (limit) sql += ' LIMIT ' + limit;
  const rs = await env.DB.prepare(sql).bind(...binds).all();
  return (rs.results || []).map(r => JSON.parse(r.payload));
}
async function getDoc(env, table, id){
  const r = await env.DB.prepare(`SELECT payload FROM ${table} WHERE id=?`).bind(id).first();
  return r ? JSON.parse(r.payload) : null;
}
async function createDoc(env, table, obj){
  const id = obj.id || crypto.randomUUID();
  const rec = { ...obj, id };
  await env.DB.prepare(`INSERT INTO ${table} (id,payload) VALUES (?,?)
    ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=datetime('now')`)
    .bind(id, JSON.stringify(rec)).run();
  return rec;
}
async function updateDoc(env, table, id, patch){
  const cur = await getDoc(env, table, id);
  if (!cur) return null;
  const rec = { ...cur, ...patch, id };
  await env.DB.prepare(`UPDATE ${table} SET payload=?, updated_at=datetime('now') WHERE id=?`).bind(JSON.stringify(rec), id).run();
  return rec;
}
async function deleteDoc(env, table, id){
  await env.DB.prepare(`DELETE FROM ${table} WHERE id=?`).bind(id).run();
  return { id, deleted:true };
}

// ===== GATE DE PAGAMENTO (a regra critica, no servidor) =====
function gateContaPagar(c, env){
  const motivos = [];
  if (!c) return { ok:false, motivos:['conta inexistente'] };
  if (c.data_pagamento) motivos.push('conta ja paga (duplicidade)');
  if (!['Aprovado','Aprovada','Liberado'].includes(c.status)) motivos.push('nao aprovada no fluxo');
  if ((env.ENFORCE_NF ?? '1') !== '0'){ if (!c.nota_fiscal || c.nota_fiscal === '—') motivos.push('sem nota fiscal'); }
  if ((env.ENFORCE_ORIGIN ?? '1') !== '0'){
    const origem = c.pedido_id || (c.contrato_id && c.contrato_id !== 'Geral' && c.contrato_id !== '—');
    if (!origem) motivos.push('sem pedido ou contrato de origem (lastro)');
  }
  return { ok: motivos.length === 0, motivos };
}
// Conciliação 3-way por item (mesma lógica de js/lib/three_way.js).
function conciliarTresVias(dados, opts){
  const cfg = Object.assign({ tolPreco:0.02, tolQtd:0 }, opts||{});
  const itensNota = dados.itensNota || [];
  if (!itensNota.length) return { conforme:true, divergencias:[], aviso:'sem itens de nota' };
  const num = v => { const n=Number(v); return isFinite(n)?n:0; };
  const chave = it => String(it.codigo||it.codigo_produto||it.sku||it.descricao||it.desc||'').trim().toLowerCase();
  const qtd = it => num(it.qtd!=null?it.qtd:(it.quantidade!=null?it.quantidade:it.quantidade_recebida));
  const preco = it => num(it.preco!=null?it.preco:(it.preco_unit!=null?it.preco_unit:(it.valor_unitario!=null?it.valor_unitario:it.valor_unit)));
  const idx = arr => { const m={}; (arr||[]).forEach(it=>{ const k=chave(it); if(!k)return; if(m[k])m[k].qtd+=qtd(it); else m[k]={qtd:qtd(it),preco:preco(it),desc:it.descricao||it.desc||k}; }); return m; };
  const ped = idx(dados.itensPedido), rec = idx(dados.itensRecebidos);
  const temRec = Array.isArray(dados.itensRecebidos) && dados.itensRecebidos.length>0;
  const divergencias = [];
  itensNota.forEach(itn => {
    const k=chave(itn), qn=qtd(itn), pn=preco(itn), p=ped[k];
    if (!p) { divergencias.push({tipo:'item_sem_pedido', detalhe:'Item faturado sem correspondência no pedido'}); return; }
    if (pn>0 && p.preco>0 && pn > p.preco*(1+cfg.tolPreco)) divergencias.push({tipo:'preco_acima_pedido', detalhe:`Preço ${pn} acima do pedido ${p.preco}`});
    if (qn > p.qtd*(1+cfg.tolQtd)) divergencias.push({tipo:'faturado_acima_pedido', detalhe:`Qtd ${qn} acima do pedido ${p.qtd}`});
    if (temRec){ const r=rec[k]; if(!r) divergencias.push({tipo:'item_nao_recebido', detalhe:'Sem recebimento'}); else if (qn > r.qtd*(1+cfg.tolQtd)) divergencias.push({tipo:'faturado_acima_recebido', detalhe:`Qtd ${qn} acima da recebida ${r.qtd}`}); }
  });
  return { conforme: divergencias.length===0, divergencias };
}
function _parseItens(v){ if (Array.isArray(v)) return v; if (typeof v==='string'){ try { const p=JSON.parse(v); return Array.isArray(p)?p:[]; } catch(e){ return []; } } return []; }
async function pagarConta(env, id, user){
  requireRole(user, ['financeiro','admin']);            // segregacao de funcoes
  const conta = await getDoc(env, 'contas_pagar', id);
  if (!conta) return E('conta nao encontrada', 404);

  const g = gateContaPagar(conta, env);
  if (!g.ok){
    await audit(env, user.sub, 'payment_blocked', 'contas_pagar', id, { motivos: g.motivos });
    return E('Pagamento bloqueado: ' + g.motivos.join('; '), 409);
  }
  // 3-way por item + checagem de total. Se houver itens de nota, confere a nota
  // contra o pedido (e recebimento). Senão, cai para o total (<= pedido +2%).
  if (conta.pedido_id){
    const ped = await getDoc(env, 'pedidos', conta.pedido_id);
    const itensNota = _parseItens(conta.itens_nota);
    if (itensNota.length){
      const r = conciliarTresVias({
        itensPedido: _parseItens(ped && ped.itens),
        itensRecebidos: _parseItens(conta.itens_recebidos),
        itensNota
      });
      if (!r.conforme){
        await audit(env, user.sub, 'payment_blocked', 'contas_pagar', id, { motivo:'3-way', divergencias:r.divergencias });
        return E('Pagamento bloqueado (3-way): ' + r.divergencias.map(d=>d.detalhe).join('; '), 409);
      }
    }
    if (ped && typeof ped.valor === 'number' && typeof conta.valor === 'number' && conta.valor > ped.valor * 1.02){
      await audit(env, user.sub, 'payment_blocked', 'contas_pagar', id, { motivo:'valor acima do pedido' });
      return E('Pagamento bloqueado: valor acima do pedido de origem', 409);
    }
  }
  const data_pagamento = new Date().toISOString().split('T')[0];
  await updateDoc(env, 'contas_pagar', id, { status:'Pago', data_pagamento });
  await audit(env, user.sub, 'payment_release', 'contas_pagar', id, { valor: conta.valor });
  return J({ id, status:'Pago', data_pagamento });
}

// ===== MOTOR DE APROVAÇÃO MULTI-ESTÁGIO (config-driven) =====
// Status (ajuste aqui se o front-end usar textos diferentes):
const ST_RC_PENDENTE   = 'Aguardando Aprovação';
const ST_RC_COMPRADOR  = 'Aprovada – Aguardando Comprador'; // travessão "–"
const ST_RC_ACEITA     = 'Aceita – Pronta para RFQ';        // ⚠️ confirmar
const ST_RC_REJEITADA  = 'Rejeitada';
const ST_MAPA_PEND     = 'Aguardando Aprovação';
const ST_MAPA_APROVADO = 'Aprovado';
const ST_MAPA_REPROV   = 'Reprovado';                       // ⚠️ confirmar
const ST_MAPA_PC       = 'PC Emitido';

const DEFAULT_APROV_CONFIG = {
  rc_estagios: 3, mapa_estagios: 2,
  estagio1:      { nome:'Supervisor / Solicitante',    perfis:['supervisor','operacao'],     usuarios:[] },
  estagio2:      { nome:'Gestor de Operações',         perfis:['operacao','admin'],           usuarios:[] },
  estagio3:      { nome:'Diretor / Gerente Geral',     perfis:['diretor','admin'],            usuarios:[] },
  comprador:     { nome:'Comprador (Suprimentos)',     perfis:['compras','admin'],            usuarios:[] },
  mapa_estagio1: { nome:'Aprovação Mapa – Operações',  perfis:['operacao','compras','admin'], usuarios:[] },
  mapa_estagio2: { nome:'Aprovação Mapa – Diretoria',  perfis:['diretor','admin'],            usuarios:[] },
  emissor_pc:    { nome:'Emissor do Pedido de Compra', perfis:['compras','admin'],            usuarios:[] },
};

async function getAprovConfig(env){
  try {
    const r = await env.DB.prepare("SELECT valor FROM config WHERE chave='aprovacao'").first();
    if (r && r.valor) return { ...DEFAULT_APROV_CONFIG, ...JSON.parse(r.valor) };
  } catch(_){}
  return DEFAULT_APROV_CONFIG;
}
function papelPodeNoEstagio(cfgE, user){
  if (!cfgE) return false;
  if (Array.isArray(cfgE.usuarios) && cfgE.usuarios.includes(user.sub)) return true;
  if (Array.isArray(cfgE.perfis)   && cfgE.perfis.includes(user.role))  return true;
  return false;
}
const sodOn = (env) => (env.ENFORCE_SOD ?? '1') !== '0';

// --- RC: aprovar estágio atual ---
async function aprovarEstagioRC(env, id, user){
  const cfg = await getAprovConfig(env);
  const rc = await getDoc(env, 'rc', id);
  if (!rc) return E('RC não encontrada', 404);
  if (rc.status === ST_RC_REJEITADA) return E('RC já rejeitada', 409);
  if (rc.status === ST_RC_COMPRADOR || rc.status === ST_RC_ACEITA) return E('RC já aprovada em todos os estágios', 409);
  const total = rc.total_estagios || cfg.rc_estagios || 3;
  const atual = rc.estagio_atual || 1;
  const cfgE = cfg['estagio'+atual];
  if (!papelPodeNoEstagio(cfgE, user)) return E(`Seu perfil não pode aprovar o estágio ${atual} (${cfgE?cfgE.nome:''})`, 403);
  rc.aprovacoes = rc.aprovacoes || [];
  if (sodOn(env) && rc.aprovacoes.some(a => a.user_id === user.sub))
    return E('Segregação de funções: você já aprovou um estágio desta RC', 409);
  rc.aprovacoes.push({ estagio: atual, user_id: user.sub, nome: user.name, em: new Date().toISOString() });
  let novoStatus, novoEstagio;
  if (atual >= total){ novoStatus = ST_RC_COMPRADOR; novoEstagio = total; }
  else { novoStatus = ST_RC_PENDENTE; novoEstagio = atual + 1; }
  const rec = await updateDoc(env, 'rc', id, { status:novoStatus, estagio_atual:novoEstagio, total_estagios:total, aprovacoes:rc.aprovacoes });
  await audit(env, user.sub, 'rc_aprovar_estagio', 'rc', id, { estagio: atual, novoStatus });
  return J(rec);
}
async function reprovarRCserver(env, id, user, motivo){
  const cfg = await getAprovConfig(env);
  const rc = await getDoc(env, 'rc', id);
  if (!rc) return E('RC não encontrada', 404);
  const atual = rc.estagio_atual || 1;
  if (!papelPodeNoEstagio(cfg['estagio'+atual], user)) return E('Seu perfil não pode reprovar este estágio', 403);
  const rec = await updateDoc(env, 'rc', id, { status:ST_RC_REJEITADA, motivo_rejeicao: motivo||'' });
  await audit(env, user.sub, 'rc_reprovar', 'rc', id, { motivo });
  return J(rec);
}
async function aceitarCompradorRC(env, id, user){
  const cfg = await getAprovConfig(env);
  const rc = await getDoc(env, 'rc', id);
  if (!rc) return E('RC não encontrada', 404);
  if (rc.status !== ST_RC_COMPRADOR) return E('RC não está aguardando o comprador', 409);
  if (!papelPodeNoEstagio(cfg.comprador, user)) return E('Seu perfil não é Comprador', 403);
  const rec = await updateDoc(env, 'rc', id, { status:ST_RC_ACEITA, comprador:user.name });
  await audit(env, user.sub, 'rc_aceite_comprador', 'rc', id, {});
  return J(rec);
}

// --- MAPA: aprovar estágio atual (2 estágios) ---
async function aprovarEstagioMapa(env, id, user){
  const cfg = await getAprovConfig(env);
  const m = await getDoc(env, 'mapas', id);
  if (!m) return E('Mapa não encontrado', 404);
  if (m.status === ST_MAPA_REPROV) return E('Mapa já reprovado', 409);
  if (m.status === ST_MAPA_APROVADO || m.status === ST_MAPA_PC) return E('Mapa já aprovado', 409);
  const total = cfg.mapa_estagios || 2;
  const atual = m.estagio_atual || 1;
  const cfgE = cfg['mapa_estagio'+atual];
  if (!papelPodeNoEstagio(cfgE, user)) return E(`Seu perfil não pode aprovar o estágio ${atual} do mapa`, 403);
  m.aprovacoes = m.aprovacoes || [];
  if (sodOn(env) && m.aprovacoes.some(a => a.user_id === user.sub))
    return E('Segregação de funções: você já aprovou um estágio deste mapa', 409);
  m.aprovacoes.push({ estagio: atual, user_id: user.sub, nome: user.name, em: new Date().toISOString() });
  let novoStatus, novoEstagio;
  if (atual >= total){ novoStatus = ST_MAPA_APROVADO; novoEstagio = total; }
  else { novoStatus = ST_MAPA_PEND; novoEstagio = atual + 1; }
  const rec = await updateDoc(env, 'mapas', id, { status:novoStatus, estagio_atual:novoEstagio, total_estagios:total, aprovacoes:m.aprovacoes });
  await audit(env, user.sub, 'mapa_aprovar_estagio', 'mapas', id, { estagio: atual, novoStatus });
  return J(rec);
}
async function reprovarMapaServer(env, id, user, motivo){
  const cfg = await getAprovConfig(env);
  const m = await getDoc(env, 'mapas', id);
  if (!m) return E('Mapa não encontrado', 404);
  const atual = m.estagio_atual || 1;
  if (!papelPodeNoEstagio(cfg['mapa_estagio'+atual], user)) return E('Seu perfil não pode reprovar este mapa', 403);
  const rec = await updateDoc(env, 'mapas', id, { status:ST_MAPA_REPROV, motivo_reprovacao: motivo||'' });
  await audit(env, user.sub, 'mapa_reprovar', 'mapas', id, { motivo });
  return J(rec);
}
// LGPD — anonimização (mesma lógica de js/lib/lgpd.js).
function _anonimizarCampo(valor, tipo){
  if (valor == null || valor === '') return valor;
  const s = String(valor);
  if (tipo === 'email'){ const p = s.split('@'); return p.length===2 ? (s.charAt(0)+'•••@'+p[1]) : '•••'; }
  if (tipo === 'telefone'){ const d = s.replace(/\D/g,''); const ddd = d.slice(0,2); return ddd ? ('('+ddd+') •••••-••••') : '•••••'; }
  if (tipo === 'nome'){ return s.trim().split(/\s+/).map(w => w ? w.charAt(0).toUpperCase()+'.' : '').join(' ').trim(); }
  return '•••';
}
async function anonimizarFornecedor(env, id, user){
  requireRole(user, ['admin']);
  const f = await getDoc(env, 'fornecedores', id);
  if (!f) return E('Fornecedor não encontrado', 404);
  const patch = {
    contato_nome: _anonimizarCampo(f.contato_nome || f.contato, 'nome'),
    email: _anonimizarCampo(f.email, 'email'),
    telefone: _anonimizarCampo(f.telefone, 'telefone'),
    anonimizado: 1,
  };
  const rec = await updateDoc(env, 'fornecedores', id, patch);
  await audit(env, user.sub, 'lgpd_anonimizar', 'fornecedores', id, {});
  return rec ? J(rec) : E('falha ao anonimizar', 500);
}

// Consulta a bureau de crédito (provedor por env; mock determinístico padrão).
function consultarCreditoBureau(cnpjRaw, provider){
  const cnpj = String(cnpjRaw||'').replace(/\D/g,'');
  if (cnpj.length !== 14) return E('CNPJ inválido (14 dígitos)', 400);
  const prov = String(provider||'mock').toLowerCase();
  if (prov !== 'mock') return E('Provedor de bureau não configurado: ' + prov, 400);
  let h = 0; for (const ch of cnpj) h = (h*31 + (ch.charCodeAt(0)-48)) % 1000003;
  const score = 300 + (h % 700);
  return J({
    cnpj, fonte:'mock',
    situacao: (h % 13 === 0) ? 'INAPTA' : 'ATIVA',
    score_externo: score,
    score_0_100: Math.round(((score-300)/699)*100),
    pendencias: (h % 7 === 0) ? (1 + (h % 3)) : 0,
    protestos: (h % 11 === 0) ? 1 : 0,
    faturamento_estimado: 120000 * (1 + (h % 60)),
  });
}

// Numeração atômica por tipo/ano (UPSERT + RETURNING numa instrução).
const TIPOS_SEQ = new Set(['PC','RC','RFQ','MAPA','CP']);
async function proximaSequencia(env, tipoRaw, anoRaw){
  const tipo = String(tipoRaw||'').toUpperCase().replace(/[^A-Z]/g,'');
  if (!TIPOS_SEQ.has(tipo)) return E('Tipo de sequência inválido', 400);
  const ano = parseInt(anoRaw) || new Date().getFullYear();
  const row = await env.DB.prepare(
    `INSERT INTO sequences(tipo,ano,valor) VALUES(?,?,1)
     ON CONFLICT(tipo,ano) DO UPDATE SET valor=valor+1 RETURNING valor`
  ).bind(tipo, ano).first();
  const valor = row.valor;
  return J({ tipo, ano, valor, numero: `${tipo}-${ano}-${String(valor).padStart(4,'0')}` });
}

async function emitirPCdoMapa(env, id, user){
  const cfg = await getAprovConfig(env);
  const m = await getDoc(env, 'mapas', id);
  if (!m) return E('Mapa não encontrado', 404);
  if (m.status !== ST_MAPA_APROVADO) return E('Mapa não está aprovado para emissão de PC', 409);
  if (!papelPodeNoEstagio(cfg.emissor_pc, user)) return E('Seu perfil não pode emitir PC', 403);
  const pc = await createDoc(env, 'pedidos', {
    id: 'PED-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-6),
    origem_mapa: id, rc_id: m.rc_id || null,
    fornecedor: m.fornecedor_vencedor || m.fornecedor || null,   // ⚠️ confirmar campo
    valor: m.valor_vencedor || m.valor || null,                  // ⚠️ confirmar campo
    status: 'Emitido', emitido_por: user.name, emitido_em: new Date().toISOString()
  });
  await updateDoc(env, 'mapas', id, { status: ST_MAPA_PC, pedido_id: pc.id });
  await audit(env, user.sub, 'pc_emitir', 'pedidos', pc.id, { mapa: id });
  return J(pc);
}

// ===== Seed (lazy: so quando a tabela users esta vazia) =====
function genRandomPassword(){
  const b = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...b)).replace(/[+/=]/g,'').slice(0,24);
}
async function ensureSeed(env){
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
  if (row && row.n > 0) return;
  // Sem SEED_PASSWORD configurado, gera uma senha aleatória forte e a registra
  // no log do Worker (visível em `wrangler tail`) — nunca um default conhecido.
  let pass = env.SEED_PASSWORD;
  if (!pass) {
    pass = genRandomPassword();
    console.warn('SEED_PASSWORD não definido — senha inicial gerada (troque após o 1º acesso):', pass);
  }
  const base = [
    { id:'u-admin',   email:'admin@fraseralexander.com.br',      name:'Administrador', role:'admin' },
    { id:'u-diretor', email:'diretor@fraseralexander.com.br',    name:'Diretoria',     role:'diretor' },
    { id:'u-fin',     email:'financeiro@fraseralexander.com.br', name:'Financeiro',    role:'financeiro' },
    { id:'u-op',      email:'operacao@fraseralexander.com.br',   name:'Operacao',      role:'operacao' },
    { id:'u-compras', email:'compras@fraseralexander.com.br',    name:'Compras',       role:'compras' },
    { id:'u-sup',     email:'supervisor@fraseralexander.com.br', name:'Supervisor',    role:'supervisor' },
  ];
  for (const u of base){
    const { hash, salt } = await hashPassword(pass);
    await env.DB.prepare('INSERT INTO users (id,email,username,name,role,password_hash,salt,scopes,ativo) VALUES (?,?,?,?,?,?,?,?,1)')
      .bind(u.id, u.email, u.email.split('@')[0], u.name, u.role, hash, salt, '[]').run();
  }
  // Duas contas de teste para validar o GATE imediatamente:
  await createDoc(env,'contas_pagar',{ id:'CP-OK-001',   descricao:'Servico com lastro completo', fornecedor_nome:'Fornecedor A', tipo:'Fornecedor', contrato_id:'CT-2025-001', valor:1000, vencimento:'2025-12-31', status:'Aprovado', nota_fiscal:'NF-12345' });
  await createDoc(env,'contas_pagar',{ id:'CP-BLOQ-001', descricao:'Sem nota fiscal (deve bloquear)', fornecedor_nome:'Fornecedor B', tipo:'Fornecedor', contrato_id:'Geral',      valor:500,  vencimento:'2025-12-31', status:'Aprovado', nota_fiscal:'—' });
}

// ===== Handler principal =====
export default {
  async fetch(request, env){
    const url = new URL(request.url);
    const path = url.pathname;

    // Nao-/api  ->  arquivos estaticos (front-end).
    if (!path.startsWith('/api/')){
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return E('not found', 404);
    }

    try { await ensureSeed(env); } catch(e){ /* segue mesmo se o seed falhar */ }

    const seg = path.slice(5).split('/').filter(Boolean);
    const method = request.method;
    let body = {};
    if (method==='POST' || method==='PUT' || method==='PATCH'){ try { body = await request.json(); } catch(_){ body = {}; } }

    try {
      // ---- Publicos ----
      if (seg[0]==='auth' && seg[1]==='login' && method==='POST'){
        const email = body.email, senha = body.senha; // o front-end envia "senha"
        const u = await env.DB.prepare('SELECT * FROM users WHERE email=? OR username=?').bind(email, email).first();
        if (!u || !u.ativo || !(await verifyPassword(senha||'', u.salt, u.password_hash))){
          await audit(env, null, 'login_failed', 'users', email, {});
          return E('credenciais invalidas', 401);
        }
        const token = await signJWT({ sub:u.id, role:u.role, name:u.name, email:u.email, scopes:JSON.parse(u.scopes||'[]'), exp: Math.floor(Date.now()/1000)+8*3600 }, getSecret(env));
        await audit(env, u.id, 'login_ok', 'users', u.id, {});
        return J({ token, user:{ id:u.id, name:u.name, email:u.email, role:u.role } });
      }
      if (seg[0]==='dashboard' && method==='GET'){
        const cnt = async (t)=>{ try { const r=await env.DB.prepare(`SELECT COUNT(*) n FROM ${t}`).first(); return r?r.n:0; } catch { return 0; } };
        return J({ ok:true, pedidos: await cnt('pedidos'), rc: await cnt('rc'), contas_pagar: await cnt('contas_pagar') });
      }

      // ---- Daqui em diante exige token valido ----
      const user = await requireAuth(request, env);

      if (seg[0]==='auth' && seg[1]==='me'){
        const u = await env.DB.prepare('SELECT id,name,email,role FROM users WHERE id=?').bind(user.sub).first();
        return J(u || null);
      }
      if (seg[0]==='auth' && seg[1]==='logout') return J({ ok:true });

      // Logs de aplicacao
      if (seg[0]==='logs'){
        if (method==='POST'){
          const id = 'log-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
          await env.DB.prepare('INSERT INTO logs (id,acao,modulo,descricao,usuario_nome) VALUES (?,?,?,?,?)')
            .bind(id, body.acao||'', body.modulo||'', body.descricao||'', user.name||'').run();
          return J({ id });
        }
        const modulo = url.searchParams.get('modulo') || '';
        const limit = parseInt(url.searchParams.get('limit')) || 100;
        const rs = modulo
          ? await env.DB.prepare('SELECT * FROM logs WHERE modulo=? ORDER BY criado_em DESC LIMIT ?').bind(modulo, limit).all()
          : await env.DB.prepare('SELECT * FROM logs ORDER BY criado_em DESC LIMIT ?').bind(limit).all();
        return J(rs.results || []);
      }

      // Config de aprovacao
      if (seg[0]==='config' && seg[1]==='aprovacao'){
        if (method==='PUT'){
          requireRole(user, ['admin','financeiro']);
          await env.DB.prepare(`INSERT INTO config (chave,valor) VALUES ('aprovacao',?)
            ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor`).bind(JSON.stringify(body)).run();
          await audit(env, user.sub, 'config_update', 'config', 'aprovacao', body);
          return J(body);
        }
        const r = await env.DB.prepare("SELECT valor FROM config WHERE chave='aprovacao'").first();
        return J(r ? JSON.parse(r.valor) : {});
      }

      // Usuarios e permissoes (admin)
      if (seg[0]==='usuarios'){
        if (seg[2]==='permissoes'){
          if (method==='PUT'){
            requireRole(user, ['admin']);
            await env.DB.prepare(`INSERT INTO permissoes (user_id,permissoes) VALUES (?,?)
              ON CONFLICT(user_id) DO UPDATE SET permissoes=excluded.permissoes`).bind(seg[1], JSON.stringify(body.permissoes||[])).run();
            await audit(env, user.sub, 'permissoes_update', 'users', seg[1], {});
            return J({ ok:true });
          }
          const r = await env.DB.prepare('SELECT permissoes FROM permissoes WHERE user_id=?').bind(seg[1]).first();
          return J(r ? JSON.parse(r.permissoes) : []);
        }
        requireRole(user, ['admin']);
        if (method==='GET' && !seg[1]){ const rs = await env.DB.prepare('SELECT id,email,name,role,ativo FROM users').all(); return J(rs.results || []); }
        if (method==='POST'){
          const { hash, salt } = await hashPassword(body.senha || (env.SEED_PASSWORD || 'Fraser@2025'));
          const id = body.id || crypto.randomUUID();
          await env.DB.prepare('INSERT INTO users (id,email,username,name,role,password_hash,salt,scopes,ativo) VALUES (?,?,?,?,?,?,?,?,1)')
            .bind(id, body.email, body.username||body.email, body.name||'', body.role||'operacao', hash, salt, JSON.stringify(body.scopes||[])).run();
          await audit(env, user.sub, 'user_create', 'users', id, { role: body.role });
          return J({ id });
        }
        return E('metodo nao suportado em usuarios', 405);
      }

      // CONTAS A PAGAR (com GATE de pagamento)
      if (seg[0]==='contas-pagar'){
        if (seg[2]==='pagar' && method==='POST') return await pagarConta(env, seg[1], user);
        if (method==='GET' && !seg[1]) return J(await listDocs(env,'contas_pagar',url));
        if (method==='GET' && seg[1]){ const d=await getDoc(env,'contas_pagar',seg[1]); return d?J(d):E('nao encontrado',404); }
        if (method==='POST'){ const r=await createDoc(env,'contas_pagar',body); await audit(env,user.sub,'create','contas_pagar',r.id,{}); return J(r); }
        if ((method==='PUT'||method==='PATCH') && seg[1]){ const r=await updateDoc(env,'contas_pagar',seg[1],body); await audit(env,user.sub,'update','contas_pagar',seg[1],{}); return r?J(r):E('nao encontrado',404); }
        if (method==='DELETE' && seg[1]){ requireRole(user,['admin','financeiro']); await audit(env,user.sub,'delete','contas_pagar',seg[1],{}); return J(await deleteDoc(env,'contas_pagar',seg[1])); }
      }

      // Acoes especiais por entidade (espelham as chamadas do db.js)
      if (seg[0]==='os' && seg[2]==='iniciar-fluxo' && method==='POST'){ const r=await updateDoc(env,'os',seg[1],{ status:'Em Fluxo' }); await audit(env,user.sub,'os_iniciar_fluxo','os',seg[1],{}); return r?J(r):E('nao encontrado',404); }
      if (seg[0]==='fluxo' && seg[2]==='aprovar' && method==='POST'){ requireRole(user,['admin','diretor','financeiro','supervisor']); const r=await updateDoc(env,'fluxo',seg[1],{ status:'Aprovado', aprovador:user.name }); await audit(env,user.sub,'fluxo_aprovar','fluxo',seg[1],{}); return r?J({aprovado:true,_rec:r}):E('nao encontrado',404); }
      if (seg[0]==='fluxo' && seg[2]==='reprovar' && method==='POST'){ requireRole(user,['admin','diretor','financeiro','supervisor']); const r=await updateDoc(env,'fluxo',seg[1],{ status:'Reprovado', motivo:body.motivo }); await audit(env,user.sub,'fluxo_reprovar','fluxo',seg[1],{}); return r?J({reprovado:true,_rec:r}):E('nao encontrado',404); }
      if (seg[0]==='rfq' && seg[2]==='cotacoes' && method==='POST'){ const cur=await getDoc(env,'rfq',seg[1]); if(!cur) return E('nao encontrado',404); cur.cotacoes=cur.cotacoes||[]; const cot={ id:'cot-'+Date.now(), ...body }; cur.cotacoes.push(cot); await updateDoc(env,'rfq',seg[1],{ cotacoes:cur.cotacoes }); await audit(env,user.sub,'rfq_cotacao','rfq',seg[1],{}); return J(cot); }
      // (handlers mapa estágio único removidos — substituídos pelas rotas multi-estágio abaixo)
      if (seg[0]==='pedidos' && seg[2]==='envio' && method==='POST'){ const r=await updateDoc(env,'pedidos',seg[1],{ status: body.agendado?'Aguardando Envio':'Enviado ao Fornecedor', envio_canal:body.canal, envio_email:body.email }); await audit(env,user.sub,'pedido_envio','pedidos',seg[1],{}); return r?J(r):E('nao encontrado',404); }
      if (seg[0]==='pedidos' && seg[2]==='entrega' && method==='POST'){ const r=await updateDoc(env,'pedidos',seg[1],{ status: body.status||'Entregue', data_entrega:body.data_entrega }); await audit(env,user.sub,'pedido_entrega','pedidos',seg[1],{}); return r?J(r):E('nao encontrado',404); }
      if (seg[0]==='pedidos' && seg[2]==='cancelar' && method==='POST'){ const r=await updateDoc(env,'pedidos',seg[1],{ status:'Cancelado', motivo_cancelamento:body.motivo }); await audit(env,user.sub,'pedido_cancelar','pedidos',seg[1],{}); return r?J(r):E('nao encontrado',404); }
      if (seg[0]==='fornecedores' && seg[2]==='avaliacoes' && method==='POST'){ const cur=await getDoc(env,'fornecedores',seg[1]); if(!cur) return E('nao encontrado',404); cur.avaliacoes=cur.avaliacoes||[]; cur.avaliacoes.push({ id:'av-'+Date.now(), ...body }); await updateDoc(env,'fornecedores',seg[1],{ avaliacoes:cur.avaliacoes }); await audit(env,user.sub,'fornecedor_avaliar','fornecedores',seg[1],{}); return J({ ok:true }); }

      // Sync generico (UPSERT por id — nao apaga itens que o cliente nao mandou)
      if (seg[1]==='sync' && method==='POST' && TABLES[seg[0]]){
        const table = TABLES[seg[0]];
        const arr = Array.isArray(body.data) ? body.data : [];
        for (const item of arr){ if (item && item.id) await createDoc(env, table, item); }
        await audit(env, user.sub, 'sync', table, null, { count: arr.length });
        return J({ synced: arr.length });
      }

      // RC — aprovação multi-estágio
      if (seg[0]==='rc' && seg[2]==='aprovar'           && method==='POST') return await aprovarEstagioRC(env, seg[1], user);
      if (seg[0]==='rc' && seg[2]==='reprovar'          && method==='POST') return await reprovarRCserver(env, seg[1], user, body.motivo);
      if (seg[0]==='rc' && seg[2]==='aceitar-comprador' && method==='POST') return await aceitarCompradorRC(env, seg[1], user);
      // MAPA — aprovação 2 estágios + emissão de PC
      if (seg[0]==='mapas' && seg[2]==='aprovar'   && method==='POST') return await aprovarEstagioMapa(env, seg[1], user);
      if (seg[0]==='mapas' && seg[2]==='reprovar'  && method==='POST') return await reprovarMapaServer(env, seg[1], user, body.motivo);
      if (seg[0]==='mapas' && seg[2]==='emitir-pc' && method==='POST') return await emitirPCdoMapa(env, seg[1], user);

      // Numeração atômica: POST /api/sequencia/PC → { numero: 'PC-2026-0001', ... }
      if (seg[0]==='sequencia' && seg[1] && method==='POST') return await proximaSequencia(env, seg[1], body && body.ano);

      // Consulta a bureau de crédito: POST /api/credito/consultar { cnpj }
      if (seg[0]==='credito' && seg[1]==='consultar' && method==='POST') return consultarCreditoBureau(body && body.cnpj, env.CREDIT_BUREAU_PROVIDER);

      // LGPD — anonimizar fornecedor: POST /api/lgpd/anonimizar/fornecedores/:id
      if (seg[0]==='lgpd' && seg[1]==='anonimizar' && seg[2]==='fornecedores' && seg[3] && method==='POST') return await anonimizarFornecedor(env, seg[3], user);

      // Trilha de auditoria imutável: GET /api/auditoria/verificar (admin)
      if (seg[0]==='auditoria' && seg[1]==='verificar' && method==='GET'){ requireRole(user,['admin']); return await verificarAuditoria(env); }


      // CRUD generico
      if (TABLES[seg[0]]){
        const table = TABLES[seg[0]];
        if (method==='GET' && !seg[1]) return J(await listDocs(env, table, url));
        if (method==='GET' && seg[1]){ const d=await getDoc(env,table,seg[1]); return d?J(d):E('nao encontrado',404); }
        if (method==='POST'){ const r=await createDoc(env,table,body); await audit(env,user.sub,'create',table,r.id,{}); return J(r); }
        if ((method==='PUT'||method==='PATCH') && seg[1]){ const r=await updateDoc(env,table,seg[1],body); await audit(env,user.sub,'update',table,seg[1],{}); return r?J(r):E('nao encontrado',404); }
        if (method==='DELETE' && seg[1]){ await audit(env,user.sub,'delete',table,seg[1],{}); return J(await deleteDoc(env,table,seg[1])); }
      }

      return E('rota nao encontrada: ' + path, 404);
    } catch(err){
      if (err && err.code) return E(err.msg, err.code);
      return E('erro interno: ' + (err && err.message ? err.message : String(err)), 500);
    }
  }
};
