import { useCallback, useEffect, useRef, useState } from 'react'

/** 시뮬레이션 재생 시계 (초 단위). 실제 프레임 데이터가 오면 t 로 해당 프레임을 고른다. */
export function usePlayback(durationSec: number, initial = 0) {
  const [t, setT] = useState(initial)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const last = useRef<number | null>(null)

  useEffect(() => {
    if (!playing) {
      last.current = null
      return
    }
    let raf = 0
    const tick = (now: number) => {
      if (last.current !== null) {
        const dt = ((now - last.current) / 1000) * speed
        setT((prev) => {
          const next = prev + dt
          if (next >= durationSec) {
            setPlaying(false)
            return durationSec
          }
          return next
        })
      }
      last.current = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, durationSec])

  const seek = useCallback((sec: number) => setT(Math.min(durationSec, Math.max(0, sec))), [durationSec])
  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (!p) setT((cur) => (cur >= durationSec ? 0 : cur))
      return !p
    })
  }, [durationSec])
  const restart = useCallback(() => {
    setT(0)
    setPlaying(true)
  }, [])

  return { t, playing, speed, setSpeed, seek, toggle, restart, pause: () => setPlaying(false) }
}

export const fmtClock = (sec: number) => {
  const s = Math.floor(sec)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
