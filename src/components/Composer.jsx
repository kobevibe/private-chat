import { useRef, useState, useEffect } from 'react'
import GifStickerPicker from './GifStickerPicker'

const MAX_MESSAGE_LENGTH = 2000

export default function Composer({
  onSend,
  onTyping,
  onFileSelect,
  onMic,
  onSendGif,
  onSendSticker,
  hasAttachment,
  uploading,
  recording,
}) {
  const [text, setText] = useState(() => localStorage.getItem('our-space-draft') || '')
  const [showPicker, setShowPicker] = useState(false)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  const autoResize = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
  }

  // Restore height for a persisted draft on mount
  useEffect(() => {
    const ta = textareaRef.current
    if (ta && ta.value) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
    }
  }, [])

  const clear = () => {
    setText('')
    localStorage.removeItem('our-space-draft')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const submit = () => {
    const t = text.trim()
    if (!t && !hasAttachment) return
    if (onSend(t) !== false) clear()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    } else {
      onTyping()
    }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit() }}
      className="relative flex items-center gap-2"
    >
      {showPicker && (
        <GifStickerPicker
          onPickGif={(gif) => {
            setShowPicker(false)
            onSendGif(gif)
          }}
          onPickSticker={(emoji) => {
            setShowPicker(false)
            onSendSticker(emoji)
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={(e) => {
          onFileSelect(e)
          e.target.value = ''
        }}
        className="hidden"
        aria-label="Choose image"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || recording}
        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white/80 flex items-center justify-center transition-colors border border-white/10 shrink-0 cursor-pointer disabled:opacity-50"
        title="Send a photo"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => setShowPicker((v) => !v)}
        disabled={uploading || recording}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors border shrink-0 cursor-pointer disabled:opacity-50 ${
          showPicker ? 'bg-[#007aff]/25 border-blue-400/50 text-blue-300' : 'bg-white/10 hover:bg-white/20 text-white/80 border-white/10'
        }`}
        title="GIFs and stickers"
        aria-label="GIFs and stickers"
        aria-expanded={showPicker}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onMic}
        disabled={uploading || recording}
        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white/80 flex items-center justify-center transition-colors border border-white/10 shrink-0 cursor-pointer disabled:opacity-50"
        title="Record a voice message"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 11a7 7 0 0014 0M12 18v3" />
        </svg>
      </button>

      <div className="flex-1 relative flex items-end">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            localStorage.setItem('our-space-draft', e.target.value)
            autoResize()
          }}
          onKeyDown={handleKeyDown}
          placeholder="Message"
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          aria-label="Message input"
          className="w-full bg-[#1c1c1e]/90 border border-white/15 text-white placeholder-white/40 text-[16px] rounded-2xl pl-4 pr-10 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner resize-none leading-snug max-h-[140px] overflow-y-auto chat-scrollbar"
        />
        <button
          type="submit"
          disabled={!text.trim() && !hasAttachment}
          aria-label="Send"
          className={`absolute right-1.5 bottom-1.5 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
            text.trim() || hasAttachment
              ? 'bg-[#007aff] text-white shadow-md hover:bg-blue-600 cursor-pointer scale-100'
              : 'bg-white/10 text-white/30 cursor-not-allowed scale-95'
          }`}
        >
          <svg className="w-3.5 h-3.5 rotate-90" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
          </svg>
        </button>
      </div>
    </form>
  )
}
