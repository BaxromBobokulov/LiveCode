import { useTranslation } from '../../i18n/useTranslation'

/** Shows each "printf", "puts", "scanf", "rand" and "srand" in a paragraph in the code font. */
function withCode(text: string) {
  // Splitting on a capture group keeps the matched names at the odd indexes.
  return text.split(/\b(printf|puts|scanf|rand|srand)\b/).map((part, index) =>
    index % 2 === 0 ? (
      part
    ) : (
      <code key={index} className="font-mono">
        {part}
      </code>
    ),
  )
}

function LearnScreen() {
  const { t } = useTranslation()

  return (
    <section className="max-w-170.5 rounded-panel border border-border bg-panel">
      <header className="flex h-11.75 items-center border-b border-border px-4.5">
        <h2 className="text-body-md font-semibold">{t('learn.title')}</h2>
      </header>
      <div className="flex flex-col gap-3 p-4.5 text-body-md text-text">
        <p>{t('learn.p1')}</p>
        <p>{withCode(t('learn.p2'))}</p>
        <p>{withCode(t('learn.p3'))}</p>
      </div>
    </section>
  )
}

export default LearnScreen
