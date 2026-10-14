export default function TypingIndicator({ name }) {
  return (
    <div className="flex items-center gap-2 px-4 py-1" aria-live="polite" aria-label={`${name || 'Someone'} is typing`}>
      <div className="flex items-center gap-1 bg-[#262629]/90 backdrop-blur-md border border-white/10 rounded-2xl rounded-bl-xs px-3 py-2">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-[typing-bounce_1.2s_ease-in-out_infinite]"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
      </div>
      <span className="text-xs text-slate-400">{name} is typing…</span>
    </div>
  )
}
