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
const BUILDINGS_SCHEMA = `[
  {
    "id": "b1",
    "name": "полное название здания/объекта",
    "address": "адрес или null",
    "floors": 5,
    "area_m2": 12500.0,
    "year_built": 2003,
    "purpose": "офисное здание"
  }
]`

const STAGE1_PROMPT = (text) => `Ты — эксперт по технической эксплуатации объектов (Facility Management).

Тебе предоставлен текст технического задания (ТЗ) на техническое обслуживание и эксплуатацию объектов.

ЗАДАЧА: найди ВСЕ здания и объекты, упомянутые в ТЗ. Определи для каждого:
- id: уникальный ключ b1, b2, b3 ...
- name: официальное наименование объекта
- address: адрес (если есть в тексте), иначе null
- floors: число этажей (целое), null если не указано
- area_m2: общая площадь кв.м (число), null если не указана
- year_built: год постройки/ввода в эксплуатацию, null если не указан
- purpose: функциональное назначение (короткая фраза: "административный корпус", "производственный цех", "склад")

ВАЖНО:
- Включай только реальные объекты из текста, не выдумывай
- Если в ТЗ один объект — верни массив из одного элемента
- Верни ТОЛЬКО JSON-массив без markdown и пояснений

Пример ответа:
${BUILDINGS_SCHEMA}

ТЕКСТ ТЗ:
${text}`

/**
 * Этап 1: определяет здания из чанков документа.
 * chunks — массив строк из chunkByHeadings()
 * Возвращает Building[]
 */
export async function runStage1(chunks) {
  // Берём первые чанки, покрывающие общее описание объекта (обычно это начало ТЗ)
  // Лимит — 40 000 символов чтобы не превысить контекст
  const MAX_TOTAL = 40_000
  let total = 0
  const selected = []
  for (const c of chunks) {
    if (total + c.length > MAX_TOTAL) break
    selected.push(c)
    total += c.length
  }
  const text = selected.join('\n\n---\n\n')

  const raw = await callClaude(STAGE1_PROMPT(text), 2048)
  const buildings = JSON.parse(raw)

  // Гарантируем уникальные id
  return buildings.map((b, i) => ({
    id: b.id ?? `b${i + 1}`,
    name: b.name ?? 'Объект без названия',
    address: b.address ?? null,
    floors: b.floors ?? null,
    area_m2: b.area_m2 ?? null,
    year_built: b.year_built ?? null,
    purpose: b.purpose ?? null,
  }))
}
