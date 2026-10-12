/**
 * Icon button in a Playground panel header: expands that panel to the full width,
 * or (when it already is) restores the two-panel split. `label` names what a press does.
 */
function MaximizeButton({ isMaximized, label, onClick }: { isMaximized: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      // 36px like the other header controls; the before: layer stretches the touch target to 44px.
      className="relative flex size-9 shrink-0 items-center justify-center rounded-control border border-borderStrong bg-panel text-textMuted transition-colors before:absolute before:-inset-1 hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="size-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isMaximized ? (
          // Arrows pointing in: shrink back to the split view
          <path d="M16.5 8.5h-5v-5M3.5 11.5h5v5M11.5 8.5l5-5M8.5 11.5l-5 5" />
        ) : (
          // Arrows pointing out: expand
          <path d="M12 3.5h4.5V8M8 16.5H3.5V12M16.5 3.5l-5 5M3.5 16.5l5-5" />
        )}
      </svg>
    </button>
  )
}

export default MaximizeButton
