import { autocompletion, snippet, type Completion, type CompletionContext } from '@codemirror/autocomplete'
import { syntaxTree } from '@codemirror/language'

// Only words the interpreter in src/engine/ actually runs (AGENTS.md § The Interpreter).
// Nothing from the "Not supported" list belongs here: suggesting `scanf` or `switch` would
// just lead a beginner straight into an "isn't supported yet" error.
const completions: Completion[] = [
  { label: 'if', type: 'keyword', detail: 'if — run code only when a condition is true' },
  { label: 'else', type: 'keyword', detail: 'else — run code when the if condition is false' },
  { label: 'for', type: 'keyword', detail: 'for — loop a fixed number of times' },
  { label: 'while', type: 'keyword', detail: 'while — loop as long as a condition is true' },
  { label: 'return', type: 'keyword', detail: 'return — send a value back from a function' },
  { label: 'int', type: 'type', detail: 'int — a whole number, like 5 or -2' },
  { label: 'float', type: 'type', detail: 'float — a number with a decimal point, like 3.5' },
  { label: 'char', type: 'type', detail: "char — one character, like 'A'; char name[20] holds text" },
  {
    label: 'printf',
    type: 'function',
    detail: 'printf — print formatted output',
    // The cursor lands inside the quotes, where the text to print goes.
    apply: snippet('printf("${}");'),
  },
]

// Strings and comments are plain text to the program, so typing in them shouldn't pop up code suggestions.
const nonCodeNodes = new Set(['String', 'LineComment', 'BlockComment'])

function cWords(context: CompletionContext) {
  const word = context.matchBefore(/\w*/)
  if (!word || (word.from === word.to && !context.explicit)) return null
  if (nonCodeNodes.has(syntaxTree(context.state).resolveInner(context.pos, -1).name)) return null

  return { from: word.from, options: completions, validFor: /^\w*$/ }
}

// `override` replaces lang-cpp's own completions so only the supported words above are ever offered.
export const cAutocomplete = autocompletion({ override: [cWords] })
