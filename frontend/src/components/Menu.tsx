import { useEffect, useRef, useState, type ReactNode } from 'react'
import './components.css'

export interface MenuItem<T extends string> {
  value: T
  label: ReactNode
  disabled?: boolean
  hint?: string
}

interface MenuProps<T extends string> {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  items: MenuItem<T>[]
  value?: T
  onSelect: (value: T) => void
  align?: 'left' | 'right'
  footer?: ReactNode
  className?: string
}

/** 버튼을 누르면 열리는 작은 선택 목록. 바깥 클릭·Esc 로 닫힌다. */
export function Menu<T extends string>({ trigger, items, value, onSelect, align = 'left', footer, className = '' }: MenuProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`fs-menu ${className}`} ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className={`fs-menu__panel fs-menu__panel--${align}`} role="menu">
          {items.map((item) => (
            <button
              key={item.value}
              role="menuitemradio"
              aria-checked={item.value === value}
              className={`fs-menu__item ${item.value === value ? 'is-selected' : ''}`}
              disabled={item.disabled}
              title={item.hint}
              onClick={() => {
                onSelect(item.value)
                setOpen(false)
              }}
            >
              {item.label}
            </button>
          ))}
          {footer && <div className="fs-menu__footer" onClick={() => setOpen(false)}>{footer}</div>}
        </div>
      )}
    </div>
  )
}
