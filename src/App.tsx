import { MotionConfig } from 'framer-motion'
import LogoMark from './components/LogoMark'
import Tabs from './components/Tabs'
import ExamplesScreen from './features/examples/ExamplesScreen'
import LearnScreen from './features/learn/LearnScreen'
import PlaygroundScreen from './features/playground/PlaygroundScreen'
import { usePlaygroundStore, type TabId } from './store/playgroundStore'

const tabs: { id: TabId; label: string }[] = [
  { id: 'playground', label: 'Playground' },
  { id: 'examples', label: 'Examples' },
  { id: 'learn', label: 'Learn' },
]

function App() {
  const activeTab = usePlaygroundStore((state) => state.activeTab)
  const setTab = usePlaygroundStore((state) => state.setTab)

  return (
    // reducedMotion="user" skips Framer Motion animations when the OS asks for reduced motion
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen px-4 sm:px-7">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-container bg-accent text-white">
              <LogoMark className="size-6" />
            </div>
            <span className="text-brand text-text">LiveCode</span>
          </div>
          <Tabs tabs={tabs} value={activeTab} onChange={setTab} />
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
