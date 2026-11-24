import { GlobalNav } from '../components/GlobalNav'
import { PageHeader } from '../components/PageHeader'
import { MiniLayout } from '../components/MiniLayout'
import { TEMPLATES } from '../data/example'
import { navigate, paths } from '../router'
import { useAppState } from '../state/AppState'
import './pages.css'

/** Figma 에 별도 디자인 없음 — 작업장 목록 카드 스타일을 따른 템플릿 선택 화면 */
export function TemplatesPage() {
  const { createWorkspace } = useAppState()

  const choose = (templateId: string) => {
    const tpl = TEMPLATES.find((t) => t.id === templateId)
    if (!tpl) return
    const id = createWorkspace({
      name: tpl.name,
      plan: { fileName: '템플릿', widthM: 60, heightM: 40, gridM: 1, rotation: 0 },
      elements: tpl.build(),
    })
    navigate(paths.layout(id))
  }

  return (
    <div className="page">
      <GlobalNav />
      <PageHeader title="템플릿 선택" subtitle="템플릿으로 배치를 시작합니다. 선택한 뒤 자유롭게 수정할 수 있습니다." />
      <ul className="templates">
        {TEMPLATES.map((t) => (
          <li key={t.id}>
            <button className="template fs-card" onClick={() => choose(t.id)}>
              <MiniLayout elements={t.build()} widthM={60} heightM={40} />
              <span className="template__name">{t.name}</span>
              <span className="template__desc">{t.description}</span>
              <span className="template__size">{t.size}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
