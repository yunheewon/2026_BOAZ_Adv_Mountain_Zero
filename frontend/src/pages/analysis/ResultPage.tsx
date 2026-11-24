import { useState } from 'react'
import baselineScene from '../../assets/figma/scenes/baseline.png'
import { GlobalNav } from '../../components/GlobalNav'
import { StageNav } from '../../components/StageNav'
import { PageHeader } from '../../components/PageHeader'
import { ExampleBadge } from '../../components/Modal'
import { SceneAnchor, SceneViewport } from '../../components/SceneViewport'
import { RiskMarker } from '../../components/RiskMarker'
import { RISK_LABEL } from '../../data/labels'
import { fmtClock } from '../../hooks/usePlayback'
import { navigate, paths } from '../../router'
import type { RiskType, SimulationResult, Workspace } from '../../types'
import './analysis.css'

/** Figma "07c / 결과 분석 · 기준안" */
export function ResultPage({ workspace, result }: { workspace: Workspace; result: SimulationResult }) {
  const [focus, setFocus] = useState<string | null>(null)
  const minutes = Math.round(result.durationSec / 60)
  const types = Object.keys(result.riskByType) as RiskType[]
  const maxType = Math.max(1, ...types.map((t) => result.riskByType[t]))
  const maxBin = Math.max(1, ...result.timeBins)
  const binSec = result.durationSec / result.timeBins.length

  return (
    <div className="page">
      <GlobalNav />
      <StageNav workspace={workspace} stage="results" />
      <PageHeader
        title="결과 분석"
        subtitle={
          <>
            {`${workspace.name}  |  기준안 · ${minutes}분`}
            {result.isExample && <ExampleBadge />}
          </>
        }
      >
        <button className="an__link-btn" onClick={() => navigate(paths.optimal(workspace.id))}>
          최적 운영안 보기
        </button>
      </PageHeader>

      <div className="an">
        <section className="an__map fs-card">
          <h2 className="an__title">위험 발생 위치</h2>
          <SceneViewport className="an__scene" src={baselineScene} imageWidth={1672} imageHeight={941} alt="기준안 위험 발생 위치">
            {result.events.map((ev) => (
              <SceneAnchor key={ev.id} x={ev.pos.x} y={ev.pos.y}>
                <RiskMarker
                  id={ev.id}
                  size="sm"
                  active={focus === ev.id}
                  onClick={() => setFocus((f) => (f === ev.id ? null : ev.id))}
                />
              </SceneAnchor>
            ))}
          </SceneViewport>
          {focus && (
            <p className="an__focus">
              {(() => {
                const ev = result.events.find((e) => e.id === focus)!
                return `${ev.id} · ${fmtClock(ev.timeSec)} · ${RISK_LABEL[ev.type]} · ${ev.location}`
              })()}
              <button onClick={() => navigate(paths.simulation(workspace.id))}>시뮬레이션에서 보기 ›</button>
            </p>
          )}
        </section>

        <section className="an__summary fs-card">
          <h2 className="an__title">실행 요약</h2>
          <dl className="an__rows">
            <div>
              <dt>위험 이벤트</dt>
              <dd>{result.metrics.riskEvents}건</dd>
            </div>
            <div>
              <dt>평균 작업 시간</dt>
              <dd>{result.metrics.avgTaskSec}초</dd>
            </div>
            <div>
              <dt>처리량</dt>
              <dd>
                {result.metrics.throughput}건 / {minutes}분
              </dd>
            </div>
          </dl>
        </section>

        <section className="an__hotspots fs-card">
          <h2 className="an__title">위험 집중 구역</h2>
          <ul>
            {result.hotspots.map((h) => (
              <li key={h.label}>
                <button
                  className={h.eventId && focus === h.eventId ? 'is-active' : ''}
                  onClick={() => h.eventId && setFocus((f) => (f === h.eventId ? null : h.eventId!))}
                  onMouseEnter={() => h.eventId && setFocus(h.eventId)}
                  disabled={!h.eventId}
                >
                  <span>{h.label}</span>
                  <span>{h.count}건</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="an__types fs-card">
          <h2 className="an__title">위험 유형과 발생 시간</h2>
          <div className="an__types-body">
            <ul className="an__typebars">
              {types.map((t) => {
                const n = result.riskByType[t]
                return (
                  <li key={t}>
                    <span>{RISK_LABEL[t]}</span>
                    <span className="an__bar-slot">
                      <span
                        className={`an__bar ${n === maxType ? 'an__bar--accent' : ''}`}
                        style={{ width: `${(n / maxType) * 100}%` }}
                      />
                    </span>
                    <span>{n}건</span>
                  </li>
                )
              })}
            </ul>
            <div className="an__hist">
              <p className="an__hist-title">시간별 위험 이벤트</p>
              <div className="an__hist-bars">
                {result.timeBins.map((v, i) => (
                  <div
                    key={i}
                    className="an__hist-col"
                    title={`${fmtClock(i * binSec)}–${fmtClock((i + 1) * binSec)} · ${v}건`}
                  >
                    <span className={`an__hist-count ${v === 0 ? 'is-zero' : ''}`}>{v}</span>
                    <span className="an__hist-bar" style={{ height: `${(v / maxBin) * 62}px` }} />
                  </div>
                ))}
              </div>
              <div className="an__hist-axis">
                {Array.from({ length: result.timeBins.length + 1 }, (_, i) => {
                  const min = Math.round((i * binSec) / 60)
                  return <span key={i}>{i === 0 || i === result.timeBins.length ? `${min}분` : min}</span>
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
