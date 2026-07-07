import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/idbStore', () => ({
  makeIdb: () => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  }),
}))

const { useWearStore } = await import('./useWearStore')
const { useTicketsStore } = await import('./useTicketsStore')
const { seedFromStaffingPlan } = await import('./useStaffStore')
const { canChangeTicket } = await import('../config/roleAccess')

const SYSTEMS_DATA = [{
  buildingId: 'b1',
  systems: [
    {
      id: 's1', name: 'ОВиК', category: 'hvac',
      maintenanceTasks: [{ id: 'ek1', mode: 'EK', operation: 'Обход', periodicity: 'ежедневно', months: [] }],
      equipment: [
        { id: 'eq1', name: 'Приточная установка', class: 'air_handling_unit', qty: 1 },
        { id: 'eq2', name: 'Чиллер', class: 'chiller', qty: 2 },
      ],
    },
    {
      id: 's2', name: 'Освещение', category: 'electrical',
      maintenanceTasks: [],
      equipment: [{ id: 'eq3', name: 'Светильники', class: 'luminaire', qty: 300 }], // не трекается
    },
  ],
}]

const STAFF = seedFromStaffingPlan([{
  buildingId: 'b1', numWatchPos: 1,
  roles: [
    { id: 'engineer',   role: 'Инженер по эксплуатации', stavka: 1 },
    { id: 'technician', role: 'Техник-универсал',        stavka: 1 },
    { id: 'watchman',   role: 'Дежурный (суточник)',     stavka: 4 },
  ],
}])

beforeEach(() => {
  useWearStore.setState({ measurements: [], loaded: true })
  useTicketsStore.setState({ tickets: [], loaded: true })
})

describe('useWearStore', () => {
  it('addMeasurement клампит 0–100, пишет source и ticketId', async () => {
    const m = await useWearStore.getState().addMeasurement({
      nodeId: 'eq1', buildingId: 'b1', date: '2026-07-07', wearPct: 140,
      ticketId: 'tk1', source: 'round',
    })
    expect(m.wearPct).toBe(100)
    expect(m.ticketId).toBe('tk1')
    expect(m.source).toBe('round')
  })

  it('замер с прошлой датой принимается (перенос бумажных журналов)', async () => {
    const m = await useWearStore.getState().addMeasurement({
      nodeId: 'eq1', buildingId: 'b1', date: '2024-01-15', wearPct: 20, source: 'manual',
    })
    expect(m.date).toBe('2024-01-15')
  })

  it('addBatch пропускает пустые поля (опциональность формы)', async () => {
    const n = await useWearStore.getState().addBatch([
      { nodeId: 'eq1', date: '2026-07-07', wearPct: 30, ticketId: 'tk1' },
      { nodeId: 'eq2', date: '2026-07-07', wearPct: null, ticketId: 'tk1' },  // пусто — скип
      { nodeId: 'eq2', date: '2026-07-07', wearPct: undefined },              // пусто — скип
    ])
    expect(n).toBe(1)
    expect(useWearStore.getState().measurements).toHaveLength(1)
  })

  it('осиротевший nodeId: замеры живут независимо от узла', async () => {
    await useWearStore.getState().addMeasurement({
      nodeId: 'ghost-node', buildingId: 'b1', date: '2026-07-07', wearPct: 55,
    })
    const ms = useWearStore.getState().measurementsForNode('ghost-node')
    expect(ms).toHaveLength(1) // не удаляются, не падает
  })
})

describe('generateInitialInspections', () => {
  it('по одному тикету на систему с трекаемыми узлами, инженеру, будний день', async () => {
    const res = await useTicketsStore.getState().generateInitialInspections(SYSTEMS_DATA, STAFF, new Date(2026, 6, 7))
    expect(res.created).toBe(1) // s1 — узлы есть; s2 — только лампы, не трекается

    const t = useTicketsStore.getState().tickets[0]
    expect(t.type).toBe('inspection')
    expect(t.systemId).toBe('s1')
    const engineer = STAFF.find(p => p.kind === 'engineer')
    expect(t.assigneeId).toBe(engineer.id)
    const [y, m, d] = t.date.split('-').map(Number)
    const wd = new Date(y, m - 1, d).getDay()
    expect(wd).not.toBe(0)
    expect(wd).not.toBe(6)
  })

  it('повторный запуск не дублирует (skip по id)', async () => {
    const st = useTicketsStore.getState()
    await st.generateInitialInspections(SYSTEMS_DATA, STAFF, new Date(2026, 6, 7))
    const res2 = await st.generateInitialInspections(SYSTEMS_DATA, STAFF, new Date(2026, 6, 9))
    expect(res2.created).toBe(0)
    expect(res2.skipped).toBe(1)
    expect(useTicketsStore.getState().tickets).toHaveLength(1)
  })
})

describe('ролевые guard-ы в сторе (не только UI)', () => {
  it('техник НЕ может изменить чужой тикет, может — свой', async () => {
    useTicketsStore.setState({ tickets: [
      { id: 'mine',  assigneeId: 'p1', status: 'open' },
      { id: 'alien', assigneeId: 'p2', status: 'open' },
    ], loaded: true })
    const st = useTicketsStore.getState()
    const executor = { role: 'executor', personId: 'p1' }

    expect(await st.setStatus('alien', 'done', executor)).toBe(false)
    expect(useTicketsStore.getState().tickets.find(t => t.id === 'alien').status).toBe('open')

    expect(await st.setStatus('mine', 'in_progress', executor)).toBe(true)
    expect(useTicketsStore.getState().tickets.find(t => t.id === 'mine').status).toBe('in_progress')
  })

  it('техник не может переназначать; chief может всё', async () => {
    useTicketsStore.setState({ tickets: [{ id: 'x', assigneeId: 'p2', status: 'open' }], loaded: true })
    const st = useTicketsStore.getState()

    expect(await st.reassign('x', 'p1', { role: 'executor', personId: 'p1' })).toBe(false)
    expect(await st.setStatus('x', 'done', { role: 'chief', personId: null })).toBe(true)
    expect(await st.reassign('x', 'p1', { role: 'chief', personId: null })).toBe(true)
  })

  it('canChangeTicket: карта ролей согласована', () => {
    const ticket = { assigneeId: 'p1' }
    expect(canChangeTicket({ role: 'executor', personId: 'p1' }, ticket)).toBe(true)
    expect(canChangeTicket({ role: 'executor', personId: 'p9' }, ticket)).toBe(false)
    expect(canChangeTicket({ role: 'customer', personId: null }, ticket)).toBe(false)
    expect(canChangeTicket({ role: 'director', personId: null }, ticket)).toBe(true)
  })
})

describe('createdBy на аварийках', () => {
  it('заявка хранит createdBy — заказчик трекает только свои', async () => {
    const st = useTicketsStore.getState()
    await st.createEmergency({ buildingId: 'b1', title: 'Потоп', createdBy: 'c_abc' }, null)
    await st.createEmergency({ buildingId: 'b1', title: 'Дым',   createdBy: 'c_xyz' }, null)
    const mine = useTicketsStore.getState().tickets.filter(t => t.createdBy === 'c_abc')
    expect(mine).toHaveLength(1)
    expect(mine[0].title).toBe('Потоп')
  })
})
