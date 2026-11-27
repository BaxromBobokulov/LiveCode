# 0002. URL routing for sections, problems and examples

**Date**: 2026-11-28
**Status**: Proposed

## Summary

Every section, problem and example gets its own address, like `livecode.uz/problems/discount`, so the browser Back button works and teachers can share a link straight to one problem. We add react-router (a standard library that keeps the address bar and the screen in step) and make the URL the one thing that says what is open. The code a student typed is still saved in the browser and comes back on reload, as long as the URL points at the same problem or example.

## Context

LiveCode is a client side single page app (one HTML page; JavaScript draws every screen). Which section is showing (`activeTab`) and which problem or example is open (`problemId`, `exampleId`) live only in the Zustand store (`src/store/playgroundStore.ts`). The address bar always reads `livecode.uz/`. So Back leaves the site instead of going back one screen, a refresh can only guess from localStorage what was open, and a teacher can't send students a link to one problem. A usability audit named this the fix with the biggest growth impact, since Telegram links are how LiveCode spreads.

Opening a problem or an example doesn't show a page of its own: `loadProblem` / `loadExample` put it into the Playground editor and switch to the Playground. The ids are camelCase (`bubbleSort`, `largerOfTwo`). The last change saves `livecode.code`, `livecode.problemId` and `livecode.exampleId` in localStorage, so a reload reopens the code where it was written. Any URL design has to agree with that save rather than fight it.

Forces: `AGENTS.md` asks for the simplest readable code and approval before any new npm package (given in the design conversation for react-router). The site is on Vercel (see the README), which serves `index.html` only for `/` unless told otherwise. PostHog sends one `$pageview` at load (`capture_pageview: true`). Spec 0001 set a static canonical link (`https://livecode.uz/`) and a sitemap that lists only `/`, with a follow up to add deep links once they exist. The UI has three languages (uz, en, ru); the audience is mostly Uzbek.

## Requirements

**User stories**:
- As a teacher, I want to copy a link to one problem and send it to my class, so every student opens that exact problem.
- As a student, I want the Back button to take me back one screen (the problem list, the previous problem), not off the site.
- As a student, I want a reload to keep me on the same problem with my code still in the editor.
- As the team, I want analytics to show which sections and problems get used.

**Acceptance criteria**:
- **AC-1**: The routes are `/` (Playground), `/examples`, `/examples/<slug>`, `/problems`, `/problems/<slug>`, `/learn`. The paths are English and don't change with the UI language. `<slug>` is the item's id in kebab case (`bubbleSort` → `bubble-sort`, `largerOfTwo` → `larger-of-two`, `discount` → `discount`).
- **AC-2**: Loading `/problems/<slug>` fresh (typed in, pasted, or reloaded) shows the Playground with that problem open (statement, Check, starter code). `/examples/<slug>` shows the Playground with that example loaded at step 1. `/examples`, `/problems` and `/learn` show their screens.
- **AC-3**: At `/examples/<slug>` and `/problems/<slug>` the Playground tab looks selected, as it does today after opening an item.
- **AC-4**: Every in app move updates the URL. A tab click goes to that section; the Playground tab goes to the open item's URL (`/problems/<slug>` if a problem is open, else `/examples/<slug>` of the loaded example). Opening a problem or example from its list, "Random problem", and "← All problems" each go to their URL.
- **AC-5**: User moves (AC-4) push a history entry, so Back and Forward step through them one at a time and the screen follows. Fixups (a redirect from `/`, an unknown slug or path) replace the entry, so Back never bounces into a redirect.
- **AC-6**: On the first load only, loading `/` with a saved problem replaces the URL with `/problems/<slug>` and opens it with its saved code. With a saved example, `/` is replaced with `/examples/<slug>`. With nothing saved, the URL stays `/` and the first example shows.
- **AC-7**: When the URL's item is the same as the saved item, the saved code comes back (not the starter code). When it's a different item, it opens with its own starter (or example) code, replacing the editor's code, the same as clicking it in the list today.
- **AC-8**: Moving between URLs that name the item already open (a section tab and back, Back/Forward to the same problem, clicking the open problem's row) never resets the editor's code, the trace, the step, or the Check result.
- **AC-9**: An unknown slug replaces the URL with its section list (`/problems/xyz` → `/problems`, `/examples/xyz` → `/examples`). Any other unknown path replaces to `/`.
- **AC-10**: Fresh loads of every route return the app from Vercel (no 404). `/og-image.png`, `/robots.txt`, `/sitemap.xml` and the Yandex verification file are still served as files.
- **AC-11**: PostHog sends a `$pageview` on the first load and on every URL change (push, replace, Back, Forward), with the path in `$current_url`. No new event type, and nothing about the student's code is sent.
- **AC-12**: Problem rows, example cards and the top tabs are real links: right click "Copy link" gives the item's full URL, and Ctrl+click or a middle click opens it in a new tab. A normal click navigates in place. They look exactly the same as before.
- **AC-13**: The browser tab title follows the route and the UI language: `/` keeps `app.title`. A section reads `<Section> · LiveCode`, and an item reads `<Item title> · <Section> · LiveCode`, both in the current language.
- **AC-14**: `public/sitemap.xml` lists `/`, `/examples`, `/problems`, `/learn` and every example and problem URL. The page's canonical link is set at runtime to the current route's URL.
- **AC-15**: Leaving the Playground (to any other section) stops Auto Play, as `setTab` does today. The line follow scroll, the Execution panel and the code save keep working unchanged.

## Options considered

### Option 1: react-router v7, declarative mode

`BrowserRouter` around the app; `useLocation`, `useNavigate` and `<Link>` in the components. No data loaders, no framework mode, no server rendering.

**Pros**:
- The standard React router: documented, supports React 19, and the API is what learners meet in other projects.
- Handles link clicks (modifier keys, new tab), `popstate` and StrictMode for us.

**Cons**:
- A new dependency of about 20 to 25 KB gzipped, used for a small part of what it can do.
- Its major versions have changed APIs before (v5 to v6), which is an upgrade cost later.

### Option 2: wouter

A roughly 2 KB router with a hooks API similar to react-router's.

**Pros**:
- Very small, and the API is about as simple as hand written code.

**Cons**:
- Less familiar to students reading the source, smaller ecosystem, fewer answers when something goes wrong.

### Option 3: No library, the History API by hand

About 60 lines: read `location.pathname`, call `history.pushState`, listen to `popstate`, and write a `<Link>` that handles modifier keys.

**Pros**:
- No dependency, and every line is visible in the repo.

**Cons**:
- We own the edge cases (Ctrl+click, middle click, `popstate` timing, StrictMode double effects), which react-router already solves.

### Ownership of "what is open" (decided alongside the router)

(a) **The URL wins; localStorage fills in bare `/`.** (b) The URL wins, but bare `/` stays `/` after restoring the saved item. (c) localStorage stays primary and the URL only mirrors it. Option (c) makes a shared link lose to whatever the student had saved, which defeats the reason for this change. Option (b) lets `/` mean different things to different people. Option (a) has one rule: the address bar always names what's open.

## Decision

**Chosen option**: Option 1: react-router v7, declarative mode

Add `react-router` (v7, approved in the design conversation). The URL is the source of truth for the section and the open item; localStorage keeps the code and only chooses the item on bare `/`. User moves push and fixups replace. PostHog captures a pageview on every history change.

RECOMMEND calls made here (pick · why · runner up):
- **One route parser, not `<Routes>`.** A pure `parseRoute(pathname)` in `src/lib/routes.ts` returns `{ tab, kind, slug }`, and `App` keeps rendering screens by `tab` the way it does today. Why: `/`, `/examples/:slug` and `/problems/:slug` all render the same `PlaygroundScreen`, and keeping it at one place in the tree means it never remounts (so the editor, the scroll follow and the Execution panel keep their state), and the parser is easy to unit test. Runner up: `<Routes>` with three `<Route>`s sharing an element, which works but hides the "never remount" guarantee inside the library.
- **Remove `activeTab` and `setTab` from the store.** Why: two owners of "which tab" would drift; the tab comes from the URL. The auto play pause moves to the route sync effect. `loadProblem` / `loadExample` stop setting `activeTab`. Runner up: keep `activeTab` mirrored from the URL, which leaves a second copy for no reader.
- **One sync effect, URL to store.** `useRouteSync` in `App` runs on every location change: if the route names an item the store doesn't have open, call `loadProblem` / `loadExample`; same item, do nothing (AC-8). Click handlers only navigate. "Random problem" is the one exception: it calls `loadRandomProblem()` first (so `allProblemsSolved` is set), then navigates to the picked id; the sync effect then sees the same item and leaves it alone.
- **Slugs derived, not stored.** `toSlug(id)` turns camelCase into kebab case; `fromSlug` looks up the item whose `toSlug(id)` matches. Lookup by match, not by reversing the string, so an id with digits or capitals in a row still works. A unit test asserts every slug is unique.
- **Canonical at runtime.** The same effect that sets the title sets `<link rel="canonical">` to `https://livecode.uz` + the path. Why: the static `https://livecode.uz/` canonical would tell Google every deep link is a copy of home, cancelling the sitemap. Runner up: delete the static canonical, which loses it for crawlers that don't run JS.
- **The title moves out of `applyLocale`.** `useDocumentTitle` in `App` owns `document.title` (it depends on route and locale). `applyLocale` keeps setting `lang` only. `index.html` keeps its static Uzbek title for bots.
- **Links keep their look.** Problem rows and example cards change from `<button>` to `<Link>` with the same classes. The tab bar becomes `<nav>` with `<Link aria-current="page">` instead of `role="tablist"` buttons (the correct pattern for page navigation). `Tabs.tsx` takes `to` per tab instead of `onChange`. `example_opened` is still tracked in the card's `onClick`.

## Rationale

The force that matters most is that a shared link must open the exact problem every time. That rules out storage owning the item, and it means a fresh load, not just in app clicks, has to work: hence the URL as the only owner, plus the Vercel rewrite. Keeping localStorage as the owner of the *code* (not the item) is what lets the two coexist: the saved code is used only when it belongs to the item the URL names, which is exactly the behavior a student expects from a reload.

react-router over the hand written History API: the hand written version is short until you add real links (Ctrl+click, middle click), `popstate` and StrictMode, and real links are what make "Copy link" work for teachers. Using it in declarative mode with our own `parseRoute` keeps the routing code to one readable file and keeps the Playground from remounting, which protects the scroll follow and Execution panel behavior from the last tasks. wouter would also work; react-router wins on familiarity for a codebase that's meant to teach.

Push for user moves matches every other website, so Back from a problem returns to the list the student picked it from. Replace for redirects avoids the classic loop where Back lands on a URL that just redirects forward again. For analytics, PostHog's `history_change` mode gives page views per path with one config change and no new event to keep typed and documented.

## Feature design

**Route table** (`src/lib/routes.ts`):

| Path | Tab shown | Item | Notes |
|---|---|---|---|
| `/` | playground | from localStorage | replace to item URL if one was saved (AC-6) |
| `/examples` | examples | none | |
| `/examples/:slug` | playground | example `fromSlug(slug)` | unknown → replace `/examples` |
| `/problems` | problems | none | |
| `/problems/:slug` | playground | problem `fromSlug(slug)` | unknown → replace `/problems` |
| `/learn` | learn | none | |
| anything else | n/a | n/a | replace `/` |

Trailing slashes and capitals are accepted, then normalized with a replace: `/problems/Discount/` becomes `/problems/discount`, so the canonical URL and analytics paths are always lowercase without a trailing slash.

**Navigation actions**:

| Trigger | Goes to | History |
|---|---|---|
| Tab: Playground | `playgroundPath(store)` | push |
| Tab: Examples / Problems / Learn | `/examples` · `/problems` · `/learn` | push |
| Example card | `/examples/<slug>` | push |
| Problem row | `/problems/<slug>` | push |
| Random problem | `/problems/<picked slug>` after `loadRandomProblem()` | push |
| ← All problems | `/problems` | push |
| Bare `/` with a saved item | that item's URL | replace |
| Unknown slug or path | section list or `/` | replace |
| Browser Back / Forward | the history entry | (browser) |

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Parse route | tab, kind, slug | `location.pathname` via `parseRoute` |
| Open item from route | problem / example | `problems` / `examples` in `src/data/`, matched by `toSlug(id)` |
| Editor code on load | saved code or starter code | `livecode.code` when the route's item equals `livecode.problemId` / `livecode.exampleId` (store init), else `loadProblem` / `loadExample` starter code |
| Item on bare `/` | problem or example | `livecode.problemId`, else `livecode.exampleId` (store init, unchanged) |
| Whether `/` should redirect | saved item exists, first load only | a store flag `restoredFromSave` set at init when either key was found; checked only for the location the app started on |
| Playground tab target | item URL | `problemId` → `/problems/<slug>`, else `/examples/<slug(exampleId)>` |
| Tab title | localized string | `t('nav.*')`, `problem.title[locale]`, `exampleText(example, 'title')`, `app.title` for `/` |
| Canonical href | absolute URL | `https://livecode.uz` + normalized path |
| `$pageview` | path | PostHog `capture_pageview: 'history_change'` reads `window.location` |
| Sitemap entries | URLs | hand edited static file, one `<url>` per section and per `toSlug(id)`; a unit test checks it lists every item |

**Resolved details** (from the cross check):
- **Sync timing.** `useRouteSync` runs in `useLayoutEffect` (before the browser paints), so neither a fresh load nor Back/Forward shows the old item for a frame.
- **Open item.** The open item is the problem when `problemId` is set, otherwise the example `exampleId`. So `/examples/sum` with a problem open still calls `loadExample('sum')`, even though `exampleId` may already be `sum`.
- **The `/` redirect.** It fires only when `pathname === '/'`, `location.key === 'default'` (react-router's key for the entry the app started on) and `restoredFromSave` is true. `restoredFromSave` is true when the saved problem id or the saved example id still names an existing item; a removed id counts as nothing saved. The replace is idempotent, so StrictMode's double effect is harmless. Reaching `/` later (only possible by Back when nothing was saved) shows whatever is open.
- **`toSlug`.** `id.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()`: `bubbleSort` → `bubble-sort`, `largerOfTwo` → `larger-of-two`, `sum2` → `sum2`. Lookup compares `toSlug(id)` with the lowercased slug.
- **Title.** Joined with a hardcoded ` · `. Item routes name their list section, not the Playground: `/problems/discount` → `Discount · Problems · LiveCode` (uz: `… · Masalalar · LiveCode`). Sections use `t('nav.examples' | 'nav.problems' | 'nav.learn')`. The hook updates the existing `<link rel="canonical">` in `index.html` to the normalized final path. `og:url` stays static (bots don't run JS).
- **`example_opened`.** Still tracked in the card's `onClick` only, so the metric keeps meaning "picked from the list". It doesn't fire on deep links, reloads or Back/Forward.
- **"← All problems".** Stays a `Button` and calls `navigate('/problems')`.
- **Same URL clicks.** react-router v7's `<Link>` replaces instead of pushing when the target equals the current URL, so clicking the open row or the active tab never adds a duplicate history entry.
- **Card preview focus.** If the read only CodeMirror preview inside an example card link is focusable (a second tab stop), wrap it in an `inert` element so the card is one tab stop and a click anywhere navigates.
- **Callers.** `setTab` is used only in `App.tsx` and `ProblemPanel.tsx`; `activeTab` only in `App.tsx` and two store tests. All of them are converted.
- **PostHog.** `initAnalytics()` already runs before `createRoot` in `main.tsx`, so PostHog patches `history` before the router's first call. posthog-js 1.438 supports `history_change`.

**Key invariants**:
- The URL alone decides the section and the open item; the store never navigates.
- The sync effect loads an item only when it differs from the store's open item, so a URL change that names the open item never touches the code (AC-8).
- The `/` redirect runs once, for the location the app started on. Coming back to `/` later with Back shows the Playground as it is, so Back is never bounced forward.
- `PlaygroundScreen` renders at one place in the tree for all three Playground routes, so it never remounts on a route change.
- localStorage keys and their meaning stay unchanged (no migration).
- Every `toSlug(id)` is unique within its kind.

**Security model**: none new. Everything is public and client side. Slugs are public ids; PostHog gets paths only, never code or input.

**Configuration required**:
- `vercel.json` (new): `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`. Vercel serves real files from `dist/` before applying rewrites, so static assets keep working.
- `src/lib/analytics.ts`: `capture_pageview: 'history_change'`.

**Critical test scenarios**:
- Unit, `parseRoute`: every row of the route table, trailing slash, mixed case, unknown slug and unknown path, verifies **AC-1**, **AC-9**
- Unit, `toSlug`: `bubbleSort` → `bubble-sort`, `largerOfTwo` → `larger-of-two`; all slugs unique, verifies **AC-1**
- Fresh load `/problems/discount` (vite preview): problem statement and starter code show, Playground tab selected, verifies **AC-2**, **AC-3**
- Type in a problem, reload: same URL, same code, verifies **AC-7**
- Saved problem A, load `/problems/b`: problem B with its starter code, verifies **AC-7**
- Load `/` with a saved problem: URL becomes `/problems/<slug>`; Back does not return to `/`, verifies **AC-5**, **AC-6**
- Problems list → open discount → open sum example → Back, Back, Forward: the screens follow each step (sum, then discount with its starter code, since sum replaced it, then the Problems list, then discount again with its code kept), verifies **AC-4**, **AC-5**, **AC-7**, **AC-8**
- Random problem → Back → Forward: the URL and the problem follow; the URL is lowercase after `/problems/Discount/`; a saved id that no longer exists leaves `/` as is, verifies **AC-4**, **AC-6**, **AC-9**
- Edit code on a problem, click the Problems tab, click Playground: code, trace and Check result unchanged, verifies **AC-8**
- `/problems/nope` → `/problems`, `/whatever` → `/`, Back skips them, verifies **AC-9**
- `vite preview` with the rewrite (or the deployed preview): `/learn` returns the app, `/og-image.png` returns the PNG, verifies **AC-10**
- PostHog network panel: one `$pageview` per URL change, verifies **AC-11**
- Right click a problem row → Copy link gives `https://…/problems/<slug>`; Ctrl+click opens a new tab, verifies **AC-12**
- Switch language on `/problems/discount`: the title changes language, verifies **AC-13**
- Auto Play running, click Learn: Auto Play stops; back to Playground, line follow still scrolls, verifies **AC-15**

## Build plan

Tracer Bullet (from the scope header): first one thin route working end to end (fresh load, in app link, Back), then thicken.

1. Install `react-router` v7; wrap `<App />` in `<BrowserRouter>` in `src/main.tsx`; add `vercel.json`, satisfies **AC-10**
2. Add `src/lib/routes.ts` (`parseRoute`, `toSlug`, `findProblemBySlug`, `findExampleBySlug`, `itemPath`) with unit tests, satisfies **AC-1**, **AC-9**
3. Thin thread: `App` derives the tab from `parseRoute(location.pathname)`; add `useRouteSync` (load the route's item when it differs, replace on unknown, pause Auto Play when leaving the Playground); remove `activeTab` / `setTab` from the store and update its tests, satisfies **AC-2**, **AC-3**, **AC-8**, **AC-9**, **AC-15**
4. Bare `/` redirect: add `restoredFromSave` to the store init and the replace in `useRouteSync`, satisfies **AC-6**, **AC-7**
5. Links: `Tabs.tsx` to a `<nav>` of `<Link>`s with `aria-current`; problem rows and example cards to `<Link>`; "← All problems" and "Random problem" navigate, satisfies **AC-4**, **AC-5**, **AC-12**
6. Analytics: `capture_pageview: 'history_change'`, satisfies **AC-11**
7. `useDocumentTitle` (title plus canonical) in `App`; drop the `document.title` line from `applyLocale`, satisfies **AC-13**, **AC-14**
8. `public/sitemap.xml`: list the sections and every item URL by hand; update its comment; add a unit test that every problem and example slug is in it, satisfies **AC-14**
9. Run `npm run lint`, `npm run typecheck`, `npm test`, then the critical scenarios above in `vite preview`, satisfies **AC-1** to **AC-15**

## Consequences

**Positive**:
- Back and Forward work, reloads land where the student was, and a teacher can share `livecode.uz/problems/discount`.
- PostHog shows usage by path, with no new event to maintain.
- Search engines get real pages to index.

**Negative / tradeoffs**:
- A new dependency (react-router) of about 20 to 25 KB gzipped, and a future major version upgrade to plan for.
- Following a link to a different problem replaces the editor's code for the saved one, as clicking does today. Back to that problem shows its starter code, not the lost edits. Saving code per problem would fix that and is its own spec.
- Clicking the already open problem or example no longer resets its code to the starter (today it does). Reset stays the way to start over; the starter code of a problem can only be restored by editing it back or opening another problem first.
- Telegram previews of deep links stay the generic Uzbek card: bots don't run JavaScript. Per item previews need prerendering.
- The runtime canonical helps Google, which runs JS; Yandex may still see only the static `https://livecode.uz/` canonical in the HTML.
- Forward to a random problem, or a reload of it, loses the "all problems solved" note (the flag isn't in the URL). Random can also pick the problem that's already open and reset its code, as it does today.
- PostHog will count more `$pageview`s than before (one per move), so old and new charts aren't comparable across the release date.
- Renaming a problem or example id breaks its old links (it already drops saved progress).

**Neutral**:
- `AGENTS.md` lists `activeTab` in the store and describes tabs as state; it needs updating after the build (owned by `/sync`).
- `vite dev` already falls back to `index.html` for unknown paths; only production needs the rewrite.
- The sitemap now has about 26 URLs to keep in step with the data files.
- A `/` redirect sends one `$pageview`, for the final (replaced) URL, not one for `/` as well: PostHog captures the first page view after the router has already replaced the URL. Confirmed by `/check verify` on 2026-11-28.

## Follow-up

- [ ] Decide whether to save code per problem, so following a link never loses another problem's edits.
- [ ] Decide on prerendering (static HTML per route) for per item Telegram previews and Yandex.
- [ ] After deploying, resubmit the sitemap in Google Search Console and Yandex Webmaster.
- [ ] `/sync` should update `AGENTS.md` (store fields, routing, the new dependency, links instead of tab buttons).
- [ ] No scope row covers this work yet. You can enroll it with `/scope` if you want it tracked there.
