import ring from '../assets/figma/overlay/marker-ring.svg'
import dot from '../assets/figma/overlay/marker-dot.svg'
import label from '../assets/figma/overlay/marker-label.svg'
import ringSm from '../assets/figma/overlay/marker-sm-ring.svg'
import dotSm from '../assets/figma/overlay/marker-sm-dot.svg'
import labelSm from '../assets/figma/overlay/marker-sm-label.svg'
import './scene.css'

/**
 * Figma "위험 이벤트 마커" (80×54) / 결과 분석의 작은 마커 (70×45).
 * 기준점은 원의 중심이며, SceneAnchor 안에서 그 점이 위험 위치에 오도록 배치한다.
 */
export function RiskMarker({
  id,
  size = 'md',
  active = false,
  onClick,
}: {
  id: string
  size?: 'md' | 'sm'
  active?: boolean
  onClick?: () => void
}) {
  const sm = size === 'sm'
  return (
    <button
      type="button"
      className={`fs-marker fs-marker--${size} ${active ? 'is-active' : ''}`}
      onClick={onClick}
      aria-label={`위험 이벤트 ${id}`}
    >
      <img className="fs-marker__ring" src={sm ? ringSm : ring} width={sm ? 28 : 35} height={sm ? 28 : 35} alt="" />
      <img className="fs-marker__dot" src={sm ? dotSm : dot} width={sm ? 8 : 10} height={sm ? 8 : 10} alt="" />
      <img className="fs-marker__label" src={sm ? labelSm : label} width={sm ? 51 : 41} height={sm ? 19 : 22} alt="" />
      <span className="fs-marker__text">{id}</span>
    </button>
  )
}
