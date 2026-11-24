import chevron from '../assets/figma/icons/chevron-down.svg'
import './components.css'

/** 드롭다운 표시. 작업장 선택기와 같은 Figma 아이콘(Open worksite)을 쓴다. */
export function Caret({ size = 14 }: { size?: number }) {
  return <img className="fs-caret" src={chevron} width={size} height={size} alt="" aria-hidden />
}
