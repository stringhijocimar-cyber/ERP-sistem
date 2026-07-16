// ============================================================
// Worker (nexus-cf) — IDF (função pura) + paridade com lib/idf.js do Express.
// ============================================================
import { describe, expect, it } from 'vitest'
import { calcularIDF as worker } from '../../nexus-cf/src/index.js'
import { calcularIDF as express } from '../lib/idf.js'

const d = off => new Date(Date.now() + off * 864e5).toISOString().slice(0, 10)
const pedidos = [
  { enviado_em: d(-20), prazo_entrega: 7, entregue_em: d(-15) }, // no prazo
  { enviado_em: d(-30), prazo_entrega: 7, entregue_em: d(-20) }, // atrasou
]
const avaliacoes = [{ nota_media: 4 }, { nota_media: 5 }]

describe('Worker — calcularIDF', () => {
  it('calcula OTD e classificação', () => {
    const r = worker({ pedidos })
    expect(r.otd_pct).toBe(50)
    expect(r.entregas_consideradas).toBe(2)
  })
  it('paridade total com o Express', () => {
    expect(worker({ pedidos, avaliacoes })).toEqual(express({ pedidos, avaliacoes }))
    expect(worker({})).toEqual(express({}))
    expect(worker({ avaliacoes })).toEqual(express({ avaliacoes }))
  })
})
