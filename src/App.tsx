import { MotionConfig } from 'framer-motion'
import LanguageSwitcher from './components/LanguageSwitcher'
import LogoMark from './components/LogoMark'
import Tabs from './components/Tabs'
import ThemeToggle from './components/ThemeToggle'
import ExamplesScreen from './features/examples/ExamplesScreen'
import LearnScreen from './features/learn/LearnScreen'
import PlaygroundScreen from './features/playground/PlaygroundScreen'
import { useTranslation } from './i18n/useTranslation'
import { usePlaygroundStore, type TabId } from './store/playgroundStore'

function App() {
  const activeTab = usePlaygroundStore((state) => state.activeTab)
  const setTab = usePlaygroundStore((state) => state.setTab)
  const { t } = useTranslation()

  const tabs: { id: TabId; label: string }[] = [
    { id: 'playground', label: t('nav.playground') },
    { id: 'examples', label: t('nav.examples') },
    { id: 'learn', label: t('nav.learn') },
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
            <span className="text-brand text-text">LiveCode</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Tabs tabs={tabs} value={activeTab} onChange={setTab} />
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="py-6">
          {activeTab === 'playground' && <PlaygroundScreen />}
          {activeTab === 'examples' && <ExamplesScreen />}
          {activeTab === 'learn' && <LearnScreen />}
        </main>
      </div>
    </MotionConfig>
  )
}

export default App
