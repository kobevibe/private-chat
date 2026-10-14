import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { WALLPAPERS } from '../constants'
import TypingIndicator from './TypingIndicator'
import ScrollToBottom from './ScrollToBottom'
import WallpaperPicker from './WallpaperPicker'
import ProfileEdit from './ProfileEdit'
import PhotoViewer from './PhotoViewer'
import ReactionPicker from './ReactionPicker'
import DateSeparator from './DateSeparator'
import ImageUploadPreview from './ImageUploadPreview'
import UnreadBadge from './UnreadBadge'
import { getDateLabel } from '../utils/dates'

const MAX_MESSAGE_LENGTH = 2000
const TYPING_TIMEOUT = 3000
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'

export default function ChatApp({ session }) {
  const user = session.user

  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState(() =>
    localStorage.getItem('our-space-draft') || ''
  )
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [sendError, setSendError] = useState('')
  const [selectedWallpaper, setSelectedWallpaperState] = useState(() =>
    localStorage.getItem('our-space-wallpaper') || WALLPAPERS[0].url
  )
  const [showWallpaperModal, setShowWallpaperModal] = useState(false)
  const [otherUserTyping, setOtherUserTyping] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [roomId, setRoomId] = useState(null)
  const [partnerName, setPartnerName] = useState('')
  const [partnerAvatar, setPartnerAvatar] = useState(DEFAULT_AVATAR)
  const [myName, setMyName] = useState('')
  const [myAvatar, setMyAvatar] = useState(DEFAULT_AVATAR)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [viewingPhoto, setViewingPhoto] = useState(null)
  const [prevWallpaper, setPrevWallpaper] = useState(null)
  const [replyingTo, setReplyingTo] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [editingMsg, setEditingMsg] = useState(null)
  const [editText, setEditText] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [activeMsgId, setActiveMsgId] = useState(null)
  const [signedUrls, setSignedUrls] = useState({})
  const [lastSeenAt, setLastSeenAt] = useState(() =>
    localStorage.getItem('our-space-last-seen') || new Date(0).toISOString()
  )

  const messagesEndRef = useRef(null)
  const mainRef = useRef(null)
  const textareaRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const lastTypingSentRef = useRef(0)
  const typingChannelRef = useRef(null)
  const fileInputRef = useRef(null)

  // Persist wallpaper + crossfade
  const setSelectedWallpaper = (url) => {
    setPrevWallpaper(selectedWallpaper)
    setSelectedWallpaperState(url)
    localStorage.setItem('our-space-wallpaper', url)
    setTimeout(() => setPrevWallpaper(null), 600)
  }

  // Auto-resize textarea
  const autoResizeTextarea = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
  }

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  // ---------- Load room + messages ----------
  useEffect(() => {
    let cancelled = false

    async function loadRoom() {
      // Find the room this user belongs to
      const { data: memberRows, error: memberErr } = await supabase
        .from('room_members')
        .select('room_id')
        .eq('user_id', user.id)

      if (memberErr || !memberRows?.length) {
        if (!cancelled) setLoadingMessages(false)
        return
      }

      const rid = memberRows[0].room_id
      if (cancelled) return
      setRoomId(rid)

      // Find the other member and load both profiles
      const { data: allMembers } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', rid)

      if (allMembers) {
        const other = allMembers.find((m) => m.user_id !== user.id)
        if (other) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, display_name, avatar_url')
            .in('user_id', [user.id, other.user_id])

          if (!cancelled && profiles) {
            const mine = profiles.find((p) => p.user_id === user.id)
            const theirs = profiles.find((p) => p.user_id === other.user_id)
            if (mine) {
              setMyName(mine.display_name || '')
              setMyAvatar(mine.avatar_url || DEFAULT_AVATAR)
            }
            if (theirs) {
              setPartnerName(theirs.display_name || 'Friend')
              setPartnerAvatar(theirs.avatar_url || DEFAULT_AVATAR)
            }
          }
        }
      }

      // Load messages
      const { data: msgs, error: msgErr } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', rid)
        .order('created_at', { ascending: true })

      if (!cancelled && !msgErr && msgs) {
        setMessages(msgs)
        setTimeout(() => scrollToBottom('auto'), 50)
      }
      if (!cancelled) setLoadingMessages(false)
    }

    loadRoom()
    return () => { cancelled = true }
  }, [user.id, scrollToBottom])

  // ---------- Realtime subscription ----------
  useEffect(() => {
    if (!roomId) return

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

  // ---------- Signed URLs for photos ----------
  useEffect(() => {
    const photoMsgs = messages.filter(
      (m) => m.message_type === 'photo' && m.media_url && !signedUrls[m.id]
    )
    if (!photoMsgs.length) return

    let cancelled = false
    async function loadUrls() {
      const entries = await Promise.all(
        photoMsgs.map(async (m) => {
          const { data } = await supabase.storage
            .from('chat-photos')
            .createSignedUrl(m.media_url, 3600)
          return [m.id, data?.signedUrl || null]
        })
      )
      if (!cancelled) {
        setSignedUrls((prev) => {
          const next = { ...prev }
          for (const [id, url] of entries) {
            if (url) next[id] = url
          }
          return next
        })
      }
    }
    loadUrls()
    return () => { cancelled = true }
  }, [messages, signedUrls])

  // ---------- Read receipts ----------
  useEffect(() => {
    if (!roomId || !messages.length) return

    const unreadIncoming = messages.filter(
      (m) => m.sender_id !== user.id && !m.read_at
    )
    if (!unreadIncoming.length) return

    const unreadIds = unreadIncoming.map((m) => m.id)
    supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)
      .then(({ error }) => {
        if (!error) {
          setMessages((prev) =>
            prev.map((m) =>
              unreadIds.includes(m.id) ? { ...m, read_at: new Date().toISOString() } : m
            )
          )
        }
      })
  }, [messages, roomId, user.id])

  // ---------- Unread badge auto-clear ----------
  useEffect(() => {
    const el = mainRef.current
    if (!el || !messages.length) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    const hasUnreadIncoming = messages.some(
      (m) => m.sender_id !== user.id && m.created_at > lastSeenAt
    )
    if (atBottom && document.hasFocus() && hasUnreadIncoming) {
      const now = new Date().toISOString()
      setLastSeenAt(now)
      localStorage.setItem('our-space-last-seen', now)
    }
  }, [messages, lastSeenAt, user.id])

  const clearUnread = () => {
    const now = new Date().toISOString()
    setLastSeenAt(now)
    localStorage.setItem('our-space-last-seen', now)
    scrollToBottom()
  }

  const unreadCount = messages.filter(
    (m) => m.sender_id !== user.id && m.created_at > lastSeenAt
  ).length

  // ---------- Typing indicator (Realtime Broadcast) ----------
  useEffect(() => {
    if (!roomId) return

    const channel = supabase.channel(`typing:${roomId}`)
    typingChannelRef.current = channel

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user_id === user.id) return
        setOtherUserTyping(true)
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => setOtherUserTyping(false), TYPING_TIMEOUT)
      })
      .subscribe()

    return () => {
      clearTimeout(typingTimeoutRef.current)
      typingChannelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [roomId, user.id])

  const sendTyping = () => {
    const now = Date.now()
    if (now - lastTypingSentRef.current < 1000) return
    lastTypingSentRef.current = now
    typingChannelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: user.id },
    })
  }

  // Cancel reply/edit/delete/picker on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (replyingTo) setReplyingTo(null)
        if (editingMsg) cancelEdit()
        if (confirmDeleteId) setConfirmDeleteId(null)
        setActiveMsgId(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [replyingTo, editingMsg, confirmDeleteId])

  // ---------- Scroll tracking ----------
  const handleScroll = () => {
    const el = mainRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setShowScrollBtn(!atBottom)
  }

  // Auto-scroll on new messages
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (atBottom) scrollToBottom()
  }, [messages, otherUserTyping, scrollToBottom])

  // ---------- Send message ----------
  const handleSend = async (e) => {
    e.preventDefault()
    const text = inputText.trim()
    if ((!text && !imageFile) || !roomId) return
    if (text.length > MAX_MESSAGE_LENGTH) {
      setSendError(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`)
      return
    }

    setSendError('')
    let mediaPath = null

    if (imageFile) {
      setUploadingImage(true)
      mediaPath = await uploadImage()
      setUploadingImage(false)
      if (!mediaPath) {
        setSendError('Failed to upload image. Try again.')
        return
      }
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        room_id: roomId,
        sender_id: user.id,
        content: text || null,
        message_type: mediaPath ? 'photo' : 'text',
        media_url: mediaPath,
        reply_to: replyingTo?.id || null,
      })
      .select()
      .single()

    if (error) {
      setSendError('Failed to send. Check your connection and try again.')
      return
    }

    setMessages((prev) => {
      if (prev.some((m) => m.id === data.id)) return prev
      return [...prev, data]
    })

    setInputText('')
    setReplyingTo(null)
    clearImage()
    localStorage.removeItem('our-space-draft')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    } else {
      sendTyping()
    }
  }

  const handleSignOut = async () => {
    clearTimeout(typingTimeoutRef.current)
    await supabase.auth.signOut()
  }

  const saveProfile = async ({ displayName, avatarUrl }) => {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        user_id: user.id,
        display_name: displayName,
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      })

    if (!error) {
      setMyName(displayName)
      setMyAvatar(avatarUrl || DEFAULT_AVATAR)
      // Also update auth metadata so it stays in sync
      supabase.auth.updateUser({
        data: { display_name: displayName, avatar_url: avatarUrl },
      })
    }
  }

  const addReaction = async (msgId, emoji) => {
    const msg = messages.find((m) => m.id === msgId)
    if (!msg) return

    const current = msg.reactions || {}
    const updated = { ...current }

    if (updated[user.id] === emoji) {
      delete updated[user.id]
    } else {
      updated[user.id] = emoji
    }

    // Optimistic update
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, reactions: updated } : m))
    )

    // Persist to DB — realtime UPDATE will sync the other user
    const { error } = await supabase
      .from('messages')
      .update({ reactions: updated })
      .eq('id', msgId)

    if (error) {
      // Revert on failure
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, reactions: current } : m))
      )
    }
  }

  // ---------- Image upload ----------
  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      setSendError('Only JPG, PNG, GIF, or WebP images are allowed.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setSendError('Image must be under 5MB.')
      return
    }
    setSendError('')
    setImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreviewUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadImage = async () => {
    if (!imageFile) return null
    const ext = imageFile.name.split('.').pop() || 'jpg'
    const path = `${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage
      .from('chat-photos')
      .upload(path, imageFile)
    if (error) return null
    return path
  }

  // ---------- Edit / Delete ----------
  const startEdit = (msg) => {
    setEditingMsg(msg)
    setEditText(msg.content || '')
  }

  const saveEdit = async () => {
    if (!editingMsg || !editText.trim()) return
    const newContent = editText.trim()
    const { error } = await supabase
      .from('messages')
      .update({ content: newContent, edited_at: new Date().toISOString() })
      .eq('id', editingMsg.id)

    if (!error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editingMsg.id
            ? { ...m, content: newContent, edited_at: new Date().toISOString() }
            : m
        )
      )
    }
    setEditingMsg(null)
    setEditText('')
  }

  const cancelEdit = () => {
    setEditingMsg(null)
    setEditText('')
  }

  const deleteMessage = async (msgId) => {
    const { error } = await supabase.from('messages').delete().eq('id', msgId)
    if (!error) {
      setMessages((prev) => prev.filter((m) => m.id !== msgId))
    }
    setConfirmDeleteId(null)
  }

  // ---------- Format timestamp ----------
  const formatTime = (iso) => {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // ---------- Render ----------
  return (
    <div className="flex flex-col h-dvh w-full bg-black text-white items-center justify-center sm:py-6 sm:px-4 selection:bg-blue-500 selection:text-white">
      <div className="relative flex flex-col w-full sm:max-w-[420px] h-full sm:h-[840px] sm:rounded-3xl sm:border sm:border-white/15 bg-black sm:shadow-2xl overflow-hidden">

        {/* Wallpaper background */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          {/* Previous wallpaper (fades out during crossfade) */}
          {prevWallpaper && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-0 transition-opacity duration-500"
              style={{ backgroundImage: `url(${prevWallpaper})` }}
            />
          )}
          {/* Current wallpaper */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
            style={{ backgroundImage: `url(${selectedWallpaper})` }}
          />
          <div className="absolute inset-0 bg-black/25" />
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle,transparent_55%,rgba(0,0,0,0.55)_100%)]" />
        </div>

        {/* Header */}
        <header className="relative z-20 flex items-center justify-between px-4 py-3 bg-black/45 backdrop-blur-md border-b border-white/15 select-none shrink-0">
          <div className="flex items-center gap-2.5">
            {/* Partner info */}
            <img
              src={partnerAvatar}
              alt={partnerName}
              className="w-9 h-9 rounded-full object-cover ring-1 ring-white/20"
            />
            <h1 className="text-sm font-semibold tracking-tight text-white">{partnerName || 'Friend'}</h1>
            <UnreadBadge count={unreadCount} onClick={clearUnread} />
          </div>

          <div className="flex items-center gap-1.5">
            {/* My avatar — click to edit profile */}
            <button
              onClick={() => setShowProfileModal(true)}
              title="Edit your profile"
              className="relative group cursor-pointer"
            >
              <img
                src={myAvatar}
                alt="Your profile"
                className="w-8 h-8 rounded-full object-cover ring-1 ring-white/20 group-hover:ring-blue-400 transition-all"
              />
              <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5h6m-3-3v6M3 17l3.5-3.5a2.12 2.12 0 013 0L12 14m0 0l1.586-1.586a2.12 2.12 0 013 0L21 12" />
                </svg>
              </span>
            </button>

            <button
              onClick={() => setShowWallpaperModal(true)}
              title="Change Wallpaper"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white/90 transition-all border border-white/10 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="text-[10px] px-2 py-1 rounded-md font-medium border bg-white/15 border-white/20 text-white hover:bg-white/25 transition-all cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Messages */}
        <main
          ref={mainRef}
          onClick={() => setActiveMsgId(null)}
          onScroll={handleScroll}
          className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden px-4 pt-8 pb-6 space-y-5 focus:outline-none chat-scrollbar"
          tabIndex={0}
          aria-label="Message history"
        >
          <div className="text-center my-2">
            <span className="text-[10px] uppercase tracking-widest px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-white/60 font-medium">
              Our Space • Encrypted
            </span>
          </div>

          {loadingMessages ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-12 h-12 rounded-full bg-slate-800/85 flex items-center justify-center mb-3 text-slate-400">💬</div>
              <p className="text-sm font-medium text-slate-300">No messages yet</p>
              <p className="text-xs text-slate-500 mt-1">Say hello to start the conversation.</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isOutgoing = msg.sender_id === user.id
              const isPhoto = msg.message_type === 'photo' && msg.media_url
              const showDate = idx === 0 ||
                getDateLabel(msg.created_at) !== getDateLabel(messages[idx - 1].created_at)
              const myReaction = msg.reactions?.[user.id]
              const reactions = msg.reactions || {}
              const repliedMsg = msg.reply_to ? messages.find((m) => m.id === msg.reply_to) : null
              const isEditing = editingMsg?.id === msg.id
              const showDeleteConfirm = confirmDeleteId === msg.id
              const photoUrl = signedUrls[msg.id] || msg.media_url
              const emojiCounts = {}
              for (const emoji of Object.values(reactions)) {
                emojiCounts[emoji] = (emojiCounts[emoji] || 0) + 1
              }

              return (
                <div key={msg.id}>
                  {showDate && <DateSeparator label={getDateLabel(msg.created_at)} />}

                  <div
                    className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'} group relative message-enter`}
                  >
                    <div className={`flex items-end gap-2 max-w-[85%] ${isOutgoing ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!isOutgoing && (
                        <img
                          src={partnerAvatar}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover mb-1 ring-1 ring-white/15 shrink-0"
                        />
                      )}

                      <div className="relative max-w-full">
                        {/* Reaction picker on hover */}
                        <ReactionPicker
                          myReaction={myReaction}
                          open={activeMsgId === msg.id}
                          onReact={(emoji) => { addReaction(msg.id, emoji); setActiveMsgId(null) }}
                          onReply={() => { setReplyingTo(msg); setActiveMsgId(null) }}
                          onEdit={() => { startEdit(msg); setActiveMsgId(null) }}
                          onDelete={() => { setConfirmDeleteId(msg.id); setActiveMsgId(null) }}
                          isOwn={isOutgoing}
                          side={isOutgoing ? 'right' : 'left'}
                        />

                        <div
                          onClick={(e) => { e.stopPropagation(); setActiveMsgId((prev) => (prev === msg.id ? null : msg.id)) }}
                          className={`relative px-3.5 py-2.5 rounded-2xl text-sm leading-snug shadow-md backdrop-blur-md cursor-pointer select-none ${
                            isOutgoing
                              ? 'bg-[#007aff] text-white rounded-br-xs'
                              : 'bg-[#262629]/90 text-white rounded-bl-xs border border-white/10'
                          }`}
                        >
                          {/* Quoted reply */}
                          {repliedMsg && (
                            <div
                              className={`mb-1.5 px-2.5 py-1.5 rounded-lg text-xs border-l-2 ${
                                isOutgoing
                                  ? 'bg-white/15 border-white/40'
                                  : 'bg-white/5 border-white/25'
                              }`}
                            >
                              <p className={`font-medium mb-0.5 ${isOutgoing ? 'text-blue-100' : 'text-blue-300'}`}>
                                {repliedMsg.sender_id === user.id ? 'You' : partnerName || 'Friend'}
                              </p>
                              <p className={`truncate max-w-[250px] ${isOutgoing ? 'text-white/70' : 'text-white/50'}`}>
                                {repliedMsg.message_type === 'photo' ? '📷 Photo' : repliedMsg.content || '...'}
                              </p>
                            </div>
                          )}

                          {isPhoto && (
                            <div
                              className="mb-1.5 -mx-1 -mt-1 overflow-hidden rounded-xl cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); setViewingPhoto(photoUrl) }}
                            >
                              <img
                                src={photoUrl}
                                alt="Attachment"
                                className="w-full max-h-56 object-cover hover:scale-[1.02] transition-transform duration-200"
                              />
                            </div>
                          )}

                          {/* Delete confirmation */}
                          {showDeleteConfirm && (
                            <div onClick={(e) => e.stopPropagation()} className="mb-2 p-2.5 rounded-xl bg-red-500/15 border border-red-500/25 text-xs">
                              <p className="text-red-200 mb-2">Delete this message?</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => deleteMessage(msg.id)}
                                  className="flex-1 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white font-medium transition-colors cursor-pointer"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="flex-1 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Edit mode */}
                          {isEditing ? (
                            <div onClick={(e) => e.stopPropagation()}>
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    saveEdit()
                                  }
                                  if (e.key === 'Escape') cancelEdit()
                                }}
                                rows={2}
                                autoFocus
                                className={`w-full rounded-lg px-2.5 py-1.5 text-sm resize-none focus:outline-none ${
                                  isOutgoing
                                    ? 'bg-white/15 text-white placeholder-white/40 border border-white/20'
                                    : 'bg-white/10 text-white placeholder-white/40 border border-white/15'
                                }`}
                              />
                              <div className="flex gap-1.5 mt-1.5">
                                <button
                                  onClick={saveEdit}
                                  className="px-2.5 py-1 rounded-md bg-blue-500 hover:bg-blue-400 text-white text-xs font-medium transition-colors cursor-pointer"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/15 text-white text-xs transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            msg.content && (
                              <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.content}</p>
                            )
                          )}

                          <div className={`flex items-center justify-end gap-1 text-[10px] mt-1 select-none ${isOutgoing ? 'text-white/70' : 'text-white/40'}`}>
                            {msg.edited_at && <span className="italic opacity-70">edited</span>}
                            <span>{formatTime(msg.created_at)}</span>
                            {isOutgoing && (
                              <span className={`font-bold ${msg.read_at ? 'text-blue-200' : 'text-white/50'}`} title={msg.read_at ? 'Read' : 'Sent'}>
                                {msg.read_at ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Reaction chips */}
                        {Object.keys(emojiCounts).length > 0 && (
                          <div
                            className={`absolute -bottom-3 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#1c1c1e] border border-white/20 shadow-lg text-xs z-20 ${
                              isOutgoing ? 'right-2' : 'left-2'
                            }`}
                          >
                            {Object.entries(emojiCounts).map(([emoji, count]) => (
                              <span key={emoji} className="flex items-center gap-0.5">
                                {emoji}
                                {count > 1 && <span className="text-[10px] text-white/60">{count}</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}

          {otherUserTyping && <TypingIndicator name={partnerName} />}
          <div ref={messagesEndRef} />
        </main>

        {showScrollBtn && <ScrollToBottom onClick={() => scrollToBottom()} />}

        {/* Send error */}
        {sendError && (
          <div className="relative z-20 px-4 py-1.5 bg-red-500/15 border-t border-red-500/25 text-xs text-red-300 shrink-0">
            {sendError}
          </div>
        )}

        {/* Reply preview bar */}
        {replyingTo && (
          <div className="relative z-20 px-4 py-2 bg-black/60 backdrop-blur-md border-t border-white/10 flex items-center gap-3 shrink-0">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-blue-300 font-medium">
                Replying to {replyingTo.sender_id === user.id ? 'yourself' : (partnerName || 'Friend')}
              </p>
              <p className="text-xs text-white/50 truncate">
                {replyingTo.message_type === 'photo' ? '📷 Photo' : replyingTo.content || '...'}
              </p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              aria-label="Cancel reply"
              className="text-white/40 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Image upload preview bar */}
        <ImageUploadPreview
          file={imageFile}
          previewUrl={imagePreviewUrl}
          onCancel={clearImage}
          uploading={uploadingImage}
        />

        {/* Composer */}
        <footer className="relative z-20 p-3 bg-black/50 backdrop-blur-2xl border-t border-white/15 shrink-0 pb-safe">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileSelect}
              className="hidden"
              aria-label="Choose image"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white/80 flex items-center justify-center transition-colors border border-white/10 shrink-0 cursor-pointer disabled:opacity-50"
              title="Send a photo"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>

            <div className="flex-1 relative flex items-end">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value)
                  localStorage.setItem('our-space-draft', e.target.value)
                  autoResizeTextarea()
                }}
                onKeyDown={handleKeyDown}
                placeholder="Message"
                rows={1}
                maxLength={MAX_MESSAGE_LENGTH}
                aria-label="Message input"
                className="w-full bg-[#1c1c1e]/90 border border-white/15 text-white placeholder-white/40 text-sm rounded-2xl pl-4 pr-10 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner resize-none leading-snug max-h-[140px] overflow-y-auto chat-scrollbar"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                aria-label="Send"
                className={`absolute right-1.5 bottom-1.5 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  inputText.trim()
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
        </footer>
      </div>

      <WallpaperPicker
        wallpapers={WALLPAPERS}
        selected={selectedWallpaper}
        onSelect={setSelectedWallpaper}
        onClose={() => setShowWallpaperModal(false)}
        open={showWallpaperModal}
      />

      <ProfileEdit
        open={showProfileModal}
        currentName={myName}
        currentAvatar={myAvatar}
        onSave={saveProfile}
        onClose={() => setShowProfileModal(false)}
      />

      <PhotoViewer url={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </div>
  )
}
