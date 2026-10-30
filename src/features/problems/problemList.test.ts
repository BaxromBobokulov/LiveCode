import { describe, expect, it } from 'vitest'
import { problems } from '../../data/problems'
import { normalizeForSearch, pickRandomProblem } from './problemList'

describe('normalizeForSearch', () => {
  it('ignores case in every UI language, and the spaces around a search', () => {
    expect(normalizeForSearch('  COUNTdown ')).toBe('countdown')
    expect(normalizeForSearch('СУММА')).toBe('сумма')
    expect(normalizeForSearch('Teskari')).toBe('teskari')
  })

  it('treats the ways of typing the same letter as equal', () => {
    for (const typed of ['yig‘indi', 'yigʻindi', 'yig’indi', 'yig`indi']) {
      expect(normalizeForSearch("Raqamlar yig'indisi")).toContain(normalizeForSearch(typed))
    }
    expect(normalizeForSearch('Обратный отсчёт')).toContain(normalizeForSearch('отсчет'))
  })
})

describe('pickRandomProblem', () => {
  const ids = problems.map((problem) => problem.id)

  it('only picks problems the student has not passed', () => {
    const passed = ids.slice(0, -2)
    for (const value of [0, 0.25, 0.5, 0.75, 0.999]) {
      const { problem, allSolved } = pickRandomProblem(problems, passed, () => value)
      expect(ids.slice(-2)).toContain(problem.id)
      expect(allSolved).toBe(false)
    }
  })

  it('picks the last unsolved problem whatever the random number', () => {
    const last = ids[ids.length - 1]
    expect(pickRandomProblem(problems, ids.slice(0, -1), () => 0.999).problem.id).toBe(last)
  })

  it('picks any problem and says so when every one is passed', () => {
    const first = pickRandomProblem(problems, ids, () => 0)
    const final = pickRandomProblem(problems, ids, () => 0.999)
    expect(first.allSolved).toBe(true)
    expect(first.problem.id).toBe(ids[0])
    expect(final.problem.id).toBe(ids[ids.length - 1])
  })
})
