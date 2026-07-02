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

// ===== Portal do fornecedor: regra de isolamento (espelha o Express) =====
// Garante perfil 'fornecedor' COM vínculo; o fornecedor_id vira o único filtro.
function portalScope(user){
  if (!user || user.role !== 'fornecedor') return { ok:false, code:403, msg:'Acesso restrito ao portal do fornecedor' };
  if (!user.fornecedor_id) return { ok:false, code:403, msg:'Usuario sem fornecedor vinculado' };
  return { ok:true, fornecedor_id: user.fornecedor_id };
}
// Ownership: um pedido só "é" do fornecedor se o vínculo bater.
function pedidoPertence(pedido, fornecedorId){
  return !!pedido && fornecedorId != null && String(pedido.fornecedor_id) === String(fornecedorId);
}

// RC: classificação de gasto obrigatória. Aceita acento/caixa, grava canônico.
function normalizarTipoRC(v){
  const k = String(v || '').trim().toLowerCase();
  if (k === 'material') return 'Material';
  if (k === 'servico' || k === 'serviço' || k === 'serviços' || k === 'servicos') return 'Serviço';
  if (k === 'equipamento') return 'Equipamento';
  return null;
}

// Concorrência mínima: compras acima do limiar exigem N cotações; exceção só
// com justificativa + Diretor. Pura (espelha o Express).
function avaliarConcorrencia({ valor = 0, numCotacoes = 0, justificativa = '', perfil = '', valorMin = 10000, minCotacoes = 3 } = {}){
  if ((Number(valor) || 0) <= valorMin) return { ok: true };
  if ((Number(numCotacoes) || 0) >= minCotacoes) return { ok: true };
  const ehDiretor = perfil === 'diretor' || perfil === 'admin';
  if (String(justificativa || '').trim() && ehDiretor) return { ok: true, excecao: true };
  return { ok: false, motivo: `Compra acima de R$ ${valorMin} exige ${minCotacoes} cotacoes (recebidas: ${Number(numCotacoes) || 0}). Excecao requer justificativa e aprovacao de Diretor.` };
}

// SSMA: RCA completo = causa raiz + plano de ação preenchidos. Pura (espelha o Express).
function rcaCompleto({ causa_raiz, plano_acao } = {}){
  return !!(String(causa_raiz || '').trim() && String(plano_acao || '').trim());
}
// Alçada de pagamento: acima do limiar exige aprovação de Diretor. Pura (espelha o Express).
function alcadaPendente({ valor = 0, aprovadaPor = null, limite = 50000 } = {}){
  return (Number(valor) || 0) > limite && !String(aprovadaPor || '').trim();
}
// Fluxo de caixa semanal planejado × realizado por contrato. Pura (espelha lib/fluxo_caixa.js).
const _r2 = n => Math.round(n * 100) / 100;
function _inicioSemana(ymd){ const d = new Date(ymd + 'T00:00:00Z'); const dow = (d.getUTCDay() + 6) % 7; return _addDias(ymd, -dow); }
function montarFluxoCaixa(contas = [], { semanas = 8, hoje } = {}){
  const base = hoje || _hojeStr();
  const inicio = _inicioSemana(base);
  const n = Math.max(1, Math.min(Number(semanas) || 8, 52));
  const fimWindow = _addDias(inicio, n * 7);
  const buckets = [];
  for (let i = 0; i < n; i++){ const ini = _addDias(inicio, i * 7); buckets.push({ semana: ini, inicio: ini, fim: _addDias(ini, 7), planejado: 0, realizado: 0, desvio: 0 }); }
  const inWin = ymd => ymd >= inicio && ymd < fimWindow;
  const idx = ymd => Math.floor((Date.parse(ymd + 'T00:00:00Z') - Date.parse(inicio + 'T00:00:00Z')) / (7 * 864e5));
  const contratos = {}; let planTot = 0, realTot = 0;
  for (const c of contas){
    const valor = Number(c.valor) || 0;
    const venc = String(c.data_vencimento || c.vencimento || '').slice(0, 10);
    const pag = String(c.data_pagamento || '').slice(0, 10);
    const ckey = String(c.contrato_id || c.contrato || c.pc_numero || 'Sem contrato');
    if (!contratos[ckey]) contratos[ckey] = { contrato: ckey, planejado: 0, realizado: 0, desvio: 0 };
    if (venc && inWin(venc) && c.status !== 'Cancelado'){ buckets[idx(venc)].planejado += valor; contratos[ckey].planejado += valor; planTot += valor; }
    if (pag && c.status === 'Pago' && inWin(pag)){ buckets[idx(pag)].realizado += valor; contratos[ckey].realizado += valor; realTot += valor; }
  }
  for (const b of buckets){ b.planejado = _r2(b.planejado); b.realizado = _r2(b.realizado); b.desvio = _r2(b.realizado - b.planejado); }
  const por_contrato = Object.values(contratos).map(c => ({ contrato: c.contrato, planejado: _r2(c.planejado), realizado: _r2(c.realizado), desvio: _r2(c.realizado - c.planejado) }))
    .filter(c => c.planejado || c.realizado).sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio));
  return { semanas: buckets, por_contrato, resumo: { planejado_total: _r2(planTot), realizado_total: _r2(realTot), desvio_total: _r2(realTot - planTot) } };
}

// IDF — Índice de Desempenho do Fornecedor (OTD + avaliações). Pura (espelha lib/idf.js).
const _r1 = n => Math.round(n * 10) / 10;
function calcularIDF({ pedidos = [], avaliacoes = [] } = {}){
  let onTime = 0, considerados = 0;
  for (const p of pedidos){
    const entrega = String(p.entregue_em || p.data_entrega || '').slice(0, 10);
    if (!entrega) continue;
    const base = String(p.enviado_em || p.emitido_em || '').slice(0, 10);
    const prazo = Number(p.prazo_entrega);
    if (!base || !prazo) continue;
    considerados++;
    if (entrega <= _addDias(base, prazo)) onTime++;
  }
  const otd = considerados ? (onTime / considerados) * 100 : null;
  const notas = avaliacoes.map(a => Number(a.nota_media ?? a.media ?? a.nota) || 0).filter(n => n > 0);
  const avalMedia = notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null;
  const avalScore = avalMedia != null ? (avalMedia / 5) * 100 : null;
  let score = null; const componentes = [];
  if (otd != null) componentes.push({ nome: 'OTD (entrega no prazo)', valor: _r1(otd), peso: avalScore != null ? 0.6 : 1 });
  if (avalScore != null) componentes.push({ nome: 'Avaliações', valor: _r1(avalScore), peso: otd != null ? 0.4 : 1 });
  if (otd != null && avalScore != null) score = 0.6 * otd + 0.4 * avalScore;
  else if (otd != null) score = otd;
  else if (avalScore != null) score = avalScore;
  let classificacao = 'Sem dados';
  if (score != null) classificacao = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';
  return { score: score != null ? _r1(score) : null, classificacao, otd_pct: otd != null ? _r1(otd) : null, entregas_consideradas: considerados, avaliacao_media: avalMedia != null ? _r1(avalMedia) : null, avaliacoes_qtd: notas.length, componentes };
}

// Serviço só paga com aceite do requisitante. Pura (espelha o Express).
function exigeAceiteServico(pedido, temAceite){
  const tipo = String((pedido && pedido.tipo_compra) || 'material').toLowerCase();
  const ehServico = tipo === 'servico' || tipo === 'serviço' || tipo === 'serviço externo' || tipo === 'servico externo';
  return ehServico && !temAceite;
}
// CRM → Orçamentação: "passou de Qualificação" = Qualificação..Negociação. Pura (espelha o Express).
const CRM_ETAPAS_ORDEM = ['Prospecção','Qualificação','Reunião Agendada','Proposta Enviada','Negociação','Fechado Ganho','Fechado Perdido'];
function precisaOrcamentacao(estagio){ const i = CRM_ETAPAS_ORDEM.indexOf(estagio); return i >= 1 && i <= 4; }
// Comercial só gera proposta com estimativa de custos vinculada. Pura (espelha o Express).
function podeGerarProposta(lead, temEstimativa){
  if (!lead) return { ok: false, motivo: 'lead/oportunidade nao encontrado' };
  if (!temEstimativa) return { ok: false, motivo: 'lead sem estimativa de custos (WBS) - orcamentacao pendente' };
  return { ok: true };
}
// Rollup de custos WBS por contrato (estimado × realizado). Pura (espelha lib/wbs_rollup.js).
function montarRollupWBS(linhas = []){
  const _r2 = n => Math.round(n * 100) / 100, _r1 = n => Math.round(n * 10) / 10;
  const map = {}; let estTot = 0, realTot = 0;
  for (const l of linhas){
    if ((l.ativo ?? 1) === 0) continue;
    const chave = String(l.contrato_id ?? l.centro_custo ?? 'Sem contrato');
    if (!map[chave]) map[chave] = { chave, estimado: 0, realizado: 0, linhas: 0 };
    const est = Number(l.valor_total_est) || 0, real = Number(l.custo_real) || 0;
    map[chave].estimado += est; map[chave].realizado += real; map[chave].linhas++;
    estTot += est; realTot += real;
  }
  const grupos = Object.values(map).map(g => ({ chave: g.chave, estimado: _r2(g.estimado), realizado: _r2(g.realizado), desvio: _r2(g.realizado - g.estimado), pct: g.estimado ? _r1((g.realizado / g.estimado) * 100) : 0, linhas: g.linhas }))
    .sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio));
  return { grupos, total: { estimado: _r2(estTot), realizado: _r2(realTot), desvio: _r2(realTot - estTot), linhas: linhas.length } };
}
// WBS: uma linha pertence a um contrato quando o contrato_id bate. Pura (espelha o Express).
function wbsPertenceAoContrato(linha, contratoId){
  return !!linha && String(linha.contrato_id ?? '') === String(contratoId ?? '');
}
// Fornecedor homologado = aprovado por Financeiro E Compliance. Pura (espelha o Express).
function fornecedorHomologado(f){
  if (!f) return false;
  if (f.status === 'Homologado') return true;
  return !!(String(f.aprovado_financeiro_por || '').trim() && String(f.aprovado_compliance_por || '').trim());
}
// Dupla aprovação bancária: detecta alteração de banco/agência/conta. Pura (espelha o Express).
function alteracaoBancariaSolicitada(atual, b){
  const mudou = {};
  for (const c of ['banco', 'agencia', 'conta']){
    if (b[c] !== undefined && String(b[c] ?? '') !== String((atual && atual[c]) ?? '')) mudou[c] = b[c];
  }
  return Object.keys(mudou).length ? mudou : null;
}
// Qualidade de dados: detecção de duplicatas (CNPJ de fornecedor / NF). Pura.
function normalizarCNPJ(s){ return String(s || '').replace(/\D/g, ''); }
function detectarDuplicatas({ fornecedores = [], contas = [] } = {}){
  const fmap = {};
  for (const f of fornecedores){ const c = normalizarCNPJ(f.cnpj); if (!c) continue; (fmap[c] = fmap[c] || []).push({ id: f.id, nome: f.nome, ativo: f.ativo }); }
  const fornDup = Object.entries(fmap).filter(([, v]) => v.length > 1).map(([cnpj, ocorrencias]) => ({ cnpj, total: ocorrencias.length, ocorrencias }));
  const nmap = {};
  for (const c of contas){ const nf = String(c.nota_fiscal || '').trim(); if (!nf || nf === '—') continue; (nmap[nf] = nmap[nf] || []).push({ id: c.id, fornecedor_nome: c.fornecedor_nome, valor: c.valor }); }
  const nfDup = Object.entries(nmap).filter(([, v]) => v.length > 1).map(([nota_fiscal, ocorrencias]) => ({ nota_fiscal, total: ocorrencias.length, ocorrencias }));
  return { resumo: { fornecedores_dup: fornDup.length, nf_dup: nfDup.length }, fornecedores: fornDup, notas_fiscais: nfDup };
}

// ===== Central de Alertas: montagem pura (espelha coletarAlertas do Express) =====
const _SEV_PESO = { alta: 3, media: 2, baixa: 1 };
const _hojeStr = () => new Date().toISOString().slice(0, 10);
const _addDias = (ymd, n) => new Date(new Date(ymd + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
// Antecedência de vencimento de contrato: vencido/≤30d → alta; ≤60d → média;
// ≤90d → baixa; acima disso, sem alerta. Pura (espelha o Express).
function classificarVencimentoContrato(dataFim, hoje = _hojeStr()){
  if (!dataFim) return null;
  const fim = String(dataFim).slice(0, 10);
  const diasRest = Math.round((new Date(fim + 'T00:00:00Z') - new Date(hoje + 'T00:00:00Z')) / 864e5);
  if (diasRest <= 30) return 'alta';
  if (diasRest <= 60) return 'media';
  if (diasRest <= 90) return 'baixa';
  return null;
}
// Recebe os documentos já carregados (contas, pedidos, contratos, vencidos LGPD)
// e devolve o feed ordenado por severidade. Sem I/O — testável isoladamente.
function montarAlertasWorker({ contas = [], pedidos = [], contratos = [], vencidosLGPD = [], dias = 7, hoje = _hojeStr(), isAdmin = false, meses = 60 } = {}){
  const limite = _addDias(hoje, dias);
  const alertas = [];
  for (const c of contas){
    const venc = (c.vencimento || c.data_vencimento || '').slice(0, 10);
    if (!venc || !['Pendente', 'Aprovado', 'Vencido'].includes(c.status)) continue;
    const titulo = c.numero || c.id;
    if (venc < hoje){
      alertas.push({ tipo:'conta_vencida', severidade:'alta', modulo:'Financeiro',
        titulo:`Conta vencida: ${titulo}`, descricao:`${c.descricao||''} — venc. ${venc}`, valor:c.valor, data:venc, ref:c.id });
    } else if (venc <= limite){
      alertas.push({ tipo:'conta_a_vencer', severidade:'media', modulo:'Financeiro',
        titulo:`Conta a vencer: ${titulo}`, descricao:`${c.descricao||''} — venc. ${venc}`, valor:c.valor, data:venc, ref:c.id });
    }
  }
  for (const p of pedidos){
    if (['Entregue', 'Recebido', 'Cancelado', 'Concluído'].includes(p.status)) continue;
    const base = (p.enviado_em || p.emitido_em || '').slice(0, 10);
    const prazo = Number(p.prazo_entrega);
    if (!base || !prazo) continue;
    if (_addDias(base, prazo) < hoje){
      alertas.push({ tipo:'entrega_atrasada', severidade:'alta', modulo:'Compras',
        titulo:`Entrega atrasada: ${p.numero || p.id}`, descricao:`${p.fornecedor_nome||p.fornecedor||''} — base ${base}, prazo ${prazo}d`, data:base, ref:p.id });
    }
  }
  if (isAdmin && vencidosLGPD.length){
    alertas.push({ tipo:'lgpd_retencao', severidade:'media', modulo:'LGPD',
      titulo:`Retenção LGPD: ${vencidosLGPD.length} fornecedor(es) a anonimizar`,
      descricao:`Inativos além de ${meses} meses, ainda não anonimizados.`, valor:vencidosLGPD.length, ref:'lgpd' });
  }
  for (const c of contratos){
    if (c.status !== 'Ativo') continue;
    const fim = (c.data_fim || '').slice(0, 10);
    const sev = classificarVencimentoContrato(fim, hoje);
    if (!sev) continue;
    const venc = fim < hoje;
    alertas.push({ tipo:'contrato_vencimento', severidade:sev, modulo:'Contratos',
      titulo:`${venc ? 'Contrato vencido' : 'Contrato a vencer'}: ${c.numero || c.id}`,
      descricao:`${c.titulo || c.fornecedor_nome || ''} — fim ${fim}`, data:fim, ref:c.id });
  }
  alertas.sort((a, b) => (_SEV_PESO[b.severidade] || 0) - (_SEV_PESO[a.severidade] || 0));
  return alertas;
}

// ===== Dashboard BI: KPIs gerenciais (espelha coletarKPIs do Express) =====
const _ativo = f => f.ativo !== 0 && f.ativo !== '0' && f.ativo !== false;
// Recebe documentos já carregados + contagens do gate (audit_log). Sem I/O.
function montarKPIsWorker({ contas = [], pedidos = [], fornecedores = [], contratos = [], bloqueios = 0, liberados = 0, vencidosLGPD = [], dias = 30, hoje = _hojeStr(), isAdmin = false, meses = 60 } = {}){
  const limite = _addDias(hoje, dias);
  let aPagarV = 0, aPagarQ = 0, vencV = 0, vencQ = 0, avV = 0, avQ = 0, pagoV = 0;
  for (const c of contas){
    const venc = (c.vencimento || c.data_vencimento || '').slice(0, 10);
    const val = Number(c.valor) || 0;
    if (c.status === 'Pago'){ pagoV += val; continue; }
    if (['Pendente', 'Aprovado'].includes(c.status)){ aPagarV += val; aPagarQ++; }
    if (['Pendente', 'Aprovado', 'Vencido'].includes(c.status) && venc && venc < hoje){ vencV += val; vencQ++; }
    if (['Pendente', 'Aprovado'].includes(c.status) && venc && venc >= hoje && venc <= limite){ avV += val; avQ++; }
  }

  const ativos = fornecedores.filter(_ativo);
  const score = ativos.length ? ativos.reduce((s, f) => s + (Number(f.score_medio) || 0), 0) / ativos.length : 0;
  const statusMap = {};
  for (const f of ativos){ const s = f.status || '—'; statusMap[s] = (statusMap[s] || 0) + 1; }
  const porStatus = Object.entries(statusMap).map(([status, n]) => ({ status, n }));

  let pcVal = 0, pcEntreg = 0;
  for (const p of pedidos){
    if (p.status !== 'Cancelado') pcVal += Number(p.valor_total != null ? p.valor_total : p.valor) || 0;
    if (['Entregue', 'Recebido', 'Concluído'].includes(p.status)) pcEntreg++;
  }

  const alertas = montarAlertasWorker({ contas, pedidos, contratos, vencidosLGPD, dias, hoje, isAdmin, meses });
  const sevs = { total: alertas.length, alta: 0, media: 0 };
  for (const a of alertas) if (sevs[a.severidade] != null) sevs[a.severidade]++;

  const totGate = bloqueios + liberados;
  return {
    gerado_em: new Date().toISOString(),
    dias,
    financeiro: {
      a_pagar_valor: aPagarV, a_pagar_qtd: aPagarQ,
      vencido_valor: vencV, vencido_qtd: vencQ,
      a_vencer_valor: avV, a_vencer_qtd: avQ,
      pago_valor: pagoV,
    },
    gate: { bloqueios, liberados, taxa_bloqueio: totGate ? +(bloqueios / totGate).toFixed(3) : 0 },
    fornecedores: { ativos: ativos.length, score_medio: +(score || 0).toFixed(2), por_status: porStatus },
    compras: {
      pc_valor_ativo: pcVal, pc_total: pedidos.length, pc_entregues: pcEntreg,
      pc_entregues_pct: pedidos.length ? +((pcEntreg / pedidos.length) * 100).toFixed(1) : 0,
    },
    alertas: sevs,
  };
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
  // Recursos do front de almoxarifado (persistem o objeto do front):
  materiais:'materiais', 'movimentos-estoque':'movimentos_estoque', emprestimos:'emprestimos', inventarios:'inventarios',
};
const sanitizeKey = (k) => String(k).replace(/[^a-zA-Z0-9_]/g,'');

// Política de senha forte (mín. 8, maiúscula, minúscula e dígito).
// Pura (paridade com o Express).
function validarSenhaForte(senha){
  const s = String(senha || '');
  if (s.length < 8) return { ok:false, motivo:'Senha deve ter no mínimo 8 caracteres' };
  if (!/[A-Z]/.test(s)) return { ok:false, motivo:'Senha deve conter letra maiúscula' };
  if (!/[a-z]/.test(s)) return { ok:false, motivo:'Senha deve conter letra minúscula' };
  if (!/[0-9]/.test(s)) return { ok:false, motivo:'Senha deve conter número' };
  return { ok:true };
}

// ===== Multi-tenant (paridade com o Express) =====
// O escopo vem SEMPRE do JWT do usuário autenticado (nunca do corpo/query).
// Docs legados sem empresa_id pertencem à empresa 1 (tenant mestre).
function empresaDoUsuario(user){ return Number(user && user.empresa_id) || 1; }
function docPertenceEmpresa(doc, empresaId){
  if (!doc) return false;
  return (Number(doc.empresa_id) || 1) === (Number(empresaId) || 1);
}

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
  // Alçada por valor: acima do limiar exige aprovação prévia de Diretor.
  const limiteAlcada = parseFloat(env && env.ALCADA_PAGAMENTO_VALOR) || 50000;
  if (alcadaPendente({ valor: c.valor, aprovadaPor: c.alcada_aprovada_por, limite: limiteAlcada })){
    motivos.push(`acima de R$ ${limiteAlcada} sem aprovacao de alcada (Diretor Financeiro)`);
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
// Auto-feed: soma os itens recebidos (docs de recebimento) vinculados ao pedido.
async function itensRecebidosAcumulados(env, pedidoId){
  if (!pedidoId) return [];
  const rs = await env.DB.prepare(
    "SELECT payload FROM recebimentos WHERE CAST(json_extract(payload,'$.pc_id') AS TEXT)=?"
  ).bind(String(pedidoId)).all();
  const acc = {};
  for (const row of (rs.results || [])){
    let doc; try { doc = JSON.parse(row.payload); } catch(e){ continue; }
    for (const it of _parseItens(doc.itens)){
      const k = String(it.codigo_produto || it.codigo || it.descricao || it.desc || '').trim().toLowerCase();
      if (!k) continue;
      const q = Number(it.quantidade_recebida != null ? it.quantidade_recebida : (it.qtd_recebida != null ? it.qtd_recebida : it.qtd)) || 0;
      if (!acc[k]) acc[k] = { codigo: k, descricao: it.descricao || it.desc || k, quantidade_recebida: 0 };
      acc[k].quantidade_recebida += q;
    }
  }
  return Object.values(acc);
}
async function pagarConta(env, id, user){
  requireRole(user, ['financeiro','admin']);            // segregacao de funcoes
  const conta = await getDoc(env, 'contas_pagar', id);
  if (!conta) return E('conta nao encontrada', 404);

  const g = gateContaPagar(conta, env);
  // Serviço: paga com ACEITE do requisitante (não recebimento físico/3-way).
  const pcId = conta.pedido_id || conta.pc_id;
  if (pcId){
    const ped = await getDoc(env, 'pedidos', pcId);
    const aceites = await listDocs(env, 'aceites_servico', { searchParams: new URLSearchParams() });
    const temAceite = aceites.some(a => String(a.pedido_id ?? '') === String(pcId) && (a.aceito === 1 || a.aceito === true));
    if (exigeAceiteServico(ped, temAceite)) g.motivos.push('servico sem aceite do requisitante (checklist de recebimento)');
    g.ok = g.motivos.length === 0;
  }
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
      // Auto-feed: se a conta não trouxer os recebidos, busca dos recebimentos do pedido.
      let itensRecebidos = _parseItens(conta.itens_recebidos);
      if (!itensRecebidos.length) itensRecebidos = await itensRecebidosAcumulados(env, conta.pedido_id);
      const r = conciliarTresVias({
        itensPedido: _parseItens(ped && ped.itens),
        itensRecebidos,
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

// LGPD retenção: fornecedores inativos, além da retenção e não anonimizados.
async function _fornecedoresVencidosRetencao(env){
  const meses = parseInt(env.RETENCAO_FORNECEDOR_MESES) || 60;
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - meses);
  const cut = cutoff.toISOString().slice(0, 19).replace('T', ' ');
  const rs = await env.DB.prepare("SELECT id, payload, created_at FROM fornecedores WHERE created_at < ?").bind(cut).all();
  const out = [];
  for (const row of (rs.results || [])){
    let p; try { p = JSON.parse(row.payload); } catch(e){ continue; }
    if ((p.ativo === 0 || p.ativo === '0') && !p.anonimizado) out.push({ id: row.id, nome: p.nome, created_at: row.created_at });
  }
  return { meses, vencidos: out };
}
async function retencaoPreviewFornecedores(env, user){
  requireRole(user, ['admin']);
  const r = await _fornecedoresVencidosRetencao(env);
  return J({ politica_meses: r.meses, total: r.vencidos.length, fornecedores: r.vencidos });
}
async function retencaoExecutarFornecedores(env, user){
  requireRole(user, ['admin']);
  const r = await _fornecedoresVencidosRetencao(env);
  let n = 0;
  for (const v of r.vencidos){
    const f = await getDoc(env, 'fornecedores', v.id);
    if (!f) continue;
    await updateDoc(env, 'fornecedores', v.id, {
      contato_nome: _anonimizarCampo(f.contato_nome || f.contato, 'nome'),
      email: _anonimizarCampo(f.email, 'email'),
      telefone: _anonimizarCampo(f.telefone, 'telefone'),
      anonimizado: 1,
    });
    n++;
  }
  if (n) await audit(env, user.sub, 'lgpd_retencao', 'fornecedores', null, { anonimizados: n });
  return J({ anonimizados: n, politica_meses: r.meses });
}

// Consulta a bureau de crédito (provedor por env; mock determinístico padrão).
// Bureau mock determinístico (mesma fórmula da lib/credit_bureau.js do Express).
function bureauMock(cnpjRaw){
  const cnpj = String(cnpjRaw||'').replace(/\D/g,'');
  if (cnpj.length !== 14) return null;
  let h = 0; for (const ch of cnpj) h = (h*31 + (ch.charCodeAt(0)-48)) % 1000003;
  const score = 300 + (h % 700);
  return {
    cnpj, fonte:'mock',
    situacao: (h % 13 === 0) ? 'INAPTA' : 'ATIVA',
    score_externo: score,
    score_0_100: Math.round(((score-300)/699)*100),
    pendencias: (h % 7 === 0) ? (1 + (h % 3)) : 0,
    protestos: (h % 11 === 0) ? 1 : 0,
    faturamento_estimado: 120000 * (1 + (h % 60)),
  };
}
function consultarCreditoBureau(cnpjRaw, provider){
  const prov = String(provider||'mock').toLowerCase();
  if (prov !== 'mock') return E('Provedor de bureau não configurado: ' + prov, 400);
  const d = bureauMock(cnpjRaw);
  return d ? J(d) : E('CNPJ inválido (14 dígitos)', 400);
}

// Parecer financeiro prévio (espelha lib/analise_financeira.js do Express). Pura.
function analisarFinanceiro({ bureau = {}, receita = {} } = {}){
  const fatores = [];
  let score = Number(bureau.score_0_100);
  if (!isFinite(score)) score = 50;
  fatores.push({ fator: 'Score de crédito (bureau)', impacto: 0, detalhe: `${bureau.score_externo ?? '—'} (${isFinite(Number(bureau.score_0_100)) ? bureau.score_0_100 : '—'}/100)` });
  const pend = Number(bureau.pendencias) || 0;
  if (pend > 0){ const p = Math.min(pend * 8, 30); score -= p; fatores.push({ fator: 'Pendências financeiras', impacto: -p, detalhe: `${pend} pendência(s)` }); }
  const prot = Number(bureau.protestos) || 0;
  if (prot > 0){ const p = Math.min(prot * 12, 30); score -= p; fatores.push({ fator: 'Protestos', impacto: -p, detalhe: `${prot} protesto(s)` }); }
  const sit = receita.situacao_cadastral || bureau.situacao || 'ATIVA';
  const regular = receita.regular !== undefined ? !!receita.regular : (sit === 'ATIVA');
  let recusaCadastral = false;
  if (!regular){ score -= 40; recusaCadastral = true; fatores.push({ fator: 'Situação cadastral', impacto: -40, detalhe: sit }); }
  else fatores.push({ fator: 'Situação cadastral', impacto: 0, detalhe: sit });
  const fat = Number(bureau.faturamento_estimado) || 0;
  if (fat >= 1000000){ score += 5; fatores.push({ fator: 'Faturamento estimado', impacto: +5, detalhe: `R$ ${Math.round(fat).toLocaleString('pt-BR')}` }); }
  score = Math.max(0, Math.min(100, Math.round(score)));
  let nivel, recomendacao;
  if (recusaCadastral || score < 40){ nivel = 'Alto'; recomendacao = 'Recusar'; }
  else if (score < 65){ nivel = 'Médio'; recomendacao = 'Aprovar com ressalvas'; }
  else { nivel = 'Baixo'; recomendacao = 'Aprovar'; }
  return { score, nivel, recomendacao, fatores, situacao_cadastral: sit, regular, score_bureau: bureau.score_externo ?? null, pendencias: pend, protestos: prot, faturamento_estimado: fat };
}

// Situação cadastral (Receita/SEFAZ) — mock determinístico (mesma distribuição
// do lib/receita.js do Express). Pura: devolve normalizado ou null se CNPJ inválido.
const _RECEITA_SITU = ['ATIVA','ATIVA','ATIVA','ATIVA','SUSPENSA','INAPTA','BAIXADA','NULA'];
function situacaoReceitaMock(cnpjRaw){
  const cnpj = String(cnpjRaw||'').replace(/\D/g,'');
  if (cnpj.length !== 14) return null;
  let h = 0; for (const ch of cnpj) h = (h*31 + (ch.charCodeAt(0)-48)) % 1000003;
  const situacao_cadastral = _RECEITA_SITU[h % _RECEITA_SITU.length];
  return { cnpj, fonte:'mock', situacao_cadastral, regular: situacao_cadastral === 'ATIVA' };
}

// Cadastro completo por CNPJ (estilo Omie) — mock determinístico, mesmo
// resultado da lib/receita.js do Express (preenche o formulário sem CORS).
const _UFS = ['SP','RJ','MG','PR','RS','SC','BA','PE','CE','GO','ES','DF'];
const _CIDADES = { SP:'São Paulo', RJ:'Rio de Janeiro', MG:'Belo Horizonte', PR:'Curitiba', RS:'Porto Alegre', SC:'Joinville', BA:'Salvador', PE:'Recife', CE:'Fortaleza', GO:'Goiânia', ES:'Serra', DF:'Brasília' };
const _BAIRROS = ['Centro','Distrito Industrial','Jardim América','Vila Nova','Boa Vista','São José','Santa Mônica','Industrial'];
const _LOGRAD = ['Rua das Indústrias','Av. Brasil','Av. das Nações','Rua XV de Novembro','Av. Industrial','Rua do Comércio','Rod. BR-101'];
const _ATIV = ['Comércio atacadista de materiais de construção','Transporte rodoviário de carga','Fabricação de peças e acessórios','Manutenção e reparação de máquinas','Comércio varejista de equipamentos','Serviços de engenharia','Locação de máquinas e equipamentos','Comércio de produtos químicos'];
const _PORTES = ['ME','EPP','Demais','MEI'];
const _NATUREZAS = ['Sociedade Empresária Limitada','Empresário (Individual)','Sociedade Anônima Fechada','EIRELI'];
const _RAMOS = ['Metalúrgica','Comercial','Transportes','Engenharia','Industrial','Construtora','Distribuidora','Serviços'];
const _MARCAS = ['Aliança','Horizonte','Progresso','União','Pioneira','Atlas','Vértice','Primus'];
const _SUFIXOS = ['LTDA','S.A.','ME','EIRELI'];
const _pick = (arr, h) => arr[h % arr.length];
function cadastroCNPJMock(cnpjRaw){
  const cnpj = String(cnpjRaw||'').replace(/\D/g,'');
  if (cnpj.length !== 14) return null;
  let h = 0; for (const ch of cnpj) h = (h*31 + (ch.charCodeAt(0)-48)) % 1000003;
  const ramo = _pick(_RAMOS, h), marca = _pick(_MARCAS, Math.floor(h/7)), sufixo = _pick(_SUFIXOS, Math.floor(h/13));
  const uf = _pick(_UFS, Math.floor(h/3));
  const ano = 1990 + (h % 33), mes = String(1 + (h % 12)).padStart(2,'0'), dia = String(1 + (h % 27)).padStart(2,'0');
  const ddd = 11 + (h % 80);
  const sit = _RECEITA_SITU[h % _RECEITA_SITU.length];
  return {
    cnpj, cnpj_fmt: `${cnpj.slice(0,2)}.${cnpj.slice(2,5)}.${cnpj.slice(5,8)}/${cnpj.slice(8,12)}-${cnpj.slice(12,14)}`,
    razao: `${ramo} ${marca} ${sufixo}`, fantasia: `${marca} ${ramo}`,
    situacao: sit, regular: sit === 'ATIVA',
    logradouro: _pick(_LOGRAD, Math.floor(h/5)), numero: String(50 + (h % 1950)), bairro: _pick(_BAIRROS, Math.floor(h/11)),
    cidade: _CIDADES[uf], uf, cep: `${String(10000 + (h % 89999)).slice(0,5)}-${String(100 + (h % 899)).slice(0,3)}`,
    email: `contato@${marca.toLowerCase()}${(h % 90) + 10}.com.br`,
    telefone: `(${ddd}) ${String(90000 + (h % 9999)).slice(0,5)}-${String(1000 + (h % 8999)).slice(0,4)}`,
    porte: _pick(_PORTES, Math.floor(h/17)), atividade: _pick(_ATIV, Math.floor(h/19)),
    abertura: `${ano}-${mes}-${dia}`, capital: 50000 * (1 + (h % 200)), natureza: _pick(_NATUREZAS, Math.floor(h/23)),
    fonte: 'mock', ok: true,
  };
}

// ── Notificações + e-mail (espelha lib/email.js + escopo do Express) ──
const _emailValido = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || '').trim());
async function enviarEmail({ to, assunto, corpo } = {}, opts = {}){
  const provider = (opts.provider || 'mock').toLowerCase();
  if (!_emailValido(to)) return { status:'erro', to, provider, motivo:'destinatário inválido' };
  if (!assunto) return { status:'erro', to, provider, motivo:'assunto obrigatório' };
  if (provider === 'mock') return { status:'simulado', to, assunto, provider, corpo_len: String(corpo || '').length };
  throw new Error('Provedor de e-mail não configurado: ' + provider);
}
// Uma notificação está no escopo do usuário se: é dele, do seu perfil, ou global.
function notificacaoNoEscopo(n, user){
  if (!n || !user) return false;
  if (n.usuario_id != null && n.usuario_id !== '' && String(n.usuario_id) === String(user.sub)) return true;
  if (n.perfil && n.perfil === user.role) return true;
  if ((n.usuario_id == null || n.usuario_id === '') && !n.perfil) return true;
  return false;
}
async function notificarWorker(env, { usuario_id = null, perfil = null, titulo, mensagem = '', tipo = 'info', ref_tipo = null, ref_id = null } = {}){
  if (!titulo) return;
  await createDoc(env, 'notificacoes', { usuario_id, perfil, titulo, mensagem, tipo, ref_tipo, ref_id, lida: 0, created_at: new Date().toISOString() });
}

// ── Emissão fiscal NF-e/NFS-e/CT-e (mock determinístico, espelha lib/nfe.js) ──
const _NFE_TIPOS = { nfe:'NF-e', nfse:'NFS-e', cte:'CT-e' };
const _nfeDigits = s => String(s||'').replace(/\D/g,'');
function _nfeValidar(tipo, d){
  const erros = [];
  if (!_NFE_TIPOS[tipo]) erros.push('tipo inválido (nfe|nfse|cte)');
  if (_nfeDigits(d.cnpj_emitente).length !== 14) erros.push('CNPJ do emitente inválido');
  if (_nfeDigits(d.cnpj_destinatario).length !== 14 && _nfeDigits(d.cpf_destinatario).length !== 11) erros.push('documento do destinatário inválido');
  if (!(Number(d.valor) > 0)) erros.push('valor deve ser maior que zero');
  if (!d.descricao && !(Array.isArray(d.itens) && d.itens.length)) erros.push('informe itens ou descrição');
  return erros;
}
function _nfeChave(d, numero){
  const base = _nfeDigits(d.cnpj_emitente) + _nfeDigits(String(numero)) + _nfeDigits(String(Math.round(Number(d.valor) * 100)));
  let seed = 0; for (const c of base) seed = (seed * 31 + c.charCodeAt(0)) % 1000000007;
  return (String(seed) + base + '0'.repeat(44)).replace(/\D/g, '').slice(0, 44);
}
async function emitirNotaFiscal(dados = {}, opts = {}){
  const tipo = String(dados.tipo || 'nfe').toLowerCase();
  const erros = _nfeValidar(tipo, dados);
  if (erros.length) return { status:'rejeitada', tipo, motivo: erros.join('; ') };
  const provider = (opts.provider || 'mock').toLowerCase();
  if (provider !== 'mock') throw new Error('Provedor de NF-e não configurado: ' + provider);
  const numero = Number(dados.numero) || 1, serie = Number(dados.serie) || 1;
  const chave = _nfeChave(dados, numero);
  return { status:'autorizada', tipo, tipo_label:_NFE_TIPOS[tipo], numero, serie, chave, protocolo:'1'+chave.slice(0,14), danfe_url:`/danfe/${chave}.pdf`, valor:Number(dados.valor), fonte:'mock' };
}
function cancelarNotaFiscal(chave, justificativa, opts = {}){
  const ch = _nfeDigits(chave);
  if (ch.length !== 44) return { status:'erro', motivo:'chave inválida (44 dígitos)' };
  if (String(justificativa || '').trim().length < 15) return { status:'rejeitada', motivo:'justificativa de cancelamento exige no mínimo 15 caracteres (regra SEFAZ)' };
  const provider = (opts.provider || 'mock').toLowerCase();
  if (provider !== 'mock') throw new Error('Provedor de NF-e não configurado: ' + provider);
  return { status:'cancelada', chave: ch, protocolo:'2'+ch.slice(0,14) };
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
// Upgrade in-place: garante a coluna de vínculo do portal em bancos já criados.
let _userColsReady = false;
async function ensureUserCols(env){
  if (_userColsReady) return;
  try { await env.DB.prepare('ALTER TABLE users ADD COLUMN fornecedor_id TEXT').run(); } catch(_){ /* já existe */ }
  _userColsReady = true;
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
    try { await ensureUserCols(env); } catch(e){ /* coluna opcional do portal */ }

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
        const token = await signJWT({ sub:u.id, role:u.role, name:u.name, email:u.email, fornecedor_id:u.fornecedor_id||null, empresa_id: Number(u.empresa_id)||1, scopes:JSON.parse(u.scopes||'[]'), exp: Math.floor(Date.now()/1000)+8*3600 }, getSecret(env));
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

      // ---- Usuarios (admin): provisiona inclusive usuario de portal ----
      if (seg[0]==='usuarios' && method==='POST'){
        requireRole(user, ['admin']);
        const { nome, email, senha, perfil, fornecedor_id } = body;
        if (!nome || !email) return E('Nome e email obrigatorios', 400);
        if (perfil === 'fornecedor' && !fornecedor_id) return E('Usuario fornecedor exige fornecedor_id', 400);
        // Política de senha forte quando informada (omitida → SEED_PASSWORD).
        if (senha !== undefined && senha !== null && senha !== ''){
          const pol = validarSenhaForte(senha);
          if (!pol.ok) return E(pol.motivo, 400);
        }
        // Multi-tenant: novo usuário herda a empresa do criador; só o tenant
        // mestre (empresa 1) pode provisionar em outra empresa.
        const criador = empresaDoUsuario(user);
        const empresaId = (criador === 1 && body.empresa_id) ? Number(body.empresa_id) : criador;
        // Migração preguiçosa e idempotente para bancos já implantados.
        try { await env.DB.exec("ALTER TABLE users ADD COLUMN empresa_id TEXT DEFAULT '1'"); } catch(e){ /* já existe */ }
        const { hash, salt } = await hashPassword(String(senha || env.SEED_PASSWORD || genRandomPassword()));
        const id = 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
        try {
          await env.DB.prepare('INSERT INTO users (id,email,username,name,role,password_hash,salt,scopes,fornecedor_id,ativo,empresa_id) VALUES (?,?,?,?,?,?,?,?,?,1,?)')
            .bind(id, String(email).toLowerCase().trim(), String(email).split('@')[0], nome, perfil||'operacao', hash, salt, '[]', fornecedor_id||null, String(empresaId)).run();
        } catch(e){ return E('Email ja cadastrado', 400); }
        await audit(env, user.sub, 'usuario_criar', 'users', id, { perfil: perfil||'operacao', empresa_id: empresaId });
        return J({ id, nome, email, perfil: perfil||'operacao', fornecedor_id: fornecedor_id||null, empresa_id: empresaId }, 201);
      }

      // ---- Empresas (tenants): mestre gerencia todas; demais veem a própria ----
      if (seg[0]==='empresas'){
        try { await env.DB.exec("CREATE TABLE IF NOT EXISTS empresas ( id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) )"); } catch(e){ /* já existe */ }
        const emp = empresaDoUsuario(user);
        if (seg[1]==='atual' && method==='GET'){
          const e0 = await getDoc(env, 'empresas', String(emp));
          return J(e0 || { id: emp, razao_social: emp === 1 ? 'Empresa Padrão' : `Empresa ${emp}` });
        }
        if (!seg[1] && method==='GET'){
          const todas = await listDocs(env, 'empresas', { searchParams: new URLSearchParams() });
          return J(emp === 1 ? todas : todas.filter(e0 => (Number(e0.id)||0) === emp));
        }
        if (!seg[1] && method==='POST'){
          requireRole(user, ['admin']);
          if (emp !== 1) return E('Apenas o tenant mestre pode criar empresas', 403);
          if (!body.razao_social || !String(body.razao_social).trim()) return E('Razão social obrigatória', 400);
          const todas = await listDocs(env, 'empresas', { searchParams: new URLSearchParams() });
          const novoId = String(Math.max(1, ...todas.map(e0 => Number(e0.id)||1)) + 1);
          const nova = await createDoc(env, 'empresas', { id: novoId, razao_social: String(body.razao_social).trim(), nome_fantasia: body.nome_fantasia||null, cnpj: body.cnpj||null, plano: body.plano||'padrao', ativo: 1 });
          await audit(env, user.sub, 'empresa_criar', 'empresas', novoId, {});
          return J(nova, 201);
        }
      }

      // ---- Portal do fornecedor (self-service, escopo isolado) ----
      if (seg[0]==='portal'){
        const ps = portalScope(user);
        if (!ps.ok) return E(ps.msg, ps.code);
        // GET /api/portal/pedidos — só os pedidos do próprio fornecedor.
        if (seg[1]==='pedidos' && seg.length===2 && method==='GET'){
          const faux = { searchParams: new URLSearchParams({ fornecedor_id: String(ps.fornecedor_id), limit:'200' }) };
          return J(await listDocs(env, 'pedidos', faux));
        }
        // POST /api/portal/pedidos/:id/nf — anexa NF (ownership obrigatório).
        if (seg[1]==='pedidos' && seg[3]==='nf' && method==='POST'){
          const ped = await getDoc(env, 'pedidos', seg[2]);
          if (!ped) return E('Pedido nao encontrado', 404);
          if (!pedidoPertence(ped, ps.fornecedor_id)) return E('Pedido nao pertence a este fornecedor', 403);
          if (!body.nf_numero) return E('Informe o numero da NF', 400);
          const r = await updateDoc(env, 'pedidos', seg[2], { nf_numero: body.nf_numero, nf_valor: body.nf_valor || ped.valor || 0, status: 'NF Enviada' });
          await audit(env, user.sub, 'portal_nf', 'pedidos', seg[2], { nf: body.nf_numero });
          return r ? J(r) : E('nao encontrado', 404);
        }
        // GET/PUT /api/portal/perfil — próprio cadastro; só contato/bancário.
        if (seg[1]==='perfil' && method==='GET'){
          const f = await getDoc(env, 'fornecedores', ps.fornecedor_id);
          return f ? J(f) : E('Fornecedor nao encontrado', 404);
        }
        if (seg[1]==='perfil' && method==='PUT'){
          const f = await getDoc(env, 'fornecedores', ps.fornecedor_id);
          if (!f) return E('Fornecedor nao encontrado', 404);
          const patch = {};
          for (const k of ['contato','email','telefone']) if (body[k] !== undefined) patch[k] = body[k];
          // Dados bancários via portal entram PENDENTES de dupla aprovação interna.
          const bankChange = alteracaoBancariaSolicitada(f, body);
          if (bankChange){
            patch.banco_pendente = bankChange.banco ?? f.banco;
            patch.agencia_pendente = bankChange.agencia ?? f.agencia;
            patch.conta_pendente = bankChange.conta ?? f.conta;
            patch.banco_solicitado_por = `portal:${f.nome}`;
            patch.banco_solicitado_em = new Date().toISOString();
          }
          const r = await updateDoc(env, 'fornecedores', ps.fornecedor_id, patch);
          await audit(env, user.sub, bankChange ? 'banco_alteracao_solicitada' : 'portal_perfil', 'fornecedores', ps.fornecedor_id, {});
          return r ? J(r) : E('nao encontrado', 404);
        }
        return E('rota de portal nao encontrada', 404);
      }

      // ---- Central de Alertas (feed interno consolidado) ----
      if (seg[0]==='alertas' && method==='GET'){
        if (user.role === 'fornecedor') return E('Sem acesso a central de alertas', 403);
        const dias = Math.max(1, Math.min(parseInt(url.searchParams.get('dias')) || 7, 90));
        const isAdmin = user.role === 'admin';
        const all = { searchParams: new URLSearchParams() };
        const contas = await listDocs(env, 'contas_pagar', all);
        const pedidos = await listDocs(env, 'pedidos', all);
        const contratos = await listDocs(env, 'contratos', all);
        let vencidosLGPD = [], meses = 60;
        if (isAdmin){ const r = await _fornecedoresVencidosRetencao(env); vencidosLGPD = r.vencidos; meses = r.meses; }
        const alertas = montarAlertasWorker({ contas, pedidos, contratos, vencidosLGPD, dias, isAdmin, meses });
        const resumo = { total: alertas.length, alta: 0, media: 0, baixa: 0 };
        for (const a of alertas) resumo[a.severidade] = (resumo[a.severidade] || 0) + 1;
        return J({ resumo, dias, alertas });
      }

      // ---- Dashboard BI (KPIs gerenciais consolidados) ----
      if (seg[0]==='bi' && method==='GET'){
        if (user.role === 'fornecedor') return E('Sem acesso ao painel gerencial', 403);
        const dias = Math.max(1, Math.min(parseInt(url.searchParams.get('dias')) || 30, 365));
        const isAdmin = user.role === 'admin';
        const all = { searchParams: new URLSearchParams() };
        const contas = await listDocs(env, 'contas_pagar', all);
        const pedidos = await listDocs(env, 'pedidos', all);
        const fornecedores = await listDocs(env, 'fornecedores', all);
        const contratos = await listDocs(env, 'contratos', all);
        const cnt = async (acao) => { const r = await env.DB.prepare("SELECT COUNT(*) n FROM audit_log WHERE action=?").bind(acao).first(); return r ? r.n : 0; };
        const bloqueios = await cnt('payment_blocked');
        const liberados = await cnt('payment_release');
        let vencidosLGPD = [], meses = 60;
        if (isAdmin){ const r = await _fornecedoresVencidosRetencao(env); vencidosLGPD = r.vencidos; meses = r.meses; }
        return J(montarKPIsWorker({ contas, pedidos, fornecedores, contratos, bloqueios, liberados, vencidosLGPD, dias, isAdmin, meses }));
      }

      // ---- Fluxo de caixa (saídas): semanal planejado × realizado por contrato ----
      if (seg[0]==='fluxo-caixa' && method==='GET'){
        if (user.role === 'fornecedor') return E('Sem acesso ao fluxo de caixa', 403);
        const semanas = Math.max(1, Math.min(parseInt(url.searchParams.get('semanas')) || 8, 52));
        const contas = await listDocs(env, 'contas_pagar', { searchParams: new URLSearchParams() });
        return J(montarFluxoCaixa(contas, { semanas }));
      }

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
        // Aprovação de alçada por Diretor — distinta do pagamento (segregação).
        if (seg[2]==='aprovar-alcada' && method==='POST'){
          requireRole(user, ['admin','diretor']);
          const conta = await getDoc(env, 'contas_pagar', seg[1]);
          if (!conta) return E('conta nao encontrada', 404);
          const r = await updateDoc(env, 'contas_pagar', seg[1], { alcada_aprovada_por: user.name, alcada_aprovada_em: new Date().toISOString() });
          await audit(env, user.sub, 'alcada_aprovada', 'contas_pagar', seg[1], {});
          return r ? J(r) : E('nao encontrado', 404);
        }
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

      // Sync generico (UPSERT por id/numero — nao apaga itens que o cliente nao
      // mandou). Escopado por tenant: carimba a empresa do usuário em cada item.
      if (seg[1]==='sync' && method==='POST' && TABLES[seg[0]]){
        const table = TABLES[seg[0]];
        const emp = empresaDoUsuario(user);
        const arr = Array.isArray(body.data) ? body.data : [];
        for (let i = 0; i < arr.length; i++){
          const item = arr[i];
          if (!item) continue;
          const id = item.id ?? item.numero ?? `i-${i}`;
          await createDoc(env, table, { ...item, id, empresa_id: emp });
        }
        await audit(env, user.sub, 'sync', table, null, { count: arr.length });
        return J({ synced: arr.length });
      }
      // GET /api/<entidade>/sync — paridade com o Express: snapshot do tenant.
      if (seg[1]==='sync' && method==='GET' && TABLES[seg[0]]){
        const emp = empresaDoUsuario(user);
        return J((await listDocs(env, TABLES[seg[0]], { searchParams: new URLSearchParams() })).filter(d => docPertenceEmpresa(d, emp)));
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

      // Situação cadastral (Receita/SEFAZ): POST /api/receita/consultar { cnpj }
      if (seg[0]==='receita' && seg[1]==='consultar' && method==='POST'){
        const prov = String(env.RECEITA_PROVIDER||'mock').toLowerCase();
        if (prov !== 'mock') return E('Provedor de situacao cadastral nao configurado: ' + prov, 400);
        const s = situacaoReceitaMock(body && body.cnpj);
        return s ? J(s) : E('CNPJ invalido (14 digitos)', 400);
      }

      // Recebimento — liga à conta a pagar do pedido e anexa a NF (B1, espelha o Express)
      if (seg[0]==='recebimentos' && !seg[1] && method==='POST'){
        const r = await createDoc(env, 'recebimentos', body);
        let contas = [];
        const pc = body.pc_id || body.pedido_id;
        if (pc){
          const all = await listDocs(env, 'contas_pagar', { searchParams: new URLSearchParams() });
          contas = all.filter(c => String(c.pedido_id ?? c.pc_id ?? '') === String(pc));
          if (body.nf_numero){
            for (const c of contas){
              if (!c.nota_fiscal || c.nota_fiscal === '' || c.nota_fiscal === '—'){
                await updateDoc(env, 'contas_pagar', c.id, { nota_fiscal: body.nf_numero });
                c.nota_fiscal = body.nf_numero;
              }
            }
          }
        }
        await audit(env, user.sub, 'create', 'recebimentos', r.id, {});
        return J({ ...r, contas_pagar: contas }, 201);
      }

      // Aceite de serviço (B2) — requisitante atesta a prestação
      if (seg[0]==='aceites-servico' && method==='GET'){
        const all = await listDocs(env, 'aceites_servico', { searchParams: new URLSearchParams() });
        let rows = all;
        for (const k of ['pedido_id', 'os_id']) if (url.searchParams.get(k)) rows = rows.filter(x => String(x[k] ?? '') === String(url.searchParams.get(k)));
        return J(rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
      }
      if (seg[0]==='pedidos' && seg[2]==='aceite-servico' && method==='POST'){
        const ped = await getDoc(env, 'pedidos', seg[1]);
        if (!ped) return E('Pedido nao encontrado', 404);
        const checklist = Array.isArray(body.checklist) ? body.checklist : [];
        if (!checklist.length) return E('Informe o checklist de recebimento do servico (especificacao tecnica)', 400);
        const todosConformes = checklist.every(c => c && (c.conforme === true || c.conforme === 1));
        if (body.aceitar !== false && !todosConformes) return E('Aceite bloqueado: ha itens nao conformes no checklist', 409);
        const aceito = body.aceitar === false ? 0 : (todosConformes ? 1 : 0);
        const r = await createDoc(env, 'aceites_servico', { pedido_id: seg[1], os_id: body.os_id ?? null, checklist, aceito, aceito_por: user.name, aceito_em: new Date().toISOString(), especificacao: body.especificacao ?? null, observacoes: body.observacoes ?? null });
        await updateDoc(env, 'pedidos', seg[1], { tipo_compra: 'servico' });
        await audit(env, user.sub, aceito ? 'aceite_servico' : 'aceite_servico_recusado', 'pedidos', seg[1], {});
        return J(r, 201);
      }

      // CRM → Orçamentação (C1): leads pendentes + gatilho ao passar de Qualificação
      if (seg[0]==='crm' && seg[1]==='orcamentacao' && method==='GET'){
        const status = url.searchParams.get('status') || 'pendente';
        const all = await listDocs(env, 'crm', { searchParams: new URLSearchParams() });
        return J(all.filter(x => (x.orcamentacao_status || 'nao_iniciada') === status));
      }
      if (seg[0]==='crm' && seg[1] && !seg[2] && (method==='PUT' || method==='PATCH')){
        const cur = await getDoc(env, 'crm', seg[1]);
        if (!cur) return E('Oportunidade nao encontrada', 404);
        await updateDoc(env, 'crm', seg[1], { ...body });
        if (precisaOrcamentacao(body.estagio) && (cur.orcamentacao_status || 'nao_iniciada') === 'nao_iniciada'){
          await updateDoc(env, 'crm', seg[1], { orcamentacao_status: 'pendente', orcamentacao_em: new Date().toISOString() });
          await notificarWorker(env, { perfil: 'orcamentista', titulo: 'Lead para precificar', mensagem: `Crie a estimativa de custos (WBS) do lead "${body.titulo || cur.titulo}".`, tipo: 'orcamentacao', ref_tipo: 'crm', ref_id: String(seg[1]) });
        }
        await audit(env, user.sub, 'update', 'crm', seg[1], {});
        const fin = await getDoc(env, 'crm', seg[1]);
        return fin ? J(fin) : E('nao encontrado', 404);
      }

      // Propostas comerciais (C2) — só com estimativa de custos (WBS) do lead
      if (seg[0]==='propostas'){
        if (method==='GET' && !seg[1]){
          const all = await listDocs(env, 'propostas', { searchParams: new URLSearchParams() });
          const lead = url.searchParams.get('lead_id');
          return J(lead ? all.filter(p => String(p.lead_id) === String(lead)) : all);
        }
        if (method==='POST' && !seg[1]){
          const b = body || {};
          const lead = b.lead_id ? await getDoc(env, 'crm', b.lead_id) : null;
          const wbs = await listDocs(env, 'wbs_linhas', { searchParams: new URLSearchParams() });
          const linhas = wbs.filter(w => String(w.lead_id ?? '') === String(b.lead_id) && (w.ativo ?? 1) !== 0);
          const custo = linhas.reduce((s, w) => s + (Number(w.valor_total_est) || 0), 0);
          const gate = podeGerarProposta(lead, linhas.length > 0);
          if (!gate.ok) return E('Proposta bloqueada: ' + gate.motivo, 409);
          const margem = Number(b.margem) || 0;
          const valor_total = b.valor_total != null ? Number(b.valor_total) : custo * (1 + margem / 100);
          const all = await listDocs(env, 'propostas', { searchParams: new URLSearchParams() });
          const numero = `PROP-${new Date().getFullYear()}-${String(all.length + 1).padStart(3, '0')}`;
          const r = await createDoc(env, 'propostas', { numero, lead_id: b.lead_id, cliente: b.cliente ?? (lead && lead.cliente), objeto: b.objeto ?? (lead && lead.titulo), custo_estimado: custo, margem, valor_total, status: 'Em Elaboração' });
          await updateDoc(env, 'crm', b.lead_id, { orcamentacao_status: 'concluida' });
          await audit(env, user.sub, 'proposta_criada', 'propostas', r.id, {});
          return J(r, 201);
        }
      }

      // WBS — linhas de custo (entidade) com vínculo a contrato/projeto/lead
      if (seg[0]==='wbs'){
        if (seg[1]==='rollup' && method==='GET'){
          const all = await listDocs(env, 'wbs_linhas', { searchParams: new URLSearchParams() });
          const cid = url.searchParams.get('contrato_id');
          const linhas = (cid ? all.filter(l => String(l.contrato_id ?? '') === String(cid)) : all).filter(l => (l.ativo ?? 1) !== 0);
          return J(montarRollupWBS(linhas));
        }
        if (method==='GET' && !seg[1]){
          const all = await listDocs(env, 'wbs_linhas', { searchParams: new URLSearchParams() });
          const q = url.searchParams;
          let rows = all;
          for (const k of ['contrato_id', 'projeto_id', 'lead_id']) if (q.get(k)) rows = rows.filter(x => String(x[k] ?? '') === String(q.get(k)));
          const ativo = q.get('ativo');
          if (ativo !== 'todos') rows = rows.filter(x => (x.ativo ?? 1) === (ativo === '0' ? 0 : 1));
          rows.sort((a, b) => String(a.codigo || '').localeCompare(String(b.codigo || '')));
          return J(rows);
        }
        if (method==='POST' && !seg[1]){
          const b = body || {};
          if (!b.descricao && !b.codigo) return E('Informe ao menos codigo ou descricao', 400);
          const qtd = Number(b.quantidade) || 0, vUnit = Number(b.valor_unit_est) || 0;
          const vTotal = b.valor_total_est != null ? Number(b.valor_total_est) : qtd * vUnit;
          const r = await createDoc(env, 'wbs_linhas', { codigo: b.codigo ?? null, descricao: b.descricao ?? null, natureza: b.natureza ?? null, tipo: b.tipo || 'OPEX', contrato_id: b.contrato_id ?? null, projeto_id: b.projeto_id ?? null, centro_custo: b.centro_custo ?? null, lead_id: b.lead_id ?? null, origem: b.origem || 'contrato', unidade: b.unidade ?? null, quantidade: qtd, valor_unit_est: vUnit, valor_total_est: vTotal, custo_real: 0, nao_previsto: b.nao_previsto ? 1 : 0, ativo: 1 });
          // C1: WBS de orçamentação vinculada a um lead → estimativa em andamento.
          if (b.lead_id){
            const lead = await getDoc(env, 'crm', b.lead_id);
            if (lead && ['pendente', 'nao_iniciada'].includes(lead.orcamentacao_status || 'nao_iniciada')) await updateDoc(env, 'crm', b.lead_id, { orcamentacao_status: 'em_andamento' });
          }
          await audit(env, user.sub, 'create', 'wbs_linhas', r.id, {});
          return J(r, 201);
        }
        if ((method==='PUT' || method==='PATCH') && seg[1]){
          const cur = await getDoc(env, 'wbs_linhas', seg[1]);
          if (!cur) return E('Linha WBS nao encontrada', 404);
          const b = body || {}; const v = k => b[k] !== undefined ? b[k] : cur[k];
          const qtd = Number(v('quantidade')) || 0, vUnit = Number(v('valor_unit_est')) || 0;
          const vTotal = b.valor_total_est != null ? Number(b.valor_total_est) : qtd * vUnit;
          const r = await updateDoc(env, 'wbs_linhas', seg[1], { codigo: v('codigo'), descricao: v('descricao'), natureza: v('natureza'), tipo: v('tipo'), contrato_id: v('contrato_id'), projeto_id: v('projeto_id'), centro_custo: v('centro_custo'), lead_id: v('lead_id'), origem: v('origem'), unidade: v('unidade'), quantidade: qtd, valor_unit_est: vUnit, valor_total_est: vTotal, custo_real: Number(v('custo_real')) || 0, nao_previsto: b.nao_previsto != null ? (b.nao_previsto ? 1 : 0) : cur.nao_previsto });
          await audit(env, user.sub, 'update', 'wbs_linhas', seg[1], {});
          return r ? J(r) : E('nao encontrado', 404);
        }
        if (method==='DELETE' && seg[1]){
          const cur = await getDoc(env, 'wbs_linhas', seg[1]);
          if (!cur) return E('Linha WBS nao encontrada', 404);
          const r = await updateDoc(env, 'wbs_linhas', seg[1], { ativo: 0 });
          await audit(env, user.sub, 'delete', 'wbs_linhas', seg[1], {});
          return r ? J({ ok: true }) : E('nao encontrado', 404);
        }
      }

      // Notificações (in-app) — escopo por usuário/perfil/global
      if (seg[0]==='notificacoes'){
        const all = { searchParams: new URLSearchParams() };
        if (seg[1]==='contagem' && method==='GET'){
          const docs = await listDocs(env, 'notificacoes', all);
          return J({ nao_lidas: docs.filter(x => !x.lida && notificacaoNoEscopo(x, user)).length });
        }
        if (seg[1]==='ler-todas' && method==='POST'){
          const docs = await listDocs(env, 'notificacoes', all);
          for (const x of docs) if (!x.lida && notificacaoNoEscopo(x, user)) await updateDoc(env, 'notificacoes', x.id, { lida: 1 });
          return J({ ok: true });
        }
        if (seg[2]==='lida' && method==='POST'){
          const x = await getDoc(env, 'notificacoes', seg[1]);
          if (!x || !notificacaoNoEscopo(x, user)) return E('Notificacao nao encontrada', 404);
          const r = await updateDoc(env, 'notificacoes', seg[1], { lida: 1 });
          return r ? J({ ok: true }) : E('nao encontrado', 404);
        }
        if (method==='POST' && !seg[1]){
          requireRole(user, ['admin','diretor','financeiro','compliance']);
          if (!body.titulo) return E('Titulo obrigatorio', 400);
          await notificarWorker(env, { usuario_id: body.usuario_id || null, perfil: body.perfil || null, titulo: body.titulo, mensagem: body.mensagem || '', tipo: body.tipo || 'info' });
          return J({ ok: true }, 201);
        }
        if (method==='GET' && !seg[1]){
          const docs = await listDocs(env, 'notificacoes', all);
          return J(docs.filter(x => notificacaoNoEscopo(x, user)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 100));
        }
      }

      // Fiscal — NF-e/NFS-e/CT-e
      if (seg[0]==='nfe'){
        if (method==='GET' && !seg[1]) return J(await listDocs(env, 'notas_fiscais', url));
        if (method==='GET' && seg[1] && seg[1] !== 'emitir'){ const d = await getDoc(env, 'notas_fiscais', seg[1]); return d ? J(d) : E('Nota nao encontrada', 404); }
        if (seg[1]==='emitir' && method==='POST'){
          requireRole(user, ['admin','financeiro','fiscal']);
          const serie = Number(body.serie) || 1;
          const existentes = await listDocs(env, 'notas_fiscais', { searchParams: new URLSearchParams() });
          const numero = Number(body.numero) || (existentes.filter(n => Number(n.serie) === serie).length + 1);
          let r; try { r = await emitirNotaFiscal({ ...body, numero, serie }, { provider: env.NFE_PROVIDER }); } catch(e){ return E(e.message, 400); }
          if (r.status !== 'autorizada') return E('Emissao rejeitada: ' + (r.motivo || 'dados invalidos'), 422);
          const destinatario = body.cnpj_destinatario || body.cpf_destinatario || body.destinatario || '';
          const doc = await createDoc(env, 'notas_fiscais', { ...r, cnpj_emitente: body.cnpj_emitente || '', destinatario, descricao: body.descricao || '', pedido_id: body.pedido_id || null, emitido_por: user.name });
          await audit(env, user.sub, 'nfe_emitir', 'notas_fiscais', doc.id, { chave: r.chave });
          return J(doc, 201);
        }
        if (seg[2]==='cancelar' && method==='POST'){
          requireRole(user, ['admin','financeiro','fiscal']);
          const n = await getDoc(env, 'notas_fiscais', seg[1]);
          if (!n) return E('Nota nao encontrada', 404);
          if (n.status === 'cancelada') return E('Nota ja cancelada', 409);
          let r; try { r = cancelarNotaFiscal(n.chave, body && body.justificativa, { provider: env.NFE_PROVIDER }); } catch(e){ return E(e.message, 400); }
          if (r.status !== 'cancelada') return E(r.motivo || 'cancelamento rejeitado', 400);
          const upd = await updateDoc(env, 'notas_fiscais', seg[1], { status:'cancelada', justificativa_cancel: String(body.justificativa).trim() });
          await audit(env, user.sub, 'nfe_cancelar', 'notas_fiscais', seg[1], {});
          return upd ? J(upd) : E('nao encontrado', 404);
        }
      }

      // Análise financeira prévia: POST /api/analise-financeira { cnpj }
      if (seg[0]==='analise-financeira' && method==='POST'){
        const bureau = bureauMock(body && body.cnpj);
        if (!bureau) return E('CNPJ invalido (14 digitos)', 400);
        const receita = situacaoReceitaMock(body && body.cnpj) || {};
        const parecer = analisarFinanceiro({ bureau, receita });
        return J({ ...parecer, bureau, receita });
      }

      // Cadastro completo por CNPJ (proxy server-side): GET /api/cnpj/:cnpj
      if (seg[0]==='cnpj' && seg[1] && method==='GET'){
        const prov = String(env.RECEITA_PROVIDER||'mock').toLowerCase();
        if (prov !== 'mock') return E('Provedor de cadastro CNPJ nao configurado: ' + prov, 400);
        const d = cadastroCNPJMock(seg[1]);
        return d ? J(d) : E('CNPJ invalido (14 digitos)', 400);
      }

      // Relatório de duplicatas: GET /api/duplicatas (fornecedor por CNPJ / NF)
      if (seg[0]==='duplicatas' && method==='GET'){
        const all = { searchParams: new URLSearchParams() };
        const fornecedores = await listDocs(env, 'fornecedores', all);
        const contas = await listDocs(env, 'contas_pagar', all);
        return J(detectarDuplicatas({ fornecedores, contas }));
      }

      // LGPD — anonimizar fornecedor: POST /api/lgpd/anonimizar/fornecedores/:id
      if (seg[0]==='lgpd' && seg[1]==='anonimizar' && seg[2]==='fornecedores' && seg[3] && method==='POST') return await anonimizarFornecedor(env, seg[3], user);
      // LGPD — retenção: preview (GET) e execução (POST)
      if (seg[0]==='lgpd' && seg[1]==='retencao' && seg[2]==='fornecedores' && seg[3]==='executar' && method==='POST') return await retencaoExecutarFornecedores(env, user);
      if (seg[0]==='lgpd' && seg[1]==='retencao' && seg[2]==='fornecedores' && method==='GET') return await retencaoPreviewFornecedores(env, user);

      // Trilha de auditoria imutável: GET /api/auditoria/verificar (admin)
      if (seg[0]==='auditoria' && seg[1]==='verificar' && method==='GET'){ requireRole(user,['admin']); return await verificarAuditoria(env); }


      // RC — criação/edição com tipo + WBS obrigatórios (compliance, espelha o Express)
      if (seg[0]==='rc' && !seg[1] && method==='POST'){
        const tipo = normalizarTipoRC(body.tipo);
        if (!tipo) return E('Tipo da RC obrigatorio: Material, Servico ou Equipamento', 400);
        if (!body.wbs || !String(body.wbs).trim()) return E('Vinculo WBS obrigatorio na RC (rastreabilidade de custo)', 400);
        const r = await createDoc(env, 'rc', { ...body, tipo, wbs: String(body.wbs).trim() });
        await audit(env, user.sub, 'create', 'rc', r.id, {});
        return J(r);
      }
      if (seg[0]==='rc' && seg[1] && !seg[2] && (method==='PUT' || method==='PATCH')){
        const cur = await getDoc(env, 'rc', seg[1]);
        if (!cur) return E('nao encontrado', 404);
        const patch = { ...body };
        if (body.tipo !== undefined){ const t = normalizarTipoRC(body.tipo); if (!t) return E('Tipo da RC invalido: use Material, Servico ou Equipamento', 400); patch.tipo = t; }
        if (body.wbs !== undefined){ if (!String(body.wbs).trim()) return E('WBS nao pode ser removida da RC', 400); patch.wbs = String(body.wbs).trim(); }
        const r = await updateDoc(env, 'rc', seg[1], patch);
        await audit(env, user.sub, 'update', 'rc', seg[1], {});
        return r ? J(r) : E('nao encontrado', 404);
      }

      // Centros de custo de overhead (OS administrativa). Lista fixa por env.
      if (seg[0]==='overhead-centros' && method==='GET'){
        return J((env.OVERHEAD_CENTROS || 'Administrativo,TI,RH,Comercial,Financeiro,SSMA,Diretoria,Manutenção Interna').split(',').map(s => s.trim()).filter(Boolean));
      }
      // OS — criação com WBS + amarração a Contrato/Overhead (A2, espelha o Express)
      if (seg[0]==='os' && !seg[1] && method==='POST'){
        if (!body.titulo) return E('Titulo obrigatorio', 400);
        if (!body.wbs || !String(body.wbs).trim()) return E('Vinculo WBS obrigatorio na OS (rastreabilidade de custo)', 400);
        const centros = (env.OVERHEAD_CENTROS || 'Administrativo,TI,RH,Comercial,Financeiro,SSMA,Diretoria,Manutenção Interna').split(',').map(s => s.trim());
        const tiposRec = ['material', 'servico', 'locacao', 'mao_obra'];
        if (!body.contrato_id && !body.centro_custo_overhead) return E('Informe o Contrato ou o centro de custo de overhead (OS administrativa)', 400);
        if (body.centro_custo_overhead && !centros.includes(body.centro_custo_overhead)) return E('Centro de custo de overhead invalido', 400);
        const tipo = body.tipo_recurso ? String(body.tipo_recurso).toLowerCase() : 'material';
        if (!tiposRec.includes(tipo)) return E('Tipo de recurso invalido (material, servico, locacao, mao_obra)', 400);
        if (body.wbs_linha_id){
          const linha = await getDoc(env, 'wbs_linhas', body.wbs_linha_id);
          if (!linha) return E('Linha WBS informada nao existe', 400);
          if (body.contrato_id && !wbsPertenceAoContrato(linha, body.contrato_id)) return E('A linha WBS nao pertence ao contrato da OS', 409);
        }
        const r = await createDoc(env, 'os', { ...body, wbs: String(body.wbs).trim(), tipo_recurso: tipo });
        await audit(env, user.sub, 'create', 'os', r.id, {});
        return J(r);
      }
      // OS — concluir e lançar custo realizado na linha WBS (espelha o Express)
      if (seg[0]==='os' && seg[2]==='concluir' && method==='POST'){
        const os = await getDoc(env, 'os', seg[1]);
        if (!os) return E('OS nao encontrada', 404);
        if (os.status === 'Concluída') return E('OS ja concluida', 409);
        const custo = Number(body && body.custo_realizado) || 0;
        await updateDoc(env, 'os', seg[1], { status: 'Concluída' });
        let wbs_linha = null;
        if (os.wbs_linha_id && custo > 0){
          const linha = await getDoc(env, 'wbs_linhas', os.wbs_linha_id);
          if (linha){
            const novo = (Number(linha.custo_real) || 0) + custo;
            await updateDoc(env, 'wbs_linhas', os.wbs_linha_id, { custo_real: novo });
            wbs_linha = { id: linha.id, codigo: linha.codigo, descricao: linha.descricao, valor_total_est: linha.valor_total_est, custo_real: novo };
          }
        }
        await audit(env, user.sub, 'os_concluir', 'os', seg[1], {});
        const fin = await getDoc(env, 'os', seg[1]);
        return J({ os: fin, wbs_linha });
      }
      if (seg[0]==='os' && seg[1] && !seg[2] && (method==='PUT' || method==='PATCH')){
        const cur = await getDoc(env, 'os', seg[1]);
        if (!cur) return E('nao encontrado', 404);
        const patch = { ...body };
        if (body.wbs !== undefined){ if (!String(body.wbs).trim()) return E('WBS nao pode ser removida da OS', 400); patch.wbs = String(body.wbs).trim(); }
        const r = await updateDoc(env, 'os', seg[1], patch);
        await audit(env, user.sub, 'update', 'os', seg[1], {});
        return r ? J(r) : E('nao encontrado', 404);
      }

      // SSMA — encerramento bloqueado sem RCA (causa raiz + plano de ação)
      if (seg[0]==='ssma' && seg[2]==='encerrar' && method==='POST'){
        const oc = await getDoc(env, 'ssma', seg[1]);
        if (!oc) return E('Ocorrencia nao encontrada', 404);
        if (oc.status === 'Encerrada') return E('Ocorrencia ja encerrada', 409);
        const causa_raiz = (body.causa_raiz !== undefined) ? body.causa_raiz : oc.causa_raiz;
        const plano_acao = (body.plano_acao !== undefined) ? body.plano_acao : oc.plano_acao;
        if (!rcaCompleto({ causa_raiz, plano_acao })) return E('Encerramento exige RCA: informe a causa raiz e o plano de acao', 400);
        const r = await updateDoc(env, 'ssma', seg[1], { status: 'Encerrada', data_resolucao: new Date().toISOString(), causa_raiz, plano_acao });
        await audit(env, user.sub, 'ssma_encerrar', 'ssma', seg[1], {});
        return r ? J(r) : E('nao encontrado', 404);
      }

      // Mapa comparativo — concorrência mínima (compliance, espelha o Express)
      if (seg[0]==='mapas' && !seg[1] && method==='POST'){
        if (!body.rfq_id || !body.cotacao_vencedora_id) return E('RFQ e cotacao vencedora obrigatorios', 400);
        const rfq = await getDoc(env, 'rfq', body.rfq_id);
        const numCotacoes = (rfq && Array.isArray(rfq.cotacoes)) ? rfq.cotacoes.length : (Number(body.num_cotacoes) || 0);
        const conc = avaliarConcorrencia({
          valor: body.valor_aprovado || 0, numCotacoes, justificativa: body.justificativa, perfil: user.role,
          valorMin: parseFloat(env.CONCORRENCIA_VALOR_MIN) || 10000, minCotacoes: parseInt(env.CONCORRENCIA_MIN_COTACOES) || 3,
        });
        if (!conc.ok){ await audit(env, user.sub, 'concorrencia_bloqueada', 'mapas', null, { motivo: conc.motivo }); return E(conc.motivo, 409); }
        const r = await createDoc(env, 'mapas', { ...body, status: 'Em análise' });
        if (conc.excecao) await audit(env, user.sub, 'concorrencia_excecao', 'mapas', r.id, { numCotacoes, justificativa: body.justificativa });
        await audit(env, user.sub, 'create', 'mapas', r.id, {});
        return J(r);
      }

      // Fornecedor — bloqueia CNPJ duplicado no cadastro (qualidade de dados)
      if (seg[0]==='fornecedores' && !seg[1] && method==='POST'){
        const dig = normalizarCNPJ(body.cnpj);
        if (dig){
          const all = { searchParams: new URLSearchParams() };
          const existentes = await listDocs(env, 'fornecedores', all);
          const dup = existentes.find(f => normalizarCNPJ(f.cnpj) === dig);
          if (dup) return E(`CNPJ ja cadastrado no fornecedor "${dup.nome}" (#${dup.id}) - duplicata`, 409);
        }
        const r = await createDoc(env, 'fornecedores', body);
        await audit(env, user.sub, 'create', 'fornecedores', r.id, {});
        // Notifica Financeiro e Compliance: novo fornecedor a homologar.
        const msg = `${body.nome || ''} aguarda aprovacao Financeiro + Compliance.`;
        await notificarWorker(env, { perfil: 'financeiro', titulo: 'Novo fornecedor a homologar', mensagem: msg, tipo: 'homologacao', ref_tipo: 'fornecedor', ref_id: String(r.id) });
        await notificarWorker(env, { perfil: 'compliance', titulo: 'Novo fornecedor a homologar', mensagem: msg, tipo: 'homologacao', ref_tipo: 'fornecedor', ref_id: String(r.id) });
        return J(r);
      }
      // Fornecedor — IDF (índice de desempenho): GET /api/fornecedores/:id/idf
      if (seg[0]==='fornecedores' && seg[2]==='idf' && method==='GET'){
        const f = await getDoc(env, 'fornecedores', seg[1]);
        if (!f) return E('Fornecedor nao encontrado', 404);
        const pedidos = await listDocs(env, 'pedidos', { searchParams: new URLSearchParams({ fornecedor_id: String(seg[1]) }) });
        const avaliacoes = Array.isArray(f.avaliacoes) ? f.avaliacoes : [];
        return J({ fornecedor_id: f.id, nome: f.nome, ...calcularIDF({ pedidos, avaliacoes }) });
      }

      // Fornecedor — homologação de cadastro (Financeiro + Compliance)
      if (seg[0]==='fornecedores' && seg[2]==='homologar' && (seg[3]==='financeiro' || seg[3]==='compliance') && method==='POST'){
        const etapa = seg[3];
        requireRole(user, etapa === 'financeiro' ? ['admin','financeiro'] : ['admin','diretor','compliance']);
        const f = await getDoc(env, 'fornecedores', seg[1]);
        if (!f) return E('Fornecedor nao encontrado', 404);
        if (f.status === 'Homologado') return E('Fornecedor ja homologado', 409);
        const patch = etapa === 'financeiro'
          ? { aprovado_financeiro_por: user.name, aprovado_financeiro_em: new Date().toISOString() }
          : { aprovado_compliance_por: user.name, aprovado_compliance_em: new Date().toISOString() };
        if (({ ...f, ...patch }).aprovado_financeiro_por && ({ ...f, ...patch }).aprovado_compliance_por) patch.status = 'Homologado';
        const r = await updateDoc(env, 'fornecedores', seg[1], patch);
        await audit(env, user.sub, `homologacao_${etapa}`, 'fornecedores', seg[1], {});
        return r ? J(r) : E('nao encontrado', 404);
      }
      if (seg[0]==='fornecedores' && seg[2]==='reprovar-homologacao' && method==='POST'){
        requireRole(user, ['admin','diretor','compliance','financeiro']);
        const f = await getDoc(env, 'fornecedores', seg[1]);
        if (!f) return E('Fornecedor nao encontrado', 404);
        const r = await updateDoc(env, 'fornecedores', seg[1], { status: 'Reprovado', aprovado_financeiro_por: null, aprovado_financeiro_em: null, aprovado_compliance_por: null, aprovado_compliance_em: null });
        await audit(env, user.sub, 'homologacao_reprovada', 'fornecedores', seg[1], {});
        return r ? J(r) : E('nao encontrado', 404);
      }
      // Fornecedor — aprovação/rejeição de alteração bancária (dupla aprovação)
      if (seg[0]==='fornecedores' && seg[2]==='aprovar-banco' && method==='POST'){
        requireRole(user, ['admin','diretor','financeiro']);
        const f = await getDoc(env, 'fornecedores', seg[1]);
        if (!f) return E('Fornecedor nao encontrado', 404);
        if (!f.banco_solicitado_por) return E('Nao ha alteracao bancaria pendente', 400);
        if (f.banco_solicitado_por === user.name) return E('A aprovacao deve ser feita por outro usuario (segregacao)', 403);
        const r = await updateDoc(env, 'fornecedores', seg[1], { banco: f.banco_pendente, agencia: f.agencia_pendente, conta: f.conta_pendente, banco_pendente: null, agencia_pendente: null, conta_pendente: null, banco_solicitado_por: null, banco_solicitado_em: null });
        await audit(env, user.sub, 'banco_alteracao_aprovada', 'fornecedores', seg[1], {});
        return r ? J(r) : E('nao encontrado', 404);
      }
      if (seg[0]==='fornecedores' && seg[2]==='rejeitar-banco' && method==='POST'){
        requireRole(user, ['admin','diretor','financeiro']);
        const f = await getDoc(env, 'fornecedores', seg[1]);
        if (!f) return E('Fornecedor nao encontrado', 404);
        if (!f.banco_solicitado_por) return E('Nao ha alteracao bancaria pendente', 400);
        const r = await updateDoc(env, 'fornecedores', seg[1], { banco_pendente: null, agencia_pendente: null, conta_pendente: null, banco_solicitado_por: null, banco_solicitado_em: null });
        await audit(env, user.sub, 'banco_alteracao_rejeitada', 'fornecedores', seg[1], {});
        return r ? J(r) : E('nao encontrado', 404);
      }
      // Fornecedor — PUT: dados bancários ficam pendentes de 2ª aprovação
      if (seg[0]==='fornecedores' && seg[1] && !seg[2] && (method==='PUT' || method==='PATCH')){
        const atual = await getDoc(env, 'fornecedores', seg[1]);
        if (!atual) return E('nao encontrado', 404);
        const bankChange = alteracaoBancariaSolicitada(atual, body);
        const patch = { ...body };
        delete patch.banco; delete patch.agencia; delete patch.conta; // nunca direto
        if (bankChange){
          patch.banco_pendente = bankChange.banco ?? atual.banco;
          patch.agencia_pendente = bankChange.agencia ?? atual.agencia;
          patch.conta_pendente = bankChange.conta ?? atual.conta;
          patch.banco_solicitado_por = user.name;
          patch.banco_solicitado_em = new Date().toISOString();
        }
        const r = await updateDoc(env, 'fornecedores', seg[1], patch);
        await audit(env, user.sub, bankChange ? 'banco_alteracao_solicitada' : 'update', 'fornecedores', seg[1], {});
        return r ? J(r) : E('nao encontrado', 404);
      }

      // Pedido — homologação + situação cadastral do fornecedor antes da emissão
      if (seg[0]==='pedidos' && !seg[1] && method==='POST'){
        if (body.fornecedor_id){
          const f = await getDoc(env, 'fornecedores', body.fornecedor_id);
          // Compliance: fornecedor precisa estar HOMOLOGADO (Financeiro + Compliance).
          if (f && (env.ENFORCE_HOMOLOGACAO_PO ?? '1') !== '0' && !fornecedorHomologado(f)){
            await audit(env, user.sub, 'po_bloqueada_homologacao', 'pedidos', null, {});
            return E('Emissao bloqueada: fornecedor nao homologado (pendente de aprovacao Financeiro/Compliance)', 409);
          }
          if (f && f.cnpj && (env.ENFORCE_RECEITA_PO ?? '1') !== '0'){
            const s = situacaoReceitaMock(f.cnpj);
            if (s && !s.regular){
              await audit(env, user.sub, 'po_bloqueada_receita', 'pedidos', null, { situacao: s.situacao_cadastral });
              return E(`Emissao bloqueada: fornecedor com situacao cadastral irregular na Receita (${s.situacao_cadastral})`, 409);
            }
          }
        }
        const r = await createDoc(env, 'pedidos', body);
        await audit(env, user.sub, 'create', 'pedidos', r.id, {});
        return J(r);
      }

      // CRUD generico — escopado por tenant: o create carimba a empresa do
      // usuário (spoof no corpo é sobrescrito), listas filtram, e operações
      // por id devolvem 404 quando o doc pertence a outra empresa.
      if (TABLES[seg[0]]){
        const table = TABLES[seg[0]];
        const emp = empresaDoUsuario(user);
        if (method==='GET' && !seg[1]) return J((await listDocs(env, table, url)).filter(d => docPertenceEmpresa(d, emp)));
        if (method==='GET' && seg[1]){ const d=await getDoc(env,table,seg[1]); return (d && docPertenceEmpresa(d, emp))?J(d):E('nao encontrado',404); }
        if (method==='POST'){ const r=await createDoc(env,table,{ ...body, empresa_id: emp }); await audit(env,user.sub,'create',table,r.id,{}); return J(r); }
        if ((method==='PUT'||method==='PATCH') && seg[1]){
          const cur=await getDoc(env,table,seg[1]);
          if (!cur || !docPertenceEmpresa(cur, emp)) return E('nao encontrado',404);
          const r=await updateDoc(env,table,seg[1],{ ...body, empresa_id: Number(cur.empresa_id)||1 });
          await audit(env,user.sub,'update',table,seg[1],{});
          return J(r);
        }
        if (method==='DELETE' && seg[1]){
          const cur=await getDoc(env,table,seg[1]);
          if (!cur || !docPertenceEmpresa(cur, emp)) return E('nao encontrado',404);
          await audit(env,user.sub,'delete',table,seg[1],{});
          return J(await deleteDoc(env,table,seg[1]));
        }
      }

      return E('rota nao encontrada: ' + path, 404);
    } catch(err){
      if (err && err.code) return E(err.msg, err.code);
      return E('erro interno: ' + (err && err.message ? err.message : String(err)), 500);
    }
  }
};

// Exporta as regras puras (isolamento, alertas, KPIs, tipo RC) p/ teste unitário.
export { portalScope, pedidoPertence, montarAlertasWorker, montarKPIsWorker, normalizarTipoRC, classificarVencimentoContrato, avaliarConcorrencia, rcaCompleto, alcadaPendente, situacaoReceitaMock, normalizarCNPJ, detectarDuplicatas, alteracaoBancariaSolicitada, montarFluxoCaixa, cadastroCNPJMock, fornecedorHomologado, analisarFinanceiro, bureauMock, calcularIDF, emitirNotaFiscal, cancelarNotaFiscal, enviarEmail, notificacaoNoEscopo, wbsPertenceAoContrato, exigeAceiteServico, precisaOrcamentacao, podeGerarProposta, montarRollupWBS, empresaDoUsuario, docPertenceEmpresa, validarSenhaForte };
