export function getDateLabel(iso) {
  const date = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = (today - msgDay) / (1000 * 60 * 60 * 24)

  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return date.toLocaleDateString([], { weekday: 'long' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function formatLastSeen(iso, now = Date.now()) {
  if (!iso) return 'Offline'
  const ms = now - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60000)
  if (minutes < 2) return 'Active now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
