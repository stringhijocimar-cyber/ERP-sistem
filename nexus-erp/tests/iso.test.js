// Testes do esqueleto de auditoria ISO (motor puro).
import { describe, expect, it } from 'vitest'
import { CATALOGO_ISO, gerarEvidenciasAutomaticas, avaliarConformidade } from '../public/js/lib/iso.js'

describe('gerarEvidenciasAutomaticas', () => {
  it('deriva evidências dos módulos existentes (IDF, SSMA, RBAC, logs)', () => {
    const ev = gerarEvidenciasAutomaticas({
      idf: [{}, {}], fornecedores: [{ status: 'Ativo' }, { status: 'Em Homologação' }],
      incidentes: [{}], treinamentos: [{}, {}], usuarios: [{}, {}, {}], logs: [{}, {}], documentos: [{}],
      gateAtivo: true,
    })
    const ids = ev.map(e => e.requisito_id)
    expect(ids).toContain('9001-8.4')    // fornecedores/IDF
    expect(ids).toContain('45001-10.2')  // incidentes SSMA
    expect(ids).toContain('27001-A.9')   // RBAC
    expect(ids).toContain('27001-A.12.4')// logs/auditoria
  })

  it('não cria evidência para fonte ausente (vira lacuna)', () => {
    const ev = gerarEvidenciasAutomaticas({ usuarios: [{}] })
    expect(ev.some(e => e.requisito_id === '45001-10.2')).toBe(false) // sem incidentes
  })

  it('CAPAs e aspectos ambientais viram evidência (9001-10.2 e 14001-6.1)', () => {
    const ev = gerarEvidenciasAutomaticas({ capas: [{}, {}], aspectos: [{}] })
    expect(ev.some(e => e.requisito_id === '9001-10.2')).toBe(true)
    expect(ev.some(e => e.requisito_id === '14001-6.1')).toBe(true)
  })
})

describe('avaliarConformidade', () => {
  it('calcula cobertura por norma e geral', () => {
    const ev = gerarEvidenciasAutomaticas({
      idf: [{}], fornecedores: [{ status: 'Ativo' }], incidentes: [{}], treinamentos: [{}],
      usuarios: [{}], logs: [{}], documentos: [{}],
    })
    const r = avaliarConformidade(CATALOGO_ISO, ev, [])
    expect(r.geral.total).toBe(CATALOGO_ISO.length)
    expect(r.geral.atendidos).toBeGreaterThan(0)
    expect(r.geral.cobertura).toBeGreaterThan(0)
    const iso9001 = r.porNorma.find(n => n.norma === 'ISO 9001')
    expect(iso9001.total).toBe(4)
    expect(Array.isArray(iso9001.pendentes)).toBe(true)
  })

  it('não-conformidade aberta penaliza o score da norma', () => {
    const ev = gerarEvidenciasAutomaticas({ idf: [{}], fornecedores: [{ status: 'Ativo' }], documentos: [{}] })
    const semNC = avaliarConformidade(CATALOGO_ISO, ev, [])
    const comNC = avaliarConformidade(CATALOGO_ISO, ev, [{ norma: 'ISO 9001', status: 'Aberta' }])
    const a = semNC.porNorma.find(n => n.norma === 'ISO 9001')
    const b = comNC.porNorma.find(n => n.norma === 'ISO 9001')
    expect(b.score).toBeLessThan(a.score)
    expect(b.ncsAbertas).toBe(1)
  })

  it('NC fechada não conta como aberta', () => {
    const r = avaliarConformidade(CATALOGO_ISO, [], [{ norma: 'ISO 9001', status: 'Fechada' }])
    const a = r.porNorma.find(n => n.norma === 'ISO 9001')
    expect(a.ncsAbertas).toBe(0)
  })

  it('sem evidências → cobertura 0 e nível Crítico', () => {
    const r = avaliarConformidade(CATALOGO_ISO, [], [])
    expect(r.geral.cobertura).toBe(0)
    expect(r.geral.nivel).toBe('Crítico')
  })
})
