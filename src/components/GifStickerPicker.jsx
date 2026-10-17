import { useEffect, useRef, useState } from 'react'

const GIPHY_KEY = import.meta.env.VITE_GIPHY_API_KEY || ''

// Verified Giphy pairs (still frame + MP4) — fallback when the API is unreachable.
// Grid shows the static still (always renders, zero decode cost); chat plays the MP4.
const CURATED_GIFS = [
  ['3o7abldj0b3rxrZUxW', 'https://media.giphy.com/media/3o7abldj0b3rxrZUxW/200w_s.gif', 'https://media.giphy.com/media/3o7abldj0b3rxrZUxW/200w.mp4'],
  ['l0MYt5jPR6QX5pnqM', 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200w_s.gif', 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200w.mp4'],
  ['26BRv0ThflsHCqDrG', 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/200w_s.gif', 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/200w.mp4'],
  ['111ebonMs90YLu', 'https://media.giphy.com/media/111ebonMs90YLu/200w_s.gif', 'https://media.giphy.com/media/111ebonMs90YLu/200w.mp4'],
  ['8fen5LSZcHQ5O', 'https://media.giphy.com/media/8fen5LSZcHQ5O/200w_s.gif', 'https://media.giphy.com/media/8fen5LSZcHQ5O/200w.mp4'],
  ['3oEjHV0z8S7WM4MwnK', 'https://media.giphy.com/media/3oEjHV0z8S7WM4MwnK/200w_s.gif', 'https://media.giphy.com/media/3oEjHV0z8S7WM4MwnK/200w.mp4'],
  ['26ufdipQqU2lhNA4g', 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/200w_s.gif', 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/200w.mp4'],
].map(([id, preview, url]) => ({ id, preview, url, mp4: true }))

function giphySearchUrl(q, limit = 24) {
  const base = 'https://api.giphy.com/v1/gifs'
  const params = `api_key=${GIPHY_KEY}&limit=${limit}&rating=pg-13`
  return q.trim()
    ? `${base}/search?${params}&q=${encodeURIComponent(q.trim())}`
    : `${base}/trending?${params}`
}

function mapGiphyGif(g) {
  // preview = static still image (always renders). url = MP4 (hw-decoded in chat).
  const preview =
    g.images?.fixed_width_small_still?.url ||
    g.images?.fixed_width_still?.url ||
    g.images?.original_still?.url ||
    null
  const mp4 = g.images?.fixed_height?.mp4 || g.images?.downsized?.mp4 || g.images?.original?.mp4
  const gif = g.images?.fixed_height?.url || g.images?.downsized?.url || g.images?.original?.url
  return {
    id: g.id,
    preview: preview || gif || mp4,
    url: mp4 || gif,
    mp4: !!mp4,
  }
}

export default function GifStickerPicker({ onPickGif, onClose }) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState(CURATED_GIFS)
  const [loading, setLoading] = useState(false)
  const [apiFailed, setApiFailed] = useState(false)
  const searchTimerRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Giphy search/trending — falls back to the curated grid and never wipes it
  useEffect(() => {
    if (!GIPHY_KEY) return undefined
    const ctrl = new AbortController()
    const run = async () => {
      setLoading(true)
      try {
        const res = await fetch(giphySearchUrl(query), { signal: ctrl.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (!Array.isArray(json.data) || json.data.length === 0) {
          if (!ctrl.signal.aborted) {
            setApiFailed(true)
            setLoading(false)
          }
          return
        }
        const mapped = json.data.map(mapGiphyGif).filter((g) => g.url)
        if (!ctrl.signal.aborted && mapped.length) {
          setGifs(mapped)
          setApiFailed(false)
        }
      } catch {
        if (!ctrl.signal.aborted) setApiFailed(true)
      }
      if (!ctrl.signal.aborted) setLoading(false)
    }
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(run, 300)
    return () => {
      ctrl.abort()
      clearTimeout(searchTimerRef.current)
    }
  }, [query])

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-40">
      <div className="mx-1 rounded-2xl bg-[#1c1c1e]/95 backdrop-blur-xl border border-white/15 shadow-2xl overflow-hidden">
        {/* Search */}
        <div className="flex items-center gap-2 p-2 border-b border-white/10">
          <span className="text-[11px] font-bold text-white/50 shrink-0">GIFs</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={GIPHY_KEY ? 'Search GIFs…' : 'Trending picks'}
            disabled={!GIPHY_KEY}
            className="flex-1 min-w-0 bg-white/10 border border-white/10 rounded-full px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-blue-500 disabled:opacity-60"
            aria-label="Search GIFs"
          />
        </div>

        {/* Grid — static previews */}
        <div className="max-h-64 overflow-y-auto chat-scrollbar p-1.5">
          <div className="grid grid-cols-3 gap-1">
            {gifs.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onPickGif(g)}
                className="aspect-square overflow-hidden rounded-lg bg-white/5 hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer"
              >
                {g.preview ? (
                  <img src={g.preview} alt="" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <video
                    src={g.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />
                )}
              </button>
            ))}
            {loading && (
              <div className="col-span-3 py-6 flex justify-center">
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        {apiFailed && (
          <div className="px-3 py-2 text-[10px] text-amber-300/80 border-t border-white/10">
            Search unavailable — showing picks. The Giphy key may be invalid.
          </div>
        )}
        {!GIPHY_KEY && (
          <div className="px-3 py-2 text-[10px] text-white/40 border-t border-white/10">
            Set <span className="text-white/70">VITE_GIPHY_API_KEY</span> for full Giphy search
          </div>
        )}
      </div>
    </div>
  )
}
