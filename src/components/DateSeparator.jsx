export default function DateSeparator({ label }) {
  return (
    <div className="flex items-center justify-center py-1" role="separator">
      <span className="text-[10px] uppercase tracking-widest px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-white/50 font-medium">
        {label}
      </span>
    </div>
  )
}
