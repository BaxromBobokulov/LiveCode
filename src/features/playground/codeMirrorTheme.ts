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
const dark = {
  background: '#1E1E1E',
  text: '#D4D4D4',
  lineNumber: '#858585',
  cursor: '#AEAFAD',
  selection: 'rgba(38, 79, 120, 0.85)',
  execLine: 'rgba(255, 255, 255, 0.07)',

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

    // The currently executing line: a subtle light overlay plus the same 3px accent bar as light mode.
    '.cm-execLine': { backgroundColor: dark.execLine },
    '.cm-gutterElement.cm-execLine': { boxShadow: 'inset 3px 0 0 var(--color-accent)' },
  },
  { dark: true },
)

// Operators and punctuation are left unmapped so they keep the default text color.
const syntaxColors = HighlightStyle.define([
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
])

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
  elementClass = 'cm-execLine'
}
const execLineMarker = new ExecLineMarker()

/** Highlights one line (1-based) in both the code and the line-number gutter. */
export function execLineHighlight(line: number): Extension {
  const lineStart = (doc: EditorView['state']['doc']) => doc.line(Math.min(Math.max(line, 1), doc.lines)).from

  return [
    EditorView.decorations.compute(['doc'], (state) =>
      Decoration.set([Decoration.line({ class: 'cm-execLine' }).range(lineStart(state.doc))]),
    ),
    gutterLineClass.compute(['doc'], (state) => RangeSet.of([execLineMarker.range(lineStart(state.doc))])),
  ]
}
