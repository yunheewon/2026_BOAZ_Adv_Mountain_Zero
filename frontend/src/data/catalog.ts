import type { ElementType } from '../types'
import wall from '../assets/figma/palette/wall.svg'
import column from '../assets/figma/palette/column.svg'
import door from '../assets/figma/palette/door.svg'
import dock from '../assets/figma/palette/dock.svg'
import machine from '../assets/figma/palette/machine.svg'
import workbench from '../assets/figma/palette/workbench.svg'
import conveyor from '../assets/figma/palette/conveyor.svg'
import shelf from '../assets/figma/palette/shelf.svg'
import pallet from '../assets/figma/palette/pallet.svg'
import waiting from '../assets/figma/palette/waiting.svg'
import charger from '../assets/figma/palette/charger.svg'
import forklift from '../assets/figma/palette/forklift.svg'
import worker from '../assets/figma/palette/worker.svg'
import truck from '../assets/figma/palette/truck.svg'
import agv from '../assets/figma/palette/agv.svg'
import vehicleAisle from '../assets/figma/palette/vehicle-aisle.svg'
import walkway from '../assets/figma/palette/walkway.svg'
import crossing from '../assets/figma/palette/crossing.svg'
import speedLimitRing from '../assets/figma/palette/speed-limit-ring.svg'
import safetyBar from '../assets/figma/palette/safety-bar.svg'
import speedBump from '../assets/figma/palette/speed-bump.svg'

export interface CatalogItem {
  type: ElementType
  label: string
  icon: string
  /** 기본 크기 (m) */
  w: number
  h: number
  /** 같은 종류를 추가할 때 붙는 이름 접두어 */
  prefix: string
  /** 아래에 깔리는 바닥 표시(통로 등)는 낮은 layer */
  layer: number
  vehicle?: boolean
}

export interface CatalogGroup {
  id: string
  label: string
  items: CatalogItem[]
}

export const CATALOG: CatalogGroup[] = [
  {
    id: 'structure',
    label: '공간·구조',
    items: [
      { type: 'wall', label: '벽', icon: wall, w: 10, h: 0.4, prefix: '벽', layer: 2 },
      { type: 'column', label: '기둥', icon: column, w: 0.8, h: 0.8, prefix: '기둥', layer: 2 },
      { type: 'door', label: '출입문', icon: door, w: 3, h: 0.5, prefix: '출입문', layer: 2 },
      { type: 'dock', label: '도크', icon: dock, w: 4.5, h: 5, prefix: '도크 D', layer: 1 },
    ],
  },
  {
    id: 'production',
    label: '생산·작업',
    items: [
      { type: 'machine', label: '작업 설비', icon: machine, w: 8, h: 5, prefix: '작업 설비 ', layer: 2 },
      { type: 'workbench', label: '작업대', icon: workbench, w: 3, h: 1.5, prefix: '작업대 ', layer: 2 },
      { type: 'conveyor', label: '컨베이어', icon: conveyor, w: 10, h: 1.2, prefix: '컨베이어 ', layer: 2 },
    ],
  },
  {
    id: 'storage',
    label: '보관·하역',
    items: [
      { type: 'shelf', label: '선반', icon: shelf, w: 10.5, h: 3, prefix: '선반 R', layer: 2 },
      { type: 'pallet', label: '팔레트 적치', icon: pallet, w: 3, h: 3, prefix: '팔레트 ', layer: 2 },
      { type: 'waiting', label: '대기 구역', icon: waiting, w: 6, h: 4, prefix: '대기 구역 ', layer: 1 },
      { type: 'charger', label: '충전소', icon: charger, w: 2, h: 2, prefix: '충전소 ', layer: 2 },
    ],
  },
  {
    id: 'movers',
    label: '이동 주체',
    items: [
      { type: 'forklift', label: '지게차', icon: forklift, w: 2.7, h: 1.8, prefix: 'F', layer: 3, vehicle: true },
      { type: 'worker', label: '작업자', icon: worker, w: 0.9, h: 0.9, prefix: 'W', layer: 3 },
      { type: 'truck', label: '운반 트럭', icon: truck, w: 7, h: 2.5, prefix: 'T', layer: 3, vehicle: true },
      { type: 'agv', label: 'AGV', icon: agv, w: 1.6, h: 1.2, prefix: 'AGV ', layer: 3, vehicle: true },
    ],
  },
  {
    id: 'safety',
    label: '통로·안전',
    items: [
      { type: 'vehicleAisle', label: '차량 통로', icon: vehicleAisle, w: 30, h: 4, prefix: '차량 통로 ', layer: 0 },
      { type: 'walkway', label: '보행로', icon: walkway, w: 2.5, h: 20, prefix: '보행로 ', layer: 0 },
      { type: 'crossing', label: '횡단 구역', icon: crossing, w: 3, h: 4, prefix: '횡단 구역 ', layer: 0 },
      { type: 'speedLimit', label: '속도 제한', icon: speedLimitRing, w: 1.2, h: 1.2, prefix: '속도 제한 ', layer: 3 },
      { type: 'safetyBar', label: '안전바', icon: safetyBar, w: 6, h: 0.4, prefix: '안전바 ', layer: 2 },
      { type: 'speedBump', label: '방지턱', icon: speedBump, w: 3, h: 0.5, prefix: '방지턱 ', layer: 1 },
    ],
  },
]

export const CATALOG_BY_TYPE: Record<ElementType, CatalogItem> = Object.fromEntries(
  CATALOG.flatMap((g) => g.items.map((i) => [i.type, i])),
) as Record<ElementType, CatalogItem>

export const ROUTE_OPTIONS = ['경로 A', '경로 B', '경로 C', '자동']
