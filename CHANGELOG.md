# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- The code in the Playground editor is now saved in your browser, so a page refresh brings it back instead of resetting to the first example. It is saved half a second after you stop typing (and right away when you close the page), and it is never sent anywhere.

### Changed
- The editor title now says "My code" ("Mening kodim", "Мой код") once you change the code away from the loaded example, so a student doesn't take the example's name for a description of their own program. The same title is used after a successful Run of your own code (it used to say "Your Code").
- The product name is LiveCode everywhere. The Learn section ("How LiveCode works") and the exported code image file name (`livecode-code-….png`) no longer say CodeVision.
- Saved browser data now uses the `livecode.` prefix instead of `codevision.`. On the first load after this update, saved theme, language, panel split, text size, Auto Play speed, folded topics, badges and solved problems move to the new names automatically, so nobody loses their progress or preferences.

### Fixed
- After a Run that fails with an error, the Execution panel no longer shows the previous example's step count, explanation, variables, array and console under the error message, where they looked like the output of the broken code. Only the error is shown until you fix the code and run it again, or press Reset.
