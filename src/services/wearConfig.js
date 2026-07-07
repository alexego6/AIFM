// Конфиги прогноза износа. Редактируемые дефолты — НЕ хардкод-логика.

// Трекаемые классы узлов (канонические ключи CLASS_ALIASES из resourcesHeuristic).
// Главные узлы инженерных систем. Лампы/расходники/датчики НЕ трекаем.
export const WEAR_TRACKED_CLASSES = new Set([
  'ahu', 'chiller', 'fancoil', 'vrf', 'fan', 'air_curtain', 'cooling_beam',
  'pump', 'boiler', 'heat_exchanger', 'expansion_vessel',
  'ups', 'panel',
  'elevator', 'solar',
])

// Пороги износа, %
export const WEAR_THRESHOLDS = {
  warning:  60,
  critical: 80,
}

// Минимум замеров для построения тренда
export const MIN_MEASUREMENTS = 5

// Горизонты статусов, месяцев до достижения critical
export const ETA_WATCH_MONTHS   = 12  // «Наблюдение»
export const ETA_URGENT_MONTHS  = 3   // «Замена скоро»
