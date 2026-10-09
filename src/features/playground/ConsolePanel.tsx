function ConsolePanel({ output }: { output: string }) {
  // printf output ends with "\n"; drop the final one so no blank line shows.
  const text = output.replace(/\n$/, '')

  return (
    <div>
      <h3 className="mb-1.75 text-label text-textMuted">Console</h3>
      <pre
        aria-live="polite"
        className="rounded-container border border-border bg-surface px-3.5 py-3 font-mono text-body-sm whitespace-pre-wrap text-text"
      >
        {text || <span className="font-sans text-textFaint">No output yet</span>}
      </pre>
    </div>
  )
}

export default ConsolePanel
