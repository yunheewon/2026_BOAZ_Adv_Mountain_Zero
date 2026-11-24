import { useRef, useState } from 'react'
import warehouse from '../assets/figma/home-warehouse.png'
import uploadIcon from '../assets/figma/icons/action-upload.svg'
import templateIcon from '../assets/figma/icons/action-template.svg'
import emptyIcon from '../assets/figma/icons/action-empty.svg'
import { GlobalNav } from '../components/GlobalNav'
import { uploadFloorPlan } from '../api/forksight'
import { navigate, paths } from '../router'
import { useAppState } from '../state/AppState'
import './home.css'

/** Figma "01 / 홈 · 비로그인 시작" · "01b / 홈 · 로그인" */
export function HomePage() {
  const { createWorkspace } = useAppState()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const { plan, elements } = await uploadFloorPlan(file)
      const id = createWorkspace({
        name: file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' '),
        status: 'ready',
        plan,
        elements,
      })
      navigate(paths.plan(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '도면을 불러오지 못했습니다.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const startEmpty = () => {
    const id = createWorkspace({
      plan: { fileName: '없음', widthM: 60, heightM: 40, gridM: 1, rotation: 0 },
      elements: [],
    })
    navigate(paths.layout(id))
  }

  return (
    <div className="home">
      <GlobalNav active="home" flat />
      <main className="home__hero">
        <img className="home__illustration" src={warehouse} width={1140} height={760} alt="" />
        <div className="home__copy">
          <h1 className="home__title">
            작업장을 배치하고,
            <br />
            <span className="home__accent">위험 지점</span>을 확인하세요
          </h1>
          <p className="home__desc">
            도면을 불러오거나 직접 배치해 작업장을 구성합니다.
            <br />
            시뮬레이션으로 근접 위험과 운영 효율을 확인합니다.
          </p>
          <div className="home__actions">
            <button
              className="home__action home__action--primary"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <img src={uploadIcon} width={24} height={24} alt="" />
              <span>{uploading ? '불러오는 중…' : '도면 업로드'}</span>
            </button>
            <button className="home__action" onClick={() => navigate(paths.templates)}>
              <img src={templateIcon} width={24} height={24} alt="" />
              <span>템플릿 선택</span>
            </button>
            <button className="home__action" onClick={startEmpty}>
              <img src={emptyIcon} width={24} height={24} alt="" />
              <span>빈 작업장</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf,.dxf,.dwg"
              className="visually-hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </div>
          {error && <p className="home__error">{error}</p>}
          <a className="home__recent" href="#/workspaces">
            최근 작업장 <span aria-hidden>›</span>
          </a>
        </div>
      </main>
    </div>
  )
}
