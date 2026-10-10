function LearnScreen() {
  return (
    <section className="max-w-170.5 rounded-panel border border-border bg-white">
      <header className="flex h-11.75 items-center border-b border-border px-4.5">
        <h2 className="text-body-md font-semibold">How CodeVision works</h2>
      </header>
      <div className="flex flex-col gap-3 p-4.5 text-body-md text-text">
        <p>
          CodeVision runs a short C program one step at a time. Start from one of the Examples, or
          type or paste your own program into the Playground editor and press Run. Each step is one
          line: the editor highlights it and the Execution panel explains what it did in plain
          language.
        </p>
        <p>
          Variables that changed on the current step are outlined in blue. When a program walks
          through an array, the array view marks the element in use and the loop tracker counts
          iterations. Anything printed with <code className="font-mono">printf</code> appears in
          the console. Use Next and Previous to go at your own pace, or Auto Play to step
          automatically.
        </p>
        <p>
          CodeVision understands a small part of C: int and float variables, one-dimensional
          arrays, if / else, for and while loops, functions and{' '}
          <code className="font-mono">printf</code>. If your program uses something outside that,
          Run shows a message naming the line and what isn't supported yet.
        </p>
      </div>
    </section>
  )
}

export default LearnScreen
