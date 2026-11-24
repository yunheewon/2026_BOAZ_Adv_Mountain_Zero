import { useRef, useState } from 'react'
import baselineScene from '../../assets/figma/scenes/baseline.png'
import optimalScene from '../../assets/figma/scenes/optimal.png'
import { Button } from '../../components/Button'
import { ExampleBadge } from '../../components/Modal'
import { SceneViewport } from '../../components/SceneViewport'
import { runTrial } from '../../api/forksight'
import { usePlayback } from '../../hooks/usePlayback'
import type { RecommendedAction, SimulationResult, TrialResult } from '../../types'
import { PlaybackBar } from './PlaybackBar'

const arrow = (a: number, b: number, unit: string) => `${a} → ${b}${unit}`

/**
 * Figma "07a / 권장 조치 · 실행 전" · "07 / 권장 조치 시험 · 플로팅 창"
 * 페이지 이동 없이 기준안 위에 뜨는 창. 닫으면 기준안은 그대로 유지된다.
 */
export function TrialWindow({
  result,
  action,
  onClose,
}: {
  result: SimulationResult
  action: RecommendedAction
  onClose: () => void
}) {
  const [value, setValue] = useState(action.param.value)
  const [editing, setEditing] = useState(false)
  const [state, setState] = useState<'setup' | 'running' | 'done'>('setup')
  const [trial, setTrial] = useState<TrialResult | null>(null)
  const [pos, setPos] = useState({ x: 333, y: 13 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const playback = usePlayback(result.durationSec, 134)

  // 속도 조절은 배치가 같으므로 기준 장면, 설치형 조치는 설치된 장면을 보여 준다
  const scene = action.id === 'A-speed' ? baselineScene : optimalScene

  const run = async () => {
    setState('running')
    playback.pause()
    const r = await runTrial(result, action.id, value)
    setTrial(r)
    setState('done')
  }

  return (
    <section
      className="trial"
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
      aria-labelledby="trial-title"
    >
      <header
        className="trial__head"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (d) setPos({ x: d.ox + e.clientX - d.x, y: Math.max(-180, d.oy + e.clientY - d.y) })
        }}
        onPointerUp={() => (drag.current = null)}
        title="끌어서 옮길 수 있습니다"
      >
        <h2 id="trial-title" className="trial__title">
          {action.title}
        </h2>
        <button className="trial__close" onClick={onClose}>
          닫기&nbsp;&nbsp;×
        </button>
      </header>
      <p className="trial__sub">
        시험 설정 <ExampleBadge />
      </p>
      <hr className="trial__sep" />

      <div className="trial__scene">
        <SceneViewport src={scene} imageWidth={1671} imageHeight={941} alt="시험 배치 장면" />
        {state === 'done' && (
          <div className="trial__playback">
            <PlaybackBar
              compact
              t={playback.t}
              duration={result.durationSec}
              playing={playback.playing}
              speed={playback.speed}
              onToggle={playback.toggle}
              onSeek={playback.seek}
              onRestart={playback.restart}
              onSpeed={playback.setSpeed}
            />
          </div>
        )}
      </div>

      <div className="trial__param">
        <span className="trial__desc">{action.describe(value)}</span>
        <Button size="sm" className={`trial__edit ${editing ? 'is-on' : ''}`} onClick={() => setEditing((v) => !v)}>
          {editing ? '수정 완료' : '배치 수정'}
        </Button>
      </div>
      {editing && (
        <label className="trial__slider">
          <span>{action.param.label}</span>
          <input
            type="range"
            min={action.param.min}
            max={action.param.max}
            step={action.param.step}
            value={value}
            onChange={(e) => {
              setValue(Number(e.target.value))
              if (state === 'done') setState('setup')
            }}
          />
          <b>
            {value} {action.param.unit}
          </b>
        </label>
      )}
      <hr className="trial__sep trial__sep--lower" />

      {state === 'done' && trial ? (
        <dl className="trial__metrics">
          <div>
            <dt>위험 이벤트</dt>
            <dd>{arrow(trial.riskEvents[0], trial.riskEvents[1], '건')}</dd>
          </div>
          <div>
            <dt>평균 작업</dt>
            <dd>{arrow(trial.avgTaskSec[0], trial.avgTaskSec[1], '초')}</dd>
          </div>
          <div>
            <dt>처리량</dt>
            <dd>{arrow(trial.throughput[0], trial.throughput[1], '건')}</dd>
          </div>
        </dl>
      ) : (
        <p className="trial__hint">
          {state === 'running' ? '시험 시뮬레이션을 실행하고 있습니다…' : `${action.tag} 설정을 확인한 뒤 시험을 실행하세요.`}
        </p>
      )}

      <div className="trial__actions">
        <Button variant="primary" size="lg" className="trial__run" onClick={run} disabled={state === 'running'}>
          {state === 'running' ? '시험 실행 중…' : state === 'done' ? '시험 다시 실행' : '시험 시뮬레이션 실행'}
        </Button>
      </div>
    </section>
  )
}
