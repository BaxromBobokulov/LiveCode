import { describe, expect, it } from 'vitest'
import { migrateStorage } from './migrateStorage'

/** A small in-memory Storage, since tests run in Node without localStorage. */
function memoryStorage(initial: Record<string, string>): Storage {
  const items = new Map(Object.entries(initial))
  return {
    get length() {
      return items.size
    },
    key: (index: number) => [...items.keys()][index] ?? null,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
  }
}

function contents(storage: Storage): Record<string, string> {
  const result: Record<string, string> = {}
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)!
    result[key] = storage.getItem(key)!
  }
  return result
}

describe('migrateStorage', () => {
  it('moves every "codevision.*" value to its "livecode.*" name and removes the old key', () => {
    const storage = memoryStorage({
      'codevision.theme': 'dark',
      'codevision.locale': 'uz',
      'codevision.badges': '["firstSolve"]',
      'codevision.passedProblems': '["sum"]',
      'other.key': 'kept',
    })
    migrateStorage(storage)
    expect(contents(storage)).toEqual({
      'livecode.theme': 'dark',
      'livecode.locale': 'uz',
      'livecode.badges': '["firstSolve"]',
      'livecode.passedProblems': '["sum"]',
      'other.key': 'kept',
    })
  })

  it('never overwrites a "livecode.*" value that is already there', () => {
    const storage = memoryStorage({ 'codevision.theme': 'dark', 'livecode.theme': 'light' })
    migrateStorage(storage)
    expect(contents(storage)).toEqual({ 'livecode.theme': 'light' })
  })

  it('does nothing when there are no old keys', () => {
    const storage = memoryStorage({ 'livecode.theme': 'dark' })
    migrateStorage(storage)
    expect(contents(storage)).toEqual({ 'livecode.theme': 'dark' })
  })
})
