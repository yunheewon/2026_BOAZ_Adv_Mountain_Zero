import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { GlobalNav } from '../../components/GlobalNav'
import { StageNav } from '../../components/StageNav'
import { Button } from '../../components/Button'
import { Menu } from '../../components/Menu'
import { Caret } from '../../components/Caret'
import { useElementSize } from '../../hooks/useElementSize'
import { runBaselineSimulation, uploadFloorPlan } from '../../api/forksight'
import { CATALOG_BY_TYPE } from '../../data/catalog'
import { navigate, paths } from '../../router'
import { useAppState } from '../../state/AppState'
import type { ElementType, LayoutElement, Workspace } from '../../types'
import { Palette } from './Palette'
import { LayoutCanvas } from './LayoutCanvas'
import { PropertiesPopover } from './PropertiesPopover'
import { SimSettingsDialog } from './SimSettingsDialog'
import { createElement, normDeg, round1 } from './geometry'
import './layout.css'

const ZOOMS = [50, 75, 100, 125, 150, 200]
const HISTORY_LIMIT = 100

/** Figma "03 / 배치 · 빈 작업장" · "04 / 배치 · 편집 중" · "04b / 컴팩트 좌측 요소 목록" */
export function LayoutPage({ workspace }: { workspace: Workspace }) {
  const { updateWorkspace } = useAppState()
  const [elements, setElements] = useState<LayoutElement[]>(workspace.elements)
  const [history, setHistory] = useState<LayoutElement[][]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)
  const [showGrid, setShowGrid] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [viewRef, view] = useElementSize<HTMLDivElement>()
  const fileRef = useRef<HTMLInputElement>(null)

  const { widthM, heightM, gridM } = workspace.plan
  const fit = Math.max(1, Math.min((view.width - 2) / widthM, (view.height - 2) / heightM))
  const scale = (fit * zoom) / 100

  // 배치가 바뀌면 작업장에 저장 (TODO(API): 로그인 상태면 PUT /api/v1/workspaces/:id 로 동기화)
  const elementsRef = useRef(elements)
  useLayoutEffect(() => {
    elementsRef.current = elements
  }, [elements])
  useEffect(() => {
    if (elements === workspace.elements) return
    const t = setTimeout(() => updateWorkspace(workspace.id, { elements, status: workspace.result ? 'done' : 'editing' }), 250)
    return () => clearTimeout(t)
  }, [elements, workspace.elements, workspace.id, workspace.result, updateWorkspace])

  const remember = useCallback(() => {
    setHistory((h) => [...h.slice(-HISTORY_LIMIT + 1), elementsRef.current])
  }, [])

  const commit = useCallback(
    (next: (list: LayoutElement[]) => LayoutElement[]) => {
      remember()
      setElements(next)
    },
    [remember],
  )

  const patchElement = useCallback((id: string, patch: Partial<LayoutElement>) => {
    setElements((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }, [])

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h
      setElements(h[h.length - 1])
      return h.slice(0, -1)
    })
  }, [])

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    commit((list) => list.filter((e) => e.id !== selectedId))
    setSelectedId(null)
  }, [commit, selectedId])

  const addElement = (type: ElementType, xM?: number, yM?: number) => {
    const item = CATALOG_BY_TYPE[type]
    const x = xM !== undefined ? xM - item.w / 2 : widthM / 2 - item.w / 2 + (elements.length % 5) * 1.5
    const y = yM !== undefined ? yM - item.h / 2 : heightM / 2 - item.h / 2 + (elements.length % 5) * 1.5
    const el = createElement(type, x, y, elements)
    commit((list) => [...list, el])
    setSelectedId(el.id)
  }

  // 단축키: R 회전 · Delete 삭제 · Ctrl+Z 실행 취소 · 방향키 이동 · Esc 선택 해제
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (settingsOpen || t.closest('input, select, textarea')) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
        return
      }
      if (!selectedId) return
      const sel = elementsRef.current.find((x) => x.id === selectedId)
      if (!sel) return
      if (e.key === 'r' || e.key === 'R') {
        commit((list) => list.map((x) => (x.id === selectedId ? { ...x, rotation: normDeg(x.rotation + (e.shiftKey ? -90 : 90)) } : x)))
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelected()
      } else if (e.key === 'Escape') {
        setSelectedId(null)
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const step = e.shiftKey ? 1 : 0.1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        commit((list) => list.map((x) => (x.id === selectedId ? { ...x, x: round1(x.x + dx), y: round1(x.y + dy) } : x)))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [commit, deleteSelected, selectedId, settingsOpen, undo])

  const run = async (durationMin: number) => {
    setRunning(true)
    setRunError(null)
    try {
      const result = await runBaselineSimulation(workspace.id, elements, durationMin)
      updateWorkspace(workspace.id, { elements, result, status: 'done' })
      navigate(paths.simulation(workspace.id))
    } catch (e) {
      setRunError(e instanceof Error ? e.message : '시뮬레이션을 실행하지 못했습니다.')
      setRunning(false)
    }
  }

  const reloadPlan = async (file: File | undefined) => {
    if (!file) return
    const { plan, elements: recognized } = await uploadFloorPlan(file)
    updateWorkspace(workspace.id, { plan, elements: recognized, status: 'ready' })
    navigate(paths.plan(workspace.id))
  }

  const selected = elements.find((e) => e.id === selectedId) ?? null
  const empty = elements.length === 0

  return (
    <div className="lpage">
      <GlobalNav />
      {/* 다른 단계 화면과 같은 위치에 두어 화면 전환 시 메뉴가 움직이지 않게 함 */}
      <StageNav workspace={{ ...workspace, elements }} stage="layout" />
      <div className="lpage__body">
        <Palette onAdd={(t) => addElement(t)} />
        <div className="lpage__main">
          <div className="lpage__work">
            <div className="ltoolbar">
              <Button className="ltoolbar__load" onClick={() => fileRef.current?.click()}>
                도면 불러오기
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf,.dxf,.dwg"
                className="visually-hidden"
                onChange={(e) => reloadPlan(e.target.files?.[0])}
              />
              <Button className="ltoolbar__undo" onClick={undo} disabled={!history.length} title="Ctrl+Z">
                실행 취소
              </Button>
              <button className="ltoolbar__grid" role="switch" aria-checked={showGrid} onClick={() => setShowGrid((g) => !g)}>
                격자 표시
                <span className="ltoolbar__switch" aria-hidden />
              </button>
              <Menu
                className="ltoolbar__zoom-wrap"
                align="right"
                value={String(zoom)}
                items={ZOOMS.map((z) => ({ value: String(z), label: `${z}%` }))}
                onSelect={(v) => setZoom(Number(v))}
                trigger={({ toggle }) => (
                  <Button className="ltoolbar__zoom" onClick={toggle} aria-label="확대 비율">
                    {zoom}%
                    <Caret size={12} />
                  </Button>
                )}
              />
              <Button variant="primary" className="ltoolbar__run" onClick={() => setSettingsOpen(true)}>
                시뮬레이션 실행
              </Button>
            </div>
            <p className="lpage__dims">
              {widthM.toFixed(1)} m &times; {heightM.toFixed(1)} m
            </p>
            <div className="lpage__viewport-wrap">
            <div className="lpage__viewport" ref={viewRef}>
              {view.width > 0 && (
                <LayoutCanvas
                  widthM={widthM}
                  heightM={heightM}
                  gridM={gridM}
                  scale={scale}
                  showGrid={showGrid}
                  elements={elements}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onBeginChange={remember}
                  onChangeElement={patchElement}
                  onDropNew={(type, x, y) => addElement(type, x, y)}
                >
                  {empty && (
                    <div className="lcanvas__empty">
                      <p className="lcanvas__empty-title">좌측 요소를 선택한 뒤 작업장에 배치하세요</p>
                      <p className="lcanvas__empty-sub">또는 도면을 불러와 배치를 시작할 수 있습니다.</p>
                    </div>
                  )}
                </LayoutCanvas>
              )}
            </div>
              {selected && (
                <PropertiesPopover
                  key={selected.id}
                  el={selected}
                  side={(selected.x + selected.w / 2) / widthM > 0.55 ? 'left' : 'right'}
                  onChange={(patch) => commit((list) => list.map((e) => (e.id === selected.id ? { ...e, ...patch } : e)))}
                  onDelete={deleteSelected}
                  onClose={() => setSelectedId(null)}
                />
              )}
            </div>
            <p className="lpage__status" role="status">
              {empty
                ? `빈 작업장  ·  작업장 크기 ${widthM} × ${heightM} m  ·  격자 간격 ${gridM} m`
                : selected
                  ? `${selected.label} 선택됨  ·  R 회전  ·  Delete 삭제`
                  : '배치 편집 중  ·  드래그 이동  ·  R 회전  ·  Delete 삭제'}
            </p>
          </div>
        </div>
      </div>
      {settingsOpen && (
        <SimSettingsDialog
          running={running}
          error={runError}
          onCancel={() => setSettingsOpen(false)}
          onRun={run}
        />
      )}
    </div>
  )
}
