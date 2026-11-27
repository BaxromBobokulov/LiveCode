# Scope: LiveCode

A browser app that teaches beginner programmers how C code runs, one step at a time, with live variables, arrays, loops and console output. This slice adds pointer and struct visualization: students see an arrow from a pointer to the variable it points to, and each struct as one box of named fields.

**Build approach:** Tracer Bullet (every feature works end to end through engine, trace and UI before the next one thickens it).
**Workflow:** Beta (after `/develop`: `/check verify`, then `/test`). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· GA`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Playground and interpreter | Existing | existing |
| 2 | Examples | Existing | existing |
| 3 | Problems (Masalalar) | Existing | existing |
| 4 | Learn | Existing | existing |
| 5 | Pointer arrows | Slice 1 | in-progress |
| 6 | Struct boxes | Slice 1 | in-progress |
| 7 | Pointer and struct examples | Slice 2 | planned |
| 8 | Pointer and struct problems | Slice 3 | planned |

## Existing

### 1. Playground and interpreter · existing
Two panel workspace and the in browser C interpreter for the documented subset (lexer, parser, interpreter, explanations). code in `src/features/playground/`, `src/engine/`

### 2. Examples · existing
Curated walkthroughs whose steps are built with the `createTrace` helper. code in `src/data/examples/`, `src/engine/trace.ts`

### 3. Problems (Masalalar) · existing
Write and debug problems checked against test cases, grouped by topic. code in `src/data/problems/`, `src/features/problems/`

### 4. Learn · existing
Short explanation of how the tool works. code in `src/features/learn/`

## Slice 1: Ship what is built

The thread already runs end to end in the uncommitted working tree: the engine tracks fake addresses, `pointsTo`, struct fields and arrays of structs, and the panels draw them. 317 engine tests and typecheck pass. This slice proves it in the real app and lands it.

### 5. Pointer arrows · in-progress
A pointer is drawn as an arrow from its box to the box of the variable it points to, with fake addresses on every box, so students see where `p` points rather than reading a number. Covers plain pointers, `NULL`, pointer parameters (`swap(&x, &y)`) and the caller's dashed boxes.
**Done when:** in the real app, `int *p = &x;` draws an arrow to `x`; re pointing redraws it; `*p = 10` highlights `x`; `NULL` shows "points to nothing" with no arrow; `swap(&a, &b)` shows two arrows into the caller's boxes that stay apart; arrows follow the boxes on resize; reduced motion skips the draw animation; both themes keep contrast.
- [x] Build it: engine + `VariablesPanel` arrow overlay (uncommitted working tree)
- [x] Verify it: `/check verify pointer arrows`
- [ ] Test it: `/test pointer arrows`
code in `src/engine/`, `src/features/playground/VariablesPanel.tsx`

### 6. Struct boxes · in-progress
Each struct variable is one box titled `p : struct Point` with its fields as labelled rows (nested structs indented), and an array of structs is drawn as a row of small field boxes. Pointers to structs (`p->x`) reuse the arrows from #5.
**Done when:** in the real app, writing `p.x` tints only that row; copying a struct tints the whole box; `students[i].gpa` highlights the element and the field; `struct Point *q = &p;` draws an arrow to `p`'s box; a function changing a struct through a pointer shows the dashed caller box with only the written field tinted.
- [x] Build it: engine + `VariablesPanel` field rows + `ArrayVisualizer` struct array (uncommitted working tree)
- [ ] Verify it: `/check verify struct boxes`
- [ ] Test it: `/test struct boxes`
code in `src/engine/`, `src/features/playground/VariablesPanel.tsx`, `src/features/playground/ArrayVisualizer.tsx`

## Slice 2: Examples

### 7. Pointer and struct examples · needs a decision
Ready made programs in Examples so a student can watch arrows and struct boxes without writing code first, e.g. `swap(&a, &b)`, a `struct Point`, and changing a struct through a pointer.
**Done when:** at least one pointer example and one struct example appear in Examples, step through with correct arrows, addresses and field highlights, and their explanations read in all three languages.
- [ ] Design it (spec): `/architect pointer and struct examples`

The decision: `createTrace` today only knows numbers and arrays (no addresses, `pointsTo`, fields or a second function's scope), and `AGENTS.md` says examples are never routed through the interpreter. Extend the helper, or allow an exception.

## Slice 3: Problems

### 8. Pointer and struct problems · needs a decision
Practice tasks in Masalalar on pointers and structs, write and debug kinds, so students apply what the examples showed.
**Done when:** new topics appear on the Problems screen with problems from easy to harder, each reads its input with `scanf`, has at least two test cases, a correct solution in `checkSolution.test.ts`, and debug starter code that fails Check.
- [ ] Design it (spec): `/architect pointer and struct problems`

The decision: one topic or two (`pointers`, `structs`) in `ProblemTopic`, where they sit in `problemTopics`, and which problems make the first set.

## Deferred
Out of scope for this slice, kept so the plan stays honest. Each still raises a clear "not supported yet" error today.
- **Learn page section on pointers and structs**: what an arrow and an address mean · needs a decision
- **Pointers into arrays**: `&arr[i]`, `p + 1`, `p++`, an arrow landing on an array cell · needs a decision
- **Pointer to pointer and arrays of pointers**: `int **p`, `int *p[3]` · needs a decision
- **Heap memory**: `malloc` / `free` and a heap area in the view · needs a decision
- **Linked lists**: pointer fields (`struct Node *next`), chains of arrows · needs a decision
- **String literals through pointers**: `char *s = "text"` · needs a decision
- **More struct syntax**: `typedef struct`, `sizeof` on structs and pointers, designated initializers, `union`, `enum` · needs a decision
- **Function pointers** · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`. Skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | **`/architect` at spec capture** | `Design it` ticked; spec linked; `Build it: /develop <feature>` + **2 to 5 milestones**; the tier's closing boxes (`Verify it` Alpha+, `Test it` Beta+, `Review it` + `Document it` GA) |
| `in-progress` (building) | `/develop` | milestone sub boxes tick one by one; code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` + milestones ticked; `Verify it` ticked |
| `done` | **you, when you decide it is**; `/sync` reconciles | boxes you ran ticked, skipped ones marked skipped; at Beta, `/test` is the suggested point to call it done |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop`. The tag drops once the spec is captured.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (before this workflow) and `dropped` (taken out of scope, kept for history).
- **Approach tag** beside a heading (e.g. `· Facade`) overrides the project default for that feature; no tag inherits it.
- **Workflow tier tag** beside a heading (e.g. `· GA`) sets that one feature's rigor; no tag inherits the default.
- **Workflow** (header line): **Prototype** = nothing after `/develop`; **Alpha** = `/check verify`; **Beta** = `/check verify` then `/test`; **GA** = adds a fresh model `/check review` then `/document`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
