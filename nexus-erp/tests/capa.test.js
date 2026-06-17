// Testes do workflow de CAPA (motor puro).
import { describe, expect, it } from 'vitest'
import CAPA from '../public/js/lib/capa.js'

const HOJE = '2026-06-16'

describe('CAPA — fluxo de status', () => {
  it('próximo status segue a ordem do fluxo', () => {
    expect(CAPA.proximoStatus('Aberta')).toBe('Em Ação')
    expect(CAPA.proximoStatus('Em Ação')).toBe('Verificação')
    expect(CAPA.proximoStatus('Verificação')).toBe('Fechada')
    expect(CAPA.proximoStatus('Fechada')).toBeNull()
  })

  it('transição válida: avança um passo ou fecha; fechada é terminal', () => {
    expect(CAPA.transicaoValida('Aberta', 'Em Ação')).toBe(true)
    expect(CAPA.transicaoValida('Aberta', 'Fechada')).toBe(true)
    expect(CAPA.transicaoValida('Aberta', 'Verificação')).toBe(false) // pula etapa
    expect(CAPA.transicaoValida('Fechada', 'Aberta')).toBe(false)     // terminal
  })
})

describe('CAPA — estado e atraso', () => {
  it('detecta atraso quando o prazo passou e não está fechada', () => {
    const e = CAPA.estadoCapa({ status: 'Em Ação', prazo: '2026-06-10' }, HOJE)
    expect(e.atrasada).toBe(true)
    expect(e.statusEfetivo).toBe('Atrasada')
    expect(e.diasRestantes).toBeLessThan(0)
  })

  it('CAPA fechada nunca é atrasada', () => {
    const e = CAPA.estadoCapa({ status: 'Fechada', prazo: '2020-01-01' }, HOJE)
    expect(e.atrasada).toBe(false)
    expect(e.fechada).toBe(true)
  })

  it('dentro do prazo não é atrasada', () => {
    const e = CAPA.estadoCapa({ status: 'Aberta', prazo: '2026-12-31' }, HOJE)
    expect(e.atrasada).toBe(false)
    expect(e.diasRestantes).toBeGreaterThan(0)
  })
})

describe('CAPA — resumo/KPIs', () => {
  it('agrega contagens e % no prazo', () => {
    const lista = [
      { status: 'Aberta', prazo: '2026-06-10' },     // atrasada
      { status: 'Em Ação', prazo: '2026-12-31' },    // no prazo
      { status: 'Verificação', prazo: '2026-12-31' },// no prazo
      { status: 'Fechada', prazo: '2020-01-01' },    // fechada (não conta atraso)
    ]
    const r = CAPA.resumoCapa(lista, HOJE)
    expect(r.total).toBe(4)
    expect(r.fechadas).toBe(1)
    expect(r.atrasadas).toBe(1)
    expect(r.emAndamento).toBe(3)
    expect(r.percentNoPrazo).toBe(67) // (3-1)/3
  })

  it('lista vazia → 100% no prazo', () => {
    expect(CAPA.resumoCapa([], HOJE).percentNoPrazo).toBe(100)
  })
})
