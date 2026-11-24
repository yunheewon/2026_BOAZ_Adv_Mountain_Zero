import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Workspace } from '../types'
import { exampleSavedWorkspaces } from '../data/example'

interface AppStateValue {
  user: { name: string } | null
  /** 로그인 상태면 저장된 작업장 + 이번 세션 작업장, 아니면 세션 작업장만 */
  workspaces: Workspace[]
  getWorkspace: (id: string) => Workspace | undefined
  signIn: (name: string) => void
  signOut: () => void
  createWorkspace: (init: Partial<Workspace> & Pick<Workspace, 'plan' | 'elements'>) => string
  updateWorkspace: (id: string, patch: Partial<Workspace> | ((ws: Workspace) => Partial<Workspace>)) => void
}

const AppStateContext = createContext<AppStateValue | null>(null)

let wsSeq = 0
const nowLabel = () => {
  const d = new Date()
  return `오늘 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ name: string } | null>(null)
  // TODO(API): 로그인 후 GET /api/v1/workspaces 응답으로 채운다. 지금은 예시 계정 데이터.
  const [saved, setSaved] = useState<Workspace[]>(exampleSavedWorkspaces)
  const [session, setSession] = useState<Workspace[]>([])

  const all = useMemo(() => [...session, ...saved], [session, saved])
  const workspaces = useMemo(() => (user ? all : session), [user, all, session])

  const getWorkspace = useCallback((id: string) => all.find((w) => w.id === id), [all])

  const createWorkspace: AppStateValue['createWorkspace'] = useCallback(
    (init) => {
      const id = `ws-new-${Date.now().toString(36)}-${++wsSeq}`
      const count = session.length + 1
      const ws: Workspace = {
        id,
        name: init.name ?? `새 작업장 ${count}`,
        saved: !!user,
        status: init.status ?? 'editing',
        updatedLabel: nowLabel(),
        ...init,
      }
      setSession((prev) => [ws, ...prev])
      return id
    },
    [session.length, user],
  )

  const updateWorkspace: AppStateValue['updateWorkspace'] = useCallback((id, patch) => {
    const apply = (list: Workspace[]) =>
      list.map((w) => {
        if (w.id !== id) return w
        const p = typeof patch === 'function' ? patch(w) : patch
        return { ...w, ...p, updatedLabel: nowLabel() }
      })
    setSession(apply)
    setSaved(apply)
  }, [])

  const value: AppStateValue = {
    user,
    workspaces,
    getWorkspace,
    signIn: (name) => setUser({ name }),
    signOut: () => setUser(null),
    createWorkspace,
    updateWorkspace,
  }

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppState() {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider')
  return ctx
}
