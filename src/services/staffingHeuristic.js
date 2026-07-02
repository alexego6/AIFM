// Редактируемый конфиг эвристики штата (провенанс: heuristic)
// Числа — эталонные дефолты; правятся пользователем в UI.
export const DEFAULT_HEURISTIC = {
  baseAreaSqm: 10_000,
  base: {
    engineers: 1,       // 1 инженер по эксплуатации всегда
    technicians: 1,     // минимум 1 техник-универсал в базе
    watchPositions: 1,  // 1 позиция суточника в базе
  },
  // Разные пороги: техников добавляем каждые 10k, суточников — каждые 20k (дорого)
  techIncrementSqm: 10_000,
  watchIncrementSqm: 20_000,
  watchmanMultiplier: 4, // режим сутки/трое → 1 позиция = 4 ставки
}

const OFFSITE_DEFAULTS = [
  {
    role: 'Диспетчерская служба',
    note: 'Может быть удалённой / общей на несколько объектов; учитывается отдельно от штата объекта',
  },
  {
    role: 'Аварийная мобильная бригада',
    note: 'Механики, электрики, холодильщики, сантехники (по требованиям ТЗ). Может быть общей для комплекса',
  },
]

const SLA_DEFAULTS = [
  {
    requirement: '24/7 присутствие собственной службы',
    coveredBy: 'Дежурный (суточник) + аварийная служба',
    source: 'ТЗ',
  },
  {
    requirement: 'Прибытие аварийной бригады ≤ 1 ч',
    coveredBy: 'Аварийная мобильная бригада (служба за скобки)',
    source: 'ТЗ, Прил. 5',
  },
  {
    requirement: 'Уведомление о ЧП ≤ 5 мин',
    coveredBy: 'Диспетчерская служба + дежурный',
    source: 'ТЗ, Прил. 5',
  },
  {
    requirement: 'Невыполненные ЭК/ТО ≤ 1 мес.',
    coveredBy: 'Инженер + техники по плану-графику Этапа 4',
    source: 'ТЗ, Прил. 5',
  },
]

export function calcBuildingStaffing(building, heuristic = DEFAULT_HEURISTIC) {
  const base = {
    buildingId: building.id,
    buildingName: building.name,
    areaSqm: building.areaSqm,
    needsReview: building.needsReview,
    offSite: OFFSITE_DEFAULTS,
    slaConstraints: SLA_DEFAULTS,
  }

  if (!building.areaSqm) {
    return {
      ...base,
      error: 'Площадь пола не найдена в ТЗ — расчёт невозможен до уточнения',
      roles: [],
      totalStavki: null,
    }
  }

  const area = building.areaSqm
  const overBase = Math.max(0, area - heuristic.baseAreaSqm)

  // Техников: каждые 10k сверх базы → +1
  const extraTechs  = Math.ceil(overBase / heuristic.techIncrementSqm)
  // Суточников: каждые 20k сверх базы → +1 (консервативно, они дорогие)
  const extraWatch  = Math.floor(overBase / heuristic.watchIncrementSqm)

  const numEngineers   = heuristic.base.engineers
  const numTechnicians = heuristic.base.technicians + extraTechs
  const numWatchPos    = heuristic.base.watchPositions + extraWatch
  const watchStavki    = numWatchPos * heuristic.watchmanMultiplier

  const techNote = extraTechs > 0
    ? `1 базовый + ${extraTechs} с профильной специализацией (${Math.round(area / 1000)} тыс. м²)`
    : 'Базовый (универсал)'

  const roles = [
    {
      id: 'engineer',
      role: 'Инженер по эксплуатации',
      stavka: numEngineers,
      basis: 'heuristic',
      combinedWith: ['Ответственный за электрохозяйство', 'Ответственный за теплохозяйство', 'Ответственный за ПБ'],
      note: 'Аттестации: электрохозяйство, теплохозяйство, ПБ — совмещается в одном лице при отсутствии конфликта',
    },
    {
      id: 'technician',
      role: 'Техник-универсал',
      stavka: numTechnicians,
      basis: 'heuristic',
      note: techNote,
    },
    {
      id: 'watchman',
      role: 'Дежурный (суточник)',
      stavka: watchStavki,
      basis: 'heuristic',
      combinedWith: ['Лифтёр', 'Оператор диспетчеризации'],
      note: `${numWatchPos} позиц. × ${heuristic.watchmanMultiplier} ставки (режим сутки/трое)`,
    },
  ]

  return {
    ...base,
    roles,
    numEngineers,
    numTechnicians,
    numWatchPos,
    watchStavki,
    totalStavki: numEngineers + numTechnicians + watchStavki,
  }
}

export function calcAllStaffing(buildings, heuristic = DEFAULT_HEURISTIC) {
  return buildings.map(b => calcBuildingStaffing(b, heuristic))
}

export function calcSummary(plans) {
  const valid = plans.filter(p => p.totalStavki != null)
  if (!valid.length) return null
  return {
    engineers:    valid.reduce((s, p) => s + p.numEngineers, 0),
    technicians:  valid.reduce((s, p) => s + p.numTechnicians, 0),
    watchStavki:  valid.reduce((s, p) => s + p.watchStavki, 0),
    totalStavki:  valid.reduce((s, p) => s + p.totalStavki, 0),
    buildingCount: valid.length,
  }
}
