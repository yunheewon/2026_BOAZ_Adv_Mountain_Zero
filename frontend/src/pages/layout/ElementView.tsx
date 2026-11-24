import rack from '../../assets/figma/rack.svg'
import forkliftTop from '../../assets/figma/forklift-top.svg'
import { CATALOG_BY_TYPE } from '../../data/catalog'
import type { LayoutElement } from '../../types'
import type { HandleDir } from './geometry'

const HANDLES: HandleDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const NAMED = new Set(['machine', 'workbench', 'conveyor', 'dock', 'pallet', 'charger', 'truck', 'agv', 'door'])

interface ElementViewProps {
  el: LayoutElement
  scale: number
  selected: boolean
  onBodyDown: (e: React.PointerEvent, el: LayoutElement) => void
  onHandleDown: (e: React.PointerEvent, el: LayoutElement, dir: HandleDir) => void
  onRotateDown: (e: React.PointerEvent, el: LayoutElement) => void
}

/** 배치 화면의 요소 하나. 이미지가 아닌 DOM 요소라 선택·이동·크기·회전이 가능하다. */
export function ElementView({ el, scale, selected, onBodyDown, onHandleDown, onRotateDown }: ElementViewProps) {
  const item = CATALOG_BY_TYPE[el.type]
  const wPx = el.w * scale
  const hPx = el.h * scale
  const small = Math.min(wPx, hPx) < 22

  return (
    <div
      className={`lel lel--${el.type} ${selected ? 'is-selected' : ''}`}
      style={{
        left: el.x * scale,
        top: el.y * scale,
        width: wPx,
        height: hPx,
        transform: `rotate(${el.rotation}deg)`,
        zIndex: (selected ? 20 : 0) + item.layer + 1,
      }}
      onPointerDown={(e) => onBodyDown(e, el)}
      role="button"
      title={el.label}
      aria-label={`${item.label} ${el.label}`}
      aria-pressed={selected}
    >
      {el.type === 'shelf' && <img className="lel__fill" src={rack} alt="" draggable={false} />}
      {el.type === 'forklift' && (
        <>
          <img className="lel__fill" src={forkliftTop} alt="" draggable={false} />
          <span className="lel__tag lel__tag--forklift" style={{ transform: `rotate(${-el.rotation}deg)` }}>
            {el.label}
          </span>
        </>
      )}
      {el.type === 'speedLimit' && (
        <span className="lel__limit" style={{ fontSize: Math.max(8, hPx * 0.42) }}>
          {el.limitKmh ?? 10}
        </span>
      )}
      {el.type === 'worker' && <img className="lel__worker-icon" src={item.icon} alt="" draggable={false} />}
      {el.type === 'agv' && small && <img className="lel__small-icon" src={item.icon} alt="" draggable={false} />}
      {NAMED.has(el.type) && !small && (
        // 이름이 들어갈 만큼 크면 아이콘+이름, 작으면 아이콘만 (이름은 title 로 확인)
        <span className="lel__name">
          <img src={item.icon} alt="" draggable={false} />
          {wPx >= 76 && <span className="lel__name-text">{el.label}</span>}
        </span>
      )}
      {el.type === 'waiting' && wPx >= 60 && <span className="lel__zone-label">{el.label}</span>}
      {el.type === 'walkway' && Math.max(wPx, hPx) >= 60 && (
        <span className={`lel__tag lel__tag--walkway ${wPx > hPx ? 'is-horizontal' : ''}`}>{item.label}</span>
      )}

      {selected && (
        <>
          {HANDLES.map((dir) => (
            <span
              key={dir}
              className={`lel__handle lel__handle--${dir}`}
              onPointerDown={(e) => onHandleDown(e, el, dir)}
              aria-hidden
            />
          ))}
          <span className="lel__rotate-stem" aria-hidden />
          <span
            className="lel__rotate"
            title="드래그해 회전 (R: 90° 회전)"
            onPointerDown={(e) => onRotateDown(e, el)}
            aria-hidden
          />
        </>
      )}
    </div>
  )
}
