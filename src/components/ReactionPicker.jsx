const EMOJIS = ['❤️', '👍', '🔥']

export default function ReactionPicker({ myReaction, onReact, onReply, onEdit, onDelete, isOwn, side }) {
  return (
    <div
      className={`absolute -top-8 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5 bg-[#1c1c1e] border border-white/20 px-1.5 py-1 rounded-full z-20 shadow-lg ${side === 'right' ? 'right-0' : 'left-0'}`}
    >
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all cursor-pointer hover:scale-125 ${
            myReaction === emoji ? 'bg-blue-500/30 ring-1 ring-blue-400/50' : 'hover:bg-white/10'
          }`}
          title={myReaction === emoji ? 'Remove reaction' : 'React'}
        >
          {emoji}
        </button>
      ))}
      <div className="w-px h-4 bg-white/15 mx-0.5" />
      <button
        onClick={onReply}
        className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
        title="Reply"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2m0 0l-3-3m3 3l3-3" />
        </svg>
      </button>
      {isOwn && (
        <>
          <div className="w-px h-4 bg-white/15 mx-0.5" />
          <button
            onClick={onEdit}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
            title="Edit"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5h6m-3-3v6M3 17l3.5-3.5a2.12 2.12 0 013 0L12 14m0 0l1.586-1.586a2.12 2.12 0 013 0L21 12" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-full flex items-center justify-center text-red-400/80 hover:bg-red-500/15 hover:text-red-400 transition-all cursor-pointer"
            title="Delete"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}
