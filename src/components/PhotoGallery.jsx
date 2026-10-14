export default function PhotoGallery({ photos, onOpen, onClose }) {
  if (!onClose) return null

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
              <button
                key={p.id}
                onClick={() => onOpen(p.url)}
                className="aspect-square overflow-hidden rounded-lg cursor-pointer group"
              >
                <img
                  src={p.url}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
