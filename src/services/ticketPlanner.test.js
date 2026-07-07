import { describe, it, expect } from 'vitest'
import { planDay, reassignAfterRemoval } from './ticketPlanner'
import { seedFromStaffingPlan, shiftForDate, specialtyOf } from '../store/useStaffStore'

const MONDAY   = new Date(2026, 6, 6)  // пн 6 июля 2026
const SATURDAY = new Date(2026, 6, 4)  // сб 4 июля 2026

const STAFFING_PLAN = [{
  buildingId: 'b1',
  numWatchPos: 1,
  roles: [
    { id: 'engineer',   role: 'Инженер по эксплуатации', stavka: 1 },
    { id: 'technician', role: 'Техник-универсал',        stavka: 2 },
    { id: 'watchman',   role: 'Дежурный (суточник)',     stavka: 4 },
  ],
}]

const staff = () => seedFromStaffingPlan(STAFFING_PLAN)

let seq = 0
const mkTicket = (over = {}) => ({
  id: `tk${++seq}`,
  buildingId: 'b1',
  systemId: 's1',
  systemName: 'Вентиляция',
  category: 'hvac',
  taskId: `task${seq}`,
  type: 'TO',
  title: `Операция ${seq}`,
  periodicity: 'ежедневно',
  date: '2026-07-06',
  status: 'open',
  assigneeId: null,
  manuallyAssigned: false,
  order: null,
  source: 'schedule',
  ...over,
})

describe('seedFromStaffingPlan', () => {
  it('суточник = 4 персоны (смены А/Б/В/Г), дневные по ставкам', () => {
    const s = staff()
    const watchmen = s.filter(p => p.kind === 'watchman')
    expect(watchmen).toHaveLength(4)
    expect(new Set(watchmen.map(p => p.shift))).toEqual(new Set(['А', 'Б', 'В', 'Г']))
    expect(s.filter(p => p.kind === 'technician')).toHaveLength(2)
    expect(s.filter(p => p.kind === 'engineer')).toHaveLength(1)
  })

  it('specialtyOf распознаёт профиль из должности', () => {
    expect(specialtyOf({ role: 'Техник-электрик', name: '' })).toBe('electrical')
    expect(specialtyOf({ role: 'Техник-универсал', name: '' })).toBeNull()
    expect(specialtyOf({ role: 'Техник', name: 'Сантехник Иванов' })).toBe('plumbing')
  })

  it('shiftForDate циклится сутки/трое', () => {
    const shifts = [0, 1, 2, 3, 4].map(i => shiftForDate(new Date(2026, 0, 1 + i)))
    expect(shifts).toEqual(['А', 'Б', 'В', 'Г', 'А'])
  })
})

describe('planDay — будний день', () => {
  it('ЭК → суточнику смены, ТО → техникам; инвариант 3', () => {
    const s = staff()
    const tickets = [
      mkTicket({ type: 'EK' }),
      mkTicket({ type: 'EK' }),
      mkTicket({ type: 'TO' }),
      mkTicket({ type: 'TO' }),
    ]
    const { tickets: out, unassigned } = planDay(tickets, s, MONDAY)

    const shift = shiftForDate(MONDAY)
    const watchmanId = s.find(p => p.kind === 'watchman' && p.shift === shift).id
    const techIds = new Set(s.filter(p => p.kind === 'technician').map(p => p.id))

    for (const t of out.filter(t => t.type === 'EK')) expect(t.assigneeId).toBe(watchmanId)
    for (const t of out.filter(t => t.type === 'TO')) expect(techIds.has(t.assigneeId)).toBe(true)
    expect(unassigned).toHaveLength(0)
    expect(out.filter(t => t.assigneeId).length + unassigned.length).toBe(out.length)
  })

  it('спец-задача уходит профильному технику, если он есть', () => {
    const s = staff()
    // Переименовали одного универсала в электрика (id стабилен)
    s.find(p => p.kind === 'technician').role = 'Техник-электрик'
    const electricianId = s.find(p => p.role === 'Техник-электрик').id

    const tickets = [
      mkTicket({ type: 'TO', category: 'electrical', systemName: 'ЭОМ' }),
      mkTicket({ type: 'TO', category: 'electrical', systemName: 'ЭОМ' }),
    ]
    const { tickets: out } = planDay(tickets, s, MONDAY)
    for (const t of out) expect(t.assigneeId).toBe(electricianId)
  })

  it('без лимитов: 50 задач раскладываются полностью, нераспределённых нет', () => {
    const s = staff()
    const tickets = Array.from({ length: 50 }, () => mkTicket({ type: 'TO' }))
    const { tickets: out, unassigned } = planDay(tickets, s, MONDAY)
    expect(unassigned).toHaveLength(0)
    expect(out.every(t => t.assigneeId)).toBe(true)
  })

  it('нераспределённые только при пустом реестре', () => {
    const { tickets: out, unassigned } = planDay([mkTicket()], [], MONDAY)
    expect(unassigned).toHaveLength(1)
    expect(out[0].assigneeId).toBeNull()
  })

  it('order: ЭК раньше ТО, группировка по системам', () => {
    const s = [staff().find(p => p.kind === 'watchman' && p.shift === shiftForDate(MONDAY))]
    const tickets = [
      mkTicket({ type: 'TO', systemName: 'Вентиляция', category: 'hvac' }),
      mkTicket({ type: 'EK', systemName: 'ЭОМ', category: 'electrical' }),
      mkTicket({ type: 'TO', systemName: 'ЭОМ', category: 'electrical' }),
      mkTicket({ type: 'EK', systemName: 'Вентиляция', category: 'hvac' }),
    ]
    const { tickets: out } = planDay(tickets, s, MONDAY)
    const sorted = [...out].sort((a, b) => a.order - b.order)
    // Первые два — ЭК, потом ТО
    expect(sorted[0].type).toBe('EK')
    expect(sorted[1].type).toBe('EK')
    expect(sorted[2].type).toBe('TO')
    expect(sorted[3].type).toBe('TO')
  })

  it('детерминизм: повторная раскладка идентична', () => {
    const s = staff()
    const tickets = Array.from({ length: 20 }, () => mkTicket())
    const a = planDay(tickets, s, MONDAY).tickets.map(t => `${t.id}:${t.assigneeId}:${t.order}`)
    const b = planDay(tickets, s, MONDAY).tickets.map(t => `${t.id}:${t.assigneeId}:${t.order}`)
    expect(a).toEqual(b)
  })
})

describe('planDay — выходной (инвариант 2 со стороны раскладки)', () => {
  it('суббота: все задачи — суточнику смены дня', () => {
    const s = staff()
    const shift = shiftForDate(SATURDAY)
    const watchmanId = s.find(p => p.kind === 'watchman' && p.shift === shift).id
    const tickets = [
      mkTicket({ type: 'EK', periodicity: 'ежедневно' }),
      mkTicket({ type: 'TO', periodicity: '1р/2дня' }),
    ]
    const { tickets: out, unassigned } = planDay(tickets, s, SATURDAY)
    for (const t of out) expect(t.assigneeId).toBe(watchmanId)
    expect(unassigned).toHaveLength(0)
  })
})

describe('planDay — неприкосновенность ручных назначений', () => {
  it('manuallyAssigned и закрытые не переназначаются', () => {
    const s = staff()
    const manual = mkTicket({ assigneeId: 'someone:custom', manuallyAssigned: true })
    const closed = mkTicket({ assigneeId: 'former:tech', status: 'done' })
    const { tickets: out } = planDay([manual, closed, mkTicket()], s, MONDAY)
    expect(out.find(t => t.id === manual.id).assigneeId).toBe('someone:custom')
    expect(out.find(t => t.id === closed.id).assigneeId).toBe('former:tech')
  })
})

describe('reassignAfterRemoval — инвариант 5', () => {
  it('открытые тикеты удалённого перераспределены, закрытые нетронуты', () => {
    const s = staff()
    const techA = s.filter(p => p.kind === 'technician')[0]
    const techB = s.filter(p => p.kind === 'technician')[1]

    const openT   = mkTicket({ assigneeId: techA.id, status: 'open' })
    const doneT   = mkTicket({ assigneeId: techA.id, status: 'done' })
    const otherT  = mkTicket({ assigneeId: techB.id, status: 'open', manuallyAssigned: true })

    const remaining = s.filter(p => p.id !== techA.id)
    const { tickets: out } = reassignAfterRemoval([openT, doneT, otherT], techA.id, remaining, MONDAY)

    const reOpen = out.find(t => t.id === openT.id)
    expect(reOpen.assigneeId).not.toBe(techA.id)
    expect(reOpen.assigneeId).not.toBeNull()

    expect(out.find(t => t.id === doneT.id).assigneeId).toBe(techA.id)   // закрытый — история
    expect(out.find(t => t.id === otherT.id).assigneeId).toBe(techB.id)  // чужой ручной — нетронут
  })
})
