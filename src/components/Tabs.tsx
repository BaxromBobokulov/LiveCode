type Tab<T extends string> = {
  id: T
  label: string
}

type TabsProps<T extends string> = {
  tabs: Tab<T>[]
  value: T
  onChange: (id: T) => void
}

function Tabs<T extends string>({ tabs, value, onChange }: TabsProps<T>) {
  return (
    <div role="tablist" className="inline-flex h-10.5 rounded-panel bg-subtle p-1">
      {tabs.map((tab) => {
        const isActive = tab.id === value
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`rounded-control px-4 text-body-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
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
