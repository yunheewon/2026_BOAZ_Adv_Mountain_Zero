/**
 * ⚠️ 예시 데이터 — 실제 시뮬레이션 결과가 아닙니다.
 *
 * Figma "00 / 개발 전달 가이드": "7건·82.7초 등 지표는 화면 설계용 예시. 실제 프론트는
 * 시뮬레이션 결과 API 값으로 치환한다. 권장 조치와 최적 운영안은 별도 결과 데이터로 관리한다."
 *
 * 이 파일의 값은 src/api/forksight.ts 에서만 읽습니다. 결과 API가 연결되면
 * 그 파일의 함수만 바꾸면 되고, 화면 컴포넌트는 그대로 둡니다.
 */
import type { LayoutElement, OptimalPlan, RecommendedAction, RiskEvent, SimulationResult, Workspace } from '../types'

export const EXAMPLE_NOTICE = '예시 데이터 · 실제 결과 아님'

let seq = 0
const el = (e: Omit<LayoutElement, 'id' | 'rotation'> & { rotation?: number }): LayoutElement => ({
  id: `ex-${++seq}`,
  rotation: 0,
  ...e,
})

// ---------- 배치 도우미 (단위 m, 작업장 60 × 40 m) ----------
const walls = (): LayoutElement[] => [
  el({ type: 'wall', label: '외벽 북', x: 0, y: 0, w: 60, h: 0.4 }),
  el({ type: 'wall', label: '외벽 남', x: 0, y: 39.6, w: 60, h: 0.4 }),
  el({ type: 'wall', label: '외벽 서', x: 0, y: 0.4, w: 0.4, h: 39.2 }),
  el({ type: 'wall', label: '외벽 동', x: 59.6, y: 0.4, w: 0.4, h: 39.2 }),
]
const aisle = (label: string, x: number, y: number, w: number, h: number) => el({ type: 'vehicleAisle', label, x, y, w, h })
const walkway = (label: string, x: number, y: number, w: number, h: number) => el({ type: 'walkway', label, x, y, w, h })
const crossing = (label: string, x: number, y: number, w: number, h: number) => el({ type: 'crossing', label, x, y, w, h })
const zone = (label: string, x: number, y: number, w: number, h: number) => el({ type: 'waiting', label, x, y, w, h })
const rack = (label: string, x: number, y: number, w = 10.6, h = 2.4) => el({ type: 'shelf', label, x, y, w, h })
const pallet = (label: string, x: number, y: number) => el({ type: 'pallet', label, x, y, w: 3, h: 3 })
const charger = (label: string, x: number, y: number) => el({ type: 'charger', label, x, y, w: 2, h: 2 })
const bench = (label: string, x: number, y: number) => el({ type: 'workbench', label, x, y, w: 3, h: 1.5 })
const machine = (label: string, x: number, y: number, w = 6, h = 4) => el({ type: 'machine', label, x, y, w, h })
const dock = (label: string, x: number, y: number, w = 6, h = 3.6) => el({ type: 'dock', label, x, y, w, h })
const worker = (label: string, x: number, y: number) => el({ type: 'worker', label, x, y, w: 0.9, h: 0.9 })
const forklift = (label: string, x: number, y: number, rotation = 0, route = '경로 A') =>
  el({ type: 'forklift', label, x, y, w: 2.7, h: 1.8, rotation, maxSpeedKmh: 8, route })
const agv = (label: string, x: number, y: number) => el({ type: 'agv', label, x, y, w: 1.6, h: 1.2, maxSpeedKmh: 4, route: '자동' })
const bump = (label: string, x: number, y: number, w = 0.5, h = 4) => el({ type: 'speedBump', label, x, y, w, h })
const limit = (label: string, x: number, y: number, kmh = 10) => el({ type: 'speedLimit', label, x, y, w: 1.2, h: 1.2, limitKmh: kmh })
const bar = (label: string, x: number, y: number, w: number, h: number) => el({ type: 'safetyBar', label, x, y, w, h })
const column = (label: string, x: number, y: number) => el({ type: 'column', label, x, y, w: 0.6, h: 0.6 })

/**
 * Figma "04 / 배치 · 편집 중" 배치를 60 × 40 m 로 옮긴 예시.
 * Figma 원본은 선반이 보행로·차량 통로를 덮고 있어, 선반 사이에 지게차 통로를 두고
 * 보행로를 설비 쪽으로 옮겨 겹치지 않게 했다.
 */
export function exampleLayout(): LayoutElement[] {
  return [
    aisle('좌측 통로', 4, 7.8, 4.8, 15),
    aisle('선반 통로 1', 4, 7.8, 30.2, 4.5),
    aisle('선반 통로 2', 4, 15.3, 30.2, 4.5),
    aisle('차량 통로', 4, 22.8, 52, 4.6),
    walkway('보행로', 34.6, 2, 2.6, 34.6),
    crossing('횡단 구역', 34.6, 22.8, 2.6, 4.6),
    rack('선반 R1', 9.2, 4.8, 10.5, 3),
    rack('선반 R2', 23.1, 4.8, 10.5, 3),
    rack('선반 R3', 9.2, 12.3, 10.5, 3),
    rack('선반 R4', 23.1, 12.3, 10.5, 3),
    rack('선반 R5', 9.2, 19.8, 10.5, 3),
    rack('선반 R6', 23.1, 19.8, 10.5, 3),
    machine('작업 설비 1', 40.9, 10.6, 10.2, 6.4),
    forklift('F1', 21.1, 24.2),
    forklift('F2', 44, 24.2, 180, '경로 B'),
    worker('W1', 35.4, 8.5),
    worker('W2', 35.4, 31),
    worker('W3', 47, 18.2),
  ]
}

/** Figma "03a / 업로드 도면 확인" 의 인식 결과 예시 (60 × 40 m) */
export function exampleRecognizedPlan(): LayoutElement[] {
  return [
    aisle('도크 앞 통로', 7.4, 1.5, 4, 32),
    aisle('선반 통로 좌', 7.4, 7.4, 22.3, 6.3),
    aisle('선반 통로 우', 33, 7.4, 23.2, 6.3),
    aisle('차량 통로', 7.4, 17, 48.8, 6.3),
    walkway('보행로', 29.7, 1.5, 3.2, 32),
    crossing('횡단 구역', 29.7, 17, 3.2, 6.3),
    dock('도크 D1', 1.5, 3.7, 5.6, 5.7),
    dock('도크 D2', 1.5, 13.2, 5.6, 5.7),
    dock('도크 D3', 1.5, 22.7, 5.6, 5.7),
    rack('선반 R1', 11.7, 4.1, 14.1, 3.3),
    rack('선반 R2', 33, 4.1, 14.1, 3.3),
    rack('선반 R3', 11.7, 13.7, 14.1, 3.3),
    rack('선반 R4', 33, 13.7, 14.1, 3.3),
    rack('선반 R5', 11.7, 23.3, 14.1, 3.3),
    rack('선반 R6', 33, 23.3, 14.1, 3.3),
  ]
}

const recommendedActions: RecommendedAction[] = [
  {
    id: 'A-speed',
    title: 'F1 최대 속도를 8→5 km/h로 낮추세요.',
    tag: '속도 조절',
    param: { label: 'F1 최대 속도', unit: 'km/h', value: 5, min: 3, max: 8, step: 1 },
    describe: (v) => `지게차 F1 · 최대 속도 ${v} km/h`,
    example: { riskEvents: [7, 4], avgTaskSec: [82.7, 86.9], throughput: [42, 39] },
  },
  {
    id: 'A-bump',
    title: 'E-02 진입부에 방지턱을 설치하세요.',
    tag: '방지턱',
    eventId: 'E-02',
    param: { label: '횡단 구역 진입 전 거리', unit: 'm', value: 3, min: 1, max: 8, step: 0.5 },
    describe: (v) => `차량 통로 · 횡단 구역 진입 전 ${v} m`,
    example: { riskEvents: [7, 5], avgTaskSec: [82.7, 84.1], throughput: [42, 41] },
  },
  {
    id: 'A-bar',
    title: '보행로 옆에 안전바를 설치하세요.',
    tag: '안전바',
    param: { label: '안전바 길이', unit: 'm', value: 12, min: 4, max: 30, step: 1 },
    describe: (v) => `보행로 양측 · 안전바 ${v} m`,
    example: { riskEvents: [7, 6], avgTaskSec: [82.7, 82.9], throughput: [42, 42] },
  },
]

export function exampleBaselineResult(durationSec = 600): SimulationResult {
  return {
    id: 'example-baseline',
    isExample: true,
    durationSec,
    metrics: { riskEvents: 7, avgTaskSec: 82.7, throughput: 42, avgWaitSec: 18.1 },
    riskByType: { near: 5, contact: 1, collision: 1 },
    events: [
      { id: 'E-01', timeSec: 78, type: 'near', location: '도크 D1', pos: { x: 0.131, y: 0.362 } },
      { id: 'E-02', timeSec: 134, type: 'near', location: '중앙 교차로', pos: { x: 0.507, y: 0.472 } },
      { id: 'E-03', timeSec: 207, type: 'contact', location: '지게차 구역 A', pos: { x: 0.371, y: 0.463 } },
      { id: 'E-04', timeSec: 249, type: 'near', location: '도크 D2', pos: { x: 0.146, y: 0.587 } },
    ],
    hotspots: [
      { label: 'E-02 · 중앙 교차로', count: 3, eventId: 'E-02' },
      { label: 'E-04 · 도크 D2', count: 2, eventId: 'E-04' },
      { label: '기타 구역', count: 2 },
    ],
    // 1분 구간별 위험 이벤트 건수 (합계 = metrics.riskEvents)
    timeBins: [0, 1, 2, 1, 1, 0, 1, 0, 1, 0],
    actions: recommendedActions,
  }
}

/** 최적안 재생 화면의 남은 위험 이벤트 예시 */
export const exampleOptimalEvents: RiskEvent[] = [
  { id: 'E-01', timeSec: 161, type: 'near', location: '중앙 교차로 근접', pos: { x: 0.507, y: 0.472 } },
  { id: 'E-02', timeSec: 338, type: 'contact', location: '도크 D2', pos: { x: 0.146, y: 0.587 } },
]

export function exampleOptimalPlan(durationSec = 600): OptimalPlan {
  return {
    isExample: true,
    durationSec,
    baseline: { riskEvents: 7, avgTaskSec: 82.7, throughput: 42, avgWaitSec: 18.1 },
    optimal: { riskEvents: 2, avgTaskSec: 78.3, throughput: 46, avgWaitSec: 14.6 },
    riskByType: {
      baseline: { near: 5, contact: 1, collision: 1 },
      optimal: { near: 1, contact: 1, collision: 0 },
    },
    changes: [
      { label: 'F1 경로', value: '교차로 → 외곽 통로' },
      { label: '최대 속도', value: '8 → 6 km/h' },
      { label: 'E-02', value: '진입부 방지턱' },
      { label: '보행로', value: '안전바 12 m' },
    ],
    remainingRisk: '교차로 근접 1건',
    events: exampleOptimalEvents,
    vehicles: [
      { id: 'F1', label: 'F1', hasRoute: true },
      { id: 'F2', label: 'F2', hasRoute: false },
    ],
  }
}

export interface Template {
  id: string
  name: string
  description: string
  size: string
  build: () => LayoutElement[]
}

/**
 * 템플릿 배치 규칙: 설비끼리·설비와 통로가 겹치지 않고, 보행로가 차량 통로를 지나는 곳은
 * 횡단 구역으로 표시하며, 지게차·AGV는 통로나 대기·충전 구역에, 랙은 지게차 통로에 접하게 둔다.
 */
export const TEMPLATES: Template[] = [
  {
    id: 'tpl-rack',
    name: '랙 보관형 창고',
    description: '선반 12 · 출고 대기 구역 · 포장 작업장 · 지게차 4',
    size: '60 × 40 m',
    build: () => [
      ...walls(),
      el({ type: 'door', label: '출입문', x: 28.7, y: 39.2, w: 2.6, h: 0.6 }),
      // 지게차 통로: 좌우 순환 통로 + 선반 사이 통로 + 중앙 주 통로 + 도크 앞
      aisle('서측 통로', 0.4, 0.4, 4.6, 15.6),
      aisle('동측 통로', 55, 0.4, 4.6, 15.6),
      aisle('선반 통로 A 서', 0.4, 3.6, 26.6, 3.6),
      aisle('선반 통로 A 동', 33, 3.6, 26.6, 3.6),
      aisle('선반 통로 B 서', 0.4, 12, 26.6, 4),
      aisle('선반 통로 B 동', 33, 12, 26.6, 4),
      aisle('주 통로', 0.4, 16, 59.2, 4),
      aisle('도크 연결 통로', 0.4, 20, 4.6, 11.5),
      aisle('도크 앞 통로', 0.4, 31.5, 26.6, 4.5),
      aisle('충전 연결 통로', 55, 20, 4.6, 13),
      walkway('중앙 보행로', 29, 0.4, 2, 38.8),
      crossing('횡단 구역', 29, 16, 2, 4),
      bump('방지턱 서', 27.6, 16),
      bump('방지턱 동', 31.9, 16),
      limit('속도 제한 1', 6, 18.6),
      limit('속도 제한 2', 50, 16.4),
      // 선반: 3열 × 좌우 2개씩 (가운데 두 열은 등을 맞댄 배치)
      rack('선반 R1', 5.4, 1.2), rack('선반 R2', 16.2, 1.2),
      rack('선반 R3', 33.2, 1.2), rack('선반 R4', 44.2, 1.2),
      rack('선반 R5', 5.4, 7.2), rack('선반 R6', 16.2, 7.2),
      rack('선반 R7', 33.2, 7.2), rack('선반 R8', 44.2, 7.2),
      rack('선반 R9', 5.4, 9.6), rack('선반 R10', 16.2, 9.6),
      rack('선반 R11', 33.2, 9.6), rack('선반 R12', 44.2, 9.6),
      column('기둥 1', 27.6, 5.1), column('기둥 2', 31.8, 5.1),
      column('기둥 3', 27.6, 13.7), column('기둥 4', 31.8, 13.7),
      column('기둥 5', 27.6, 25),
      // 출고: 대기 구역 + 팔레트, 도크 3개
      zone('출고 대기 구역', 6, 21, 20.5, 9.5),
      pallet('팔레트 1', 7, 22.5), pallet('팔레트 2', 11, 22.5), pallet('팔레트 3', 15, 22.5), pallet('팔레트 4', 19, 22.5),
      pallet('팔레트 5', 7, 26.5), pallet('팔레트 6', 11, 26.5), pallet('팔레트 7', 15, 26.5),
      dock('도크 D1', 3, 36, 5.5), dock('도크 D2', 10, 36, 5.5), dock('도크 D3', 17, 36, 5.5),
      bar('안전바 1', 28.4, 21, 0.4, 10),
      bar('안전바 2', 31.2, 21, 0.4, 10),
      // 포장 작업장
      bench('포장대 1', 34, 22.5), bench('포장대 2', 39, 22.5),
      bench('포장대 3', 34, 26.5), bench('포장대 4', 39, 26.5),
      el({ type: 'conveyor', label: '출고 컨베이어', x: 33.5, y: 30, w: 11.5, h: 1.2 }),
      machine('랩핑기', 47, 22),
      bar('안전바 3', 54.2, 21, 0.4, 10),
      // 지게차 충전
      zone('지게차 충전 구역', 44, 33, 15.6, 6.6),
      charger('충전기 1', 46, 37), charger('충전기 2', 49, 37), charger('충전기 3', 52, 37),
      forklift('F1', 10, 17.1),
      forklift('F2', 40, 4.5, 180, '경로 B'),
      forklift('F3', 14, 33, 0, '경로 C'),
      forklift('F4', 47, 34.2),
      worker('W1', 29.55, 8),
      worker('W2', 35, 24.2),
      worker('W3', 40, 24.2),
      worker('W4', 22.6, 27.6),
      worker('W5', 49.5, 26.6),
    ],
  },
  {
    id: 'tpl-dock',
    name: '크로스도크 하역장',
    description: '입고·출고 도크 10 · 대기 구역 4 · 지게차 6',
    size: '60 × 40 m',
    build: () => [
      ...walls(),
      el({ type: 'door', label: '출입문', x: 0, y: 20.25, w: 0.6, h: 3 }),
      // 입고 도크(북) → 입고 대기 → 중앙 통로 → 출고 대기 → 출고 도크(남)
      ...[4, 14, 24, 34, 44].map((x, i) => dock(`입고 D${i + 1}`, x, 0.4)),
      ...[4, 14, 24, 34, 44].map((x, i) => dock(`출고 D${i + 6}`, x, 36)),
      aisle('입고 도크 앞 통로', 0.4, 4, 59.2, 4),
      aisle('출고 도크 앞 통로', 0.4, 32, 59.2, 4),
      aisle('서측 통로', 0.4, 8, 4.6, 24),
      aisle('동측 통로', 55, 8, 4.6, 24),
      aisle('중앙 통로', 5, 16.5, 50, 4),
      walkway('보행로 남북', 29.2, 8, 2, 24),
      walkway('보행로 동서', 0.4, 21, 28.8, 1.5),
      crossing('횡단 구역 1', 29.2, 16.5, 2, 4),
      crossing('횡단 구역 2', 0.4, 21, 4.6, 1.5),
      bump('방지턱 1', 27.8, 16.5),
      bump('방지턱 2', 32, 16.5),
      limit('속도 제한 1', 52, 6.6),
      limit('속도 제한 2', 6, 32.4),
      zone('입고 대기 서', 6, 9, 22, 6.5),
      zone('입고 대기 동', 32.4, 9, 21.6, 6.5),
      zone('출고 대기 서', 6, 23, 22, 8),
      zone('출고 대기 동', 32.4, 23, 15.1, 8),
      ...[7, 11, 15, 19, 23].map((x, i) => pallet(`입고 팔레트 ${i + 1}`, x, 10.5)),
      ...[33.5, 37.5, 41.5, 45.5, 49.5].map((x, i) => pallet(`입고 팔레트 ${i + 6}`, x, 10.5)),
      pallet('출고 팔레트 1', 7, 24.3), pallet('출고 팔레트 2', 11, 24.3), pallet('출고 팔레트 3', 15, 24.3),
      pallet('출고 팔레트 4', 7, 27.8), pallet('출고 팔레트 5', 11, 27.8),
      pallet('출고 팔레트 6', 33.5, 24.3), pallet('출고 팔레트 7', 37.5, 24.3), pallet('출고 팔레트 8', 41.5, 24.3),
      pallet('출고 팔레트 9', 33.5, 27.8),
      bar('안전바 1', 28.6, 9, 0.4, 6.5), bar('안전바 2', 31.6, 9, 0.4, 6.5),
      bar('안전바 3', 28.6, 23.5, 0.4, 7.5), bar('안전바 4', 31.6, 23.5, 0.4, 7.5),
      zone('지게차 충전 구역', 48.5, 23, 5.5, 8),
      charger('충전기 1', 49.2, 28.6), charger('충전기 2', 51.7, 28.6),
      forklift('F1', 12, 5.1),
      forklift('F2', 40, 5.1, 180, '경로 B'),
      forklift('F3', 20, 17.6, 0, '경로 C'),
      forklift('F4', 36, 33.1, 0, '경로 D'),
      forklift('F5', 49.3, 24.4),
      forklift('F6', 1.6, 11, 90, '경로 B'),
      worker('W1', 29.75, 12),
      worker('W2', 26.6, 14.1),
      worker('W3', 14, 21.3),
      worker('W4', 46, 29.5),
    ],
  },
  {
    id: 'tpl-line',
    name: '제조 라인',
    description: '가공·조립 라인 2개 · 원자재 랙 · AGV 2 · 지게차 4',
    size: '60 × 40 m',
    build: () => [
      ...walls(),
      el({ type: 'door', label: '출입문', x: 15, y: 39.2, w: 2.6, h: 0.6 }),
      // 원자재 보관 (북서)
      aisle('원자재 통로', 0.4, 0.4, 3.6, 17.6),
      aisle('랙 통로 1', 0.4, 3.6, 14.6, 3.6),
      aisle('랙 통로 2', 0.4, 12, 14.6, 6),
      rack('원자재 랙 R1', 4.4, 1.2, 10.2), rack('원자재 랙 R2', 4.4, 7.2, 10.2), rack('원자재 랙 R3', 4.4, 9.6, 10.2),
      // 주 통로와 보행로
      aisle('주 통로', 0.4, 18, 59.2, 4),
      walkway('보행로 남북', 15.2, 0.4, 1.8, 38.8),
      walkway('작업자 통로 1', 17, 11, 42.6, 2),
      walkway('작업자 통로 2', 17, 34.6, 36, 2),
      crossing('횡단 구역', 15.2, 18, 1.8, 4),
      bump('방지턱 1', 14.4, 18),
      bump('방지턱 2', 17.3, 18),
      limit('속도 제한', 40, 18.4, 5),
      // 가공 라인 (북): 가공기 → 컨베이어 → 작업대
      machine('가공기 M1', 19, 1.2), machine('가공기 M2', 27, 1.2), machine('가공기 M3', 35, 1.2), machine('가공기 M4', 43, 1.2),
      el({ type: 'conveyor', label: '가공 컨베이어', x: 18.5, y: 6, w: 37.5, h: 1.2 }),
      ...[20, 26, 32, 38, 44, 50].map((x, i) => bench(`작업대 ${i + 1}`, x, 8.6)),
      worker('W1', 21.1, 7.45), worker('W2', 33.1, 7.45), worker('W3', 45.1, 7.45),
      zone('부품 대기 구역', 18, 13, 16, 4.4),
      pallet('부품 팔레트 1', 19, 14.3), pallet('부품 팔레트 2', 23, 14.3), pallet('부품 팔레트 3', 27, 14.3),
      bar('안전바', 35, 17.4, 14, 0.4),
      zone('AGV 충전 구역', 50, 13, 9.6, 4.8),
      charger('AGV 충전기 1', 51, 14.5), charger('AGV 충전기 2', 54, 14.5),
      agv('AGV 1', 30, 19.4),
      agv('AGV 2', 56.5, 16.1),
      // 조립 라인 (남): 조립대 → 컨베이어 → 조립기·검사
      ...[20, 26, 32, 38, 44].map((x, i) => bench(`조립대 ${i + 1}`, x, 24)),
      worker('W4', 21.1, 25.8), worker('W5', 33.1, 25.8), worker('W6', 45.1, 25.8),
      el({ type: 'conveyor', label: '조립 컨베이어', x: 18.5, y: 27, w: 34.5, h: 1.2 }),
      machine('조립기 M5', 20, 29.6), machine('조립기 M6', 30, 29.6), machine('조립기 M7', 40, 29.6),
      machine('검사 장비', 47.5, 29.6, 5.5, 4),
      // 완제품 출하 (남서)
      aisle('출하 통로', 0.4, 22, 3.6, 14),
      aisle('도크 앞 통로', 0.4, 31.5, 14.2, 4.5),
      zone('완제품 대기 구역', 4.4, 22, 10.2, 9),
      pallet('완제품 1', 5, 23.3), pallet('완제품 2', 9, 23.3), pallet('완제품 3', 5, 27.3), pallet('완제품 4', 9, 27.3),
      dock('출하 도크', 4, 36),
      // 지게차 충전 (남동)
      aisle('동측 통로', 54, 22, 5.6, 8),
      zone('지게차 충전 구역', 54, 30, 5.6, 9.6),
      charger('충전기 1', 55, 36.8), charger('충전기 2', 57.4, 36.8),
      forklift('F1', 6, 19),
      forklift('F2', 8, 4.5, 0, '경로 B'),
      forklift('F3', 8, 33, 0, '경로 C'),
      forklift('F4', 55.4, 31.3),
      worker('W7', 15.65, 30),
      worker('W8', 40, 11.5),
    ],
  },
]

/** 로그인한 계정에 저장돼 있다고 가정한 작업장 목록 (Figma "02 / 작업장 목록") */
export function exampleSavedWorkspaces(): Workspace[] {
  return [
    {
      id: 'ws-seongsu-1',
      name: '성수 물류센터 · 1층',
      saved: true,
      status: 'done',
      updatedLabel: '오늘 10:42',
      plan: { fileName: '성수센터_1층.png', widthM: 60, heightM: 40, gridM: 1, rotation: 0 },
      elements: exampleLayout(),
      result: exampleBaselineResult(600),
    },
    {
      id: 'ws-seongsu-2',
      name: '성수 물류센터 · 2층',
      saved: true,
      status: 'editing',
      updatedLabel: '어제 16:18',
      plan: { fileName: '성수센터_2층.png', widthM: 60, heightM: 40, gridM: 1, rotation: 0 },
      elements: exampleLayout().slice(0, 6),
    },
    {
      id: 'ws-pyeongtaek-1',
      name: '평택 물류센터 · 1층',
      saved: true,
      status: 'ready',
      updatedLabel: '3일 전',
      plan: { fileName: '평택센터_1층.png', widthM: 60, heightM: 40, gridM: 1, rotation: 0 },
      elements: exampleRecognizedPlan(),
    },
  ]
}
