import { create } from 'zustand'
import { examples, getExample } from '../data/examples'

export type TabId = 'playground' | 'examples' | 'learn'

type PlaygroundState = {
  activeTab: TabId
  exampleId: string
  stepIndex: number
  isPlaying: boolean

  setTab: (tab: TabId) => void
  /** Load an example at its first step and switch to the Playground. */
  loadExample: (id: string) => void
  next: () => void
  prev: () => void
  /** Go back to the first step and stop auto play. */
  reset: () => void
  /** Play the whole program from the first step. */
  run: () => void
  toggleAutoplay: () => void
}

export const usePlaygroundStore = create<PlaygroundState>()((set, get) => {
  const lastStepIndex = () => getExample(get().exampleId).steps.length - 1

  return {
    activeTab: 'playground',
    exampleId: examples[0].id,
    stepIndex: 0,
    isPlaying: false,

    // Leaving the Playground pauses auto play so it doesn't run unseen.
    setTab: (tab) => set({ activeTab: tab, isPlaying: false }),

    loadExample: (id) => set({ exampleId: id, stepIndex: 0, isPlaying: false, activeTab: 'playground' }),

    next: () => {
      const nextIndex = Math.min(get().stepIndex + 1, lastStepIndex())
      // Auto play stops by itself on the last step.
      set({ stepIndex: nextIndex, isPlaying: get().isPlaying && nextIndex < lastStepIndex() })
    },

    prev: () => set({ stepIndex: Math.max(get().stepIndex - 1, 0), isPlaying: false }),

    reset: () => set({ stepIndex: 0, isPlaying: false }),

    run: () => set({ stepIndex: 0, isPlaying: true }),

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

/** The example currently loaded in the Playground. */
export function useCurrentExample() {
  return getExample(usePlaygroundStore((state) => state.exampleId))
}
