// Turns what the interpreter just did into the plain-language sentence shown
// under the Variables panel. Every sentence comes from a fixed template, filled
// in with the concrete names and values of that step.
//
// Values are passed in three forms:
//   source — the expression as written:            "sum + arr[i]"
//   work   — the same with each value filled in:   "4 + 8"
//   result — what it evaluated to:                 "12"

/** A value as it appears in an explanation. */
export type Shown = { source: string; work: string; result: string }

export type StepFact =
  | { kind: 'declare'; name: string; value: Shown | null }
  | { kind: 'declareArray'; name: string; type: string; size: number; values: string[] | null }
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

/** "sum + arr[i]: 4 + 8 = 12", "arr[i] (19)" or just "5", depending on how much there is to show. */
function showValue({ source, work, result }: Shown): string {
  if (source === result) return result
  if (work === result || work === source) return `${source} (${result})`
  return `${source}: ${work} = ${result}`
}

/** "i < 5: 0 < 5 is true" */
function showCondition({ source, work }: Shown, result: boolean): string {
  return work === source ? `${source} is ${result}` : `${source}: ${work} is ${result}`
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Short form used inside a loop check: "set i to 0", "increase i to 1". */
function shortPhrase(fact: StepFact): string {
  switch (fact.kind) {
    case 'declare':
      return fact.value ? `create ${fact.name} and set it to ${fact.value.result}` : `create ${fact.name}`
    case 'assign':
      return `set ${fact.target} to ${fact.value.result}`
    case 'update':
      return `${fact.op === '++' ? 'increase' : 'decrease'} ${fact.target} to ${fact.result}`
    default:
      return explain(fact).replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase())
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function explain(fact: StepFact): string {
  switch (fact.kind) {
    case 'declare':
      return fact.value
        ? `Create ${fact.name} and set it to ${showValue(fact.value)}.`
        : `Declare ${fact.name}. It has no value yet.`

    case 'declareArray':
      return fact.values
        ? `Declare ${fact.type === 'int' ? 'an' : 'a'} ${fact.type} array ${fact.name} with ${fact.size} elements: [${fact.values.join(', ')}].`
        : `Declare ${fact.type === 'int' ? 'an' : 'a'} ${fact.type} array ${fact.name} with ${fact.size} elements. They have no values yet (shown as 0).`

    case 'assign':
      return `Set ${fact.target} to ${showValue(fact.value)}.`

    case 'update':
      return `${fact.op === '++' ? 'Increase' : 'Decrease'} ${fact.target} by 1. ${fact.target} is now ${fact.result}.`

    case 'expr':
      return `Work out ${showValue(fact.value)}. The result is not stored anywhere.`

    case 'loopCheck': {
      let setup = ''
      if (fact.isFirst) {
        setup = fact.setup.length > 0 ? `Start the loop: ${list(fact.setup.map(shortPhrase))}. ` : 'Start the loop. '
      } else if (fact.setup.length > 0) {
        setup = `${capitalize(list(fact.setup.map(shortPhrase)))}. `
      }

      const check = fact.condition
        ? `Check ${showCondition(fact.condition, fact.result)}`
        : 'There is no condition to check'
      let outcome: string
      if (fact.result) outcome = fact.isFirst ? 'so run the loop body.' : 'so run the loop body again.'
      else outcome = fact.isFirst ? 'so the loop body never runs.' : 'so the loop ends.'
      return `${setup}${check}, ${outcome}`
    }

    case 'ifCheck': {
      const check = `Check ${fact.branch === 'if' ? 'if' : 'else if'} ${showCondition(fact.condition, fact.result)}`
      let outcome: string
      if (fact.result) outcome = fact.branch === 'if' ? 'so run the if block.' : 'so run this else if block.'
      else if (fact.next === 'else if') outcome = 'so check the next condition.'
      else if (fact.next === 'else') outcome = 'so run the else block.'
      else outcome = 'so skip the if block.'
      return `${check}, ${outcome}`
    }

    case 'call': {
      const call = `Call ${fact.name}(${fact.args.join(', ')}).`
      if (fact.params.length === 0) return `${call} It takes no arguments.`
      const params = fact.params.map((p) => (p.isArray ? `${p.name} is the array ${p.value}` : `${p.name} = ${p.value}`))
      return `${call} Inside ${fact.name}, ${list(params)}.`
    }

    case 'return':
      if (fact.caller === null) {
        return fact.value
          ? `Return ${showValue(fact.value)} from ${fact.name}. The program finished successfully.`
          : `Leave ${fact.name}. The program finished successfully.`
      }
      return fact.value
        ? `Leave ${fact.name} and go back to ${fact.caller}, returning ${showValue(fact.value)}.`
        : `Leave ${fact.name} and go back to ${fact.caller}.`

    case 'end':
      return fact.caller === null
        ? `Reach the end of ${fact.name}. The program finished successfully.`
        : `Reach the end of ${fact.name} and go back to ${fact.caller}.`

    case 'print': {
      if (fact.text === '') return 'Print nothing: the text is empty.'
      if (fact.text === '\n') return 'Print a line break, so the next output starts on a new line.'
      const endsLine = fact.text.endsWith('\n')
      const visible = (endsLine ? fact.text.slice(0, -1) : fact.text).replace(/\n/g, '\\n')
      return endsLine ? `Print "${visible}" and move to a new line.` : `Print "${visible}".`
    }
  }
}
