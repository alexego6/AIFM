import { describe, it, expect } from 'vitest'
import { chunkByHeadings } from './chunkText'

describe('chunkByHeadings', () => {
  it('returns single chunk for short text', () => {
    const text = 'Короткий документ без заголовков.'
    const result = chunkByHeadings(text)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(text)
  })

  it('returns multiple chunks for long text with headings', () => {
    // Build text with clear headings that will exceed 6000 chars when combined
    const section = (n) =>
      `## Раздел ${n}\n` + 'Lorem ipsum dolor sit amet. '.repeat(100)
    const text = Array.from({ length: 10 }, (_, i) => section(i + 1)).join('\n\n')

    const result = chunkByHeadings(text)
    expect(result.length).toBeGreaterThan(1)
    // Each chunk must not exceed maxChars (default 6000)
    result.forEach(chunk => expect(chunk.length).toBeLessThanOrEqual(6000))
  })

  it('splits by size when no headings and text is long', () => {
    const text = 'a'.repeat(15000)
    const result = chunkByHeadings(text)
    expect(result.length).toBeGreaterThan(1)
    result.forEach(chunk => expect(chunk.length).toBeLessThanOrEqual(6000))
  })

  it('respects numbered headings in Russian', () => {
    const text =
      '1. ОБЩИЕ ПОЛОЖЕНИЯ\n' + 'Текст раздела 1. '.repeat(150) + '\n\n' +
      '2. ОБЪЕКТЫ ОБСЛУЖИВАНИЯ\n' + 'Текст раздела 2. '.repeat(150) + '\n\n' +
      '3. ТРЕБОВАНИЯ\n' + 'Текст раздела 3. '.repeat(150)

    const result = chunkByHeadings(text)
    // Should produce multiple chunks, not one giant blob
    expect(result.length).toBeGreaterThan(1)
  })

  it('does not lose text content when chunking', () => {
    const sectionText = 'Контент раздела. '.repeat(200)
    const text = `# Раздел 1\n${sectionText}\n# Раздел 2\n${sectionText}`
    const result = chunkByHeadings(text)
    const combined = result.join('\n')
    // Key content words should all be present
    expect(combined).toContain('Раздел 1')
    expect(combined).toContain('Раздел 2')
    expect(combined).toContain('Контент раздела.')
  })

  it('accepts custom maxChars parameter', () => {
    const text = 'a'.repeat(500)
    const result = chunkByHeadings(text, 200)
    result.forEach(chunk => expect(chunk.length).toBeLessThanOrEqual(200))
  })

  it('handles РАЗДЕЛ keyword heading', () => {
    const text =
      'РАЗДЕЛ I. Общие сведения\n' + 'Содержание раздела. '.repeat(200) + '\n' +
      'РАЗДЕЛ II. Перечень объектов\n' + 'Объекты. '.repeat(200)
    const result = chunkByHeadings(text)
    expect(result.length).toBeGreaterThanOrEqual(1)
    result.forEach(chunk => expect(chunk.length).toBeLessThanOrEqual(6000))
  })
})
