// ЗИП, расходники, инструмент — Phase 1: номенклатура от оборудования Stage 2.
// Phase 2 TODO: annualQty ← tickets + fact consumption после 12 мес → qtyStatus:'from_fact'

// ── Нормализация классов оборудования → ресурсный ключ ───────────────────────
const CLASS_ALIASES = {
  'ahu': 'ahu', 'ahu_supply': 'ahu', 'ahu_exhaust': 'ahu', 'air_handling_unit': 'ahu',
  'fan_coil': 'fancoil', 'fan_coil_unit': 'fancoil', 'fancoil': 'fancoil',
  'cooling_beam': 'cooling_beam',
  'chiller': 'chiller',
  'vrf_system': 'vrf', 'split_system': 'vrf', 'ac_indoor_unit': 'vrf',
  'ac_condenser': 'vrf', 'heat_pump': 'vrf',
  'pump': 'pump', 'circulation_pump': 'pump',
  'boiler': 'boiler', 'boiler_gas': 'boiler', 'boiler_electric': 'boiler', 'electric_boiler': 'boiler',
  'heat_exchanger': 'heat_exchanger',
  'expansion_vessel': 'expansion_vessel',
  'ups': 'ups', 'ups_battery': 'ups', 'ups_fire': 'ups', 'backup_power_supply': 'ups',
  'distribution_panel': 'panel',
  'lighting': 'lighting', 'luminaire': 'lighting', 'outdoor_lighting': 'lighting',
  'fire_extinguisher': 'fire_ext',
  'smoke_detector': 'smoke_detector', 'fire_detector': 'smoke_detector',
  'sanitary_fixtures': 'sanitary',
  'fire_hose_cabinet': 'fire_hose',
  'passenger_elevator': 'elevator', 'freight_elevator': 'elevator',
  'accessibility_lift': 'elevator', 'disabled_platform_lift': 'elevator',
  'exhaust_unit': 'fan', 'roof_fan': 'fan', 'fan': 'fan', 'inline_fan': 'fan',
  'air_curtain': 'air_curtain',
  'solar_panel_system': 'solar',
}

// ── Ресурсные наборы по ключу ─────────────────────────────────────────────────
// spareParts/consumables: annualQty всегда null (Phase 1), qtyStatus:'pending_fact'
const RESOURCE_SETS = {
  ahu: {
    spareParts: [
      { name: 'Воздушный фильтр секционный G4/F7 (под марку установки)' },
      { name: 'Приводной ремень (по типоразмеру вентилятора)' },
    ],
    consumables: [
      { name: 'Воздушный фильтр G4 (замена ×4/год)' },
    ],
    tools: [],
  },
  fancoil: {
    spareParts: [
      { name: 'Фильтр фанкойла сменный (металлический EU3 — под тип FCU)' },
    ],
    consumables: [],
    tools: [],
  },
  cooling_beam: {
    spareParts: [],
    consumables: [
      { name: 'Дистиллированная вода / средство для промывки охлаждающих балок' },
    ],
    tools: [
      { name: 'Щётка для очистки охлаждающих балок (Trox)', scope: 'group', forClass: 'cooling_beam' },
    ],
  },
  chiller: {
    spareParts: [
      { name: 'Хладагент дозаправка (марка — по паспорту чиллера)', note: 'по факту утечки' },
    ],
    consumables: [],
    tools: [
      { name: 'Манометрический коллектор холодильного агента', scope: 'group', forClass: 'chiller' },
    ],
  },
  vrf: {
    spareParts: [
      { name: 'Фреон дозаправка (R410A/R32 — по паспорту блока)', note: 'по факту' },
      { name: 'Фильтр грубой очистки внутреннего блока' },
    ],
    consumables: [],
    tools: [
      { name: 'Манометрический коллектор хладагента', scope: 'group', forClass: 'vrf' },
    ],
  },
  fan: {
    spareParts: [
      { name: 'Приводной ремень (по типоразмеру вентилятора)' },
      { name: 'Подшипник (по марке вентилятора)' },
    ],
    consumables: [],
    tools: [],
  },
  air_curtain: {
    spareParts: [
      { name: 'Приводной ремень тепловой завесы' },
    ],
    consumables: [],
    tools: [],
  },
  pump: {
    spareParts: [
      { name: 'Торцевое уплотнение (сальник — по марке насоса)' },
      { name: 'Подшипник (по марке насоса)' },
    ],
    consumables: [],
    tools: [],
  },
  boiler: {
    spareParts: [
      { name: 'Электрод розжига / ионизации (для газовых котлов)' },
      { name: 'Прокладки камеры сгорания (паронит)' },
    ],
    consumables: [
      { name: 'Реагент для промывки контура (раз в 2 года)' },
    ],
    tools: [],
  },
  heat_exchanger: {
    spareParts: [
      { name: 'Прокладки пластинчатого теплообменника (по марке/типоразмеру)' },
    ],
    consumables: [
      { name: 'Реагент для промывки теплообменника (раз в 2 года)' },
    ],
    tools: [],
  },
  expansion_vessel: {
    spareParts: [
      { name: 'Мембрана сменная (по диаметру и модели бака)' },
    ],
    consumables: [],
    tools: [],
  },
  ups: {
    spareParts: [
      { name: 'АКБ гель/AGM (по марке ИБП и ёмкости — срок жизни ~5 лет)', note: 'плановая замена' },
    ],
    consumables: [],
    tools: [],
  },
  panel: {
    spareParts: [
      { name: 'Автоматический выключатель 16–63 А (ABB/Legrand/Schneider — по номиналам щита)' },
      { name: 'Предохранители (по номинальному ряду щитов объекта)' },
    ],
    consumables: [],
    tools: [],
  },
  lighting: {
    spareParts: [
      { name: 'Лампы LED (замена перегоревших — тип по установленному парку)', note: 'парк из ТЗ' },
    ],
    consumables: [],
    tools: [],
  },
  fire_ext: {
    spareParts: [],
    consumables: [
      { name: 'Перезарядка огнетушителей ОП/ОУ (раз в год)', note: 'под договор ТО' },
    ],
    tools: [],
  },
  smoke_detector: {
    spareParts: [
      { name: 'Датчик дымовой ИП212 / аналог (запасной — по марке в ТЗ)' },
      { name: 'Батарейки CR123A/AA (для беспроводных датчиков)' },
    ],
    consumables: [],
    tools: [],
  },
  sanitary: {
    spareParts: [
      { name: 'Набор прокладок сантехнических (резина, паронит)' },
      { name: 'Шаровый кран Ду15–25 (запасной)' },
    ],
    consumables: [],
    tools: [],
  },
  fire_hose: {
    spareParts: [
      { name: 'Рукав пожарный Д50/70 запасной (10–20 м)' },
      { name: 'Форсунка-головка (по типу крана)' },
    ],
    consumables: [],
    tools: [],
  },
  elevator: {
    spareParts: [
      { name: 'Смазка для направляющих лифта (Mobilux EP 2 или аналог)', note: 'под договор ТО лифтов' },
      { name: 'Лампы освещения кабины лифта' },
    ],
    consumables: [],
    tools: [],
  },
  solar: {
    spareParts: [],
    consumables: [],
    tools: [
      { name: 'Щётка телескопическая для мойки солнечных панелей', scope: 'object', forClass: 'solar' },
    ],
  },
}

// ── Базовый инструмент (всегда, на каждый объект) ────────────────────────────
export const BASE_TOOLS = [
  { name: 'Лестница-стремянка 2–3 м', scope: 'object', basis: 'base' },
  { name: 'Шуруповёрт аккумуляторный + набор бит', scope: 'object', basis: 'base' },
  { name: 'Перфоратор + набор свёрл и буров', scope: 'object', basis: 'base' },
  { name: 'Мультиметр цифровой (Fluke или аналог)', scope: 'object', basis: 'base' },
  { name: 'Манометр переносной 0–25 бар', scope: 'object', basis: 'base' },
  { name: 'Набор ключей рожковых/накидных 6–32 мм', scope: 'object', basis: 'base' },
  { name: 'Набор отвёрток (плоские, крест, Torx)', scope: 'object', basis: 'base' },
  { name: 'Инфракрасный термометр (пирометр)', scope: 'object', basis: 'base' },
  { name: 'Индикатор напряжения / фазировщик', scope: 'object', basis: 'base' },
]

// ── Групповой инструмент (дорогой/редкий, один на группу объектов) ───────────
export const GROUP_TOOLS = [
  { name: 'Тепловизор', scope: 'group', basis: 'base' },
  { name: 'Течеискатель хладагента (электронный)', scope: 'group', basis: 'base' },
  { name: 'Токоизмерительные клещи ≥ 400 А', scope: 'group', basis: 'base' },
  { name: 'Анализатор качества электроэнергии', scope: 'group', basis: 'base' },
  { name: 'Мегаомметр (ЭС0202/2G или аналог)', scope: 'group', basis: 'base' },
]

// ── Расчёт ресурсов по зданию ─────────────────────────────────────────────────
export function calcBuildingResources(building, systemsForBuilding) {
  const seenParts = new Set()
  const seenCons  = new Set()
  const spareParts = []
  const consumables = []
  const classToolsMap = new Map()
  const unmappedClasses = new Set()

  for (const sys of systemsForBuilding ?? []) {
    for (const eq of sys.equipment ?? []) {
      const cls = eq.class ?? ''
      const rKey = CLASS_ALIASES[cls]

      if (!rKey) {
        if (cls) unmappedClasses.add(cls)
        continue
      }

      const rSet = RESOURCE_SETS[rKey]
      if (!rSet) continue

      const eqMeta = { name: eq.name ?? '', brand: eq.brand ?? null, tag: eq.tag ?? null }

      for (const sp of rSet.spareParts) {
        const key = `${sp.name}||${eqMeta.name}||${eqMeta.brand || ''}`
        if (!seenParts.has(key)) {
          seenParts.add(key)
          spareParts.push({
            name: sp.name,
            forClass: rKey,
            forEquipment: eqMeta,
            installedQty: eq.qty ?? null,
            annualQty: null,
            qtyStatus: 'pending_fact',
            provenance: 'heuristic',
            note: sp.note ?? null,
          })
        }
      }

      for (const c of rSet.consumables) {
        const key = `${c.name}||${eqMeta.name}||${eqMeta.brand || ''}`
        if (!seenCons.has(key)) {
          seenCons.add(key)
          consumables.push({
            name: c.name,
            forClass: rKey,
            forEquipment: eqMeta,
            installedQty: eq.qty ?? null,
            annualQty: null,
            qtyStatus: 'pending_fact',
            provenance: 'heuristic',
            note: c.note ?? null,
          })
        }
      }

      for (const t of rSet.tools) {
        if (!classToolsMap.has(t.name)) {
          classToolsMap.set(t.name, { ...t, basis: 'class' })
        }
      }
    }
  }

  const classScopedTools = Array.from(classToolsMap.values())

  return {
    buildingId: building.id,
    buildingName: building.name,
    spareParts,
    consumables,
    // object-scope: base + class-specific; group-scope stored for group view
    tools: [...BASE_TOOLS, ...classScopedTools, ...GROUP_TOOLS],
    unmappedClasses: Array.from(unmappedClasses).sort(),
  }
}

export function calcAllResources(buildings, systemsData) {
  return buildings.map(b => {
    const bSystems = systemsData.find(s => s.buildingId === b.id)?.systems ?? []
    return calcBuildingResources(b, bSystems)
  })
}

// ── Сводный расчёт по всем объектам ──────────────────────────────────────────
export function calcGroupResources(plans) {
  const spMap   = new Map()
  const conMap  = new Map()
  const toolMap = new Map()
  const unmapped = new Set()

  for (const plan of plans) {
    for (const sp of Array.isArray(plan.spareParts) ? plan.spareParts : []) {
      const key = `${sp.name}||${sp.forClass}||${sp.forEquipment?.brand || ''}`
      if (spMap.has(key)) {
        const ex = spMap.get(key)
        if (sp.installedQty != null && ex.installedQty != null) ex.installedQty += sp.installedQty
      } else {
        spMap.set(key, { ...sp, buildings: [plan.buildingId] })
      }
    }
    for (const c of Array.isArray(plan.consumables) ? plan.consumables : []) {
      const key = `${c.name}||${c.forClass}||${c.forEquipment?.brand || ''}`
      if (conMap.has(key)) {
        const ex = conMap.get(key)
        if (c.installedQty != null && ex.installedQty != null) ex.installedQty += c.installedQty
      } else {
        conMap.set(key, { ...c })
      }
    }
    for (const t of Array.isArray(plan.tools) ? plan.tools : []) {
      if (!toolMap.has(t.name)) toolMap.set(t.name, t)
    }
    for (const u of Array.isArray(plan.unmappedClasses) ? plan.unmappedClasses : []) unmapped.add(u)
  }

  return {
    spareParts:     Array.from(spMap.values()),
    consumables:    Array.from(conMap.values()),
    tools:          Array.from(toolMap.values()),
    unmappedClasses: Array.from(unmapped).sort(),
  }
}
