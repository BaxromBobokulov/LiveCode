import { acceptCompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap } from '@codemirror/commands'
import CodeMirror, { Prec, keymap, lineNumbers } from '@uiw/react-codemirror'
import { useMemo } from 'react'
import Button from '../../components/Button'
import Chip from '../../components/Chip'
import Select from '../../components/Select'
import { useTranslation } from '../../i18n/useTranslation'
import { useCurrentExample, usePlaygroundStore } from '../../store/playgroundStore'
import { cAutocomplete } from './cCompletions'
import { cLanguage, codeMirrorTheme, execLineHighlight } from './codeMirrorTheme'

// Only C is supported in this version; the others are shown as coming later.
const languages = [
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++', disabled: true },
  { value: 'python', label: 'Python', disabled: true },
  { value: 'java', label: 'Java', disabled: true },
]

function EditorPanel() {
  const example = useCurrentExample()
  const stepIndex = usePlaygroundStore((state) => state.stepIndex)
  const reset = usePlaygroundStore((state) => state.reset)
  const run = usePlaygroundStore((state) => state.run)
  const code = usePlaygroundStore((state) => state.code)
  const setCode = usePlaygroundStore((state) => state.setCode)
  const { t, exampleText } = useTranslation()

  const step = example.steps[stepIndex]
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
      execLineHighlight(step.line),
    ],
    [step.line],
  )

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-panel border border-border bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4.5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="truncate text-body-md font-semibold">{exampleText(example, 'title')}</h2>
          <Chip>{step.scope}</Chip>
        </div>
        <div className="flex items-center gap-2">
          <Select className="w-36.5" aria-label={t('editor.language')} defaultValue="c" options={languages} />
          <Button variant="secondary" onClick={reset}>
            {t('button.reset')}
          </Button>
          <Button onClick={run}>{t('button.run')}</Button>
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
    </section>
  )
}

export default EditorPanel
