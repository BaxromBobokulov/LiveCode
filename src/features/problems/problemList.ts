import type { Problem } from '../../data/problems/types'

/**
 * Text as the Problems search compares it: without case, and with the spellings a student can type for the
 * same letter made equal, so "yig‘indi" finds "yig'indi" and "отсчет" finds "отсчёт" in any UI language.
 */
export function normalizeForSearch(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[ʻʼ‘’`´]/g, "'")
    .replace(/ё/g, 'е')
}

/**
 * A random problem the student hasn't passed yet. With every problem passed it picks from all of them,
 * and `allSolved` says so, so the screen can tell the student why they got a solved one.
 */
export function pickRandomProblem(
  problems: Problem[],
  passedProblems: string[],
  random = Math.random,
): { problem: Problem; allSolved: boolean } {
  const unsolved = problems.filter((problem) => !passedProblems.includes(problem.id))
  const pool = unsolved.length > 0 ? unsolved : problems
  return { problem: pool[Math.floor(random() * pool.length)], allSolved: unsolved.length === 0 }
}
