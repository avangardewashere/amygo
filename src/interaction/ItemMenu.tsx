import { closeMenu, openMenu, useGym, type MenuAction, type MenuId } from './gymStore'

type Props = {
  id: MenuId
  title: string
  subtitle?: string
  actions: MenuAction[]
  note?: string // shown instead of actions when there's nothing to do right now
}

// The popup for an item. Closed, it's a small tag ("E · Dumbbell") you can tap.
// Open, it's a card listing what you can do. Rendered inside drei's <Html>,
// so it floats above the item in 3D and follows it on screen.
export function ItemMenu({ id, title, subtitle, actions, note }: Props) {
  const open = useGym((s) => s.menu === id)

  if (!open) {
    return (
      <button type="button" className="item-tag" onClick={() => openMenu(id)}>
        <kbd className="key-hint">E</kbd>
        {title}
      </button>
    )
  }

  return (
    <div className="item-menu" role="menu" aria-label={`${title} actions`}>
      <div className="item-menu-head">
        <div>
          <strong>{title}</strong>
          {subtitle && <span>{subtitle}</span>}
        </div>
        <button type="button" className="item-menu-close" aria-label="Close menu" onClick={closeMenu}>
          ×
        </button>
      </div>
      {actions.length === 0 && note && <p className="item-menu-note">{note}</p>}
      {actions.map((action, i) => (
        <button type="button" role="menuitem" key={action.label} className="item-menu-action" onClick={action.run}>
          <kbd className="key-hint">{i + 1}</kbd>
          {action.label}
        </button>
      ))}
    </div>
  )
}
