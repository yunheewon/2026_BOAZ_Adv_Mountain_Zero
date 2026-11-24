import { useRef, useState } from 'react'
import { GlobalNav } from '../components/GlobalNav'
import { StageNav } from '../components/StageNav'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/Button'
import { useElementSize } from '../hooks/useElementSize'
import { navigate, paths } from '../router'
import { useAppState } from '../state/AppState'
import type { FloorPlan, LayoutElement, Workspace } from '../types'
import './plan.css'

const fmt = (n: number) => n.toFixed(1)

/** Figma "03a / 업로드 도면 확인" */
export function PlanCheckPage({ workspace }: { workspace: Workspace }) {
  const { updateWorkspace } = useAppState()
  const [plan, setPlan] = useState<FloorPlan>(workspace.plan)
  const [elements, setElements] = useState<LayoutElement[]>(workspace.elements)
  const [selected, setSelected] = useState<string | null>(null)
  const [areaRef, area] = useElementSize<HTMLDivElement>()
  const drag = useRef<{ id: string; x: number; y: number; ox: number; oy: number } | null>(null)

  const aspect = plan.widthM / plan.heightM
  const boxW = Math.max(0, Math.min(area.width, area.height * aspect, 950))
  const boxH = boxW / aspect
  const pxPerM = boxW / plan.widthM

  const setNum = (key: 'widthM' | 'heightM' | 'gridM' | 'rotation', raw: string, min: number, max: number) => {
    const v = Number(raw)
    if (Number.isFinite(v)) setPlan((p) => ({ ...p, [key]: Math.min(max, Math.max(min, v)) }))
  }

  const start = () => {
    updateWorkspace(workspace.id, { plan, elements, status: 'editing' })
    navigate(paths.layout(workspace.id))
  }

  const gridStep = plan.gridM * pxPerM

  return (
    <div className="page">
      <GlobalNav />
      <StageNav workspace={workspace} stage="layout" />
      <PageHeader title="도면 확인" subtitle={`${workspace.name}  |  도면의 크기와 방향을 확인하세요.`}>
        <Button variant="primary" className="plan__start" onClick={start}>
          배치 시작
        </Button>
      </PageHeader>

      <div className="plan">
        <section className="plan__props fs-card" aria-labelledby="plan-props-title">
          <h2 id="plan-props-title" className="fs-card__title">
            도면 설정
          </h2>
          <dl className="plan__rows">
            <div className="plan__row">
              <dt>파일</dt>
              <dd className="plan__file" title={plan.fileName}>
                {plan.fileName}
              </dd>
            </div>
            <NumberRow label="가로 길이" unit="m" value={plan.widthM} step={0.5} onChange={(v) => setNum('widthM', v, 5, 500)} />
            <NumberRow label="세로 길이" unit="m" value={plan.heightM} step={0.5} onChange={(v) => setNum('heightM', v, 5, 500)} />
            <NumberRow label="격자 간격" unit="m" value={plan.gridM} step={0.5} onChange={(v) => setNum('gridM', v, 0.5, 10)} />
            <NumberRow label="회전" unit="°" value={plan.rotation} step={90} onChange={(v) => setNum('rotation', v, -360, 360)} />
          </dl>
          <p className="plan__note">실측 길이를 기준으로 도면과 격자를 맞춥니다.</p>
          <p className="plan__hint">미리보기의 구역을 끌어 위치를 고칠 수 있습니다.</p>
        </section>

        <section className="plan__preview fs-card" aria-labelledby="plan-preview-title">
          <h2 id="plan-preview-title" className="plan__preview-title">
            도면 미리보기
          </h2>
          <div className="plan__area" ref={areaRef}>
            <div className="plan__frame" style={{ width: boxW, height: boxH }}>
              <span className="plan__dim plan__dim--w">{fmt(plan.widthM)} m</span>
              <span className="plan__dim plan__dim--h">{fmt(plan.heightM)} m</span>
              <div
                className="plan__geometry"
                style={{
                  transform: `rotate(${plan.rotation}deg)`,
                  backgroundSize: `${gridStep}px ${gridStep}px`,
                }}
                onPointerDown={(e) => e.target === e.currentTarget && setSelected(null)}
              >
                {plan.previewUrl && <img className="plan__image" src={plan.previewUrl} alt="업로드한 도면" />}
                {elements.map((el) => (
                  <div
                    key={el.id}
                    className={`plan__shape plan__shape--${el.type} ${selected === el.id ? 'is-selected' : ''}`}
                    style={{
                      left: el.x * pxPerM,
                      top: el.y * pxPerM,
                      width: el.w * pxPerM,
                      height: el.h * pxPerM,
                      transform: `rotate(${el.rotation}deg)`,
                    }}
                    title={el.label}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId)
                      setSelected(el.id)
                      drag.current = { id: el.id, x: e.clientX, y: e.clientY, ox: el.x, oy: el.y }
                    }}
                    onPointerMove={(e) => {
                      const d = drag.current
                      if (!d || d.id !== el.id) return
                      const nx = Math.round((d.ox + (e.clientX - d.x) / pxPerM) * 10) / 10
                      const ny = Math.round((d.oy + (e.clientY - d.y) / pxPerM) * 10) / 10
                      setElements((list) => list.map((it) => (it.id === el.id ? { ...it, x: nx, y: ny } : it)))
                    }}
                    onPointerUp={() => (drag.current = null)}
                  >
                    {selected === el.id && <span className="plan__shape-label">{el.label}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function NumberRow({
  label,
  unit,
  value,
  step,
  onChange,
}: {
  label: string
  unit: string
  value: number
  step: number
  onChange: (raw: string) => void
}) {
  return (
    <div className="plan__row">
      <dt>
        <label htmlFor={`plan-${label}`}>{label}</label>
      </dt>
      <dd>
        <input
          id={`plan-${label}`}
          className="plan__input"
          type="number"
          step={step}
          value={unit === 'm' ? fmt(value) : value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span>{unit}</span>
      </dd>
    </div>
  )
}
