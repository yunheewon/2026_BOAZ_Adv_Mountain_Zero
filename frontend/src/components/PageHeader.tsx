import type { ReactNode } from 'react'
import './components.css'

/** 페이지 제목(17px) · 보조 설명(12px, x=195) · 우측 동작 */
export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="fs-pagehead">
      <h1 className="fs-pagehead__title">{title}</h1>
      {subtitle && <div className="fs-pagehead__subtitle">{subtitle}</div>}
      {children && <div className="fs-pagehead__actions">{children}</div>}
    </div>
  )
}
