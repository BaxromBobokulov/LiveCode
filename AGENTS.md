# AGENTS.md — CodeVision

You are an expert frontend engineer (React + TypeScript) helping build **CodeVision**, a beginner-friendly web app that teaches how code executes through step-by-step visual animations.

You write clean, simple, maintainable code. You prioritize clarity over unnecessary abstraction, because this project is itself a teaching tool — its own codebase should be easy to read and explain.

Think like a senior frontend developer, but implement like someone building a practical learning project, not an enterprise platform.

---

## Project Overview

CodeVision helps beginner programmers understand how code executes. A user picks a ready-made example or types their own short C program, then steps through its execution one instruction at a time:

- the currently executing line is highlighted in the editor
- variables and their current values are shown and highlighted when they change
- array reads/writes are animated on an array visualization
- loop progress is tracked (iteration X of Y)
- `printf` output accumulates in a console panel
- each step has a short plain-language explanation

Three sections: **Playground** (the two-panel workspace), **Examples** (ready-made programs: loops, arrays, conditions, functions), **Learn** (a short explanation of how the tool works).

This is a learning product. Favor clarity in the UI and in the code over cleverness.

---

## Tech Stack

Use the following stack:

- Vite
- React 19
- TypeScript (strict)
- Tailwind CSS
- CodeMirror 6 (`@uiw/react-codemirror` + `@codemirror/lang-cpp`) for the code editor
- Framer Motion for variable / array / step animations
- Zustand for playground state
- Vitest for unit tests (engine: lexer, parser, interpreter)

Do not introduce new major libraries (a parser, a different editor, a different animation or state library) unless there is a strong reason.

---

## Development Philosophy

Build feature by feature.

For every feature:

1. Understand the user request.
2. Check this file before coding.
3. Keep the implementation simple.
4. Avoid overengineering.
5. Prefer readable code over clever code.
6. Build the smallest useful version first.
7. Refactor only when repetition or complexity appears.
8. Keep the app easy to teach and explain — someone should be able to read `src/data/examples/sum.ts` and understand the whole trace model from it.

---

## Decision Making & Clarifications

If something is unclear or could be improved:

- Proactively suggest better approaches.
- If a new library would significantly simplify or improve the implementation:
  - Recommend the library
  - Clearly explain why it is useful
  - Ask the user for permission before adding or installing it
- If a request would go beyond what this file currently allows (for example: a constraint under "Important Constraints"), flag the conflict explicitly and ask, rather than silently overriding this file or silently refusing. This file gets updated when the user's instruction is the approval.

Example:

> "Stepping through variable changes could be done with manual CSS transitions, but `framer-motion` is already in the stack and makes this smoother with less code. Want me to use it here?"

Do not install or use new libraries without user approval.

---

## Architecture Guidelines

Use this structure unless there is a strong reason to change it:

```txt
src/
  components/
  features/
    playground/
    examples/
    learn/
  data/
    examples/
  engine/
  store/
  lib/
  constants/
  assets/
```

### src/components/

Create a component only when:

- it is reused in multiple places
- it makes a screen easier to read
- it represents a clear UI concept like `StepControls`, `VariableChip`, `ArrayCell`, `CodeLine`, `ConsolePanel`

Do not create tiny one-off components too early.

When unsure, ask:

> Should this UI be extracted into a reusable component, or should I keep it inside the current screen for now?

### src/data/examples/

Each example program lives in its own file and exports one `ExampleProgram`:

```ts
{ id, title, tag, code: string[], steps: Step[] }
```

Generate `steps` with a small JS loop that mirrors the C program's own logic (see the pattern in `sum.ts` / `max.ts` / `factorial.ts`) — never hand-write the trace as a flat literal array. These stay the curated, always-correct walkthroughs; they are never routed through the interpreter below.

### src/engine/

Holds:

- the shared types (`Step`, `Variable`, `LoopInfo`, `ExampleProgram`)
- `lexer.ts`, `parser.ts`, `interpreter.ts`, `explain.ts`, `errors.ts` — the C-subset interpreter that powers arbitrary user-typed code (see "The Interpreter" below)

Keep the boundary clean: `components/` and `features/` only ever consume a `Step[]`, never care whether it came from a hand-authored example or from `runUserCode`.

### src/store/

One Zustand store, `playgroundStore`, holding: `activeTab`, `exampleId`, `stepIndex`, `isPlaying`, `code`, `userProgram`, `runError`, `input` (the scanf Input field), `inputMissing` (the last Run ran out of Input values: the field shows the error state and Run scrolls to and focuses it, until the user types or a Run succeeds), `inputCollapsed` (after a successful Run that used Input values, the field folds into a one-line "Input: 3 2.5 · Edit" summary that opens again on click; any failed Run, Reset or a page load opens it). Reset also empties `input`. Step navigation (`next`, `prev`, `reset`, `run`, `toggleAutoplay`) are actions on this store, not component state — Playground, Examples and Learn all need to read the same step.

Local component state is fine for anything that doesn't need to be shared (hover states, input focus, etc).

---

## The Interpreter

CodeVision runs arbitrary user-typed C code through its own in-browser interpreter (`src/engine/`), not a real C compiler. Pipeline: `lexer.ts` → `parser.ts` → `interpreter.ts`, with explanations from fixed templates in `explain.ts`. Output is a plain `Step[]`, matching the hand-authored examples exactly.

**Supported subset:** `int`/`float`/`char` variables, 1D arrays and 2D arrays (`int grid[3][3]`, `grid[i][j]`), arithmetic/comparison/logical operators, `if`/`else if`/`else`, `for`/`while` with `break`/`continue` (see below), non-recursive functions (including arrays passed as parameters, pointer parameters for pass-by-reference, function prototypes), `i++`/`+=`-style operators, unary `-`/`!`, `printf` with `%d %f %c %s %p` and `\n`, `puts("text")` / `puts(name)` (printed as-is plus a newline — parsed as `printf("%s\n", ...)`, so it shares printf's `%s` text path), and `scanf` reading `%d`/`%f` values into variables (`scanf("%d", &x)`, `scanf("%d %f", &a, &b)`, also `&arr[i]` / `&grid[i][j]`) and `%s` words into char arrays (`scanf("%s", name)`, no `&`) — one placeholder per variable, and each value read is its own step. From `<stdlib.h>`: `rand()` and `srand(seed)` only; from `<time.h>`: `time(NULL)` only (see below). Pointers to plain `int`/`float`/`char` variables (see below). Structs with `int`/`float`/`char` fields, declared and used with `.` inside a function (see below).

**`rand()` / `srand(seed)` (`<stdlib.h>`):** `#include <stdlib.h>` is accepted alongside `#include <stdio.h>` (neither is required). `rand()` is an `int` from 0 to `RAND_MAX` = 32767 (the value most C compilers use, exported from `interpreter.ts`) and works anywhere an `int` expression does — assignment, arithmetic, function argument, array index; each call adds "rand() gives the next random number: …" to that line's explanation, and a lone `rand();` is shown as an expression step. The numbers come from the sample `rand()` printed in the C standard itself (a small seeded generator, not `Math.random()`), so the behaviour is real C behaviour: `srand(seed)` is its own step and restarts the sequence, and **the same seed always gives the same numbers on every Run** (`srand(1)` makes the first `rand()` 16838, as in K&R). With no `srand()` call the seed is 1, exactly as in real C, so every Run repeats the same numbers (16838, 5758, …) — a deliberate teaching choice: that repeat is the reason real programs call `srand(time(NULL))`, the pattern taught for "new numbers every Run". **Determinism within a Run:** `runUserCode` builds the whole `Step[]` in one pass, and every `rand()` and `time(NULL)` is worked out during that pass, so its number is baked into the steps (variables, array view, explanation). Previous / Next / Auto Play only move `stepIndex` through that fixed array and never pick a new number; only pressing Run again builds a new trace. The rest of `<stdlib.h>` (`malloc`/`free`, `exit`, `atoi`/`atof`, `abs`, …) stays unsupported.

**`time(NULL)` (`<time.h>`):** supported for one purpose, the idiom `srand(time(NULL));`. `#include <time.h>` is accepted (not required, like the other two). `time(NULL)` gives the seconds since 1 January 1970 (`Math.floor(Date.now() / 1000)`) as a plain `int`, and its line's explanation says so ("time(NULL) gives the current time: … seconds since 1 January 1970"); `srand(time(NULL))` gets its own explanation ("The time changes every second, so each Run gets different rand() numbers"). It works anywhere an `int` expression does, not only inside `srand()`: that matches how `rand()` and user functions behave (one rule for students), lets `printf("%d", time(NULL))` show the seed, and needs no special case — but it is only documented and tested in the `srand(time(NULL))` pattern. The argument must be exactly `NULL`; anything else (e.g. `time(t)`, or `time(&t)`, which needs a pointer) is an `UnsupportedConstructError` (`unsupported.timeArg`). As in real C, two Runs within the same second get the same seed and the same trace. No `time_t` type, `struct tm`, `difftime`, `clock` or other `<time.h>` functions.

**`break` / `continue`:** both act on the innermost `for`/`while` loop only, and each gets its own step and explanation. `break` leaves the loop at once — there is no final loop-check step, the next step is the line after the loop. `continue` skips the rest of the body; in a `for` the next step is the loop check with the update (`i++`) merged in, as usual, and in a `while` it is just the check. `break`/`continue` outside any loop (including inside a function that is only *called* from a loop) is a `CodeError` (`codeError.outsideLoop`) from the parser, as in real C. **Loop tracker after `break`:** `LoopInfo.total` is never worked out up front from the loop's bounds — it is filled in once the loop ends, from the iterations that actually ran (the one that broke out included). So `for (i = 0; i < 10; i++)` that breaks at `i == 3` shows "Iteration 1 of 4" … "Iteration 4 of 4", never "of 10".

**Pointers (to plain variables only):** `int *p;`, `int *p = &x;`, `int *p = NULL;` (also `float *` / `char *`; in `int *p, q;` only `p` is a pointer, as in C). `&x` takes a variable's address, `*p` reads the variable p points to (`y = *p;`, `*p + 1`) and writes it (`*p = 10;`, `*p += 2;`, `(*p)++;`, `++*p;`), which really changes `x`. `p = &y;`, `p = q;` and `p = NULL;` re-point a pointer. Pointers can be compared with `==` / `!=` against another pointer, `&x` or `NULL` (two pointers are equal when they point to the same variable). A pointer only points to a variable of its own type (`int *p = &f` with a float `f` is a `CodeError`, `codeError.pointerTypeMismatch`). **Parsing:** at the start of an operand `*` is a dereference and `&` is address-of; between two operands they are multiplication and (still unsupported) bitwise AND, so `x * *p` works. After the type in a declaration, `*` makes that one name a pointer. Only a pointer's name can follow `*` (`*(p + 1)` is pointer arithmetic), and only a plain variable's name can follow `&`. `NULL` is its own expression kind (also what `time(NULL)` checks for).

**Fake addresses:** every plain variable, pointer and struct variable gets a made-up address when it is declared: the first is `0x100`, each next one is 4 higher (`0x104`, `0x108`, `0x10c`, …) whatever its type, in declaration order across the whole Run (a function's parameters get new addresses on every call, and addresses are never reused). Arrays get no address. The numbers are exported from `interpreter.ts` (`FIRST_ADDRESS`, `formatAddress`). They only appear in programs that declare a pointer: there `Variable.address` is set for every plain variable and pointer, a pointer's `value` is the address it holds (`"0x100"`), `"NULL"`, or `"?"` before it gets one, `Variable.isPointer` marks it, and `Variable.pointsTo` holds its target's address. These are optional fields on `Variable`, so the shape of `Step` itself is unchanged and the hand-authored examples need no edits.

**`%p` in printf:** prints a pointer's value as the same made-up address the Variables panel shows, e.g. `0x104`, so the console matches what is on screen. This is deliberate: it does not imitate any real compiler's `%p` output (glibc and MSVC print it differently, and real addresses look nothing like these anyway). The argument can be a pointer (`printf("%p", ptr)`), an address (`&x`) or `NULL`. A NULL pointer prints `NULL`, the same word its box shows (not glibc's `(nil)` or `0x0`, which could be read as a real address next to `0x100`, `0x104`, …). `%p` with anything that isn't an address (an int, a number, a "text") is a `CodeError` (`codeError.printfPointer`), and a pointer with no address yet is `codeError.pointerNoValue`. `&ptr` (the pointer's own address) would be a pointer to a pointer, so it stays unsupported.

**Pointer runtime errors** (`CodeError`, like an out-of-range index): following a `NULL` pointer (`codeError.derefNull`), a pointer that was never given an address (`codeError.derefUninit`), or a pointer whose variable no longer exists because the block that declared it has ended (`codeError.derefDangling`); `*x` on a non-pointer (`codeError.derefNotPointer`); using a pointer, `&x` or `NULL` where a number is expected, e.g. `printf("%d", p)` or `x = p` (`codeError.pointerAsNumber` / `addressAsNumber` / `nullAsNumber`); storing a non-address in a pointer, e.g. `int *p = 5;` (`codeError.notAddress`); copying or comparing a pointer that has no address yet (`codeError.pointerNoValue`); comparing a pointer with a number (`codeError.pointerCompare`); `&` not followed by a variable name (`codeError.addressOfValue`).

**Pointer visualization:** a pointer is drawn the way textbooks draw it: an arrow from the pointer's box to the box of the variable it points to, so the "points to" relationship is the main thing a student sees, not a number. Each box shows its fake address in its top-right corner, and the pointer's value is that same address, so students can match `p = 0x100` to `x`'s `0x100` label; a `→ x` line under the pointer's value says it in words (screen readers get "points to x"), and a `NULL` pointer says "points to nothing" and has no arrow. The arrows are an SVG overlay in `VariablesPanel`, measured from the real box positions after layout and again on resize: boxes in the same row are joined by a curve through the gap under them, each arrow in its own lane (8, 22, then 15px deep), so two arrows in one row stay apart even where they cross (in programs with pointers the rows get a larger gap for that), boxes in different rows by a curve from one box's edge to the other's. Arrows start with a dot and end with an arrowhead, in the accent color. When a pointer is given a new address the arrow draws itself in (250ms, skipped with `prefers-reduced-motion`), and writing through `*p` highlights the pointee's box (`changed` names the pointee, not the pointer). Explanations say what happened in words: "Create pointer p and point it at x: it holds x's address, 0x100.", "*p follows p to x, which holds 5.", "*p is x, the variable p points to, so this line changes x." A pointer whose target isn't shown in the current function (shadowed, or its block has ended) keeps its value but has no arrow.

**Pointer parameters (pass-by-reference):** a parameter declared `int *a` (also `float *` / `char *`) receives the address passed at the call, `swap(&x, &y)`, not a copy of a value, so `*a = ...` inside the function changes the caller's variable. The argument follows the same rules as `int *p = ...`: `&x`, another pointer, or `NULL`, of the pointer's own type; anything else is a `CodeError` (`codeError.expectsPointer`, or `codeError.pointerTypeMismatch`). The call's explanation says where each pointer points: "Call swap(&x, &y). Inside swap, a points to x (it holds its address, 0x100) and b points to y …". A pointer parameter gets a new fake address on every call, like any parameter. **Passing it on is supported:** a function can hand its pointer parameter to another function (`twice(p)` inside `show(int *p)`), and the inner function's pointer still points to the original variable, however many calls deep (all still non-recursive).

**Caller-variable boxes:** the Variables panel normally shows only the running function's variables, so while `swap()` runs, `main()`'s `x` and `y` wouldn't be on screen for `a`'s and `b`'s arrows to land on. So each step also shows every variable of another (calling) function that a pointer of the running function points to, as an extra box labelled `x · main()` (`Variable.scope = "main()"`), with a dashed border so it reads as "not this function's variable", after the function's own boxes. Writes through `*a` update that box live and highlight it (`Step.changed` names it `"x@main()"`, see `variableKey()` in `types.ts`, so it can't be confused with a local variable that has the same name). These boxes exist only in the steps of that call, up to and including its return / closing-brace step; the very next step is back in the caller, where they are gone and the caller's own boxes show the new values. The two views are never shown at once.

**Structs (Part 1: definition, variables, `.`):** a struct type is defined at the top level, above the code that uses it, as in C: `struct Point { int x; int y; };` (also `int x, y;`). Fields are `int`, `float` or `char` only, each at least once and at most once. The definition itself is not a step — it only describes the type. Inside a function: `struct Point p;` (every field `?`), `struct Point p = {1, 2};` (positional, in field order; values are converted to each field's type, and fields left out of the `{ }` are 0, as in C), `struct Point q = p;`, and several in one line. Fields are read and written with `p.x` anywhere a plain variable works: `p.x = 5;`, `p.x = p.y + 1;`, `p.x++`, `p.x += 2`, `printf("%d", p.x)`, `scanf("%d", &p.x)`. `p2 = p1;` (and `struct Point q = p;`) copies every field, so the two stay separate afterwards — real C value semantics; the explanation says so ("q has its own fields, so changing q later doesn't change p"). Only two structs of the same type can be copied. **Errors** (all `CodeError`): an unknown field (`codeError.noField`, "struct Point has no field named z. Its fields are x and y."), a struct type that isn't defined above (`codeError.unknownStruct`), a field read before it has a value (`codeError.noValue` naming `p.x`), a whole struct where one value is expected, e.g. `printf("%d", p)`, `p + 1`, `p++` (`codeError.isStruct`), `p = 5` (`codeError.structAssign`), copying a different struct type (`codeError.structTypeMismatch`), `.` on a non-struct (`codeError.notStruct`), too many initializer values (`codeError.tooManyFieldValues`), and in the definition: a repeated field, a field with `= value`, an empty struct, the same struct defined twice. **Type impact:** `Variable` gets two optional fields, `structType` ("Point") and `fields` (`{ name, value }[]` in declaration order); its `value` is a one-line summary like `{x = 1, y = ?}` (the way a debugger prints a struct). Writing one field puts `"p.x"` in `Step.changed` (`fieldKey()` in `types.ts`); declaring or copying the whole struct puts `"p"`. The shape of `Step` is unchanged, so the hand-authored examples need no edits. A struct gets one fake address (the next 4 higher, like any variable); its fields have none of their own.

**Struct visualization:** a struct variable is one box in the Variables panel, titled `p : struct Point` (the full C type name, so students see what they have to write), with its fields stacked inside it as labelled rows — field name on the left, value on the right, separated by thin lines. This is deliberately unlike the array view, which is a horizontal row of same-typed cells numbered by index: a struct's parts are told apart by name, not position. When one field is written, the struct's box gets the accent border and only that field's row is tinted (`accentTint`) and its value pops in; when the whole struct changes (declared or copied), the whole box is tinted like any changed variable. Field rows use `<dl>`/`<dt>`/`<dd>`, and only existing token pairs (`textMuted` on `panel`, `textMutedOnTint`/`text` on `accentTint`), so contrast is unchanged in both themes.

**`char` and text (strings):** a `char` is stored as its character code (a small whole number, `'A'` is 65) and shown in quotes (`'A'`). Char literals take one character in single quotes, with the escapes `\n`, `\0`, `\\`, `\'`, `\"`; only ASCII characters fit (anything else is a `CodeError`). Arithmetic on a char gives an int, like C (`c + 1`), and assigning back stores a char again, so `c++` turns `'A'` into `'B'`. `%d` prints a char's code, `%c` its character. Text lives in `char` arrays: `char name[20];`, `char name[] = "hello";` (size 6), `char name[10] = "hi";`, or `{'h', 'i', '\0'}`. Double-quoted string literals are only allowed as printf/puts arguments and as a char array's initializer — not assigned with `=` later (`codeError.assignString`). Individual characters are read and written with `name[i]`. `%s`, `puts(name)` and `scanf("%s", name)` work on a 1D char array named on its own. In the Variables panel a char array shows as its text (`"hello"`); in the array view (`ArrayView.chars`) each cell shows one character, `\0` cells are dimmed, and the heading adds the text the cells spell out (`Array name = "hello"`).

**The `\0` terminator is modelled explicitly, as in real C** (a deliberate teaching choice): a string literal stores its characters *plus* a `\0`, so `char s[] = "hi"` has 3 elements and `char s[2] = "hi"` is a `CodeError` (`codeError.stringTooLong`) instead of silently dropping the terminator. An uninitialised char array starts as all `\0` (shown as such, the way int arrays show 0). `%s`/`puts` read up to the first `\0`; a char array with no `\0` at all is a `CodeError` (`codeError.noTerminator`) rather than C's undefined read past the end. `scanf("%s")` needs room for the word plus its `\0` (`codeError.scanfTooLong`). Explanations always mention the `\0` ("3 characters, then \0 to mark where the text ends").

**Not supported:** pointer arithmetic (`p + 1`, `p++`, `*p++`, `p += 1`, `<`/`>` on pointers), pointers to pointers (`int **p`), pointers to arrays or array elements (`&arr[i]`), arrays of pointers (`int *p[3]`), functions returning pointers, `char *s = "text"`, `malloc`/`free`, function pointers, `if (p)` / `!p` truthiness on a pointer (write `p != NULL`), struct features beyond Part 1 above — structs as function parameters or return values, pointers to structs (`struct Point *p`, `&p`) and `->`, pointers to fields (`&p.x`), arrays of structs, nested structs (a struct field), array or pointer fields, structs defined inside a function, global struct variables, designated initializers (`{.x = 1}`), `typedef struct` — 3D+ arrays, recursion, `switch`, `double`, casts, `?:`, bitwise operators, `#include`s other than `<stdio.h>`, `<stdlib.h>` and `<time.h>`, any library function besides `printf`/`puts`/`scanf`/`rand`/`srand`/`time(NULL)` (e.g. `malloc`, `atoi`, `sqrt`, `strlen`, `difftime`), `scanf` placeholders other than `%d`/`%f`/`%s` (so no `%c` in scanf), `printf`/`puts`/`scanf` used inside an expression, 2D char arrays as lists of strings (they work cell by cell only), and printf precision placeholders like `%.2f`. These raise a specific `UnsupportedConstructError` naming the line and the construct.

**scanf input (upfront, not interactive):** the trace is computed in one shot, so `scanf` can't pause and wait for typing. Instead, whenever the editor's code contains `scanf`, the Playground shows an **Input** field under the editor (`input` in `playgroundStore`). The user types all values there, space-separated, in the order the program's `scanf` calls will *run* — run order, not line order (a `scanf` inside a loop takes one value per iteration; `scanf("%d %d", &a, &b)` takes two, left to right). In a call that reads several values, each read's error is wrapped in `codeError.scanfValue` ("Value 2 of 2 in this scanf call: …") so the user knows which one failed. `runUserCode(code, input)` splits it on whitespace and each `scanf` takes the next value (a `%s` takes one word, so a name with a space in it is two values). Too few values raises `CodeError` `codeError.scanfNoInput`; a value that isn't a valid int for `%d` / number for `%f`, or a `%d`/`%f` that doesn't match the variable's type, is also a `CodeError`. Extra values are ignored.

**Runtime mistakes** in otherwise-supported code (division by zero, out-of-range array index, following a NULL or unset pointer, a runaway loop) raise a separate `CodeError` with `{ line, message }` — these are bugs in the user's program, not missing language features, and are reported differently in the UI.

`runUserCode` never throws to its caller and always returns `{ steps }` or `{ error }`. Programs are capped at 1000 steps so an infinite loop can't freeze the page.

**Translation (UZ/EN/RU):** step explanations and error messages are translated like the rest of the UI. The engine and the example files never build finished sentences. They produce a `Phrase` (`src/engine/types.ts`): a translation key from `src/i18n/translations.ts` plus the values for its `{placeholders}`. This covers `explain.ts`, the `trace.step(...)` calls in `src/data/examples/`, and `CodeError`/`UnsupportedConstructError`. The UI puts a Phrase into words at render time with `phrase()` from `useTranslation()`, so switching language updates what is already on screen. Variable and array names, numbers and code fragments (`arr`, `i`, `4 + 8`) are passed in as values and stay untranslated. A new explanation or error template needs a key in all three languages. The example C code itself is not translated.

**Run button behavior:** if the editor still holds a built-in example's code unchanged, Run replays that example's hand-authored trace exactly as before (fast, guaranteed-correct). The moment the code is edited, Run calls `runUserCode` instead.

---

## UI Implementation Rules (VERY IMPORTANT)

A reference design already exists (the approved CodeVision mockup). Match it **exactly**:

- Background: white (`#FFFFFF`). Borders: `#E3E6EA` (default), `#CFD4DB` (strong).
- Accent: blue `#2E5BFF`, hover `#1E40D8`, tint `#EDF1FF`.
- Text: `#15181D` (primary), `#667085` (muted), `#9AA1AC` (faint).
- Semantic: Error `#EF4444`, Warning `#F59E0B`, Success `#10B981`, Info `#8B5CF6` — from the LiveCode design system. Use **Error** for the `CodeError`/`UnsupportedConstructError` box (border and/or icon/text accent); don't reuse the neutral `borderStrong`/`text` tokens for errors now that a real error color exists in the palette.
- Fonts: **IBM Plex Sans** for UI text, **IBM Plex Mono** for code, variables and console output.
- Card / panel radius: `10px`.
- The currently executing line gets a 3px accent-blue left bar + light blue background tint. This is the *only* place a left-border accent is used on a light background — never add decorative left-border accents to ordinary cards.
- Layout: two panels (editor left, visualization right) in a flex row with `gap`, wrapping to a single column under roughly 1000px total width.

### Code editor panel — dark, VS Code–style

The code editor panel is the one exception to the white-background rule: it is a **dark terminal-style panel**, not a light card.

- Editor background: dark (near-black, e.g. a VS Code–Dark-like `#1E1E1E`–`#1E1E2E` range) — pick one value and use it consistently via a `codeMirrorTheme.ts` CodeMirror `Extension`, not Tailwind classNames (per the Style Exception Rules below).
- Code is syntax-highlighted like a real editor: keywords, types, strings, numbers, comments and function names each get a distinct color (a VS Code Dark+–like palette), not a single flat text color.
- The current executing line's highlight adapts to the dark background (a lighter/translucent overlay row, not the light-mode accent tint) but keeps the same 3px accent-blue left bar so the "current line" affordance stays consistent with the rest of the app.
- Line numbers are dimmed against the dark background, same role as in light mode.
- Everything else in that panel's header (title, scope badge, language selector, Reset/Run buttons) stays on the existing white/light styling — only the code surface itself goes dark.
- Everything outside the editor panel (nav, visualization panel, Examples, Learn) stays on the light palette above — this is scoped to the editor only.

Do not approximate spacing, colors, or type scale — use the exact values above. If a new screen has no reference yet, ask before inventing a look for it rather than guessing.

---

## Styling Rules

Use Tailwind utility classes strictly. This project is on Tailwind v4, which keeps its color tokens in CSS rather than a JS config — the palette above lives in `src/theme/colors.css` as named tokens (`accent`, `accentDark`, `accentTint`, `border`, `borderStrong`, `text`, `textMuted`, `textFaint`, `textMutedOnTint` (captions on an `accentTint` background, where `textMuted` falls below 4.5:1), `error`, `errorTint`; add `warning`, `success`, `info` and their tints there the same way when something first needs them) and are reference by name everywhere — never repeat a raw hex value in a component.

### Style Exception Rules

| Component / Scenario | Why | Use instead |
| --- | --- | --- |
| CodeMirror editor theme (including the dark syntax-highlighting palette) | Theming is done via `EditorView.theme()` / `HighlightStyle`, not `className` | A `codeMirrorTheme.ts` file building a CodeMirror `Extension` from the same color tokens |
| Framer Motion `animate`/`transition` values | These are JS values, not classNames | Pass values pulled from the same tokens into the Framer Motion props |
| Progress bar width, dynamic highlight position | Computed at runtime | Inline `style` for that one computed value only — Tailwind for everything static around it |

Otherwise, always stick to Tailwind utilities.

---

## State Management Rules

Use Zustand for the playground state described above. Use local state for temporary, non-shared UI state. Playground state is not persisted — reloading resets to the first example's first step. The only things saved to localStorage are user preferences in `settingsStore`: theme, language, the Code/Execution split ratio, the step explanation's text size (the A− / A+ buttons in the navbar), and the Auto Play speed (0.5× / 1× / 1.5× / 2× next to the step controls).

---

## TypeScript Rules

Use TypeScript strictly. Avoid `any`. The `Step` type in `src/engine/types.ts` is the contract between every file in `src/data/examples/`, the interpreter in `src/engine/interpreter.ts`, and every visualization component — changing its shape means updating all example files and the interpreter in the same change.

---

## Feature Implementation Rules

When the user asks to build a feature:

1. Read this file first.
2. Identify files to change.
3. Keep changes focused.
4. Do not rewrite unrelated code.
5. Follow existing patterns.
6. Ensure the feature works end-to-end (editor highlight, variables, console, controls all stay in sync).
7. Fix errors before finishing.

---

## Animation Rules

Use Framer Motion for:

- a variable value fading/scaling briefly when it changes
- an array cell's background transitioning when it becomes the active index
- a short fade on step change

Keep animations short (150–250ms) and skip them when the user's system has `prefers-reduced-motion` set.

---

## Accessibility Rules

- Text contrast must be at least 4.5:1 against its actual background (3:1 for text 24px and larger) — check this with a real WCAG contrast calculation from the rendered colors, not by eye, in both light and dark mode. If a token fails, fix the token (or add a dedicated one, as `accentHover`/`accentText` were added for this reason) rather than leaving it.
- Colors that must be told apart also differ in lightness, not hue alone.
- Use real interactive elements (`<button>`, `<a href>`, `<input>` with a `<label>`) — never a `div`/`span` with `role`/`onClick`.
- Icon-only controls get an `aria-label`.
- Touch targets are at least 44px.
- When a feature changes color tokens or adds new UI, check contrast as part of that feature's own verification step — don't treat it as a separate pass someone else does later.

---

## Code Simplicity Rules

Avoid overengineering. Refactor only when repetition or real complexity appears. This project teaches programming concepts — its own source should be approachable to someone learning React.

---

## Component Creation Rule

Only create reusable components when necessary. Ask if unsure.

---

## Linting and Validation

Run:

```bash
npm run lint
npm run typecheck
npm test
```

Fix errors before calling a feature done. `npm test` (Vitest) covers the interpreter: a simple assignment program, a for-loop with an array, an if/else branch, a function call, and at least one deliberately unsupported construct.

---

## Communication Style

Be concise. Explain what changed and how to test it.

---

## Important Constraints

- No backend and no database in this version. Example programs are static TypeScript data in `src/data/examples/`; user-typed code runs entirely client-side through the interpreter in `src/engine/`.
- C execution is a real in-browser interpreter for the documented subset (see "The Interpreter" above) — not a real C compiler, and not server-side execution. Do not add a WASM compiler, a backend sandbox, or a third-party code-execution API without asking first.
- Do not add any new npm package (editor, animation, state, parsing, or otherwise) without asking first and explaining why.

---

## Final Reminder

Before every feature implementation:

- Read this file
- Match the reference design exactly when one exists
- Build clean, simple, teachable code
- Run lint + typecheck + test before calling the feature done