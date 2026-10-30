import { useEffect, useRef } from 'react'

type Tab<T extends string> = {
  id: T
  label: string
}

type TabsProps<T extends string> = {
  tabs: Tab<T>[]
  value: T
  onChange: (id: T) => void
}

/** Centers a tab in its bar. Moves only the bar, not the page (scrollIntoView could also scroll the page). */
function revealTab(tab: HTMLElement) {
  const bar = tab.parentElement
  if (bar) bar.scrollLeft = tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2
}

function Tabs<T extends string>({ tabs, value, onChange }: TabsProps<T>) {
  const activeTab = useRef<HTMLButtonElement>(null)

  // In an effect, not on click: the tab also changes from elsewhere, e.g. opening a problem or an example.
  useEffect(() => {
    if (activeTab.current) revealTab(activeTab.current)
  }, [value])

  return (
    // On a screen too narrow for every tab, the bar scrolls inside itself so the page doesn't scroll sideways.
    <div role="tablist" className="relative inline-flex h-10.5 max-w-full overflow-x-auto rounded-panel bg-subtle p-1 scrollbar-none">
      {tabs.map((tab) => {
        const isActive = tab.id === value
        return (
          <button
            key={tab.id}
            ref={isActive ? activeTab : undefined}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            onFocus={(event) => revealTab(event.currentTarget)}
            className={`shrink-0 rounded-control px-4 text-body-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              isActive ? 'bg-panel text-text shadow-xs' : 'text-textMuted hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export default Tabs
