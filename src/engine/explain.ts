// Turns what the interpreter just did into the plain-language sentences shown
// under the Variables panel. Every sentence is a fixed template (a translation
// key, see src/i18n/translations.ts) filled in with the concrete names and
// values of that step, so the Playground can show it in the chosen language.
//
// Values are passed in three forms:
//   source — the expression as written:            "sum + arr[i]"
//   work   — the same with each value filled in:   "4 + 8"
//   result — what it evaluated to:                 "12"

import type { Phrase } from './types'

/** A value as it appears in an explanation. */
export type Shown = { source: string; work: string; result: string }

export type StepFact =
  | { kind: 'declare'; name: string; value: Shown | null }
  | { kind: 'declareArray'; name: string; type: string; size: number; values: string[] | null }
  | { kind: 'declareGrid'; name: string; type: string; rows: number; cols: number; values: string[][] | null }
  /** A 2D array cell read while working out this line, e.g. target "grid[1][2]". */
  | { kind: 'readCell'; target: string; value: string }
  | { kind: 'assign'; target: string; value: Shown }
  | { kind: 'update'; target: string; op: '++' | '--'; result: string }
  | { kind: 'expr'; value: Shown }
  | {
      kind: 'loopCheck'
      /** What ran just before the check: the loop's init (first check) or update (later checks). */
      setup: StepFact[]
      isFirst: boolean
      /** null for `for (;;)`, which has no condition. */
      condition: Shown | null
      result: boolean
    }
  | {
      kind: 'ifCheck'
      branch: 'if' | 'else if'
      condition: Shown
      result: boolean
      /** What comes after this branch when the condition is false. */
      next: 'else if' | 'else' | 'nothing'
    }
  | { kind: 'call'; name: string; args: string[]; params: { name: string; value: string; isArray: boolean }[] }
  | { kind: 'return'; name: string; value: Shown | null; caller: string | null }
  | { kind: 'end'; name: string; caller: string | null }
  | { kind: 'print'; text: string }
  /** scanf stored the next input value in `target`. */
  | { kind: 'scan'; target: string; value: string }

/** "sum + arr[i]: 4 + 8 = 12", "arr[i] (19)" or just "5", depending on how much there is to show. Only code and numbers, so no translation. */
function showValue({ source, work, result }: Shown): string {
  if (source === result) return result
  if (work === result || work === source) return `${source} (${result})`
  return `${source}: ${work} = ${result}`
}

/** "i < 5: 0 < 5 is true" */
function showCondition({ source, work }: Shown, result: boolean): Phrase {
  const truth: Phrase = { key: result ? 'explain.true' : 'explain.false' }
  return work === source
    ? { key: 'explain.condition', values: { source, result: truth } }
    : { key: 'explain.conditionWork', values: { source, work, result: truth } }
}

/** "an int" or "a float" */
function typeName(type: string): Phrase {
  return { key: type === 'int' ? 'explain.type.int' : 'explain.type.float' }
}

/**
 * Short form used inside a loop check: "set i to 0", "increase i to 1".
 * `capital` picks the form that starts a sentence ("Increase i to 1").
 */
function shortPhrase(fact: StepFact, capital: boolean): Phrase {
  switch (fact.kind) {
    case 'declare':
      return fact.value
        ? { key: capital ? 'explain.shortCap.createValue' : 'explain.short.createValue', values: { name: fact.name, value: fact.value.result } }
        : { key: capital ? 'explain.shortCap.create' : 'explain.short.create', values: { name: fact.name } }
    case 'assign':
      return { key: capital ? 'explain.shortCap.set' : 'explain.short.set', values: { target: fact.target, value: fact.value.result } }
    case 'update': {
      const values = { target: fact.target, value: fact.result }
      if (fact.op === '++') return { key: capital ? 'explain.shortCap.increase' : 'explain.short.increase', values }
      return { key: capital ? 'explain.shortCap.decrease' : 'explain.short.decrease', values }
    }
    default: {
      // Only declarations, assignments, updates and plain expressions can sit in a for (...) header.
      const value = fact.kind === 'expr' ? showValue(fact.value) : ''
      return { key: capital ? 'explain.shortCap.expr' : 'explain.short.expr', values: { value } }
    }
  }
}

/** The sentences describing one fact, usually just one. */
export function explain(fact: StepFact): Phrase[] {
  switch (fact.kind) {
    case 'declare':
      return [
        fact.value
          ? { key: 'explain.declareValue', values: { name: fact.name, value: showValue(fact.value) } }
          : { key: 'explain.declareEmpty', values: { name: fact.name } },
      ]

    case 'declareArray': {
      const values = { type: typeName(fact.type), name: fact.name, size: fact.size }
      return [
        fact.values
          ? { key: 'explain.declareArrayValues', values: { ...values, values: fact.values.join(', ') } }
          : { key: 'explain.declareArrayEmpty', values },
      ]
    }

    case 'declareGrid': {
      const values = { type: typeName(fact.type), name: fact.name, rows: fact.rows, cols: fact.cols }
      return [
        fact.values
          ? {
              key: 'explain.declareGridValues',
              values: { ...values, values: fact.values.map((row) => `[${row.join(', ')}]`).join(', ') },
            }
          : { key: 'explain.declareGridEmpty', values },
      ]
    }

    case 'readCell':
      return [{ key: 'explain.readCell', values: { target: fact.target, value: fact.value } }]

    // Writes to a 2D cell use this too: the target names the exact cell, e.g. "Set grid[0][0] to grid[i][j] + 1: 4 + 1 = 5."
    case 'assign':
      return [{ key: 'explain.assign', values: { target: fact.target, value: showValue(fact.value) } }]

    case 'update':
      return [
        {
          key: fact.op === '++' ? 'explain.increase' : 'explain.decrease',
          values: { target: fact.target, result: fact.result },
        },
      ]

    case 'expr':
      return [{ key: 'explain.expr', values: { value: showValue(fact.value) } }]

    case 'loopCheck': {
      const sentences: Phrase[] = []
      if (fact.isFirst) {
        sentences.push(
          fact.setup.length > 0
            ? { key: 'explain.loopStartWith', values: { steps: fact.setup.map((f) => shortPhrase(f, false)) } }
            : { key: 'explain.loopStart' },
        )
      } else if (fact.setup.length > 0) {
        const steps = fact.setup.map((f, i) => shortPhrase(f, i === 0))
        sentences.push({ key: 'explain.loopSetup', values: { steps } })
      }

      let outcome: Phrase
      if (fact.result) outcome = { key: fact.isFirst ? 'explain.loop.run' : 'explain.loop.runAgain' }
      else outcome = { key: fact.isFirst ? 'explain.loop.never' : 'explain.loop.ends' }
      sentences.push(
        fact.condition
          ? { key: 'explain.loopCheck', values: { condition: showCondition(fact.condition, fact.result), outcome } }
          : { key: 'explain.loopNoCondition', values: { outcome } },
      )
      return sentences
    }

    case 'ifCheck': {
      let outcome: Phrase
      if (fact.result) outcome = { key: fact.branch === 'if' ? 'explain.if.runIf' : 'explain.if.runElseIf' }
      else if (fact.next === 'else if') outcome = { key: 'explain.if.next' }
      else if (fact.next === 'else') outcome = { key: 'explain.if.runElse' }
      else outcome = { key: 'explain.if.skip' }
      const condition = showCondition(fact.condition, fact.result)
      return [{ key: fact.branch === 'if' ? 'explain.ifCheck' : 'explain.elseIfCheck', values: { condition, outcome } }]
    }

    case 'call': {
      const call = `${fact.name}(${fact.args.join(', ')})`
      if (fact.params.length === 0) return [{ key: 'explain.callNoArgs', values: { call } }]
      const params: Phrase[] = fact.params.map((p) => ({
        key: p.isArray ? 'explain.paramArray' : 'explain.param',
        values: { name: p.name, value: p.value },
      }))
      return [{ key: 'explain.call', values: { call, name: fact.name, params } }]
    }

    case 'return': {
      const value = fact.value ? showValue(fact.value) : ''
      if (fact.caller === null) {
        return [
          fact.value
            ? { key: 'explain.returnFromMain', values: { value, name: fact.name } }
            : { key: 'explain.leaveMain', values: { name: fact.name } },
        ]
      }
      return [
        fact.value
          ? { key: 'explain.returnTo', values: { name: fact.name, caller: fact.caller, value } }
          : { key: 'explain.leaveTo', values: { name: fact.name, caller: fact.caller } },
      ]
    }

    case 'end':
      return [
        fact.caller === null
          ? { key: 'explain.endMain', values: { name: fact.name } }
          : { key: 'explain.endTo', values: { name: fact.name, caller: fact.caller } },
      ]

    case 'scan':
      return [{ key: 'explain.scan', values: { target: fact.target, value: fact.value } }]

    case 'print': {
      if (fact.text === '') return [{ key: 'explain.printEmpty' }]
      if (fact.text === '\n') return [{ key: 'explain.printNewline' }]
      const endsLine = fact.text.endsWith('\n')
      const text = (endsLine ? fact.text.slice(0, -1) : fact.text).replace(/\n/g, '\\n')
      return [{ key: endsLine ? 'explain.printLine' : 'explain.print', values: { text } }]
    }
  }
}
