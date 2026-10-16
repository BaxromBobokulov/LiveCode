import { beforeEach, describe, expect, it } from 'vitest'
import { CodeError } from '../engine/errors'
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
  beforeEach(() => store.setState(store.getInitialState(), true))

  it('opens a problem in the Playground with its starter code and no trace yet', () => {
    store.getState().loadProblem('absoluteValue')
    const state = store.getState()
    expect(state.activeTab).toBe('playground')
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
})
