import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'

const MIN = 1
const MAX = 240

/** 시뮬레이션 실행 — 시간(분)만 입력하는 작은 창 */
export function SimSettingsDialog({
  running,
  error,
  onCancel,
  onRun,
}: {
  running: boolean
  error: string | null
  onCancel: () => void
  onRun: (durationMin: number) => void
}) {
  const [value, setValue] = useState('10')
  const minutes = Number(value)
  const valid = Number.isInteger(minutes) && minutes >= MIN && minutes <= MAX

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (valid && !running) onRun(minutes)
  }

  return (
    <Modal labelledBy="sim-settings-title" onClose={running ? undefined : onCancel} className="simset">
      <form onSubmit={submit}>
        <h2 id="sim-settings-title" className="fs-dialog-title">
          시뮬레이션 실행
        </h2>
        <label className="simset__field">
          <span>시간</span>
          <input
            type="number"
            min={MIN}
            max={MAX}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={running}
            aria-invalid={!valid}
            autoFocus
          />
          <span>분</span>
        </label>
        {error && <p className="simset__error">{error}</p>}
        <div className="fs-dialog-actions simset__actions">
          <Button onClick={onCancel} disabled={running}>
            취소
          </Button>
          <Button variant="primary" type="submit" className="simset__run" disabled={!valid || running}>
            {running ? '실행 중…' : '실행'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
