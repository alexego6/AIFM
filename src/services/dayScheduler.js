// Day scheduler: детерминированное назначение календарного дня каждой операции
// из maintenanceTasks. День вычисляется хэшем (buildingId|systemId|taskId) и
// зафиксирован на весь год — регенерация никогда не перетасовывает дни.
// Pure functions — no side effects, no store imports. 0 API.

// ── Stable hash (djb2 variant — same family as platformAdapter) ──────────────
export function contentHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

// Numeric hash for day-picking arithmetic
export function hashInt(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

// ── Calendar helpers (UTC-free: работаем с локальными датами Y-M-D) ──────────
// Якорь чётности «через день» и цикла смен — 01.01.2026, зафиксирован навсегда.
const ANCHOR = new Date(2026, 0, 1)

export function dayIndex(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((d - ANCHOR) / 86_400_000)
}

export function isWeekend(date) {
  const wd = date.getDay()
  return wd === 0 || wd === 6
}

// ISO weekday: Mon=1 … Sun=7
function isoWeekday(date) {
  return date.getDay() === 0 ? 7 : date.getDay()
}

// ISO week number (для 1р/2нед)
export function isoWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + 4 - isoWeekday(d))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7)
}

// Рабочие дни месяца (числа 1..31, только пн–пт)
export function workdaysOfMonth(year, month /* 1..12 */) {
  const days = []
  const last = new Date(year, month, 0).getDate()
  for (let d = 1; d <= last; d++) {
    if (!isWeekend(new Date(year, month - 1, d))) days.push(d)
  }
  return days
}

// ── Классификация периодичности ──────────────────────────────────────────────
// Нормализованные значения из PERIODICITY_NORMS (tzPipeline) + сырые строки.
const RE_DAILY      = /^(ежесменно|ежедневно)$/i
const RE_EVERY2DAYS = /^1р\/2дня$/i
const RE_WEEKLY     = /^еженедельно$/i
const RE_TWICE_WEEK = /2\s*раза?\s*(?:в|\/)?\s*нед/i          // сырая строка, нормы её не покрывают
const RE_BIWEEKLY   = /^1р\/2нед$/i
// Месячное семейство: конкретные месяцы заданы крестиками months[]
const RE_MONTHLY_FAMILY = /^(ежемесячно|ежеквартально|4р\/год|3р\/год|2р\/год|1р\/6мес|1р\/год)$/i

// Пары будних дней для «2р/неделю» (ISO: пн=1 … пт=5), разнос ≥2 дней
const TWICE_WEEK_PAIRS = [[1, 4], [2, 5]]

/**
 * Правило планировщика для задачи. Возвращает один из:
 * 'daily' | 'every2days' | 'weekly' | 'twiceWeek' | 'biweekly' | 'monthly' | 'skip'
 * 'monthly' покрывает всё месячное семейство и fallback «есть крестики месяцев».
 */
export function classifyRule(task) {
  const p = (task.periodicity ?? '').trim()
  if (RE_DAILY.test(p))       return 'daily'
  if (RE_EVERY2DAYS.test(p))  return 'every2days'
  if (RE_TWICE_WEEK.test(p))  return 'twiceWeek'
  if (RE_WEEKLY.test(p))      return 'weekly'
  if (RE_BIWEEKLY.test(p))    return 'biweekly'
  if (RE_MONTHLY_FAMILY.test(p)) return 'monthly'
  // Нераспознанная периодичность или «не указано»: если в графике есть
  // крестики месяцев — честно раскладываем по месячному правилу (needsReview
  // прокидывается на тикет);若 нет — задача не генерится (фиксируется в отчёте).
  if ((task.months ?? []).length > 0) return 'monthly'
  return 'skip'
}

// Фильтр месяцев: если крестики заданы — правило действует только в этих месяцах.
// Для daily/weekly с пустым months[] — действует круглый год.
function monthAllowed(task, month) {
  const ms = task.months ?? []
  return ms.length === 0 || ms.includes(month)
}

/**
 * Ядро: попадает ли операция на данную дату.
 * seed — стабильный вход хэша: `${buildingId}|${systemId}|${task.id}`.
 */
export function taskOccursOn(task, seed, date) {
  const rule = classifyRule(task)
  if (rule === 'skip') return false

  const year  = date.getFullYear()
  const month = date.getMonth() + 1
  if (!monthAllowed(task, month)) return false

  const h = hashInt(seed)

  switch (rule) {
    case 'daily':
      return true

    case 'every2days':
      // Через день, включая выходные; стартовая чётность — от хэша
      return (dayIndex(date) + h) % 2 === 0

    case 'weekly': {
      // Один фиксированный будний день (пн–пт), выбранный хэшем
      const wd = 1 + (h % 5)
      return isoWeekday(date) === wd
    }

    case 'twiceWeek': {
      const pair = TWICE_WEEK_PAIRS[h % TWICE_WEEK_PAIRS.length]
      return pair.includes(isoWeekday(date))
    }

    case 'biweekly': {
      const wd = 1 + (h % 5)
      if (isoWeekday(date) !== wd) return false
      return (isoWeek(date) + h) % 2 === 0
    }

    case 'monthly': {
      // Только рабочие дни месяца; день фиксируется хэшем, разные задачи
      // распределяются равномерно (у каждой свой хэш)
      const wds = workdaysOfMonth(year, month)
      if (wds.length === 0) return false
      const day = wds[h % wds.length]
      return date.getDate() === day
    }

    default:
      return false
  }
}

/**
 * Ожидаемое число экземпляров задачи в месяце — независимый расчёт для
 * кодовой сверки полноты (инвариант 1): сумма сгенерированного по дням
 * ДОЛЖНА сойтись с этим числом. Ничего не потеряно, ничего не задвоено.
 */
export function expectedCountForMonth(task, seed, year, month) {
  const rule = classifyRule(task)
  if (rule === 'skip') return 0
  if (!monthAllowed(task, month)) return 0

  const h = hashInt(seed)
  const lastDay = new Date(year, month, 0).getDate()

  switch (rule) {
    case 'daily':
      return lastDay

    case 'every2days': {
      let n = 0
      for (let d = 1; d <= lastDay; d++) {
        if ((dayIndex(new Date(year, month - 1, d)) + h) % 2 === 0) n++
      }
      return n
    }

    case 'weekly': {
      const wd = 1 + (h % 5)
      let n = 0
      for (let d = 1; d <= lastDay; d++) {
        if (isoWeekday(new Date(year, month - 1, d)) === wd) n++
      }
      return n
    }

    case 'twiceWeek': {
      const pair = TWICE_WEEK_PAIRS[h % TWICE_WEEK_PAIRS.length]
      let n = 0
      for (let d = 1; d <= lastDay; d++) {
        if (pair.includes(isoWeekday(new Date(year, month - 1, d)))) n++
      }
      return n
    }

    case 'biweekly': {
      const wd = 1 + (h % 5)
      let n = 0
      for (let d = 1; d <= lastDay; d++) {
        const dt = new Date(year, month - 1, d)
        if (isoWeekday(dt) === wd && (isoWeek(dt) + h) % 2 === 0) n++
      }
      return n
    }

    case 'monthly':
      return workdaysOfMonth(year, month).length > 0 ? 1 : 0

    default:
      return 0
  }
}

// ── Генерация тикетов ─────────────────────────────────────────────────────────

export function toISODate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// SLA плановых работ: «невыполненные работы ЭК/ТО устраняются ≤ 1 месяца» (Прил. 5 ТЗ)
export function plannedSlaDeadline(date) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, date.getDate())
  return toISODate(d)
}

/**
 * Тикеты одного дня на ВСЕ объекты платформы.
 * systemsData: [{buildingId, systems[]}] из usePlatformStore.
 * id тикета = contentHash(buildingId|systemId|taskId|дата) — регенерация
 * даёт те же id, дубликаты отсекаются стором по совпадению id.
 */
export function generateDayTickets(systemsData, date) {
  const iso = toISODate(date)
  const tickets = []
  for (const bs of systemsData ?? []) {
    for (const sys of bs.systems ?? []) {
      for (const task of sys.maintenanceTasks ?? []) {
        const seed = `${bs.buildingId}|${sys.id}|${task.id}`
        if (!taskOccursOn(task, seed, date)) continue
        tickets.push({
          id:          contentHash(`${bs.buildingId}|${sys.id}|${task.id}|${iso}`),
          buildingId:  bs.buildingId,
          systemId:    sys.id,
          systemName:  sys.name ?? sys.systemName ?? '—',
          category:    sys.category ?? 'other',
          taskId:      task.id,
          type:        task.mode === 'EK' ? 'EK' : 'TO',   // авариям тут неоткуда взяться
          title:       task.operation ?? 'Операция без названия',
          periodicity: task.periodicity ?? null,
          date:        iso,
          status:      'open',
          assigneeId:  null,
          manuallyAssigned: false,
          order:       null,
          source:      'schedule',
          needsReview: !!task.needsReview || classifyRule(task) === 'monthly' && !RE_MONTHLY_FAMILY.test((task.periodicity ?? '').trim()) && (task.months ?? []).length > 0,
          slaDeadline: plannedSlaDeadline(date),
          slaBasis:    'tz',   // «невыполненные ЭК/ТО ≤ 1 мес», Прил. 5 ТЗ
          createdAt:   new Date().toISOString(),
          closedAt:    null,
        })
      }
    }
  }
  return tickets
}

/**
 * Инвариант 1 (кодовая сверка): для каждого объекта сумма тикетов по всем
 * дням месяца == сумме ожидаемых экземпляров операций. Возвращает
 * { ok, expected, generated, mismatches[] }.
 */
export function verifyMonthCompleteness(systemsData, year, month) {
  const lastDay = new Date(year, month, 0).getDate()
  const generatedByTask = new Map()
  for (let d = 1; d <= lastDay; d++) {
    for (const t of generateDayTickets(systemsData, new Date(year, month - 1, d))) {
      const key = `${t.buildingId}|${t.systemId}|${t.taskId}`
      generatedByTask.set(key, (generatedByTask.get(key) ?? 0) + 1)
    }
  }

  let expected = 0, generated = 0
  const mismatches = []
  for (const bs of systemsData ?? []) {
    for (const sys of bs.systems ?? []) {
      for (const task of sys.maintenanceTasks ?? []) {
        const seed = `${bs.buildingId}|${sys.id}|${task.id}`
        const key  = seed
        const exp  = expectedCountForMonth(task, seed, year, month)
        const gen  = generatedByTask.get(key) ?? 0
        expected += exp
        generated += gen
        if (exp !== gen) mismatches.push({ key, expected: exp, generated: gen, periodicity: task.periodicity })
      }
    }
  }
  return { ok: mismatches.length === 0 && expected === generated, expected, generated, mismatches }
}
