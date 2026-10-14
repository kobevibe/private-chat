export default function ScrollToBottom({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Scroll to latest messages"
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 w-9 h-9 rounded-full bg-[#1c1c1e]/90 backdrop-blur-md border border-white/20 text-white/80 flex items-center justify-center shadow-lg hover:bg-[#2c2c2e] transition-all cursor-pointer"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    </button>
  )
}
