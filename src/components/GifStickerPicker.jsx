import { useEffect, useRef, useState } from 'react'

const GIPHY_KEY = import.meta.env.VITE_GIPHY_API_KEY || ''

// Verified working Giphy CDN URLs (fallback when no API key is configured)
const CURATED_GIFS = [
  'https://media.giphy.com/media/3o7abldj0b3rxrZUxW/giphy.gif',
  'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  'https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif',
  'https://media.giphy.com/media/IwAZ6dvvveTdpIjNsE/giphy.gif',
  'https://media.giphy.com/media/mdrNUFcG4Dl3Cdd7kK/giphy.gif',
  'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif',
  'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
  'https://media.giphy.com/media/8fen5LSZcHQ5O/giphy.gif',
  'https://media.giphy.com/media/ICOgUNjzO0rG4/giphy.gif',
  'https://media.giphy.com/media/3oEjHV0z8S7WM4MwnK/giphy.gif',
  'https://media.giphy.com/media/26BRzozg4TCBXv6g0/giphy.gif',
  'https://media.giphy.com/media/y5bjIuPmAQyrijbH2p/giphy.gif',
  'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
  'https://media.giphy.com/media/YoZxq8nXYpw2k/giphy.gif',
]

const STICKERS = [
  '❤️', '❤️‍🔥', '😍', '🥰', '😘', '😜', '💕', '💞', '💓', '💋',
  '😂', '🤣', '😭', '🥺', '😅', '🙃', '😇', '😎', '🤗', '🤭',
  '🔥', '💯', '✨', '🎉', '🎊', '⭐', '🌙', '☀️', '🌈', '🌸',
  '👍', '👏', '🙏', '🤝', '💪', '🤞', '🫶', '👋', '👀', '💤',
  '🐶', '🐱', '🐰', '🐻', '🐼', '🦄', '🦋', '🐬', '🌟', '🍕',
]

function giphySearchUrl(q, limit = 24) {
  const base = 'https://api.giphy.com/v1/gifs'
  const params = `api_key=${GIPHY_KEY}&limit=${limit}&rating=pg-13&bundle=messaging_non_clips`
  return q.trim()
    ? `${base}/search?${params}&q=${encodeURIComponent(q.trim())}`
    : `${base}/trending?${params}`
}

function mapGiphyGif(g) {
  return {
    preview: g.images?.fixed_width?.url || g.images?.preview_gif?.url || g.images?.original?.url,
    url: g.images?.downsized_medium?.url || g.images?.downsized?.url || g.images?.original?.url,
    id: g.id,
  }
}

export default function GifStickerPicker({ onPickGif, onPickSticker, onClose }) {
  const [tab, setTab] = useState('gif')
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState(CURATED_GIFS.map((u, i) => ({ preview: u, url: u, id: `c${i}` })))
  const [loading, setLoading] = useState(false)
  const rootRef = useRef(null)
  const searchTimerRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Giphy live search (debounced); curated grid stays if no key
  useEffect(() => {
    if (tab !== 'gif' || !GIPHY_KEY) return undefined
    const ctrl = new AbortController()
    const run = async () => {
      setLoading(true)
      try {
        const res = await fetch(giphySearchUrl(query), { signal: ctrl.signal })
        const json = await res.json()
        if (!ctrl.signal.aborted && Array.isArray(json.data)) {
          setGifs(json.data.map(mapGiphyGif).filter((g) => g.url))
        }
      } catch {
        /* aborted or offline — keep current grid */
      }
      if (!ctrl.signal.aborted) setLoading(false)
    }
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(run, 300)
    return () => {
      ctrl.abort()
      clearTimeout(searchTimerRef.current)
    }
  }, [tab, query])

  return (
    <div ref={rootRef} className="absolute bottom-full left-0 right-0 mb-2 z-40">
      <div className="mx-1 rounded-2xl bg-[#1c1c1e]/95 backdrop-blur-xl border border-white/15 shadow-2xl overflow-hidden">
        {/* Tabs + search */}
        <div className="flex items-center gap-2 p-2 border-b border-white/10">
          <div className="flex bg-white/10 rounded-full p-0.5 shrink-0">
            {['gif', 'sticker'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  tab === t ? 'bg-[#007aff] text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                {t === 'gif' ? 'GIFs' : 'Stickers'}
              </button>
            ))}
          </div>
          {tab === 'gif' && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={GIPHY_KEY ? 'Search GIFs…' : 'Add GIPHY key for search'}
              disabled={!GIPHY_KEY}
              className="flex-1 min-w-0 bg-white/10 border border-white/10 rounded-full px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-blue-500 disabled:opacity-60"
              aria-label="Search GIFs"
            />
          )}
        </div>

        {/* Grid */}
        <div className="max-h-64 overflow-y-auto chat-scrollbar p-1.5">
          {tab === 'gif' ? (
            <div className="grid grid-cols-3 gap-1">
              {gifs.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onPickGif(g)}
                  className="aspect-square overflow-hidden rounded-lg bg-white/5 hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer"
                >
                  <img src={g.preview} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
              {loading && (
                <div className="col-span-3 py-6 flex justify-center">
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-1">
              {STICKERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onPickSticker(s)}
                  className="aspect-square flex items-center justify-center text-3xl rounded-lg bg-white/5 hover:bg-white/15 hover:scale-110 transition-all cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {!GIPHY_KEY && tab === 'gif' && (
          <div className="px-3 py-2 text-[10px] text-white/40 border-t border-white/10">
            Curated picks — set <span className="text-white/70">VITE_GIPHY_API_KEY</span> for full Giphy search
          </div>
        )}
      </div>
    </div>
  )
}
