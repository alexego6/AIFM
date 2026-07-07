import { describe, it, expect } from 'vitest'
import {
  taskOccursOn, expectedCountForMonth, generateDayTickets,
  verifyMonthCompleteness, classifyRule, workdaysOfMonth, isWeekend, toISODate,
} from './dayScheduler'

const seed = (i = 1) => `b1|sys${i}|task${i}`

const mkTask = (over = {}) => ({
  id: over.id ?? 't1',
  mode: 'TO',
  operation: 'Осмотр оборудования',
  periodicity: 'ежедневно',
  months: [],
  needsReview: false,
  ...over,
})

const JULY = 7, YEAR = 2026

function datesOfMonth(year, month) {
  const last = new Date(year, month, 0).getDate()
  return Array.from({ length: last }, (_, i) => new Date(year, month - 1, i + 1))
}

describe('classifyRule', () => {
  it('maps normalized periodicities', () => {
    expect(classifyRule(mkTask({ periodicity: 'ежедневно' }))).toBe('daily')
    expect(classifyRule(mkTask({ periodicity: 'ежесменно' }))).toBe('daily')
    expect(classifyRule(mkTask({ periodicity: '1р/2дня' }))).toBe('every2days')
    expect(classifyRule(mkTask({ periodicity: 'еженедельно' }))).toBe('weekly')
    expect(classifyRule(mkTask({ periodicity: '1р/2нед' }))).toBe('biweekly')
    expect(classifyRule(mkTask({ periodicity: '2 раза в неделю' }))).toBe('twiceWeek')
    expect(classifyRule(mkTask({ periodicity: 'ежемесячно', months: [7] }))).toBe('monthly')
    expect(classifyRule(mkTask({ periodicity: '1р/год', months: [4] }))).toBe('monthly')
  })

  it('unrecognized periodicity: monthly if months present, skip otherwise', () => {
    expect(classifyRule(mkTask({ periodicity: 'не указано', months: [3, 9] }))).toBe('monthly')
    expect(classifyRule(mkTask({ periodicity: 'не указано', months: [] }))).toBe('skip')
    expect(classifyRule(mkTask({ periodicity: '1р/5лет', months: [] }))).toBe('skip')
  })
})

describe('taskOccursOn — базовые правила', () => {
  it('daily occurs every day incl. weekends', () => {
    const t = mkTask({ periodicity: 'ежедневно' })
    for (const d of datesOfMonth(YEAR, JULY)) {
      expect(taskOccursOn(t, seed(), d)).toBe(true)
    }
  })

  it('every2days: every other day incl. weekends, deterministic', () => {
    const t = mkTask({ periodicity: '1р/2дня' })
    const days = datesOfMonth(YEAR, JULY).filter(d => taskOccursOn(t, seed(), d))
    // 31 день → 15 или 16 попаданий, строго через день
    expect(days.length).toBeGreaterThanOrEqual(15)
    expect(days.length).toBeLessThanOrEqual(16)
    for (let i = 1; i < days.length; i++) {
      expect(days[i].getDate() - days[i - 1].getDate()).toBe(2)
    }
  })

  it('weekly: exactly one fixed weekday, never weekend', () => {
    const t = mkTask({ periodicity: 'еженедельно' })
    const days = datesOfMonth(YEAR, JULY).filter(d => taskOccursOn(t, seed(), d))
    expect(days.length).toBeGreaterThanOrEqual(4)
    const weekdays = new Set(days.map(d => d.getDay()))
    expect(weekdays.size).toBe(1)
    for (const d of days) expect(isWeekend(d)).toBe(false)
  })

  it('twiceWeek: two weekdays with gap ≥2, never weekend', () => {
    const t = mkTask({ periodicity: '2 раза в неделю' })
    const days = datesOfMonth(YEAR, JULY).filter(d => taskOccursOn(t, seed(), d))
    const weekdays = [...new Set(days.map(d => (d.getDay() === 0 ? 7 : d.getDay())))].sort()
    expect(weekdays.length).toBe(2)
    expect(weekdays[1] - weekdays[0]).toBeGreaterThanOrEqual(2)
    for (const d of days) expect(isWeekend(d)).toBe(false)
  })

  it('monthly: exactly one working day in crossed month, none in others', () => {
    const t = mkTask({ periodicity: 'ежемесячно', months: [7] })
    const july = datesOfMonth(YEAR, JULY).filter(d => taskOccursOn(t, seed(), d))
    const june = datesOfMonth(YEAR, 6).filter(d => taskOccursOn(t, seed(), d))
    expect(july.length).toBe(1)
    expect(isWeekend(july[0])).toBe(false)
    expect(june.length).toBe(0)
  })

  it('seasonal daily respects months filter', () => {
    const t = mkTask({ periodicity: 'ежедневно', months: [5, 6, 7, 8, 9] })
    expect(taskOccursOn(t, seed(), new Date(2026, 6, 15))).toBe(true)  // июль
    expect(taskOccursOn(t, seed(), new Date(2026, 0, 15))).toBe(false) // январь
  })

  it('deterministic: same seed → same days across repeated calls', () => {
    const t = mkTask({ periodicity: 'еженедельно' })
    const run = () => datesOfMonth(YEAR, JULY).filter(d => taskOccursOn(t, seed(), d)).map(toISODate)
    expect(run()).toEqual(run())
  })

  it('different seeds spread monthly tasks across different days', () => {
    const t = mkTask({ periodicity: 'ежемесячно', months: [7] })
    const days = new Set()
    for (let i = 0; i < 12; i++) {
      const hit = datesOfMonth(YEAR, JULY).find(d => taskOccursOn(t, seed(i), d))
      days.add(hit.getDate())
    }
    expect(days.size).toBeGreaterThan(3) // равномерный разброс, не один день
  })
})

// ── Инвариант 2: выходной — только ежедневные и через-день ──────────────────
describe('инвариант 2 — выходные', () => {
  it('на субботу/воскресенье попадают ТОЛЬКО daily и every2days', () => {
    const tasks = [
      mkTask({ id: 'd',  periodicity: 'ежедневно' }),
      mkTask({ id: 'e2', periodicity: '1р/2дня' }),
      mkTask({ id: 'w',  periodicity: 'еженедельно' }),
      mkTask({ id: 'tw', periodicity: '2 раза в неделю' }),
      mkTask({ id: 'bw', periodicity: '1р/2нед' }),
      mkTask({ id: 'm',  periodicity: 'ежемесячно', months: [7] }),
      mkTask({ id: 'q',  periodicity: 'ежеквартально', months: [1, 4, 7, 10] }),
    ]
    const systemsData = [{ buildingId: 'b1', systems: [{ id: 's1', name: 'Тест', category: 'hvac', maintenanceTasks: tasks }] }]

    for (const d of datesOfMonth(YEAR, JULY).filter(isWeekend)) {
      const tickets = generateDayTickets(systemsData, d)
      for (const t of tickets) {
        expect(['ежедневно', '1р/2дня']).toContain(t.periodicity)
      }
    }
  })
})

// ── Инвариант 1: полнота месяца ──────────────────────────────────────────────
describe('инвариант 1 — сумма по дням == операции месяца', () => {
  it('mixed periodicities: generated == expected, no mismatches', () => {
    const tasks = [
      mkTask({ id: 't1', periodicity: 'ежедневно' }),
      mkTask({ id: 't2', periodicity: '1р/2дня' }),
      mkTask({ id: 't3', periodicity: 'еженедельно' }),
      mkTask({ id: 't4', periodicity: '2 раза в неделю' }),
      mkTask({ id: 't5', periodicity: '1р/2нед' }),
      mkTask({ id: 't6', periodicity: 'ежемесячно', months: [1,2,3,4,5,6,7,8,9,10,11,12] }),
      mkTask({ id: 't7', periodicity: 'ежеквартально', months: [1, 4, 7, 10] }),
      mkTask({ id: 't8', periodicity: '1р/год', months: [7] }),
      mkTask({ id: 't9', periodicity: 'не указано', months: [7] }),
      mkTask({ id: 't10', periodicity: '1р/5лет', months: [] }), // skip — не генерится
    ]
    const systemsData = [
      { buildingId: 'b1', systems: [{ id: 's1', name: 'ОВиК', category: 'hvac', maintenanceTasks: tasks.slice(0, 5) }] },
      { buildingId: 'b2', systems: [{ id: 's2', name: 'ЭОМ', category: 'electrical', maintenanceTasks: tasks.slice(5) }] },
    ]

    const res = verifyMonthCompleteness(systemsData, YEAR, JULY)
    expect(res.mismatches).toEqual([])
    expect(res.ok).toBe(true)
    expect(res.generated).toBe(res.expected)
    expect(res.expected).toBeGreaterThan(31) // ежедневная одна даёт 31
  })

  it('skip-задача даёт 0 экземпляров', () => {
    const t = mkTask({ periodicity: '1р/5лет', months: [] })
    expect(expectedCountForMonth(t, seed(), YEAR, JULY)).toBe(0)
  })
})

describe('generateDayTickets — форма тикета', () => {
  it('id детерминирован и содержит все поля', () => {
    const systemsData = [{
      buildingId: 'b1',
      systems: [{ id: 's1', name: 'Вентиляция', category: 'hvac',
        maintenanceTasks: [mkTask({ id: 't1', mode: 'EK', periodicity: 'ежедневно' })] }],
    }]
    const d = new Date(2026, 6, 7)
    const [a] = generateDayTickets(systemsData, d)
    const [b] = generateDayTickets(systemsData, d)
    expect(a.id).toBe(b.id)
    expect(a).toMatchObject({
      buildingId: 'b1', systemId: 's1', type: 'EK', status: 'open',
      date: '2026-07-07', source: 'schedule', assigneeId: null,
    })
    expect(a.slaDeadline).toBe('2026-08-07') // +1 месяц, Прил. 5
  })

  it('workdaysOfMonth не содержит выходных', () => {
    for (const d of workdaysOfMonth(2026, 7)) {
      expect(isWeekend(new Date(2026, 6, d))).toBe(false)
    }
  })
})
