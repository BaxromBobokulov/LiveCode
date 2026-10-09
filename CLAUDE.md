# CLAUDE.md

This file guides Claude Code (and any other AI assistant) working in the CodeVision repository.

**Source of truth:** all project rules — tech stack, architecture, UI/styling rules, constraints — live in `AGENTS.md`. Read it fully before writing any code. This file only adds Claude-Code-specific operating notes on top of it.

---

## Before you start

1. Read `AGENTS.md` top to bottom.
2. Check `package.json` for the exact installed versions of React, Tailwind, CodeMirror and Framer Motion — follow the syntax and setup for those exact versions, not a newer or older one.
3. If the task touches the Playground UI, compare against the reference design (ask the user for the design link or a screenshot if it isn't already in the conversation) before writing markup. Do not approximate it.

---

## Commands

```bash
npm run dev          # start the Vite dev server
npm run build        # production build
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
```

Run `lint` and `typecheck` after every feature and fix anything they report before calling the work done.

---

## Working agreement

- Keep changes scoped to what was asked. Do not refactor or restyle unrelated files.
- Never add a new dependency without asking first and explaining why (see `AGENTS.md` § Decision Making & Clarifications).
- Never change the shape of `Step` in `src/engine/types.ts` without updating every file under `src/data/examples/` in the same change.
- No database, no backend auth, no real C compiler in this version — see `AGENTS.md` § Important Constraints.
- Match the approved reference design pixel-for-pixel for anything in the Playground (colors, spacing, radius, type scale) — see `AGENTS.md` § UI Implementation Rules.

---

## If AGENTS.md and this file ever disagree

Treat `AGENTS.md` as correct and flag the conflict to the user instead of guessing.