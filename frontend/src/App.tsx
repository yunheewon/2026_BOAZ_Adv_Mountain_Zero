import { AppStateProvider, useAppState } from './state/AppState'
import { paths, useRoute } from './router'
import { GlobalNav } from './components/GlobalNav'
import { Button } from './components/Button'
import { HomePage } from './pages/HomePage'
import { WorkspacesPage } from './pages/WorkspacesPage'
import { LoginPage } from './pages/LoginPage'
import { TemplatesPage } from './pages/TemplatesPage'
import { PlanCheckPage } from './pages/PlanCheckPage'
import { LayoutPage } from './pages/layout/LayoutPage'
import { SimulationPage } from './pages/simulation/SimulationPage'
import { ResultPage } from './pages/analysis/ResultPage'
import { OptimalPage } from './pages/analysis/OptimalPage'
import { navigate } from './router'

/**
 * 화면 흐름 (Figma 00 / 개발 전달 가이드)
 * 홈 → 작업장 목록(로그인 시) / 도면 확인 또는 빈 작업장 → 배치 → 실행 설정 → 시뮬레이션 → 결과 분석 → 최적 운영안
 */
function Screens() {
  const { segments, query } = useRoute()
  const { getWorkspace } = useAppState()

  if (segments.length === 0) return <HomePage />
  if (segments[0] === 'workspaces') return <WorkspacesPage />
  if (segments[0] === 'login') return <LoginPage />
  if (segments[0] === 'templates') return <TemplatesPage />

  if (segments[0] === 'w' && segments[1]) {
    const ws = getWorkspace(segments[1])
    if (!ws) return <Missing message="작업장을 찾을 수 없습니다. 로그인하지 않았거나 이번 세션에서 만든 작업장이 아닐 수 있습니다." />
    const stage = segments[2] ?? 'layout'
    if (stage === 'plan') return <PlanCheckPage key={ws.id} workspace={ws} />
    if (stage === 'layout') return <LayoutPage key={ws.id} workspace={ws} />
    if (!ws.result) {
      return (
        <Missing
          message="아직 기준안 시뮬레이션을 실행하지 않았습니다. 배치 화면에서 시뮬레이션을 실행하세요."
          action={{ label: '배치로 이동', to: paths.layout(ws.id) }}
        />
      )
    }
    if (stage === 'simulation') {
      const variant = query.get('variant') === 'optimal' ? 'optimal' : 'baseline'
      return <SimulationPage key={`${ws.id}-${variant}`} workspace={ws} result={ws.result} variant={variant} />
    }
    if (stage === 'results') return <ResultPage key={ws.id} workspace={ws} result={ws.result} />
    if (stage === 'optimal') return <OptimalPage key={ws.id} workspace={ws} result={ws.result} />
  }

  return <Missing message="페이지를 찾을 수 없습니다." />
}

function Missing({ message, action = { label: '홈으로', to: paths.home } }: { message: string; action?: { label: string; to: string } }) {
  return (
    <div className="page">
      <GlobalNav />
      <div className="fs-empty">
        {message}
        <Button variant="primary" onClick={() => navigate(action.to)}>
          {action.label}
        </Button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppStateProvider>
      <Screens />
    </AppStateProvider>
  )
}
