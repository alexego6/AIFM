const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

async function callClaude({ prompt, base64image, mediaType, maxTokens = 4096 }) {
  if (!API_KEY) {
    const err = new Error('NO_KEY'); err.code = 'NO_KEY'; throw err
  }
  const content = base64image
    ? [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64image } },
        { type: 'text', text: prompt },
      ]
    : prompt

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
      messages: [{ role: 'user', content }],
    }),
  })
  if (!res.ok) {
    const err = new Error(`API ${res.status}: ${res.statusText}`); err.code = 'API_ERROR'; throw err
  }
  const data = await res.json()
  const text = data.content[0].text.trim()
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  return JSON.parse(clean)
}

const ROOMS_PROMPT_RULES = `
Правила:
- number: точный номер из документа, включая суффиксы (1а, 2б, 9б, 10а)
- name: точное название строчными буквами
- area: площадь из колонки «всего» в кв.м, число без единиц; null если нет
- type: ровно одно из: office | corridor | bathroom | kitchen | storage | technical | hall | other
  office → кабинет, офис, комната отдыха, рабочее помещение
  corridor → коридор, проход
  bathroom → санузел, туалет, душевая, ванная
  kitchen → кухня
  storage → кладовая, подсобное, гардероб, склад
  technical → техническое, электрощитовая, серверная, ИТП, венткамера
  hall → холл, вестибюль, тамбур, лестница, лестничная клетка, лифт
  other → всё остальное

НЕ включай итоговые строки («Итого», «Нежилые помещения всего»).
НЕ возвращай координат, x, y, ширин, высот.
Возвращай только JSON-массив.`

// Читает план этажа — ищет подписи помещений на чертеже.
// Возвращает [{ number, name, area, type }].
export async function extractRooms(base64image, mediaType = 'image/jpeg') {
  return callClaude({
    base64image, mediaType, maxTokens: 2048,
    prompt: `Ты — эксперт по документам БТИ. На изображении — поэтажный план.
Прочитай подписи помещений на чертеже (номер и название внутри каждой комнаты).
Верни ТОЛЬКО JSON-массив без markdown:
[{"number":"1","name":"кабинет","area":38.1,"type":"office"}]
${ROOMS_PROMPT_RULES}`,
  })
}

// Читает экспликацию — одну или несколько страниц в одном запросе.
// pages = [{ base64, mediaType }]
// Возвращает [{ number, name, area, type }].
export async function extractRoomsFromExplication(pages) {
  if (!API_KEY) { const e = new Error('NO_KEY'); e.code = 'NO_KEY'; throw e }

  // Строим content: изображение каждой страницы + текстовый промпт в конце
  const content = []
  pages.forEach((p, i) => {
    if (pages.length > 1) content.push({ type:'text', text:`=== Страница ${i+1} ===` })
    content.push({ type:'image', source:{ type:'base64', media_type: p.mediaType, data: p.base64 } })
  })
  content.push({ type:'text', text:`Ты — эксперт по документам БТИ.
На изображениях — экспликация к поэтажному плану (одна или несколько страниц таблиц).

Прочитай ВСЕ таблицы. Разные страницы могут описывать разные секции или помещения одного этажа.
Если на разных страницах встречаются одинаковые номера с разными данными — это разные помещения;
добавь к номеру суффикс «-2», «-3» и т.д. (например, «1» и «1-2»).

Верни ТОЛЬКО JSON-массив без markdown, преамбулы и пояснений:
[{"number":"1","name":"кабинет","area":38.1,"type":"office"}]
${ROOMS_PROMPT_RULES}` })

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'x-api-key': API_KEY,
      'anthropic-version':'2023-06-01',
      'anthropic-dangerous-direct-browser-access':'true',
    },
    body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:2048, messages:[{ role:'user', content }] }),
  })
  if (!res.ok) { const e = new Error(`API ${res.status}`); e.code='API_ERROR'; throw e }
  const data = await res.json()
  const text = data.content[0].text.trim()
  return JSON.parse(text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/i,''))
}

export async function fetchWearPrediction(items) {
  if (!API_KEY) {
    const err = new Error('NO_KEY')
    err.code = 'NO_KEY'
    throw err
  }

  const lines = items.map(e =>
    `${e.id} | ${e.name} | ${e.system} | ${e.year} г. | ${e.wear}% износ | P=${e.probability}/5 | C=${e.consequence}/5 | ${e.statusLabel}`
  ).join('\n')

  const prompt = `Ты — эксперт по технической эксплуатации зданий (Facility Management). Проанализируй оборудование бизнес-центра «Горизонт» и дай прогноз аварийности.

ОБОРУДОВАНИЕ (ID | Название | Система | Год | Износ | Вероятность отказа 1-5 | Последствия 1-5 | Статус):
${lines}

Верни ТОЛЬКО валидный JSON без markdown-блоков и пояснений:
{
  "summary": "краткое резюме состояния объекта, 2-3 предложения",
  "totalRisk": "LOW или MEDIUM или HIGH или CRITICAL",
  "criticalCount": число единиц с критичным риском,
  "recommendations": [
    {
      "equipmentId": "eqXX",
      "priority": 1,
      "action": "что конкретно сделать",
      "deadline": "срок строкой, например 'немедленно' или 'до 15 июля 2026'",
      "reason": "обоснование, 1-2 предложения"
    }
  ]
}

В recommendations включи только оборудование с реальными проблемами (износ > 40% или P >= 3), отсортируй по приоритету (1 = наивысший).`

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
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = new Error(`Ошибка ${res.status}: ${res.statusText}`)
    err.code = 'API_ERROR'
    throw err
  }

  const data = await res.json()
  const text = data.content[0].text.trim()
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  return JSON.parse(clean)
}
