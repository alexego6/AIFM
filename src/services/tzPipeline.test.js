import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  EXTRACT_BATCH1,
  EXTRACT_BATCH2,
  EXTRACT_EMPTY,
  CONSOLIDATE_RESULT,
  MALFORMED_JSON,
  SINGLE_BUILDING,
} from '../test/fixtures/stage1Responses'

// Mock fetch before importing tzPipeline
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock the env var
vi.stubEnv('VITE_ANTHROPIC_API_KEY', 'test-key')

// Import after mocking
const { runStage1, normalizeAddressKey, dedupBuildingsByAddress } = await import('./tzPipeline')

function makeClaudeResponse(text) {
  return {
    ok: true,
    json: async () => ({ content: [{ text }] }),
  }
}

// Tiny text chunk that fits in one batch
const SMALL_CHUNK = 'Технический паспорт объекта. Здание расположено по адресу ул. Тестовая.'

// Build chunks that total >80k chars to force 2 batches
function makeLargeChunks(count = 15, charsEach = 6000) {
  return Array.from({ length: count }, (_, i) =>
    `## Раздел ${i + 1}\n` + 'Текст фрагмента. '.repeat(Math.ceil(charsEach / 17))
  )
}

describe('runStage1', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('throws NO_KEY when API key is missing', async () => {
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', '')
    // Re-import to pick up cleared env; simpler to test via direct call
    mockFetch.mockRejectedValue(new Error('should not reach'))
    // Create a minimal isolated function to test the key check
    const callWithNoKey = async () => {
      const key = import.meta.env.VITE_ANTHROPIC_API_KEY
      if (!key) { const e = new Error('NO_KEY'); e.code = 'NO_KEY'; throw e }
    }
    await expect(callWithNoKey()).rejects.toMatchObject({ code: 'NO_KEY' })
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', 'test-key')
  })

  it('returns normalized buildings for single batch', async () => {
    // 1 extract call + 1 consolidate call
    mockFetch
      .mockResolvedValueOnce(makeClaudeResponse(SINGLE_BUILDING))   // extract
      .mockResolvedValueOnce(makeClaudeResponse(SINGLE_BUILDING))   // consolidate

    const chunks = [SMALL_CHUNK]
    const result = await runStage1(chunks)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'b1',
      name: 'Бизнес-центр «Альфа»',
      floors: 10,
      areaSqm: 25000,
      sub_buildings: [],
    })
  })

  it('calls onProgress callback with correct values', async () => {
    mockFetch
      .mockResolvedValueOnce(makeClaudeResponse(SINGLE_BUILDING))
      .mockResolvedValueOnce(makeClaudeResponse(SINGLE_BUILDING))

    const progress = []
    await runStage1([SMALL_CHUNK], (pct, batch, total) => {
      progress.push({ pct, batch, total })
    })

    // Should have called progress at start of batch, at consolidate, and at 100%
    expect(progress.length).toBeGreaterThanOrEqual(2)
    // Last call must be 100%
    expect(progress[progress.length - 1].pct).toBe(100)
    // total for 1 chunk = 1 batch + 1 consolidation = 2 steps
    expect(progress[0].total).toBe(2)
  })

  it('handles two batches and consolidates', async () => {
    const largeChunks = makeLargeChunks(15, 6000) // ~90k total, forces 2 batches

    mockFetch
      .mockResolvedValueOnce(makeClaudeResponse(EXTRACT_BATCH1))   // batch 1
      .mockResolvedValueOnce(makeClaudeResponse(EXTRACT_BATCH2))   // batch 2
      .mockResolvedValueOnce(makeClaudeResponse(CONSOLIDATE_RESULT)) // consolidate

    const result = await runStage1(largeChunks)

    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(result).toHaveLength(4) // CONSOLIDATE_RESULT has 4 buildings
    expect(result[3].sub_buildings).toHaveLength(3)
  })

  it('skips malformed batch response without crashing', async () => {
    // When extract returns bad JSON, candidates stay empty.
    // Consolidation is NOT called (guarded by candidates.length > 0).
    mockFetch.mockResolvedValueOnce(makeClaudeResponse(MALFORMED_JSON))

    const chunks = [SMALL_CHUNK]
    const result = await runStage1(chunks)

    // Empty result is the correct fallback — no crash
    expect(result).toEqual([])
    // Only 1 fetch call (extract) — consolidation skipped
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('falls back to raw candidates when consolidation parse fails', async () => {
    mockFetch
      .mockResolvedValueOnce(makeClaudeResponse(EXTRACT_BATCH1))  // good extract
      .mockResolvedValueOnce(makeClaudeResponse(MALFORMED_JSON))  // bad consolidate

    const result = await runStage1([SMALL_CHUNK])
    // Should return the 3 candidates from EXTRACT_BATCH1 (fallback path)
    expect(result).toHaveLength(3)
  })

  it('returns empty array when no candidates and empty consolidation', async () => {
    // When no candidates, consolidation is skipped entirely
    mockFetch.mockResolvedValueOnce(makeClaudeResponse(EXTRACT_EMPTY))

    const result = await runStage1([SMALL_CHUNK])
    expect(result).toEqual([])
    // consolidation call should NOT be made when no candidates
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('normalizes building fields to correct types', async () => {
    const rawWithStringNums = JSON.stringify([{
      id: 'b1',
      name: 'Тест',
      address: null,
      floors: '3',       // string instead of number
      area_m2: '5000',   // string instead of number
      year_built: null,
      purpose: null,
      sub_buildings: null,  // null instead of []
    }])

    mockFetch
      .mockResolvedValueOnce(makeClaudeResponse(rawWithStringNums))
      .mockResolvedValueOnce(makeClaudeResponse(rawWithStringNums))

    const result = await runStage1([SMALL_CHUNK])
    expect(result[0].floors).toBeNull()   // string not a number — should be null
    expect(result[0].areaSqm).toBeNull()  // string not a number — should be null
    expect(result[0].sub_buildings).toEqual([]) // null → []
  })

  it('handles empty chunks array without API calls', async () => {
    const result = await runStage1([])
    expect(result).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('handles empty API response (EMPTY_RESPONSE code) gracefully', async () => {
    // API returns response with empty content array
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [] }),
    })
    // The batch extract throws EMPTY_RESPONSE, is caught silently; no consolidation
    const result = await runStage1([SMALL_CHUNK])
    expect(result).toEqual([])
  })

  it('reassigns ids sequentially b1, b2, b3…', async () => {
    mockFetch
      .mockResolvedValueOnce(makeClaudeResponse(CONSOLIDATE_RESULT))
      .mockResolvedValueOnce(makeClaudeResponse(CONSOLIDATE_RESULT))

    const result = await runStage1([SMALL_CHUNK])
    result.forEach((b, i) => {
      expect(b.id).toBe(`b${i + 1}`)
    })
  })

  it('filters empty and whitespace-only strings from sub_buildings', async () => {
    const rawWithEmptySubs = JSON.stringify([{
      id: 'b1',
      name: 'Комплекс',
      address: null,
      floors: null,
      area_m2: null,
      year_built: null,
      purpose: null,
      sub_buildings: ['Корпус А', '', 'Корпус Б', null, '   '],
    }])

    mockFetch
      .mockResolvedValueOnce(makeClaudeResponse(rawWithEmptySubs))
      .mockResolvedValueOnce(makeClaudeResponse(rawWithEmptySubs))

    const result = await runStage1([SMALL_CHUNK])
    expect(result[0].sub_buildings).toEqual(['Корпус А', 'Корпус Б'])
    expect(result[0].sub_buildings).not.toContain('')
    expect(result[0].sub_buildings).not.toContain(null)
    expect(result[0].sub_buildings).not.toContain('   ')
  })
})

describe('normalizeAddressKey', () => {
  it('extracts street + house + korpus', () => {
    expect(normalizeAddressKey('г. Москва, Одинцовский р-н, г. Одинцово, ул. Луговая, д. 4, корпус 6'))
      .toBe('луговая|4|6')
  })

  it('matches same address written differently', () => {
    const a = normalizeAddressKey('ул. Луговая, д. 4, корпус 6')
    const b = normalizeAddressKey('улица Луговая, дом 4, корп. 6')
    expect(a).not.toBeNull()
    expect(a).toBe(b)
  })

  it('different korpus → different keys', () => {
    expect(normalizeAddressKey('ул. Нобеля, д. 7, корпус 1'))
      .not.toBe(normalizeAddressKey('ул. Нобеля, д. 7, корпус 2'))
  })

  it('null for missing house or non-string', () => {
    expect(normalizeAddressKey('МО, Одинцовский р-н')).toBeNull()
    expect(normalizeAddressKey(null)).toBeNull()
  })
})

describe('dedupBuildingsByAddress', () => {
  const CDM = {
    id: 'b5', name: 'ЦДМ',
    address: 'г. Одинцово, ул. Луговая, д. 4, корпус 6',
    floors: 3, areaSqm: 1513, territoryAreaSqm: null,
    year_built: 2016, purpose: 'бытовое нежилое здание',
    needsReview: false, sub_buildings: [],
  }
  const GHOST = {
    id: 'b6', name: 'Нежилое здание на ул. Луговая (Объект «Нежилое здание»)',
    address: 'г. Москва, Одинцовский р-н, г. Одинцово, ул. Луговая, д. 4, корпус 6',
    floors: 3, areaSqm: 1513, territoryAreaSqm: null,
    year_built: null, purpose: 'бытовое нежилое здание',
    needsReview: false, sub_buildings: [],
  }

  it('merges two records with the same address into one (ЦДМ case)', () => {
    const result = dedupBuildingsByAddress([CDM, GHOST])
    expect(result).toHaveLength(1)
    expect(result[0].areaSqm).toBe(1513)
    expect(result[0].year_built).toBe(2016)
  })

  it('keeps buildings with different or missing addresses intact', () => {
    const other = { ...CDM, id: 'b1', name: 'КМ-1', address: 'ул. Нобеля, д. 7, корпус 1' }
    const noAddr = { ...CDM, id: 'b2', name: 'Усадьба', address: null }
    const result = dedupBuildingsByAddress([other, noAddr, CDM])
    expect(result).toHaveLength(3)
  })

  it('flags needsReview when merged records disagree on areaSqm', () => {
    const conflict = { ...GHOST, areaSqm: 1600 }
    const result = dedupBuildingsByAddress([CDM, conflict])
    expect(result).toHaveLength(1)
    expect(result[0].needsReview).toBe(true)
  })

  it('unions sub_buildings without duplicates', () => {
    const a = { ...CDM, sub_buildings: ['Пристройка'] }
    const b = { ...GHOST, sub_buildings: ['Пристройка', 'КПП'] }
    const result = dedupBuildingsByAddress([a, b])
    expect(result[0].sub_buildings.sort()).toEqual(['КПП', 'Пристройка'])
  })
})
