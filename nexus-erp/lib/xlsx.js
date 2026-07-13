/**
 * xlsx.js — gerador de .xlsx REAL (OOXML) sem dependências. Puro, sem I/O.
 *
 * Um .xlsx é um ZIP de XMLs. Este módulo escreve o ZIP (método STORE, CRC32)
 * e os XMLs mínimos com formatação profissional:
 *   - cabeçalho em negrito com fundo destacado
 *   - primeira linha congelada + filtros automáticos no cabeçalho
 *   - larguras de coluna
 *   - formatos nativos para data (dd/mm/yyyy), moeda (R$) e número
 *
 * Segurança: valores de texto entram como INLINE STRING — o Excel nunca os
 * interpreta como fórmula (=cmd vira texto literal), sem conteúdo executável.
 */

// ── CRC32 (tabela padrão) ───────────────────────────────────────────────────
const _CRC = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c
  }
  return t
})()
function crc32(buf) {
  let c = 0 ^ (-1)
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ _CRC[(c ^ buf[i]) & 0xFF]
  return (c ^ (-1)) >>> 0
}

// ── ZIP writer (STORE, sem compressão — o conteúdo fica auditável) ─────────
function zip(entries) {
  // timestamp DOS fixo (2026-01-01 00:00) → binário determinístico/testável
  const dosTime = 0, dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1
  const locals = [], centrals = []
  let offset = 0
  for (const { name, data } of entries) {
    const nameB = Buffer.from(name, 'utf8')
    const crc = crc32(data)
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6)
    lh.writeUInt16LE(0, 8); lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12)
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22)
    lh.writeUInt16LE(nameB.length, 26); lh.writeUInt16LE(0, 28)
    locals.push(lh, nameB, data)
    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8)
    ch.writeUInt16LE(0, 10); ch.writeUInt16LE(dosTime, 12); ch.writeUInt16LE(dosDate, 14)
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24)
    ch.writeUInt16LE(nameB.length, 28)
    ch.writeUInt32LE(offset, 42)
    centrals.push(Buffer.concat([ch, nameB]))
    offset += 30 + nameB.length + data.length
  }
  const central = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(central.length, 12); eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, central, eocd])
}

// ── helpers XML ─────────────────────────────────────────────────────────────
const escXml = s => String(s == null ? '' : s)
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // controles inválidos em XML fora
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;')

// Coluna 0 → "A", 25 → "Z", 26 → "AA"…
export function colLetra(i) {
  let s = ''
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s
  return s
}

// Data ISO (YYYY-MM-DD) → serial Excel (dias desde 1899-12-30). null se inválida.
export function dataParaSerial(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)
  return Math.round(ms / 86400000)
}

/**
 * Gera o buffer .xlsx.
 * colunas: [{ titulo, tipo: 'text'|'date'|'money'|'number', largura? }]
 * linhas: array de arrays (mesma ordem das colunas).
 */
export function gerarXLSX({ sheetName = 'Dados', colunas = [], linhas = [] } = {}) {
  const nCols = colunas.length
  const lastCol = colLetra(Math.max(0, nCols - 1))
  const lastRow = linhas.length + 1
  // estilos: 0 padrão · 1 cabeçalho · 2 data · 3 moeda · 4 número
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$&quot;\\ #,##0.00"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/></patternFill></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="5"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="14" applyNumberFormat="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="4" applyNumberFormat="1"/></cellXfs>
</styleSheet>`
  const cols = colunas.map((c, i) =>
    `<col min="${i + 1}" max="${i + 1}" width="${Number(c.largura) > 0 ? Number(c.largura) : 14}" customWidth="1"/>`).join('')
  const headerCells = colunas.map((c, i) =>
    `<c r="${colLetra(i)}1" t="inlineStr" s="1"><is><t xml:space="preserve">${escXml(c.titulo)}</t></is></c>`).join('')
  const dataRows = linhas.map((linha, r) => {
    const cells = colunas.map((c, i) => {
      const v = linha[i]
      if (v == null || v === '') return ''
      const ref = `${colLetra(i)}${r + 2}`
      if (c.tipo === 'date') {
        const serial = dataParaSerial(v)
        return serial == null
          ? `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escXml(v)}</t></is></c>`
          : `<c r="${ref}" s="2"><v>${serial}</v></c>`
      }
      if (c.tipo === 'money' || c.tipo === 'number') {
        const n = Number(v)
        return isFinite(n)
          ? `<c r="${ref}" s="${c.tipo === 'money' ? 3 : 4}"><v>${n}</v></c>`
          : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escXml(v)}</t></is></c>`
      }
      // texto: inline string — nunca interpretado como fórmula
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escXml(v)}</t></is></c>`
    }).join('')
    return `<row r="${r + 2}">${cells}</row>`
  }).join('')
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${cols}</cols>
<sheetData><row r="1">${headerCells}</row>${dataRows}</sheetData>
<autoFilter ref="A1:${lastCol}${lastRow}"/>
</worksheet>`
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${escXml(String(sheetName).slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
  const B = s => Buffer.from(s, 'utf8')
  return zip([
    { name: '[Content_Types].xml', data: B(contentTypes) },
    { name: '_rels/.rels', data: B(rootRels) },
    { name: 'xl/workbook.xml', data: B(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: B(wbRels) },
    { name: 'xl/styles.xml', data: B(styles) },
    { name: 'xl/worksheets/sheet1.xml', data: B(sheet) },
  ])
}
