import { CATALOG } from './catalog'
import { rotateSelected, useBuild } from './buildStore'
import { switchMode } from './actions'

// On-screen controls: the Build/Done toggle, and while building, a bar
// showing what's selected with a Rotate button.
export function BuildBar() {
  const building = useBuild((s) => s.mode === 'build')
  const selectedType = useBuild((s) => s.items.find((item) => item.id === s.selectedId)?.type)

  return (
    <>
      <button type="button" className={`mode-toggle${building ? ' is-on' : ''}`} onClick={switchMode}>
        {building ? 'Done' : 'Build'}
        <kbd className="key-hint">B</kbd>
      </button>

      {building && (
        <div className="build-bar" role="toolbar" aria-label="Build tools">
          <span className="build-bar-label">
            {selectedType ? CATALOG[selectedType].name : 'Drag furniture to move it'}
          </span>
          {selectedType && (
            <button type="button" className="build-bar-button" onClick={rotateSelected}>
              Rotate
              <kbd className="key-hint">R</kbd>
            </button>
          )}
        </div>
      )}
    </>
  )
}
