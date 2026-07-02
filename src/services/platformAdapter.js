// Adapters: TZ sandbox data → platform store format.
// Pure functions — no side effects, no imports from stores.

// ── Stable content-hash ID (djb2 variant) ─────────────────────────────────────
function contentHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

// ── Buildings ─────────────────────────────────────────────────────────────────
export function mapBuildings(tzBuildings, now = new Date().toISOString()) {
  return (tzBuildings ?? []).map(b => ({
    id:               b.id,
    name:             b.name,
    address:          b.address          ?? null,
    areaSqm:          b.areaSqm          ?? null,
    territoryAreaSqm: b.territoryAreaSqm ?? null,
    purpose:          b.purpose          ?? null,
    subBuildings:     b.sub_buildings    ?? [],
    needsReview:      b.needsReview      ?? false,
    editedByUser:     false,
    appliedAt:        now,
  }))
}

// ── Systems + tasks + equipment (with content-hash IDs) ───────────────────────
export function mapSystemsData(tzSystems, now = new Date().toISOString()) {
  return (tzSystems ?? []).map(s => ({
    buildingId: s.buildingId,
    systems: (s.systems ?? []).map(sys => ({
      id: contentHash(`${s.buildingId}|${sys.systemCode ?? ''}|${sys.systemName ?? ''}`),
      systemCode: sys.systemCode  ?? null,
      systemName: sys.systemName  ?? null,
      maintenanceTasks: (sys.maintenanceTasks ?? []).map(t => ({
        id:          contentHash(`${s.buildingId}|${sys.systemCode ?? ''}|${t.operation ?? ''}|${t.mode ?? ''}`),
        mode:        t.mode      ?? null,
        operation:   t.operation ?? null,
        opNum:       t.opNum     ?? null,
        months:      t.months    ?? [],
        needsReview: false,
        editedByUser: false,
      })),
      equipment: (sys.equipment ?? []).map(eq => ({
        id:          contentHash(`${s.buildingId}|${sys.systemCode ?? ''}|${eq.name ?? ''}|${eq.class ?? ''}`),
        name:        eq.name   ?? null,
        class:       eq.class  ?? null,
        brand:       eq.brand  ?? null,
        qty:         eq.qty    ?? null,
        tag:         eq.tag    ?? null,
        needsReview: false,
        editedByUser: false,
      })),
      appliedAt: now,
    })),
  }))
}

// ── Upsert: incoming replaces existing; if existing had editedByUser → mark needsReview ──
export function upsertBuildings(existing, incoming) {
  const editedIds = new Set((existing ?? []).filter(b => b.editedByUser).map(b => b.id))
  return incoming.map(b => editedIds.has(b.id) ? { ...b, needsReview: true } : b)
}

export function upsertSystemsData(existing, incoming) {
  const exMap = Object.fromEntries((existing ?? []).map(s => [s.buildingId, s]))
  return incoming.map(inc => {
    const ex = exMap[inc.buildingId]
    if (!ex) return inc
    const hasEdits = ex.systems.some(s =>
      (s.maintenanceTasks ?? []).some(t => t.editedByUser) ||
      (s.equipment        ?? []).some(e => e.editedByUser)
    )
    if (!hasEdits) return inc
    return {
      ...inc,
      systems: inc.systems.map(s => ({
        ...s,
        maintenanceTasks: s.maintenanceTasks.map(t => ({ ...t, needsReview: true })),
        equipment:        s.equipment.map(e        => ({ ...e, needsReview: true })),
      })),
    }
  })
}

// ── Validation before applying ────────────────────────────────────────────────
export function validateTZForApply({ buildings, systems, staffingPlan, resourcesPlan }) {
  const errors   = []
  const warnings = []

  if (!buildings?.length) errors.push('Нет зданий — выполните Этап 1')
  if (!systems?.length)   errors.push('Нет систем — выполните Этапы 2–3')

  if (!staffingPlan?.length)  warnings.push('Нет плана штата — выполните Этап 5')
  if (!resourcesPlan?.length) warnings.push('Нет ЗИП/расходников — выполните Этап 5')

  const withSystems = new Set((systems ?? []).map(s => s.buildingId))
  for (const b of (buildings ?? [])) {
    if (!withSystems.has(b.id)) warnings.push(`Нет систем для объекта «${b.name}»`)
  }

  if (systems?.length) {
    const allSystems = systems.flatMap(s => s.systems ?? [])
    const hasAnyTasks = allSystems.some(s => (s.maintenanceTasks ?? []).length > 0)
    if (!hasAnyTasks) errors.push('Нет задач ТО/ЭК — выполните Этап 3')
  }

  return { ok: errors.length === 0, errors, warnings }
}

// ── Dashboard data helpers ────────────────────────────────────────────────────

// Monthly distribution of tasks across all systemsData for one building
export function tasksPerMonth(buildingSystemsData) {
  const counts = Array(12).fill(0)
  for (const s of buildingSystemsData?.systems ?? []) {
    for (const t of s.maintenanceTasks ?? []) {
      for (const m of t.months ?? []) {
        if (m >= 1 && m <= 12) counts[m - 1]++
      }
    }
  }
  return counts
}

// Systems distribution for selected building
export function systemsDistribution(buildingSystemsData) {
  const items = []
  for (const s of buildingSystemsData?.systems ?? []) {
    const eqCount = (s.equipment ?? []).reduce((acc, eq) => acc + (eq.qty ?? 1), 0)
    items.push({ code: s.systemCode ?? '—', name: s.systemName ?? '—', eqCount })
  }
  return items
}

// Tasks this month for selected building
export function tasksThisMonth(buildingSystemsData, monthIdx) {
  let count = 0
  for (const s of buildingSystemsData?.systems ?? []) {
    for (const t of s.maintenanceTasks ?? []) {
      if ((t.months ?? []).includes(monthIdx + 1)) count++
    }
  }
  return count
}

// Total equipment units for selected building
export function totalEquipmentUnits(buildingSystemsData) {
  let total = 0
  for (const s of buildingSystemsData?.systems ?? []) {
    for (const eq of s.equipment ?? []) {
      total += eq.qty ?? 1
    }
  }
  return total
}
