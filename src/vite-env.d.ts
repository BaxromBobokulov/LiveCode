/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** PostHog project API key. Optional: analytics is off without it. */
  readonly VITE_POSTHOG_KEY?: string
  /** PostHog host, e.g. https://us.i.posthog.com. Optional: analytics is off without it. */
  readonly VITE_POSTHOG_HOST?: string
}
