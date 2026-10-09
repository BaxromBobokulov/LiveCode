import { cpp } from '@codemirror/lang-cpp'
import CodeMirror, { lineNumbers } from '@uiw/react-codemirror'
import { useMemo } from 'react'
import Button from '../../components/Button'
import Chip from '../../components/Chip'
import Select from '../../components/Select'
import { useCurrentExample, usePlaygroundStore } from '../../store/playgroundStore'
import { codeMirrorTheme, execLineHighlight } from './codeMirrorTheme'

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

  const step = example.steps[stepIndex]
  const code = useMemo(() => example.code.join('\n'), [example])
  const extensions = useMemo(() => [lineNumbers(), cpp(), execLineHighlight(step.line)], [step.line])

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

      {/* Read-only: the steps are pre-traced for this exact code. */}
      <CodeMirror
        value={code}
        theme={codeMirrorTheme}
        basicSetup={false}
        editable={false}
        extensions={extensions}
      />
    </section>
  )
}

export default EditorPanel
