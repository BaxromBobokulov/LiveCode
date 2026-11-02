import { useTranslation } from '../../i18n/useTranslation'

/** `isNew`: this step printed something. */
function ConsolePanel({ output, isNew }: { output: string; isNew: boolean }) {
  const { t } = useTranslation()
  // printf output ends with "\n"; drop the final one so no blank line shows.
  const text = output.replace(/\n$/, '')

  return (
    <div>
      <h3 className="mb-1.75 text-label text-textMuted">{t('panel.console')}</h3>
      <pre
        aria-live="polite"
        className="rounded-container border border-border bg-surface px-3.5 py-3 font-mono text-body-sm whitespace-pre-wrap text-text"
      >
        {text || <span className="font-sans text-textFaint">{t('console.empty')}</span>}
        {/* Marks the end of the text, not the whole box: in a long Console, the newest output is what has to show. */}
        {isNew && <span data-step-change />}
      </pre>
    </div>
  )
}

export default ConsolePanel
