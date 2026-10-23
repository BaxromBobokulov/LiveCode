import { create } from 'zustand'
import { SPLIT_DEFAULT, SPLIT_MAX, SPLIT_MIN } from '../constants/layout'
import { track } from '../lib/analytics'

export type Theme = 'light' | 'dark'
export type Locale = 'en' | 'uz' | 'ru'

export const locales: Locale[] = ['uz', 'en', 'ru']

/** Font sizes (px) the step explanation can be set to with the A− / A+ buttons. */
export const explanationSizes = [14, 15, 16, 18, 20]
const EXPLANATION_SIZE_DEFAULT = 15

/** Auto Play speeds offered next to the step controls: 2 means twice as fast as the base AUTOPLAY_DELAY_MS. */
export const playbackSpeeds = [0.5, 1, 1.5, 2]
const PLAYBACK_SPEED_DEFAULT = 1

// Theme, language, the Playground split, the explanation text size and the Auto Play speed are the only preferences CodeVision saves between visits (badges are in badgesStore)
// (AGENTS.md § State Management Rules).
// index.html reads the same theme key before the first paint, so keep the two in sync.
const THEME_KEY = 'codevision.theme'
const LOCALE_KEY = 'codevision.locale'
const SPLIT_KEY = 'codevision.splitRatio'
const EXPLANATION_SIZE_KEY = 'codevision.explanationSize'
const PLAYBACK_SPEED_KEY = 'codevision.playbackSpeed'

// localStorage can throw (private mode, blocked site data), so reading and writing never break the app.
function load(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Not saved; the choice still applies until the page is reloaded.
  }
}

/** The saved theme, or the system's preference on a first visit. */
function initialTheme(): Theme {
  const saved = load(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** The saved language, or the browser's language if it is one we support, otherwise English. */
function initialLocale(): Locale {
  const saved = load(LOCALE_KEY)
  if (locales.includes(saved as Locale)) return saved as Locale
  const browserLanguage = navigator.language.slice(0, 2).toLowerCase() // "ru-RU" -> "ru"
  return locales.includes(browserLanguage as Locale) ? (browserLanguage as Locale) : 'en'
}

/** Keeps both Playground panels at least SPLIT_MIN wide. */
function clampSplit(ratio: number): number {
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, ratio))
}

/** The saved split between the Code and Execution panels, or an even split on a first visit. */
function initialSplitRatio(): number {
  const saved = parseFloat(load(SPLIT_KEY) ?? '') // NaN when nothing (or garbage) was saved
  return Number.isFinite(saved) ? clampSplit(saved) : SPLIT_DEFAULT
}

/** The saved explanation text size, if it is one of the offered sizes. */
function initialExplanationSize(): number {
  const saved = Number(load(EXPLANATION_SIZE_KEY))
  return explanationSizes.includes(saved) ? saved : EXPLANATION_SIZE_DEFAULT
}

/** The saved Auto Play speed, if it is one of the offered speeds. */
function initialPlaybackSpeed(): number {
  const saved = Number(load(PLAYBACK_SPEED_KEY))
  return playbackSpeeds.includes(saved) ? saved : PLAYBACK_SPEED_DEFAULT
}

// src/theme/colors.css swaps every color token on this attribute.
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

function applyLocale(locale: Locale) {
  document.documentElement.lang = locale
}

// The text-explanation size in src/theme/typography.css reads this variable.
function applyExplanationSize(size: number) {
  document.documentElement.style.setProperty('--explanation-size', `${size}px`)
}

type SettingsState = {
  theme: Theme
  locale: Locale
  /** The Code panel's share of the width when the panels sit side by side. */
  splitRatio: number
  /** Font size (px) of the step explanation, one of explanationSizes. */
  explanationSize: number
  /** Auto Play speed multiplier, one of playbackSpeeds. */
  playbackSpeed: number
  toggleTheme: () => void
  setLocale: (locale: Locale) => void
  setSplitRatio: (ratio: number) => void
  /** Moves the explanation text one size up (+1) or down (-1), staying within explanationSizes. */
  stepExplanationSize: (direction: 1 | -1) => void
  setPlaybackSpeed: (speed: number) => void
}

export const useSettingsStore = create<SettingsState>()((set, get) => {
  const theme = initialTheme()
  const locale = initialLocale()
  const explanationSize = initialExplanationSize()
  applyTheme(theme)
  applyLocale(locale)
  applyExplanationSize(explanationSize)

  return {
    theme,
    locale,
    splitRatio: initialSplitRatio(),
    explanationSize,
    playbackSpeed: initialPlaybackSpeed(),

    toggleTheme: () => {
      const next = get().theme === 'light' ? 'dark' : 'light'
      applyTheme(next)
      save(THEME_KEY, next)
      set({ theme: next })
      track('theme_changed', { theme: next })
    },

    setLocale: (next) => {
      applyLocale(next)
      save(LOCALE_KEY, next)
      set({ locale: next })
      track('language_changed', { language: next })
    },

    setSplitRatio: (ratio) => {
      const next = clampSplit(ratio)
      save(SPLIT_KEY, String(next))
      set({ splitRatio: next })
    },

    stepExplanationSize: (direction) => {
      const index = explanationSizes.indexOf(get().explanationSize) + direction
      if (index < 0 || index >= explanationSizes.length) return
      const next = explanationSizes[index]
      applyExplanationSize(next)
      save(EXPLANATION_SIZE_KEY, String(next))
      set({ explanationSize: next })
    },

    setPlaybackSpeed: (speed) => {
      if (!playbackSpeeds.includes(speed)) return
      save(PLAYBACK_SPEED_KEY, String(speed))
      set({ playbackSpeed: speed })
    },
  }
})
