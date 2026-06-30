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
  const text = data.content[0].text.trim()
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
}

// ── Stage 1: определение зданий/объектов ─────────────────────────────────────
const BUILDINGS_SCHEMA = `[{"id":"b1","name":"...","address":"...","floors":4,"area_m2":8958.5,"year_built":2015,"purpose":"административно-офисное здание"}]`

const STAGE1_PROMPT = (text, knownNames = []) => {
  const exclude = knownNames.length
    ? `\nУЖЕ НАЙДЕННЫЕ объекты (не дублируй): ${knownNames.join(' | ')}\n`
    : ''
  return `Ты — эксперт по технической эксплуатации объектов (Facility Management).
Тебе предоставлен фрагмент технического задания (ТЗ) на обслуживание объектов недвижимости.
${exclude}
ЗАДАЧА: найди ВСЕ здания/объекты/корпуса, упомянутые в этом фрагменте. Для каждого верни:
- id: b1, b2, b3 … (продолжи нумерацию относительно уже найденных: следующий = b${knownNames.length + 1})
- name: официальное наименование (корпус, здание, объект)
- address: адрес или null
- floors: число этажей (целое) или null
- area_m2: площадь кв.м (число) или null
- year_built: год постройки или null
- purpose: назначение (короткая фраза) или null

ПРАВИЛА:
- Только реальные объекты из текста, не выдумывай
- Не включай уже найденные (см. выше)
- Если в этом фрагменте новых объектов нет — верни []
- Верни ТОЛЬКО JSON-массив без markdown

Пример: ${BUILDINGS_SCHEMA}

ФРАГМЕНТ ТЗ:
${text}`
}

// Нормализует имя для дедупликации
function normName(name) {
  return name.toLowerCase().replace(/[«»""''№\s]+/g, ' ').trim()
}

/**
 * Этап 1: сканирует ВСЕ чанки батчами по ~100к символов.
 * onProgress(pct, batchIdx, totalBatches) — необязательный коллбэк прогресса.
 * Возвращает Building[]
 */
export async function runStage1(chunks, onProgress) {
  const BATCH_SIZE = 100_000   // ~25k токенов — хорошо вписывается в контекст

  // Собираем батчи
  const batches = []
  let cur = ''
  for (const c of chunks) {
    if (cur.length + c.length > BATCH_SIZE && cur.length > 0) {
      batches.push(cur)
      cur = c
    } else {
      cur += (cur ? '\n\n---\n\n' : '') + c
    }
  }
  if (cur) batches.push(cur)

  const allBuildings = []
  const seenNames = new Set()

  for (let i = 0; i < batches.length; i++) {
    onProgress?.(Math.round((i / batches.length) * 100), i + 1, batches.length)

    const knownNames = allBuildings.map(b => b.name)
    const raw = await callClaude(STAGE1_PROMPT(batches[i], knownNames), 2048)

    let parsed = []
    try { parsed = JSON.parse(raw) } catch { continue }

    for (const b of parsed) {
      if (!b.name) continue
      const key = normName(b.name)
      if (!seenNames.has(key)) {
        seenNames.add(key)
        allBuildings.push(b)
      }
    }
  }

  onProgress?.(100, batches.length, batches.length)

  // Переназначаем id по порядку
  return allBuildings.map((b, i) => ({
    id: `b${i + 1}`,
    name: b.name ?? 'Объект без названия',
    address: b.address ?? null,
    floors: typeof b.floors === 'number' ? b.floors : null,
    area_m2: typeof b.area_m2 === 'number' ? b.area_m2 : null,
    year_built: typeof b.year_built === 'number' ? b.year_built : null,
    purpose: b.purpose ?? null,
  }))
}
