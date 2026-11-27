import { describe, expect, it } from 'vitest'
import { examples } from '../data/examples'
import { problems } from '../data/problems'
// The built site serves this file as is (Vite copies public/), so the test reads the same text.
import sitemap from '../../public/sitemap.xml?raw'
import { examplePath, parseRoute, playgroundPath, problemPath, toSlug } from './routes'

describe('toSlug', () => {
  it('turns a camelCase id into kebab case', () => {
    expect(toSlug('bubbleSort')).toBe('bubble-sort')
    expect(toSlug('largerOfTwo')).toBe('larger-of-two')
    expect(toSlug('discount')).toBe('discount')
    expect(toSlug('sum2')).toBe('sum2')
  })

  it('gives every problem and every example its own slug', () => {
    for (const items of [problems, examples]) {
      const slugs = items.map((item) => toSlug(item.id))
      expect(new Set(slugs).size).toBe(slugs.length)
    }
  })
})

describe('parseRoute', () => {
  it('reads each section', () => {
    expect(parseRoute('/')).toEqual({ route: { tab: 'playground', kind: null }, redirect: null })
    expect(parseRoute('/examples')).toEqual({ route: { tab: 'examples', kind: null }, redirect: null })
    expect(parseRoute('/problems')).toEqual({ route: { tab: 'problems', kind: null }, redirect: null })
    expect(parseRoute('/learn')).toEqual({ route: { tab: 'learn', kind: null }, redirect: null })
  })

  it('opens a problem or an example in the Playground', () => {
    expect(parseRoute('/problems/discount')).toEqual({
      route: { tab: 'playground', kind: 'problem', slug: 'discount' },
      redirect: null,
    })
    expect(parseRoute('/examples/bubble-sort')).toEqual({
      route: { tab: 'playground', kind: 'example', slug: 'bubble-sort' },
      redirect: null,
    })
  })

  it('understands capitals and a trailing slash, and gives the tidy path to replace them with', () => {
    expect(parseRoute('/problems/Larger-Of-Two/')).toEqual({
      route: { tab: 'playground', kind: 'problem', slug: 'larger-of-two' },
      redirect: '/problems/larger-of-two',
    })
    expect(parseRoute('/Learn/').redirect).toBe('/learn')
  })

  it('sends an unknown item to its list, and any other unknown path home', () => {
    expect(parseRoute('/problems/no-such-problem')).toEqual({
      route: { tab: 'problems', kind: null },
      redirect: '/problems',
    })
    expect(parseRoute('/examples/nope').redirect).toBe('/examples')
    expect(parseRoute('/problems/discount/extra').redirect).toBe('/problems')
    expect(parseRoute('/whatever').redirect).toBe('/')
    expect(parseRoute('/learn/something').redirect).toBe('/')
  })

  it('reads back every item path it makes', () => {
    for (const problem of problems) expect(parseRoute(problemPath(problem.id)).redirect).toBeNull()
    for (const example of examples) expect(parseRoute(examplePath(example.id)).redirect).toBeNull()
  })
})

describe('playgroundPath', () => {
  it('is the open problem, else the loaded example', () => {
    expect(playgroundPath({ problemId: 'largerOfTwo', exampleId: 'sum' })).toBe('/problems/larger-of-two')
    expect(playgroundPath({ problemId: null, exampleId: 'bubbleSort' })).toBe('/examples/bubble-sort')
  })
})

describe('sitemap.xml', () => {
  it('lists every section, example and problem URL, and nothing else', () => {
    const listed = [...sitemap.matchAll(/<loc>https:\/\/livecode\.uz(.*?)<\/loc>/g)].map((match) => match[1]).sort()
    const expected = [
      '/',
      '/examples',
      '/problems',
      '/learn',
      ...examples.map((example) => examplePath(example.id)),
      ...problems.map((problem) => problemPath(problem.id)),
    ].sort()
    expect(listed).toEqual(expected)
  })
})
