import { useSyncExternalStore } from 'react'

/**
 * 해시 기반 라우터 (#/workspaces 등). 의존성 없이 뒤로 가기·새로고침·링크 공유가 동작한다.
 * 라우트가 많아지면 react-router 로 교체해도 화면 컴포넌트는 navigate()/useRoute() 만 쓰면 된다.
 */
function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

const getHash = () => window.location.hash || '#/'

export interface Route {
  path: string
  segments: string[]
  query: URLSearchParams
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/'
  const [path, search = ''] = raw.split('?')
  return { path, segments: path.split('/').filter(Boolean), query: new URLSearchParams(search) }
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash)
  return parseHash(hash)
}

export function navigate(to: string, options: { replace?: boolean } = {}) {
  const hash = to.startsWith('#') ? to : `#${to}`
  if (options.replace) {
    window.location.replace(hash)
  } else {
    window.location.hash = hash
  }
  window.scrollTo(0, 0)
}

export const paths = {
  home: '/',
  workspaces: '/workspaces',
  login: (next?: string) => (next ? `/login?next=${encodeURIComponent(next)}` : '/login'),
  templates: '/templates',
  plan: (id: string) => `/w/${id}/plan`,
  layout: (id: string) => `/w/${id}/layout`,
  simulation: (id: string, variant?: 'optimal') => `/w/${id}/simulation${variant ? `?variant=${variant}` : ''}`,
  results: (id: string) => `/w/${id}/results`,
  optimal: (id: string) => `/w/${id}/optimal`,
}
