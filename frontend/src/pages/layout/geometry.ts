import type { ElementType, LayoutElement } from '../../types'
import { CATALOG_BY_TYPE } from '../../data/catalog'

export const round1 = (v: number) => Math.round(v * 10) / 10
export const normDeg = (d: number) => ((Math.round(d) % 360) + 360) % 360

const rad = (deg: number) => (deg * Math.PI) / 180

/** 화면(월드) 벡터를 요소의 로컬 축으로 돌린다 */
export function toLocal(dx: number, dy: number, deg: number) {
  const c = Math.cos(rad(deg))
  const s = Math.sin(rad(deg))
  return { u: dx * c + dy * s, v: -dx * s + dy * c }
}

export function toWorld(u: number, v: number, deg: number) {
  const c = Math.cos(rad(deg))
  const s = Math.sin(rad(deg))
  return { x: u * c - v * s, y: u * s + v * c }
}

export type HandleDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export const HANDLE_SIGNS: Record<HandleDir, [number, number]> = {
  n: [0, -1],
  s: [0, 1],
  e: [1, 0],
  w: [-1, 0],
  ne: [1, -1],
  nw: [-1, -1],
  se: [1, 1],
  sw: [-1, 1],
}

/** 반대편 모서리를 고정한 채, 회전된 축 기준으로 크기를 바꾼다 */
export function resizeElement(start: LayoutElement, dir: HandleDir, dxM: number, dyM: number): Partial<LayoutElement> {
  const [sx, sy] = HANDLE_SIGNS[dir]
  const { u, v } = toLocal(dxM, dyM, start.rotation)
  const w = sx ? Math.max(0.3, round1(start.w + sx * u)) : start.w
  const h = sy ? Math.max(0.3, round1(start.h + sy * v)) : start.h
  const shift = toWorld((sx * (w - start.w)) / 2, (sy * (h - start.h)) / 2, start.rotation)
  const cx = start.x + start.w / 2 + shift.x
  const cy = start.y + start.h / 2 + shift.y
  return { w, h, x: round1(cx - w / 2), y: round1(cy - h / 2) }
}

export function nextLabel(type: ElementType, elements: LayoutElement[]) {
  const { prefix } = CATALOG_BY_TYPE[type]
  const used = new Set(elements.map((e) => e.label))
  let n = elements.filter((e) => e.type === type).length + 1
  while (used.has(`${prefix}${n}`)) n++
  return `${prefix}${n}`
}

let idSeq = 0
export function createElement(type: ElementType, x: number, y: number, elements: LayoutElement[]): LayoutElement {
  const item = CATALOG_BY_TYPE[type]
  return {
    id: `el-${Date.now().toString(36)}-${++idSeq}`,
    type,
    label: nextLabel(type, elements),
    x: round1(x),
    y: round1(y),
    w: item.w,
    h: item.h,
    rotation: 0,
    ...(item.vehicle ? { maxSpeedKmh: type === 'agv' ? 4 : 8, route: type === 'agv' ? '자동' : '경로 A' } : {}),
    ...(type === 'speedLimit' ? { limitKmh: 10 } : {}),
  }
}

export function countByKind(elements: LayoutElement[]) {
  const n = (t: ElementType) => elements.filter((e) => e.type === t).length
  const parts: string[] = []
  const add = (label: string, count: number) => count > 0 && parts.push(`${label} ${count}`)
  add('선반', n('shelf'))
  add('설비', n('machine') + n('workbench') + n('conveyor'))
  add('지게차', n('forklift'))
  add('AGV', n('agv'))
  add('트럭', n('truck'))
  add('작업자', n('worker'))
  return parts.join(' · ') || '없음'
}
