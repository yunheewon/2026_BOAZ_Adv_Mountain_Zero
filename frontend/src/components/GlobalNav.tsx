import { useState } from 'react'
import logo from '../assets/figma/icons/logo.svg'
import homeIcon from '../assets/figma/icons/nav-home.svg'
import listIcon from '../assets/figma/icons/nav-list.svg'
import helpIcon from '../assets/figma/icons/nav-help.svg'
import userIcon from '../assets/figma/icons/nav-user.svg'
import { navigate, paths, useRoute } from '../router'
import { useAppState } from '../state/AppState'
import { Menu } from './Menu'
import { Caret } from './Caret'
import { Modal } from './Modal'
import { Button } from './Button'
import './components.css'

/** Figma "Component / Global Navigation" — 64px 공통 상단 메뉴 */
export function GlobalNav({ active, flat = false }: { active?: 'home' | 'workspaces'; flat?: boolean }) {
  const { user, signOut } = useAppState()
  const route = useRoute()
  const [helpOpen, setHelpOpen] = useState(false)

  return (
    <header className={`fs-topbar ${flat ? 'fs-topbar--flat' : ''}`}>
      <a className="fs-topbar__brand" href="#/" aria-label="FORKSIGHT 홈">
        <img src={logo} width={32} height={32} alt="" />
        <span>FORKSIGHT</span>
      </a>
      <span className="fs-topbar__divider" aria-hidden />
      <nav className="fs-topbar__nav" aria-label="주 메뉴">
        <a href="#/" className={`fs-topbar__link fs-topbar__link--home ${active === 'home' ? 'is-active' : ''}`}>
          <img src={homeIcon} width={20} height={20} alt="" />
          <span>홈</span>
        </a>
        <a
          href="#/workspaces"
          className={`fs-topbar__link fs-topbar__link--list ${active === 'workspaces' ? 'is-active' : ''}`}
        >
          <img src={listIcon} width={20} height={20} alt="" />
          <span>작업장 목록</span>
        </a>
      </nav>
      <div className="fs-topbar__right">
        <button className="fs-topbar__util" onClick={() => setHelpOpen(true)}>
          <img src={helpIcon} width={20} height={20} alt="" />
          <span>도움말</span>
        </button>
        <span className="fs-topbar__divider fs-topbar__divider--right" aria-hidden />
        <Menu
          align="right"
          items={user ? [{ value: 'logout', label: '로그아웃' }] : [{ value: 'login', label: '로그인' }]}
          onSelect={(v) => {
            if (v === 'logout') {
              signOut()
              navigate(paths.home)
            } else {
              navigate(paths.login(route.path))
            }
          }}
          footer={<span className="fs-menu__note">{user ? `${user.name} 계정으로 로그인됨` : '로그인하지 않음'}</span>}
          trigger={({ toggle, open }) => (
            <button className="fs-topbar__util fs-topbar__user" onClick={toggle} aria-expanded={open}>
              <img src={userIcon} width={20} height={20} alt="" />
              <span>{user?.name ?? '운영자'}</span>
              <span className="fs-topbar__caret">
                <Caret size={14} />
              </span>
            </button>
          )}
        />
      </div>
      {helpOpen && (
        <Modal labelledBy="help-title" onClose={() => setHelpOpen(false)} className="fs-help">
          <h2 id="help-title" className="fs-dialog-title">
            도움말
          </h2>
          <ol className="fs-help__list">
            <li>홈에서 도면을 올리거나, 템플릿·빈 작업장으로 시작합니다.</li>
            <li>배치 화면에서 요소를 끌어 놓고, 선택해 크기·회전·속성을 바꿉니다. (R 회전 · Delete 삭제 · Ctrl+Z 실행 취소)</li>
            <li>시뮬레이션 실행으로 기준안을 돌리고, 위험 이벤트를 눌러 해당 시간으로 이동합니다.</li>
            <li>권장 조치의 ‘시험’은 기준안을 바꾸지 않고 플로팅 창에서 따로 실행합니다.</li>
            <li>결과 분석과 최적 운영안에서 기준안과 비교합니다.</li>
          </ol>
          <div className="fs-dialog-actions">
            <Button variant="primary" onClick={() => setHelpOpen(false)}>
              확인
            </Button>
          </div>
        </Modal>
      )}
    </header>
  )
}
