import { useState, type FormEvent } from 'react'
import { GlobalNav } from '../components/GlobalNav'
import { Button } from '../components/Button'
import { login } from '../api/forksight'
import { navigate, paths, useRoute } from '../router'
import { useAppState } from '../state/AppState'
import './pages.css'

/** Figma 에 별도 디자인 없음 — 로그인 안내 다이얼로그와 같은 카드 스타일로 구성 */
export function LoginPage() {
  const { signIn } = useAppState()
  const { query } = useRoute()
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { name } = await login(id, pw)
    signIn(name)
    navigate(query.get('next') || paths.workspaces, { replace: true })
  }

  return (
    <div className="page">
      <GlobalNav />
      <main className="login">
        <form className="login__card fs-card" onSubmit={submit}>
          <h1 className="login__title">로그인</h1>
          <p className="login__lead">저장한 배치와 시뮬레이션 결과를 이어서 볼 수 있습니다.</p>
          <label className="login__field">
            <span>아이디</span>
            <input value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" placeholder="운영자" />
          </label>
          <label className="login__field">
            <span>비밀번호</span>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
          </label>
          <Button variant="primary" size="lg" type="submit" disabled={busy} className="login__submit">
            {busy ? '로그인 중…' : '로그인'}
          </Button>
        </form>
      </main>
    </div>
  )
}
