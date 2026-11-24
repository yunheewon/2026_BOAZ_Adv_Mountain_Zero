import type { ElementType, LayoutElement } from '../types'
import { CATALOG_BY_TYPE } from '../data/catalog'

const FILL: Partial<Record<ElementType, string>> = {
  vehicleAisle: '#eef2f7',
  walkway: '#eaf5ff',
  crossing: '#f6f0d8',
  shelf: '#d7e8f8',
  dock: '#f2f5f9',
  machine: '#f2f5f9',
  forklift: '#f4a62a',
  truck: '#cfd8e3',
  worker: '#2b8a3e',
  wall: '#5b6b80',
}

const STROKE: Partial<Record<ElementType, string>> = {
  shelf: '#2769b9',
  dock: '#c9d3df',
  machine: '#dde5ef',
}

/** 템플릿 카드용 축소 배치도 (읽기 전용 SVG) */
export function MiniLayout({ elements, widthM, heightM }: { elements: LayoutElement[]; widthM: number; heightM: number }) {
  const sorted = [...elements].sort((a, b) => CATALOG_BY_TYPE[a.type].layer - CATALOG_BY_TYPE[b.type].layer)
  return (
    <svg className="mini-layout" viewBox={`0 0 ${widthM} ${heightM}`} role="img" aria-label="배치 미리보기">
      <rect x={0} y={0} width={widthM} height={heightM} fill="#fff" stroke="#dde5ef" strokeWidth={0.2} />
      {sorted.map((e) => (
        <rect
          key={e.id}
          x={e.x}
          y={e.y}
          width={e.w}
          height={e.h}
          rx={e.type === 'worker' ? e.w / 2 : 0.2}
          fill={FILL[e.type] ?? '#e6ecf3'}
          stroke={STROKE[e.type] ?? 'none'}
          strokeWidth={0.25}
          transform={`rotate(${e.rotation} ${e.x + e.w / 2} ${e.y + e.h / 2})`}
        />
      ))}
    </svg>
  )
}
