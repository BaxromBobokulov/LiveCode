type ProgressBarProps = {
  /** Progress from 0 to 1 */
  value: number
  className?: string
}

function ProgressBar({ value, className = '' }: ProgressBarProps) {
  const percent = Math.min(Math.max(value, 0), 1) * 100

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      className={`h-1.25 overflow-hidden rounded-full bg-track ${className}`}
    >
      {/* Width is computed at runtime, so it is the one inline style here */}
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-200 motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

export default ProgressBar
