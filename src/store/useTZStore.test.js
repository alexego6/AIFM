import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock IndexedDB before importing the store
const mockIDB = {
  data: {},
  get: vi.fn(async (key) => mockIDB.data[key] ?? null),
  set: vi.fn(async (key, val) => { mockIDB.data[key] = val }),
  clear: vi.fn(async () => { mockIDB.data = {} }),
}

// Patch indexedDB.open to prevent real IDB access in jsdom
// We mock the idb module indirectly by intercepting open()
vi.mock('../store/useTZStore', async (importOriginal) => {
  // Replace the module's idb calls by overriding indexedDB behavior.
  // The store uses a hand-rolled idb IIFE; we can't easily intercept it.
  // Instead we test the Zustand state logic independently by importing
  // the store and using its actions, accepting that IDB calls will
  // fail silently in jsdom (they throw but are caught by async callers).
  return importOriginal()
})

// Stub indexedDB globally so open() resolves but IDB ops are no-ops
const fakeIDB = {
  open: vi.fn(() => {
    const req = {}
    setTimeout(() => {
      const db = {
        transaction: () => ({
          objectStore: () => ({
            get: vi.fn(() => {
              const r = {}
              setTimeout(() => r.onsuccess?.({ target: { result: null } }), 0)
              return r
            }),
            put: vi.fn(() => {
              const r = {}
              setTimeout(() => r.onsuccess?.(), 0)
              return r
            }),
            clear: vi.fn(() => {
              const r = {}
              setTimeout(() => r.onsuccess?.(), 0)
              return r
            }),
          }),
        }),
        createObjectStore: vi.fn(),
      }
      req.onsuccess?.({ target: { result: db } })
    }, 0)
    return req
  }),
}
vi.stubGlobal('indexedDB', fakeIDB)

import { useTZStore } from './useTZStore'

function getState() {
  return useTZStore.getState()
}

describe('useTZStore state machine', () => {
  beforeEach(() => {
    // Reset store to initial state
    useTZStore.setState({
      fileName: null,
      fileSize: null,
      parseWarnings: [],
      chunks: [],
      stage: 0,
      stageStatus: 'idle',
      stageError: null,
      buildings: [],
      tzPendingFile: null,
    })
  })

  it('starts in idle state with empty data', () => {
    const s = getState()
    expect(s.stage).toBe(0)
    expect(s.stageStatus).toBe('idle')
    expect(s.chunks).toEqual([])
    expect(s.buildings).toEqual([])
    expect(s.fileName).toBeNull()
  })

  it('setStage transitions stage and status', () => {
    getState().setStage(1, 'running')
    expect(getState().stage).toBe(1)
    expect(getState().stageStatus).toBe('running')
    expect(getState().stageError).toBeNull()
  })

  it('setStage records error message', () => {
    getState().setStage(1, 'error', 'API timeout')
    expect(getState().stageStatus).toBe('error')
    expect(getState().stageError).toBe('API timeout')
  })

  it('setParseWarnings updates warnings array', () => {
    getState().setParseWarnings(['Предупреждение 1', 'Предупреждение 2'])
    expect(getState().parseWarnings).toHaveLength(2)
  })

  it('updateBuilding patches by id', () => {
    useTZStore.setState({
      buildings: [
        { id: 'b1', name: 'Объект А', floors: 3 },
        { id: 'b2', name: 'Объект Б', floors: 5 },
      ],
    })
    getState().updateBuilding('b1', { floors: 4, area_m2: 1000 })
    const buildings = getState().buildings
    expect(buildings[0].floors).toBe(4)
    expect(buildings[0].area_m2).toBe(1000)
    expect(buildings[1]).toMatchObject({ id: 'b2', floors: 5 }) // b2 unchanged
  })

  it('updateBuilding does nothing for unknown id', () => {
    useTZStore.setState({
      buildings: [{ id: 'b1', name: 'Объект А', floors: 3 }],
    })
    getState().updateBuilding('b99', { floors: 10 })
    expect(getState().buildings[0].floors).toBe(3) // unchanged
  })

  it('reset clears all state to initial values', async () => {
    useTZStore.setState({
      fileName: 'test.docx',
      fileSize: 12345,
      chunks: ['chunk1', 'chunk2'],
      buildings: [{ id: 'b1', name: 'Офис' }],
      stage: 1,
      stageStatus: 'checkpoint',
    })
    await getState().reset()
    const s = getState()
    expect(s.fileName).toBeNull()
    expect(s.fileSize).toBeNull()
    expect(s.chunks).toEqual([])
    expect(s.buildings).toEqual([])
    expect(s.stage).toBe(0)
    expect(s.stageStatus).toBe('idle')
  })

  it('setTzPendingFile / clearTzPendingFile work correctly', () => {
    const file = new File(['content'], 'test.pdf')
    getState().setTzPendingFile(file)
    expect(getState().tzPendingFile).toBe(file)
    getState().clearTzPendingFile()
    expect(getState().tzPendingFile).toBeNull()
  })

  describe('loadFromDB', () => {
    it('does nothing when IDB returns nothing (fresh session)', async () => {
      // fakeIDB returns null for all gets, so state should stay unchanged
      await getState().loadFromDB()
      // Stage stays 0 idle (nothing to restore)
      expect(getState().stage).toBe(0)
      expect(getState().stageStatus).toBe('idle')
    })
  })
})
