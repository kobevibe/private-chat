import { useEffect, useRef, useState } from 'react'

const MAX_DURATION = 300 // 5 minutes

const pickMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || ''
}

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function VoiceRecorder({ onCancel, onSend }) {
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const cancelledRef = useRef(false)
  const elapsedRef = useRef(0)

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  const finish = () => {
    clearInterval(timerRef.current)
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      try { rec.stop() } catch { /* already stopped */ }
    }
  }

  const cancel = (reason) => {
    cancelledRef.current = true
    clearInterval(timerRef.current)
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      try { rec.stop() } catch { /* already stopped */ }
    }
    onCancel(reason)
  }

  // Start recorder
  useEffect(() => {
    let cleanupGuard = false

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cleanupGuard) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const mimeType = pickMimeType()
        const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        chunksRef.current = []
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        rec.onstop = () => {
          stopStream()
          if (cancelledRef.current) return
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
          if (blob.size > 0) onSend(blob, Math.max(1, elapsedRef.current))
        }
        rec.start(250)
        recorderRef.current = rec
      } catch {
        cancel('blocked')
      }
    }

    start()

    return () => {
      cleanupGuard = true
      cancelledRef.current = true
      clearInterval(timerRef.current)
      const rec = recorderRef.current
      if (rec && rec.state !== 'inactive') {
        try { rec.stop() } catch { /* already stopped */ }
      }
      stopStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ticker + 5 min auto-stop
  useEffect(() => {
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1
      setElapsed(elapsedRef.current)
      if (elapsedRef.current >= MAX_DURATION) finish()
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  const togglePause = () => {
    const rec = recorderRef.current
    if (!rec) return
    if (rec.state === 'recording') {
      rec.pause()
      setPaused(true)
    } else if (rec.state === 'paused') {
      rec.pause && rec.resume()
      setPaused(false)
    }
  }

  return (
    <div className="mx-4 mb-2 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md px-4 py-3 select-none">
      <span className="relative flex h-3 w-3 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
      </span>

      <span className="text-sm text-white/90 font-mono tabular-nums w-12">{formatTime(elapsed)}</span>

      <div className="flex-1 flex items-center gap-1 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-white/50"
            style={{
              height: `${6 + ((i * 7) % 14)}px`,
              opacity: i / 24 < elapsed / MAX_DURATION ? 0.9 : 0.3,
            }}
          />
        ))}
      </div>

      <button
        onClick={togglePause}
        title={paused ? 'Resume' : 'Pause'}
        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/90 transition-colors cursor-pointer"
      >
        {paused ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
        )}
      </button>

      <button
        onClick={() => cancel()}
        title="Cancel"
        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/90 transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <button
        onClick={finish}
        title="Send"
        className="p-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </button>
    </div>
  )
}
