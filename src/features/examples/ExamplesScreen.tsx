import CodeMirror from '@uiw/react-codemirror'
import Chip from '../../components/Chip'
import { examples } from '../../data/examples'
import { useTranslation } from '../../i18n/useTranslation'
import { track } from '../../lib/analytics'
import { usePlaygroundStore } from '../../store/playgroundStore'
import { cLanguage, codeMirrorTheme, codePreview } from '../playground/codeMirrorTheme'

const previewExtensions = [cLanguage, codePreview]
const previewLineCount = 4

function ExamplesScreen() {
  const exampleId = usePlaygroundStore((state) => state.exampleId)
  const loadExample = usePlaygroundStore((state) => state.loadExample)
  const { t, exampleText } = useTranslation()

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {examples.map((example) => {
        const isLoaded = example.id === exampleId
        // Preview the first lines of main()'s body: every example starts with the same
        // #include / blank / main() lines, so those would make all three cards look alike.
        const preview = example.code
          .slice(3, 3 + previewLineCount)
          .map((line) => line.replace(/^ {4}/, ''))
          .join('\n')
          .trimEnd()

        return (
          <button
            key={example.id}
            type="button"
            onClick={() => {
              loadExample(example.id)
              track('example_opened', { exampleName: example.title })
            }}
            className={`flex flex-col overflow-hidden rounded-panel border bg-panel text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              isLoaded ? 'border-accent' : 'border-border hover:border-borderStrong'
            }`}
          >
            <div className="flex w-full items-center justify-between gap-3 border-b border-border px-4.5 py-3.5">
              <span className="text-body-md font-semibold text-text">{exampleText(example, 'title')}</span>
              <Chip>{exampleText(example, 'tag')}</Chip>
            </div>
            {/* Same dark surface and syntax colors as the Playground editor. */}
            <CodeMirror
              value={preview}
              theme={codeMirrorTheme}
              basicSetup={false}
              editable={false}
              extensions={previewExtensions}
              className="w-full flex-1"
            />
            <div className="w-full border-t border-border px-4.5 py-3 text-body-sm text-textMuted">
              {t('examples.meta', { lines: example.code.length, steps: example.steps.length })}
              {isLoaded && <span className="font-semibold text-accentText"> · {t('examples.loaded')}</span>}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default ExamplesScreen
