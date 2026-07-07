// Инвариант 4: регенерация не трогает существующие тикеты (статус,
// исполнитель — всё сохраняется), создаются только недостающие, дублей нет.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// IDB нет в jsdom-окружении тестов — мокаем модуль обёртки
vi.mock('../services/idbStore', () => ({
  makeIdb: () => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  }),
}))

const { useTicketsStore, emergencySla } = await import('./useTicketsStore')
const { seedFromStaffingPlan } = await import('../store/useStaffStore')

const MONDAY = new Date(2026, 6, 6)

const SYSTEMS_DATA = [{
  buildingId: 'b1',
  systems: [{
    id: 's1', name: 'Вентиляция', category: 'hvac',
    maintenanceTasks: [
      { id: 't1', mode: 'EK', operation: 'Обход венткамер',   periodicity: 'ежедневно',  months: [], needsReview: false },
      { id: 't2', mode: 'TO', operation: 'Проверка фильтров', periodicity: 'ежедневно',  months: [], needsReview: false },
      { id: 't3', mode: 'TO', operation: 'ТО приточных установок', periodicity: 'ежемесячно', months: [1,2,3,4,5,6,7,8,9,10,11,12], needsReview: false },
    ],
  }],
}]

const STAFF = seedFromStaffingPlan([{
  buildingId: 'b1',
  numWatchPos: 1,
  roles: [
    { id: 'engineer',   role: 'Инженер по эксплуатации', stavka: 1 },
    { id: 'technician', role: 'Техник-универсал',        stavka: 2 },
    { id: 'watchman',   role: 'Дежурный (суточник)',     stavka: 4 },
  ],
}])

beforeEach(() => {
  useTicketsStore.setState({ tickets: [], loaded: true })
})

describe('generateForDate', () => {
  it('создаёт тикеты дня и раскладывает по исполнителям', async () => {
    const res = await useTicketsStore.getState().generateForDate(SYSTEMS_DATA, STAFF, MONDAY)
    expect(res.created).toBeGreaterThanOrEqual(2) // ежедневные точно есть
    const tickets = useTicketsStore.getState().tickets
    expect(tickets.every(t => t.assigneeId)).toBe(true)
    expect(res.unassigned).toBe(0)
  })

  it('инвариант 4: закрытый + переназначенный переживают регенерацию, дублей нет', async () => {
    const st = useTicketsStore.getState()
    await st.generateForDate(SYSTEMS_DATA, STAFF, MONDAY)
    const before = useTicketsStore.getState().tickets
    const closedId = before[0].id
    const reassignedId = before[1].id

    await st.setStatus(closedId, 'done')
    await st.reassign(reassignedId, 'custom:person:x')

    const res2 = await st.generateForDate(SYSTEMS_DATA, STAFF, MONDAY)
    expect(res2.created).toBe(0) // все id совпали — только skip

    const after = useTicketsStore.getState().tickets
    expect(after).toHaveLength(before.length) // дублей нет

    const closed = after.find(t => t.id === closedId)
    expect(closed.status).toBe('done')

    const reassigned = after.find(t => t.id === reassignedId)
    expect(reassigned.assigneeId).toBe('custom:person:x')
    expect(reassigned.manuallyAssigned).toBe(true)
  })

  it('id стабильны между генерациями', async () => {
    const st = useTicketsStore.getState()
    await st.generateForDate(SYSTEMS_DATA, STAFF, MONDAY)
    const ids1 = useTicketsStore.getState().tickets.map(t => t.id).sort()
    useTicketsStore.setState({ tickets: [] })
    await st.generateForDate(SYSTEMS_DATA, STAFF, MONDAY)
    const ids2 = useTicketsStore.getState().tickets.map(t => t.id).sort()
    expect(ids1).toEqual(ids2)
  })
})

describe('createEmergency', () => {
  it('SLA-дедлайны проставляются автоматически', async () => {
    const slaData = { detected: true, constraints: [{ name: 'Уведомление о ЧП', value: 5, unit: 'мин' }] }
    const t = await useTicketsStore.getState().createEmergency(
      { buildingId: 'b1', title: 'Прорыв стояка ХВС' }, slaData)
    expect(t.type).toBe('emergency')
    expect(t.slaNote).toContain('≤5 мин')
    const notifMs = new Date(t.notifyDeadline) - new Date(t.createdAt)
    const slaMs   = new Date(t.slaDeadline) - new Date(t.createdAt)
    expect(notifMs).toBe(5 * 60_000)
    expect(slaMs).toBe(60 * 60_000)
  })

  it('emergencySla берёт минуты из slaData, дефолт 5', () => {
    expect(emergencySla({ constraints: [{ unit: 'мин', value: 10 }] }).notifMin).toBe(10)
    expect(emergencySla(null).notifMin).toBe(5)
  })
})

describe('redistributeAfterRemoval — инвариант 5 на сторе', () => {
  it('открытые тикеты удалённого уходят другим, закрытые нетронуты', async () => {
    const st = useTicketsStore.getState()
    await st.generateForDate(SYSTEMS_DATA, STAFF, MONDAY)

    const tickets = useTicketsStore.getState().tickets
    const victim = STAFF.find(p => p.id === tickets.find(t => t.type === 'TO')?.assigneeId)
      ?? STAFF.find(p => p.kind === 'technician')
    const victimOpen = tickets.filter(t => t.assigneeId === victim.id && t.status === 'open')
    expect(victimOpen.length).toBeGreaterThan(0)

    // Один из его тикетов закрываем — он должен сохранить исполнителя
    await st.setStatus(victimOpen[0].id, 'done')

    const remaining = STAFF.filter(p => p.id !== victim.id)
    await st.redistributeAfterRemoval(victim.id, remaining, ['2026-07-06'])

    const after = useTicketsStore.getState().tickets
    const closed = after.find(t => t.id === victimOpen[0].id)
    expect(closed.assigneeId).toBe(victim.id) // история выполнения

    const stillAssigned = after.filter(t => t.assigneeId === victim.id && t.status === 'open')
    expect(stillAssigned).toHaveLength(0)
    // Никто не потерян: перераспределённые получили нового исполнителя
    const reassigned = after.filter(t => victimOpen.slice(1).some(v => v.id === t.id))
    for (const t of reassigned) expect(t.assigneeId).not.toBeNull()
  })
})
