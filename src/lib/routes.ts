import { examples } from '../data/examples'
import { problems } from '../data/problems'
import type { Problem } from '../data/problems/types'
import type { ExampleProgram } from '../engine/types'

// Every section, problem and example has its own URL (see docs/specs/0002-url-routing-sections-items.md).
// The URL decides which section shows and which item is open; the store follows it.

export type TabId = 'playground' | 'examples' | 'problems' | 'learn'

/** What a URL names. `kind` and `slug` are set for an item URL (/problems/discount). */
export type Route =
  | { tab: TabId; kind: null }
  | { tab: 'playground'; kind: 'problem' | 'example'; slug: string }

/** The result of reading a path: the route, plus the path to replace it with when it isn't the tidy form. */
export type ParsedRoute = { route: Route; redirect: string | null }

/** An item's id in a URL: camelCase to kebab case, so bubbleSort is bubble-sort. */
export function toSlug(id: string): string {
  return id.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

export function findProblemBySlug(slug: string): Problem | undefined {
  return problems.find((problem) => toSlug(problem.id) === slug.toLowerCase())
}

export function findExampleBySlug(slug: string): ExampleProgram | undefined {
  return examples.find((example) => toSlug(example.id) === slug.toLowerCase())
}

export function problemPath(id: string): string {
  return `/problems/${toSlug(id)}`
}

export function examplePath(id: string): string {
  return `/examples/${toSlug(id)}`
}

const sectionPaths: Record<Exclude<TabId, 'playground'>, string> = {
  examples: '/examples',
  problems: '/problems',
  learn: '/learn',
}

/** The Playground tab's URL: the open problem, else the loaded example. */
export function playgroundPath(state: { problemId: string | null; exampleId: string }): string {
  return state.problemId !== null ? problemPath(state.problemId) : examplePath(state.exampleId)
}

export function sectionPath(tab: Exclude<TabId, 'playground'>): string {
  return sectionPaths[tab]
}

/**
 * Reads a path. A path with capitals or a trailing slash is still understood, and `redirect` gives its tidy
 * form. An unknown item goes to its section's list, any other unknown path to /.
 */
export function parseRoute(pathname: string): ParsedRoute {
  const tidy = pathname.toLowerCase().replace(/\/+$/, '') || '/'
  const parts = tidy.split('/').filter(Boolean)
  const withRedirect = (route: Route, path: string): ParsedRoute => ({
    route,
    redirect: path === pathname ? null : path,
  })

  if (parts.length === 0) return withRedirect({ tab: 'playground', kind: null }, '/')

  const [section, slug, ...rest] = parts
  if (rest.length > 0) return unknown(section)

  if (section === 'learn' && slug === undefined) return withRedirect({ tab: 'learn', kind: null }, tidy)
  if (section === 'examples' || section === 'problems') {
    if (slug === undefined) return withRedirect({ tab: section, kind: null }, tidy)
    const found = section === 'problems' ? findProblemBySlug(slug) : findExampleBySlug(slug)
    if (!found) return { route: { tab: section, kind: null }, redirect: sectionPaths[section] }
    const kind = section === 'problems' ? 'problem' : 'example'
    return withRedirect({ tab: 'playground', kind, slug: toSlug(found.id) }, tidy)
  }
  return unknown(section)
}

function unknown(section: string): ParsedRoute {
  if (section === 'examples' || section === 'problems') {
    return { route: { tab: section, kind: null }, redirect: sectionPaths[section] }
  }
  return { route: { tab: 'playground', kind: null }, redirect: '/' }
}
