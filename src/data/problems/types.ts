import type { Locale } from '../../store/settingsStore'

/** Text written out in every language the app supports. A missing language is a type error. */
export type LocalizedText = Record<Locale, string>

/** The topic a problem practises. The Problems screen lists topics in the order of `problemTopics`. */
export type ProblemTopic = 'conditions' | 'while' | 'for' | 'arrays' | 'functions'

export type Difficulty = 'easy' | 'medium' | 'hard'

/**
 * What the student does: `write` a program for the task, or `debug` the program in the starter code,
 * which has a mistake. Both are checked the same way, by the output of the code in the editor.
 */
export type ProblemKind = 'write' | 'debug'

/**
 * One run of the student's program: what it must print, exactly as the Console would show it.
 * `input` is what scanf reads, written like the Playground's Input field (values separated by spaces).
 * Left out, the program gets no input: the shorthand for a problem that doesn't use scanf.
 */
export type TestCase = {
  input?: string
  expectedOutput: string
}

/** A task the student solves by writing (or fixing) a program; Check compares its output with `testCases`. */
export type Problem = {
  id: string
  title: LocalizedText
  topic: ProblemTopic
  difficulty: Difficulty
  kind: ProblemKind
  /**
   * What the student has to do. Blank lines separate paragraphs; text between `backticks` is shown as code.
   * For a `debug` problem: what the program is supposed to do, never where the mistake is.
   */
  statement: LocalizedText
  /**
   * Code the editor starts with, one entry per line. Left out, the editor starts empty.
   * A `debug` problem always has it: the program with the mistake.
   */
  starterCode?: string[]
  testCases: TestCase[]
}
