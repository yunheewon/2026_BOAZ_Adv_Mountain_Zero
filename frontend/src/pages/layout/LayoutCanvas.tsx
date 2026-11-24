import { useRef, type ReactNode } from 'react'
import type { ElementType, LayoutElement } from '../../types'
import { CATALOG_BY_TYPE } from '../../data/catalog'
import { ElementView } from './ElementView'
import { DRAG_MIME } from './Palette'
import { normDeg, resizeElement, round1, type HandleDir } from './geometry'

type Gesture =
  | { kind: 'move'; id: string; px: number; py: number; start: LayoutElement; moved: boolean }
  | { kind: 'resize'; id: string; dir: HandleDir; px: number; py: number; start: LayoutElement; moved: boolean }
  | { kind: 'rotate'; id: string; cx: number; cy: number; start: LayoutElement; moved: boolean }

interface LayoutCanvasProps {
  widthM: number
  heightM: number
  gridM: number
  scale: number
  showGrid: boolean
  elements: LayoutElement[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** 제스처 첫 움직임 직전 — 실행 취소 기록용 */
  onBeginChange: () => void
  onChangeElement: (id: string, patch: Partial<LayoutElement>) => void
  onDropNew: (type: ElementType, xM: number, yM: number) => void
  children?: ReactNode
}

export function LayoutCanvas({
  widthM,
  heightM,
  gridM,
  scale,
  showGrid,
  elements,
  selectedId,
  onSelect,
  onBeginChange,
  onChangeElement,
  onDropNew,
  children,
}: LayoutCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)

  const begin = (e: React.PointerEvent, g: Gesture) => {
    e.stopPropagation()
    e.preventDefault()
    stageRef.current?.setPointerCapture(e.pointerId)
    gesture.current = g
    onSelect(g.id)
  }

  const onMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g) return
    if (!g.moved) {
      onBeginChange()
      g.moved = true
    }
    if (g.kind === 'move') {
      const nx = round1(g.start.x + (e.clientX - g.px) / scale)
      const ny = round1(g.start.y + (e.clientY - g.py) / scale)
      onChangeElement(g.id, { x: nx, y: ny })
    } else if (g.kind === 'resize') {
      onChangeElement(g.id, resizeElement(g.start, g.dir, (e.clientX - g.px) / scale, (e.clientY - g.py) / scale))
    } else {
      const deg = (Math.atan2(e.clientY - g.cy, e.clientX - g.cx) * 180) / Math.PI + 90
      const snapped = e.altKey ? deg : Math.round(deg / 15) * 15
      onChangeElement(g.id, { rotation: normDeg(snapped) })
    }
  }

  const end = () => {
    gesture.current = null
  }

  // 바닥 표시(통로)가 아래, 이동 주체가 위
  const ordered = [...elements].sort((a, b) => CATALOG_BY_TYPE[a.type].layer - CATALOG_BY_TYPE[b.type].layer)

  return (
    <div
      ref={stageRef}
      className={`lcanvas ${showGrid ? 'has-grid' : ''}`}
      style={{
        width: widthM * scale,
        height: heightM * scale,
        backgroundSize: `${gridM * scale}px ${gridM * scale}px`,
      }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onSelect(null)
      }}
      onPointerMove={onMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DRAG_MIME)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDrop={(e) => {
        const type = e.dataTransfer.getData(DRAG_MIME) as ElementType
        if (!type) return
        e.preventDefault()
        const rect = e.currentTarget.getBoundingClientRect()
        onDropNew(type, (e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale)
      }}
    >
      {ordered.map((el) => (
        <ElementView
          key={el.id}
          el={el}
          scale={scale}
          selected={el.id === selectedId}
          onBodyDown={(e, target) =>
            begin(e, { kind: 'move', id: target.id, px: e.clientX, py: e.clientY, start: target, moved: false })
          }
          onHandleDown={(e, target, dir) =>
            begin(e, { kind: 'resize', id: target.id, dir, px: e.clientX, py: e.clientY, start: target, moved: false })
          }
          onRotateDown={(e, target) => {
            const rect = stageRef.current!.getBoundingClientRect()
            begin(e, {
              kind: 'rotate',
              id: target.id,
              cx: rect.left + (target.x + target.w / 2) * scale,
              cy: rect.top + (target.y + target.h / 2) * scale,
              start: target,
              moved: false,
            })
          }}
        />
      ))}
      {children}
    </div>
  )
}
