// Прогноз износа: узлы из платформы на лету, линейный тренд по замерам,
// ETA до порога, рекомендации закупки ЗИП. Чистые функции, 0 API.

import { CLASS_ALIASES, RESOURCE_SETS } from './resourcesHeuristic'
import { WEAR_TRACKED_CLASSES, WEAR_THRESHOLDS, MIN_MEASUREMENTS,
         ETA_WATCH_MONTHS, ETA_URGENT_MONTHS } from './wearConfig'
import { taskOccursOn, toISODate } from './dayScheduler'

// ── Узлы ──────────────────────────────────────────────────────────────────────
// Узел = позиция equipment применённого ТЗ с трекаемым классом.
// НЕ дублируются в отдельный стор — деривация на лету при каждом рендере.
export function deriveNodes(systemsData) {
  const nodes = []
  for (const bs of systemsData ?? []) {
    for (const sys of bs.systems ?? []) {
      for (const eq of sys.equipment ?? []) {
        const canonical = CLASS_ALIASES[eq.class] ?? null
        if (!canonical || !WEAR_TRACKED_CLASSES.has(canonical)) continue
        nodes.push({
          nodeId:     eq.id,
          buildingId: bs.buildingId,
          systemId:   sys.id,
          systemName: sys.name ?? sys.systemName ?? '—',
          category:   sys.category ?? 'other',
          class:      canonical,
          rawClass:   eq.class,
          name:       eq.name ?? 'Оборудование',
          brand:      eq.brand ?? null,
          qty:        eq.qty ?? 1,   // qty>1 → один узел-«парк», UI помечает
        })
      }
    }
  }
  return nodes
}

// ── Линейный тренд ────────────────────────────────────────────────────────────
const MS_PER_MONTH = 30.44 * 86_400_000

/**
 * Линейная регрессия по (date, wearPct).
 * Возвращает { slopePctPerMonth, lastWear, lastDate, etaCriticalMonths, status }.
 * Статусы: 'accumulating' (<MIN замеров) | 'stable' (наклон ≤0) |
 * 'ok' | 'watch' (ETA<12мес) | 'urgent' (ETA<3мес или wear≥critical).
 */
export function linearTrend(measurements, thresholds = WEAR_THRESHOLDS) {
  const pts = [...(measurements ?? [])]
    .filter(m => typeof m.wearPct === 'number' && m.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  const n = pts.length
  const last = n > 0 ? pts[n - 1] : null
  const lastWear = last?.wearPct ?? null
  const lastDate = last?.date ?? null

  if (n < MIN_MEASUREMENTS) {
    return { slopePctPerMonth: null, lastWear, lastDate, etaCriticalMonths: null,
             status: 'accumulating', count: n }
  }

  // Least squares: x — месяцы от первого замера, y — wearPct
  const x0 = new Date(pts[0].date).getTime()
  const xs = pts.map(p => (new Date(p.date).getTime() - x0) / MS_PER_MONTH)
  const ys = pts.map(p => p.wearPct)
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const my = ys.reduce((s, v) => s + v, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  const slope = den === 0 ? 0 : num / den   // %/мес

  // Износ уже за критическим порогом — «замена скоро» независимо от тренда
  if (lastWear >= thresholds.critical) {
    return { slopePctPerMonth: round2(slope), lastWear, lastDate,
             etaCriticalMonths: 0, status: 'urgent', count: n }
  }

  if (slope <= 0) {
    // Не растёт или замеры шумные — честно «стабилен», ETA не выдумываем
    return { slopePctPerMonth: round2(slope), lastWear, lastDate,
             etaCriticalMonths: null, status: 'stable', count: n }
  }

  const etaMonths = (thresholds.critical - lastWear) / slope
  const status = etaMonths < ETA_URGENT_MONTHS ? 'urgent'
               : etaMonths < ETA_WATCH_MONTHS  ? 'watch'
               : 'ok'
  return { slopePctPerMonth: round2(slope), lastWear, lastDate,
           etaCriticalMonths: round2(etaMonths), status, count: n }
}

function round2(v) { return v == null ? null : Math.round(v * 100) / 100 }

// ── Дата следующего ЭК-обхода системы ────────────────────────────────────────
// Считается СУЩЕСТВУЮЩИМ планировщиком (taskOccursOn) — не выдумывается.
// Ищем ближайший день (до horizonDays вперёд), когда любая ЭК-задача системы
// попадает в план.
export function nextRoundDate(system, buildingId, from = new Date(), horizonDays = 62) {
  const ekTasks = (system?.maintenanceTasks ?? []).filter(t => t.mode === 'EK')
  if (ekTasks.length === 0) return null
  for (let i = 1; i <= horizonDays; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)
    for (const task of ekTasks) {
      const seed = `${buildingId}|${system.id}|${task.id}`
      if (taskOccursOn(task, seed, d)) return toISODate(d)
    }
  }
  return null
}

// ── Рекомендации закупки ──────────────────────────────────────────────────────
// Узлы в статусах watch/urgent → номенклатура ЗИП по классу из RESOURCE_SETS.
// Без цен, без кнопок закупки. provenance: 'wear_forecast'.
export function purchaseRecommendations(nodesWithTrends) {
  const recs = []
  for (const { node, trend } of nodesWithTrends ?? []) {
    if (trend.status !== 'watch' && trend.status !== 'urgent') continue
    const rset = RESOURCE_SETS[node.class]
    const items = (rset?.spareParts ?? []).map(sp => sp.name)
    if (items.length === 0) continue

    let etaISO = null
    if (trend.etaCriticalMonths != null && trend.lastDate) {
      const base = new Date(trend.lastDate)
      const eta = new Date(base.getTime() + trend.etaCriticalMonths * MS_PER_MONTH)
      etaISO = toISODate(eta)
    }

    recs.push({
      nodeId:     node.nodeId,
      nodeName:   node.name,
      buildingId: node.buildingId,
      class:      node.class,
      status:     trend.status,
      etaDate:    etaISO,
      items,
      provenance: 'wear_forecast',
    })
  }
  return recs
}
