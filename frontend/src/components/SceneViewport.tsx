import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { DEFAULT_CAMERA, type Camera } from './camera'
import './scene.css'

interface SceneViewportProps {
  /** 창고 시뮬레이션 장면 이미지 — 가이드상 이미지 채움은 이 장면에만 쓴다 */
  src: string
  imageWidth: number
  imageHeight: number
  alt: string
  camera?: Camera
  onCameraChange?: (camera: Camera) => void
  /** 이미지 비율 좌표로 배치되는 오버레이 (위험 마커 등) */
  children?: ReactNode
  className?: string
  style?: CSSProperties
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * 장면 이미지를 object-fit: cover 처럼 채우고, 같은 좌표계의 오버레이를 함께 움직인다.
 * onCameraChange 를 넘기면 드래그 이동 · 휠 확대 · 더블클릭 초기화가 켜진다.
 */
export function SceneViewport({
  src,
  imageWidth,
  imageHeight,
  alt,
  camera = DEFAULT_CAMERA,
  onCameraChange,
  children,
  className = '',
  style,
}: SceneViewportProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const interactive = !!onCameraChange
  const drag = useRef<{ x: number; y: number; cam: Camera } | null>(null)

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const update = () => setBox({ w: node.clientWidth, h: node.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  const aspect = imageWidth / imageHeight
  const worldW = Math.max(box.w, box.h * aspect)
  const worldH = worldW / aspect
  const z = camera.zoom
  const tx = clamp(box.w / 2 - camera.fx * worldW * z, box.w - worldW * z, 0)
  const ty = clamp(box.h / 2 - camera.fy * worldH * z, box.h - worldH * z, 0)

  // 휠 확대는 페이지 스크롤을 막아야 해서 passive: false 로 직접 등록
  const camRef = useRef(camera)
  useLayoutEffect(() => {
    camRef.current = camera
  }, [camera])
  useEffect(() => {
    const node = ref.current
    if (!node || !onCameraChange) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const cam = camRef.current
      const zoom = clamp(cam.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, 4)
      onCameraChange({ ...cam, zoom })
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [onCameraChange])

  return (
    <div
      ref={ref}
      className={`fs-scene ${interactive ? 'fs-scene--interactive' : ''} ${className}`}
      style={style}
      onPointerDown={(e) => {
        if (!interactive || (e.target as HTMLElement).closest('button')) return
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, y: e.clientY, cam: camera }
      }}
      onPointerMove={(e) => {
        if (!drag.current || !onCameraChange) return
        const { x, y, cam } = drag.current
        onCameraChange({
          ...cam,
          fx: clamp(cam.fx - (e.clientX - x) / (worldW * cam.zoom), 0, 1),
          fy: clamp(cam.fy - (e.clientY - y) / (worldH * cam.zoom), 0, 1),
        })
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={() => onCameraChange?.(DEFAULT_CAMERA)}
    >
      <div
        className="fs-scene__world"
        style={{
          width: worldW,
          height: worldH,
          transform: `translate(${tx}px, ${ty}px) scale(${z})`,
          ['--scene-zoom' as string]: z,
        }}
      >
        <img src={src} alt={alt} className="fs-scene__image" draggable={false} />
        {children}
      </div>
    </div>
  )
}

/** 이미지 비율 좌표에 붙는 오버레이. 확대해도 크기는 유지한다. */
export function SceneAnchor({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div className="fs-scene__anchor" style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>
      {children}
    </div>
  )
}
