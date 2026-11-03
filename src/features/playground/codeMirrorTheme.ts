import { cppLanguage } from '@codemirror/lang-cpp'
import {
  HighlightStyle,
  LanguageSupport,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language'
import { styleTags, tags } from '@lezer/highlight'
import {
  Decoration,
  EditorView,
  GutterMarker,
  RangeSet,
  gutterLineClass,
  type Extension,
} from '@uiw/react-codemirror'

// The code surface is the one dark panel in the app (AGENTS.md § Code editor panel).
// These colors only exist here, so they live here rather than in src/theme/colors.css.
// The accent bar still comes from the shared Tailwind token through its CSS variable.
// Exported for exportCodeImage.ts, which draws the code in the same colors.
export const dark = {
  background: '#1E1E1E',
  text: '#D4D4D4',
  lineNumber: '#858585',
  cursor: '#AEAFAD',
  selection: 'rgba(38, 79, 120, 0.85)',
  execLine: 'rgba(255, 255, 255, 0.07)',
  staleLine: 'rgba(255, 255, 255, 0.03)',
  // The current line's left bar and gutter arrow: a lighter accent blue, since the accent itself is only
  // 2.63:1 on execLine. This one is 4.18:1 there (5.11:1 on the plain background), over the 3:1 for a graphic.
  execMarker: '#6886FF',

  // VS Code Dark+ suggestion dropdown
  popup: '#252526',
  popupBorder: '#454545',
  popupSelected: '#04395E',
  popupMatch: '#2AAAFF',
  popupDetail: '#9D9D9D',

  // VS Code Dark+ syntax colors
  keyword: '#569CD6',
  flowKeyword: '#C586C0',
  type: '#4EC9B0',
  variable: '#9CDCFE',
  function: '#DCDCAA',
  string: '#CE9178',
  escape: '#D7BA7D',
  number: '#B5CEA8',
  comment: '#6A9955',
}

const editorChrome = EditorView.theme(
  {
    '&': {
      backgroundColor: dark.background,
      color: dark.text,
      fontSize: '13px',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '22px' },
    '.cm-content': { padding: '12px 0 13px', caretColor: dark.cursor },
    '.cm-cursor': { borderLeftColor: dark.cursor },
    '.cm-content ::selection, .cm-selectionBackground': { backgroundColor: dark.selection },
    '.cm-line': { padding: '0 16px' },
    '.cm-gutters': {
      backgroundColor: dark.background,
      color: dark.lineNumber,
      border: 'none',
    },
    '.cm-lineNumbers .cm-gutterElement': { minWidth: '46px', padding: '0', textAlign: 'right' },

    // The currently executing line: a subtle light overlay plus a 3px blue bar, in execMarker's lighter blue.
    '.cm-execLine': { backgroundColor: dark.execLine },
    '.cm-gutterElement.cm-execLine': { boxShadow: `inset 3px 0 0 ${dark.execMarker}`, position: 'relative' },
    // Plus a debugger-style arrow left of the line number, so the line is found at a glance, not only by its tint.
    // Line numbers are right-aligned in the 46px gutter, so even a 3-digit number leaves room for it.
    '.cm-gutterElement.cm-execLine::before': {
      content: '""',
      position: 'absolute',
      left: '8px',
      top: '50%',
      width: '9px',
      height: '12px',
      marginTop: '-6px',
      backgroundColor: dark.execMarker,
      clipPath: 'polygon(0 0, 45% 0, 100% 50%, 45% 100%, 0 100%)',
    },
    // The same line in the error tone, when the last Run stopped on a CodeError/UnsupportedConstructError.
    // A 7% mix of the error token, like execLine's 7% white (errorTint is a light-mode fill). It keeps
    // every syntax color at 4.5:1 or more; the line number turns text-colored, as dimmed gray it would not.
    '.cm-execLine-error': { backgroundColor: 'color-mix(in srgb, var(--color-error) 7%, transparent)' },
    '.cm-gutterElement.cm-execLine-error': { boxShadow: 'inset 3px 0 0 var(--color-error)', color: dark.text },
    // The arrow marks where the Run stopped, in the error tone: 4.15:1 (light) / 5.47:1 (dark) on this line.
    '.cm-gutterElement.cm-execLine-error::before': { backgroundColor: 'var(--color-error)' },
    // Either tone, once the code was edited after it was made (the line may now hold different code):
    // a fainter overlay and a gray bar, so it reads as "out of date". After the two rules above, so it wins.
    // On this overlay the dimmed line number would be 4.15:1, so it turns text-colored (10.34:1) like the
    // error tone; the gray bar is a graphic, 4.15:1 against the 3:1 non-text minimum.
    '.cm-execLine-stale': { backgroundColor: dark.staleLine },
    '.cm-gutterElement.cm-execLine-stale': { boxShadow: `inset 3px 0 0 ${dark.lineNumber}`, color: dark.text },
    // No arrow on a stale line: it would claim this is where the program is, and the line may now hold other code.
    '.cm-gutterElement.cm-execLine-stale::before': { display: 'none' },

    // Autocomplete dropdown, styled like VS Code's suggestion list.
    '.cm-tooltip.cm-tooltip-autocomplete': {
      backgroundColor: dark.popup,
      border: `1px solid ${dark.popupBorder}`,
      color: dark.text,
    },
    '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font-mono)', fontSize: '13px' },
    '.cm-tooltip-autocomplete > ul > li': { padding: '2px 8px' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: dark.popupSelected, color: dark.text },
    '.cm-completionMatchedText': { color: dark.popupMatch, textDecoration: 'none', fontWeight: '600' },
    '.cm-completionDetail': { color: dark.popupDetail, fontStyle: 'normal', marginLeft: '12px' },
    // The usage hint panel beside the highlighted suggestion.
    '.cm-tooltip.cm-completionInfo': {
      backgroundColor: dark.popup,
      border: `1px solid ${dark.popupBorder}`,
      color: dark.text,
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      padding: '4px 8px',
      whiteSpace: 'pre',
    },
  },
  { dark: true },
)

// Operators and punctuation are left unmapped so they keep the default text color.
// Exported for exportCodeImage.ts, which colors the downloaded image with the same rules.
export const syntaxRules = [
  { tag: [tags.controlKeyword, tags.keyword, tags.modifier, tags.definitionKeyword], color: dark.keyword },
  { tag: [tags.special(tags.controlKeyword), tags.processingInstruction], color: dark.flowKeyword },
  { tag: [tags.typeName, tags.standard(tags.typeName)], color: dark.type },
  { tag: tags.variableName, color: dark.variable },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.definition(tags.variableName))],
    color: dark.function,
  },
  { tag: [tags.string, tags.special(tags.string), tags.character], color: dark.string },
  { tag: tags.escape, color: dark.escape },
  { tag: tags.number, color: dark.number },
  { tag: [tags.lineComment, tags.blockComment], color: dark.comment, fontStyle: 'italic' },
]
const syntaxColors = HighlightStyle.define(syntaxRules)

export const codeMirrorTheme: Extension = [editorChrome, syntaxHighlighting(syntaxColors)]

// Example-card previews (Examples tab): same colors as the editor, but read-only and clipped
// instead of scrolling, so the whole card stays one click target.
export const codePreview: Extension = [
  EditorView.editable.of(false),
  EditorView.theme({ '.cm-scroller': { overflow: 'hidden' }, '.cm-content': { cursor: 'pointer' } }),
]

// lang-cpp tags `return` like `if`/`for`; re-tag it so it gets Dark+'s purple flow-keyword color.
// lang-cpp already knows how deep each block is; indentUnit matches the 4 spaces used in
// src/data/examples, and indentOnInput re-indents a line when `}` is typed so it lines up with its `{`.
export const cLanguage = new LanguageSupport(
  cppLanguage.configure({ props: [styleTags({ return: tags.special(tags.controlKeyword) })] }),
  [indentUnit.of('    '), indentOnInput()],
)

class ExecLineMarker extends GutterMarker {
  elementClass: string
  constructor(elementClass: string) {
    super()
    this.elementClass = elementClass
  }
}

/**
 * Highlights one line (1-based) in both the code and the line-number gutter:
 * blue for the current step, red for the line a Run stopped on with an error,
 * dimmed in either tone when `stale` (the code was edited since, see `staleness` in playgroundStore).
 */
export function execLineHighlight(line: number, tone: 'current' | 'error' = 'current', stale = false): Extension {
  const lineStart = (doc: EditorView['state']['doc']) => doc.line(Math.min(Math.max(line, 1), doc.lines)).from
  const marker = new ExecLineMarker(
    ['cm-execLine', tone === 'error' && 'cm-execLine-error', stale && 'cm-execLine-stale'].filter(Boolean).join(' '),
  )

  return [
    EditorView.decorations.compute(['doc'], (state) =>
      Decoration.set([Decoration.line({ class: marker.elementClass }).range(lineStart(state.doc))]),
    ),
    gutterLineClass.compute(['doc'], (state) => RangeSet.of([marker.range(lineStart(state.doc))])),
  ]
}
