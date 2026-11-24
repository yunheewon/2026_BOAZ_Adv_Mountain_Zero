import { useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { CATALOG_BY_TYPE, ROUTE_OPTIONS } from '../../data/catalog'
import type { LayoutElement } from '../../types'
import { normDeg, round1 } from './geometry'

interface PropertiesPopoverProps {
  el: LayoutElement
  /** 선택한 요소를 가리지 않도록 반대쪽 모서리에 붙는다 */
  side: 'left' | 'right'
  onChange: (patch: Partial<LayoutElement>) => void
  onDelete: () => void
  onClose: () => void
}

const round2 = (v: number) => Math.round(v * 100) / 100

/** Figma "Selected object properties" — 캔버스 위 모서리에 뜨는 작은 속성 창 (306px) */
export function PropertiesPopover({ el, side, onChange, onDelete, onClose }: PropertiesPopoverProps) {
  const item = CATALOG_BY_TYPE[el.type]

  return (
    <div
      className={`props props--${side}`}
      onPointerDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={`${el.label} 속성`}
    >
      <input
        className="props__title"
        value={el.label}
        onChange={(e) => onChange({ label: e.target.value })}
        aria-label="이름"
      />
      {!el.label.includes(item.label) && <p className="props__kind">{item.label}</p>}
      <div className="props__rows">
        {/* 위치는 요소 중심 기준. 입력한 중심값이 그대로 보이도록 좌상단은 반올림하지 않는다 */}
        <NumField label="위치 X" unit="m" value={el.x + el.w / 2} step={0.5} onCommit={(v) => onChange({ x: round2(v - el.w / 2) })} />
        <NumField label="위치 Y" unit="m" value={el.y + el.h / 2} step={0.5} onCommit={(v) => onChange({ y: round2(v - el.h / 2) })} />
        <NumField label="방향" unit="°" value={el.rotation} step={15} digits={0} onCommit={(v) => onChange({ rotation: normDeg(v) })} />
        <NumField
          label="너비 × 길이"
          unit="m"
          value={el.w}
          step={0.5}
          onCommit={(v) => onChange({ w: Math.max(0.3, round1(v)) })}
          second={{ value: el.h, onCommit: (v) => onChange({ h: Math.max(0.3, round1(v)) }) }}
        />
        {item.vehicle && (
          <>
            <NumField
              label="최대 속도"
              unit="km/h"
              value={el.maxSpeedKmh ?? 8}
              step={1}
              digits={0}
              onCommit={(v) => onChange({ maxSpeedKmh: Math.min(25, Math.max(1, Math.round(v))) })}
            />
            <div className="props__row">
              <label htmlFor="props-route">이동 경로</label>
              <select id="props-route" className="props__input props__select" value={el.route ?? '경로 A'} onChange={(e) => onChange({ route: e.target.value })}>
                {ROUTE_OPTIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
          </>
        )}
        {el.type === 'speedLimit' && (
          <NumField
            label="제한 속도"
            unit="km/h"
            value={el.limitKmh ?? 10}
            step={5}
            digits={0}
            onCommit={(v) => onChange({ limitKmh: Math.max(5, Math.round(v)) })}
          />
        )}
      </div>
      <div className="props__actions">
        <Button size="sm" className="props__delete" onClick={onDelete}>
          삭제
        </Button>
        <Button variant="primary" className="props__done" onClick={onClose}>
          완료
        </Button>
      </div>
    </div>
  )
}

function NumField({
  label,
  unit,
  value,
  step,
  digits = 1,
  onCommit,
  second,
}: {
  label: string
  unit: string
  value: number
  step: number
  digits?: number
  onCommit: (v: number) => void
  second?: { value: number; onCommit: (v: number) => void }
}) {
  const id = `props-${label}`
  return (
    <div className="props__row">
      <label htmlFor={id}>{label}</label>
      <span className="props__value">
        <DraftInput id={id} value={value} step={step} digits={digits} onCommit={onCommit} />
        {second && (
          <>
            <span className="props__times">×</span>
            <DraftInput value={second.value} step={step} digits={digits} onCommit={second.onCommit} aria-label={`${label} 두 번째 값`} />
          </>
        )}
        <span className="props__unit">{unit}</span>
      </span>
    </div>
  )
}

/** 입력 중에는 초안을 두고, Enter·포커스 이동 시 반영 (드래그로 값이 바뀌면 따라감) */
function DraftInput({
  value,
  step,
  digits,
  onCommit,
  ...rest
}: {
  value: number
  step: number
  digits: number
  onCommit: (v: number) => void
  id?: string
  'aria-label'?: string
}) {
  const shown = value.toFixed(digits)
  const [draft, setDraft] = useState(shown)
  const [editing, setEditing] = useState(false)

  const cancelled = useRef(false)
  const commit = () => {
    const v = Number(draft)
    if (!cancelled.current && Number.isFinite(v)) onCommit(v)
    cancelled.current = false
    setEditing(false)
  }

  return (
    <input
      {...rest}
      className="props__input"
      type="number"
      step={step}
      value={editing ? draft : shown}
      onFocus={() => {
        setDraft(shown)
        setEditing(true)
      }}
      onChange={(e) => {
        setDraft(e.target.value)
        // 스핀 버튼은 바로 반영
        const native = e.nativeEvent as InputEvent
        if (!native.inputType) {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) onCommit(v)
        }
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          cancelled.current = true
          ;(e.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}
