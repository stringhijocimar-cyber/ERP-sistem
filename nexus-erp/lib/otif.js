/**
 * otif.js — Entregas e OTIF (On-Time In-Full) do fornecedor. Puro, sem I/O.
 *
 * OTIF aqui é a métrica de PRAZO sobre a promessa ORIGINAL (data_prometida):
 * replanejar ajuda o comprador a planejar, mas não "conserta" o indicador —
 * senão o fornecedor zeraria o atraso empurrando a data. `no_prazo_revisado`
 * sai à parte (entregou dentro da data confirmada/replanejada).
 */

const _r1 = n => Math.round(n * 10) / 10

// Status efetivo de uma programação de entrega na data `hoje` (YYYY-MM-DD).
export function statusEntrega(e, hoje) {
  if (!e) return 'Programada'
  if (e.data_entregue) return 'Entregue'
  const prazo = String(e.data_confirmada || e.data_prometida || '').slice(0, 10)
  if (prazo && hoje && prazo < hoje) return 'Atrasada'
  return e.status === 'Replanejada' ? 'Replanejada' : (e.data_confirmada ? 'Confirmada' : 'Programada')
}

// Consolida a lista de programações em indicadores.
// Integridade: OTIF só é medível contra um COMPROMISSO de data. Entrega sem
// data prometida sai do cálculo (reportada em `sem_prazo`) — senão bastaria
// emitir o pedido com prazo textual ("30 dias" → sem data) para o fornecedor
// exibir 100% sem nunca ter um prazo real a cumprir.
export function calcularOTIF(entregas = [], hoje) {
  const lista = Array.isArray(entregas) ? entregas : []
  let entregues = 0, comPrazo = 0, semPrazo = 0, noPrazo = 0, noPrazoRevisado = 0, atrasadasAbertas = 0, abertas = 0
  for (const e of lista) {
    if (e.data_entregue) {
      entregues++
      const d = String(e.data_entregue).slice(0, 10)
      const original = String(e.data_prometida || '').slice(0, 10)
      if (!original) { semPrazo++; continue } // não mensurável — fora do OTIF
      comPrazo++
      const revisado = String(e.data_confirmada || e.data_prometida || '').slice(0, 10)
      if (d <= original) noPrazo++
      if (d <= revisado) noPrazoRevisado++
    } else {
      abertas++
      if (statusEntrega(e, hoje) === 'Atrasada') atrasadasAbertas++
    }
  }
  return {
    total: lista.length, entregues, abertas, sem_prazo: semPrazo,
    no_prazo: noPrazo, atrasadas_abertas: atrasadasAbertas,
    otif_pct: comPrazo > 0 ? _r1((noPrazo / comPrazo) * 100) : null, // null = sem base mensurável
    otif_revisado_pct: comPrazo > 0 ? _r1((noPrazoRevisado / comPrazo) * 100) : null,
  }
}

const _ISO_DATA = /^\d{4}-\d{2}-\d{2}/
// Extrai uma data ISO de prazo_entrega (que às vezes vem como "30 dias").
export function dataPrometidaDoPrazo(prazoEntrega) {
  const s = String(prazoEntrega || '').trim()
  return _ISO_DATA.test(s) ? s.slice(0, 10) : null
}

// Tendência de OTIF por mês (competência = data_entregue). Devolve os últimos
// `meses` buckets terminando no mês de `hoje` (YYYY-MM-DD), do mais antigo ao
// mais recente — pronto para um gráfico de barras.
export function tendenciaOTIF(entregas = [], meses = 6, hoje) {
  const base = String(hoje || '').slice(0, 7) || '0000-00' // YYYY-MM
  const [by, bm] = base.split('-').map(Number)
  const buckets = []
  const idx = new Map()
  for (let i = meses - 1; i >= 0; i--) {
    // Subtrai i meses do mês base sem usar Date (determinístico e sem TZ).
    let y = by, m = bm - i
    while (m <= 0) { m += 12; y -= 1 }
    const chave = `${y}-${String(m).padStart(2, '0')}`
    const b = { mes: chave, entregues: 0, com_prazo: 0, sem_prazo: 0, no_prazo: 0, otif_pct: null }
    idx.set(chave, b)
    buckets.push(b)
  }
  for (const e of entregas || []) {
    if (!e.data_entregue) continue
    const chave = String(e.data_entregue).slice(0, 7)
    const b = idx.get(chave)
    if (!b) continue
    b.entregues++
    const original = String(e.data_prometida || '').slice(0, 10)
    if (!original) { b.sem_prazo++; continue } // não mensurável — fora do OTIF
    b.com_prazo++
    const d = String(e.data_entregue).slice(0, 10)
    if (d <= original) b.no_prazo++
  }
  for (const b of buckets) b.otif_pct = b.com_prazo > 0 ? Math.round((b.no_prazo / b.com_prazo) * 1000) / 10 : null
  return buckets
}
