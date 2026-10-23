import { create } from 'zustand'
import { examples, getExample } from '../data/examples'
import { getProblem } from '../data/problems'
import type { Problem } from '../data/problems/types'
import { UnsupportedConstructError, isMissingInput, type RunError } from '../engine/errors'
import { runUserCode, usesScanf } from '../engine/interpreter'
import { checkSolution, type CheckResult } from '../features/problems/checkSolution'
import { track } from '../lib/analytics'
import { useBadgesStore, type BadgeId } from './badgesStore'
import type { ExampleProgram } from '../engine/types'

export type TabId = 'playground' | 'examples' | 'problems' | 'learn'

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
  /** The code that last Run failed on, so an edit after it can be spotted (see `staleness`). */
  failedCode: string | null
  /** The Input field's text: the values scanf reads, separated by spaces. */
  input: string
  /** The last Run failed for lack of Input values. The field shows an error state until the user types or a Run succeeds. */
  inputMissing: boolean
  /** The Input field is folded into a one-line summary of its values, after a Run that used them. */
  inputCollapsed: boolean
  /** The problem open in the Playground (its statement and Check show above the editor), or null for an example. */
  problemId: string | null
  /** What the last Check found. Kept after an edit, so the student can compare while fixing their code. */
  checkResult: CheckResult | null
  /** The code the last Check ran, so the result can say when the editor no longer holds it. */
  checkedCode: string | null
  /** Badges the last Check unlocked, announced in its result box (usually none). */
  newBadges: BadgeId[]

  setTab: (tab: TabId) => void
  /** Load an example at its first step and switch to the Playground. */
  loadExample: (id: string) => void
  /** Open a problem in the Playground: its starter code (or an empty editor), and no trace until a Run. */
  loadProblem: (id: string) => void
  /** Run the editor's code against the open problem's test cases. Doesn't touch the trace. */
  check: () => void
  setCode: (code: string) => void
  setInput: (input: string) => void
  /** Open the collapsed Input summary back into the editable field. */
  expandInput: () => void
  next: () => void
  prev: () => void
  /**
   * Go back to the first step, stop auto play, clear the error, and empty the Input field (opened up again).
   * The code in the editor is left exactly as it is.
   */
  reset: () => void
  /** Trace the code in the editor and play it from the first step. */
  run: () => void
  toggleAutoplay: () => void
}

/**
 * What the Execution panel shows for a problem before its first Run: one empty step over the starter code,
 * saying to press Run. Line 0 means no line is highlighted.
 */
function problemStartProgram(problem: Problem): ExampleProgram {
  const code = problem.starterCode ?? ['']
  return {
    id: `problem-${problem.id}`,
    title: problem.title.en,
    tag: problem.topic,
    code,
    steps: [
      {
        line: 0,
        scope: 'main()',
        variables: [],
        changed: [],
        array: null,
        loop: null,
        output: '',
        explanation: [{ key: 'step.problemStart' }],
      },
    ],
  }
}

/** The program whose steps the Playground is showing. */
function currentProgram(state: Pick<PlaygroundState, 'userProgram' | 'exampleId'>): ExampleProgram {
  return state.userProgram ?? getExample(state.exampleId)
}

/**
 * What on screen no longer matches the code in the editor, because the code was edited after it was made.
 * `traceStale`: the steps shown were traced from different code (an edit, or a failed Run, which keeps the
 * old trace). `errorStale`: the code was edited after the Run that failed. Stale things are dimmed, and
 * a stale trace can't be stepped through, until a Run (or undoing the edit) makes them match again.
 */
export function staleness(
  state: Pick<PlaygroundState, 'code' | 'userProgram' | 'exampleId' | 'runError' | 'failedCode'>,
) {
  return {
    traceStale: state.code !== currentProgram(state).code.join('\n'),
    errorStale: state.runError !== null && state.code !== state.failedCode,
  }
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
    failedCode: null,
    input: '',
    inputMissing: false,
    inputCollapsed: false,
    problemId: null,
    checkResult: null,
    checkedCode: null,
    newBadges: [],

    // Leaving the Playground pauses auto play so it doesn't run unseen.
    setTab: (tab) => set({ activeTab: tab, isPlaying: false }),

    loadExample: (id) =>
      set({
        exampleId: id,
        code: getExample(id).code.join('\n'),
        userProgram: null,
        runError: null,
        failedCode: null,
        inputMissing: false,
        inputCollapsed: false,
        stepIndex: 0,
        isPlaying: false,
        activeTab: 'playground',
        problemId: null,
        checkResult: null,
        checkedCode: null,
        newBadges: [],
      }),

    loadProblem: (id) => {
      const problem = getProblem(id)
      if (!problem) return
      const program = problemStartProgram(problem)
      set({
        problemId: id,
        code: program.code.join('\n'),
        userProgram: program,
        runError: null,
        failedCode: null,
        input: '',
        inputMissing: false,
        inputCollapsed: false,
        stepIndex: 0,
        isPlaying: false,
        activeTab: 'playground',
        checkResult: null,
        checkedCode: null,
        newBadges: [],
      })
    },

    check: () => {
      const { problemId, code } = get()
      const problem = problemId === null ? undefined : getProblem(problemId)
      if (!problem) return
      // No analytics here: a student's attempts and results are never sent anywhere.
      // Badges are the one exception, kept in this browser's localStorage only (see badgesStore).
      const checkResult = checkSolution(problem, code)
      const newBadges = checkResult.passed ? useBadgesStore.getState().recordPass() : []
      set({ checkResult, checkedCode: code, newBadges })
    },

    // An edit can leave the trace on screen out of date, so auto play stops.
    setCode: (code) => {
      if (code !== get().code) set({ code, isPlaying: false })
    },

    setInput: (input) => set({ input, inputMissing: false }),

    expandInput: () => set({ inputCollapsed: false }),

    // Stepping is off while the trace no longer matches the code; only a Run makes a new one.
    next: () => {
      if (staleness(get()).traceStale) return
      const nextIndex = Math.min(get().stepIndex + 1, lastStepIndex())
      // Auto play stops by itself on the last step.
      set({ stepIndex: nextIndex, isPlaying: get().isPlaying && nextIndex < lastStepIndex() })
    },

    prev: () => {
      if (staleness(get()).traceStale) return
      set({ stepIndex: Math.max(get().stepIndex - 1, 0), isPlaying: false })
    },

    // The code is left as typed, so a trace that no longer matches it stays stale until a Run.
    reset: () =>
      set({
        stepIndex: 0,
        isPlaying: false,
        runError: null,
        failedCode: null,
        input: '',
        inputMissing: false,
        inputCollapsed: false,
      }),

    run: () => {
      const { code, exampleId, input, problemId } = get()
      const example = getExample(exampleId)

      // Unchanged example code plays its hand-authored trace. A problem always traces the student's code.
      if (problemId === null && code === example.code.join('\n')) {
        track('code_run', { source: 'example' })
        set({ userProgram: null, runError: null, failedCode: null, inputMissing: false, stepIndex: 0, isPlaying: true })
        return
      }

      track('code_run', { source: 'custom' })
      const result = runUserCode(code, input)
      if ('error' in result) {
        track('code_run_error', {
          errorType: result.error instanceof UnsupportedConstructError ? 'UnsupportedConstructError' : 'CodeError',
        })
        // Keep the previous trace, back on its first step, and show what went wrong.
        // The Input field opens up again, since the problem may be in its values.
        set({
          runError: result.error,
          failedCode: code,
          inputMissing: isMissingInput(result.error),
          inputCollapsed: false,
          stepIndex: 0,
          isPlaying: false,
        })
        return
      }
      set({
        userProgram: { id: 'user', title: 'Your Code', tag: 'Custom', code: code.split('\n'), steps: result.steps },
        runError: null,
        failedCode: null,
        inputMissing: false,
        // The values were used, so fold them into a summary; there's nothing to fold when none were typed.
        inputCollapsed: usesScanf(code) && input.trim() !== '',
        stepIndex: 0,
        isPlaying: true,
      })
    },

    toggleAutoplay: () => {
      const { isPlaying, stepIndex } = get()
      if (staleness(get()).traceStale) return
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

/** Whether the trace and the error on screen are out of date with the editor's code (see `staleness`). */
export function useStaleness() {
  const traceStale = usePlaygroundStore((state) => staleness(state).traceStale)
  const errorStale = usePlaygroundStore((state) => staleness(state).errorStale)
  return { traceStale, errorStale }
}
