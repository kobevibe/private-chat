const URL_RE = /(https?:\/\/[^\s<>"')\]]+)/g

export function linkify(text) {
  if (!text) return []
  const parts = []
  let last = 0
  for (const match of text.matchAll(URL_RE)) {
    const url = match[1]
    const start = match.index
    if (start > last) parts.push({ type: 'text', value: text.slice(last, start) })
    parts.push({ type: 'link', value: url })
    last = start + url.length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}
