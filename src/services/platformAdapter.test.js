import { describe, it, expect } from 'vitest'
import {
  upsertBuildings,
  upsertSystemsData,
  validateTZForApply,
  mapBuildings,
  mapSystemsData,
} from './platformAdapter'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeBuilding = (id, overrides = {}) => ({
  id,
  name:         `Building ${id}`,
  editedByUser: false,
  needsReview:  false,
  ...overrides,
})

const makeTask = (overrides = {}) => ({
  id:          'task-1',
  operation:   'Осмотр',
  mode:        'TO',
  months:      [1, 4, 7, 10],
  editedByUser: false,
  needsReview:  false,
  ...overrides,
})

const makeEquip = (overrides = {}) => ({
  id:          'eq-1',
  name:        'Вентагрегат',
  class:       'fan',
  editedByUser: false,
  needsReview:  false,
  ...overrides,
})

const makeSystemsEntry = (buildingId, taskOverrides = {}, equipOverrides = {}) => ({
  buildingId,
  systems: [{
    id:               'sys-1',
    systemCode:       'ОВ',
    systemName:       'Вентиляция',
    maintenanceTasks: [makeTask(taskOverrides)],
    equipment:        [makeEquip(equipOverrides)],
  }],
})

// ── Test A: idempotency with editedByUser ─────────────────────────────────────

describe('upsertBuildings — идемпотентность с editedByUser', () => {
  it('заменяет здание без правок нормально (needsReview остаётся false)', () => {
    const existing = [makeBuilding('b1')]
    const incoming = [makeBuilding('b1', { name: 'Updated B1' })]
    const result   = upsertBuildings(existing, incoming)
    expect(result[0].name).toBe('Updated B1')
    expect(result[0].needsReview).toBe(false)
  })

  it('если editedByUser:true → заменяет данные и ставит needsReview:true', () => {
    const existing = [makeBuilding('b1', { editedByUser: true, name: 'Hand-edited' })]
    const incoming = [makeBuilding('b1', { name: 'From TZ re-apply' })]
    const result   = upsertBuildings(existing, incoming)
    // данные из incoming (не из existing)
    expect(result[0].name).toBe('From TZ re-apply')
    // но помечены как требующие ревью
    expect(result[0].needsReview).toBe(true)
  })

  it('здание БЕЗ правок остаётся без needsReview при re-apply', () => {
    const existing = [
      makeBuilding('b1', { editedByUser: true }),
      makeBuilding('b2', { editedByUser: false }),
    ]
    const incoming = [
      makeBuilding('b1', { name: 'B1 new' }),
      makeBuilding('b2', { name: 'B2 new' }),
    ]
    const result = upsertBuildings(existing, incoming)
    expect(result[0].needsReview).toBe(true)   // b1 — правки были
    expect(result[1].needsReview).toBe(false)  // b2 — правок не было
  })
})

describe('upsertSystemsData — идемпотентность с editedByUser', () => {
  it('без правок — задачи не получают needsReview', () => {
    const existing = [makeSystemsEntry('b1')]
    const incoming = [makeSystemsEntry('b1')]
    const result   = upsertSystemsData(existing, incoming)
    expect(result[0].systems[0].maintenanceTasks[0].needsReview).toBe(false)
    expect(result[0].systems[0].equipment[0].needsReview).toBe(false)
  })

  it('если задача editedByUser:true → все задачи/оборудование получают needsReview:true', () => {
    const existing = [makeSystemsEntry('b1', { editedByUser: true })]
    const incoming = [makeSystemsEntry('b1')]
    const result   = upsertSystemsData(existing, incoming)
    expect(result[0].systems[0].maintenanceTasks[0].needsReview).toBe(true)
    expect(result[0].systems[0].equipment[0].needsReview).toBe(true)
  })

  it('если оборудование editedByUser:true → все задачи/оборудование получают needsReview:true', () => {
    const existing = [makeSystemsEntry('b1', {}, { editedByUser: true })]
    const incoming = [makeSystemsEntry('b1')]
    const result   = upsertSystemsData(existing, incoming)
    expect(result[0].systems[0].maintenanceTasks[0].needsReview).toBe(true)
    expect(result[0].systems[0].equipment[0].needsReview).toBe(true)
  })

  it('здание без правок остаётся без needsReview', () => {
    const existing = [
      makeSystemsEntry('b1', { editedByUser: true }),
      makeSystemsEntry('b2'),
    ]
    const incoming = [
      makeSystemsEntry('b1'),
      makeSystemsEntry('b2'),
    ]
    const result = upsertSystemsData(existing, incoming)
    const b1 = result.find(r => r.buildingId === 'b1')
    const b2 = result.find(r => r.buildingId === 'b2')
    expect(b1.systems[0].maintenanceTasks[0].needsReview).toBe(true)
    expect(b2.systems[0].maintenanceTasks[0].needsReview).toBe(false)
  })
})

// ── Test B: validation completeness ───────────────────────────────────────────

describe('validateTZForApply — полнота данных', () => {
  it('ok:true при полных данных (buildings + systems + tasks)', () => {
    const result = validateTZForApply({
      buildings:    [{ id: 'b1', name: 'БЦ' }],
      systems:      [makeSystemsEntry('b1')],
      staffingPlan: [{ buildingId: 'b1' }],
      resourcesPlan:[{ buildingId: 'b1' }],
    })
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('ошибка: нет зданий', () => {
    const result = validateTZForApply({
      buildings: [],
      systems:   [makeSystemsEntry('b1')],
    })
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('здани'))).toBe(true)
  })

  it('ошибка: нет систем', () => {
    const result = validateTZForApply({
      buildings: [{ id: 'b1', name: 'БЦ' }],
      systems:   [],
    })
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('систем'))).toBe(true)
  })

  it('ошибка: системы есть, но ни одной задачи ТО/ЭК (Этап 3 не выполнен)', () => {
    const noTasksSystems = [{
      buildingId: 'b1',
      systems: [{ id: 'sys-1', systemCode: 'ОВ', maintenanceTasks: [], equipment: [] }],
    }]
    const result = validateTZForApply({
      buildings: [{ id: 'b1', name: 'БЦ' }],
      systems:   noTasksSystems,
    })
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('Этап 3'))).toBe(true)
  })

  it('предупреждение (не ошибка): нет плана штата', () => {
    const result = validateTZForApply({
      buildings:    [{ id: 'b1', name: 'БЦ' }],
      systems:      [makeSystemsEntry('b1')],
      staffingPlan: [],
    })
    expect(result.ok).toBe(true)
    expect(result.warnings.some(w => w.includes('штата'))).toBe(true)
  })

  it('предупреждение (не ошибка): нет ЗИП', () => {
    const result = validateTZForApply({
      buildings:     [{ id: 'b1', name: 'БЦ' }],
      systems:       [makeSystemsEntry('b1')],
      resourcesPlan: [],
    })
    expect(result.ok).toBe(true)
    expect(result.warnings.some(w => w.includes('ЗИП'))).toBe(true)
  })

  it('предупреждение (не ошибка): здание без систем', () => {
    const result = validateTZForApply({
      buildings:    [{ id: 'b1', name: 'БЦ' }, { id: 'b2', name: 'Корпус 2' }],
      systems:      [makeSystemsEntry('b1')],
      staffingPlan: [{ buildingId: 'b1' }],
      resourcesPlan:[{ buildingId: 'b1' }],
    })
    // b2 не имеет систем → warning, не error → ok:true
    expect(result.ok).toBe(true)
    expect(result.warnings.some(w => w.includes('Корпус 2'))).toBe(true)
  })
})

// ── Test C: mapSystemsData field mapping ──────────────────────────────────────

describe('mapSystemsData — корректное копирование полей TZ-систем', () => {
  const tzInput = [{
    buildingId: 'b1',
    systems: [{
      id:          'b1-hvac-1',
      name:        'Вентиляция и кондиционирование',
      category:    'hvac',
      needsReview: true,
      maintenanceTasks: [{
        opNum: '2.1', mode: 'TO', operation: 'Замена фильтра',
        periodicity: 'ежеквартально', months: [3, 6, 9, 12],
      }],
      equipment: [{
        name: 'Вентагрегат АО-1', class: 'fan', brand: 'Веза', qty: 2,
        provenance: 'Таблица 3', needsReview: false,
      }],
    }],
  }]

  it('system.name и system.systemName присутствуют и совпадают', () => {
    const [result] = mapSystemsData(tzInput)
    const sys = result.systems[0]
    expect(sys.name).toBe('Вентиляция и кондиционирование')
    expect(sys.systemName).toBe('Вентиляция и кондиционирование')
  })

  it('system.category сохраняется', () => {
    const [result] = mapSystemsData(tzInput)
    expect(result.systems[0].category).toBe('hvac')
  })

  it('system.needsReview сохраняется', () => {
    const [result] = mapSystemsData(tzInput)
    expect(result.systems[0].needsReview).toBe(true)
  })

  it('task.periodicity и task.months сохраняются', () => {
    const [result] = mapSystemsData(tzInput)
    const task = result.systems[0].maintenanceTasks[0]
    expect(task.periodicity).toBe('ежеквартально')
    expect(task.months).toEqual([3, 6, 9, 12])
    expect(task.mode).toBe('TO')
  })

  it('task.id — уникальный контент-хэш, не коллизия при одном buildingId', () => {
    const multiSys = [{
      buildingId: 'b1',
      systems: [
        { id: 'b1-hvac-1', name: 'Вентиляция', category: 'hvac', needsReview: false,
          maintenanceTasks: [{ opNum: '1', mode: 'TO', operation: 'Осмотр', periodicity: 'monthly', months: [1] }], equipment: [] },
        { id: 'b1-heating-1', name: 'Теплоснабжение', category: 'heating', needsReview: false,
          maintenanceTasks: [{ opNum: '1', mode: 'TO', operation: 'Осмотр', periodicity: 'monthly', months: [1] }], equipment: [] },
      ],
    }]
    const [result] = mapSystemsData(multiSys)
    const ids = result.systems.map(s => s.id)
    expect(new Set(ids).size).toBe(2) // no collision
  })

  it('equipment.provenance сохраняется', () => {
    const [result] = mapSystemsData(tzInput)
    const eq = result.systems[0].equipment[0]
    expect(eq.provenance).toBe('Таблица 3')
    expect(eq.name).toBe('Вентагрегат АО-1')
    expect(eq.qty).toBe(2)
  })
})

// ── Test D: seed fixture integrity ────────────────────────────────────────────

describe('mapSystemsData — интеграция с seed-фикстурой', () => {
  it('все 5 зданий имеют системы с непустыми категориями', async () => {
    const { seedFixture } = await import('./seedPlatform.fixture.js')
    const { systemsData } = seedFixture
    expect(systemsData).toHaveLength(5)
    for (const b of systemsData) {
      expect(b.systems.length).toBeGreaterThan(0)
      // хотя бы часть систем не "Прочее" (не все в other)
      const nonOther = b.systems.filter(s => s.category !== 'other')
      expect(nonOther.length).toBeGreaterThan(0)
      for (const s of b.systems) {
        expect(s.name).toBeTruthy()
        expect(s.systemName).toBeTruthy()
      }
    }
  })

  it('есть задачи TO и EK', async () => {
    const { seedFixture } = await import('./seedPlatform.fixture.js')
    const allTasks = seedFixture.systemsData.flatMap(b => b.systems.flatMap(s => s.maintenanceTasks ?? []))
    const modes = new Set(allTasks.map(t => t.mode))
    expect(modes.has('TO')).toBe(true)
    expect(modes.has('EK')).toBe(true)
    expect(allTasks.length).toBeGreaterThan(100)
  })
})
