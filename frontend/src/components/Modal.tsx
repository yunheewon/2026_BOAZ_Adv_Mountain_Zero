import { useEffect, type ReactNode } from 'react'
import './components.css'

interface ModalProps {
  children: ReactNode
  /** 지정하면 Esc 와 배경 클릭으로 닫힌다 */
  onClose?: () => void
  labelledBy: string
  className?: string
}

/** Figma "Backdrop overlay" (상단 메뉴 아래부터 덮음) + 가운데 다이얼로그 */
export function Modal({ children, onClose, labelledBy, className = '' }: ModalProps) {
  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fs-modal" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`fs-modal__dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </div>
    </div>
  )
}

export function ExampleBadge() {
  return (
    <span className="fs-example-badge" title="화면 설계용 예시 값입니다. 시뮬레이션 결과 API 연결 후 실제 값으로 바뀝니다.">
      예시 데이터 · 실제 결과 아님
    </span>
  )
}
