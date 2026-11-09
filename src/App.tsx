import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  History,
  House,
  PawPrint,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import './App.css'
import { createModulePdf } from './lib/pdf'

type View = 'inicio' | 'participantes' | 'animalitos' | 'cargos' | 'historial' | 'recaudado'
type Participant = { id: string; name: string; createdAt: string }
type Animal = { id: string; name: string; price: number; cargo?: string; createdAt: string }
type CollectionStatus = 'Pagado' | 'Pendiente'
type FulfillmentStatus = 'Cumplió' | 'En espera' | 'No cumplió'
type CollectedAmount = { id: string; amount: number; status: CollectionStatus; responsibleId: string | null; createdAt: string }
type Charge = {
  id: string
  participantId: string
  animalId: string
  animalPrice: number
  amount: number
  observations: string
  eventYear: number
  fulfillmentStatus: FulfillmentStatus
  createdAt: string
}
type HistoricalRecord = {
  id: string
  participantId: string | null
  participantName: string
  animalId: string | null
  cargo: string
  detail: string
  eventYear: number
  fulfillmentStatus: FulfillmentStatus
  createdAt: string
}
type HistoryEntry = HistoricalRecord & { source: 'historial' | 'charges'; sourceId: string; animalName: string }
type Modal = { kind: 'participant' | 'animal' | 'charge'; id?: string } | null

const storageKeys = {
  participants: 'bajada-reyes-participants',
  animals: 'bajada-reyes-animals',
  charges: 'bajada-reyes-charges',
  collectedAmounts: 'bajada-reyes-collected-amounts',
}

const currency = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
})
const cargoTypes = ['Voluntario']
const tablePageSize = 10
const historicalYear = 2026
const currentEventYear = 2027
const fulfillmentStatuses: FulfillmentStatus[] = ['Cumplió', 'En espera', 'No cumplió']
const collectedAmountOptions = Array.from({ length: 10 }, (_, index) => Number(((index + 1) / 10).toFixed(2)))

const navigation: { id: View; label: string; icon: LucideIcon }[] = [
  { id: 'inicio', label: 'Resumen', icon: House },
  { id: 'participantes', label: 'Participantes', icon: UsersRound },
  { id: 'animalitos', label: 'Animalitos', icon: PawPrint },
  { id: 'cargos', label: 'Cargos', icon: ClipboardList },
  { id: 'historial', label: 'Historial', icon: History },
  { id: 'recaudado', label: 'Monto recaudado', icon: CircleDollarSign },
]

function readStorage<T>(key: string): T[] {
  try {
    const saved = localStorage.getItem(key)
    return saved ? (JSON.parse(saved) as T[]) : []
  } catch {
    return []
  }
}

function errorMessage(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : 'Ocurrió un error al comunicarse con Supabase.'
  if (message.includes('schema cache') || message.includes('does not exist')) {
    return 'Faltan tablas o columnas de Supabase. Ejecuta el SQL actualizado en el SQL Editor y luego pulsa Reintentar.'
  }
  return message
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function makeTimestamp() {
  return new Date().toISOString()
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function toUuid(id: string) {
  return /^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}$/i.test(id) ? id : makeId()
}

async function loadDatabase() {
  const client = supabase
  if (!client) throw new Error('Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env.local.')

  const fetchRows = async () => {
    const [participantsResult, animalsResult, chargesResult, collectedAmountsResult, historyResult] = await Promise.all([
      client.from('participants').select('*').order('created_at'),
      client.from('animals').select('*').order('created_at'),
      client.from('charges').select('*').order('created_at'),
      client.from('collected_amounts').select('*').order('created_at', { ascending: false }),
      client.from('historial').select('*').order('event_year', { ascending: false }).order('created_at', { ascending: false }),
    ])
    const queryError = participantsResult.error ?? animalsResult.error ?? chargesResult.error ?? collectedAmountsResult.error ?? historyResult.error
    if (queryError) throw queryError
    return {
      participants: participantsResult.data ?? [],
      animals: animalsResult.data ?? [],
      charges: chargesResult.data ?? [],
      collectedAmounts: collectedAmountsResult.data ?? [],
      historicalRecords: historyResult.data ?? [],
    }
  }

  let rows = await fetchRows()
  if (!rows.participants.length && !rows.animals.length && !rows.charges.length && !rows.collectedAmounts.length && !rows.historicalRecords.length) {
    const oldParticipants = readStorage<Participant>(storageKeys.participants)
    const oldAnimals = readStorage<Animal>(storageKeys.animals)
    const oldCharges = readStorage<Charge>(storageKeys.charges)

    if (oldParticipants.length || oldAnimals.length || oldCharges.length) {
      const participantIds = new Map(oldParticipants.map((item) => [item.id, toUuid(item.id)]))
      const animalIds = new Map(oldAnimals.map((item) => [item.id, toUuid(item.id)]))
      const { error: participantError } = await client.from('participants').upsert(oldParticipants.map((item) => ({
        id: participantIds.get(item.id),
        name: item.name,
        created_at: item.createdAt,
      })))
      if (participantError) throw participantError

      const { error: animalError } = await client.from('animals').upsert(oldAnimals.map((item) => ({
        id: animalIds.get(item.id),
        name: item.name,
        price: item.price,
        cargo: item.cargo ?? cargoTypes[0],
        created_at: item.createdAt ?? makeTimestamp(),
      })))
      if (animalError) throw animalError

      const chargeRows = oldCharges.flatMap((item) => {
        const participantId = participantIds.get(item.participantId)
        const animalId = animalIds.get(item.animalId)
        if (!participantId || !animalId) return []
        return [{
          id: toUuid(item.id),
          participant_id: participantId,
          animal_id: animalId,
          animal_price: item.animalPrice,
          amount: item.amount,
          observations: item.observations ?? '',
          event_year: item.eventYear ?? historicalYear,
          fulfillment_status: item.fulfillmentStatus ?? 'En espera',
          created_at: item.createdAt,
        }]
      })
      if (chargeRows.length) {
        const { error: chargeError } = await client.from('charges').upsert(chargeRows)
        if (chargeError) throw chargeError
      }
      rows = await fetchRows()
    }
  }

  if (!rows.collectedAmounts.length) {
    const oldAmounts = readStorage<CollectedAmount>(storageKeys.collectedAmounts)
    if (oldAmounts.length) {
      const { error } = await client.from('collected_amounts').upsert(oldAmounts.map((item) => ({
        id: toUuid(item.id),
        amount: item.amount,
        status: item.status ?? 'Pagado',
        responsible_id: item.responsibleId ?? null,
        created_at: item.createdAt,
      })))
      if (error) throw error
      rows = await fetchRows()
    }
  }

  const dateTables = [
    ['participants', rows.participants],
    ['animals', rows.animals],
    ['charges', rows.charges],
    ['collected_amounts', rows.collectedAmounts],
    ['historial', rows.historicalRecords],
  ] as const
  for (const [table, records] of dateTables) {
    for (const record of records) {
      if (isValidTimestamp(record.created_at)) continue
      const createdAt = makeTimestamp()
      const { error } = await client.from(table).update({ created_at: createdAt }).eq('id', record.id)
      if (error) throw error
      record.created_at = createdAt
    }
  }

  return {
    participants: rows.participants.map((row) => ({ id: row.id, name: row.name, createdAt: row.created_at })),
    animals: rows.animals.map((row) => ({ id: row.id, name: row.name, price: Number(row.price), cargo: row.cargo, createdAt: row.created_at })),
    charges: rows.charges.map((row) => ({
      id: row.id,
      participantId: row.participant_id,
      animalId: row.animal_id,
      animalPrice: Number(row.animal_price),
      amount: Number(row.amount),
      observations: row.observations ?? '',
      eventYear: Number(row.event_year ?? historicalYear),
      fulfillmentStatus: row.fulfillment_status ?? 'En espera',
      createdAt: row.created_at,
    })),
    collectedAmounts: rows.collectedAmounts.map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      status: row.status ?? 'Pagado',
      responsibleId: row.responsible_id ?? null,
      createdAt: row.created_at,
    })),
    historicalRecords: rows.historicalRecords.map((row) => ({
      id: row.id,
      participantId: row.participant_id ?? null,
      participantName: row.participant_name,
      animalId: row.animal_id ?? null,
      cargo: row.cargo,
      detail: row.detail ?? '',
      eventYear: Number(row.event_year),
      fulfillmentStatus: row.fulfillment_status ?? 'En espera',
      createdAt: row.created_at,
    })),
  }
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function paginate<T>(items: T[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / tablePageSize))
  const currentPage = Math.min(requestedPage, pageCount)
  return {
    pageCount,
    currentPage,
    items: items.slice((currentPage - 1) * tablePageSize, currentPage * tablePageSize),
  }
}

function Pagination({ currentPage, pageCount, totalItems, label, onPageChange }: {
  currentPage: number
  pageCount: number
  totalItems: number
  label: string
  onPageChange: (page: number) => void
}) {
  return (
    <div className="pagination-bar">
      <span>Mostrando {(currentPage - 1) * tablePageSize + 1}–{Math.min(currentPage * tablePageSize, totalItems)} de {totalItems}</span>
      <nav className="pagination-controls" aria-label={`Paginación de ${label}`}>
        <button type="button" className="page-arrow" aria-label="Página anterior" title="Página anterior" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}><ChevronLeft size={16} /></button>
        {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <button key={page} type="button" className={`page-number ${page === currentPage ? 'current' : ''}`} aria-label={`Página ${page}`} aria-current={page === currentPage ? 'page' : undefined} onClick={() => onPageChange(page)}>{page}</button>)}
        <button type="button" className="page-arrow" aria-label="Página siguiente" title="Página siguiente" disabled={currentPage === pageCount} onClick={() => onPageChange(currentPage + 1)}><ChevronRight size={16} /></button>
      </nav>
    </div>
  )
}

function App() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [animals, setAnimals] = useState<Animal[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [collectedAmounts, setCollectedAmounts] = useState<CollectedAmount[]>([])
  const [historicalRecords, setHistoricalRecords] = useState<HistoricalRecord[]>([])
  const [responsiblePickerFor, setResponsiblePickerFor] = useState<string | null>(null)
  const [responsibleSearch, setResponsibleSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [databaseError, setDatabaseError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [view, setView] = useState<View>('inicio')
  const [modal, setModal] = useState<Modal>(null)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isSavingHistory, setIsSavingHistory] = useState(false)
  const [participantPage, setParticipantPage] = useState(1)
  const [animalPage, setAnimalPage] = useState(1)
  const [chargePage, setChargePage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyYearFilter, setHistoryYearFilter] = useState<'Todos' | '2026' | '2027'>('Todos')
  const [collectedPage, setCollectedPage] = useState(1)
  const [participantName, setParticipantName] = useState('')
  const [animalName, setAnimalName] = useState('')
  const [animalPrice, setAnimalPrice] = useState('')
  const [animalCargo, setAnimalCargo] = useState(cargoTypes[0])
  const [chargeParticipantId, setChargeParticipantId] = useState('')
  const [chargeAnimalId, setChargeAnimalId] = useState('')
  const [chargeYear, setChargeYear] = useState(currentEventYear)
  const [chargeFulfillmentStatus, setChargeFulfillmentStatus] = useState<FulfillmentStatus>('En espera')
  const [isHistoryChargeForm, setIsHistoryChargeForm] = useState(false)
  const [observations, setObservations] = useState('')

  useEffect(() => {
    let active = true
    loadDatabase()
      .then((data) => {
        if (!active) return
        setParticipants(data.participants)
        setAnimals(data.animals)
        setCharges(data.charges)
        setCollectedAmounts(data.collectedAmounts)
        setHistoricalRecords(data.historicalRecords)
      })
      .catch((error: unknown) => {
        if (active) setDatabaseError(errorMessage(error))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => { active = false }
  }, [reloadToken])

  const totalAssigned = useMemo(
    () => charges.reduce((total, charge) => total + (animals.find((animal) => animal.id === charge.animalId)?.price ?? charge.animalPrice), 0),
    [animals, charges],
  )
  const totalCollected = useMemo(
    () => collectedAmounts.filter((item) => item.status === 'Pagado').reduce((total, item) => total + Math.round(item.amount * 100), 0) / 100,
    [collectedAmounts],
  )
  const pageTitle = navigation.find((item) => item.id === view)?.label ?? 'Resumen'
  const filteredParticipants = participants.filter((participant) =>
    participant.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')),
  )
  const participantPagination = paginate(filteredParticipants, participantPage)
  const filteredAnimals = animals.filter((animal) => {
    const query = search.toLocaleLowerCase('es')
    return `${animal.name} ${animal.cargo ?? cargoTypes[0]}`.toLocaleLowerCase('es').includes(query)
  })
  const animalPagination = paginate(filteredAnimals, animalPage)
  const currentYearCharges = charges.filter((charge) => charge.eventYear === currentEventYear)
  const filteredCharges = currentYearCharges.filter((charge) => {
    const participant = participants.find((item) => item.id === charge.participantId)?.name ?? ''
    const assignedAnimal = animals.find((item) => item.id === charge.animalId)
    const animal = assignedAnimal?.name ?? ''
    const animalCargo = assignedAnimal?.cargo ?? ''
    return `${participant} ${animal} ${animalCargo} ${charge.observations}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))
  })
  const chargePagination = paginate(filteredCharges, chargePage)
  const historyEntries: HistoryEntry[] = historicalRecords.map((record) => ({
    ...record, source: 'historial', sourceId: record.id,
    animalName: animals.find((animal) => animal.id === record.animalId)?.name ?? record.cargo,
  }))
  const filteredHistory = historyEntries.filter((entry) => {
    if (historyYearFilter !== 'Todos' && entry.eventYear !== Number(historyYearFilter)) return false
    return `${entry.participantName} ${entry.cargo} ${entry.animalName} ${entry.detail}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))
  })
  const historyPagination = paginate(filteredHistory, historyPage)
  const collectedPagination = paginate(collectedAmounts, collectedPage)
  const filteredResponsibleParticipants = participants.filter((participant) =>
    participant.name.toLocaleLowerCase('es').includes(responsibleSearch.toLocaleLowerCase('es')),
  )

  function openParticipant(id?: string) {
    setParticipantName(participants.find((item) => item.id === id)?.name ?? '')
    setModal({ kind: 'participant', id })
  }

  function openAnimal(id?: string) {
    const animal = animals.find((item) => item.id === id)
    setAnimalName(animal?.name ?? '')
    setAnimalPrice(animal ? String(animal.price) : '')
    setAnimalCargo(animal?.cargo ?? cargoTypes[0])
    setModal({ kind: 'animal', id })
  }

  function openCharge(id?: string, historyEntry = false) {
    const charge = charges.find((item) => item.id === id)
    setChargeParticipantId(charge?.participantId ?? '')
    setChargeAnimalId(charge?.animalId ?? '')
    setObservations(charge?.observations ?? '')
    setChargeYear(charge?.eventYear ?? (historyEntry ? Number(historyYearFilter === 'Todos' ? historicalYear : historyYearFilter) : currentEventYear))
    setChargeFulfillmentStatus(charge?.fulfillmentStatus ?? 'En espera')
    setIsHistoryChargeForm(historyEntry)
    setModal({ kind: 'charge', id })
  }

  function closeModal() {
    setModal(null)
  }

  async function saveParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = participantName.trim()
    if (!name) return
    if (!supabase) {
      setDatabaseError('Supabase no está configurado. Revisa las variables VITE_SUPABASE_* en .env.local.')
      return
    }
    const id = modal?.id ?? makeId()
    const createdAt = participants.find((item) => item.id === modal?.id)?.createdAt ?? makeTimestamp()
    const { error } = await supabase.from('participants').upsert({ id, name, created_at: createdAt })
    if (error) {
      setDatabaseError(errorMessage(error))
      return
    }
    if (modal?.id) {
      setParticipants((items) => items.map((item) => item.id === modal.id ? { ...item, name } : item))
    } else {
      setParticipants((items) => [...items, { id, name, createdAt }])
    }
    closeModal()
  }

  async function saveAnimal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = animalName.trim()
    const price = Number(animalPrice)
    if (!name || !Number.isFinite(price) || price < 0) return
    if (!supabase) {
      setDatabaseError('Supabase no está configurado. Revisa las variables VITE_SUPABASE_* en .env.local.')
      return
    }
    const id = modal?.id ?? makeId()
    const cargo = animalCargo.trim() || cargoTypes[0]
    const createdAt = animals.find((item) => item.id === modal?.id)?.createdAt ?? makeTimestamp()
    const { error } = await supabase.from('animals').upsert({ id, name, price, cargo, created_at: createdAt })
    if (error) {
      setDatabaseError(errorMessage(error))
      return
    }
    if (modal?.id) {
      setAnimals((items) => items.map((item) => item.id === modal.id ? { ...item, name, price, cargo, createdAt } : item))
      setCharges((items) => items.map((item) => item.animalId === modal.id ? { ...item, animalPrice: price, amount: price } : item))
    } else {
      setAnimals((items) => [...items, { id, name, price, cargo, createdAt }])
    }
    setAnimalPage(1)
    closeModal()
  }

  async function saveCharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const animal = animals.find((item) => item.id === chargeAnimalId)
    if (!chargeParticipantId || !animal) return
    const existingCharge = charges.find((item) => item.id === modal?.id)
    if (!supabase) {
      setDatabaseError('Supabase no está configurado. Revisa las variables VITE_SUPABASE_* en .env.local.')
      return
    }
    const nextCharge: Charge = {
      id: modal?.id ?? makeId(),
      participantId: chargeParticipantId,
      animalId: animal.id,
      animalPrice: animal.price,
      amount: animal.price,
      observations: observations.trim(),
      eventYear: isHistoryChargeForm ? chargeYear : currentEventYear,
      fulfillmentStatus: chargeFulfillmentStatus,
      createdAt: existingCharge?.createdAt ?? makeTimestamp(),
    }
    const { error } = await supabase.from('charges').upsert({
      id: nextCharge.id,
      participant_id: nextCharge.participantId,
      animal_id: nextCharge.animalId,
      animal_price: nextCharge.animalPrice,
      amount: nextCharge.amount,
      observations: nextCharge.observations,
      event_year: nextCharge.eventYear,
      fulfillment_status: nextCharge.fulfillmentStatus,
      created_at: nextCharge.createdAt,
    })
    if (error) {
      setDatabaseError(errorMessage(error))
      return
    }
    setCharges((items) => modal?.id
      ? items.map((item) => item.id === modal.id ? nextCharge : item)
      : [...items, nextCharge])
    setChargePage(1)
    setHistoryPage(1)
    closeModal()
  }

  async function updateHistoryFulfillmentStatus(entry: HistoryEntry, fulfillmentStatus: FulfillmentStatus) {
    if (!supabase) return setDatabaseError('Supabase no está configurado.')
    const { error } = await supabase.from('historial').update({ fulfillment_status: fulfillmentStatus }).eq('id', entry.sourceId)
    if (error) return setDatabaseError(errorMessage(error))
    setHistoricalRecords((items) => items.map((item) => item.id === entry.sourceId ? { ...item, fulfillmentStatus } : item))
  }

  async function removeParticipant(participant: Participant) {
    if (charges.some((charge) => charge.participantId === participant.id)) {
      window.alert('Este participante tiene cargos registrados. Elimina o reasigna esos cargos antes de continuar.')
      return
    }
    if (window.confirm(`¿Eliminar a ${participant.name}?`)) {
      if (!supabase) return setDatabaseError('Supabase no está configurado.')
      const { error } = await supabase.from('participants').delete().eq('id', participant.id)
      if (error) return setDatabaseError(errorMessage(error))
      setParticipants((items) => items.filter((item) => item.id !== participant.id))
    }
  }

  async function removeAnimal(animal: Animal) {
    if (charges.some((charge) => charge.animalId === animal.id)) {
      window.alert('Este animalito tiene un cargo asignado. Elimina o modifica la asignación antes de continuar.')
      return
    }
    if (window.confirm(`¿Eliminar ${animal.name} del catálogo?`)) {
      if (!supabase) return setDatabaseError('Supabase no está configurado.')
      const { error } = await supabase.from('animals').delete().eq('id', animal.id)
      if (error) return setDatabaseError(errorMessage(error))
      setAnimals((items) => items.filter((item) => item.id !== animal.id))
      setAnimalPage(1)
    }
  }

  async function removeCharge(charge: Charge) {
    if (window.confirm('¿Eliminar esta asignación?')) {
      if (!supabase) return setDatabaseError('Supabase no está configurado.')
      const { error } = await supabase.from('charges').delete().eq('id', charge.id)
      if (error) return setDatabaseError(errorMessage(error))
      setCharges((items) => items.filter((item) => item.id !== charge.id))
      setChargePage(1)
    }
  }

  async function recordCollectedAmount(amount: number) {
    if (!supabase) return setDatabaseError('Supabase no está configurado.')
    const entry: CollectedAmount = {
      id: makeId(),
      amount,
      status: 'Pendiente',
      responsibleId: null,
      createdAt: makeTimestamp(),
    }
    const { error } = await supabase.from('collected_amounts').insert({
      id: entry.id,
      amount: entry.amount,
      status: entry.status,
      responsible_id: entry.responsibleId,
      created_at: entry.createdAt,
    })
    if (error) return setDatabaseError(errorMessage(error))
    setCollectedAmounts((items) => [entry, ...items])
    setCollectedPage(1)
  }

  async function updateCollectedStatus(entry: CollectedAmount, status: CollectionStatus) {
    if (!supabase) return setDatabaseError('Supabase no está configurado.')
    const { error } = await supabase.from('collected_amounts').update({ status }).eq('id', entry.id)
    if (error) return setDatabaseError(errorMessage(error))
    setCollectedAmounts((items) => items.map((item) => item.id === entry.id ? { ...item, status } : item))
  }

  function openResponsiblePicker(entryId: string) {
    setResponsibleSearch('')
    setResponsiblePickerFor(entryId)
  }

  async function updateCollectedResponsible(responsibleId: string | null) {
    if (!responsiblePickerFor) return
    if (!supabase) return setDatabaseError('Supabase no está configurado.')
    const { error } = await supabase.from('collected_amounts').update({ responsible_id: responsibleId }).eq('id', responsiblePickerFor)
    if (error) return setDatabaseError(errorMessage(error))
    setCollectedAmounts((items) => items.map((item) => item.id === responsiblePickerFor ? { ...item, responsibleId } : item))
    setResponsiblePickerFor(null)
  }

  async function removeCollectedAmount(entry: CollectedAmount) {
    if (!window.confirm(`¿Eliminar el registro de ${currency.format(entry.amount)}?`)) return
    if (!supabase) return setDatabaseError('Supabase no está configurado.')
    const { error } = await supabase.from('collected_amounts').delete().eq('id', entry.id)
    if (error) return setDatabaseError(errorMessage(error))
    setCollectedAmounts((items) => items.filter((item) => item.id !== entry.id))
    setCollectedPage(1)
  }

  const tabRows = view === 'participantes' ? participants : view === 'animalitos' ? animals : view === 'cargos' ? currentYearCharges : view === 'historial' ? historyEntries : view === 'recaudado' ? collectedAmounts : []
  const visibleRows = view === 'participantes' ? filteredParticipants : view === 'animalitos' ? filteredAnimals : view === 'cargos' ? filteredCharges : view === 'historial' ? filteredHistory : collectedAmounts
  const selectedInTab = tabRows.filter((row) => selectedIds.includes(row.id))
  function selectionCell(id: string, label: string) {
    return <td className="selection-cell"><input type="checkbox" aria-label={`Seleccionar ${label}`} checked={selectedIds.includes(id)} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, id] : ids.filter((item) => item !== id))} /></td>
  }
  async function deleteRows(all: boolean) {
    if (!supabase || isDeleting) return
    const ids = (all ? tabRows : selectedInTab).map((row) => row.id)
    if (!ids.length) return
    if ((view === 'participantes' && charges.some((row) => ids.includes(row.participantId))) || (view === 'animalitos' && charges.some((row) => ids.includes(row.animalId)))) {
      window.alert('Hay registros con cargos asignados. Elimina o reasigna esos cargos primero. No se eliminó ningún registro.')
      return
    }
    if (!window.confirm(`¿Eliminar ${ids.length} registros de ${pageTitle}${all ? ', incluidos los que no aparecen por los filtros o la paginación' : ' seleccionados'}? Esta acción no se puede deshacer.`)) return
    const table = view === 'participantes' ? 'participants' : view === 'animalitos' ? 'animals' : view === 'cargos' ? 'charges' : view === 'historial' ? 'historial' : 'collected_amounts'
    setIsDeleting(true)
    try {
      const { error } = await supabase.from(table).delete().in('id', ids)
      if (error) throw error
      if (view === 'participantes') {
        setParticipants((rows) => rows.filter((row) => !ids.includes(row.id)))
        setCollectedAmounts((rows) => rows.map((row) => row.responsibleId && ids.includes(row.responsibleId) ? { ...row, responsibleId: null } : row))
        setHistoricalRecords((rows) => rows.map((row) => row.participantId && ids.includes(row.participantId) ? { ...row, participantId: null } : row))
      }
      if (view === 'animalitos') {
        setAnimals((rows) => rows.filter((row) => !ids.includes(row.id)))
        setHistoricalRecords((rows) => rows.map((row) => row.animalId && ids.includes(row.animalId) ? { ...row, animalId: null } : row))
      }
      if (view === 'cargos') setCharges((rows) => rows.filter((row) => !ids.includes(row.id)))
      if (view === 'historial') setHistoricalRecords((rows) => rows.filter((row) => !ids.includes(row.id)))
      if (view === 'recaudado') setCollectedAmounts((rows) => rows.filter((row) => !ids.includes(row.id)))
      // Avoid reimporting deleted records from the legacy local backup.
      const key = view === 'participantes' ? storageKeys.participants : view === 'animalitos' ? storageKeys.animals : view === 'cargos' ? storageKeys.charges : view === 'recaudado' ? storageKeys.collectedAmounts : null
      if (key) localStorage.removeItem(key)
      setSelectedIds([])
    } catch (error) { setDatabaseError(errorMessage(error)) }
    finally { setIsDeleting(false) }
  }

  async function saveChargesToHistory() {
    if (isSavingHistory || !currentYearCharges.length) return
    if (!supabase) return setDatabaseError('Supabase no está configurado.')
    setIsSavingHistory(true)
    setDatabaseError('')
    try {
      const records: HistoricalRecord[] = currentYearCharges.map((charge) => ({
        id: charge.id, participantId: charge.participantId,
        participantName: participants.find((row) => row.id === charge.participantId)?.name ?? 'Sin participante',
        animalId: charge.animalId,
        cargo: animals.find((row) => row.id === charge.animalId)?.name ?? 'Cargo voluntario',
        detail: charge.observations, eventYear: charge.eventYear,
        fulfillmentStatus: charge.fulfillmentStatus, createdAt: charge.createdAt,
      }))
      const { error } = await supabase.from('historial').upsert(records.map((row) => ({
          id: row.id, participant_id: row.participantId, participant_name: row.participantName,
          animal_id: row.animalId, cargo: row.cargo, detail: row.detail, event_year: row.eventYear,
          fulfillment_status: row.fulfillmentStatus, created_at: row.createdAt,
      })), { onConflict: 'id', ignoreDuplicates: true })
      if (error) throw error
      const { data, error: readError } = await supabase.from('historial').select('*').in('id', records.map((row) => row.id))
      if (readError) throw readError
      if (!data || data.length !== records.length) throw new Error('No se pudo verificar que todos los cargos estén guardados en Historial. Vuelve a intentarlo.')
      const saved: HistoricalRecord[] = data.map((row) => ({
        id: row.id, participantId: row.participant_id, participantName: row.participant_name,
        animalId: row.animal_id, cargo: row.cargo, detail: row.detail,
        eventYear: row.event_year, fulfillmentStatus: row.fulfillment_status, createdAt: row.created_at,
      }))
      setHistoricalRecords((rows) => [...saved, ...rows.filter((row) => !saved.some((record) => record.id === row.id))])
      setHistoryYearFilter('2027')
      setHistoryPage(1)
      setSearch('')
      setSelectedIds([])
      setView('historial')
    } catch (error) { setDatabaseError(errorMessage(error)) }
    finally { setIsSavingHistory(false) }
  }

  async function exportPdf() {
    if (isExporting || !exportRows.length) return
    setIsExporting(true)
    try {
      const createdAt = makeTimestamp()
      const pdf = createModulePdf(pageTitle, exportHeaders, exportRows)
      const url = URL.createObjectURL(pdf)
      const link = document.createElement('a')
      link.href = url
      link.download = `bajada-de-reyes-${view}-${createdAt.slice(0, 10)}.pdf`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (error) { setDatabaseError(errorMessage(error)) }
    finally { setIsExporting(false) }
  }

  function getExportData() {
    const sheets: [string, (string | number)[][]][] = [
      ['Participantes', [['Participante', 'Animalitos a su cargo', 'Total de cargos (S/)', 'Fecha de registro'], ...filteredParticipants.map((participant) => {
        const assigned = charges.filter((charge) => charge.participantId === participant.id)
        return [participant.name, assigned.map((charge) => animals.find((item) => item.id === charge.animalId)?.name ?? 'Animalito eliminado').join(', ') || 'Sin asignaciones', assigned.reduce((total, charge) => total + (animals.find((item) => item.id === charge.animalId)?.price ?? charge.animalPrice), 0), formatDate(participant.createdAt)]
      })]],
      ['Animalitos', [['Animalito', 'Monto (S/)', 'Cargo registrado', 'Fecha de registro', 'Observaciones'], ...filteredAnimals.map((animal) => [
        animal.name,
        animal.price,
        animal.cargo ?? cargoTypes[0],
        formatDate(animal.createdAt),
        charges.filter((charge) => charge.animalId === animal.id).map((charge) => charge.observations.trim()).filter(Boolean).join(' | '),
      ])]],
      ['Cargos', [['Año', 'Participante', 'Animalito', 'Monto (S/)', 'Cargo registrado', 'Estado', 'Observaciones', 'Fecha y hora'], ...filteredCharges.map((charge) => [
        charge.eventYear,
        participants.find((item) => item.id === charge.participantId)?.name ?? 'Participante eliminado',
        animals.find((item) => item.id === charge.animalId)?.name ?? 'Animalito eliminado',
        animals.find((item) => item.id === charge.animalId)?.price ?? charge.animalPrice,
        animals.find((item) => item.id === charge.animalId)?.cargo ?? cargoTypes[0],
        charge.fulfillmentStatus,
        charge.observations,
        formatDate(charge.createdAt),
      ])]],
      ['Historial', [['Año', 'Participante', 'Cargo', 'Animal relacionado', 'Observaciones / detalle', 'Cumplimiento', 'Fecha y hora'], ...filteredHistory.map((entry) => [
        entry.eventYear, entry.participantName, entry.cargo, entry.animalName, entry.detail, entry.fulfillmentStatus, formatDate(entry.createdAt),
      ])]],
      ['Monto recaudado', [['Monto (S/)', 'Estado', 'Responsable', 'Fecha y hora'], ...collectedAmounts.map((item) => [
        item.amount,
        item.status,
        participants.find((participant) => participant.id === item.responsibleId)?.name ?? '',
        formatDate(item.createdAt),
      ])]],
      ['Resumen', [
        ['Concepto', 'Cantidad / total'],
        ['Participantes', participants.length],
        ['Animalitos', animals.length],
        ['Cargos registrados', charges.length],
        ['Total de cargos (S/)', totalAssigned],
        ['Total recaudado (S/)', totalCollected],
      ]],
    ]
    return sheets.find(([name]) => name === pageTitle)![1]
  }

  const [exportHeaders, ...exportRows] = getExportData()

  async function exportWorkbook() {
    if (isExporting || !exportRows.length) return
    setIsExporting(true)
    try {
      const XLSX = await import('@e965/xlsx')
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([exportHeaders, ...exportRows]), pageTitle)
      XLSX.writeFile(workbook, `bajada-de-reyes-${view}-${makeTimestamp().slice(0, 10)}.xlsx`)
    } catch (error) { setDatabaseError(errorMessage(error)) }
    finally { setIsExporting(false) }
  }

  const latestCharges = [...charges].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, tablePageSize)
  const selectedChargeAnimal = animals.find((animal) => animal.id === chargeAnimalId)

  if (isLoading) return <div className="loading-screen"><span className="loading-mark"><Sparkles size={21} /></span><p>Conectando con Supabase...</p></div>

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><Sparkles size={20} strokeWidth={1.8} /></div>
          <div>
            <p className="brand-kicker">Tradición familiar</p>
            <p className="brand-name">Bajada de Reyes</p>
          </div>
        </div>
        <div className="family-label"><span className="family-dot" /> Familia Mallma</div>
        <p className="nav-caption">GESTIÓN</p>
        <nav className="main-nav" aria-label="Navegación principal">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => { setView(id); setSelectedIds([]); setSearch(''); setParticipantPage(1); setAnimalPage(1); setChargePage(1); setHistoryPage(1); setCollectedPage(1) }}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {view === id && <ChevronRight className="nav-chevron" size={15} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-star">✦</span>
          <p>Una tradición que nos reúne cada año.</p>
        </div>
        <div className="sidebar-footer"><span className="status-dot" /> Base de datos Supabase</div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>Familia Mallma</span><span className="breadcrumb-divider">/</span><strong>{pageTitle}</strong></div>
          <div className="export-actions"><button type="button" className="button button-secondary export-button" onClick={exportPdf} disabled={isExporting || !exportRows.length} title={`Exportar ${pageTitle}`}><ArrowDownToLine size={17} />{isExporting ? 'Exportando…' : 'Exportar PDF'}</button>
          <button type="button" className="button button-secondary export-button" onClick={exportWorkbook} disabled={isExporting || !exportRows.length} title={`Exportar ${pageTitle}`}>
            <ArrowDownToLine size={17} /> <span>Exportar Excel</span>
          </button></div>
        </header>

        <div className="page-content">
          {databaseError && <div className="database-alert" role="alert"><span>{databaseError}</span><button type="button" onClick={() => { setIsLoading(true); setDatabaseError(''); setReloadToken((token) => token + 1) }}>Reintentar</button></div>}
          <section className="page-heading">
            <div>
              <p className="eyebrow">CONTROL DE LA CELEBRACIÓN</p>
              <h1>{view === 'inicio' ? 'Bajada de Reyes' : pageTitle}</h1>
              <p className="heading-subtitle">{view === 'inicio' ? 'Registro y seguimiento de los cargos del pesebre.' : `Administra ${view === 'participantes' ? 'a las personas de la celebración' : view === 'animalitos' ? 'el catálogo, los montos y el tipo de cargo' : view === 'cargos' ? 'las asignaciones de la celebración 2027' : view === 'historial' ? 'los cargos, responsables y cumplimiento por año' : 'los ingresos de la celebración'}.`}</p>
            </div>
            {view !== 'inicio' && view !== 'recaudado' && view !== 'historial' && (
              <button
                type="button"
                className="button button-primary"
                onClick={() => view === 'participantes' ? openParticipant() : view === 'animalitos' ? openAnimal() : openCharge()}
                disabled={view === 'cargos' && (!participants.length || !animals.length)}
              >
                <Plus size={17} />
                {view === 'participantes' ? 'Nuevo participante' : view === 'animalitos' ? 'Nuevo animalito' : 'Asignar cargo'}
              </button>
            )}
          </section>

          {view === 'inicio' && (
            <>
              <section className="stat-grid" aria-label="Resumen de registros">
                <article className="stat-card stat-green"><div className="stat-icon"><UsersRound size={19} /></div><p>Participantes</p><strong>{participants.length}</strong><span>registrados</span></article>
                <article className="stat-card stat-red"><div className="stat-icon"><PawPrint size={19} /></div><p>Animalitos</p><strong>{animals.length}</strong><span>en el pesebre</span></article>
                <article className="stat-card stat-gold"><div className="stat-icon"><ClipboardList size={19} /></div><p>Cargos</p><strong>{charges.length}</strong><span>asignaciones</span></article>
                <article className="stat-card stat-cream"><div className="stat-icon"><CircleDollarSign size={19} /></div><p>Monto recaudado</p><strong className="stat-total">{currency.format(totalCollected)}</strong><span>{collectedAmounts.length} {collectedAmounts.length === 1 ? 'registro' : 'registros'}</span></article>
              </section>

              <section className="dashboard-grid">
                <div className="panel recent-panel">
                  <div className="panel-heading"><div><p className="eyebrow">MOVIMIENTOS</p><h2>Asignaciones recientes</h2></div><button type="button" className="text-button" onClick={() => setView('cargos')}>Ver cargos <ChevronRight size={15} /></button></div>
                  {latestCharges.length ? (
                    <div className="table-wrap"><table><thead><tr><th>Participante</th><th>Animalito</th><th>Monto</th><th>Cargo</th><th>Fecha y hora</th></tr></thead><tbody>
                      {latestCharges.map((charge) => { const animal = animals.find((item) => item.id === charge.animalId); return <tr key={charge.id}><td className="name-cell">{participants.find((item) => item.id === charge.participantId)?.name ?? 'Sin participante'}</td><td><span className="animal-tag"><PawPrint size={13} />{animal?.name ?? 'Sin animalito'}</span></td><td className="amount-cell">{currency.format(animal?.price ?? charge.animalPrice)}</td><td>{animal?.cargo ?? cargoTypes[0]}</td><td>{formatDate(charge.createdAt)}</td></tr> })}
                    </tbody></table></div>
                  ) : <EmptyState icon={ClipboardList} title="Aún no hay cargos" detail="Registra la primera asignación para verla aquí." />}
                </div>
                <aside className="panel shortcuts-panel">
                  <div className="panel-heading"><div><p className="eyebrow">ACCESO RÁPIDO</p><h2>Crear un registro</h2></div></div>
                  <button type="button" className="shortcut-row" onClick={() => openParticipant()}><span className="shortcut-icon green-icon"><UsersRound size={17} /></span><span><strong>Participante</strong><small>Agregar a la familia</small></span><Plus size={16} /></button>
                  <button type="button" className="shortcut-row" onClick={() => openAnimal()}><span className="shortcut-icon red-icon"><PawPrint size={17} /></span><span><strong>Animalito</strong><small>Registrar precio</small></span><Plus size={16} /></button>
                  <button type="button" className="shortcut-row" onClick={() => openCharge()} disabled={!participants.length || !animals.length}><span className="shortcut-icon gold-icon"><ClipboardList size={17} /></span><span><strong>Asignar cargo</strong><small>Elegir participante y animalito</small></span><Plus size={16} /></button>
                  <div className="shortcut-footnote">Puedes registrar varios cargos por persona y asignar un mismo animalito a varias personas.</div>
                </aside>
              </section>
            </>
          )}

          {view === 'participantes' && (
            <section className="panel data-panel">
              <div className="bulk-actions"><label><input type="checkbox" aria-label="Seleccionar todos los resultados filtrados" disabled={!visibleRows.length || isDeleting} checked={visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id))} onChange={(event) => setSelectedIds(event.target.checked ? [...new Set([...selectedIds, ...visibleRows.map((row) => row.id)])] : selectedIds.filter((id) => !visibleRows.some((row) => row.id === id)))} /> Seleccionar resultados ({visibleRows.length})</label><span>{selectedInTab.length} seleccionados</span><button type="button" className="button button-secondary danger-action" disabled={!selectedInTab.length || isDeleting} onClick={() => deleteRows(false)}>Eliminar seleccionados</button><button type="button" className="button button-secondary danger-action" disabled={!tabRows.length || isDeleting} onClick={() => deleteRows(true)}>Eliminar todos ({tabRows.length})</button></div>
              <div className="panel-toolbar"><div><p className="eyebrow">PADRÓN FAMILIAR</p><h2>{participants.length} {participants.length === 1 ? 'participante' : 'participantes'}</h2></div><SearchBox value={search} onChange={(value) => { setSearch(value); setParticipantPage(1) }} placeholder="Buscar participante" /></div>
              {filteredParticipants.length ? <><div className="table-wrap"><table><thead><tr><th className="selection-cell"><span className="sr-only">Seleccionar</span></th><th>Participante</th><th>Fecha de registro</th><th>Cargos</th><th className="actions-heading">Acciones</th></tr></thead><tbody>{participantPagination.items.map((participant) => <tr key={participant.id}>{selectionCell(participant.id, participant.name)}<td className="name-cell">{participant.name}</td><td>{formatDate(participant.createdAt)}</td><td>{charges.filter((charge) => charge.participantId === participant.id).length}</td><td><RowActions onEdit={() => openParticipant(participant.id)} onDelete={() => removeParticipant(participant)} /></td></tr>)}</tbody></table></div><Pagination currentPage={participantPagination.currentPage} pageCount={participantPagination.pageCount} totalItems={filteredParticipants.length} label="participantes" onPageChange={setParticipantPage} /></> : <EmptyState icon={UsersRound} title={search ? 'No encontramos coincidencias' : 'Todavía no hay participantes'} detail={search ? 'Prueba con otro nombre.' : 'Agrega a las personas que participarán en la celebración.'} actionLabel={!search ? 'Agregar participante' : undefined} onAction={!search ? () => openParticipant() : undefined} />}
            </section>
          )}

          {view === 'animalitos' && (
            <section className="panel data-panel">
              <div className="bulk-actions"><label><input type="checkbox" aria-label="Seleccionar todos los resultados filtrados" disabled={!visibleRows.length || isDeleting} checked={visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id))} onChange={(event) => setSelectedIds(event.target.checked ? [...new Set([...selectedIds, ...visibleRows.map((row) => row.id)])] : selectedIds.filter((id) => !visibleRows.some((row) => row.id === id)))} /> Seleccionar resultados ({visibleRows.length})</label><span>{selectedInTab.length} seleccionados</span><button type="button" className="button button-secondary danger-action" disabled={!selectedInTab.length || isDeleting} onClick={() => deleteRows(false)}>Eliminar seleccionados</button><button type="button" className="button button-secondary danger-action" disabled={!tabRows.length || isDeleting} onClick={() => deleteRows(true)}>Eliminar todos ({tabRows.length})</button></div>
              <div className="panel-toolbar"><div><p className="eyebrow">CATÁLOGO DEL PESEBRE</p><h2>{animals.length} {animals.length === 1 ? 'animalito' : 'animalitos'}</h2></div><SearchBox value={search} onChange={(value) => { setSearch(value); setAnimalPage(1) }} placeholder="Buscar animalito" /></div>
              {filteredAnimals.length ? <><div className="table-wrap"><table><thead><tr><th className="selection-cell"><span className="sr-only">Seleccionar</span></th><th>Animalito</th><th>Monto</th><th>Cargo registrado</th><th>Fecha y hora</th><th>Asignaciones</th><th className="actions-heading">Acciones</th></tr></thead><tbody>{animalPagination.items.map((animal) => { const assignmentCount = charges.filter((item) => item.animalId === animal.id).length; return <tr key={animal.id}>{selectionCell(animal.id, animal.name)}<td><span className="name-with-icon"><span className="animal-avatar"><PawPrint size={16} /></span><span className="name-cell">{animal.name}</span></span></td><td className="amount-cell">{currency.format(animal.price)}</td><td>{animal.cargo ?? cargoTypes[0]}</td><td>{formatDate(animal.createdAt)}</td><td>{assignmentCount}</td><td><RowActions onEdit={() => openAnimal(animal.id)} onDelete={() => removeAnimal(animal)} /></td></tr> })}</tbody></table></div><Pagination currentPage={animalPagination.currentPage} pageCount={animalPagination.pageCount} totalItems={filteredAnimals.length} label="animalitos" onPageChange={setAnimalPage} /></> : <EmptyState icon={PawPrint} title={search ? 'No encontramos coincidencias' : 'El catálogo está vacío'} detail={search ? 'Prueba con otro nombre o cargo.' : 'Registra los animalitos con su monto y cargo.'} actionLabel={!search ? 'Agregar animalito' : undefined} onAction={!search ? () => openAnimal() : undefined} />}
            </section>
          )}

          {view === 'cargos' && (
            <section className="panel data-panel">
              <div className="bulk-actions"><label><input type="checkbox" aria-label="Seleccionar todos los resultados filtrados" disabled={!visibleRows.length || isDeleting} checked={visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id))} onChange={(event) => setSelectedIds(event.target.checked ? [...new Set([...selectedIds, ...visibleRows.map((row) => row.id)])] : selectedIds.filter((id) => !visibleRows.some((row) => row.id === id)))} /> Seleccionar resultados ({visibleRows.length})</label><span>{selectedInTab.length} seleccionados</span><button type="button" className="button button-secondary danger-action" disabled={!selectedInTab.length || isDeleting} onClick={() => deleteRows(false)}>Eliminar seleccionados</button><button type="button" className="button button-secondary danger-action" disabled={!tabRows.length || isDeleting} onClick={() => deleteRows(true)}>Eliminar todos ({tabRows.length})</button></div>
              <div className="panel-toolbar"><div><p className="eyebrow">ASIGNACIONES {currentEventYear}</p><h2>{currentYearCharges.length} {currentYearCharges.length === 1 ? 'cargo registrado' : 'cargos registrados'}</h2></div><SearchBox value={search} onChange={(value) => { setSearch(value); setChargePage(1) }} placeholder="Buscar participante o animalito" /></div>
              <div className="history-transfer">
                <div><strong>Guardar los cargos de {currentEventYear}</strong><p>Incluye todos los registros, aunque tengas una búsqueda activa. Los cargos se conservan aquí y los ya guardados mantienen su cumplimiento en Historial.</p></div>
                <button type="button" className="button button-primary" onClick={saveChargesToHistory} disabled={isSavingHistory || isDeleting || !currentYearCharges.length}>
                  <History size={17} />{isSavingHistory ? 'Guardando en Historial…' : `Guardar todos en Historial (${currentYearCharges.length})`}
                </button>
              </div>
              {filteredCharges.length ? <><div className="table-wrap"><table><thead><tr><th className="selection-cell"><span className="sr-only">Seleccionar</span></th><th>Participante</th><th>Animalito</th><th>Monto</th><th>Cargo registrado</th><th>Observaciones</th><th>Fecha y hora</th><th className="actions-heading">Acciones</th></tr></thead><tbody>{chargePagination.items.map((charge) => { const animal = animals.find((item) => item.id === charge.animalId); return <tr key={charge.id}>{selectionCell(charge.id, 'cargo')}<td className="name-cell">{participants.find((item) => item.id === charge.participantId)?.name ?? 'Sin participante'}</td><td><span className="animal-tag"><PawPrint size={13} />{animal?.name ?? 'Sin animalito'}</span></td><td className="amount-cell">{currency.format(animal?.price ?? charge.animalPrice)}</td><td>{animal?.cargo ?? cargoTypes[0]}</td><td className="observation-cell" title={charge.observations}>{charge.observations || '—'}</td><td>{formatDate(charge.createdAt)}</td><td><RowActions onEdit={() => openCharge(charge.id)} onDelete={() => removeCharge(charge)} /></td></tr> })}</tbody></table></div><Pagination currentPage={chargePagination.currentPage} pageCount={chargePagination.pageCount} totalItems={filteredCharges.length} label="cargos" onPageChange={setChargePage} /></> : <EmptyState icon={ClipboardList} title={search ? 'No encontramos coincidencias' : 'Aún no hay cargos'} detail={search ? 'Prueba con otro participante o animalito.' : 'Asigna uno o más animalitos a cada participante y agrega las observaciones necesarias.'} actionLabel={!search && participants.length && animals.length ? 'Asignar cargo' : undefined} onAction={!search && participants.length && animals.length ? () => openCharge() : undefined} />}
            </section>
          )}

          {view === 'historial' && (
            <section className="panel data-panel">
              <div className="bulk-actions"><label><input type="checkbox" aria-label="Seleccionar todos los resultados filtrados" disabled={!visibleRows.length || isDeleting} checked={visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id))} onChange={(event) => setSelectedIds(event.target.checked ? [...new Set([...selectedIds, ...visibleRows.map((row) => row.id)])] : selectedIds.filter((id) => !visibleRows.some((row) => row.id === id)))} /> Seleccionar resultados ({visibleRows.length})</label><span>{selectedInTab.length} seleccionados</span><button type="button" className="button button-secondary danger-action" disabled={!selectedInTab.length || isDeleting} onClick={() => deleteRows(false)}>Eliminar seleccionados</button><button type="button" className="button button-secondary danger-action" disabled={!tabRows.length || isDeleting} onClick={() => deleteRows(true)}>Eliminar todos ({tabRows.length})</button></div>
              <div className="panel-toolbar history-toolbar"><div><p className="eyebrow">REGISTRO POR AÑO</p><h2>{filteredHistory.length} {filteredHistory.length === 1 ? 'cargo en historial' : 'cargos en historial'}</h2></div><div className="history-filters"><label className="year-filter"><span>Año</span><select value={historyYearFilter} onChange={(event) => { setHistoryYearFilter(event.target.value as 'Todos' | '2026' | '2027'); setHistoryPage(1) }}><option value="Todos">Todos</option><option value="2026">2026</option><option value="2027">2027</option></select></label><SearchBox value={search} onChange={(value) => { setSearch(value); setHistoryPage(1) }} placeholder="Buscar participante o cargo" /></div></div>
              {filteredHistory.length ? <><div className="table-wrap"><table><thead><tr><th className="selection-cell"><span className="sr-only">Seleccionar</span></th><th>Año</th><th>Participante</th><th>Cargo</th><th>Animal relacionado</th><th>Observaciones / detalle</th><th>Cumplimiento</th><th>Fecha y hora</th></tr></thead><tbody>{historyPagination.items.map((entry) => <tr key={entry.id}>{selectionCell(entry.id, 'registro')}<td>{entry.eventYear}</td><td className="name-cell">{entry.participantName}</td><td>{entry.cargo}</td><td>{entry.animalName || '—'}</td><td className="observation-cell" title={entry.detail}>{entry.detail || '—'}</td><td><select className="fulfillment-select" aria-label={`Cumplimiento de ${entry.participantName}`} value={entry.fulfillmentStatus} onChange={(event) => updateHistoryFulfillmentStatus(entry, event.target.value as FulfillmentStatus)}>{fulfillmentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td><td>{formatDate(entry.createdAt)}</td></tr>)}</tbody></table></div><Pagination currentPage={historyPagination.currentPage} pageCount={historyPagination.pageCount} totalItems={filteredHistory.length} label="cargos del historial" onPageChange={setHistoryPage} /></> : <EmptyState icon={History} title={search || historyYearFilter !== 'Todos' ? 'No encontramos cargos' : 'Aún no hay historial'} detail={search || historyYearFilter !== 'Todos' ? 'Prueba con otro año o término de búsqueda.' : 'Guarda los cargos desde el botón Guardar todos en Historial del módulo Cargos.'} />}
            </section>
          )}

          {view === 'recaudado' && (
            <section className="panel data-panel collection-panel">
              <div className="bulk-actions"><label><input type="checkbox" aria-label="Seleccionar todos los resultados filtrados" disabled={!visibleRows.length || isDeleting} checked={visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id))} onChange={(event) => setSelectedIds(event.target.checked ? [...new Set([...selectedIds, ...visibleRows.map((row) => row.id)])] : selectedIds.filter((id) => !visibleRows.some((row) => row.id === id)))} /> Seleccionar resultados ({visibleRows.length})</label><span>{selectedInTab.length} seleccionados</span><button type="button" className="button button-secondary danger-action" disabled={!selectedInTab.length || isDeleting} onClick={() => deleteRows(false)}>Eliminar seleccionados</button><button type="button" className="button button-secondary danger-action" disabled={!tabRows.length || isDeleting} onClick={() => deleteRows(true)}>Eliminar todos ({tabRows.length})</button></div>
              <div className="collection-total"><div><p className="eyebrow">TOTAL PAGADO</p><strong>{currency.format(totalCollected)}</strong></div><span>{collectedAmounts.length} {collectedAmounts.length === 1 ? 'monto' : 'montos'}</span></div>
              <div className="collection-buttons" aria-label="Registrar monto recaudado">
                {collectedAmountOptions.map((amount) => <button key={amount} type="button" className="collection-button" onClick={() => recordCollectedAmount(amount)}>{currency.format(amount)}</button>)}
              </div>
              <div className="panel-toolbar"><div><p className="eyebrow">MOVIMIENTOS</p><h2>Montos registrados</h2></div></div>
              {collectedAmounts.length ? <><div className="table-wrap"><table><thead><tr><th className="selection-cell"><span className="sr-only">Seleccionar</span></th><th>Monto recaudado</th><th>Estado</th><th>Responsable</th><th>Fecha y hora</th><th className="actions-heading">Acciones</th></tr></thead><tbody>{collectedPagination.items.map((entry) => <tr key={entry.id}>{selectionCell(entry.id, 'registro')}<td className="amount-cell">{currency.format(entry.amount)}</td><td><select className={`status-select ${entry.status === 'Pagado' ? 'is-paid' : 'is-pending'}`} aria-label={`Estado de ${currency.format(entry.amount)}`} value={entry.status} onChange={(event) => updateCollectedStatus(entry, event.target.value as CollectionStatus)}><option value="Pagado">Pagado</option><option value="Pendiente">Pendiente</option></select></td><td><button type="button" className="responsible-button" onClick={() => openResponsiblePicker(entry.id)}>{participants.find((participant) => participant.id === entry.responsibleId)?.name ?? 'Elegir participante'}</button></td><td>{formatDate(entry.createdAt)}</td><td><div className="row-actions"><button type="button" className="icon-button danger-action" aria-label={`Eliminar ${currency.format(entry.amount)}`} title="Eliminar" onClick={() => removeCollectedAmount(entry)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div><Pagination currentPage={collectedPagination.currentPage} pageCount={collectedPagination.pageCount} totalItems={collectedAmounts.length} label="montos recaudados" onPageChange={setCollectedPage} /></> : <EmptyState icon={CircleDollarSign} title="Aún no hay montos" detail="Pulsa una denominación para registrarla; luego aparecerán en la fila los combos de Estado y Responsable." />}
            </section>
          )}
        </div>
      </main>

      {modal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal() }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-heading"><div><p className="eyebrow">FAMILIA MALLMA</p><h2 id="modal-title">{modal.id ? 'Editar' : 'Nuevo'} {modal.kind === 'participant' ? 'participante' : modal.kind === 'animal' ? 'animalito' : 'cargo'}</h2></div><button type="button" className="icon-button close-button" aria-label="Cerrar" onClick={closeModal}><X size={19} /></button></div>
            {modal.kind === 'participant' && <form onSubmit={saveParticipant}><label className="field-label" htmlFor="participant-name">Nombre completo</label><input id="participant-name" autoFocus required maxLength={100} value={participantName} onChange={(event) => setParticipantName(event.target.value)} placeholder="Ej. María Mallma" /><div className="modal-actions"><button type="button" className="button button-quiet" onClick={closeModal}>Cancelar</button><button type="submit" className="button button-primary">Guardar participante</button></div></form>}
            {modal.kind === 'animal' && <form onSubmit={saveAnimal}>
              <label className="field-label" htmlFor="animal-name">Nombre del animalito</label><input id="animal-name" autoFocus required maxLength={80} value={animalName} onChange={(event) => setAnimalName(event.target.value)} placeholder="Ej. Borreguito" />
              <label className="field-label" htmlFor="animal-price">Monto <span className="field-hint">en soles (S/)</span></label><div className="money-input"><span>S/</span><input id="animal-price" type="number" required min="0" step="0.01" value={animalPrice} onChange={(event) => setAnimalPrice(event.target.value)} placeholder="0.00" /></div>
              <label className="field-label" htmlFor="animal-cargo">Cargo del animalito</label><input id="animal-cargo" required maxLength={100} value={animalCargo} onChange={(event) => setAnimalCargo(event.target.value)} placeholder="Voluntario" />
              <div className="modal-actions"><button type="button" className="button button-quiet" onClick={closeModal}>Cancelar</button><button type="submit" className="button button-primary">Guardar animalito</button></div>
            </form>}
            {modal.kind === 'charge' && <form onSubmit={saveCharge}>
              <label className="field-label" htmlFor="charge-participant">Participante</label><select id="charge-participant" required value={chargeParticipantId} onChange={(event) => setChargeParticipantId(event.target.value)}><option value="" disabled>Selecciona una persona</option>{participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}</select>
              <label className="field-label" htmlFor="charge-animal">Animalito</label><select id="charge-animal" required value={chargeAnimalId} onChange={(event) => setChargeAnimalId(event.target.value)}><option value="" disabled>Selecciona un animalito</option>{animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.name}</option>)}</select>
              <label className="field-label" htmlFor="charge-year">Año del cargo</label><select id="charge-year" value={chargeYear} disabled={!isHistoryChargeForm} onChange={(event) => setChargeYear(Number(event.target.value))}><option value={historicalYear}>{historicalYear}</option><option value={currentEventYear}>{currentEventYear}</option></select>
              <label className="field-label" htmlFor="charge-fulfillment">Cumplimiento</label><select id="charge-fulfillment" value={chargeFulfillmentStatus} onChange={(event) => setChargeFulfillmentStatus(event.target.value as FulfillmentStatus)}>{fulfillmentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
              {selectedChargeAnimal && <div className="charge-values"><div><span>Monto del animalito</span><strong>{currency.format(selectedChargeAnimal.price)}</strong></div><div><span className="field-label">Cargo registrado</span><strong className="selected-cargo">{selectedChargeAnimal.cargo ?? cargoTypes[0]}</strong></div></div>}
              <label className="field-label" htmlFor="charge-observations">Observaciones <span className="field-hint">detalles del cargo voluntario</span></label><textarea id="charge-observations" rows={3} maxLength={500} value={observations} onChange={(event) => setObservations(event.target.value)} placeholder="Describe los detalles del cargo voluntario" />
              <div className="modal-actions"><button type="button" className="button button-quiet" onClick={closeModal}>Cancelar</button><button type="submit" className="button button-primary" disabled={!participants.length || !selectedChargeAnimal}>Guardar cargo</button></div>
            </form>}
          </section>
        </div>
      )}
      {responsiblePickerFor && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setResponsiblePickerFor(null) }}>
          <section className="modal responsible-picker" role="dialog" aria-modal="true" aria-labelledby="responsible-picker-title">
            <div className="modal-heading"><div><p className="eyebrow">MONTO RECAUDADO</p><h2 id="responsible-picker-title">Elegir participante</h2></div><button type="button" className="icon-button close-button" aria-label="Cerrar" onClick={() => setResponsiblePickerFor(null)}><X size={19} /></button></div>
            <label className="search-box responsible-search"><Search size={16} /><input autoFocus value={responsibleSearch} onChange={(event) => setResponsibleSearch(event.target.value)} placeholder="Buscar participante" /><span className="sr-only">Buscar participante</span></label>
            <div className="responsible-options"><button type="button" className="responsible-option no-responsible" onClick={() => updateCollectedResponsible(null)}>Sin responsable</button>{filteredResponsibleParticipants.length ? filteredResponsibleParticipants.map((participant) => <button key={participant.id} type="button" className="responsible-option" onClick={() => updateCollectedResponsible(participant.id)}>{participant.name}</button>) : <p className="responsible-empty">No se encontraron participantes.</p>}</div>
          </section>
        </div>
      )}
    </div>
  )
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="search-box"><Search size={16} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /><span className="sr-only">Buscar</span></label>
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="row-actions"><button type="button" className="icon-button" aria-label="Editar registro" title="Editar" onClick={onEdit}><Pencil size={15} /></button><button type="button" className="icon-button danger-action" aria-label="Eliminar registro" title="Eliminar" onClick={onDelete}><Trash2 size={15} /></button></div>
}

function EmptyState({ icon: Icon, title, detail, actionLabel, onAction }: { icon: LucideIcon; title: string; detail: string; actionLabel?: string; onAction?: () => void }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={22} strokeWidth={1.7} /></span><h3>{title}</h3><p>{detail}</p>{actionLabel && onAction && <button type="button" className="button button-secondary" onClick={onAction}><Plus size={16} />{actionLabel}</button>}</div>
}

export default App
