import { useState } from 'react'
import collapseIcon from '../../assets/figma/icons/collapse.svg'
import { CATALOG } from '../../data/catalog'
import type { ElementType } from '../../types'

export const DRAG_MIME = 'application/x-forksight-element'

/** Figma "Layout element palette / compact 4 columns" (04b) */
export function Palette({ onAdd }: { onAdd: (type: ElementType) => void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  return (
    <aside className="palette" aria-label="레이아웃 요소">
      <h2 className="palette__title">레이아웃 요소</h2>
      {CATALOG.map((group, i) => {
        const closed = collapsed[group.id]
        return (
          <section key={group.id} className="palette__group">
            {i > 0 && <hr className="palette__sep" />}
            <button
              className="palette__header"
              aria-expanded={!closed}
              onClick={() => setCollapsed((c) => ({ ...c, [group.id]: !c[group.id] }))}
            >
              <span>{group.label}</span>
              <img
                src={collapseIcon}
                width={12}
                height={12}
                alt=""
                className={`palette__chevron ${closed ? 'is-closed' : ''}`}
              />
            </button>
            {!closed && (
              <ul className="palette__items">
                {group.items.map((item) => (
                  <li key={item.type}>
                    <button
                      className="palette__item"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_MIME, item.type)
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      onClick={() => onAdd(item.type)}
                      title={`${item.label} — 끌어서 놓거나 눌러서 추가`}
                    >
                      <span className="palette__icon">
                        <img src={item.icon} alt="" draggable={false} />
                        {item.type === 'speedLimit' && <span className="palette__limit">10</span>}
                      </span>
                      <span className="palette__label">{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </aside>
  )
}
