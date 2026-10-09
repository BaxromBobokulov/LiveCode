function LearnScreen() {
  return (
    <section className="max-w-170.5 rounded-panel border border-border bg-white">
      <header className="flex h-11.75 items-center border-b border-border px-4.5">
        <h2 className="text-body-md font-semibold">How CodeVision works</h2>
      </header>
      <div className="flex flex-col gap-3 p-4.5 text-body-md text-text">
        <p>
          CodeVision runs a short C program one step at a time. Each step is one line: the editor
          highlights the line that just ran, and the Execution panel explains what it did in plain
          language.
        </p>
        <p>
          Variables that changed on the current step are outlined in blue. When a program walks
          through an array, the array view marks the element in use and the loop tracker counts
          iterations. Anything the program prints with <code className="font-mono">printf</code>{' '}
          appears in the console.
        </p>
        <p>
          Use Next and Previous to go at your own pace, Auto Play to step automatically, or Run to
          watch the whole program from the start. Pick another program in the Examples tab. The
          examples are traced in advance, so the code can&apos;t be edited yet.
        </p>
      </div>
    </section>
  )
}

export default LearnScreen
