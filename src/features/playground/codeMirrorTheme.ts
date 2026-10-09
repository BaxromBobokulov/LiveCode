import {
  Decoration,
  EditorView,
  GutterMarker,
  RangeSet,
  gutterLineClass,
  type Extension,
} from '@uiw/react-codemirror'

// CodeMirror is themed with JS objects, not classNames, so colors come from the
// same Tailwind tokens through their CSS variables (see src/theme/colors.css).
export const codeMirrorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--color-white)',
    color: 'var(--color-text)',
    fontSize: '13px',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '22px' },
  '.cm-content': { padding: '12px 0 13px', caretColor: 'transparent' },
  '.cm-line': { padding: '0 16px' },
  '.cm-gutters': {
    backgroundColor: 'var(--color-white)',
    color: 'var(--color-textFaint)',
    border: 'none',
  },
  '.cm-lineNumbers .cm-gutterElement': { minWidth: '46px', padding: '0', textAlign: 'right' },

  // The currently executing line: light blue tint plus a 3px accent bar on the left.
  '.cm-execLine': { backgroundColor: 'var(--color-accentTint)' },
  '.cm-gutterElement.cm-execLine': { boxShadow: 'inset 3px 0 0 var(--color-accent)' },
})

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
