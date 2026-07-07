// Раскладка тикетов дня по исполнителям. Детерминированная эвристика,
// БЕЗ лимитов ёмкости (задач в смене может быть сколько угодно — решение юзера).
// Pure functions: вход тикеты+реестр, выход — новые объекты тикетов.

import { isWeekend, hashInt } from './dayScheduler'
import { shiftForDate, specialtyOf } from '../store/useStaffStore'

// Спец-категории, уходящие профильному технику, если он есть в реестре объекта
const SPECIALIST_CATS = new Set(['electrical', 'plumbing', 'lowcurrent', 'elevator', 'hvac'])

// Порядок внутри исполнителя: сначала ЭК-обходы, потом ТО, группировка по системам
function orderKey(t) {
  return `${t.type === 'EK' ? 0 : 1}|${t.category}|${t.systemName}|${t.title}`
}

function sortForOrder(tickets) {
  return [...tickets].sort((a, b) => orderKey(a).localeCompare(orderKey(b), 'ru'))
}

/**
 * Раскладка тикетов ОДНОГО объекта на ОДНУ дату.
 * tickets — тикеты дня этого объекта (любые статусы; трогаем только те,
 *   что без ручного назначения и не закрыты);
 * staff — реестр персон этого объекта.
 * Возвращает { tickets, unassigned } — новые объекты с assigneeId и order.
 *
 * Правила:
 * - выходной → ВСЕ задачи дня суточнику смены (планировщик дней гарантирует,
 *   что туда попадают только ежедневные/через-день);
 * - ЭК → суточнику смены дня; ТО → дневным техникам; спец-задачи → профильному
 *   технику, если есть; инженер подхватывает, только если техников нет вообще;
 * - суточник работает СУТКИ (24 ч) — назначать можно любой объём;
 * - нераспределённые появляются ТОЛЬКО если в реестре нет подходящей роли.
 */
export function planDay(tickets, staff, date) {
  const weekend = isWeekend(date)
  const shift   = shiftForDate(date)

  const watchman    = staff.find(p => p.kind === 'watchman' && p.shift === shift)
    ?? staff.find(p => p.kind === 'watchman' && !p.shift) // добавленный вручную без смены
  const technicians = staff.filter(p => p.kind === 'technician')
  const engineers   = staff.filter(p => p.kind === 'engineer')

  const specialists = new Map() // category → person
  for (const t of technicians) {
    const cat = specialtyOf(t)
    if (cat && !specialists.has(cat)) specialists.set(cat, t)
  }
  const universals = technicians.filter(p => !specialtyOf(p))

  // Балансировка универсалов: круговое распределение по хэшу тикета,
  // детерминированно (без Math.random — регенерация даёт ту же раскладку)
  function pickUniversal(ticket) {
    if (universals.length === 0) return null
    return universals[hashInt(ticket.id) % universals.length]
  }

  function assignEK(ticket) {
    return watchman ?? pickUniversal(ticket) ?? specialists.get(ticket.category)
      ?? engineers[0] ?? null
  }

  function assignTO(ticket) {
    if (SPECIALIST_CATS.has(ticket.category) && specialists.has(ticket.category)) {
      return specialists.get(ticket.category)
    }
    return pickUniversal(ticket)
      ?? (technicians.length > 0 ? technicians[hashInt(ticket.id) % technicians.length] : null)
      ?? engineers[0] ?? watchman ?? null
  }

  const out = []
  for (const t of tickets) {
    // Ручные назначения и закрытые/в-работе с исполнителем — не трогаем
    if (t.manuallyAssigned || t.status === 'done' || (t.status === 'in_progress' && t.assigneeId)) {
      out.push(t)
      continue
    }
    let person
    if (weekend) {
      person = watchman ?? null
    } else if (t.type === 'EK') {
      person = assignEK(t)
    } else {
      person = assignTO(t)
    }
    out.push({ ...t, assigneeId: person?.id ?? null })
  }

  // order: внутри каждого исполнителя ЭК → ТО, группировка по системам
  const byPerson = new Map()
  for (const t of out) {
    if (!t.assigneeId) continue
    if (!byPerson.has(t.assigneeId)) byPerson.set(t.assigneeId, [])
    byPerson.get(t.assigneeId).push(t)
  }
  const orderById = new Map()
  for (const list of byPerson.values()) {
    sortForOrder(list).forEach((t, i) => orderById.set(t.id, i + 1))
  }

  const final = out.map(t => orderById.has(t.id) ? { ...t, order: orderById.get(t.id) } : t)
  const unassigned = final.filter(t => !t.assigneeId && t.status !== 'done')

  // Инвариант 3 (кодовая сверка): назначенные + нераспределённые == тикеты дня
  const assignedCount = final.filter(t => t.assigneeId).length
  if (assignedCount + unassigned.length !== final.length) {
    throw new Error(`planDay invariant violated: ${assignedCount} + ${unassigned.length} != ${final.length}`)
  }

  return { tickets: final, unassigned }
}

/**
 * Перераспределение после удаления сотрудника: его открытые тикеты
 * раскладываются заново по правилам; закрытые и «в работе» не трогаются
 * (assigneeId удалённого остаётся в истории закрытых — это факт выполнения).
 */
export function reassignAfterRemoval(tickets, removedPersonId, staff, date) {
  const affected = tickets.map(t => {
    if (t.assigneeId === removedPersonId && t.status === 'open') {
      return { ...t, assigneeId: null, manuallyAssigned: false, order: null }
    }
    return t
  })
  return planDay(affected, staff, date)
}
