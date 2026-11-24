import { useMemo, useState } from 'react'
import { GlobalNav } from '../components/GlobalNav'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/Button'
import { Menu } from '../components/Menu'
import { Modal } from '../components/Modal'
import { Caret } from '../components/Caret'
import { exampleSavedWorkspaces } from '../data/example'
import { navigate, paths } from '../router'
import { useAppState } from '../state/AppState'
import type { Workspace, WorkspaceStatus } from '../types'
import './pages.css'

const STATUS_LABEL: Record<WorkspaceStatus, string> = { done: '배치 완료', editing: '편집 중', ready: '준비 중' }
const SUMMARY: Record<WorkspaceStatus, string> = {
  done: '기준안 실행 완료 · 최적안 확인 가능',
  editing: '레이아웃 배치 진행 중',
  ready: '도면 확인 완료',
}

type StatusFilter = 'all' | WorkspaceStatus
type Sort = 'recent' | 'name'

function openPath(ws: Workspace) {
  if (ws.result) return paths.results(ws.id)
  if (ws.status === 'ready') return paths.plan(ws.id)
  return paths.layout(ws.id)
}

/** Figma "02 / 작업장 목록 · 로그인" · "02b / 작업장 목록 · 비로그인" */
export function WorkspacesPage() {
  const { user, workspaces, createWorkspace } = useAppState()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<Sort>('recent')

  // 비로그인: 목록은 흐리게 자리만 보여 주고 로그인 안내를 띄운다 (Figma 02b)
  const placeholder = useMemo(() => exampleSavedWorkspaces(), [])
  const source = user ? workspaces : placeholder

  const list = useMemo(() => {
    const q = query.trim()
    const filtered = source.filter((w) => (status === 'all' || w.status === status) && (!q || w.name.includes(q)))
    return sort === 'name' ? [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'ko')) : filtered
  }, [source, query, status, sort])

  const newWorkspace = () => {
    const id = createWorkspace({ plan: { fileName: '없음', widthM: 60, heightM: 40, gridM: 1, rotation: 0 }, elements: [] })
    navigate(paths.layout(id))
  }

  const sessionWorkspace = workspaces[0]

  return (
    <div className="page">
      <GlobalNav active="workspaces" />
      <div className={`wslist ${user ? '' : 'is-locked'}`} inert={!user}>
        <PageHeader
          title="작업장 목록"
          subtitle={user ? '저장된 작업을 이어서 진행하거나 새 작업장을 만들 수 있습니다.' : '저장된 작업장 목록은 로그인 후 확인할 수 있습니다.'}
        >
          <Button variant="primary" className="wslist__new" onClick={newWorkspace}>
            새 작업장
          </Button>
        </PageHeader>

        <div className="wslist__toolbar fs-card">
          <input
            className="wslist__search"
            placeholder="작업장 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="작업장 검색"
          />
          <Menu<StatusFilter>
            className="wslist__filter"
            value={status}
            onSelect={setStatus}
            items={[
              { value: 'all', label: '전체 상태' },
              { value: 'done', label: '배치 완료' },
              { value: 'editing', label: '편집 중' },
              { value: 'ready', label: '준비 중' },
            ]}
            trigger={({ toggle }) => (
              <button className="wslist__select" onClick={toggle}>
                {status === 'all' ? '전체 상태' : STATUS_LABEL[status]} <Caret size={12} />
              </button>
            )}
          />
          <Menu<Sort>
            className="wslist__sort"
            value={sort}
            onSelect={setSort}
            items={[
              { value: 'recent', label: '최근 수정순' },
              { value: 'name', label: '이름순' },
            ]}
            trigger={({ toggle }) => (
              <button className="wslist__select" onClick={toggle}>
                {sort === 'recent' ? '최근 수정순' : '이름순'} <Caret size={12} />
              </button>
            )}
          />
        </div>

        {list.length === 0 ? (
          <div className="fs-empty">
            {source.length === 0 ? '저장된 작업장이 없습니다.' : '조건에 맞는 작업장이 없습니다.'}
            <Button onClick={newWorkspace}>새 작업장 만들기</Button>
          </div>
        ) : (
          <ul className="wslist__cards">
            {list.map((ws) => (
              <li key={ws.id} className="wscard fs-card">
                <div className="wscard__main">
                  <h2 className="wscard__name">{ws.name}</h2>
                  <p className="wscard__summary">{SUMMARY[ws.status]}</p>
                </div>
                <p className="wscard__updated">마지막 수정 &nbsp;{ws.updatedLabel}</p>
                <p className="wscard__status">{STATUS_LABEL[ws.status]}</p>
                <Button className="wscard__open" onClick={() => navigate(openPath(ws))}>
                  작업 열기
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!user && (
        <Modal labelledBy="login-required-title" className="login-required">
          <h2 id="login-required-title" className="login-required__title">
            작업 내역을 확인하려면 로그인하세요
          </h2>
          <p className="login-required__body">로그인하면 저장한 배치와 시뮬레이션 결과를 이어서 볼 수 있습니다.</p>
          <p className="login-required__body">로그인 없이 시작한 작업도 현재 화면에서 계속할 수 있습니다.</p>
          <div className="login-required__actions">
            {sessionWorkspace && (
              <Button onClick={() => navigate(openPath(sessionWorkspace))}>진행 중인 작업 계속</Button>
            )}
            <Button variant="primary" size="lg" className="login-required__login" onClick={() => navigate(paths.login(paths.workspaces))}>
              로그인
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
