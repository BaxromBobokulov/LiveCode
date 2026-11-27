# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Sharing a livecode.uz link in Telegram (and other apps that show link previews) now shows a branded preview picture: the LiveCode mascot, an Uzbek headline and the site address, at 1200x630. The picture is `public/og-image.png`, made from `scripts/og-image/og-image.html`; the README there shows how to render it again. (see spec 0001)
- `robots.txt` and `sitemap.xml` are now served at the site root (they used to return 404), and the page names `https://livecode.uz/` as its canonical address, so search engines know which URL to index. The sitemap lists only the home page, because the tabs don't have their own URLs yet. (see spec 0001)
- The browser tab title now follows the language you pick (UZ, EN or RU), the same way the rest of the interface does.
- The code in the Playground editor is now saved in your browser, so a page refresh brings it back instead of resetting to the first example. It is saved half a second after you stop typing (and right away when you close the page), and it is never sent anywhere.

### Changed
- The page now starts in Uzbek for search engines and link previews: the HTML language is `uz` and the title is "LiveCode — Kodni vizual o'rganish platformasi" instead of the English one. Visitors still see their own language once the app loads. (see spec 0001)
- The "LiveCode" name in the header is now the page's main heading (`<h1>`), so search engines find one clear heading. It looks exactly the same as before.
- The editor title now says "My code" ("Mening kodim", "Мой код") once you change the code away from the loaded example, so a student doesn't take the example's name for a description of their own program. The same title is used after a successful Run of your own code (it used to say "Your Code").
- The product name is LiveCode everywhere. The Learn section ("How LiveCode works") and the exported code image file name (`livecode-code-….png`) no longer say CodeVision.
- Saved browser data now uses the `livecode.` prefix instead of `codevision.`. On the first load after this update, saved theme, language, panel split, text size, Auto Play speed, folded topics, badges and solved problems move to the new names automatically, so nobody loses their progress or preferences.

### Fixed
- Link previews pointed to the old address `livecode-chi.vercel.app`. They now point to `https://livecode.uz/`.
- After a Run that fails with an error, the Execution panel no longer shows the previous example's step count, explanation, variables, array and console under the error message, where they looked like the output of the broken code. Only the error is shown until you fix the code and run it again, or press Reset.
