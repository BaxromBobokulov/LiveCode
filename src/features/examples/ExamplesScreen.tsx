import Chip from '../../components/Chip'
import { examples } from '../../data/examples'
import { usePlaygroundStore } from '../../store/playgroundStore'

function ExamplesScreen() {
  const exampleId = usePlaygroundStore((state) => state.exampleId)
  const loadExample = usePlaygroundStore((state) => state.loadExample)

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {examples.map((example) => {
        const isLoaded = example.id === exampleId
        // Preview the body of main(): skip the #include/main() lines and the closing brace.
        const preview = example.code
          .slice(3, -1)
          .map((line) => line.replace(/^ {4}/, ''))
          .join('\n')

        return (
          <button
            key={example.id}
            type="button"
            onClick={() => loadExample(example.id)}
            className={`flex flex-col overflow-hidden rounded-panel border bg-white text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              isLoaded ? 'border-accent' : 'border-border hover:border-borderStrong'
            }`}
          >
            <div className="flex w-full items-center justify-between gap-3 border-b border-border px-4.5 py-3.5">
              <span className="text-body-md font-semibold text-text">{example.title}</span>
              <Chip>{example.tag}</Chip>
            </div>
            <pre className="w-full flex-1 overflow-hidden px-4.5 py-3 font-mono text-code text-textMuted">
              {preview}
            </pre>
            <div className="w-full border-t border-border px-4.5 py-3 text-body-sm text-textMuted">
              {example.code.length} lines · {example.steps.length} steps
              {isLoaded && <span className="font-semibold text-accent"> · Loaded</span>}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default ExamplesScreen
