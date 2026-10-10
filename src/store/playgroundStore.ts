import { create } from 'zustand'
import { examples, getExample } from '../data/examples'
import type { RunError } from '../engine/errors'
import { runUserCode } from '../engine/interpreter'
import type { ExampleProgram } from '../engine/types'

export type TabId = 'playground' | 'examples' | 'learn'

type PlaygroundState = {
  activeTab: TabId
  exampleId: string
  stepIndex: number
  isPlaying: boolean
  /** Text in the code editor. Starts as the loaded example's code and changes as the user types. */
  code: string
  /** Trace of the user's own code from the last successful Run, or null while an example's trace is shown. */
  userProgram: ExampleProgram | null
  /** Why the last Run failed. The previous trace stays on screen. */
  runError: RunError | null

  setTab: (tab: TabId) => void
  /** Load an example at its first step and switch to the Playground. */
  loadExample: (id: string) => void
  setCode: (code: string) => void
  next: () => void
  prev: () => void
  /** Go back to the first step and stop auto play. */
  reset: () => void
  /** Trace the code in the editor and play it from the first step. */
  run: () => void
  toggleAutoplay: () => void
}

/** The program whose steps the Playground is showing. */
function currentProgram(state: Pick<PlaygroundState, 'userProgram' | 'exampleId'>): ExampleProgram {
  return state.userProgram ?? getExample(state.exampleId)
}

export const usePlaygroundStore = create<PlaygroundState>()((set, get) => {
  const lastStepIndex = () => currentProgram(get()).steps.length - 1

  return {
    activeTab: 'playground',
    exampleId: examples[0].id,
    stepIndex: 0,
    isPlaying: false,
    code: examples[0].code.join('\n'),
    userProgram: null,
    runError: null,

    // Leaving the Playground pauses auto play so it doesn't run unseen.
    setTab: (tab) => set({ activeTab: tab, isPlaying: false }),

    loadExample: (id) =>
      set({
        exampleId: id,
        code: getExample(id).code.join('\n'),
        userProgram: null,
        runError: null,
        stepIndex: 0,
        isPlaying: false,
        activeTab: 'playground',
      }),

    setCode: (code) => set({ code }),

    next: () => {
      const nextIndex = Math.min(get().stepIndex + 1, lastStepIndex())
      // Auto play stops by itself on the last step.
      set({ stepIndex: nextIndex, isPlaying: get().isPlaying && nextIndex < lastStepIndex() })
    },

    prev: () => set({ stepIndex: Math.max(get().stepIndex - 1, 0), isPlaying: false }),

    reset: () => set({ stepIndex: 0, isPlaying: false }),

    run: () => {
      const { code, exampleId } = get()
      const example = getExample(exampleId)

      // Unchanged example code plays its hand-authored trace.
      if (code === example.code.join('\n')) {
        set({ userProgram: null, runError: null, stepIndex: 0, isPlaying: true })
        return
      }

      const result = runUserCode(code)
      if ('error' in result) {
        // Keep the previous trace, back on its first step, and show what went wrong.
        set({ runError: result.error, stepIndex: 0, isPlaying: false })
        return
      }
      set({
        userProgram: { id: 'user', title: 'Your Code', tag: 'Custom', code: code.split('\n'), steps: result.steps },
        runError: null,
        stepIndex: 0,
        isPlaying: true,
      })
    },

    toggleAutoplay: () => {
      const { isPlaying, stepIndex } = get()
      if (isPlaying) {
        set({ isPlaying: false })
      } else if (stepIndex === lastStepIndex()) {
        // At the end, Auto Play starts over from the beginning.
        set({ stepIndex: 0, isPlaying: true })
      } else {
        set({ isPlaying: true })
      }
    },
  }
})

/** The program loaded in the Playground: an example, or the user's own code after Run. */
export function useCurrentExample() {
  const userProgram = usePlaygroundStore((state) => state.userProgram)
  const exampleId = usePlaygroundStore((state) => state.exampleId)
  return currentProgram({ userProgram, exampleId })
}
