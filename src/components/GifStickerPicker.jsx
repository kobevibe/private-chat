import { useEffect, useState } from 'react'

// Hand-picked, every URL verified live (200w still + 200w.mp4) before shipping.
// Grid shows the static still (instant, zero decode cost); chat plays the MP4.
const CATEGORIES = [
  {
    id: 'love',
    name: 'Love',
    emoji: '❤️',
    ids: [
      'Hp4lpOT1Ns60o', '3o7aTzm7USlf7kk1VK', '26xBFU3WDQ1OQXoWI',
      '1hqb8LwPS2xCNCpWH8', '26FPErjxttUeDCMdq', 'Ke8yfIntOTg8qB1q1y',
      '26BRv0ThflsHCqDrG', '8fen5LSZcHQ5O', '3o7abldj0b3rxrZUxW',
    ],
  },
  {
    id: 'funny',
    name: 'Funny',
    emoji: '😂',
    ids: [
      '3ohs7JomJSRdlxaVGg', 'Swx36wwSsU49HAnIhC', '26FPGI3ZgduhYYVTa',
      'FeeTEKqiQlqhJfX6Pq', '45dd2mVVMHcikj8o6E', 'SzD4gF32YzTTUiINhn',
      'l0MYt5jPR6QX5pnqM', '3oEjHV0z8S7WM4MwnK', '26ufdipQqU2lhNA4g',
    ],
  },
  {
    id: 'reactions',
    name: 'React',
    emoji: '😮',
    ids: [
      'JhSL4vfyXR1HVgYm3s', '9DgjJSVSUyBrlBgSw4', 'xT77XWum9yH7zNkFW0',
      'l3q2K5jinAlChoCLS', 'l3vR3ACyHLgbOIjZe', 'xT9DPDp0PNRFbuqqli',
      'Xxw2Rn2NiLMAm4nOhk', '9SIXFu7bIUYHhFc19G',
    ],
  },
  {
    id: 'animals',
    name: 'Pets',
    emoji: '🐶',
    ids: [
      'l2Sq5GffrCyUMEXjW', '7XADiFeY6fhnItpkiA', 'xTiTngCK4tZaoHNlao',
      'xULW8xV2tnhxt0jTzy', 'UTvayOxPBrl8y5BzIP', 'cfuL5gqFDreXxkWQ4o',
      'Ov5NiLVXT8JEc', '13borq7Zo2kulO', '3o72EX5QZ9N9d51dqo',
      '6VoDJzfRjJNbG', 'OmK8lulOMQ9XO',
    ],
  },
  {
    id: 'mood',
    name: 'Mood',
    emoji: '✨',
    ids: [
      'TfvYtCkCdoc6c', 'mWblFbJN5hg9ndNIlg', 'EgClH12F524o0',
      'ruqrwD8jFH6Du', 'H7fEGyOn75WVxbkf0V', 'OR1aQzSbvf4DrgX22C',
      'P3vc6Z3zVT1Go', '2uxxTQMhLeMH8mK0Jm', 'QpTMRCuLQv9F6',
      'BkL4Vyz0z2iYQMhwFw', '111ebonMs90YLu',
    ],
  },
  {
    id: 'memes',
    name: 'Memes',
    emoji: '🔥',
    ids: [
      'XBcWgQZJpYTCac3o61', 'L0qTl8hl84EDly62J1', '5UJyoBqHtHmU0',
      '13O5QFFTXMY4Ni', 'Q6OpQ0hTfoMlzAJNxh', 'IW71LHYHgD4oU',
    ],
  },
]

const gifFor = (id) => ({
  id,
  preview: `https://media.giphy.com/media/${id}/200w_s.gif`,
  url: `https://media.giphy.com/media/${id}/200w.mp4`,
  mp4: true,
})

const GIFS_BY_CATEGORY = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.ids.map(gifFor)])
)

export default function GifStickerPicker({ onPickGif, onClose }) {
  const [category, setCategory] = useState(CATEGORIES[0].id)

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const gifs = GIFS_BY_CATEGORY[category]

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-40">
      <div className="mx-1 rounded-2xl bg-[#1c1c1e]/95 backdrop-blur-xl border border-white/15 shadow-2xl overflow-hidden">
        {/* Category chips */}
        <div className="flex gap-1.5 p-2 overflow-x-auto chat-scrollbar border-b border-white/10">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                category === c.id
                  ? 'bg-[#007aff] text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              <span aria-hidden="true">{c.emoji}</span>
              {c.name}
            </button>
          ))}
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
                <img src={g.preview} alt="" loading="lazy" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
