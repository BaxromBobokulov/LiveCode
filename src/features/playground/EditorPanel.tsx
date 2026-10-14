import { acceptCompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap } from '@codemirror/commands'
import CodeMirror, { Prec, keymap, lineNumbers } from '@uiw/react-codemirror'
import { useId, useMemo, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import Button from '../../components/Button'
import Chip from '../../components/Chip'
import MaximizeButton from '../../components/MaximizeButton'
import Select from '../../components/Select'
import { usesScanf } from '../../engine/interpreter'
import { useTranslation } from '../../i18n/useTranslation'
import { useCurrentExample, usePlaygroundStore } from '../../store/playgroundStore'
import { cAutocomplete } from './cCompletions'
import CopyCodeButton from './CopyCodeButton'
import { cLanguage, codeMirrorTheme, execLineHighlight } from './codeMirrorTheme'

// Only C is supported in this version; the others are shown as coming later.
const languages = [
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++', disabled: true },
  { value: 'python', label: 'Python', disabled: true },
  { value: 'java', label: 'Java', disabled: true },
]

type EditorPanelProps = {
  /** Called when the Run button is pressed. */
  onRun: () => void
  /** The scanf Input field, so Run can scroll to it and focus it when it is missing values. */
  inputRef: RefObject<HTMLInputElement | null>
  /** Whether this panel is expanded to the full width; `onToggleMaximize` flips it. */
  isMaximized: boolean
  onToggleMaximize: () => void
  /** Sizing from PlaygroundScreen (the resizable split). */
  className?: string
}

function EditorPanel({ onRun, inputRef, isMaximized, onToggleMaximize, className = '' }: EditorPanelProps) {
  const example = useCurrentExample()
  const stepIndex = usePlaygroundStore((state) => state.stepIndex)
  const reset = usePlaygroundStore((state) => state.reset)
  const code = usePlaygroundStore((state) => state.code)
  const setCode = usePlaygroundStore((state) => state.setCode)
  const input = usePlaygroundStore((state) => state.input)
  const setInput = usePlaygroundStore((state) => state.setInput)
  const inputMissing = usePlaygroundStore((state) => state.inputMissing)
  const inputCollapsed = usePlaygroundStore((state) => state.inputCollapsed)
  const expandInput = usePlaygroundStore((state) => state.expandInput)
  const runError = usePlaygroundStore((state) => state.runError)
  const { t, exampleText } = useTranslation()
  const inputId = useId()

  const step = example.steps[stepIndex]
  // While the error box is showing, the editor points at the same line, in the error color.
  const highlightLine = runError ? runError.line : step.line
  const highlightTone = runError ? 'error' : 'current'
  // basicSetup is off, so the default keymap (Enter = insertNewlineAndIndent) is added here explicitly.
  // closeBracketsKeymap goes first so its Backspace (delete an empty pair) wins over the default one,
  // the same order CodeMirror's own basicSetup uses. autocompletion already binds Enter/Esc/arrows
  // for the dropdown; Tab is added so it accepts a suggestion too. It needs Prec.high to run before
  // react-codemirror's built-in Tab-to-indent, which still handles Tab when no dropdown is open.
  const extensions = useMemo(
    () => [
      lineNumbers(),
      closeBrackets(),
      cAutocomplete,
      Prec.high(keymap.of([{ key: 'Tab', run: acceptCompletion }])),
      keymap.of([...closeBracketsKeymap, ...defaultKeymap]),
      cLanguage,
      execLineHighlight(highlightLine, highlightTone),
    ],
    [highlightLine, highlightTone],
  )

  return (
    <section className={`flex min-w-0 flex-1 flex-col overflow-hidden rounded-panel border border-border bg-panel ${className}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4.5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="truncate text-body-md font-semibold">{exampleText(example, 'title')}</h2>
          <Chip>{step.scope}</Chip>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select className="w-36.5" aria-label={t('editor.language')} defaultValue="c" options={languages} />
          <Button variant="secondary" onClick={reset}>
            {t('button.reset')}
          </Button>
          <Button onClick={onRun}>{t('button.run')}</Button>
          <CopyCodeButton code={code} />
          <MaximizeButton
            isMaximized={isMaximized}
            label={isMaximized ? t('layout.restore') : t('layout.expandEditor')}
            onClick={onToggleMaximize}
          />
        </div>
      </header>

      {/* Editable: Run traces whatever is typed here. It fills the panel, so the dark surface
          ends level with the Execution panel even when the program is short. */}
      <CodeMirror
        className="flex flex-1 flex-col [&_.cm-editor]:flex-1"
        value={code}
        onChange={setCode}
        theme={codeMirrorTheme}
        basicSetup={false}
        extensions={extensions}
      />

      {/* scanf reads from these values, in order, when Run traces the code. After a Run that used
          them, they fold into a one-line summary; clicking it opens the field again. */}
      {usesScanf(code) && inputCollapsed && (
        <button
          type="button"
          aria-expanded={false}
          onClick={() => {
            // Rendered right away, so the field exists to take focus.
            flushSync(expandInput)
            inputRef.current?.focus()
          }}
          className="flex min-h-11 w-full items-center gap-2.5 border-t border-border px-4.5 py-2.5 text-left transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <span className="text-body-sm font-semibold text-text">{t('editor.input')}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-body-sm text-text">{input}</span>
          <span className="flex shrink-0 items-center gap-1.5 text-body-sm text-textMuted">
            {t('editor.inputEdit')}
            <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3">
              <path
                d="M2.5 4.5 6 8l3.5-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      )}
      {usesScanf(code) && !inputCollapsed && (
        <div className="flex items-center gap-2.5 border-t border-border px-4.5 py-3">
          <label htmlFor={inputId} className="text-body-sm font-semibold text-text">
            {t('editor.input')}
          </label>
          <input
            id={inputId}
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            // Enter runs the code, exactly like the Run button (missing values get the same error and highlight).
            // Skipped while an IME is composing, where Enter confirms the typed characters instead.
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
              event.preventDefault()
              onRun()
            }}
            placeholder={t('editor.inputHint')}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={inputMissing}
            ref={inputRef}
            // Red while Run is waiting for values here; typing or a successful Run clears it.
            // The background stays bg-panel: the placeholder (textMuted) is under 4.5:1 on errorTint.
            className={`h-9 min-w-0 flex-1 rounded-control border bg-panel px-3.5 font-mono text-body-sm text-text transition-colors placeholder:text-textMuted focus-visible:outline-2 ${
              inputMissing ? 'border-error outline-2 outline-error' : 'border-borderStrong focus-visible:outline-accent'
            }`}
          />
        </div>
      )}
    </section>
  )
}

export default EditorPanel
