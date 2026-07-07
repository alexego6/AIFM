// Стор тикетов. IDB namespace: aifm_tickets.
// Семантика оперзаписей: id = контент-хэш(building|system|task|дата);
// регенерация НИКОГДА не трогает существующие id — создаются только недостающие.

import { create } from 'zustand'
import { makeIdb } from '../services/idbStore'
import { generateDayTickets, contentHash, toISODate } from '../services/dayScheduler'
import { planDay, reassignAfterRemoval } from '../services/ticketPlanner'
import { deriveNodes } from '../services/wearForecast'
import { shiftForDate } from './useStaffStore'
import { canChangeTicket, canReassign } from '../config/roleAccess'

const idb = makeIdb('aifm_tickets')

// SLA аварийных заявок: уведомление ≤5 мин, прибытие ≤1 час (Прил. 4/5 ТЗ).
// Если в применённых SLA-данных есть норматив в минутах — берём его.
export function emergencySla(slaData, createdAt = new Date()) {
  const notifMin = slaData?.constraints?.find(c => c.unit === 'мин')?.value ?? 5
  const arriveMin = 60
  return {
    notifyDeadline: new Date(createdAt.getTime() + notifMin * 60_000).toISOString(),
    slaDeadline:    new Date(createdAt.getTime() + arriveMin * 60_000).toISOString(),
    notifMin, arriveMin,
  }
}

async function persist(tickets) {
  await idb.set('tickets', tickets)
}

export const useTicketsStore = create((set, get) => ({
  tickets: [],
  loaded:  false,

  loadFromDB: async () => {
    if (get().loaded) return
    const tickets = await idb.get('tickets')
    set({ tickets: tickets ?? [], loaded: true })
  },

  /**
   * Генерация наряда на дату для ВСЕХ объектов + раскладка по исполнителям.
   * Существующие id — skip полностью (статус/исполнитель/всё сохраняется);
   * создаются только недостающие, раскладка — только для новых и открытых
   * автоназначенных этого дня.
   */
  generateForDate: async (systemsData, staffAll, date) => {
    const iso = toISODate(date)
    const cur = get().tickets
    const existingIds = new Set(cur.map(t => t.id))

    const fresh = generateDayTickets(systemsData, date).filter(t => !existingIds.has(t.id))

    // Раскладка по объектам: существующие тикеты дня + новые
    const dayAll = [...cur.filter(t => t.date === iso && t.type !== 'emergency'), ...fresh]
    const otherTickets = cur.filter(t => !(t.date === iso && t.type !== 'emergency'))

    const buildingIds = [...new Set(dayAll.map(t => t.buildingId))]
    const planned = []
    let unassignedTotal = 0
    for (const b of buildingIds) {
      const bTickets = dayAll.filter(t => t.buildingId === b)
      const bStaff   = staffAll.filter(p => p.buildingId === b)
      const { tickets: out, unassigned } = planDay(bTickets, bStaff, date)
      planned.push(...out)
      unassignedTotal += unassigned.length
    }

    const next = [...otherTickets, ...planned]
    set({ tickets: next })
    await persist(next)
    return { created: fresh.length, skipped: dayAll.length - fresh.length, unassigned: unassignedTotal }
  },

  // Guard в сторе, не только в UI: actor {role, personId} — техник меняет
  // статус ТОЛЬКО своих тикетов. Без actor (внутренние вызовы) — полный доступ.
  setStatus: async (ticketId, status, actor = null) => {
    const ticket = get().tickets.find(t => t.id === ticketId)
    if (!ticket) return false
    if (actor && !canChangeTicket(actor, ticket)) return false
    const next = get().tickets.map(t => t.id === ticketId
      ? { ...t, status, closedAt: status === 'done' ? new Date().toISOString() : null }
      : t)
    set({ tickets: next })
    await persist(next)
    return true
  },

  // Ручное переназначение — фиксируется флагом, регенерация его не тронет
  reassign: async (ticketId, personId, actor = null) => {
    if (actor && !canReassign(actor)) return false
    const next = get().tickets.map(t => t.id === ticketId
      ? { ...t, assigneeId: personId, manuallyAssigned: true }
      : t)
    set({ tickets: next })
    await persist(next)
    return true
  },

  // Аварийная заявка: ручное создание, SLA-дедлайн автоматически.
  // createdBy — тег сессии-автора (clientId:role): заказчик трекает только свои.
  // staffAll — реестр: аварийка сразу назначается суточнику текущей смены
  // (он на объекте 24 ч); нет суточника → нераспределённая, chief переназначит.
  createEmergency: async ({ buildingId, title, systemId = null, systemName = null, category = 'other', createdBy = null }, slaData, staffAll = []) => {
    const createdAt = new Date()
    const { notifyDeadline, slaDeadline, notifMin, arriveMin } = emergencySla(slaData, createdAt)
    const shift = shiftForDate(createdAt)
    const watchman = staffAll.find(p => p.buildingId === buildingId && p.kind === 'watchman' && p.shift === shift)
      ?? staffAll.find(p => p.buildingId === buildingId && p.kind === 'watchman' && !p.shift)
      ?? null
    const ticket = {
      id: contentHash(`emergency|${buildingId}|${title}|${createdAt.toISOString()}`),
      createdBy,
      buildingId,
      systemId,
      systemName: systemName ?? '—',
      category,
      taskId: null,
      type: 'emergency',
      title: title?.trim() || 'Аварийная заявка',
      periodicity: null,
      date: toISODate(createdAt),
      status: 'open',
      assigneeId: watchman?.id ?? null,
      manuallyAssigned: false,
      order: null,
      source: 'user',
      needsReview: false,
      slaDeadline,
      notifyDeadline,
      slaBasis: 'tz',
      slaNote: `уведомление ≤${notifMin} мин · прибытие ≤${arriveMin} мин`,
      createdAt: createdAt.toISOString(),
      closedAt: null,
    }
    const next = [...get().tickets, ticket]
    set({ tickets: next })
    await persist(next)
    return ticket
  },

  // Удаление сотрудника: его открытые тикеты перераспределяются по правилам,
  // закрытые/в-работе с ручным назначением — нетронуты (история)
  redistributeAfterRemoval: async (personId, staffAll, dates) => {
    let cur = get().tickets
    for (const iso of dates) {
      const [y, m, d] = iso.split('-').map(Number)
      const date = new Date(y, m - 1, d)
      const dayTickets   = cur.filter(t => t.date === iso)
      const otherTickets = cur.filter(t => t.date !== iso)
      const buildingIds  = [...new Set(dayTickets.map(t => t.buildingId))]
      const planned = []
      for (const b of buildingIds) {
        const bTickets = dayTickets.filter(t => t.buildingId === b)
        const bStaff   = staffAll.filter(p => p.buildingId === b)
        const { tickets: out } = reassignAfterRemoval(bTickets, personId, bStaff, date)
        planned.push(...out)
      }
      cur = [...otherTickets, ...planned]
    }
    set({ tickets: cur })
    await persist(cur)
  },

  /**
   * Первичная фиксация износа: по одному inspection-тикету на систему с
   * трекаемыми узлами, назначение — инженеру объекта (гл. инженер), размазка
   * по ближайшим рабочим дням детерминированно (хэш системы → день).
   * id = hash(inspection|building|system) — повторный запуск не дублирует.
   */
  generateInitialInspections: async (systemsData, staffAll, from = new Date()) => {
    const nodes = deriveNodes(systemsData)
    const systemsWithNodes = new Map() // `${buildingId}|${systemId}` → {buildingId, systemId, systemName, category, count}
    for (const n of nodes) {
      const key = `${n.buildingId}|${n.systemId}`
      if (!systemsWithNodes.has(key)) {
        systemsWithNodes.set(key, { buildingId: n.buildingId, systemId: n.systemId,
          systemName: n.systemName, category: n.category, count: 0 })
      }
      systemsWithNodes.get(key).count++
    }

    // Ближайшие 5 рабочих дней — компактная размазка, тикеты легко найти
    const upcoming = []
    for (let i = 1; i <= 10 && upcoming.length < 5; i++) {
      const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)
      const wd = d.getDay()
      if (wd !== 0 && wd !== 6) upcoming.push(d)
    }

    const existingIds = new Set(get().tickets.map(t => t.id))
    // Детерминированный порядок: сортировка по id → последовательная раздача дней
    const pending = [...systemsWithNodes.values()]
      .map(sys => ({ sys, id: contentHash(`inspection|${sys.buildingId}|${sys.systemId}`) }))
      .sort((a, b) => a.id.localeCompare(b.id))

    const created = []
    let dayIdx = 0
    for (const { sys, id } of pending) {
      if (existingIds.has(id)) continue
      const engineer = staffAll.find(p => p.buildingId === sys.buildingId && p.kind === 'engineer')
      const day = upcoming[dayIdx++ % upcoming.length] ?? from
      created.push({
        id,
        buildingId:  sys.buildingId,
        systemId:    sys.systemId,
        systemName:  sys.systemName,
        category:    sys.category,
        taskId:      null,
        type:        'inspection',
        title:       `Первичная фиксация износа — ${sys.systemName} (${sys.count} узл.)`,
        periodicity: null,
        date:        toISODate(day),
        status:      'open',
        assigneeId:  engineer?.id ?? null,
        manuallyAssigned: true,   // раскладка дня не перекидывает inspection
        order:       null,
        source:      'schedule',
        needsReview: false,
        slaDeadline: null,
        slaBasis:    null,
        createdAt:   new Date().toISOString(),
        closedAt:    null,
      })
    }
    if (created.length > 0) {
      const next = [...get().tickets, ...created]
      set({ tickets: next })
      await persist(next)
    }
    return {
      created: created.length,
      skipped: systemsWithNodes.size - created.length,
      dates: [...new Set(created.map(t => t.date))].sort(),
    }
  },

  ticketsForDate: (iso, buildingId) =>
    get().tickets.filter(t => t.date === iso && t.buildingId === buildingId),

  reset: async () => {
    set({ tickets: [], loaded: true })
    await idb.clear()
  },
}))
