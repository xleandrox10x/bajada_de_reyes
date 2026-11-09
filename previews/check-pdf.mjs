import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createModulePdf } from '../src/lib/pdf.ts'

const headers = ['Año', 'Participante', 'Cargo', 'Animal relacionado', 'Observaciones / detalle', 'Cumplimiento', 'Fecha y hora']
const rows = Array.from({ length: 35 }, (_, i) => [2027, `Participante ${i + 1}`, 'Voluntario', `Animalito ${i + 1}`, 'Preparar los aportes para la celebración familiar.', ['Cumplió', 'En espera', 'No cumplió'][i % 3], '08/11/2026, 10:30'])
const sample = createModulePdf('Historial', headers, rows)
const source = await sample.text()
assert.ok(source.includes('/MediaBox [0 0 842 595]'))
assert.ok(Number(source.match(/\/Count (\d+)/)[1]) > 1)
const xref = Number(source.match(/startxref\n(\d+)/)[1])
assert.equal(source.slice(xref, xref + 4), 'xref')
for (const match of source.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) {
  assert.equal(Number(match[1]), match[2].length)
}
const portrait = await createModulePdf('Resumen', ['Concepto', 'Total'], [['Participantes', 35]]).text()
assert.ok(portrait.includes('/MediaBox [0 0 595 842]'))
const long = await createModulePdf('Historial', headers, [[2027, 'Prueba', 'Cargo', 'Animal', 'Detalle '.repeat(3000) + 'FINLARGO', 'En espera', '08/11/2026']]).text()
assert.ok(Number(long.match(/\/Count (\d+)/)[1]) > 2)
const decoded = long.replace(/\\([0-7]{3})/g, (_, value) => String.fromCharCode(parseInt(value, 8)))
assert.ok(decoded.includes('FINLARGO'))
fs.writeFileSync(new URL('./historial-ejemplo.pdf', import.meta.url), new Uint8Array(await sample.arrayBuffer()))
console.log('PDF verificado: orientaciones, varias páginas, observaciones largas y estructura. Ejemplo generado.')
