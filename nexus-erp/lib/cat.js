/**
 * cat.js — CAT (Comunicação de Acidente de Trabalho) e evento eSocial S-2210.
 * Puro, sem I/O.
 *
 * Base legal: Lei 8.213/91 art. 22 — a CAT deve ser comunicada até o 1º DIA
 * ÚTIL seguinte ao acidente; em caso de ÓBITO, de imediato. A não comunicação
 * é infração (multa) e prejudica o direito do trabalhador. Este módulo calcula
 * o prazo legal, o status (no prazo/atrasada) e monta o payload do evento
 * eSocial S-2210 (CAT) a partir do incidente de SSMA — fechando o ciclo
 * incidente → obrigação legal.
 *
 * Nota: o cálculo de dia útil considera fins de semana (sáb/dom). Feriados
 * nacionais/locais NÃO são tratados (limitação assumida) — o prazo real pode
 * ser um dia à frente em vésperas de feriado.
 */

const _MS_DIA = 864e5
function _ymd(d) { return String(d || '').slice(0, 10) }
function _diaSemana(ymd) { return new Date(_ymd(ymd) + 'T00:00:00Z').getUTCDay() } // 0=dom..6=sáb
function _somaDias(ymd, n) {
  return new Date(new Date(_ymd(ymd) + 'T00:00:00Z').getTime() + n * _MS_DIA).toISOString().slice(0, 10)
}

// Prazo legal da CAT: óbito = mesmo dia (imediato); senão, 1º dia útil seguinte.
export function prazoCAT(dataAcidente, obito = false) {
  const d = _ymd(dataAcidente)
  if (!d) return ''
  if (obito) return d
  let p = _somaDias(d, 1)
  const dow = _diaSemana(p)
  if (dow === 6) p = _somaDias(p, 2)      // sábado → segunda
  else if (dow === 0) p = _somaDias(p, 1) // domingo → segunda
  return p
}

// Status do prazo. Para CAT já emitida, compara a emissão com o prazo
// (Emitida no prazo / Emitida com atraso). Pendente compara hoje com o prazo.
export function statusPrazoCAT({ data_emissao, prazo_legal } = {}, hoje) {
  const h = _ymd(hoje)
  const prazo = _ymd(prazo_legal)
  if (data_emissao) return _ymd(data_emissao) <= prazo ? 'Emitida no prazo' : 'Emitida com atraso'
  if (!prazo) return 'Pendente'
  return h <= prazo ? 'Pendente' : 'Atrasada'
}

// Tipo da CAT no S-2210: 1 inicial, 2 reabertura, 3 comunicação de óbito.
export function tipoCatCodigo(tipo) {
  const t = String(tipo || '').toLowerCase()
  if (t.includes('óbito') || t.includes('obito')) return 3
  if (t.includes('reabert')) return 2
  return 1
}

// Campos mínimos para emitir a CAT (validação de negócio antes do S-2210).
export function validarCAT(cat = {}) {
  const faltando = []
  if (!_ymd(cat.data_acidente)) faltando.push('data_acidente')
  if (!cat.colaborador_id) faltando.push('colaborador_id')
  if (!String(cat.descricao || '').trim()) faltando.push('descricao')
  return { ok: faltando.length === 0, faltando }
}

// Só dígitos (CPF/CNPJ) para o payload eSocial.
function _digitos(v) { return String(v || '').replace(/\D/g, '') }

/**
 * Monta o evento eSocial S-2210 (CAT) — estrutura evtCAT com os grupos
 * exigidos pelo layout. `tpAmb`: 1 produção, 2 produção-restrita (default 2,
 * homologação). Campos sem dado ficam null para o integrador preencher.
 */
export function montarS2210(cat = {}, colaborador = {}, empresa = {}, opts = {}) {
  const tpAmb = opts.tpAmb || 2
  const obito = !!cat.obito
  return {
    evtCAT: {
      ideEvento: { indRetif: 1, tpAmb, procEmi: 1, verProc: 'NEXUS-ERP' },
      ideEmpregador: { tpInsc: 1, nrInsc: _digitos(empresa.cnpj).slice(0, 8) || null },
      ideVinculo: {
        cpfTrab: _digitos(colaborador.cpf) || null,
        matricula: colaborador.matricula || (colaborador.id != null ? 'COLAB-' + colaborador.id : null),
      },
      infoCAT: {
        dtAcid: _ymd(cat.data_acidente) || null,
        tpAcid: cat.tipo_acidente || 1,          // 1 típico
        hrAcid: cat.hora_acidente || null,        // HHMM
        hrsTrabAntesAcid: cat.horas_trab_antes || null,
        tpCat: tipoCatCodigo(cat.tipo),
        indCatObito: obito ? 'S' : 'N',
        dtObito: obito ? (_ymd(cat.data_obito) || null) : null,
        indComunPolicia: cat.comunicou_policia ? 'S' : 'N',
        codSitGeradora: cat.agente_causador || null,
        iniciatCAT: cat.iniciativa || 1,          // 1 iniciativa do empregador
        obsCAT: cat.descricao || null,
        localAcidente: {
          tpLocal: cat.tipo_local || 1,
          dscLograd: cat.local || null,
        },
        parteAtingida: cat.parte_atingida ? {
          codParteAting: cat.parte_atingida,
          lateralidade: cat.lateralidade || 0,
        } : null,
        agenteCausador: cat.agente_causador ? { codAgntCausador: cat.agente_causador } : null,
        atestado: (cat.cid || cat.dias_afastamento) ? {
          codCID: cat.cid || null,
          dtAtendimento: _ymd(cat.data_atendimento) || _ymd(cat.data_acidente) || null,
          indInternacao: cat.internacao ? 'S' : 'N',
          durTrat: cat.dias_afastamento != null ? Number(cat.dias_afastamento) : null,
          indAfast: cat.com_afastamento ? 'S' : 'N',
        } : null,
      },
    },
  }
}
