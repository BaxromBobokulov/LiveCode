import { useTranslation } from '../../i18n/useTranslation'
import { exportCodeImage } from './exportCodeImage'

/**
 * Icon button in the editor header: downloads the whole program as one PNG image
 * (dark editor colors, line numbers), so a long program needs no scrolled screenshots.
 */
function ExportImageButton({ code }: { code: string }) {
  const { t } = useTranslation()
  const label = t('editor.exportImage')

  return (
    <button
      type="button"
      onClick={() => void exportCodeImage(code)}
      aria-label={label}
      title={label}
      // Same look as CopyCodeButton: 36px, with the before: layer stretching the touch target to 44px.
      className="relative flex size-9 shrink-0 items-center justify-center rounded-control border border-borderStrong bg-panel text-textMuted transition-colors before:absolute before:-inset-1 hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {/* A picture with a download arrow */}
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
        <path d="M10 3.5H5A1.5 1.5 0 0 0 3.5 5v10A1.5 1.5 0 0 0 5 16.5h10a1.5 1.5 0 0 0 1.5-1.5v-4" />
        <path d="M3.5 14l4-4 3 3 1.5-1.5 4.5 4.5" />
        <path d="M15 3v6M12.5 6.5 15 9l2.5-2.5" />
      </svg>
    </button>
  )
}

export default ExportImageButton
