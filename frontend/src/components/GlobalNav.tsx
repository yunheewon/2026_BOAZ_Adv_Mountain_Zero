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

const HELP_KEYS: [string, string][] = [
  ['R', '90° 회전'],
  ['Delete', '삭제'],
  ['Ctrl + Z', '실행 취소'],
  ['방향키', '0.1 m 이동 (Shift: 1 m)'],
  ['Esc', '선택 해제'],
]

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
          <p className="fs-help__group">배치 단축키</p>
          <dl className="fs-help__keys">
            {HELP_KEYS.map(([key, desc]) => (
              <div key={key}>
                <dt>
                  <kbd>{key}</kbd>
                </dt>
                <dd>{desc}</dd>
              </div>
            ))}
          </dl>
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
