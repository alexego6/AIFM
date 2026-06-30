import { describe, it, expect, vi } from 'vitest'

// Mock heavy dependencies before importing docParser
vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn(),
  },
}))

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}))

vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: {
    sheet_to_csv: vi.fn(),
  },
}))

import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'
import * as XLSX from 'xlsx'
import { parseFile } from './docParser'

function makeFile(name, content = 'dummy') {
  const blob = new Blob([content], { type: 'application/octet-stream' })
  return new File([blob], name)
}

describe('parseFile', () => {
  describe('TXT', () => {
    it('returns text content from txt file', async () => {
      const file = makeFile('doc.txt', 'Привет, мир!')
      const { text, warnings } = await parseFile(file)
      expect(text).toBe('Привет, мир!')
      expect(warnings).toEqual([])
    })

    it('throws when txt file is empty', async () => {
      const file = makeFile('empty.txt', '   ')
      await expect(parseFile(file)).rejects.toThrow('не содержит читаемого текста')
    })
  })

  describe('DOCX', () => {
    it('returns extracted text from docx', async () => {
      mammoth.extractRawText.mockResolvedValue({
        value: 'Текст договора',
        messages: [],
      })
      const file = makeFile('contract.docx')
      const { text, warnings } = await parseFile(file)
      expect(text).toBe('Текст договора')
      expect(warnings).toEqual([])
    })

    it('filters image and element-ignored mammoth warnings', async () => {
      mammoth.extractRawText.mockResolvedValue({
        value: 'Текст',
        messages: [
          { type: 'warning', message: 'image of type image/x-emf not handled' },
          { type: 'warning', message: 'element was ignored: v:oval' },
          { type: 'warning', message: 'неподдерживаемый шрифт' },
        ],
      })
      const file = makeFile('doc.docx')
      const { warnings } = await parseFile(file)
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toBe('неподдерживаемый шрифт')
    })

    it('throws when docx has no extractable text', async () => {
      mammoth.extractRawText.mockResolvedValue({ value: '   ', messages: [] })
      await expect(parseFile(makeFile('empty.docx'))).rejects.toThrow('не содержит читаемого текста')
    })
  })

  describe('PDF', () => {
    it('extracts text from all pages', async () => {
      const mockPdf = {
        numPages: 2,
        getPage: vi.fn().mockImplementation(async (n) => ({
          getTextContent: async () => ({
            items: [{ str: `Страница ${n} содержимое` }],
          }),
        })),
      }
      pdfjsLib.getDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) })

      const file = makeFile('spec.pdf')
      const { text, warnings } = await parseFile(file)
      expect(text).toContain('Страница 1 содержимое')
      expect(text).toContain('Страница 2 содержимое')
      expect(warnings).toEqual([])
    })

    it('warns about empty pages (scans)', async () => {
      const mockPdf = {
        numPages: 3,
        getPage: vi.fn().mockImplementation(async (n) => ({
          getTextContent: async () => ({
            items: n === 2 ? [] : [{ str: `Страница ${n}` }],
          }),
        })),
      }
      pdfjsLib.getDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) })

      const file = makeFile('scan.pdf')
      const { warnings } = await parseFile(file)
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain('1 стр.')
    })
  })

  describe('XLSX', () => {
    it('extracts CSV from each sheet', async () => {
      XLSX.read.mockReturnValue({
        SheetNames: ['Лист1', 'Лист2'],
        Sheets: {
          Лист1: {},
          Лист2: {},
        },
      })
      XLSX.utils.sheet_to_csv
        .mockReturnValueOnce('Колонка1,Колонка2\nЗначение1,Значение2')
        .mockReturnValueOnce('A,B\n1,2')

      const file = makeFile('data.xlsx')
      const { text, warnings } = await parseFile(file)
      expect(text).toContain('=== Лист: Лист1 ===')
      expect(text).toContain('Колонка1,Колонка2')
      expect(text).toContain('=== Лист: Лист2 ===')
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain('2 листа')
    })

    it('skips empty sheets silently', async () => {
      XLSX.read.mockReturnValue({
        SheetNames: ['Лист1', 'Пустой'],
        Sheets: { Лист1: {}, Пустой: {} },
      })
      XLSX.utils.sheet_to_csv
        .mockReturnValueOnce('Данные,есть\n1,2')
        .mockReturnValueOnce('   ')  // empty sheet

      const file = makeFile('data.xls')
      const { text } = await parseFile(file)
      expect(text).toContain('=== Лист: Лист1 ===')
      expect(text).not.toContain('=== Лист: Пустой ===')
    })

    it('does not warn for single-sheet workbook', async () => {
      XLSX.read.mockReturnValue({
        SheetNames: ['Лист1'],
        Sheets: { Лист1: {} },
      })
      XLSX.utils.sheet_to_csv.mockReturnValueOnce('A,B\n1,2')

      const file = makeFile('single.xlsx')
      const { warnings } = await parseFile(file)
      expect(warnings).toEqual([])
    })
  })

  describe('unsupported formats', () => {
    it('throws for .pptx files', async () => {
      const file = makeFile('presentation.pptx')
      await expect(parseFile(file)).rejects.toThrow('Неподдерживаемый формат')
    })

    it('throws for .csv files', async () => {
      const file = makeFile('data.csv')
      await expect(parseFile(file)).rejects.toThrow('Неподдерживаемый формат')
    })
  })
})
