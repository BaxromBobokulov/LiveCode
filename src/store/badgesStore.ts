import { create } from 'zustand'

// Badges a student earns by solving problems, and which problems they have passed. They are saved in this
// browser's localStorage only: there is no account behind them, so another device or browser starts with
// none (AGENTS.md § Badges). Nothing here is ever sent anywhere.

export type BadgeId = 'firstSolve' | 'activeDays'

/** In the order the badge shelf shows them. */
export const badgeIds: BadgeId[] = ['firstSolve', 'activeDays']

/** How many different calendar days with a fully passing Check unlock the 'activeDays' badge. */
export const ACTIVE_DAYS_GOAL = 7

const BADGES_KEY = 'codevision.badges'
// Only the dates ("2026-10-24") of the days with at least one fully passing Check, nothing more detailed.
const PASS_DAYS_KEY = 'codevision.passDays'
// The ids of the problems with a fully passing Check, for the Problems section's progress and random problem.
const PASSED_PROBLEMS_KEY = 'codevision.passedProblems'

// localStorage can throw (private mode, blocked site data) or be missing (tests run in Node), so
// reading and writing never break the app: without it, badges work until the page is reloaded.
function loadList(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function saveList(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // Not saved; the badge still shows until the page is reloaded.
  }
}

/** Today's date on the student's own clock, e.g. "2026-10-24" (not toISOString(), which is the UTC date). */
export function localDate(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

type BadgesState = {
  unlocked: BadgeId[]
  /** The dates with at least one fully passing Check, each once. */
  passDays: string[]
  /** The ids of the problems with a fully passing Check, each once. */
  passedProblems: string[]
  /**
   * Called after a Check that passed every test case. Remembers the problem and today's date, and returns
   * the badges this pass unlocked (usually none), so the Check result can announce them.
   */
  recordPass: (problemId: string, today?: string) => BadgeId[]
}

export const useBadgesStore = create<BadgesState>()((set, get) => ({
  unlocked: loadList(BADGES_KEY).filter((id): id is BadgeId => badgeIds.includes(id as BadgeId)),
  passDays: loadList(PASS_DAYS_KEY),
  passedProblems: loadList(PASSED_PROBLEMS_KEY),

  recordPass: (problemId, today = localDate()) => {
    const { unlocked, passDays, passedProblems } = get()
    const nextDays = passDays.includes(today) ? passDays : [...passDays, today]
    const nextProblems = passedProblems.includes(problemId) ? passedProblems : [...passedProblems, problemId]

    const earned: BadgeId[] = ['firstSolve']
    if (nextDays.length >= ACTIVE_DAYS_GOAL) earned.push('activeDays')
    const newBadges = earned.filter((id) => !unlocked.includes(id))

    if (nextDays !== passDays) saveList(PASS_DAYS_KEY, nextDays)
    if (nextProblems !== passedProblems) saveList(PASSED_PROBLEMS_KEY, nextProblems)
    if (newBadges.length > 0) saveList(BADGES_KEY, [...unlocked, ...newBadges])
    set({ unlocked: [...unlocked, ...newBadges], passDays: nextDays, passedProblems: nextProblems })
    return newBadges
  },
}))
