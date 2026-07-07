const API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ANTHROPIC_API_KEY) ||
  (typeof process !== 'undefined' && process.env &&
    (process.env.VITE_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY)) || ''

export const apiUsage = { inputTokens: 0, outputTokens: 0, calls: 0 }

// ── helpers ──────────────────────────────────────────────────────────────────
async function callClaude(prompt, maxTokens = 4096) {
  if (!API_KEY) { const e = new Error('NO_KEY'); e.code = 'NO_KEY'; throw e }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) { const e = new Error(`API ${res.status}`); e.code = 'API_ERROR'; throw e }
  const data = await res.json()
  apiUsage.inputTokens += data.usage?.input_tokens ?? 0
  apiUsage.outputTokens += data.usage?.output_tokens ?? 0
  apiUsage.calls++
  if (data.stop_reason === 'max_tokens') {
    const e = new Error('Response truncated by max_tokens'); e.code = 'TRUNCATED'; throw e
  }
  const text = data.content?.[0]?.text
  if (!text) { const e = new Error('Empty API response'); e.code = 'EMPTY_RESPONSE'; throw e }
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
}

// ── Stage 1: определение зданий/объектов ─────────────────────────────────────
const SCHEMA_EXAMPLE = `[
  {
    "id": "b1",
    "name": "Офисный центр «Квартал Менделеева» корпус 1",
    "address": "г. Москва, ул. Нобеля, д. 7",
    "floors": 4,
    "areaSqm": 8958.5,
    "territoryAreaSqm": null,
    "year_built": 2015,
    "purpose": "административно-офисное здание",
    "needsReview": false,
    "sub_buildings": []
  },
  {
    "id": "b2",
    "name": "Усадьба «Ромашово»",
    "address": "МО, Одинцовский р-н",
    "floors": null,
    "areaSqm": 2356.0,
    "territoryAreaSqm": 129012.0,
    "year_built": 2003,
    "purpose": "загородный комплекс",
    "needsReview": true,
    "sub_buildings": [
      "Административно-хозяйственный корпус №1",
      "Административно-хозяйственный корпус №2",
      "Коттедж №1 (Строение 3)",
      "Коттедж №2 (Строение 4)",
      "Банный корпус"
    ]
  }
]`

// Промпт для сбора кандидатов из одного батча
const EXTRACT_PROMPT = (text) => `Ты — эксперт по технической эксплуатации зданий (Facility Management).

Тебе предоставлен ФРАГМЕНТ технического задания на обслуживание объектов недвижимости.

ЗАДАЧА: определи САМОСТОЯТЕЛЬНЫЕ объекты обслуживания — здания и комплексы, которые являются
отдельными объектами ТЗ. Верни JSON-массив.

КЛЮЧЕВОЕ ПРАВИЛО — иерархия:
• Если несколько строений входят в ОДИН КОМПЛЕКС (усадьба, кампус, бизнес-парк) —
  запиши комплекс как ОДИН объект, а отдельные строения помести в "sub_buildings": [...]
• НЕ создавай отдельных объектов для: коттеджей, бань, АХК, гаражей, беседок внутри комплекса —
  только если они явно указаны как САМОСТОЯТЕЛЬНЫЙ объект ТЗ с отдельным адресом.
• НЕ включай родовые описания без имени/адреса ("нежилое здание", "объект №3" без названия).

ВАЖНОЕ ИСКЛЮЧЕНИЕ — отдельные корпуса:
• Если корпус 1 и корпус 2 одного проекта имеют РАЗНЫЕ адреса (разные номера дома/строения)
  или разные кадастровые номера — это ОТДЕЛЬНЫЕ самостоятельные объекты, создай отдельную
  запись для каждого корпуса. НЕ объединяй их в один объект с sub_buildings.
• Пример: «корп. 1, ул. Нобеля д.7» и «корп. 2, ул. Нобеля д.5» — два разных объекта.

Поля каждого объекта:
- id: b1, b2, b3…
- name: официальное наименование (комплекса или отдельного здания)
- address: адрес или null
- floors: число этажей или null
- areaSqm: площадь ПОЛ здания/строений (м²) — только пол, НЕ территория/участок.
  Для отдельного здания: из фразы «общей площадью … кв.м».
  Для комплекса с перечнем строений: СУММА площадей строений.
  null если площадь пола в тексте не найдена.
- territoryAreaSqm: площадь территории/земельного участка (м²) если явно упомянута
  (пример: «земельный участок … общей площадью 129012»). null для обычных зданий.
- year_built: год или null
- purpose: назначение (одна фраза)
- needsReview: true если areaSqm не найдена в тексте или объект требует ручной проверки
- sub_buildings: [] или список названий составных строений

Если в этом фрагменте нет новых самостоятельных объектов — верни [].
Верни ТОЛЬКО JSON-массив без markdown.

Пример:
${SCHEMA_EXAMPLE}

ФРАГМЕНТ ТЗ:
${text}`

// Промпт консолидации — второй проход
const CONSOLIDATE_PROMPT = (candidates, context) => `Ты — эксперт по технической эксплуатации объектов (Facility Management).

Из разных фрагментов ТЗ извлечены КАНДИДАТЫ объектов (некоторые могут дублироваться или
быть подмножеством другого объекта):

${JSON.stringify(candidates, null, 2)}

ЗАДАЧА — финальная структуризация:

1. ОБЪЕДИНИ дубли одного объекта (разные названия одного здания в разных частях ТЗ).
   Выбирай наиболее полное официальное название.

2. ПРОВЕРЬ ИЕРАРХИЮ: если кандидат является составной частью другого кандидата-комплекса —
   перенеси его в sub_buildings родительского объекта, не оставляй отдельной записью.
   Пример: "Коттедж №1", "АХК №1", "Баня" → sub_buildings Усадьбы.
   ИСКЛЮЧЕНИЕ: корпус 1 и корпус 2 одного проекта с РАЗНЫМИ адресами (разные номера дома) —
   оставь их как ОТДЕЛЬНЫЕ объекты верхнего уровня, НЕ объединяй в один с sub_buildings.

3. ДОПОЛНИ пустые поля (address, floors, areaSqm, territoryAreaSqm, year_built, sub_buildings) из контекста ниже.

КРИТИЧНО для комплексов (Усадьба, кампус, бизнес-парк и т.п.):
- areaSqm = СУММА площадей строений из перечня (АХК, коттеджи, баня и т.д.).
  НИКОГДА не ставить в areaSqm площадь земельного участка/территории.
- territoryAreaSqm = площадь участка (пример: «земельный участок … 129012 кв.м»).
- needsReview = true для комплексов с разрозненными строениями (проверить рассредоточенность).
- Если areaSqm не найдена ни в одном фрагменте — оставить null и needsReview: true.

4. Переназначь id по порядку: b1, b2, b3…

Верни ТОЛЬКО итоговый JSON-массив без markdown и пояснений. Схема:
${SCHEMA_EXAMPLE}

КОНТЕКСТ (начало документа ТЗ):
${context}`

// ── Address-based dedup (детерминированный, после консолидации модели) ──────
// Модель иногда «разводит» один объект на два (ЦДМ ↔ «Нежилое здание на ул. Луговая»).
// Адрес — надёжный ключ идентичности: улица + дом + корпус/строение.
// Нормализуем и мержим записи с одинаковым ключом кодом, не доверяя модели.
export function normalizeAddressKey(address) {
  if (typeof address !== 'string') return null
  const s = address.toLowerCase().replace(/ё/g, 'е')
  const street = s.match(/(?:ул(?:ица)?|пр(?:оспект|-кт)?|пер(?:еулок)?|ш(?:оссе)?|наб(?:ережная)?|б(?:ульвар|-р)?)\.?\s*([а-я\d\s-]+?)(?=,|$|\s+д\b|\s+дом\b)/)
  const house = s.match(/(?:д|дом)\.?\s*(\d+[а-я]?)/)
  const korpus = s.match(/(?:корп(?:ус)?|к|стр(?:оение)?|с)\.?\s*(\d+[а-я]?)/)
  if (!street || !house) return null
  const key = [street[1].replace(/[\s-]+/g, ''), house[1], korpus ? korpus[1] : '']
  return key.join('|')
}

function mergeBuildingPair(a, b) {
  // Более информативная запись — база; всё непустое из второй — доливаем.
  const score = x => [x.areaSqm, x.address, x.floors, x.year_built, x.purpose]
    .filter(v => v !== null && v !== undefined).length
  const [base, extra] = score(b) > score(a) ? [b, a] : [a, b]
  const merged = { ...base }
  for (const k of ['address', 'floors', 'areaSqm', 'territoryAreaSqm', 'year_built', 'purpose']) {
    if (merged[k] === null || merged[k] === undefined) merged[k] = extra[k] ?? null
  }
  // Более полное официальное название (длиннее — обычно полнее)
  if (typeof extra.name === 'string' && extra.name.length > (merged.name?.length ?? 0)) {
    merged.name = extra.name
  }
  const subs = [...(Array.isArray(base.sub_buildings) ? base.sub_buildings : []),
                ...(Array.isArray(extra.sub_buildings) ? extra.sub_buildings : [])]
  merged.sub_buildings = [...new Set(subs)]
  // Конфликт площадей двух источников — на ручную проверку
  if (typeof a.areaSqm === 'number' && typeof b.areaSqm === 'number' && a.areaSqm !== b.areaSqm) {
    merged.needsReview = true
  }
  return merged
}

export function dedupBuildingsByAddress(buildings) {
  const byKey = new Map()
  const out = []
  for (const b of buildings) {
    const key = normalizeAddressKey(b.address)
    if (key === null) { out.push(b); continue }
    if (byKey.has(key)) {
      const idx = out.indexOf(byKey.get(key))
      const merged = mergeBuildingPair(out[idx], b)
      out[idx] = merged
      byKey.set(key, merged)
    } else {
      byKey.set(key, b)
      out.push(b)
    }
  }
  return out
}

// ── Sub-building area parser ─────────────────────────────────────────────────
// Extracts floor area (кв.м) from sub_building name strings like
// "АХК 1 (3 эт., 2123,2 кв.м, кад. №...)" → 2123.2
function parseSubBuildingArea(name) {
  const m = name.match(/(\d[\d\s ]*(?:[.,]\d+)?)\s*кв\.?\s*м/i)
  if (!m) return null
  const val = parseFloat(m[1].replace(/[\s ]/g, '').replace(',', '.'))
  return isFinite(val) && val > 0 ? Math.round(val * 10) / 10 : null
}

// ── shared helpers ────────────────────────────────────────────────────────────
function splitChunk(chunk, maxSize) {
  if (chunk.length <= maxSize) return [chunk]
  // TODO: add char-level fallback for lines > maxSize (e.g. dense table rows without \n)
  const parts = []
  let cur = ''
  for (const line of chunk.split('\n')) {
    const sep = cur ? '\n' : ''
    if (cur.length + sep.length + line.length > maxSize && cur.length > 0) {
      parts.push(cur)
      // carry last paragraph into next piece so equipment descriptions aren't cut at boundary
      const lastPara = cur.lastIndexOf('\n\n')
      const tail = lastPara >= 0 ? cur.slice(lastPara + 2) : cur.slice(-400)
      cur = (tail.trim() ? tail + '\n' : '') + line
    } else {
      cur += sep + line
    }
  }
  if (cur.trim()) parts.push(cur)
  return parts.length > 0 ? parts : [chunk]
}

function makeBatches(chunks, batchSize) {
  const batches = []
  let cur = ''
  for (const c of chunks) {
    for (const piece of splitChunk(c, batchSize)) {
      if (cur.length + piece.length > batchSize && cur.length > 0) {
        batches.push(cur); cur = piece
      } else {
        cur += (cur ? '\n\n---\n\n' : '') + piece
      }
    }
  }
  if (cur) batches.push(cur)
  return batches
}

/**
 * Этап 1: двухпроходная схема.
 * Проход 1 — батчи по 80к символов: собираем кандидатов.
 * Проход 2 — консолидация + дедупликация + обогащение через Claude.
 * onProgress(pct, batch, total) — коллбэк прогресса.
 */
export async function runStage1(chunks, onProgress) {
  const BATCH_SIZE = 80_000

  // ── Проход 1: собираем кандидатов ───────────────────────────────────────
  const batches = makeBatches(chunks, BATCH_SIZE)

  // +1 за консолидационный шаг
  const totalSteps = batches.length + 1
  const candidates = []

  for (let i = 0; i < batches.length; i++) {
    onProgress?.(Math.round((i / totalSteps) * 100), i + 1, totalSteps)
    let parsed = []
    try {
      const raw = await callClaude(EXTRACT_PROMPT(batches[i]), 2048)
      parsed = JSON.parse(raw)
    } catch { /* пропускаем плохой батч */ }
    for (const b of parsed) {
      if (b.name) candidates.push(b)
    }
  }

  // ── Проход 2: консолидация ───────────────────────────────────────────────
  onProgress?.(Math.round((batches.length / totalSteps) * 100), batches.length + 1, totalSteps)

  // Контекст для консолидации — первые 30к символов (обычно там общее описание объектов)
  const context = chunks.slice(0, 5).join('\n\n---\n\n').slice(0, 30_000)

  let buildings = candidates
  if (candidates.length > 0) {
    try {
      const raw = await callClaude(CONSOLIDATE_PROMPT(candidates, context), 3000)
      buildings = JSON.parse(raw)
    } catch { /* оставляем кандидатов как есть */ }
  }

  // Страховка кодом: модель не имеет права держать два объекта на одном адресе
  buildings = dedupBuildingsByAddress(buildings)

  onProgress?.(100, totalSteps, totalSteps)

  return buildings.map((b, i) => {
    const sub_buildings = Array.isArray(b.sub_buildings)
      ? b.sub_buildings.filter(s => typeof s === 'string' && s.trim())
      : []

    // For complexes with ≥4 sub-buildings, compute areaSqm by parsing individual
    // structure areas from the names extracted by the AI (provenance: tz).
    // This avoids the model mis-summing (e.g. Усадьба: model returned ~6 089 instead of ~8 500).
    // Threshold ≥4 prevents mistakenly summing ancillary items like "КПП (4 кв.м)".
    let areaSqm = typeof b.areaSqm === 'number' ? b.areaSqm
                  : typeof b.area_m2 === 'number' ? b.area_m2 : null
    let areaSqmComponents = null

    if (sub_buildings.length >= 4) {
      const parsed = sub_buildings
        .map(s => ({ name: s, area: parseSubBuildingArea(s) }))
        .filter(x => x.area !== null)
      if (parsed.length >= 3) {
        areaSqm = Math.round(parsed.reduce((s, x) => s + x.area, 0) * 10) / 10
        areaSqmComponents = parsed
      }
    }

    return {
      id: `b${i + 1}`,
      name: b.name ?? 'Объект без названия',
      address: b.address ?? null,
      floors: typeof b.floors === 'number' ? b.floors : null,
      areaSqm,
      areaSqmComponents,
      territoryAreaSqm: typeof b.territoryAreaSqm === 'number' ? b.territoryAreaSqm : null,
      year_built: typeof b.year_built === 'number' ? b.year_built : null,
      purpose: b.purpose ?? null,
      needsReview: !!b.needsReview,
      sub_buildings,
    }
  })
}

// ── Stage 2: инженерные системы ───────────────────────────────────────────────

const VALID_CATEGORIES = new Set([
  'heating', 'hvac', 'plumbing', 'electrical', 'fire',
  'security', 'lowcurrent', 'media', 'bms', 'elevator', 'structural', 'other',
])

const SYSTEMS_SCHEMA = `[
  {
    "buildingId": "b1",
    "systems": [
      {
        "id": "b1-hvac-1",
        "category": "hvac",
        "name": "Система вентиляции и кондиционирования",
        "scope": "building",
        "subBuildingId": null,
        "basisNorms": ["СП 60.13330"],
        "notes": "Центральная, 3 зоны",
        "needsReview": false,
        "equipment": [
          {
            "id": "b1-hvac-1-eq-1",
            "name": "Приточная установка",
            "tag": "ПУ-1",
            "class": "air_handling_unit",
            "brand": "Lessar",
            "model": "LV-100",
            "qty": 1,
            "capacity": "5000 м³/ч",
            "location": "венткамера, 2 эт.",
            "confidence": "high"
          },
          {
            "id": "b1-hvac-1-eq-2",
            "name": "Чиллер",
            "tag": null,
            "class": "chiller",
            "brand": "York",
            "model": "YK",
            "qty": 2,
            "capacity": null,
            "location": "кровля",
            "confidence": "medium"
          }
        ]
      }
    ]
  }
]`

const EXTRACT_SYSTEMS_PROMPT = (buildings, text) => `Ты — эксперт по технической эксплуатации зданий (Facility Management).

Тебе предоставлен ФРАГМЕНТ технического задания на обслуживание объектов.

ИЗВЕСТНЫЕ ОБЪЕКТЫ (из Этапа 1):
${buildings.map(b => `• ${b.id}: ${b.name}${b.address ? ', ' + b.address : ''}${b.sub_buildings?.length ? ' [строения: ' + b.sub_buildings.join(', ') + ']' : ''}`).join('\n')}

ЗАДАЧА: найди в фрагменте ИНЖЕНЕРНЫЕ СИСТЕМЫ и ОБОРУДОВАНИЕ, относящиеся к этим объектам.
Верни JSON-массив — по одной записи на объект, в котором найдено хоть что-то.

КАТЕГОРИИ (category):
heating — теплоснабжение, ИТП, тепловые пункты, котельные
hvac — вентиляция, кондиционирование, холодоснабжение, фанкойлы
plumbing — водоснабжение, канализация, ХВС, ГВС, водоотведение
electrical — электроснабжение, ВРУ, трансформаторные подстанции, щиты освещения
fire — АПС, пожаротушение (АУПТ), СОУЭ, противодымная защита
security — охранная сигнализация, СКУД, видеонаблюдение
lowcurrent — ЛВС, СКС, структурированная кабельная сеть, АТС, телефония, АВК
media — аудио/видео, конференц-системы, цифровые вывески
bms — диспетчеризация, BMS, АСУД, АСУ ТП, щиты автоматики
elevator — лифты, подъёмники, эскалаторы
structural — кровля, фасад, окна, полы, несущие конструкции, благоустройство
other — всё что не вошло выше

ПОЛЯ:
scope: "building" (система для всего объекта) | "sub_building" (для одного из строений комплекса)
subBuildingId: название строения из списка sub_buildings или null
needsReview: true если данные неполные, противоречивые или неясно какому объекту принадлежит система
confidence у оборудования: "high" (есть марка/модель/позиция), "medium" (только тип), "low" (упомянуто вскользь)
qty: обязательно число, минимум 1

ПРАВИЛА:
• Если система явно не привязана к конкретному объекту — относи к единственному/основному объекту.
• Для комплексов (scope=sub_building) указывай subBuildingId = название строения из sub_buildings.
• НЕ придумывай характеристики — ставь null, если данных нет.
• Если в фрагменте нет систем — верни [].
• Верни ТОЛЬКО JSON-массив без markdown.

Пример:
${SYSTEMS_SCHEMA}

ФРАГМЕНТ ТЗ:
${text}`

const CONSOLIDATE_SYSTEMS_PROMPT = (rawSystems, buildings, context) => `Ты — эксперт по технической эксплуатации объектов (Facility Management).

Из разных фрагментов ТЗ извлечены СЫРЫЕ данные об инженерных системах (могут содержать дубли и пропущенные поля):

${JSON.stringify(rawSystems, null, 2)}

ОБЪЕКТЫ для справки:
${buildings.map(b => `• ${b.id}: ${b.name}${b.sub_buildings?.length ? ' [строения: ' + b.sub_buildings.join(', ') + ']' : ''}`).join('\n')}

ЗАДАЧА — финальная структуризация:
1. Для каждого buildingId: объедини дублирующиеся системы одной категории в одну
2. Если одна система упомянута в нескольких фрагментах — объедини данные, выбирая наиболее полные поля
3. Для оборудования: если одна позиция встречается дважды — один объект с qty=сумма
4. Дополни пустые поля (brand, model, capacity, location, basisNorms) из контекста ниже
5. needsReview=true если хоть в одном экземпляре было true или остались неясности
6. Переназначь id: {buildingId}-{category}-{N} для систем, {sysId}-eq-{M} для оборудования

Верни ТОЛЬКО итоговый JSON-массив без markdown. Та же схема:
${SYSTEMS_SCHEMA}

КОНТЕКСТ (начало документа ТЗ):
${context}`

function normalizeSystemsResult(rawData, buildings) {
  // Group by buildingId
  const byBuilding = {}
  for (const b of buildings) byBuilding[b.id] = []

  for (const entry of (Array.isArray(rawData) ? rawData : [])) {
    const bId = entry.buildingId
    if (!bId) continue
    if (!byBuilding[bId]) byBuilding[bId] = []
    if (Array.isArray(entry.systems)) byBuilding[bId].push(...entry.systems)
  }

  return buildings.map(b => {
    const systems = (byBuilding[b.id] || []).map((sys, si) => {
      const cat = VALID_CATEGORIES.has(sys.category) ? sys.category : 'other'
      const sysId = `${b.id}-${cat}-${si + 1}`
      return {
        id: sysId,
        category: cat,
        name: sys.name ?? 'Система без названия',
        scope: sys.scope === 'sub_building' ? 'sub_building' : 'building',
        subBuildingId: sys.subBuildingId ?? null,
        basisNorms: Array.isArray(sys.basisNorms) ? sys.basisNorms.filter(Boolean) : [],
        notes: sys.notes ?? null,
        needsReview: !!sys.needsReview,
        equipment: Array.isArray(sys.equipment)
          ? sys.equipment.map((eq, ei) => ({
              id: `${sysId}-eq-${ei + 1}`,
              name: eq.name ?? 'Оборудование',
              tag: eq.tag ?? null,
              class: eq.class ?? 'other',
              brand: eq.brand ?? null,
              model: eq.model ?? null,
              qty: typeof eq.qty === 'number' && eq.qty > 0 ? Math.round(eq.qty) : 1,
              capacity: eq.capacity ?? null,
              location: eq.location ?? null,
              confidence: ['high', 'medium', 'low'].includes(eq.confidence) ? eq.confidence : 'medium',
              missing: Array.isArray(eq.missing) ? eq.missing : [],
              source: ['tz', 'user', 'web'].includes(eq.source) ? eq.source : 'tz',
              unmatched: !!eq.unmatched,
            }))
          : [],
      }
    })
    return { buildingId: b.id, systems }
  })
}

const S2_BATCH_SIZE = 8_000
const S2_MAX_TOKENS = 16_000
export const S2_CONSOLIDATE_MAX_TOKENS = 12_000

async function extractWithBisect(buildings, text, depth = 4, log = () => {}) {
  try {
    const raw = await callClaude(EXTRACT_SYSTEMS_PROMPT(buildings, text), S2_MAX_TOKENS)
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('NOT_ARRAY')
    return parsed
  } catch (err) {
    if (depth === 0 || text.length < 200) {
      if (text.trim()) {
        const warn = `[bisect WARNING] dropping ${text.length} chars, depth exhausted — ${err.message}`
        console.warn(warn)
        log(warn)
      }
      log(`[bisect] min reached (${text.length} chars), 0 entries`)
      return []
    }
    const reason = err.code === 'TRUNCATED' ? 'max_tokens' : err.message.slice(0, 50)
    const mid = Math.floor(text.length / 2)
    const cut = (text.indexOf('\n', mid) + 1) || mid
    log(`[bisect depth=${depth}] ${text.length} chars → ${cut} + ${text.length - cut} (${reason})`)
    const [left, right] = await Promise.all([
      extractWithBisect(buildings, text.slice(0, cut), depth - 1, log),
      extractWithBisect(buildings, text.slice(cut), depth - 1, log),
    ])
    return [...left, ...right]
  }
}

/**
 * Этап 2: двухпроходная схема — инженерные системы.
 * Проход 1 — батчи S2_BATCH_SIZE с бисекцией при обрыве: собираем сырые системы.
 * Проход 2 — консолидация, дедупликация, обогащение.
 * onProgress(pct, batch, total)
 */
async function _runStage2Legacy(buildings, chunks, onProgress, {
  onBatchComplete = null,
  initialRaw = [],
  startIndex = 0,
  maxBatches = Infinity,
} = {}) {
  const batches = makeBatches(chunks, S2_BATCH_SIZE)
  const totalSteps = batches.length + 1
  const rawResults = [...initialRaw]
  const endIndex = Math.min(startIndex + maxBatches, batches.length)

  for (let i = startIndex; i < endIndex; i++) {
    onProgress?.(Math.round((i / totalSteps) * 100), i + 1, totalSteps)
    const log = msg => console.log(`  s2b${i + 1}/${batches.length}: ${msg}`)
    const results = await extractWithBisect(buildings, batches[i], 4, log)
    rawResults.push(...results)
    onBatchComplete?.(i, rawResults, batches.length)
  }

  if (endIndex < batches.length) {
    onProgress?.(Math.round((endIndex / totalSteps) * 100), endIndex + 1, totalSteps)
    return normalizeSystemsResult(rawResults, buildings)
  }

  onProgress?.(Math.round((batches.length / totalSteps) * 100), batches.length + 1, totalSteps)

  const context = chunks.slice(0, 5).join('\n\n---\n\n').slice(0, 30_000)
  let finalData = rawResults

  if (rawResults.length > 0) {
    try {
      const raw = await callClaude(CONSOLIDATE_SYSTEMS_PROMPT(rawResults, buildings, context), S2_CONSOLIDATE_MAX_TOKENS)
      finalData = JSON.parse(raw)
    } catch { /* оставляем сырые данные */ }
  }

  onProgress?.(100, totalSteps, totalSteps)
  return normalizeSystemsResult(finalData, buildings)
}

// ── Spine-first extraction ─────────────────────────────────────────────────────

export function parseApp2Table(html) {
  const tables = html.match(/<table[\s\S]*?<\/table>/g) || []
  const tbl = tables.find(t =>
    t.includes('сновные технические') &&
    (t.match(/<tr/g) || []).length > 100
  )
  if (!tbl) return []

  const rows = (tbl.match(/<tr[\s\S]*?<\/tr>/g) || [])
    .map(r =>
      (r.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g) || [])
        .map(c => c.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    )

  const sections = []
  let cur = null

  for (const cells of rows.slice(4)) {
    const name = cells[0] || ''
    if (!name) continue
    const isHeader = cells.slice(2, 7).every(c => !c || /^[-—\s]*$/.test(c))
    if (isHeader && name.length > 3) {
      if (/^(Система|Лифт|ЦТП|ИТП|Теплоснабж|Котел)/i.test(name)) {
        cur = { sectionTitle: name, rows: [] }
        sections.push(cur)
      }
      continue
    }
    if (!cur) continue
    cur.rows.push({
      name, unit: cells[1] || '',
      byBuilding: {
        km1: cells[2] || '', km2: cells[3] || '', hyp: cells[4] || '',
        usa: cells[5] || '', nez: cells[6] || '', itogo: cells[7] || '',
      },
    })
  }
  return sections
}

export function getBuildingApp2Key(building) {
  const n = (building.name + ' ' + (building.address ?? '')).toLowerCase()
  if (/гиперкуб/.test(n)) return 'hyp'
  if (/усадьб/.test(n)) return 'usa'
  if (/нежил/.test(n)) return 'nez'
  if (/менделеев/.test(n) && /корп.*2|2.*корп/.test(n)) return 'km2'
  if (/менделеев/.test(n)) return 'km1'
  return null
}

function classifyRowToCategory(name) {
  const n = name.toLowerCase()
  if (/лифт|эскалатор|подъёмник|подъемник/.test(n)) return 'elevator'
  if (/\bлвс\b|лвс и|лвс.*скс|скс.*порт|количество.*порт/.test(n)) return 'lowcurrent'
  if (/акустич|сабвуфер|усилитель.*\d+.*вт|усилитель.*w|микрофон|blu.?ray|dvd|плеер|медиа.*плеер|медиафасад|бегущ.*строк|traxon|digico|синхроперевод|микшер|сцени.*свет|сцени.*монитор|iptv|проектор|плазм|экран.*электроприв/.test(n)) return 'media'
  if (/котел|тепловой насос|геотерм|геозонд|тепловая завеса|тепловой пункт|\bитп\b|радиатор|конвектор|солнечн.*батар/.test(n)) return 'heating'
  if (/вентиля|кондиц|приточн|вытяжн|фанкойл|охлаждающ|воздуховод|рекуператор/.test(n)) return 'hvac'
  if (/пожар|огнетуш|дымоудален|аупт|стрелец|рспи|извещател|громкоговор|оповещ/.test(n)) return 'fire'
  if (/видеокамер|скуд|считыватель|sipass|ade\d|ars\d|магнитоконтакт|st-ex|st-dm/.test(n)) return 'security'
  if (/\bвру\b|грщ|\bщит\b|щиты|светильник|освещен|ибп|eaton|меркурий/.test(n)) return 'electrical'
  if (/водоснабж|водоотвед|канализ|водопровод|ливнеотвод|санитарно|трубопровод|водонагрев|насос.*цирк|расширит.*бак|гидроаккум/.test(n)) return 'plumbing'
  if (/диспетчер|bms|асуд|автоматик.*инженер/.test(n)) return 'bms'
  if (/кровл|фасад|остеклен|напольн/.test(n)) return 'structural'
  return null
}

export function classifyApp2Evidence(rows) {
  const evidence = {}
  for (const row of rows) {
    const cat = classifyRowToCategory(row.name)
    if (!cat) continue
    if (!evidence[cat]) evidence[cat] = []
    evidence[cat].push({ name: row.name, qty: row.qty })
  }
  return evidence
}

function getChunksForBuilding(building, chunks) {
  const clean = building.name.replace(/[«»""]/g, '').toLowerCase()
  const words = clean.split(/\s+/).filter(w => w.length > 4)
  const hits = chunks.filter(c => words.some(w => c.toLowerCase().includes(w)))
  const prose = hits.length >= 2 ? hits.slice(0, 10) : chunks.slice(0, 5)
  return prose
}

const SPINE_CATEGORIES_LIST = [
  'heating — теплоснабжение, ИТП, котлы, тепловые пункты',
  'hvac — вентиляция, кондиционирование, холодоснабжение, чиллеры, фанкойлы',
  'plumbing — водоснабжение (ХВС, ГВС), канализация, водоотведение',
  'electrical — электроснабжение, ГРЩ/ВРУ, трансформаторы, освещение, ИБП',
  'fire — АПС, пожаротушение (АУПТ), СОУЭ, пожарные краны, противодымная защита',
  'security — охранная сигнализация, СКУД, видеонаблюдение',
  'lowcurrent — ЛВС/СКС, АТС, телефония, радиофикация',
  'media — аудио/видео, конференц-системы, вывески, IPTV',
  'bms — диспетчеризация, BMS, АСУД, АСУ ТП, автоматика инженерных систем',
  'elevator — лифты, подъёмники, эскалаторы',
  'structural — кровля, фасад, окна, полы, несущие конструкции, благоустройство',
  'other — всё что не входит в перечисленные выше',
].join('\n')

// TODO(dual-source-spine): спайн сейчас строится только по прозе ТЗ.
// classifyApp2Evidence / classifyRowToCategory уже реализованы и дают 10 категорий
// из Прил.2 для Гиперкуба (lowcurrent, media, bms etc.), но evidenceStr не подаётся
// в extractSpineForBuilding — оттого эти категории пропадают если их нет в прозе.
// Правильный фикс: добавить evidenceStr в SPINE_EXTRACT_PROMPT с dual-source rule
// (система входит в спайн если в прозе ИЛИ в Прил.2 с qty≥1), ставить needsReview:true
// для систем только из Прил.2. Тогда lowcurrent/media/bms войдут в спайн.
const SPINE_EXTRACT_PROMPT = (building, proseText) => `Ты — эксперт по технической эксплуатации зданий.

ЗДАНИЕ: ${building.name}${building.address ? ', ' + building.address : ''}${building.sub_buildings?.length ? '\nСТРОЕНИЯ: ' + building.sub_buildings.join(', ') : ''}

КАТЕГОРИИ СИСТЕМ:
${SPINE_CATEGORIES_LIST}

ВАЖНО: для каждой КАТЕГОРИИ верни ровно ОДНУ запись — даже если несколько контуров.
Включай категорию только если она явно упомянута в тексте ТЗ.
Используй общее название без номеров корпусов.

Поля:
• category — один из кодов выше
• name — официальное название из текста
• scope — "building" или "sub_building"
• subBuildingId — название строения из списка СТРОЕНИЯ или null
• needsReview — false (оставить поле для совместимости)

Верни ТОЛЬКО JSON-массив без markdown. Пример:
[{"category":"electrical","name":"Система электроснабжения","scope":"building","subBuildingId":null,"needsReview":false}]

ФРАГМЕНТ ТЗ:
${proseText}`

async function extractSpineForBuilding(building, proseText) {
  try {
    const raw = await callClaude(SPINE_EXTRACT_PROMPT(building, proseText), 4096)
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

const SPINE_ATTACH_PROMPT = (spine, rows) => `Ты — эксперт по технической эксплуатации зданий.

СИСТЕМЫ ЗДАНИЯ (спайн):
${spine.map((s, i) => `${i + 1}. [${s.category}] ${s.name}`).join('\n')}

ОБОРУДОВАНИЕ ИЗ ПЕРЕЧНЯ (Приложение 2), по данному зданию:
${rows.map(r => `- "${r.name}" | ${r.unit} | qty=${r.qty}`).join('\n')}

ЗАДАЧА: для каждой строки оборудования определи:
1. К какой системе из спайна относится (по category)
2. Бренд и модель из названия (если есть явный производитель)
3. Если ни одна система не подходит → unmatched: true

ПРАВИЛО: НЕ создавай новых систем. Только прикрепляй к существующим.

Верни JSON-массив — по одной записи на категорию из спайна (даже если equipment пуст).
Формат:
[{"category":"electrical","equipment":[{"name":"ВРУ","brand":null,"model":null,"qty":1,"unit":"шт.","class":"distribution_panel","confidence":"high","unmatched":false}]}]

ТОЛЬКО JSON без markdown.`

async function attachApp2Equipment(spine, rows) {
  if (!rows.length) return spine.map(s => ({ ...s, equipment: [] }))
  try {
    const numbered = rows
      .map(r => ({ name: r.name, unit: r.unit, qty: parseFloat(String(r.qty)) || 0 }))
      .filter(r => r.qty > 0 && r.name)
    if (!numbered.length) return spine.map(s => ({ ...s, equipment: [] }))

    const raw = await callClaude(SPINE_ATTACH_PROMPT(spine, numbered), 16_000)
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('NOT_ARRAY')

    return spine.map(s => {
      const found = parsed.find(p => p.category === s.category)
      return { ...s, equipment: Array.isArray(found?.equipment) ? found.equipment : [] }
    })
  } catch {
    return spine.map(s => ({ ...s, equipment: [] }))
  }
}

export async function runStage2(buildings, chunks, onProgress, {
  htmlContent = null,
  onBatchComplete = null,
  initialRaw = [],
  startIndex = 0,
  maxBatches = Infinity,
} = {}) {
  if (!htmlContent) {
    return _runStage2Legacy(buildings, chunks, onProgress,
      { onBatchComplete, initialRaw, startIndex, maxBatches })
  }

  const sections = parseApp2Table(htmlContent)
  const results = []

  for (const building of buildings) {
    const colKey = getBuildingApp2Key(building)
    if (!colKey) {
      console.warn(`[spine] нет mapping для "${building.name}", пропуск`)
      continue
    }

    const proseChunks = getChunksForBuilding(building, chunks)
    const prose = proseChunks.join('\n\n').slice(0, 20_000)

    const app2Rows = sections.flatMap(s =>
      s.rows
        .filter(r => /\d/.test(r.byBuilding[colKey] ?? ''))
        .map(r => ({ name: r.name, unit: r.unit, qty: r.byBuilding[colKey] }))
    )
    console.log(`[spine] ${building.name}: ${proseChunks.length} чанков, ${app2Rows.length} Прил.2 строк`)

    const spine = await extractSpineForBuilding(building, prose)
    console.log(`[spine] ${building.name}: ${spine.length} систем`)

    const systems = await attachApp2Equipment(spine, app2Rows)
    results.push({ buildingId: building.id, systems })
    onProgress?.((results.length / buildings.length * 100) | 0, results.length, buildings.length)
  }

  onProgress?.(100, buildings.length, buildings.length)
  return normalizeSystemsResult(results, buildings)
}

// ── STAGE 3: Schedule (ЭК/ТО) extraction ────────────────────────────────────
// Reads the annual maintenance schedule tables from the TZ HTML.
// All parsing is deterministic (no model calls).

const SCHED_MONTHS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']
const SCHED_CROSS  = /^[хxХ×✓+]$/i
const SCHED_YEAR   = /\b(19|20)\d{2}\s*г\.?/

const PERIODICITY_NORMS = [
  [/ежесменно|каждую?\s*смен/i,                                  'ежесменно'],
  [/ежедневно|каждый\s*день/i,                                   'ежедневно'],
  [/еженедельно|1[\s/]*раз[а-я]*\s*[/в]?\s*нед|1\/неделю/i,    'еженедельно'],
  [/1\s*раз[а-я]*\s*[/в]?\s*2\s*нед/i,                         '1р/2нед'],
  [/1\s*раз[а-я]*\s*[/в]?\s*2\s*дн/i,                          '1р/2дня'],
  [/ежемесячно|1[\s/]*раз[а-я]*\s*[/в]?\s*мес|1\/мес/i,        'ежемесячно'],
  [/ежеквартально|1\s*раз[а-я]*\s*[/в]?\s*кварт/i,             'ежеквартально'],
  [/4\s*раза?\s*(?:в\/?|\/в?|\/?)?\s*год/i,                     '4р/год'],
  [/3\s*раза?\s*[/в]?\s*год/i,                                  '3р/год'],
  [/2\s*раза?\s*[/в]?\s*год/i,                                  '2р/год'],
  [/1\s*раз[а-я]*\s*[/в]?\s*полгода|1\s*раз[а-я]*\s*[/в]?\s*6\s*мес/i, '1р/6мес'],
  [/1\s*раз[а-я]*\s*[/в]?\s*3[.,]5\s*г/i,                      '1р/3.5года'],
  [/не\s*реже\s*1\s*раза?\s*в\s*3\s*г/i,                       '1р/3года'],
  [/1\s*раз[а-я]*\s*[/в]?\s*3\s*г/i,                           '1р/3года'],
  [/1\s*раз[а-я]*\s*[/в]?\s*2\s*г/i,                           '1р/2года'],
  [/1\s*ра[а-я]*\s*[/в]?\s*5\s*лет/i,                          '1р/5лет'],
  [/ежегодно|1[\s/]*раз[а-я]*\s*[/в]?\s*год|1\/год|раз\s+в\s+год/i, '1р/год'],
]

function normalizeSchedPeriodicity(raw) {
  if (!raw) return 'не указано'
  const s = raw.trim()
  for (const [pat, norm] of PERIODICITY_NORMS) {
    if (pat.test(s)) return norm
  }
  return s
}

const SCHED_SECTION_CATS = [
  [/лифт|подъём|подъем|эскалатор/,                                     'elevator'],
  [/медиа|мультимедиа|аудио.*видео|конференц.*сист/,                    'media'],
  [/скс|лвс|сети\s+связи|авк|пассивн.*актив.*оборуд|активн.*оборуд/,     'lowcurrent'],
  [/автомат|диспетч|\bbms\b|асуд|оздс/,                                 'bms'],
  [/противодымн|дымоудален/,                                             'fire'],
  [/охранн|скуд|видеонаблюд|итсо|доступ/,                              'security'],
  [/пожарн|противопожарн|пожаротуш/,                                    'fire'],
  [/холодоснабж/,                                                        'hvac'],
  [/вентиляц|кондиц|фанкойл/,                                           'hvac'],
  [/теплоснабж|отоплен/,                                                 'heating'],
  [/водоснабж|водоотвед|канализ|дренаж/,                                'plumbing'],
  [/электроснабж|электроосвещ|освещен/,                                  'electrical'],
  [/строительн|кровл|фасад|конструктив|остеклен|ферм|балк|атриум|цокольн|лестниц|балкон|перил|газон|напольн|ступен|ограждени|двер|окон|несущ/, 'structural'],
  [/прочее\s+оборудован/,                                               'other'],
]

function classifyScheduleSection(name) {
  const n = name.toLowerCase()
  for (const [pat, cat] of SCHED_SECTION_CATS) {
    if (pat.test(n)) return cat
  }
  return null
}

const EK_KW = /проверк|осмотр|контрол|измер|испытан|тестир|освидетельств|мониторин|диагностик/
const TO_KW = /очист|замен|промывк|протяжк|смазк|ремонт|дозаправк|уборк|регулировк|заправк/

function classifySchedOpMode(text, tableMode) {
  const t = text.toLowerCase()
  const isEK = EK_KW.test(t)
  const isTO = TO_KW.test(t)
  if (isEK && !isTO) return { mode: 'EK', needsReview: false }
  if (isTO && !isEK) return { mode: 'TO', needsReview: false }
  if (!isEK && !isTO) return { mode: tableMode, needsReview: false }
  return { mode: tableMode, needsReview: true }
}

function detectSchedBuilding(textBefore, row0col0) {
  // Check header row first (most reliable), then last 200 chars of context
  for (const src of [row0col0 ?? '', textBefore.slice(-200)]) {
    const s = src.toLowerCase()
    if (/гиперкуб/.test(s)) return 'hyp'
    if (/усадьба/.test(s)) return 'usa'
    if (/цдм/.test(s)) return 'nez'
    // Check корп 2 BEFORE generic квартал/менделеева to avoid false km1
    if (/корп[а-яё.]*\.?\s*2\b/.test(s)) return 'km2'
    if (/квартал|менделеева|корп[а-яё.]*\.?\s*1\b/.test(s)) return 'km1'
  }
  return null
}

function detectSchedMode(textBefore) {
  if (/эксплуатационного\s+контроля/i.test(textBefore)) return 'EK'
  if (/технического\s+обслуживания/i.test(textBefore)) return 'TO'
  return null
}

// Lightweight check: count tables that look like ЭК/ТО schedule tables.
// Conservative — only returns found:true when ≥2 qualifying tables exist.
export function detectSchedule(html) {
  const allTables = html.match(/<table[\s\S]*?<\/table>/g) || []
  let count = 0
  for (const tbl of allTables) {
    const rows = (tbl.match(/<tr[\s\S]*?<\/tr>/g) || [])
      .map(r => (r.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g) || [])
        .map(c => c.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()))
    if (rows.length < 10) continue
    for (let ri = 0; ri < Math.min(3, rows.length); ri++) {
      const joined = rows[ri].join(' ').toLowerCase()
      if (SCHED_MONTHS.filter(m => joined.includes(m)).length >= 6) { count++; break }
    }
  }
  return { found: count >= 2, tableCount: count }
}

export function parseScheduleTables(html) {
  const allTables = html.match(/<table[\s\S]*?<\/table>/g) || []
  const results = []
  // Mode persists across tables in the same block:
  // the "ГОДОВОЙ ГРАФИК технического обслуживания" heading appears once before
  // the whole ТО group; "эксплуатационного контроля" — once before the ЭК group.
  let lastMode = null

  for (let tIdx = 0; tIdx < allTables.length; tIdx++) {
    const tbl = allTables[tIdx]
    const rows = (tbl.match(/<tr[\s\S]*?<\/tr>/g) || [])
      .map(r => (r.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g) || [])
        .map(c => c.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()))

    if (rows.length < 10) continue

    // Find header row containing 6+ month abbreviations
    let monthRow = -1
    const monthCols = {}
    for (let ri = 0; ri < Math.min(3, rows.length); ri++) {
      const joined = rows[ri].join(' ').toLowerCase()
      if (SCHED_MONTHS.filter(m => joined.includes(m)).length >= 6) {
        monthRow = ri
        rows[ri].forEach((cell, ci) => {
          const mi = SCHED_MONTHS.findIndex(m =>
            cell.toLowerCase().replace(/\.$/, '').startsWith(m))
          if (mi !== -1) monthCols[ci] = mi + 1
        })
        break
      }
    }
    if (monthRow === -1 || Object.keys(monthCols).length < 10) continue

    // Build context from HTML before table
    const pos = html.indexOf(tbl)
    const textBefore = html.slice(Math.max(0, pos - 900), pos)
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

    const buildingKey = detectSchedBuilding(textBefore, rows[0]?.[0] ?? '')
    // Mode: detect from heading in window, fall back to lastMode (same block)
    const detectedMode = detectSchedMode(textBefore)
    if (detectedMode) lastMode = detectedMode
    const mode = lastMode
    if (!buildingKey || !mode) continue

    // Parse body rows
    const sections = []
    let curSection = null
    let curEquip = null
    let inputRowCount = 0

    for (const row of rows.slice(monthRow + 1)) {
      const nonEmpty = row.filter(c => c)
      const c0 = row[0] ?? ''
      const c1 = row[1] ?? ''
      const c2 = row[2] ?? ''

      // Month marks in this row
      const months = Object.entries(monthCols)
        .filter(([ci]) => SCHED_CROSS.test((row[Number(ci)] ?? '').trim()))
        .map(([, m]) => Number(m)).sort((a, b) => a - b)
      const yearMarks = Object.entries(monthCols)
        .filter(([ci]) => SCHED_YEAR.test(row[Number(ci)] ?? ''))
        .map(([ci, m]) => ({ month: Number(m), text: (row[Number(ci)] ?? '').trim() }))
      const hasMonths = months.length > 0 || yearMarks.length > 0

      if (hasMonths) inputRowCount++

      // Section header: 1-2 non-empty cells, no months, non-integer first, ≤ 180 chars
      if (!hasMonths && nonEmpty.length >= 1 && nonEmpty.length <= 2 &&
          !/^\d+(\.\d+)?$/.test(nonEmpty[0]) && nonEmpty[nonEmpty.length - 1].length <= 180) {
        const sName = nonEmpty[nonEmpty.length - 1]
        if (sName.length < 3) continue
        const cat = classifyScheduleSection(sName)
        curSection = { name: sName, category: cat, needsReview: !cat,
          equipment: [], maintenanceTasks: [], _inputRows: 0 }
        sections.push(curSection)
        curEquip = null
        continue
      }

      // Equipment header: 2 non-empty cells, first is integer
      if (!hasMonths && nonEmpty.length === 2 && /^\d+$/.test(nonEmpty[0]) && curSection) {
        curEquip = { num: nonEmpty[0], name: nonEmpty[1], maintenanceTasks: [] }
        curSection.equipment.push(curEquip)
        continue
      }

      // Operation: has months
      if (hasMonths && curSection) {
        curSection._inputRows++
        const opText = c1 || c0
        const { mode: opMode, needsReview } = classifySchedOpMode(opText, mode)
        const task = {
          opNum: c0.trim(),
          mode: opMode,
          operation: opText,
          periodicity: normalizeSchedPeriodicity(c2),
          months,
          yearMarks,
          source: 'schedule',
          needsReview,
        }
        ;(curEquip ?? curSection).maintenanceTasks.push(task)
      }
    }

    results.push({ buildingKey, mode, tableIdx: tIdx, sections, inputRowCount })
  }

  return results
}

export function runStage3(stage2Results, buildings, scheduleTables) {
  return stage2Results.map(entry => {
    const building = buildings.find(b => b.id === entry.buildingId)
    if (!building) return entry

    const bKey = getBuildingApp2Key(building)
    const bSched = scheduleTables.filter(t => t.buildingKey === bKey)
    if (!bSched.length) return { ...entry }

    // Clone systems, initialise maintenanceTasks
    const systems = entry.systems.map(s => ({ ...s, maintenanceTasks: s.maintenanceTasks ?? [] }))
    let createdCount = 0

    for (const table of bSched) {
      for (const section of table.sections) {
        if (!section.category) {
          console.log(`[stage3] ${bKey} ${table.mode}: секция без категории — "${section.name}"`)
          continue
        }

        let sys = systems.find(s => s.category === section.category)
        if (!sys) {
          const newId = `${entry.buildingId}-${section.category}-s3`
          sys = {
            id: newId,
            category: section.category,
            name: section.name,
            scope: 'building',
            subBuildingId: null,
            needsReview: true,
            source: 'schedule',
            basisNorms: [],
            notes: null,
            equipment: [],
            maintenanceTasks: [],
          }
          systems.push(sys)
          createdCount++
          console.log(`[stage3] ${bKey}: создана система "${section.name}" [${section.category}] из графика`)
        }

        if (section.category === 'elevator' && !sys.maintenanceScope) {
          sys.maintenanceScope = 'operation_only'
        }

        // Flatten section tasks (directly on section + under equipment)
        const tasks = [
          ...section.maintenanceTasks,
          ...section.equipment.flatMap(eq =>
            eq.maintenanceTasks.map(t => ({ ...t, scheduleEquipment: eq.name }))),
        ]
        sys.maintenanceTasks.push(...tasks)
      }
    }

    return { ...entry, systems }
  })
}
