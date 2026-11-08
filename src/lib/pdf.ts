type PdfRecord = { participantName: string; cargo: string; detail: string; fulfillmentStatus: string }

// PDF standard fonts use WinAnsi. Escape bytes rather than interpolating PDF syntax.
function pdfText(text: string) {
  return Array.from(text.normalize('NFC')).map((char) => {
    const code = char.charCodeAt(0)
    const byte = code >= 32 && code <= 255 ? code : 63
    return `\\${byte.toString(8).padStart(3, '0')}`
  }).join('')
}

function wrap(text: string, width = 88): string[] {
  const lines: string[] = []
  for (const paragraph of text.split(/\r?\n/)) {
    let remaining = paragraph
    while (remaining.length > width) {
      const space = remaining.lastIndexOf(' ', width)
      const end = space > 0 ? space : width
      lines.push(remaining.slice(0, end))
      remaining = remaining.slice(end).trimStart()
    }
    lines.push(remaining)
  }
  return lines
}

export function createChargesPdf(year: number, records: PdfRecord[]) {
  const lines = records.flatMap((row, index) => [
    ...wrap(`${index + 1}. Responsable: ${row.participantName}`),
    ...wrap(`Animalito / cargo: ${row.cargo}`),
    ...wrap(`Observaciones: ${row.detail || '-'}`),
    ...wrap(`Cumplimiento: ${row.fulfillmentStatus}`), '',
  ])
  const pages: string[][] = []
  for (let index = 0; index < lines.length; index += 43) pages.push(lines.slice(index, index + 43))
  if (!pages.length) pages.push([])
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
  ]
  pages.forEach((page, index) => {
    const stream = `BT /F1 12 Tf 40 800 Td (${pdfText(`Bajada de Reyes - Familia Mallma - ${year}`)}) Tj 0 -22 Td /F1 10 Tf 15 TL\n${page.map((line) => `(${pdfText(line)}) Tj T*`).join('\n')}\nET\nBT /F1 9 Tf 40 35 Td (${pdfText(`Página ${index + 1} de ${pages.length}`)}) Tj ET`
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + index * 2} 0 R >>`)
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
