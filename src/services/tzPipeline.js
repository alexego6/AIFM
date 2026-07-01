const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

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
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) { const e = new Error(`API ${res.status}`); e.code = 'API_ERROR'; throw e }
  const data = await res.json()
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
    "area_m2": 8958.5,
    "year_built": 2015,
    "purpose": "административно-офисное здание",
    "sub_buildings": []
  },
  {
    "id": "b2",
    "name": "Усадьба «Ромашово»",
    "address": "МО, Одинцовский р-н",
    "floors": null,
    "area_m2": 12500.0,
    "year_built": 2003,
    "purpose": "загородный комплекс",
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

Поля каждого объекта:
- id: b1, b2, b3…
- name: официальное наименование (комплекса или отдельного здания)
- address: адрес или null
- floors: число этажей или null
- area_m2: суммарная площадь комплекса / здания или null
- year_built: год или null
- purpose: назначение (одна фраза)
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

3. ДОПОЛНИ пустые поля (address, floors, area_m2, year_built, sub_buildings) из контекста ниже.

4. Переназначь id по порядку: b1, b2, b3…

Верни ТОЛЬКО итоговый JSON-массив без markdown и пояснений. Схема:
${SCHEMA_EXAMPLE}

КОНТЕКСТ (начало документа ТЗ):
${context}`

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

  onProgress?.(100, totalSteps, totalSteps)

  return buildings.map((b, i) => ({
    id: `b${i + 1}`,
    name: b.name ?? 'Объект без названия',
    address: b.address ?? null,
    floors: typeof b.floors === 'number' ? b.floors : null,
    area_m2: typeof b.area_m2 === 'number' ? b.area_m2 : null,
    year_built: typeof b.year_built === 'number' ? b.year_built : null,
    purpose: b.purpose ?? null,
    sub_buildings: Array.isArray(b.sub_buildings)
      ? b.sub_buildings.filter(s => typeof s === 'string' && s.trim())
      : [],
  }))
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
            }))
          : [],
      }
    })
    return { buildingId: b.id, systems }
  })
}

const S2_BATCH_SIZE = 8_000
const S2_MAX_TOKENS = 16_000
const S2_CONSOLIDATE_MAX_TOKENS = 12_000

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
export async function runStage2(buildings, chunks, onProgress) {
  const batches = makeBatches(chunks, S2_BATCH_SIZE)
  const totalSteps = batches.length + 1
  const rawResults = []

  for (let i = 0; i < batches.length; i++) {
    onProgress?.(Math.round((i / totalSteps) * 100), i + 1, totalSteps)
    const log = msg => console.log(`  s2b${i + 1}/${batches.length}: ${msg}`)
    const results = await extractWithBisect(buildings, batches[i], 4, log)
    rawResults.push(...results)
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
