import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACTIVE_DAYS_GOAL, localDate, useBadgesStore } from './badgesStore'

const store = useBadgesStore

describe('badgesStore', () => {
  beforeEach(() => store.setState({ unlocked: [], passDays: [], passedProblems: [] }))
  afterEach(() => vi.unstubAllGlobals())

  it('unlocks "first correct solution" on the first pass only', () => {
    expect(store.getState().recordPass('sum', '2026-10-01')).toEqual(['firstSolve'])
    expect(store.getState().recordPass('sum', '2026-10-01')).toEqual([])
    expect(store.getState().recordPass('sum', '2026-10-02')).toEqual([])
    expect(store.getState().unlocked).toEqual(['firstSolve'])
  })

  it('remembers each passed problem once', () => {
    store.getState().recordPass('sum', '2026-10-01')
    store.getState().recordPass('grade', '2026-10-01')
    store.getState().recordPass('sum', '2026-10-02')
    expect(store.getState().passedProblems).toEqual(['sum', 'grade'])
  })

  it('counts each calendar day once, and unlocks "7 days" on the 7th different day, not necessarily consecutive', () => {
    const days = ['2026-10-01', '2026-10-03', '2026-10-08', '2026-10-09', '2026-10-15', '2026-10-20']
    for (const day of days) {
      store.getState().recordPass('sum', day)
      store.getState().recordPass('sum', day) // a second pass the same day adds nothing
    }
    expect(store.getState().passDays).toHaveLength(ACTIVE_DAYS_GOAL - 1)
    expect(store.getState().unlocked).not.toContain('activeDays')

    expect(store.getState().recordPass('sum', '2026-11-02')).toEqual(['activeDays'])
    expect(store.getState().recordPass('sum', '2026-11-03')).toEqual([])
  })

  it('saves badges, dates and passed problems to localStorage when it is there', () => {
    const saved = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => saved.set(key, value),
    })
    store.getState().recordPass('sum', '2026-10-24')
    expect(JSON.parse(saved.get('codevision.badges')!)).toEqual(['firstSolve'])
    expect(JSON.parse(saved.get('codevision.passDays')!)).toEqual(['2026-10-24'])
    expect(JSON.parse(saved.get('codevision.passedProblems')!)).toEqual(['sum'])
  })

  it('still works when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(store.getState().recordPass('sum', '2026-10-24')).toEqual(['firstSolve'])
    expect(store.getState().passedProblems).toEqual(['sum'])
  })

  it('uses the local calendar date, not the UTC one', () => {
    expect(localDate(new Date(2026, 0, 5, 1, 30))).toBe('2026-01-05')
  })
})
