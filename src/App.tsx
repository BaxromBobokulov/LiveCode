import { MotionConfig } from 'framer-motion'
import GameLink from './components/GameLink'
import LanguageSwitcher from './components/LanguageSwitcher'
import LogoMark from './components/LogoMark'
import Tabs from './components/Tabs'
import ThemeToggle from './components/ThemeToggle'
import ExamplesScreen from './features/examples/ExamplesScreen'
import LearnScreen from './features/learn/LearnScreen'
import PlaygroundScreen from './features/playground/PlaygroundScreen'
import ProblemsScreen from './features/problems/ProblemsScreen'
import { useTranslation } from './i18n/useTranslation'
import { playgroundPath, sectionPath, type TabId } from './lib/routes'
import { useDocumentTitle } from './lib/useDocumentTitle'
import { useRouteSync } from './lib/useRouteSync'
import { usePlaygroundStore } from './store/playgroundStore'

function App() {
  // The URL decides the section and the open item; the store follows it (see useRouteSync).
  const route = useRouteSync()
  useDocumentTitle(route)
  const activeTab = route.tab
  // The Playground tab goes back to whatever is open there.
  const playgroundTo = usePlaygroundStore(playgroundPath)
  const { t } = useTranslation()

  const tabs: { id: TabId; label: string; to: string }[] = [
    { id: 'playground', label: t('nav.playground'), to: playgroundTo },
    { id: 'examples', label: t('nav.examples'), to: sectionPath('examples') },
    { id: 'problems', label: t('nav.problems'), to: sectionPath('problems') },
    { id: 'learn', label: t('nav.learn'), to: sectionPath('learn') },
  ]

  return (
    // reducedMotion="user" skips Framer Motion animations when the OS asks for reduced motion
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen px-4 sm:px-7">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pt-6 pb-5">
          <div className="flex items-center gap-1.5">
            {/* <div className="flex size-8 items-center justify-center rounded-container bg-accent text-white"> */}
              <LogoMark className="size-6" />
            {/* </div> */}
            {/* The page's one <h1>: the product name, on every tab. Same look as before (Tailwind resets h1 styles). */}
            <h1 className="text-brand text-text">LiveCode</h1>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-3">
            <Tabs tabs={tabs} value={activeTab} label={t('nav.sections')} />
            <div className="flex items-center gap-2">
              <GameLink />
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* One screen per section. The Playground stays at this one place for /, /examples/… and /problems/…,
            so moving between those never remounts it (the editor, line follow and panels keep their state). */}
        <main className="py-6">
          {activeTab === 'playground' && <PlaygroundScreen />}
          {activeTab === 'examples' && <ExamplesScreen />}
          {activeTab === 'problems' && <ProblemsScreen />}
          {activeTab === 'learn' && <LearnScreen />}
        </main>
      </div>
    </MotionConfig>
  )
}

export default App
