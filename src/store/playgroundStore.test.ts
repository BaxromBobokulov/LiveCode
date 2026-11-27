import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { examples } from '../data/examples'
import { problems } from '../data/problems'
import { CodeError } from '../engine/errors'
import { useBadgesStore } from './badgesStore'
import { staleness, usePlaygroundStore } from './playgroundStore'

const lines = (...code: string[]) => code.join('\n')

const broken = lines('#include <stdio.h>', 'int main() {', '    int i = 1', '    printf("i = %d\\n", i);', '    return 0;', '}')
const fixed = lines('#include <stdio.h>', 'int main() {', '    int i = 1;', '    i++;', '    printf("i = %d\\n", i);', '    return 0;', '}')

const store = usePlaygroundStore

describe('playgroundStore run / reset', () => {
  beforeEach(() => store.setState(store.getInitialState(), true))

  it('runs the edited code fresh after a failed Run, instead of repeating the old error', () => {
    store.getState().setCode(broken)
    store.getState().run()
    const firstError = store.getState().runError
    expect(firstError).toBeInstanceOf(CodeError)
    expect(firstError?.line).toBe(3)

    store.getState().setCode(fixed)
    store.getState().run()
    const { runError, userProgram, stepIndex } = store.getState()
    expect(runError).toBeNull()
    expect(stepIndex).toBe(0)
    expect(userProgram?.code).toEqual(fixed.split('\n'))
    const last = userProgram!.steps.at(-1)!
    expect(last.variables).toEqual([{ name: 'i', value: '2' }])
    expect(last.output).toBe('i = 2\n')
  })

  it('reports the new mistake when the edited code is still broken', () => {
    store.getState().setCode(broken)
    store.getState().run()
    expect(store.getState().runError?.line).toBe(3)

    // Line 3 fixed, but `return 0` on line 6 now misses its semicolon.
    store.getState().setCode(fixed.replace('return 0;', 'return 0'))
    store.getState().run()
    expect(store.getState().runError?.line).toBe(6)
  })

  it('Reset goes back to the first step of the current trace', () => {
    store.getState().setCode(fixed)
    store.getState().run()
    store.getState().next()
    store.getState().next()
    store.getState().reset()
    expect(store.getState().stepIndex).toBe(0)
    expect(store.getState().isPlaying).toBe(false)
    expect(store.getState().userProgram?.code).toEqual(fixed.split('\n'))
  })

  it('Reset clears the error but keeps the edited code, and the same Run shows the error again', () => {
    store.getState().setCode(broken)
    store.getState().run()
    store.getState().reset()
    expect(store.getState().runError).toBeNull()
    expect(store.getState().code).toBe(broken)

    store.getState().run()
    expect(store.getState().runError?.line).toBe(3)
  })

  it('flags the Input field only when a Run ran out of scanf values', () => {
    const readsOne = lines('int main() {', '    int a;', '    scanf("%d", &a);', '    return 0;', '}')
    store.getState().setCode(readsOne)
    store.getState().run()
    expect(store.getState().runError?.text.key).toBe('codeError.scanfNoInput')
    expect(store.getState().inputMissing).toBe(true)

    store.getState().setInput('abc')
    store.getState().run()
    expect(store.getState().runError).toBeInstanceOf(CodeError)
    expect(store.getState().inputMissing).toBe(false)

    store.getState().setCode(broken)
    store.getState().run()
    expect(store.getState().runError).toBeInstanceOf(CodeError)
    expect(store.getState().inputMissing).toBe(false)
  })
})

describe('playgroundStore asking for Input before Run', () => {
  beforeEach(() => store.setState(store.getInitialState(), true))

  const readsTwo = lines('int main() {', '    int a, b;', '    scanf("%d %d", &a, &b);', '    return 0;', '}')

  it('asks for values when the code would run out of them, and a second Run runs anyway', () => {
    store.getState().setCode(readsTwo)
    expect(store.getState().promptForInput()).toBe(true)
    expect(store.getState().inputPrompt).toEqual({ needed: 1, given: 0 })
    expect(store.getState().runError).toBeNull()

    expect(store.getState().promptForInput()).toBe(false)
    store.getState().run()
    expect(store.getState().inputMissing).toBe(true)
    expect(store.getState().inputPrompt).toBeNull()
  })

  it('counts values that are there but not enough, and typing clears the prompt', () => {
    store.getState().setCode(readsTwo)
    store.getState().setInput('5')
    expect(store.getState().promptForInput()).toBe(true)
    expect(store.getState().inputPrompt).toEqual({ needed: 2, given: 1 })

    store.getState().setInput('5 7')
    expect(store.getState().inputPrompt).toBeNull()
    expect(store.getState().promptForInput()).toBe(false)
  })

  it("doesn't ask when the values are there, or when the scanf isn't reached", () => {
    store.getState().setCode(readsTwo)
    store.getState().setInput('5 7')
    expect(store.getState().promptForInput()).toBe(false)

    const neverReads = lines('int main() {', '    int a = 0;', '    if (a > 1) {', '        scanf("%d", &a);', '    }', '    return 0;', '}')
    store.getState().setCode(neverReads)
    store.getState().setInput('')
    expect(store.getState().promptForInput()).toBe(false)
    expect(store.getState().inputPrompt).toBeNull()
  })

  it('opens a collapsed Input field so it can show the prompt', () => {
    const readsOne = lines('int main() {', '    int a;', '    scanf("%d", &a);', '    return 0;', '}')
    store.getState().setCode(readsOne)
    store.getState().setInput('5')
    store.getState().run()
    expect(store.getState().inputCollapsed).toBe(true)

    store.getState().setCode(readsTwo)
    expect(store.getState().promptForInput()).toBe(true)
    expect(store.getState().inputCollapsed).toBe(false)
  })
})

describe('playgroundStore stale trace', () => {
  beforeEach(() => store.setState(store.getInitialState(), true))

  it('an edit mid-step freezes the trace until the next Run', () => {
    store.getState().setCode(fixed)
    store.getState().run()
    store.getState().next()
    expect(store.getState().stepIndex).toBe(1)

    store.getState().setCode(fixed.replace('i++;', 'i += 2;'))
    expect(staleness(store.getState())).toEqual({ traceStale: true, errorStale: false })
    expect(store.getState().isPlaying).toBe(false)
    store.getState().next()
    store.getState().prev()
    store.getState().toggleAutoplay()
    expect(store.getState().stepIndex).toBe(1)
    expect(store.getState().isPlaying).toBe(false)

    store.getState().run()
    expect(staleness(store.getState()).traceStale).toBe(false)
    expect(store.getState().userProgram!.steps.at(-1)!.output).toBe('i = 3\n')
  })

  it('an edit after a failed Run marks the error stale; the old trace stays stale', () => {
    store.getState().setCode(broken)
    store.getState().run()
    expect(staleness(store.getState())).toEqual({ traceStale: true, errorStale: false })

    store.getState().setCode('\n' + broken)
    expect(staleness(store.getState())).toEqual({ traceStale: true, errorStale: true })
  })

  it('Reset after a failed Run keeps the old trace stale, since it no longer matches the code', () => {
    store.getState().setCode(broken)
    store.getState().run()
    store.getState().reset()
    expect(staleness(store.getState())).toEqual({ traceStale: true, errorStale: false })
  })

  it('undoing back to the traced code makes the trace current again', () => {
    const original = store.getState().code
    store.getState().setCode(original + '\n')
    expect(staleness(store.getState()).traceStale).toBe(true)
    store.getState().setCode(original)
    expect(staleness(store.getState()).traceStale).toBe(false)
  })
})

describe('playgroundStore problems', () => {
  beforeEach(() => {
    store.setState(store.getInitialState(), true)
    useBadgesStore.setState({ unlocked: [], passDays: [], passedProblems: [] })
  })

  it('opens a problem with its starter code and no trace yet', () => {
    store.getState().loadProblem('absoluteValue')
    const state = store.getState()
    expect(state.problemId).toBe('absoluteValue')
    expect(state.code).toContain('scanf("%d", &n);')
    expect(state.userProgram?.steps).toHaveLength(1)
    expect(staleness(state).traceStale).toBe(false)
  })

  it('starts with an empty editor when the problem has no starter code', () => {
    store.getState().loadProblem('digitSum')
    expect(store.getState().code).toBe('')
  })

  it('checks the code without changing the trace, and Run still traces it', () => {
    store.getState().loadProblem('absoluteValue')
    store.getState().setCode(store.getState().code.replace('scanf("%d", &n);', 'scanf("%d", &n);\n    if (n < 0) n = -n;'))
    store.getState().check()
    expect(store.getState().checkResult?.passed).toBe(true)
    expect(store.getState().userProgram?.steps).toHaveLength(1)

    store.getState().setInput('-7')
    store.getState().run()
    expect(store.getState().userProgram!.steps.at(-1)!.output).toBe('7\n')
  })

  it('closes the problem when an example is loaded', () => {
    store.getState().loadProblem('absoluteValue')
    store.getState().check()
    store.getState().loadExample('max')
    expect(store.getState().problemId).toBeNull()
    expect(store.getState().checkResult).toBeNull()
  })

  it('remembers a problem only after a Check that fully passes', () => {
    store.getState().loadProblem('absoluteValue')
    store.getState().check()
    expect(store.getState().checkResult?.passed).toBe(false)
    expect(useBadgesStore.getState().passedProblems).toEqual([])

    store.getState().setCode(store.getState().code.replace('scanf("%d", &n);', 'scanf("%d", &n);\n    if (n < 0) n = -n;'))
    store.getState().check()
    expect(useBadgesStore.getState().passedProblems).toEqual(['absoluteValue'])
  })

  it('opens an unsolved problem from "Random problem" while there is one', () => {
    const lastId = problems[problems.length - 1].id
    useBadgesStore.setState({ passedProblems: problems.slice(0, -1).map((problem) => problem.id) })
    store.getState().loadRandomProblem()
    expect(store.getState().problemId).toBe(lastId)
    expect(store.getState().allProblemsSolved).toBe(false)
  })

  it('still opens one from "Random problem" with all solved, says so, and forgets it on the next load', () => {
    useBadgesStore.setState({ passedProblems: problems.map((problem) => problem.id) })
    store.getState().loadRandomProblem()
    expect(store.getState().problemId).not.toBeNull()
    expect(store.getState().allProblemsSolved).toBe(true)

    store.getState().loadProblem('absoluteValue')
    expect(store.getState().allProblemsSolved).toBe(false)
  })
})

// The store reads the saved code and starts listening for edits when its module loads, so each test stubs
// localStorage (and window, for the pagehide flush) first and then imports a fresh copy of the module.
describe('playgroundStore code persistence', () => {
  let saved: Map<string, string>
  let pageHide: (() => void) | undefined

  async function freshStore() {
    vi.resetModules()
    const module = await import('./playgroundStore')
    return module.usePlaygroundStore
  }

  beforeEach(() => {
    vi.useFakeTimers()
    saved = new Map()
    pageHide = undefined
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
      removeItem: (key: string) => void saved.delete(key),
    })
    vi.stubGlobal('window', {
      addEventListener: (type: string, listener: () => void) => {
        if (type === 'pagehide') pageHide = listener
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts with the first example when nothing was saved', async () => {
    const fresh = await freshStore()
    expect(fresh.getState().code).toBe(examples[0].code.join('\n'))
  })

  it('brings back the code saved on an earlier visit', async () => {
    saved.set('livecode.code', 'int main() { return 1; }')
    const fresh = await freshStore()
    expect(fresh.getState().code).toBe('int main() { return 1; }')
  })

  it('waits until typing stops before saving, then saves only the last code', async () => {
    const fresh = await freshStore()
    fresh.getState().setCode('a')
    vi.advanceTimersByTime(300)
    fresh.getState().setCode('ab')
    vi.advanceTimersByTime(300)
    expect(saved.has('livecode.code')).toBe(false)

    vi.advanceTimersByTime(200)
    expect(saved.get('livecode.code')).toBe('ab')
  })

  it('saves a pending edit right away when the page is closed', async () => {
    const fresh = await freshStore()
    fresh.getState().setCode('unsaved yet')
    expect(pageHide).toBeTypeOf('function')
    pageHide!()
    expect(saved.get('livecode.code')).toBe('unsaved yet')
  })

  it('saves the code of a newly loaded example too, so a reload keeps it', async () => {
    const fresh = await freshStore()
    fresh.getState().setCode('edited')
    fresh.getState().loadExample(examples[1].id)
    vi.advanceTimersByTime(500)
    expect(saved.get('livecode.code')).toBe(examples[1].code.join('\n'))
  })

  it('saves a pending edit right away when the page goes to the background (phones), but not when it comes back', async () => {
    let visibilityChange: (() => void) | undefined
    const fakeDocument = {
      visibilityState: 'visible',
      addEventListener: (type: string, listener: () => void) => {
        if (type === 'visibilitychange') visibilityChange = listener
      },
    }
    vi.stubGlobal('document', fakeDocument)
    const fresh = await freshStore()
    expect(visibilityChange).toBeTypeOf('function')

    fresh.getState().setCode('typed on a phone')
    visibilityChange!() // still visible: the usual wait applies
    expect(saved.has('livecode.code')).toBe(false)

    fakeDocument.visibilityState = 'hidden'
    visibilityChange!()
    expect(saved.get('livecode.code')).toBe('typed on a phone')
  })

  it('reopens the same problem after a reload, with the edited code and no "My code" title', async () => {
    const before = await freshStore()
    before.getState().loadProblem('absoluteValue')
    before.getState().setCode('int main() { return 0; }')
    vi.advanceTimersByTime(500)

    const after = await freshStore()
    const { problemId, code, userProgram } = after.getState()
    expect(problemId).toBe('absoluteValue')
    expect(code).toBe('int main() { return 0; }')
    // The problem's own opening trace, not the first example's.
    expect(userProgram?.id).toBe('problem-absoluteValue')
    expect(after.getState().restoredFromSave).toBe(true)
  })

  it('reopens the same example after a reload', async () => {
    const before = await freshStore()
    before.getState().loadExample(examples[2].id)
    before.getState().setCode('edited')
    vi.advanceTimersByTime(500)

    const after = await freshStore()
    expect(after.getState().exampleId).toBe(examples[2].id)
    expect(after.getState().problemId).toBeNull()
    expect(after.getState().code).toBe('edited')
  })

  it('goes back to an example after a reload once the student left the problem for one', async () => {
    const before = await freshStore()
    before.getState().loadProblem('absoluteValue')
    before.getState().loadExample(examples[1].id)
    vi.advanceTimersByTime(500)

    const after = await freshStore()
    expect(after.getState().problemId).toBeNull()
    expect(after.getState().exampleId).toBe(examples[1].id)
  })

  it('ignores a saved problem or example id that no longer exists', async () => {
    saved.set('livecode.problemId', 'gone')
    saved.set('livecode.exampleId', 'gone')
    saved.set('livecode.code', 'kept')
    const after = await freshStore()
    expect(after.getState().problemId).toBeNull()
    expect(after.getState().exampleId).toBe(examples[0].id)
    expect(after.getState().code).toBe('kept')
    // Nothing usable was saved, so a bare / stays on /.
    expect(after.getState().restoredFromSave).toBe(false)
  })

  it('never uses the old "codevision." key, only "livecode."', async () => {
    const fresh = await freshStore()
    fresh.getState().setCode('x')
    vi.advanceTimersByTime(500)
    expect([...saved.keys()]).toEqual(['livecode.code'])
  })

  it('still works when localStorage throws (private mode, blocked site data)', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    const fresh = await freshStore()
    expect(fresh.getState().code).toBe(examples[0].code.join('\n'))
    fresh.getState().setCode('typed')
    expect(() => vi.advanceTimersByTime(500)).not.toThrow()
    expect(fresh.getState().code).toBe('typed')
  })
})
