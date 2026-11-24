import { useEffect, useState } from 'react'
import baselineScene from '../../assets/figma/scenes/baseline.png'
import optimalScene from '../../assets/figma/scenes/optimal.png'
import routeBaseline from '../../assets/figma/overlay/route-baseline.svg'
import routeOptimal from '../../assets/figma/overlay/route-optimal.svg'
import { GlobalNav } from '../../components/GlobalNav'
import { StageNav } from '../../components/StageNav'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/Button'
import { Menu } from '../../components/Menu'
import { Caret } from '../../components/Caret'
import { ExampleBadge } from '../../components/Modal'
import { SceneViewport } from '../../components/SceneViewport'
import { fetchOptimalPlan } from '../../api/forksight'
import { RISK_LABEL } from '../../data/labels'
import { navigate, paths } from '../../router'
import type { Metrics, OptimalPlan, RiskType, SimulationResult, Workspace } from '../../types'
import './analysis.css'

const pct = (before: number, after: number) => {
  const p = ((after - before) / before) * 100
  return `${p > 0 ? '+' : '−'}${Math.abs(p).toFixed(1)}%`
}

/** Figma "08 / 최적 운영안 · 결과 분석" · "08b / 최적안 · 경로 표시" */
export function OptimalPage({ workspace, result }: { workspace: Workspace; result: SimulationResult }) {
  const [plan, setPlan] = useState<OptimalPlan | null>(null)
  const [vehicle, setVehicle] = useState('F1')
  const [showRoute, setShowRoute] = useState(false)

  useEffect(() => {
    fetchOptimalPlan(result).then(setPlan)
  }, [result])

  const minutes = Math.round(result.durationSec / 60)
  const selected = plan?.vehicles.find((v) => v.id === vehicle)
  const routeVisible = showRoute && !!selected?.hasRoute

  return (
    <div className="page">
      <GlobalNav />
      <StageNav workspace={workspace} stage="optimal" />
      <PageHeader
        title="최적 운영안"
        subtitle={
          <>
            {`${workspace.name}  |  동일 조건 · ${minutes}분`}
            {(plan?.isExample ?? true) && <ExampleBadge />}
          </>
        }
      >
        <Button className="op__video" onClick={() => navigate(paths.simulation(workspace.id, 'optimal'))}>
          최적안 영상 보기
        </Button>
      </PageHeader>

      {!plan ? (
        <div className="fs-empty">최적 운영안을 불러오는 중…</div>
      ) : (
        <div className="op">
          <div className="op__top">
          <CompareCard title="기준안" scene={baselineScene} metrics={plan.baseline} route={routeVisible ? routeBaseline : null} />
          <CompareCard
            title="최적안"
            scene={optimalScene}
            metrics={plan.optimal}
            route={routeVisible ? routeOptimal : null}
            tools={
              <>
                <Menu
                  align="right"
                  value={vehicle}
                  items={plan.vehicles.map((v) => ({
                    value: v.id,
                    label: v.hasRoute ? v.label : `${v.label} (경로 데이터 없음)`,
                  }))}
                  onSelect={setVehicle}
                  trigger={({ toggle }) => (
                    <Button size="sm" className="op__vehicle" onClick={toggle} aria-label="경로를 볼 이동 주체">
                      {vehicle}
                      <Caret size={12} />
                    </Button>
                  )}
                />
                <Button
                  size="sm"
                  className={`op__route ${showRoute ? 'is-on' : ''}`}
                  aria-pressed={showRoute}
                  onClick={() => setShowRoute((s) => !s)}
                >
                  {showRoute ? '경로 숨기기' : '경로 표시'}
                </Button>
              </>
            }
            note={showRoute && !selected?.hasRoute ? `${vehicle} 경로는 예시 데이터에 없습니다.` : undefined}
          />
          </div>

          <div className="op__bottom">
          <section className="op__safety fs-card">
            <div className="op__cardhead">
              <h2 className="an__title">안전 변화</h2>
              <Legend />
            </div>
            <hr />
            <ul className="op__bars">
              {(Object.keys(plan.riskByType.baseline) as RiskType[]).map((t) => {
                const before = plan.riskByType.baseline[t]
                const after = plan.riskByType.optimal[t]
                const max = Math.max(1, ...Object.values(plan.riskByType.baseline))
                return (
                  <li key={t}>
                    <span>{RISK_LABEL[t]}</span>
                    <span className="op__pair op__pair--safety">
                      <span className="an__bar" style={{ width: `${(before / max) * 100}%` }} />
                      <span className="an__bar an__bar--accent" style={{ width: `${(after / max) * 100}%` }} />
                    </span>
                    <span>
                      {before} → {after}건
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="op__efficiency fs-card">
            <div className="op__cardhead">
              <h2 className="an__title">작업 효율</h2>
              <Legend />
            </div>
            <hr />
            <ul className="op__bars op__bars--eff">
              {(
                [
                  ['평균 작업 시간', 'avgTaskSec', '초'],
                  ['처리량', 'throughput', '건'],
                  ['평균 대기 시간', 'avgWaitSec', '초'],
                ] as [string, keyof Metrics, string][]
              ).map(([label, key, unit]) => {
                const before = plan.baseline[key]
                const after = plan.optimal[key]
                const max = Math.max(before, after)
                return (
                  <li key={key}>
                    <span>{label}</span>
                    <span className="op__pair">
                      <span className="an__bar" style={{ width: `${(before / max) * 100}%` }} />
                      <span className="an__bar an__bar--accent" style={{ width: `${(after / max) * 100}%` }} />
                    </span>
                    <span className="op__eff-values">
                      <span>
                        {before} → {after}
                        {unit}
                      </span>
                      <span className="op__delta">{pct(before, after)}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="op__changes fs-card">
            <h2 className="an__title">모델이 변경한 조건</h2>
            <hr />
            <dl>
              {plan.changes.map((c) => (
                <div key={c.label}>
                  <dt>{c.label}</dt>
                  <dd>{c.value}</dd>
                </div>
              ))}
            </dl>
            <p className="op__remaining">남은 위험&nbsp;&nbsp;·&nbsp;&nbsp;{plan.remainingRisk}</p>
          </section>
          </div>
        </div>
      )}
    </div>
  )
}

function Legend() {
  return (
    <p className="op__legend">
      <span>
        <i /> 기준안
      </span>
      <span>
        <i className="is-accent" /> 최적안
      </span>
    </p>
  )
}

function CompareCard({
  title,
  scene,
  metrics,
  route,
  tools,
  note,
}: {
  title: string
  scene: string
  metrics: Metrics
  route: string | null
  tools?: React.ReactNode
  note?: string
}) {
  return (
    <section className="op__card fs-card">
      <div className="op__card-head">
        <h2 className="an__title">{title}</h2>
        {tools && <div className="op__tools">{tools}</div>}
      </div>
      <div className="op__scene">
        <SceneViewport src={scene} imageWidth={1672} imageHeight={941} alt={`${title} 장면`} />
        {/* 지도와 같은 좌표계의 경로 오버레이 (Figma 5:344 / 5:348) */}
        {route && <img className="op__route-overlay" src={route} width={660} height={350} alt={`${title} 경로`} />}
        {note && <p className="op__note">{note}</p>}
      </div>
      <dl className="op__metrics">
        <div>
          <dt>위험 이벤트</dt>
          <dd>{metrics.riskEvents}건</dd>
        </div>
        <div>
          <dt>평균 작업</dt>
          <dd>{metrics.avgTaskSec}초</dd>
        </div>
        <div>
          <dt>처리량</dt>
          <dd>{metrics.throughput}건</dd>
        </div>
      </dl>
    </section>
  )
}
