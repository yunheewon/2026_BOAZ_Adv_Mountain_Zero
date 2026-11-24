export type ElementType =
  | 'wall'
  | 'column'
  | 'door'
  | 'dock'
  | 'machine'
  | 'workbench'
  | 'conveyor'
  | 'shelf'
  | 'pallet'
  | 'waiting'
  | 'charger'
  | 'forklift'
  | 'worker'
  | 'truck'
  | 'agv'
  | 'vehicleAisle'
  | 'walkway'
  | 'crossing'
  | 'speedLimit'
  | 'safetyBar'
  | 'speedBump'

/** 작업장 위 하나의 레이아웃 요소. 좌표·크기 단위는 m, x/y는 회전 전 좌상단. */
export interface LayoutElement {
  id: string
  type: ElementType
  label: string
  x: number
  y: number
  w: number
  h: number
  rotation: number
  /** 이동 주체(지게차·AGV·트럭)만 사용 */
  maxSpeedKmh?: number
  route?: string
  /** 속도 제한 표지만 사용 */
  limitKmh?: number
}

export interface FloorPlan {
  fileName: string
  /** 업로드한 이미지 미리보기용 object URL (이미지 파일일 때만) */
  previewUrl?: string
  widthM: number
  heightM: number
  gridM: number
  rotation: number
}

export type WorkspaceStatus = 'ready' | 'editing' | 'done'

export interface Workspace {
  id: string
  name: string
  /** 로그인한 계정에 저장된 작업장인지. false면 이번 세션에서만 유지 */
  saved: boolean
  status: WorkspaceStatus
  updatedLabel: string
  plan: FloorPlan
  elements: LayoutElement[]
  result?: SimulationResult
}

export type RiskType = 'near' | 'contact' | 'collision'

export interface RiskEvent {
  id: string
  timeSec: number
  type: RiskType
  location: string
  /** 장면 이미지 기준 비율 좌표 (0–1) */
  pos: { x: number; y: number }
}

export interface Metrics {
  riskEvents: number
  avgTaskSec: number
  throughput: number
  avgWaitSec: number
}

export interface SimulationResult {
  id: string
  /** true면 화면 설계용 예시 데이터 */
  isExample: boolean
  durationSec: number
  metrics: Metrics
  riskByType: Record<RiskType, number>
  events: RiskEvent[]
  hotspots: { label: string; count: number; eventId?: string }[]
  /** 균등한 시간 구간별 위험 이벤트 건수 */
  timeBins: number[]
  actions: RecommendedAction[]
}

export interface TrialResult {
  riskEvents: [number, number]
  avgTaskSec: [number, number]
  throughput: [number, number]
}

export interface RecommendedAction {
  id: string
  title: string
  tag: string
  eventId?: string
  /** 시험 설정에서 조절하는 값 */
  param: { label: string; unit: string; value: number; min: number; max: number; step: number }
  describe: (value: number) => string
  example: TrialResult
}

export interface OptimalPlan {
  isExample: boolean
  durationSec: number
  baseline: Metrics
  optimal: Metrics
  riskByType: { baseline: Record<RiskType, number>; optimal: Record<RiskType, number> }
  changes: { label: string; value: string }[]
  remainingRisk: string
  /** 최적안 재생 시 남은 위험 이벤트 */
  events: RiskEvent[]
  /** 경로 표시 대상 이동 주체 */
  vehicles: { id: string; label: string; hasRoute: boolean }[]
}
