import { beforeEach, describe, expect, it } from 'vitest'
import { CodeError } from '../engine/errors'
import { usePlaygroundStore } from './playgroundStore'

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
})
