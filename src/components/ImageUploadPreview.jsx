export default function ImageUploadPreview({ file, previewUrl, onCancel, uploading }) {
  if (!file) return null

  return (
    <div className="relative z-20 px-4 py-2 bg-black/60 backdrop-blur-md border-t border-white/10 flex items-center gap-3 shrink-0">
      <img
        src={previewUrl}
        alt="Upload preview"
        className="w-10 h-10 rounded-lg object-cover ring-1 ring-white/20 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/70 truncate">{file.name}</p>
        <p className="text-[10px] text-white/40">{(file.size / 1024).toFixed(0)} KB</p>
      </div>
      {uploading && (
        <div className="w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin shrink-0" />
      )}
      <button
        onClick={onCancel}
        disabled={uploading}
        aria-label="Cancel upload"
        className="text-white/40 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer shrink-0 disabled:opacity-30"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
