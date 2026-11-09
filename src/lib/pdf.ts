// PDF standard fonts use WinAnsi. Escape bytes rather than interpolating PDF syntax.
function pdfText(text: string) {
  return Array.from(text.normalize('NFC')).map((char) => {
    const code = char.charCodeAt(0)
    const byte = code >= 32 && code <= 255 ? code : 63
    return `\\${byte.toString(8).padStart(3, '0')}`
  }).join('')
}

// Conservative Helvetica widths also leave room for bold column headings.
function characterWidth(char: string, size: number) {
  const base = char.normalize('NFD')[0] ?? char
  const em = /[MWmw@%&]/.test(base) ? 1.02
    : /[ilI.,:;!'| ]/.test(base) ? 0.3
    : /[ft()-]/.test(base) ? 0.36
    : base === 'r' ? 0.4
    : /[0-9]/.test(base) ? 0.56
    : /[A-Z]/.test(base) ? 0.78 : 0.62
  return em * size
}

function wrap(text: string, width: number, size: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split(/\r?\n/)) {
    let remaining = paragraph
    while (remaining) {
      let length = 0
      let used = 0
      for (const char of remaining) {
        const next = characterWidth(char, size)
        if (used + next > width && length > 0) break
        used += next
        length += char.length
      }
      if (length === remaining.length) break
      const space = remaining.lastIndexOf(' ', length)
      const end = space > 0 ? space : length
      lines.push(remaining.slice(0, end))
      remaining = remaining.slice(end).trimStart()
    }
    lines.push(remaining)
  }
  return lines
}

export function createModulePdf(title: string, headers: (string | number)[], records: (string | number)[][]) {
  if (!headers.length) throw new Error('El reporte necesita al menos una columna.')
  const landscape = headers.length > 4
  const width = landscape ? 842 : 595
  const height = landscape ? 595 : 842
  const margin = 30
  const green = '0.125 0.216 0.180'
  const gold = '0.843 0.714 0.443'
  const ink = '0.18 0.25 0.21'
  const muted = '0.43 0.48 0.44'
  const fontSize = 10
  const lineHeight = 14
  const padding = 7
  const date = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima',
  }).format(new Date())
  const text = (value: string, x: number, y: number, size = fontSize, color = ink, bold = false) =>
    `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfText(value)}) Tj ET\n`
  const rect = (x: number, y: number, w: number, h: number, color: string) =>
    `${color} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f\n`
  const weights = headers.map((header) => {
    const label = String(header).toLocaleLowerCase('es')
    if (label === 'año') return 0.55
    if (/observaciones|detalle|animalitos a su cargo/.test(label)) return 2.2
    if (/fecha/.test(label)) return 1.45
    if (/monto|estado|cumplimiento|total/.test(label)) return 1.2
    return 1.65
  })
  const totalWeight = weights.reduce((sum, value) => sum + value, 0)
  const widths = weights.map((value) => (width - margin * 2) * value / totalWeight)
  const capacities = widths.map((value) => Math.max(fontSize, value - padding * 2))
  const headings = headers.map((value, index) => wrap(String(value), capacities[index], fontSize))
  const headerHeight = Math.max(...headings.map((lines) => lines.length)) * lineHeight + padding * 2
  const tableTop = height - 138
  const bottom = 48
  const pages: string[] = []
  let content = ''
  let cursor = tableTop
  function newPage() {
    if (content) pages.push(content)
    content = rect(0, height - 89, width, 89, green)
      + rect(margin, height - 32, 24, 3, gold)
      + text('FAMILIA MALLMA', margin + 34, height - 35, 10, gold, true)
      + text('Bajada de Reyes', margin, height - 66, 23, '1 1 1', true)
      + text(title, margin, height - 113, 15, ink, true)
      + text(`${records.length} registros`, width - margin - 100, height - 113, 10, muted)
      + text(`Emitido: ${date} (Lima)`, margin, height - 127, 9, muted)
    let x = margin
    headings.forEach((lines, column) => {
      content += rect(x, tableTop - headerHeight, widths[column], headerHeight, green)
      lines.forEach((line, index) => {
        content += text(line, x + padding, tableTop - padding - fontSize - index * lineHeight, fontSize, '1 1 1', true)
      })
      x += widths[column]
    })
    cursor = tableTop - headerHeight
  }
  newPage()
  records.forEach((row, rowIndex) => {
    const cells = headers.map((_, column) => wrap(String(row[column] ?? '').replace(/\t/g, ' ').trim() || '-', capacities[column], fontSize))
    const lineCount = Math.max(...cells.map((lines) => lines.length))
    const rowHeight = lineCount * lineHeight + padding * 2
    // Keep normal rows together; split very long observations without losing text.
    if (rowHeight <= tableTop - headerHeight - bottom && cursor - rowHeight < bottom) newPage()
    let offset = 0
    while (offset < lineCount) {
      let available = Math.floor((cursor - bottom - padding * 2) / lineHeight)
      if (available < 1) {
        newPage()
        available = Math.floor((cursor - bottom - padding * 2) / lineHeight)
      }
      const count = Math.min(lineCount - offset, available)
      const cellHeight = count * lineHeight + padding * 2
      let x = margin
      cells.forEach((lines, column) => {
        content += rect(x, cursor - cellHeight, widths[column], cellHeight, rowIndex % 2 ? '0.95 0.96 0.94' : '1 1 1')
        content += `0.85 0.88 0.84 RG 0.4 w ${x.toFixed(2)} ${(cursor - cellHeight).toFixed(2)} ${widths[column].toFixed(2)} ${cellHeight.toFixed(2)} re S\n`
        const value = String(row[column] ?? '')
        const color = value === 'Cumplió' || value === 'Pagado' ? '0.16 0.40 0.27'
          : value === 'No cumplió' ? '0.65 0.22 0.19'
          : value === 'En espera' || value === 'Pendiente' ? '0.55 0.36 0.12' : ink
        lines.slice(offset, offset + count).forEach((line, index) => {
          content += text(line, x + padding, cursor - padding - fontSize - index * lineHeight, fontSize, color)
        })
        x += widths[column]
      })
      cursor -= cellHeight
      offset += count
      if (offset < lineCount) newPage()
    }
  })
  if (!records.length) content += text('No hay registros para mostrar.', margin + padding, cursor - 22, 9, muted)
  pages.push(content)
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ]
  pages.forEach((page, index) => {
    const stream = page + rect(margin, 35, width - margin * 2, 0.7, '0.85 0.88 0.84')
      + text('Tradición familiar | Bajada de Reyes', margin, 22, 9, muted)
      + text(`Página ${index + 1} de ${pages.length}`, width - margin - 100, 22, 9, muted)
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + index * 2} 0 R >>`)
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  })
  let document = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(document.length)
    document += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = document.length
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([document], { type: 'application/pdf' })
}
