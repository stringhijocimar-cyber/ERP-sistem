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
export function calcularOTIF(entregas = [], hoje) {
  const lista = Array.isArray(entregas) ? entregas : []
  let entregues = 0, noPrazo = 0, noPrazoRevisado = 0, atrasadasAbertas = 0, abertas = 0
  for (const e of lista) {
    if (e.data_entregue) {
      entregues++
      const d = String(e.data_entregue).slice(0, 10)
      const original = String(e.data_prometida || '').slice(0, 10)
      const revisado = String(e.data_confirmada || e.data_prometida || '').slice(0, 10)
      if (!original || d <= original) noPrazo++
      if (!revisado || d <= revisado) noPrazoRevisado++
    } else {
      abertas++
      if (statusEntrega(e, hoje) === 'Atrasada') atrasadasAbertas++
    }
  }
  return {
    total: lista.length, entregues, abertas,
    no_prazo: noPrazo, atrasadas_abertas: atrasadasAbertas,
    otif_pct: entregues > 0 ? _r1((noPrazo / entregues) * 100) : null, // null = sem histórico ainda
    otif_revisado_pct: entregues > 0 ? _r1((noPrazoRevisado / entregues) * 100) : null,
  }
}

const _ISO_DATA = /^\d{4}-\d{2}-\d{2}/
// Extrai uma data ISO de prazo_entrega (que às vezes vem como "30 dias").
export function dataPrometidaDoPrazo(prazoEntrega) {
  const s = String(prazoEntrega || '').trim()
  return _ISO_DATA.test(s) ? s.slice(0, 10) : null
}
