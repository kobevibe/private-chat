import { useState } from 'react'

export default function PhotoGallery({ photos, onOpen, onDelete, onClose }) {
  const [confirmId, setConfirmId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  if (!onClose) return null

  const handleDelete = async (id) => {
    setBusyId(id)
    await onDelete(id)
    setBusyId(null)
    setConfirmId(null)
  }

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/95 backdrop-blur-sm flex flex-col photo-viewer-in"
      role="dialog"
      aria-label="Shared photos"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-white">Shared photos</h2>
        <button
          onClick={onClose}
          aria-label="Close gallery"
          className="text-white/60 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {photos.length === 0 ? (
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
                  onClick={() => onOpen(p.url)}
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

                {confirmId === p.id && (
                  <div className="absolute inset-x-1 bottom-1 rounded-lg bg-black/85 backdrop-blur-sm border border-white/15 p-2 text-center">
                    <p className="text-[10px] text-white/80 mb-1.5">Delete this photo?</p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={busyId === p.id}
                        className="flex-1 py-1 rounded-md bg-red-500 hover:bg-red-400 text-white text-[10px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {busyId === p.id ? '…' : 'Delete'}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="flex-1 py-1 rounded-md bg-white/10 hover:bg-white/15 text-white text-[10px] transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
