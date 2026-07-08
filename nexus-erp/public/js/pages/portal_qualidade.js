// ============================================================
// Portal do Fornecedor · Qualidade. Feedback de desempenho: notas da
// contratante, alertas (nota baixa/documentos) e OTIF. Read-only.
// ============================================================

// Render puro (testável) da seção de qualidade.
function _portalQualidadeHTML(d) {
  if (!d) return ''
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const m = d.medias || {}
  const nota = v => v == null ? '—' : `${v}/5`
  const corNota = v => v == null ? 'var(--text-muted)' : (v >= 4 ? '#16a34a' : (v >= 3 ? '#d97706' : '#dc2626'))
  const dim = (rotulo, v) => `<div style="flex:1;min-width:110px;text-align:center">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">${rotulo}</div>
      <div style="font-size:18px;font-weight:800;color:${corNota(v)}">${nota(v)}</div>
    </div>`
  const alertas = (d.alertas || []).map(a => `<li style="font-size:12px;color:${a.tipo.includes('vencido') || a.tipo === 'qualidade_baixa' ? '#dc2626' : '#d97706'};margin-bottom:3px">
      <i class="fas fa-triangle-exclamation" style="margin-right:4px"></i>${esc(a.detalhe)}</li>`).join('')
  const avals = (d.avaliacoes || []).slice(0, 5).map(a => `<tr>
      <td style="padding:5px 8px">${esc(String(a.created_at || '').slice(0, 10))}</td>
      <td style="padding:5px 8px;color:${corNota(a.nota_media)}">${nota(a.nota_media)}</td>
      <td style="padding:5px 8px">${esc(a.comentario || '—')}</td>
    </tr>`).join('')
  return `
    <strong style="font-size:14px"><i class="fas fa-award" style="margin-right:6px"></i>Minha Qualidade</strong>
    ${m.total ? `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
        ${dim('Geral', m.geral)}${dim('Qualidade', m.qualidade)}${dim('Prazo', m.prazo)}${dim('Preço', m.preco)}${dim('Atendimento', m.atendimento)}
      </div>` : '<p style="font-size:13px;color:var(--text-muted);margin-top:8px">Ainda sem avaliações registradas.</p>'}
    ${alertas ? `<div style="margin-top:10px"><div style="font-size:12px;font-weight:700;margin-bottom:4px">Pendências e alertas</div><ul style="list-style:none;padding:0;margin:0">${alertas}</ul></div>` : ''}
    ${avals ? `
      <table class="table" style="width:100%;margin-top:10px;font-size:12px;border-collapse:collapse">
        <thead><tr style="color:var(--text-muted);text-align:left">
          <th style="padding:5px 8px">Data</th><th style="padding:5px 8px">Nota</th><th style="padding:5px 8px">Comentário da contratante</th>
        </tr></thead><tbody>${avals}</tbody>
      </table>` : ''}`
}

async function _portalCarregarQualidade() {
  const box = document.getElementById('portal_qualidade')
  if (!box || typeof apiAuth !== 'function') return
  try { box.innerHTML = _portalQualidadeHTML(await apiAuth('/api/portal/qualidade')) }
  catch (e) { box.style.display = 'none' }
}

window._portalQualidadeHTML = _portalQualidadeHTML
window._portalCarregarQualidade = _portalCarregarQualidade
