import { create } from 'zustand'
import { examples, getExample } from '../data/examples'
import { getProblem, problems } from '../data/problems'
import type { Problem } from '../data/problems/types'
import { UnsupportedConstructError, constructName, isMissingInput, missingInputPhrase, type RunError } from '../engine/errors'
import { runUserCode, usesScanf } from '../engine/interpreter'
import { checkSolution, type CheckResult } from '../features/problems/checkSolution'
import { pickRandomProblem } from '../features/problems/problemList'
import { track } from '../lib/analytics'
import { useBadgesStore, type BadgeId } from './badgesStore'
import type { ExampleProgram } from '../engine/types'

type PlaygroundState = {
  exampleId: string
  stepIndex: number
  isPlaying: boolean
  /** Text in the code editor. Starts as the loaded example's code and changes as the user types. */
  code: string
  /** Trace of the user's own code from the last successful Run, or null while an example's trace is shown. */
  userProgram: ExampleProgram | null
  /** Why the last Run failed. While it is set, the Execution panel shows the error instead of the older trace. */
  runError: RunError | null
  /** The code that last Run failed on, so an edit after it can be spotted (see `staleness`). */
  failedCode: string | null
  /** The Input field's text: the values scanf reads, separated by spaces. */
  input: string
  /** The last Run failed for lack of Input values. The field shows an error state until the user types or a Run succeeds. */
  inputMissing: boolean
  /** The Input field is folded into a one-line summary of its values, after a Run that used them. */
  inputCollapsed: boolean
  /**
   * Run was pressed, but the code would run out of Input values, so it asked for them instead of running.
   * `needed` is the value scanf would stop at, `given` how many the field has. Typing, an edit or any Run clears it.
   */
  inputPrompt: { needed: number; given: number } | null
  /** The problem open in the Playground (its statement and Check show above the editor), or null for an example. */
  problemId: string | null
  /** What the last Check found. Kept after an edit, so the student can compare while fixing their code. */
  checkResult: CheckResult | null
  /** The code the last Check ran, so the result can say when the editor no longer holds it. */
  checkedCode: string | null
  /** Badges the last Check unlocked, announced in its result box (usually none). */
  newBadges: BadgeId[]
  /** The open problem came from "Random problem" with nothing left to solve; its panel says so. */
  allProblemsSolved: boolean
  /**
   * This page load found a saved problem or example that still exists, so a bare / is replaced with its URL
   * (see useRouteSync). Never changes after startup.
   */
  restoredFromSave: boolean

  /** Stop auto play, e.g. when leaving the Playground so it doesn't run unseen. */
  pause: () => void
  /** Load an example at its first step. The URL decides which screen shows. */
  loadExample: (id: string) => void
  /** Open a problem: its starter code (or an empty editor), and no trace until a Run. */
  loadProblem: (id: string) => void
  /** Open a random problem the student hasn't passed yet, or any random one if all are passed. */
  loadRandomProblem: () => void
  /** Run the editor's code against the open problem's test cases. Doesn't touch the trace. */
  check: () => void
  setCode: (code: string) => void
  setInput: (input: string) => void
  /** Open the collapsed Input summary back into the editable field. */
  expandInput: () => void
  /**
   * Called before Run. If the code would run out of Input values, sets `inputPrompt` (field opened up) and
   * returns true, so the caller shows the field instead of running. With the prompt already up for this
   * code and input, returns false: a second Run runs anyway.
   */
  promptForInput: () => boolean
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
        explanation: [{ key: problem.kind === 'debug' ? 'step.debugProblemStart' : 'step.problemStart' }],
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

/** Unchanged example code plays its hand-authored trace on Run. A problem always traces the student's code. */
function playsExampleTrace(code: string, exampleId: string, problemId: string | null): boolean {
  return problemId === null && code === getExample(exampleId).code.join('\n')
}

// The editor's code is saved in this browser's localStorage (never sent anywhere), so a reload brings it back
// instead of the first example. Written CODE_SAVE_DELAY_MS after the last edit, not on every keystroke.
// The open problem (or the loaded example) is saved with it, so a reload reopens the code where it was written:
// a problem's code comes back with its statement and Check, not as "My code" beside the first example.
const CODE_KEY = 'livecode.code'
const PROBLEM_KEY = 'livecode.problemId'
const EXAMPLE_KEY = 'livecode.exampleId'
const CODE_SAVE_DELAY_MS = 500

// localStorage can throw (private mode, blocked site data) or be missing (tests run in Node).
function loadSaved(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Saves `value` under `key`, or removes the key for null. */
function saveValue(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Not saved; the code stays in the editor until the page is reloaded.
  }
}

export const usePlaygroundStore = create<PlaygroundState>()((set, get) => {
  const lastStepIndex = () => currentProgram(get()).steps.length - 1

  // What the last visit had open. An id that no longer exists (a removed problem or example) is ignored.
  const savedProblem = getProblem(loadSaved(PROBLEM_KEY) ?? '')
  const savedExampleId = loadSaved(EXAMPLE_KEY)
  const hasSavedExample = examples.some((example) => example.id === savedExampleId)
  const exampleId = hasSavedExample ? savedExampleId! : examples[0].id
  const startProgram = savedProblem ? problemStartProgram(savedProblem) : getExample(exampleId)

  return {
    exampleId,
    stepIndex: 0,
    isPlaying: false,
    code: loadSaved(CODE_KEY) ?? startProgram.code.join('\n'),
    // A reopened problem shows its own "press Run" step, like after loadProblem.
    userProgram: savedProblem ? startProgram : null,
    runError: null,
    failedCode: null,
    input: '',
    inputMissing: false,
    inputCollapsed: false,
    inputPrompt: null,
    problemId: savedProblem ? savedProblem.id : null,
    checkResult: null,
    checkedCode: null,
    newBadges: [],
    allProblemsSolved: false,
    restoredFromSave: savedProblem !== undefined || hasSavedExample,

    pause: () => set({ isPlaying: false }),

    loadExample: (id) =>
      set({
        exampleId: id,
        code: getExample(id).code.join('\n'),
        userProgram: null,
        runError: null,
        failedCode: null,
        inputMissing: false,
        inputCollapsed: false,
        inputPrompt: null,
        stepIndex: 0,
        isPlaying: false,
        problemId: null,
        checkResult: null,
        checkedCode: null,
        newBadges: [],
        allProblemsSolved: false,
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
        inputPrompt: null,
        stepIndex: 0,
        isPlaying: false,
        checkResult: null,
        checkedCode: null,
        newBadges: [],
        allProblemsSolved: false,
      })
    },

    loadRandomProblem: () => {
      const { problem, allSolved } = pickRandomProblem(problems, useBadgesStore.getState().passedProblems)
      get().loadProblem(problem.id)
      set({ allProblemsSolved: allSolved })
    },

    check: () => {
      const { problemId, code } = get()
      const problem = problemId === null ? undefined : getProblem(problemId)
      if (!problem) return
      // No analytics here: a student's attempts and results are never sent anywhere.
      // Badges and passed problems are the one exception, kept in this browser's localStorage only (see badgesStore).
      const checkResult = checkSolution(problem, code)
      const newBadges = checkResult.passed ? useBadgesStore.getState().recordPass(problem.id) : []
      set({ checkResult, checkedCode: code, newBadges })
    },

    // An edit can leave the trace on screen out of date, so auto play stops.
    setCode: (code) => {
      if (code !== get().code) set({ code, isPlaying: false, inputPrompt: null })
    },

    setInput: (input) => set({ input, inputMissing: false, inputPrompt: null }),

    expandInput: () => set({ inputCollapsed: false }),

    // A trial run finds out exactly whether scanf would run out, also for a scanf only some paths reach.
    promptForInput: () => {
      const { code, exampleId, input, problemId, inputPrompt } = get()
      if (inputPrompt || !usesScanf(code) || playsExampleTrace(code, exampleId, problemId)) return false
      const result = runUserCode(code, input)
      const missing = 'error' in result ? missingInputPhrase(result.error) : null
      if (!missing) return false
      const given = Number(missing.values?.given)
      track('scanf_input_prompt_shown', { reason: given === 0 ? 'empty' : 'notEnough' })
      set({
        inputPrompt: { needed: Number(missing.values?.needed), given },
        inputCollapsed: false,
        isPlaying: false,
      })
      return true
    },

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
        inputPrompt: null,
      }),

    run: () => {
      const { code, exampleId, input, problemId } = get()
      set({ inputPrompt: null })

      if (playsExampleTrace(code, exampleId, problemId)) {
        track('code_run', { source: 'example' })
        set({ userProgram: null, runError: null, failedCode: null, inputMissing: false, stepIndex: 0, isPlaying: true })
        return
      }

      track('code_run', { source: 'custom' })
      const result = runUserCode(code, input)
      if ('error' in result) {
        const { error } = result
        track(
          'code_run_error',
          error instanceof UnsupportedConstructError
            ? { errorType: 'UnsupportedConstructError', construct: constructName(error), messageKey: error.text.key }
            : { errorType: 'CodeError' },
        )
        // Keep the previous trace (back on its first step) for when the error is cleared, and show what went wrong.
        // The Execution panel hides that older trace while the error is up, so it isn't taken for this code's.
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
        userProgram: { id: 'user', title: 'My code', tag: 'Custom', code: code.split('\n'), steps: result.steps },
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

// Save the code a moment after it stops changing. A save still waiting when the page is closed is done right
// away, so the last few keystrokes aren't lost.
let pendingCode: string | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined

function flushCodeSave() {
  clearTimeout(saveTimer)
  if (pendingCode !== null) saveValue(CODE_KEY, pendingCode)
  pendingCode = null
}

usePlaygroundStore.subscribe((state, previous) => {
  // Opening a problem or an example is one click, not typing: save it and its code right away, together,
  // so a reload never pairs one problem with another's code.
  if (state.problemId !== previous.problemId || state.exampleId !== previous.exampleId) {
    saveValue(PROBLEM_KEY, state.problemId)
    saveValue(EXAMPLE_KEY, state.exampleId)
    pendingCode = state.code
    flushCodeSave()
    return
  }
  if (state.code === previous.code) return
  pendingCode = state.code
  clearTimeout(saveTimer)
  saveTimer = setTimeout(flushCodeSave, CODE_SAVE_DELAY_MS)
})

// pagehide covers closing and reloading. Phones often kill a background tab without it, so going to the
// background (another app, the tab switcher, the screen locking) saves too.
if (typeof window !== 'undefined') window.addEventListener('pagehide', flushCodeSave)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushCodeSave()
  })
}

/**
 * Whether the editor holds the student's own code rather than the loaded example: the code was edited away
 * from it (or brought back from an earlier visit). The editor's title then says "My code", not the example's name.
 */
export function useIsOwnCode() {
  return usePlaygroundStore(
    (state) => state.problemId === null && state.code !== getExample(state.exampleId).code.join('\n'),
  )
}

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
