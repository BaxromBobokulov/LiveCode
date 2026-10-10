import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap } from '@codemirror/commands'
import CodeMirror, { keymap, lineNumbers } from '@uiw/react-codemirror'
import { useMemo } from 'react'
import Button from '../../components/Button'
import Chip from '../../components/Chip'
import Select from '../../components/Select'
import { useCurrentExample, usePlaygroundStore } from '../../store/playgroundStore'
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

  const step = example.steps[stepIndex]
  // basicSetup is off, so the default keymap (Enter = insertNewlineAndIndent) is added here explicitly.
  // closeBracketsKeymap goes first so its Backspace (delete an empty pair) wins over the default one,
  // the same order CodeMirror's own basicSetup uses.
  const extensions = useMemo(
    () => [
      lineNumbers(),
      closeBrackets(),
      keymap.of([...closeBracketsKeymap, ...defaultKeymap]),
      cLanguage,
      execLineHighlight(step.line),
    ],
    [step.line],
  )

  return (
    <section className="min-w-0 flex-1 overflow-hidden rounded-panel border border-border bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4.5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="truncate text-body-md font-semibold">{example.title}</h2>
          <Chip>{step.scope}</Chip>
        </div>
        <div className="flex items-center gap-2">
          <Select className="w-36.5" aria-label="Language" defaultValue="c" options={languages} />
          <Button variant="secondary" onClick={reset}>
            Reset
          </Button>
          <Button onClick={run}>Run</Button>
        </div>
      </header>

      {/* Editable: Run traces whatever is typed here. */}
      <CodeMirror
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
