import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { useTranslation } from '../i18n/useTranslation'
import { findExampleBySlug, findProblemBySlug, type Route } from './routes'

const SITE_URL = 'https://livecode.uz'

/**
 * The browser tab's title, in the current language: "Discount · Problems · LiveCode" for an item,
 * "Problems · LiveCode" for a section, and the app's own title on /. Also points the canonical link at
 * this page's URL, so search engines index each page as itself and not as a copy of the home page.
 */
export function useDocumentTitle(route: Route) {
  const { t, locale, exampleText } = useTranslation()
  const { pathname } = useLocation()

  let title: string
  if (route.kind === 'problem') {
    const problem = findProblemBySlug(route.slug)
    title = [problem?.title[locale], t('nav.problems'), 'LiveCode'].filter(Boolean).join(' · ')
  } else if (route.kind === 'example') {
    const example = findExampleBySlug(route.slug)
    title = [example && exampleText(example, 'title'), t('nav.examples'), 'LiveCode'].filter(Boolean).join(' · ')
  } else if (route.tab === 'playground') {
    title = t('app.title')
  } else {
    title = `${t(`nav.${route.tab}`)} · LiveCode`
  }

  useEffect(() => {
    document.title = title
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', SITE_URL + pathname)
  }, [title, pathname])
}
