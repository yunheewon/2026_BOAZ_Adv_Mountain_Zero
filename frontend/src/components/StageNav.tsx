import chevron from '../assets/figma/icons/chevron-down.svg'
import { navigate, paths } from '../router'
import { useAppState } from '../state/AppState'
import type { Workspace } from '../types'
import { Menu } from './Menu'
import './components.css'

export type Stage = 'layout' | 'simulation' | 'results' | 'optimal'

const STAGES: { id: Stage; label: string; to: (id: string) => string; needsResult: boolean }[] = [
  { id: 'layout', label: '배치', to: paths.layout, needsResult: false },
  { id: 'simulation', label: '시뮬레이션', to: (id) => paths.simulation(id), needsResult: true },
  { id: 'results', label: '결과 분석', to: paths.results, needsResult: true },
  { id: 'optimal', label: '최적 운영안', to: paths.optimal, needsResult: true },
]

/** Figma "Navigation / worksite stages" — 60px 작업 맥락 메뉴 */
export function StageNav({ workspace, stage, inset = false }: { workspace: Workspace; stage: Stage; inset?: boolean }) {
  const { workspaces } = useAppState()
  const choices = workspaces.some((w) => w.id === workspace.id) ? workspaces : [workspace, ...workspaces]

  return (
    <div className={`fs-stagebar ${inset ? 'fs-stagebar--inset' : ''}`}>
      <Menu
        className="fs-stagebar__selector-wrap"
        items={choices.map((w) => ({ value: w.id, label: w.name }))}
        value={workspace.id}
        onSelect={(id) => {
          const target = choices.find((w) => w.id === id)
          if (!target) return
          const keep = STAGES.find((s) => s.id === stage)
          navigate(keep && (!keep.needsResult || target.result) ? keep.to(id) : paths.layout(id))
        }}
        footer={
          <a className="fs-menu__link" href="#/workspaces">
            작업장 목록 보기
          </a>
        }
        trigger={({ toggle, open }) => (
          <button className="fs-stagebar__selector" onClick={toggle} aria-expanded={open} aria-label="작업장 선택">
            <span>{workspace.name}</span>
            <img src={chevron} width={16} height={16} alt="" />
          </button>
        )}
      />
      <span className="fs-stagebar__divider" aria-hidden />
      <nav className="fs-stagebar__stages" aria-label="작업 단계">
        {STAGES.map((s) => {
          const disabled = s.needsResult && !workspace.result
          return (
            <button
              key={s.id}
              className={`fs-stagebar__stage fs-stagebar__stage--${s.id} ${s.id === stage ? 'is-active' : ''}`}
              aria-current={s.id === stage ? 'page' : undefined}
              disabled={disabled}
              title={disabled ? '배치 화면에서 시뮬레이션을 먼저 실행하세요' : undefined}
              onClick={() => navigate(s.to(workspace.id))}
            >
              {s.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
