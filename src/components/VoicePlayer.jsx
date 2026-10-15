import { useEffect, useRef, useState } from 'react'

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function VoicePlayer({ url, duration }) {
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [total, setTotal] = useState(duration || 0)
  const audioRef = useRef(null)

  useEffect(() => {
    if (!url || !audioRef.current) return
    setPlaying(false)
    setCurrent(0)
    audioRef.current.load()
  }, [url])

  const toggle = (e) => {
    e.stopPropagation()
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }

  const seek = (e) => {
    e.stopPropagation()
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * audio.duration
    setCurrent(audio.currentTime)
  }

  const progress = total > 0 ? (current / total) * 100 : 0

  if (!url) {
    return (
      <div className="flex items-center gap-2 px-1 py-1 text-sm text-white/60">
        <span>🎤</span>
        <span className="text-xs">Voice message unavailable</span>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-2.5 min-w-[180px] py-0.5"
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0) }}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => {
          const d = audioRef.current?.duration
          if (Number.isFinite(d) && d > 0) setTotal(d)
        }}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
      >
        {playing ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
        ) : (
          <svg className="w-4 h-4 translate-x-[1px]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div
          onClick={seek}
          className="h-5 flex items-center cursor-pointer"
          role="presentation"
        >
          <div className="w-full h-1 rounded-full bg-white/25 overflow-hidden">
            <div
              className="h-full rounded-full bg-white/80"
              style={{ width: `${progress}%`, transition: playing ? 'width 0.15s linear' : 'none' }}
            />
          </div>
        </div>
        <span className="text-[10px] text-white/50 font-mono tabular-nums leading-none">
          {formatTime(current)} / {formatTime(total)}
        </span>
      </div>

      <span className="text-sm shrink-0" aria-hidden="true">🎤</span>
    </div>
  )
}
