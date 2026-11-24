import { useEffect, useMemo, useState } from 'react'
import baselineScene from '../../assets/figma/scenes/baseline.png'
import optimalScene from '../../assets/figma/scenes/optimal.png'
import { GlobalNav } from '../../components/GlobalNav'
import { StageNav } from '../../components/StageNav'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/Button'
import { Menu } from '../../components/Menu'
import { Caret } from '../../components/Caret'
import { ExampleBadge } from '../../components/Modal'
import { SceneAnchor, SceneViewport } from '../../components/SceneViewport'
import { DEFAULT_CAMERA, type Camera } from '../../components/camera'
import { RiskMarker } from '../../components/RiskMarker'
import { fetchOptimalPlan } from '../../api/forksight'
import { fmtClock, usePlayback } from '../../hooks/usePlayback'
import { navigate, paths } from '../../router'
import type { OptimalPlan, RiskEvent, RiskType, SimulationResult, Workspace } from '../../types'
import { PlaybackBar } from './PlaybackBar'
import { TrialWindow } from './TrialWindow'
import { RISK_LABEL } from '../../data/labels'
import './simulation.css'

type Filter = 'all' | RiskType
type View = 'overview' | 'cross' | 'dock'

const VIEWS: Record<View, { label: string; camera: Camera }> = {
  overview: { label: '전체 3D', camera: DEFAULT_CAMERA },
  cross: { label: '중앙 교차로', camera: { zoom: 2.2, fx: 0.507, fy: 0.472 } },
  dock: { label: '도크 구역', camera: { zoom: 2, fx: 0.16, fy: 0.48 } },
}

/** 위험 이벤트 마커가 보이는 시간 범위 (초) */
const MARKER_BEFORE = 2
const MARKER_AFTER = 15

/** Figma "06 / 기준안 시뮬레이션 · 위험 이벤트" (+ 07/07a 시험 창) */
export function SimulationPage({ workspace, result, variant }: { workspace: Workspace; result: SimulationResult; variant: 'baseline' | 'optimal' }) {
  const isOptimal = variant === 'optimal'
  const [optimal, setOptimal] = useState<OptimalPlan | null>(null)
  const events: RiskEvent[] = useMemo(
    () => (isOptimal ? (optimal?.events ?? []) : result.events),
    [isOptimal, optimal, result.events],
  )
  const playback = usePlayback(result.durationSec, isOptimal ? 0 : 134)
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(isOptimal ? null : 'E-02')
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA)
  const [view, setView] = useState<View>('overview')
  const [trialId, setTrialId] = useState<string | null>(null)

  useEffect(() => {
    if (isOptimal) fetchOptimalPlan(result).then(setOptimal)
  }, [isOptimal, result])

  const visibleEvents = useMemo(
    () => events.filter((e) => filter === 'all' || e.type === filter),
    [events, filter],
  )

  const jumpTo = (ev: RiskEvent) => {
    setSelectedId(ev.id)
    playback.pause()
    playback.seek(ev.timeSec)
    setCamera({ zoom: 1.8, fx: ev.pos.x, fy: ev.pos.y })
  }

  const markers = events.filter(
    (e) => e.id === selectedId || (playback.t >= e.timeSec - MARKER_BEFORE && playback.t <= e.timeSec + MARKER_AFTER),
  )
  const trialAction = result.actions.find((a) => a.id === trialId)
  const isExample = isOptimal ? (optimal?.isExample ?? true) : result.isExample

  return (
    <div className="page">
      <GlobalNav />
      <StageNav workspace={workspace} stage="simulation" />
      <PageHeader
        title="시뮬레이션"
        subtitle={
          <>
            {isOptimal ? '최적안' : '기준안'}
            {isExample && <ExampleBadge />}
          </>
        }
      >
        {isOptimal && <Button onClick={() => navigate(paths.simulation(workspace.id))}>기준안 보기</Button>}
      </PageHeader>

      <div className="sim">
        <div className="sim__stage">
          <SceneViewport
            className="sim__scene"
            src={isOptimal ? optimalScene : baselineScene}
            imageWidth={1672}
            imageHeight={941}
            alt={isOptimal ? '최적안 시뮬레이션 장면' : '기준안 시뮬레이션 장면'}
            camera={camera}
            onCameraChange={(c) => {
              setCamera(c)
              setView('overview')
            }}
          >
            {markers.map((ev) => (
              <SceneAnchor key={ev.id} x={ev.pos.x} y={ev.pos.y}>
                <RiskMarker id={ev.id} active={ev.id === selectedId} onClick={() => jumpTo(ev)} />
              </SceneAnchor>
            ))}
          </SceneViewport>

          <Menu<View>
            className="sim__view"
            value={view}
            items={(Object.keys(VIEWS) as View[]).map((v) => ({ value: v, label: VIEWS[v].label }))}
            onSelect={(v) => {
              setView(v)
              setCamera(VIEWS[v].camera)
            }}
            trigger={({ toggle }) => (
              <button className="sim__view-btn" onClick={toggle} aria-label="카메라 시점">
                {VIEWS[view].label}
                <Caret size={12} />
              </button>
            )}
          />
          <div className="sim__camera" aria-label="카메라">
            <button onClick={() => setCamera((c) => ({ ...c, zoom: Math.min(4, c.zoom * 1.25) }))} aria-label="확대">
              +
            </button>
            <button onClick={() => setCamera((c) => ({ ...c, zoom: Math.max(1, c.zoom / 1.25) }))} aria-label="축소">
              −
            </button>
            <button
              onClick={() => {
                setCamera(DEFAULT_CAMERA)
                setView('overview')
              }}
              aria-label="시점 초기화"
              title="시점 초기화 (더블클릭)"
            >
              ⤢
            </button>
          </div>

          <div className="sim__playback">
            <PlaybackBar
              t={playback.t}
              duration={result.durationSec}
              playing={playback.playing}
              speed={playback.speed}
              onToggle={playback.toggle}
              onSeek={playback.seek}
              onRestart={playback.restart}
              onSpeed={playback.setSpeed}
              events={events}
            />
          </div>

          {trialAction && (
            <TrialWindow
              key={trialAction.id}
              result={result}
              action={trialAction}
              onClose={() => setTrialId(null)}
            />
          )}
        </div>

        <aside className="sim__panel fs-card">
          <h2 className="fs-card__title">위험 이벤트</h2>
          <div className="sim__filters" role="tablist" aria-label="위험 유형">
            {(['all', 'near', 'contact', 'collision'] as Filter[]).map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                className={filter === f ? 'is-active' : ''}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? '전체' : RISK_LABEL[f]}
              </button>
            ))}
          </div>
          <ul className="sim__events">
            {visibleEvents.map((ev) => (
              <li key={ev.id}>
                <button
                  className={`sim__event ${ev.id === selectedId ? 'is-selected' : ''}`}
                  onClick={() => jumpTo(ev)}
                  title={`${fmtClock(ev.timeSec)}으로 이동`}
                >
                  <span className="sim__event-id">{ev.id}</span>
                  <span>{fmtClock(ev.timeSec)}</span>
                  <span>{RISK_LABEL[ev.type]}</span>
                  <span>{ev.location}</span>
                </button>
              </li>
            ))}
            {visibleEvents.length === 0 && <li className="sim__none">{isOptimal && !optimal ? '불러오는 중…' : '해당 유형의 이벤트가 없습니다.'}</li>}
          </ul>

          {isOptimal ? (
            <>
              <h2 className="fs-card__title sim__actions-title">모델이 변경한 조건</h2>
              <dl className="sim__changes">
                {optimal?.changes.map((c) => (
                  <div key={c.label}>
                    <dt>{c.label}</dt>
                    <dd>{c.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <>
              <h2 className="fs-card__title sim__actions-title">권장 조치</h2>
              <ul className="sim__actions">
                {result.actions.map((a) => (
                  <li key={a.id} className="sim__action">
                    <p className="sim__action-title">{a.title}</p>
                    <p className="sim__action-tag">{a.tag}</p>
                    <Button
                      size="sm"
                      className={`sim__try ${trialId === a.id ? 'is-on' : ''}`}
                      onClick={() => {
                        playback.pause()
                        setTrialId(a.id)
                      }}
                    >
                      시험
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
      <p className="sim__foot">선택한 위험 이벤트의 시간으로 이동해 장면을 확인할 수 있습니다.</p>
    </div>
  )
}
