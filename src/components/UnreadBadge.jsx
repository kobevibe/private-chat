export default function UnreadBadge({ count, onClick }) {
  if (!count || count <= 0) return null

  return (
    <button
      onClick={onClick}
      aria-label={`${count} unread messages`}
      className="relative cursor-pointer group"
    >
      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-[10px] font-bold text-white shadow-lg shadow-blue-500/30 group-hover:bg-blue-400 transition-colors">
        {count > 99 ? '99+' : count}
      </span>
    </button>
  )
}
