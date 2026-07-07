// Реестр исполнителей. IDB namespace: aifm_staff.
// Сид из staffingPlan применённого ТЗ, дальше состав редактируется вручную.
// id персоны стабилен: переименование не меняет привязок тикетов.

import { create } from 'zustand'
import { makeIdb } from '../services/idbStore'
import { dayIndex } from '../services/dayScheduler'

const idb = makeIdb('aifm_staff')

export const SHIFTS = ['А', 'Б', 'В', 'Г']

// Смена суточника на дату: цикл сутки/трое, якорь 01.01.2026 (см. dayScheduler.ANCHOR)
export function shiftForDate(date) {
  const i = ((dayIndex(date) % 4) + 4) % 4
  return SHIFTS[i]
}

// Специализация из названия должности/имени — для маршрутизации спец-задач.
// Регэкспы по должности, не по категориям систем (новых классификаторов не добавляем).
const SPECIALTY_PATTERNS = [
  [/электр/i,            'electrical'],
  [/сантех|водопровод/i, 'plumbing'],
  [/слаботоч|скс|связ/i, 'lowcurrent'],
  [/лифт/i,              'elevator'],
  [/вентиляц|овик|хвс|климат/i, 'hvac'],
]

export function specialtyOf(person) {
  const s = `${person.role ?? ''} ${person.name ?? ''}`
  for (const [re, cat] of SPECIALTY_PATTERNS) {
    if (re.test(s)) return cat
  }
  return null
}

// ── Сид из staffingPlan ───────────────────────────────────────────────────────
// staffingPlan: [{buildingId, roles: [{id: engineer|technician|watchman, stavka, ...}], numWatchPos}]
// Суточник: numWatchPos позиций × 4 смены = 4 персоны на позицию (сутки/трое).
// Fallback для планов без roles[] (старые applied-данные / фикстуры до 07.07):
// синтезируем роли из числовых полей numEngineers/numTechnicians/watchStavki.
function rolesOf(plan) {
  if (plan.roles?.length) return plan.roles
  const roles = []
  if (plan.numEngineers > 0)   roles.push({ id: 'engineer',   role: 'Инженер по эксплуатации', stavka: plan.numEngineers })
  if (plan.numTechnicians > 0) roles.push({ id: 'technician', role: 'Техник-универсал',        stavka: plan.numTechnicians })
  if (plan.watchStavki > 0)    roles.push({ id: 'watchman',   role: 'Дежурный (суточник)',     stavka: plan.watchStavki })
  return roles
}

export function seedFromStaffingPlan(staffingPlan) {
  const staff = []
  for (const plan of staffingPlan ?? []) {
    const b = plan.buildingId
    if (!b) continue
    for (const role of rolesOf(plan)) {
      if (role.id === 'watchman') {
        const positions = plan.numWatchPos ?? Math.max(1, Math.round((role.stavka ?? 4) / 4))
        for (let p = 1; p <= positions; p++) {
          for (const shift of SHIFTS) {
            staff.push({
              id:    `${b}:watchman:${p}:${shift}`,
              buildingId: b,
              name:  positions > 1 ? `Дежурный ${p} (смена ${shift})` : `Дежурный (смена ${shift})`,
              role:  'Дежурный (суточник)',
              kind:  'watchman',
              shift,
              seeded: true,
            })
          }
        }
      } else if (role.id === 'engineer' || role.id === 'technician') {
        const n = Math.max(1, Math.round(role.stavka ?? 1))
        for (let i = 1; i <= n; i++) {
          staff.push({
            id:    `${b}:${role.id}:${i}`,
            buildingId: b,
            name:  n > 1 ? `${role.role} ${i}` : role.role,
            role:  role.role,
            kind:  role.id,
            shift: null,
            seeded: true,
          })
        }
      }
      // Диспетчерская/аварийка — за скобками объектов (общие), в реестр не сидим
    }
  }
  return staff
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const useStaffStore = create((set, get) => ({
  staff:  [],     // все персоны всех объектов
  seeded: false,
  loaded: false,

  loadFromDB: async () => {
    if (get().loaded) return
    const [staff, seeded] = await Promise.all([idb.get('staff'), idb.get('seeded')])
    set({ staff: staff ?? [], seeded: !!seeded, loaded: true })
  },

  // Автозаполнение из ТЗ — только если реестр ещё не сидирован (ручные правки не затираем)
  seedIfEmpty: async (staffingPlan) => {
    await get().loadFromDB()
    if (get().seeded || get().staff.length > 0) return
    const staff = seedFromStaffingPlan(staffingPlan)
    if (staff.length === 0) return
    set({ staff, seeded: true })
    await Promise.all([idb.set('staff', staff), idb.set('seeded', true)])
  },

  addPerson: async (buildingId, { name, role }) => {
    const person = {
      id:   `${buildingId}:custom:${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
      buildingId,
      name: name?.trim() || 'Новый сотрудник',
      role: role?.trim() || 'Техник',
      kind: /инженер/i.test(role ?? '') ? 'engineer'
          : /дежурн|суточ/i.test(role ?? '') ? 'watchman'
          : 'technician',
      shift: null,
      seeded: false,
    }
    const staff = [...get().staff, person]
    set({ staff })
    await idb.set('staff', staff)
    return person
  },

  // Переименование НЕ меняет id → привязки тикетов сохраняются
  renamePerson: async (personId, { name, role }) => {
    const staff = get().staff.map(p => {
      if (p.id !== personId) return p
      const next = { ...p }
      if (name != null) next.name = name.trim() || p.name
      if (role != null) {
        next.role = role.trim() || p.role
        next.kind = /инженер/i.test(next.role) ? 'engineer'
                  : /дежурн|суточ/i.test(next.role) ? 'watchman'
                  : 'technician'
      }
      return next
    })
    set({ staff })
    await idb.set('staff', staff)
  },

  // Возвращает удалённую персону — вызывающий (Тикеты) перераспределяет её открытые тикеты
  removePerson: async (personId) => {
    const person = get().staff.find(p => p.id === personId) ?? null
    const staff = get().staff.filter(p => p.id !== personId)
    set({ staff })
    await idb.set('staff', staff)
    return person
  },

  staffOfBuilding: (buildingId) => get().staff.filter(p => p.buildingId === buildingId),

  reset: async () => {
    set({ staff: [], seeded: false, loaded: true })
    await idb.clear()
  },
}))
