import { TABS, useTab } from './tabStore'
import { openTab } from './tabs'

// The footer: one button per page. The open one is marked for screen readers
// (aria-current) and highlighted.
export function TabBar() {
  const tab = useTab()
  return (
    <nav className="tabbar" aria-label="Pages">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className="tabbar-tab"
          aria-current={tab === id ? 'page' : undefined}
          onClick={() => openTab(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  )
}
