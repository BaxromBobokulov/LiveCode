import { useEffect, useRef } from 'react'
import { Link } from 'react-router'

type Tab<T extends string> = {
  id: T
  label: string
  /** The URL this tab goes to. */
  to: string
}

type TabsProps<T extends string> = {
  tabs: Tab<T>[]
  value: T
  /** The bar's accessible name, e.g. "Sections". */
  label: string
}

/** Centers a tab in its bar. Moves only the bar, not the page (scrollIntoView could also scroll the page). */
function revealTab(tab: HTMLElement) {
  const bar = tab.parentElement
  if (bar) bar.scrollLeft = tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2
}

/**
 * The section bar. Each tab is a real link (so it can be opened in a new tab or copied), and the current one
 * is marked with aria-current, the pattern for page navigation.
 */
function Tabs<T extends string>({ tabs, value, label }: TabsProps<T>) {
  const activeTab = useRef<HTMLAnchorElement>(null)

  // In an effect, not on click: the tab also changes from elsewhere, e.g. opening a problem or an example.
  useEffect(() => {
    if (activeTab.current) revealTab(activeTab.current)
  }, [value])

  return (
    // On a screen too narrow for every tab, the bar scrolls inside itself so the page doesn't scroll sideways.
    <nav aria-label={label} className="relative inline-flex h-10.5 max-w-full overflow-x-auto rounded-panel bg-subtle p-1 scrollbar-none">
      {tabs.map((tab) => {
        const isActive = tab.id === value
        return (
          <Link
            key={tab.id}
            ref={isActive ? activeTab : undefined}
            to={tab.to}
            aria-current={isActive ? 'page' : undefined}
            onFocus={(event) => revealTab(event.currentTarget)}
            className={`flex shrink-0 items-center rounded-control px-4 text-body-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              isActive ? 'bg-panel text-text shadow-xs' : 'text-textMuted hover:text-text'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

export default Tabs
