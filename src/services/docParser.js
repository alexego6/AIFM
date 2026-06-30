import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

/**
 * Парсит DOCX / PDF / TXT и возвращает { text: string, warnings: string[] }
 */
export async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  const warnings = []
  let text = ''

  if (ext === 'docx') {
    const ab = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer: ab })
    text = result.value
    result.messages
      .filter(m => m.type === 'warning')
      .forEach(m => warnings.push(m.message))

  } else if (ext === 'pdf') {
    const ab = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise
    const pages = []
    let emptyPages = 0

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items.map(it => it.str).join(' ').trim()
      if (!pageText) emptyPages++
      else pages.push(pageText)
    }

    text = pages.join('\n\n')
    if (emptyPages > 0)
      warnings.push(`${emptyPages} стр. без текстового слоя (возможно, сканы — текст не извлечён)`)

  } else if (ext === 'txt') {
    text = await file.text()

  } else {
    throw new Error(`Неподдерживаемый формат: .${ext}. Используйте DOCX, PDF или TXT.`)
  }

  if (!text.trim()) throw new Error('Документ не содержит читаемого текста.')
  return { text, warnings }
}
