# 0001. SEO and social preview metadata for livecode.uz

**Date**: 2026-11-28
**Status**: Accepted

## Summary

LiveCode is a single page app, so the HTML a crawler or a link preview bot downloads is almost empty. This spec fixes what those bots read: the real domain (livecode.uz), a branded preview picture for Telegram, a robots.txt and sitemap, a canonical link, an Uzbek page title, and one real main heading. Everything is static files and small edits; no new dependency and no server rendering.

## Context

Telegram is the main way LiveCode spreads. Telegram's preview bot (and most others) never runs JavaScript, so it only sees `index.html`. Before this change that file pointed `og:url` at the old Vercel domain, had no `og:image` (so shared links showed no picture), had an English `<title>`, and said `lang="en"` while Uzbek speakers are the main audience. `/robots.txt` and `/sitemap.xml` returned 404, there was no canonical link, and the rendered page had no `<h1>` (only `<h2>` section headings).

Forces: the app has no router (the four tabs are Zustand state, `activeTab`), so `https://livecode.uz/` is the only real URL. `AGENTS.md` forbids new libraries without approval and asks for the smallest useful version. The app already chooses its language at runtime (`applyLocale` in `src/store/settingsStore.ts`: saved choice, else browser language, else `en`).

## Requirements

**User stories**:
- As someone sharing livecode.uz in Telegram, I want a branded preview card so the link looks trustworthy and gets clicked.
- As a search engine, I want a canonical URL, a sitemap, crawl rules and a clear title and heading so I index the right page in the right language.

**Acceptance criteria**:
- **AC-1**: `og:url` in the built `index.html` is `https://livecode.uz/`; no reference to `livecode-chi.vercel.app` remains.
- **AC-2**: `og:image` points to `https://livecode.uz/og-image.png`, a 1200x630 PNG checked into `public/`, using the mascot, the accent `#2e5bff` and IBM Plex. `og:image:width`, `og:image:height`, `og:image:alt` and `twitter:card=summary_large_image` are set.
- **AC-3**: `/robots.txt` and `/sitemap.xml` return 200 from the built site. The sitemap lists only `https://livecode.uz/`. robots.txt allows everything and names the sitemap.
- **AC-4**: The built head has `<link rel="canonical" href="https://livecode.uz/">`.
- **AC-5**: The static HTML has `lang="uz"` and an Uzbek `<title>` and `og:title`.
- **AC-6**: The rendered page has exactly one `<h1>`, and the header looks the same as before.
- **AC-7**: At runtime the tab title follows the chosen language (UZ/EN/RU), the same way `lang` already does.

## Options considered

**Which element becomes the `<h1>`.** (a) The header wordmark "LiveCode". (b) The first tab's panel heading (for example the example title in `EditorPanel`). (c) A new visible hero heading. (d) A visually hidden heading. Option (b) changes with every tab and example, so the page's main heading would be "Sum of Array Elements". Option (c) changes the approved Playground design, which `AGENTS.md` says must match pixel for pixel. Option (d) works but hides text from users, which search engines treat with suspicion. Option (a) is on every tab, comes first in the DOM, names the product, and Tailwind's preflight resets `<h1>` styles so the swap is pixel identical.

**Title language.** (a) Fixed Uzbek in `index.html` only. (b) Uzbek in `index.html`, plus a runtime `document.title` per language. (c) Runtime updates of `og:*` and description tags too. Preview bots never run JavaScript, so (c) changes nothing they see and only adds code. (b) costs one translation key and one line, and makes the browser tab and history match the UI language.

**og:image production.** (a) An HTML template rendered once with headless Chrome (already installed) and checked in. (b) A design made by hand in a design tool and supplied by the team. (c) Generated per request on the server (for example `@vercel/og`). (c) needs a server function and a dependency for one static picture. (b) blocks on someone else. (a) needs no new dependency, uses the real brand tokens and fonts, and can be re-rendered when the copy changes.

**robots.txt and sitemap.** (a) Static files in `public/` (Vite copies them to `dist/` as is). (b) A Vite plugin that generates them. One URL does not justify a plugin; (a) is enough until deep links exist.

## Decision

- `<h1>`: the header wordmark "LiveCode" in `src/App.tsx`, same classes.
- Title: Uzbek in `index.html` (`LiveCode — Kodni vizual o'rganish platformasi`), plus a new `app.title` key in `translations.ts` that `applyLocale` writes to `document.title`. `og:*` stays static Uzbek.
- og:image: `scripts/og-image/og-image.html` rendered with headless Chrome to `public/og-image.png` (steps in `scripts/og-image/README.md`).
- robots.txt and sitemap.xml: static files in `public/`, sitemap lists the home page only.
- Head also gains `og:site_name`, `og:locale` (`uz_UZ`, alternates `ru_RU`, `en_US`) and `twitter:card`.

## Rationale

Bots that matter here read only the static HTML, so every fix lives in `index.html` or `public/`, and the runtime work is limited to the one thing users actually see (the tab title). Each choice reuses what exists (the mascot PNG, the color and type tokens, Chrome, the translations file, `applyLocale`) instead of adding a library, as `AGENTS.md` asks. The wordmark is the only `<h1>` candidate that is both stable across tabs and free of visual change.

## Feature design

**Value sourcing**:
| Where | Value | Source |
|---|---|---|
| `index.html` head | canonical, `og:url`, `og:image` | fixed absolute URLs on `https://livecode.uz` |
| `index.html` head | title, `og:title` | fixed Uzbek string, same as `translations.uz['app.title']` |
| `document.title` at runtime | localized title | `translations[locale]['app.title']`, set in `applyLocale` |
| `public/og-image.png` | the picture | rendered from `scripts/og-image/og-image.html` |
| `sitemap.xml` | `lastmod` | date of the last real content change, edited by hand |

**Key invariants**: the static head stays in Uzbek; the Uzbek `app.title` and the `index.html` title stay identical; the sitemap lists only URLs that really exist.

**Critical test scenarios**:
- Built `dist/index.html` head contains the new tags and no old domain (AC-1, AC-2, AC-4, AC-5).
- `vite preview` returns 200 with the right content type for `/robots.txt`, `/sitemap.xml`, `/og-image.png`, and the PNG header reads 1200x630 (AC-2, AC-3).
- Rendered DOM has one `<h1>LiveCode</h1>` and the header screenshot is unchanged (AC-6).
- Switching language changes the tab title (AC-7).

## Build plan

1. Make `scripts/og-image/og-image.html`, render `public/og-image.png`, add the README, satisfies **AC-2**
2. Add `public/robots.txt` and `public/sitemap.xml`, satisfies **AC-3**
3. Update the `index.html` head (lang, title, canonical, og tags), satisfies **AC-1**, **AC-2**, **AC-4**, **AC-5**
4. Promote the header wordmark to `<h1>`, satisfies **AC-6**
5. Add `app.title` to all three locales and set `document.title` in `applyLocale`, satisfies **AC-7**

## Consequences

**Positive**:
- Telegram and other bots show a branded card with the right domain and an Uzbek title.
- Google gets a canonical URL, a sitemap and one clear `<h1>`.

**Negative / tradeoffs**:
- The page body is still empty without JavaScript. Google renders JS, but Yandex (used in Uzbekistan) and others see little text. Fixing that needs prerendering, which is a bigger decision.
- The og:image is static. Changing its copy means editing the template and rendering again by hand.
- Everyone who shares the link gets the Uzbek card, including Russian and English speakers.
- Runtime fallback language is still `en` for browsers that are not `uz` or `ru`, while the static HTML now says `uz`. That is intended (bots see Uzbek, people see their own language), but it is a split worth knowing about.

**Neutral**:
- `settingsStore.ts` now imports `translations.ts` (only a type import goes the other way, so there is no runtime cycle).

## Follow-up

- [ ] When tab or problem deep links exist, add them to the sitemap, and give each its own canonical and title.
- [ ] Decide on prerendering the home page (static HTML with real text) for crawlers that do not run JavaScript.
- [ ] After deploying, send `https://livecode.uz` to @WebpageBot in Telegram to clear the old cached preview, and submit the sitemap in Google Search Console and Yandex Webmaster.
- [ ] No scope row covers this work yet. You can enroll it with `/scope` if you want it tracked there.
