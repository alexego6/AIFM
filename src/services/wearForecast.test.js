import { describe, it, expect } from 'vitest'
import { deriveNodes, linearTrend, nextRoundDate, purchaseRecommendations } from './wearForecast'
import { taskOccursOn } from './dayScheduler'

const mkMeas = (date, wearPct) => ({ id: `m${date}`, nodeId: 'n1', date, wearPct })

describe('deriveNodes', () => {
  const systemsData = [{
    buildingId: 'b1',
    systems: [{
      id: 's1', name: 'ОВиК', category: 'hvac',
      equipment: [
        { id: 'eq1', name: 'Приточная установка', class: 'air_handling_unit', brand: 'Lessar', qty: 1 },
        { id: 'eq2', name: 'Чиллер', class: 'chiller', qty: 2 },
        { id: 'eq3', name: 'Светильник LED', class: 'luminaire', qty: 200 },   // не трекаем
        { id: 'eq4', name: 'Неизвестное', class: 'weird_class', qty: 1 },      // без алиаса
      ],
    }],
  }]

  it('берёт только трекаемые классы, парк qty>1 — один узел', () => {
    const nodes = deriveNodes(systemsData)
    expect(nodes.map(n => n.nodeId)).toEqual(['eq1', 'eq2'])
    expect(nodes[0].class).toBe('ahu')          // алиас применён
    expect(nodes[1].qty).toBe(2)                // парк — один узел
  })

  it('пустая платформа → пусто, не падает', () => {
    expect(deriveNodes([])).toEqual([])
    expect(deriveNodes(null)).toEqual([])
  })
})

describe('linearTrend', () => {
  it('<5 замеров → accumulating, прогноза нет', () => {
    const t = linearTrend([mkMeas('2026-01-01', 10), mkMeas('2026-02-01', 12)])
    expect(t.status).toBe('accumulating')
    expect(t.count).toBe(2)
    expect(t.etaCriticalMonths).toBeNull()
    expect(t.lastWear).toBe(12)
  })

  it('5 точек с ростом 2%/мес → наклон ~2, корректный ETA', () => {
    const meas = [
      mkMeas('2026-01-01', 40), mkMeas('2026-02-01', 42), mkMeas('2026-03-01', 44),
      mkMeas('2026-04-01', 46), mkMeas('2026-05-01', 48),
    ]
    const t = linearTrend(meas)
    expect(t.slopePctPerMonth).toBeCloseTo(2, 0)
    // от 48% до 80% при 2%/мес ≈ 16 мес → ok
    expect(t.etaCriticalMonths).toBeGreaterThan(14)
    expect(t.etaCriticalMonths).toBeLessThan(18)
    expect(t.status).toBe('ok')
  })

  it('быстрый рост → watch / urgent по горизонту ETA', () => {
    const watch = linearTrend([
      mkMeas('2026-01-01', 40), mkMeas('2026-02-01', 45), mkMeas('2026-03-01', 50),
      mkMeas('2026-04-01', 55), mkMeas('2026-05-01', 60),
    ]) // 5%/мес, до 80 от 60 → 4 мес → watch
    expect(watch.status).toBe('watch')

    const urgent = linearTrend([
      mkMeas('2026-01-01', 50), mkMeas('2026-02-01', 57), mkMeas('2026-03-01', 64),
      mkMeas('2026-04-01', 71), mkMeas('2026-05-01', 78),
    ]) // 7%/мес, до 80 от 78 → <1 мес → urgent
    expect(urgent.status).toBe('urgent')
  })

  it('wear ≥ critical → urgent независимо от тренда', () => {
    const t = linearTrend([
      mkMeas('2026-01-01', 85), mkMeas('2026-02-01', 85), mkMeas('2026-03-01', 85),
      mkMeas('2026-04-01', 85), mkMeas('2026-05-01', 85),
    ])
    expect(t.status).toBe('urgent')
    expect(t.etaCriticalMonths).toBe(0)
  })

  it('тренд ≤ 0 → stable, ETA не выдумывается', () => {
    const t = linearTrend([
      mkMeas('2026-01-01', 50), mkMeas('2026-02-01', 49), mkMeas('2026-03-01', 50),
      mkMeas('2026-04-01', 48), mkMeas('2026-05-01', 49),
    ])
    expect(t.status).toBe('stable')
    expect(t.etaCriticalMonths).toBeNull()
  })
})

describe('nextRoundDate', () => {
  const system = {
    id: 's1',
    maintenanceTasks: [
      { id: 'ek1', mode: 'EK', periodicity: 'еженедельно', months: [] },
      { id: 'to1', mode: 'TO', periodicity: 'ежедневно',  months: [] },  // ТО не считается
    ],
  }

  it('совпадает с dayScheduler: найденный день действительно день ЭК-задачи', () => {
    const from = new Date(2026, 6, 7)
    const iso = nextRoundDate(system, 'b1', from)
    expect(iso).not.toBeNull()
    const [y, m, d] = iso.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    expect(date > from).toBe(true)
    expect(taskOccursOn(system.maintenanceTasks[0], `b1|s1|ek1`, date)).toBe(true)
  })

  it('система без ЭК-задач → null', () => {
    expect(nextRoundDate({ id: 's2', maintenanceTasks: [{ id: 't', mode: 'TO', periodicity: 'ежедневно', months: [] }] }, 'b1')).toBeNull()
  })
})

describe('purchaseRecommendations', () => {
  const node = (cls = 'chiller') => ({
    nodeId: 'n1', name: 'Чиллер York', buildingId: 'b1', class: cls, qty: 1,
  })

  it('рекомендация ровно при watch/urgent, номенклатура = классу', () => {
    const trends = [
      { node: node(), trend: { status: 'ok' } },
      { node: node(), trend: { status: 'stable' } },
      { node: node(), trend: { status: 'accumulating' } },
      { node: { ...node(), nodeId: 'n2' }, trend: { status: 'watch', etaCriticalMonths: 6, lastDate: '2026-07-01' } },
      { node: { ...node(), nodeId: 'n3' }, trend: { status: 'urgent', etaCriticalMonths: 1, lastDate: '2026-07-01' } },
    ]
    const recs = purchaseRecommendations(trends)
    expect(recs.map(r => r.nodeId)).toEqual(['n2', 'n3'])
    for (const r of recs) {
      expect(r.provenance).toBe('wear_forecast')
      expect(r.items.length).toBeGreaterThan(0)
      expect(r.etaDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('класс без RESOURCE_SETS не даёт рекомендацию (не выдумываем)', () => {
    const recs = purchaseRecommendations([
      { node: node('cooling_beam'), trend: { status: 'watch', etaCriticalMonths: 6, lastDate: '2026-07-01' } },
    ])
    // cooling_beam есть в RESOURCE_SETS — проверяем противоположное на фейковом классе
    const recs2 = purchaseRecommendations([
      { node: node('nonexistent_class'), trend: { status: 'watch', etaCriticalMonths: 6, lastDate: '2026-07-01' } },
    ])
    expect(recs2).toEqual([])
    expect(recs.length).toBeLessThanOrEqual(1)
  })
})
