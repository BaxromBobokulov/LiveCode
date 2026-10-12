import { create } from 'zustand'
import { SPLIT_DEFAULT, SPLIT_MAX, SPLIT_MIN } from '../constants/layout'
import { track } from '../lib/analytics'

export type Theme = 'light' | 'dark'
export type Locale = 'en' | 'uz' | 'ru'

export const locales: Locale[] = ['uz', 'en', 'ru']

// Theme, language and the Playground split are the only things CodeVision saves between visits
// (AGENTS.md § State Management Rules).
// index.html reads the same theme key before the first paint, so keep the two in sync.
const THEME_KEY = 'codevision.theme'
const LOCALE_KEY = 'codevision.locale'
const SPLIT_KEY = 'codevision.splitRatio'

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

// src/theme/colors.css swaps every color token on this attribute.
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

function applyLocale(locale: Locale) {
  document.documentElement.lang = locale
}

type SettingsState = {
  theme: Theme
  locale: Locale
  /** The Code panel's share of the width when the panels sit side by side. */
  splitRatio: number
  toggleTheme: () => void
  setLocale: (locale: Locale) => void
  setSplitRatio: (ratio: number) => void
}

export const useSettingsStore = create<SettingsState>()((set, get) => {
  const theme = initialTheme()
  const locale = initialLocale()
  applyTheme(theme)
  applyLocale(locale)

  return {
    theme,
    locale,
    splitRatio: initialSplitRatio(),

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
  }
})
