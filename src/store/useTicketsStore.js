// Стор тикетов. IDB namespace: aifm_tickets.
// Семантика оперзаписей: id = контент-хэш(building|system|task|дата);
// регенерация НИКОГДА не трогает существующие id — создаются только недостающие.

import { create } from 'zustand'
import { makeIdb } from '../services/idbStore'
import { generateDayTickets, contentHash, toISODate } from '../services/dayScheduler'
import { planDay, reassignAfterRemoval } from '../services/ticketPlanner'

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

  setStatus: async (ticketId, status) => {
    const next = get().tickets.map(t => t.id === ticketId
      ? { ...t, status, closedAt: status === 'done' ? new Date().toISOString() : null }
      : t)
    set({ tickets: next })
    await persist(next)
  },

  // Ручное переназначение — фиксируется флагом, регенерация его не тронет
  reassign: async (ticketId, personId) => {
    const next = get().tickets.map(t => t.id === ticketId
      ? { ...t, assigneeId: personId, manuallyAssigned: true }
      : t)
    set({ tickets: next })
    await persist(next)
  },

  // Аварийная заявка: ручное создание, SLA-дедлайн автоматически
  createEmergency: async ({ buildingId, title, systemId = null, systemName = null, category = 'other' }, slaData) => {
    const createdAt = new Date()
    const { notifyDeadline, slaDeadline, notifMin, arriveMin } = emergencySla(slaData, createdAt)
    const ticket = {
      id: contentHash(`emergency|${buildingId}|${title}|${createdAt.toISOString()}`),
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
      assigneeId: null,
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

  ticketsForDate: (iso, buildingId) =>
    get().tickets.filter(t => t.date === iso && t.buildingId === buildingId),

  reset: async () => {
    set({ tickets: [], loaded: true })
    await idb.clear()
  },
}))
