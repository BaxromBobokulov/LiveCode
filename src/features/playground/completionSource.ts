import type { Completion, CompletionSource } from '@codemirror/autocomplete'

// `type name` — a declaration, a parameter or a function. What follows the name tells them apart:
// `(` is a function, `[` is an array (left out), anything else is a plain variable.
const declaration = /\b(int|float|char|void)\s+([A-Za-z_]\w*)\s*([([]?)/g
const typeWords = new Set(['int', 'float', 'char', 'void'])

/** Blanks out comments, strings and char literals so a name inside them isn't mistaken for a declaration. */
function codeOnly(text: string): string {
  return text.replace(/\/\/[^\n]*|\/\*[\s\S]*?(\*\/|$)|"(\\.|[^"\\\n])*"?|'(\\.|[^'\\\n])*'?/g, ' ')
}

/**
 * The other names in `int a = 0, b, c;` after the first one. Walks to the end of the statement,
 * skipping anything inside brackets, and picks up the name after each top-level comma.
 */
function moreNames(code: string, from: number): string[] {
  const names: string[] = []
  let depth = 0
  for (let i = from; i < code.length; i++) {
    const ch = code[i]
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) break
      depth--
    } else if (ch === ';' && depth === 0) break
    else if (ch === ',' && depth === 0) {
      const next = /^\s*([A-Za-z_]\w*)\s*(\[?)/.exec(code.slice(i + 1))
      if (next && !next[2] && !typeWords.has(next[1])) names.push(next[1])
    }
  }
  return names
}

/**
 * Suggests the int/float/char variables and the functions declared earlier in the program.
 * A plain text scan rather than the parser, so it keeps working while the code is half-typed.
 */
export const declaredNames: CompletionSource = (context) => {
  const word = context.matchBefore(/[A-Za-z_]\w*/)
  if (!word && !context.explicit) return null
  const from = word ? word.from : context.pos

  // Only what comes before the word being typed, so `int cou|` doesn't suggest `cou` to itself.
  const code = codeOnly(context.state.sliceDoc(0, from))
  const options = new Map<string, Completion>()

  for (const match of code.matchAll(declaration)) {
    const [whole, type, name, after] = match
    if (after === '(') {
      if (name !== 'main') options.set(name, { label: name, type: 'function', detail: `${type} function` })
      continue
    }
    if (type === 'void') continue
    const variable: Completion = { label: name, type: 'variable', detail: `${type} variable` }
    if (after !== '[') options.set(name, variable)
    // Start at the `[` (if any) so the walk steps over `[5]` in `int arr[5], x;`.
    for (const other of moreNames(code, match.index + whole.length - after.length)) {
      options.set(other, { ...variable, label: other })
    }
  }

  if (options.size === 0) return null
  return { from, options: [...options.values()], validFor: /^\w*$/ }
}
