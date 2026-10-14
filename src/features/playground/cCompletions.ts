import {
  autocompletion,
  snippet,
  type Completion,
  type CompletionContext,
  type CompletionSource,
} from '@codemirror/autocomplete'
import { syntaxTree } from '@codemirror/language'
import { declaredNames } from './completionSource'

// Only words the interpreter in src/engine/ actually runs (AGENTS.md § The Interpreter).
// Nothing from the "Not supported" list belongs here: suggesting `switch` or `sqrt` would
// just lead a beginner straight into an "isn't supported yet" error.
// `detail` says what the word is for; `info` is the side panel next to the highlighted
// suggestion, showing how it's written. Both are plain English/code, not translated.
const completions: Completion[] = [
  { label: 'if', type: 'keyword', detail: 'if — run code only when a condition is true', info: 'if (condition) { ... }' },
  { label: 'else', type: 'keyword', detail: 'else — run code when the if condition is false', info: 'else { ... }' },
  { label: 'for', type: 'keyword', detail: 'for — loop a fixed number of times', info: 'for (start; condition; step) { ... }' },
  { label: 'while', type: 'keyword', detail: 'while — loop as long as a condition is true', info: 'while (condition) { ... }' },
  { label: 'return', type: 'keyword', detail: 'return — send a value back from a function', info: 'return value;' },
  { label: 'int', type: 'type', detail: 'int — a whole number, like 5 or -2', info: 'int name = 5;' },
  { label: 'float', type: 'type', detail: 'float — a number with a decimal point, like 3.5', info: 'float name = 3.5;' },
  {
    label: 'char',
    type: 'type',
    detail: "char — one character, like 'A'; char name[20] holds text",
    info: "char c = 'A';\nchar name[20];",
  },
  {
    label: 'printf',
    type: 'function',
    detail: 'printf — print formatted output',
    info: 'printf(format, ...)',
    // The cursor lands inside the quotes, where the text to print goes.
    apply: snippet('printf("${}");'),
  },
  {
    label: 'puts',
    type: 'function',
    detail: 'puts — print text and a new line',
    info: 'puts(text)',
    apply: snippet('puts("${}");'),
  },
  {
    label: 'scanf',
    type: 'function',
    detail: 'scanf — read a value from Input',
    info: 'scanf(format, &variable)',
    // The cursor lands after the &, where the variable to fill goes.
    apply: snippet('scanf("%d", &${});'),
  },
  {
    label: 'rand',
    type: 'function',
    detail: 'rand — a random whole number from 0 to 32767 (needs <stdlib.h>)',
    info: 'rand() % 10  // 0 to 9',
    apply: 'rand()',
  },
  {
    label: 'srand',
    type: 'function',
    detail: 'srand — choose the seed: the same seed gives the same rand() numbers',
    info: 'srand(seed);',
    // The cursor lands inside the parentheses, where the seed goes.
    apply: snippet('srand(${});'),
  },
  {
    label: 'time',
    type: 'function',
    detail: 'time(NULL) — the current time in seconds, for a new seed each Run (needs <time.h>)',
    info: 'srand(time(NULL));',
    // NULL is the only argument the interpreter accepts here.
    apply: 'time(NULL)',
  },
]

// Strings and comments are plain text to the program, so typing in them shouldn't pop up code suggestions.
const nonCodeNodes = new Set(['String', 'LineComment', 'BlockComment'])

function inCode(source: CompletionSource): CompletionSource {
  return (context) =>
    nonCodeNodes.has(syntaxTree(context.state).resolveInner(context.pos, -1).name) ? null : source(context)
}

function cWords(context: CompletionContext) {
  const word = context.matchBefore(/\w*/)
  if (!word || (word.from === word.to && !context.explicit)) return null

  return { from: word.from, options: completions, validFor: /^\w*$/ }
}

// `override` replaces lang-cpp's own completions, so only the supported words above and the
// program's own variable and function names are ever offered.
export const cAutocomplete = autocompletion({ override: [inCode(cWords), inCode(declaredNames)] })
