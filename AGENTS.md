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

One Zustand store, `playgroundStore`, holding: `activeTab`, `exampleId`, `stepIndex`, `isPlaying`, `code`, `userProgram`, `runError`. Step navigation (`next`, `prev`, `reset`, `run`, `toggleAutoplay`) are actions on this store, not component state — Playground, Examples and Learn all need to read the same step.

Local component state is fine for anything that doesn't need to be shared (hover states, input focus, etc).

---

## The Interpreter

CodeVision runs arbitrary user-typed C code through its own in-browser interpreter (`src/engine/`), not a real C compiler. Pipeline: `lexer.ts` → `parser.ts` → `interpreter.ts`, with explanations from fixed templates in `explain.ts`. Output is a plain `Step[]`, matching the hand-authored examples exactly.

**Supported subset:** `int`/`float` variables, 1D arrays and 2D arrays (`int grid[3][3]`, `grid[i][j]`), arithmetic/comparison/logical operators, `if`/`else if`/`else`, `for`/`while`, non-recursive functions (including arrays passed as parameters, function prototypes), `i++`/`+=`-style operators, unary `-`/`!`, `printf` with `%d %f %s` and `\n`.

**Not supported:** pointers, structs, 3D+ arrays, recursion, `break`/`continue`, `switch`, `double`/`char`, casts, `?:`, bitwise operators, `#include`s other than `<stdio.h>`, any stdlib function besides `printf` (e.g. `sqrt`, `scanf`), and printf precision placeholders like `%.2f`. These raise a specific `UnsupportedConstructError` naming the line and the construct.

**Runtime mistakes** in otherwise-supported code (division by zero, out-of-range array index, a runaway loop) raise a separate `CodeError` with `{ line, message }` — these are bugs in the user's program, not missing language features, and are reported differently in the UI.

`runUserCode` never throws to its caller and always returns `{ steps }` or `{ error }`. Programs are capped at 1000 steps so an infinite loop can't freeze the page.

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

Use Tailwind utility classes strictly. This project is on Tailwind v4, which keeps its color tokens in CSS rather than a JS config — the palette above lives in `src/theme/colors.css` as named tokens (`accent`, `accentDark`, `accentTint`, `border`, `borderStrong`, `text`, `textMuted`, `textFaint`, `error`, `errorTint`; add `warning`, `success`, `info` and their tints there the same way when something first needs them) and are reference by name everywhere — never repeat a raw hex value in a component.

### Style Exception Rules

| Component / Scenario | Why | Use instead |
| --- | --- | --- |
| CodeMirror editor theme (including the dark syntax-highlighting palette) | Theming is done via `EditorView.theme()` / `HighlightStyle`, not `className` | A `codeMirrorTheme.ts` file building a CodeMirror `Extension` from the same color tokens |
| Framer Motion `animate`/`transition` values | These are JS values, not classNames | Pass values pulled from the same tokens into the Framer Motion props |
| Progress bar width, dynamic highlight position | Computed at runtime | Inline `style` for that one computed value only — Tailwind for everything static around it |

Otherwise, always stick to Tailwind utilities.

---

## State Management Rules

Use Zustand for the playground state described above. Use local state for temporary, non-shared UI state. No persistence (localStorage) is needed in this version — reloading resets to the first example's first step.

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