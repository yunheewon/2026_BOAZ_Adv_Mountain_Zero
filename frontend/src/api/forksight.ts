/**
 * FORKSIGHT API 연결 지점
 *
 * 지금은 백엔드(FastAPI)에 /api/health 만 있어서 모든 함수가 src/data/example.ts 의
 * 예시 데이터를 돌려줍니다. 각 함수의 `TODO(API)` 주석 위치에서 fetch 로 바꾸면 되고,
 * 화면 컴포넌트는 이 파일의 함수 시그니처만 사용합니다.
 *
 * 응답에 `isExample: false` 를 넣으면 화면의 "예시 데이터" 표시가 사라집니다.
 */
import type { FloorPlan, LayoutElement, OptimalPlan, SimulationResult, TrialResult } from '../types'
import { exampleBaselineResult, exampleOptimalPlan, exampleRecognizedPlan } from '../data/example'

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** API 미연결 상태에서 보낼 요청을 개발 콘솔에 남긴다 (연결 후 fetch 로 교체) */
function pendingRequest(endpoint: string, payload: unknown) {
  if (import.meta.env.DEV) console.debug(`[API 미연결 · 예시 데이터 사용] ${endpoint}`, payload)
}

/** 도면 업로드 → 크기·요소 인식 */
export async function uploadFloorPlan(file: File): Promise<{ plan: FloorPlan; elements: LayoutElement[] }> {
  // TODO(API): POST `${API_BASE_URL}/api/v1/floorplans` (multipart: file)
  //            → { plan: FloorPlan, elements: LayoutElement[] }
  pendingRequest('POST /api/v1/floorplans', { fileName: file.name, size: file.size })
  await wait(300)
  const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
  return {
    plan: { fileName: file.name, previewUrl, widthM: 60, heightM: 40, gridM: 1, rotation: 0 },
    elements: exampleRecognizedPlan(),
  }
}

/** 기준안 시뮬레이션 실행 */
export async function runBaselineSimulation(
  workspaceId: string,
  elements: LayoutElement[],
  durationMin: number,
): Promise<SimulationResult> {
  // TODO(API): POST `${API_BASE_URL}/api/v1/simulations`
  //            body { workspaceId, elements, durationMin } → SimulationResult
  pendingRequest('POST /api/v1/simulations', { workspaceId, elements, durationMin })
  await wait(1200)
  return exampleBaselineResult(durationMin * 60)
}

/** 권장 조치 시험 실행 (기준안은 바뀌지 않음) */
export async function runTrial(
  result: SimulationResult,
  actionId: string,
  paramValue: number,
): Promise<TrialResult> {
  // TODO(API): POST `${API_BASE_URL}/api/v1/simulations/${result.id}/trials`
  //            body { actionId, paramValue } → TrialResult
  pendingRequest(`POST /api/v1/simulations/${result.id}/trials`, { actionId, paramValue })
  await wait(1000)
  const action = result.actions.find((a) => a.id === actionId)
  if (!action) throw new Error(`알 수 없는 권장 조치: ${actionId}`)
  return action.example
}

/** 모델 최적화 결과 (개별 시험안과 독립) */
export async function fetchOptimalPlan(result: SimulationResult): Promise<OptimalPlan> {
  // TODO(API): GET `${API_BASE_URL}/api/v1/simulations/${result.id}/optimal` → OptimalPlan
  pendingRequest(`GET /api/v1/simulations/${result.id}/optimal`, null)
  await wait(200)
  return exampleOptimalPlan(result.durationSec)
}

/** 로그인 */
export async function login(userId: string, password: string): Promise<{ name: string }> {
  // TODO(API): POST `${API_BASE_URL}/api/v1/auth/login` → { name, token }
  //            저장된 작업장 목록은 GET /api/v1/workspaces 로 받아 AppState 에 넣는다.
  pendingRequest('POST /api/v1/auth/login', { userId, hasPassword: password.length > 0 })
  await wait(400)
  return { name: userId.trim() || '운영자' }
}
