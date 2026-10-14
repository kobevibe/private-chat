export default function WallpaperPicker({ wallpapers, selected, onSelect, onClose, open }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#1c1c1e] border border-white/15 rounded-2xl w-full max-w-sm p-5 shadow-2xl text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold">Chat Wallpaper</h2>
            <p className="text-[11px] text-white/50">Shared with both of you</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white p-1 rounded-lg cursor-pointer">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {wallpapers.map((wp) => {
            const isSelected = selected === wp.url
            return (
              <button
                key={wp.id}
                onClick={() => onSelect(wp.url)}
                className={`relative rounded-xl overflow-hidden border-2 text-left h-28 group transition-all cursor-pointer ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-500/40' : 'border-white/15 hover:border-white/40'
                }`}
              >
                <img src={wp.url} alt={wp.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div className="absolute inset-0 bg-black/40" />
                <span className="absolute bottom-2 left-2 right-2 text-xs font-medium text-white truncate drop-shadow">
                  {wp.name}
                </span>
                {isSelected && (
                  <span className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold shadow">
                    ✓
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors shadow-lg cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  )
}
