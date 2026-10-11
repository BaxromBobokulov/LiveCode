import posthog from 'posthog-js'
import type { Locale, Theme } from '../store/settingsStore'

// Privacy-friendly usage analytics via PostHog.
// Only the event names and props below are ever sent: never code, variable values or typed text.
// Without VITE_POSTHOG_KEY / VITE_POSTHOG_HOST (e.g. local dev) every call silently does nothing.

/** Every event CodeVision sends, with its props. */
type AnalyticsEvents = {
  example_opened: { exampleName: string }
  code_run: { source: 'example' | 'custom' }
  code_run_error: { errorType: 'UnsupportedConstructError' | 'CodeError' }
  language_changed: { language: Locale }
  theme_changed: { theme: Theme }
}

let isEnabled = false

/** Start PostHog once at app startup. Page views are captured automatically. */
export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY
  const host = import.meta.env.VITE_POSTHOG_HOST
  if (isEnabled || !key || !host) return

  posthog.init(key, {
    api_host: host,
    capture_pageview: true,
    // Autocapture, heatmaps and session replay record element text, which would include the user's code.
    autocapture: false,
    capture_dead_clicks: false,
    rageclick: false,
    enable_heatmaps: false,
    disable_session_recording: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
  })
  isEnabled = true
}

export function track<Name extends keyof AnalyticsEvents>(name: Name, props: AnalyticsEvents[Name]) {
  if (!isEnabled) return
  posthog.capture(name, props)
}
