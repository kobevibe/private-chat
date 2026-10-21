import { useState } from 'react'
import VoicePlayer from './VoicePlayer'

function formatWhen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return time
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`
}

export default function MediaGallery({ photos, voices, onOpenPhoto, onDelete, onClose }) {
  const [tab, setTab] = useState('photos')
  const [confirmId, setConfirmId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  if (!onClose) return null

  const handleDelete = async (id) => {
    setBusyId(id)
    await onDelete(id)
    setBusyId(null)
    setConfirmId(null)
  }

  const renderConfirm = (id, label) => (
    <div className="absolute inset-x-2 bottom-2 rounded-lg bg-black/90 backdrop-blur-sm border border-white/15 p-2 text-center z-10">
      <p className="text-[10px] text-white/80 mb-1.5">Delete this {label}?</p>
      <div className="flex gap-1">
        <button
          onClick={() => handleDelete(id)}
          disabled={busyId === id}
          className="flex-1 py-1 rounded-md bg-red-500 hover:bg-red-400 text-white text-[10px] font-medium transition-colors cursor-pointer disabled:opacity-50"
        >
          {busyId === id ? '…' : 'Delete'}
        </button>
        <button
          onClick={() => setConfirmId(null)}
          className="flex-1 py-1 rounded-md bg-white/10 hover:bg-white/15 text-white text-[10px] transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/95 backdrop-blur-sm flex flex-col photo-viewer-in"
      role="dialog"
      aria-label="Shared media"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-white">Shared media</h2>
        <button
          onClick={onClose}
          aria-label="Close media gallery"
          className="text-white/60 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 py-2 border-b border-white/10 shrink-0" onClick={(e) => e.stopPropagation()}>
        {[
          { id: 'photos', label: `Photos (${photos.length})` },
          { id: 'voice', label: `Voice (${voices.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setConfirmId(null) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
              tab === t.id
                ? 'bg-white text-black border-white'
                : 'bg-white/5 text-white/70 border-white/15 hover:bg-white/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'photos' ? (
        photos.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/40">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3">🖼</div>
            <p className="text-sm">No photos yet</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2 chat-scrollbar" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((p) => (
                <div key={p.id} className="relative aspect-square">
                  <button
                    onClick={() => onOpenPhoto(p.url)}
                    className="w-full h-full overflow-hidden rounded-lg cursor-pointer group"
                  >
                    <img
                      src={p.url}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </button>

                  <button
                    onClick={() => setConfirmId(confirmId === p.id ? null : p.id)}
                    aria-label="Delete photo"
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/65 hover:bg-red-500/90 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer backdrop-blur-sm border border-white/20"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  {confirmId === p.id && renderConfirm(p.id, 'photo')}
                </div>
              ))}
            </div>
          </div>
        )
      ) : voices.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/40">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3">🎤</div>
          <p className="text-sm">No voice messages yet</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 chat-scrollbar space-y-2" onClick={(e) => e.stopPropagation()}>
          {voices.map((v) => (
            <div key={v.id} className="relative rounded-xl bg-white/5 border border-white/10 px-3 pt-2 pb-2.5 text-white">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] text-white/55 truncate">
                  {v.senderName} · {formatWhen(v.createdAt)}
                </span>
                <button
                  onClick={() => setConfirmId(confirmId === v.id ? null : v.id)}
                  aria-label="Delete voice message"
                  className="w-6 h-6 rounded-full bg-white/10 hover:bg-red-500/90 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/15 shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <VoicePlayer url={v.url} duration={v.duration} />
              {confirmId === v.id && renderConfirm(v.id, 'voice message')}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
