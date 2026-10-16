/**
 * A problem statement as written in src/data/problems/: blank lines separate paragraphs, a single
 * line break stays a line break, and text between `backticks` is code, styled like the code
 * tokens in step explanations.
 */
function StatementText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {text.split('\n\n').map((paragraph, i) => (
        <p key={i}>
          {paragraph.split('\n').map((line, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {/* Splitting on a capture group keeps the code pieces at the odd indexes. */}
              {line.split(/`([^`]+)`/).map((piece, k) =>
                k % 2 === 0 ? (
                  piece
                ) : (
                  <code key={k} className="rounded-control bg-accentTint px-1 py-0.5 font-mono text-accentText">
                    {piece}
                  </code>
                ),
              )}
            </span>
          ))}
        </p>
      ))}
    </div>
  )
}

export default StatementText
