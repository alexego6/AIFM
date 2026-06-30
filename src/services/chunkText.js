const MAX_CHARS = 6000

// Заголовки: markdown ##/###, нумерованные "1.", "1.1.", "РАЗДЕЛ X", "Глава X"
const HEADING_RE = /^(#{1,3}\s+\S|(?:[0-9]+\.){1,3}\s+[А-ЯA-Z«]|РАЗДЕЛ\s|Глава\s)/m

/**
 * Разбивает текст на чанки по заголовкам / размеру.
 * Возвращает string[] — каждый элемент ≤ maxChars символов.
 * Контекст заголовка переносится в следующий чанк при разрезе внутри раздела.
 */
export function chunkByHeadings(text, maxChars = MAX_CHARS) {
  if (text.length <= maxChars) return [text]

  // Находим позиции всех заголовков
  const lines = text.split('\n')
  const sections = []   // { heading, body }
  let curHeading = ''
  let curBody = ''

  for (const line of lines) {
    if (HEADING_RE.test(line) && curBody.length > 50) {
      sections.push({ heading: curHeading, body: curBody.trim() })
      curHeading = line
      curBody = ''
    } else if (HEADING_RE.test(line)) {
      curHeading = line
    } else {
      curBody += line + '\n'
    }
  }
  if (curBody.trim()) sections.push({ heading: curHeading, body: curBody.trim() })

  // Если нет заголовков — режем по максимальному размеру
  if (sections.length <= 1) return splitBySize(text, maxChars)

  // Собираем чанки, не превышая maxChars
  const chunks = []
  let cur = ''

  for (const { heading, body } of sections) {
    const block = (heading ? heading + '\n' : '') + body
    if (cur.length + block.length > maxChars && cur.length > 0) {
      chunks.push(cur.trim())
      cur = ''
    }
    if (block.length > maxChars) {
      // Большой раздел — режем по параграфам, пробрасываем heading
      const subChunks = splitBySize(block, maxChars)
      subChunks.forEach((sc, i) => {
        chunks.push(i === 0 ? sc : `[продолжение: ${heading || ''}]\n` + sc)
      })
    } else {
      cur += (cur ? '\n\n' : '') + block
    }
  }
  if (cur.trim()) chunks.push(cur.trim())

  return chunks
}

function splitBySize(text, maxChars) {
  const chunks = []
  for (let i = 0; i < text.length; i += maxChars) {
    // Не разрезаем по середине слова
    let end = Math.min(i + maxChars, text.length)
    if (end < text.length) {
      const nl = text.lastIndexOf('\n', end)
      if (nl > i + maxChars / 2) end = nl + 1
    }
    chunks.push(text.slice(i, end))
  }
  return chunks
}
