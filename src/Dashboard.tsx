import { useMemo, useState } from 'react'
import { CircleDollarSign, ClipboardList, PawPrint, Trophy, UsersRound } from 'lucide-react'

type Participant = { id: string; name: string }
type Animal = { id: string; name: string; cargo?: string }
type Assignment = { id: string; participantId: string; animalId: string; eventYear: number; fulfillmentStatus: string }
type Historical = { id: string; participantId: string | null; participantName: string; animalId: string | null; cargo: string; eventYear: number; fulfillmentStatus: string }
type Collection = { amount: number; status: string; responsibleId: string | null; createdAt: string }
type Entry = { id: string; person: string; name: string; animalId: string | null; cargo: string; year: number; status: string }
const money = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const percent = new Intl.NumberFormat('es-PE', { style: 'percent', maximumFractionDigits: 1 })

function dashboardEntries(participants: Participant[], animals: Animal[], charges: Assignment[], history: Historical[]): Entry[] {
  const people = new Map(participants.map((person) => [person.id, person.name]))
  const catalog = new Map(animals.map((animal) => [animal.id, animal]))
  const personKey = (id: string | null, name: string) => id ?? participants.find((person) => person.name.trim().toLocaleLowerCase('es') === name.trim().toLocaleLowerCase('es'))?.id ?? `name:${name.trim().toLocaleLowerCase('es')}`
  const entries = new Map<string, Entry>()
  for (const row of history) entries.set(row.id, {
    id: row.id, person: personKey(row.participantId, row.participantName),
    name: people.get(row.participantId ?? '') ?? row.participantName,
    animalId: row.animalId, cargo: row.cargo || catalog.get(row.animalId ?? '')?.name || 'Sin cargo',
    year: row.eventYear, status: row.fulfillmentStatus,
  })
  // Saving a charge to history preserves its ID. Prefer the live assignment on overlap.
  for (const row of charges) entries.set(row.id, {
    id: row.id, person: row.participantId, name: people.get(row.participantId) ?? 'Sin participante',
    animalId: row.animalId, cargo: catalog.get(row.animalId)?.name ?? 'Sin cargo',
    year: row.eventYear, status: row.fulfillmentStatus,
  })
  return [...entries.values()]
}

function Bars({ title, subtitle, rows, color = 'green' }: { title: string; subtitle: string; rows: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  return <section className="panel analytics-panel"><div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div></div>
    {rows.length ? <ul className={`analytics-bars bars-${color}`} aria-label={title}>{rows.map((row) => <li key={row.label}><div><span>{row.label}</span><strong>{row.value}</strong></div><div className="analytics-track"><span style={{ width: `${row.value / max * 100}%` }} /></div></li>)}</ul> : <p className="analytics-empty">No hay asignaciones para los filtros seleccionados.</p>}
  </section>
}

export default function Dashboard({ participants, animals, charges, historicalRecords, collectedAmounts, isLoading }: {
  participants: Participant[]; animals: Animal[]; charges: Assignment[]; historicalRecords: Historical[]; collectedAmounts: Collection[]; isLoading: boolean
}) {
  const [person, setPerson] = useState('')
  const [cargo, setCargo] = useState('')
  const [year, setYear] = useState('')
  const entries = useMemo(() => dashboardEntries(participants, animals, charges, historicalRecords), [participants, animals, charges, historicalRecords])
  const people = new Map(participants.map((row) => [row.id, row.name]))
  entries.forEach((row) => people.set(row.person, row.name))
  const years = [...new Set(entries.map((row) => row.year))].sort((a, b) => b - a)
  const cargos = [...new Set(entries.map((row) => row.cargo))].sort((a, b) => a.localeCompare(b, 'es'))
  const filtered = entries.filter((row) => (!person || row.person === person) && (!cargo || row.cargo === cargo) && (!year || row.year === Number(year)))
  const rank = (key: (row: Entry) => string) => {
    const counts = new Map<string, number>()
    filtered.forEach((row) => { const label = key(row); counts.set(label, (counts.get(label) ?? 0) + 1) })
    return [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'es'))
  }
  const byPerson = new Map<string, { label: string; value: number }>()
  filtered.forEach((row) => byPerson.set(row.person, { label: row.name, value: (byPerson.get(row.person)?.value ?? 0) + 1 }))
  const ranking = [...byPerson].map(([id, row]) => ({ ...row, id })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'es'))
  const leader = ranking[0]
  const ties = leader ? ranking.filter((row) => row.value === leader.value).length : 0
  const completed = filtered.filter((row) => row.status === 'Cumplió').length
  const completion = filtered.length ? completed / filtered.length : 0
  const paid = collectedAmounts.filter((row) => row.status === 'Pagado' && (!person || row.responsibleId === person) && (!year || new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Lima' }).format(new Date(row.createdAt)) === year))
  const total = paid.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100
  const hasFilters = Boolean(person || cargo || year)
  const participantCount = hasFilters ? byPerson.size : people.size
  const animalCount = hasFilters ? new Set(filtered.flatMap((row) => row.animalId ? [row.animalId] : [])).size : animals.length

  return <div className="analytics" aria-busy={isLoading}>
    <section className="panel analytics-filters" aria-label="Filtros del dashboard">
      <label>Participante<select value={person} onChange={(event) => setPerson(event.target.value)}><option value="">Todos los participantes</option>{[...people].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Cargo<select value={cargo} onChange={(event) => setCargo(event.target.value)}><option value="">Todos los cargos</option>{cargos.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Año<select value={year} onChange={(event) => setYear(event.target.value)}><option value="">Todos los años</option>{years.map((value) => <option key={value}>{value}</option>)}</select></label>
      <button type="button" className="button button-secondary" disabled={!hasFilters} onClick={() => { setPerson(''); setCargo(''); setYear('') }}>Limpiar filtros</button>
    </section>
    <p className="analytics-note" role="status">{isLoading ? 'Cargando indicadores…' : `${filtered.length} asignaciones entre cargos e historial, sin duplicar registros guardados.`} El filtro Cargo usa el nombre de la asignación o animalito. La recaudación usa el año del pago (hora de Perú) y el responsable; no se filtra por cargo.</p>
    <section className="stat-grid" aria-label="Resumen del dashboard">
      <article className="stat-card stat-green"><div className="stat-icon"><UsersRound size={19} /></div><p>Participantes</p><strong>{participantCount}</strong><span>{hasFilters ? 'con asignaciones en la selección' : 'registrados e históricos'}</span></article>
      <article className="stat-card stat-red"><div className="stat-icon"><PawPrint size={19} /></div><p>Animalitos</p><strong>{animalCount}</strong><span>{hasFilters ? 'relacionados con la selección' : 'en el pesebre'}</span></article>
      <article className="stat-card stat-gold"><div className="stat-icon"><ClipboardList size={19} /></div><p>Cargos</p><strong>{filtered.length}</strong><span>asignaciones únicas</span></article>
      <article className="stat-card stat-cream"><div className="stat-icon"><CircleDollarSign size={19} /></div><p>Monto recaudado</p><strong className="stat-total">{money.format(total)}</strong><span>{paid.length} pagos según participante y año</span></article>
    </section>
    <div className="analytics-highlights">
      <article className="panel analytics-leader"><span className="stat-icon"><Trophy size={22} /></span><div><p className="eyebrow">MAYOR PARTICIPACIÓN</p><h2>{leader?.label ?? 'Sin asignaciones'}</h2><p>{leader ? `${leader.value} cargos · ${percent.format(leader.value / filtered.length)} del total filtrado` : 'Registra cargos o ajusta los filtros para ver el resultado.'}</p>{ties > 1 && <small>Empate entre {ties} participantes: {ranking.filter((row) => row.value === leader.value).map((row) => row.label).join(', ')}.</small>}</div></article>
      <article className="panel analytics-kpi"><p className="eyebrow">CUMPLIMIENTO</p><strong>{percent.format(completion)}</strong><p>{completed} de {filtered.length} cargos cumplidos</p></article>
      <article className="panel analytics-kpi"><p className="eyebrow">CARGOS POR PARTICIPANTE</p><strong>{new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(byPerson.size ? filtered.length / byPerson.size : 0)}</strong><p>Promedio de la selección</p></article>
    </div>
    <div className="analytics-charts">
      <Bars title="Top 5 participantes" subtitle="Personas con más cargos asignados" rows={ranking.slice(0, 5).map((row) => ({ label: `${row.label}${ranking.some((other) => other.id !== row.id && other.label === row.label) ? ` (${row.id.slice(0, 8)})` : ''}`, value: row.value }))} />
      <Bars title="Top 5 cargos" subtitle="Asignaciones más frecuentes" rows={rank((row) => row.cargo).slice(0, 5)} color="gold" />
      <Bars title="Participación por año" subtitle="Cantidad de cargos en cada celebración" rows={rank((row) => String(row.year)).sort((a, b) => Number(a.label) - Number(b.label))} />
      <section className="panel analytics-panel"><div className="panel-heading"><div><h2>Estado de los cargos</h2><p>Distribución del cumplimiento</p></div></div>
        {filtered.length ? <div className="analytics-status"><div className="analytics-donut" role="img" aria-label={`${percent.format(completion)} de cargos cumplidos`} style={{ background: `conic-gradient(#3d7255 0 ${completion * 100}%, #d7b671 ${completion * 100}% ${(completed + filtered.filter((row) => row.status === 'En espera').length) / filtered.length * 100}%, #b86d5d 0)` }}><span><strong>{filtered.length}</strong><small>cargos</small></span></div><ul>{['Cumplió', 'En espera', 'No cumplió'].map((status, index) => { const count = filtered.filter((row) => row.status === status).length; return <li key={status}><i className={`status-swatch swatch-${index}`} /><span>{status}</span><strong>{count} · {percent.format(count / filtered.length)}</strong></li> })}</ul></div> : <p className="analytics-empty">No hay asignaciones para los filtros seleccionados.</p>}
      </section>
    </div>
  </div>
}
