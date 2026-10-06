import { CATALOG_DATA } from './catalogData'
import { resetLayout, rotateSelected, useBuild } from './buildStore'
import { switchMode } from './actions'

// On-screen controls: the Build/Done toggle, and while building, a bar
// showing what's selected with a Rotate button, and Reset layout.

// Reset can't be undone, so it asks first
function confirmReset() {
  if (window.confirm('Put all the furniture back where it started?')) resetLayout()
}
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
            {selectedType ? CATALOG_DATA[selectedType].name : 'Drag furniture to move it'}
          </span>
          {selectedType && (
            <button type="button" className="build-bar-button" onClick={rotateSelected}>
              Rotate
              <kbd className="key-hint">R</kbd>
            </button>
          )}
          <button type="button" className="build-bar-button" onClick={confirmReset}>
            Reset layout
          </button>
        </div>
      )}
    </>
  )
}
