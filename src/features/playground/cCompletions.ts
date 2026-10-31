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
  { label: 'break', type: 'keyword', detail: 'break — leave the innermost loop right away', info: 'break;' },
  { label: 'continue', type: 'keyword', detail: 'continue — skip to the next iteration of the innermost loop', info: 'continue;' },
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
  {
    label: 'isdigit',
    type: 'function',
    detail: 'isdigit — 1 if the character is a digit, otherwise 0 (needs <ctype.h>)',
    info: "isdigit(c)  // isdigit('7') is 1",
    apply: snippet('isdigit(${})'),
  },
  {
    label: 'isalpha',
    type: 'function',
    detail: 'isalpha — 1 if the character is a letter, otherwise 0 (needs <ctype.h>)',
    info: "isalpha(c)  // isalpha('x') is 1",
    apply: snippet('isalpha(${})'),
  },
  {
    label: 'isupper',
    type: 'function',
    detail: 'isupper — 1 if the character is an uppercase letter, otherwise 0 (needs <ctype.h>)',
    info: "isupper(c)  // isupper('A') is 1",
    apply: snippet('isupper(${})'),
  },
  {
    label: 'islower',
    type: 'function',
    detail: 'islower — 1 if the character is a lowercase letter, otherwise 0 (needs <ctype.h>)',
    info: "islower(c)  // islower('a') is 1",
    apply: snippet('islower(${})'),
  },
  {
    label: 'isspace',
    type: 'function',
    detail: 'isspace — 1 if the character is a space, tab or new line, otherwise 0 (needs <ctype.h>)',
    info: "isspace(c)  // isspace(' ') is 1",
    apply: snippet('isspace(${})'),
  },
  {
    label: 'toupper',
    type: 'function',
    detail: 'toupper — a lowercase letter made uppercase; anything else stays as it is (needs <ctype.h>)',
    info: "toupper(c)  // toupper('a') is 'A'",
    apply: snippet('toupper(${})'),
  },
  {
    label: 'tolower',
    type: 'function',
    detail: 'tolower — an uppercase letter made lowercase; anything else stays as it is (needs <ctype.h>)',
    info: "tolower(c)  // tolower('A') is 'a'",
    apply: snippet('tolower(${})'),
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
