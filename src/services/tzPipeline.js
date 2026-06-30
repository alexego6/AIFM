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

/**
 * Этап 1: двухпроходная схема.
 * Проход 1 — батчи по 80к символов: собираем кандидатов.
 * Проход 2 — консолидация + дедупликация + обогащение через Claude.
 * onProgress(pct, batch, total) — коллбэк прогресса.
 */
export async function runStage1(chunks, onProgress) {
  const BATCH_SIZE = 80_000

  // ── Проход 1: собираем кандидатов ───────────────────────────────────────
  const batches = []
  let cur = ''
  for (const c of chunks) {
    if (cur.length + c.length > BATCH_SIZE && cur.length > 0) {
      batches.push(cur); cur = c
    } else {
      cur += (cur ? '\n\n---\n\n' : '') + c
    }
  }
  if (cur) batches.push(cur)

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
