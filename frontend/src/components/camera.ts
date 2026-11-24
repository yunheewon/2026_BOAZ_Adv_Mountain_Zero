export interface Camera {
  zoom: number
  /** 화면 가운데에 둘 장면 위치 (이미지 비율 0–1) */
  fx: number
  fy: number
}

export const DEFAULT_CAMERA: Camera = { zoom: 1, fx: 0.5, fy: 0.5 }
