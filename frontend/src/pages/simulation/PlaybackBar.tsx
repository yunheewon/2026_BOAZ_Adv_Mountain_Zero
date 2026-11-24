import { Menu } from '../../components/Menu'
import { Caret } from '../../components/Caret'
import { fmtClock } from '../../hooks/usePlayback'
import type { RiskEvent } from '../../types'

const SPEEDS = [1, 2, 4, 8, 16]

interface PlaybackBarProps {
  t: number
  duration: number
  playing: boolean
  speed: number
  onToggle: () => void
  onSeek: (sec: number) => void
  onRestart: () => void
  onSpeed: (s: number) => void
  events?: RiskEvent[]
  compact?: boolean
}

/** Figma "Playback controls" — 재생/일시정지 · 시간 · 타임라인(이동) · 처음부터 · 배속 */
export function PlaybackBar({ t, duration, playing, speed, onToggle, onSeek, onRestart, onSpeed, events = [], compact }: PlaybackBarProps) {
  const pct = duration ? (t / duration) * 100 : 0
  return (
    <div className={`playback ${compact ? 'playback--compact' : ''}`} onPointerDown={(e) => e.stopPropagation()}>
      <button
        className={compact ? 'playback__toggle-text' : 'playback__toggle fs-btn fs-btn--primary'}
        onClick={onToggle}
        aria-label={playing ? '일시정지' : '재생'}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <span className="playback__time">
        {fmtClock(t)} / {fmtClock(duration)}
      </span>
      <div className="playback__track" style={{ ['--pct' as string]: `${pct}%` }}>
        <input
          type="range"
          min={0}
          max={duration}
          step={0.5}
          value={t}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="재생 위치"
        />
        {events.map((ev) => (
          <span
            key={ev.id}
            className="playback__tick"
            style={{ left: `${(ev.timeSec / duration) * 100}%` }}
            title={`${ev.id} · ${fmtClock(ev.timeSec)}`}
          />
        ))}
      </div>
      {!compact && (
        <div className="playback__right">
          <button className="playback__restart" onClick={onRestart} aria-label="처음부터 재생" title="처음부터 재생">
            ↺
          </button>
          <Menu
            align="right"
            value={String(speed)}
            items={SPEEDS.map((s) => ({ value: String(s), label: `${s}×` }))}
            onSelect={(v) => onSpeed(Number(v))}
            className="playback__speed-wrap"
            trigger={({ toggle }) => (
              <button className="playback__speed" onClick={toggle} aria-label="재생 배속">
                {speed}×
                <Caret size={12} />
              </button>
            )}
          />
        </div>
      )}
    </div>
  )
}
