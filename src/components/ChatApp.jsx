import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { WALLPAPERS } from '../constants'
import TypingIndicator from './TypingIndicator'
import ScrollToBottom from './ScrollToBottom'
import WallpaperPicker from './WallpaperPicker'
import ProfileEdit from './ProfileEdit'
import PhotoViewer from './PhotoViewer'
import PhotoGallery from './PhotoGallery'
import { buzz, HAPTIC } from '../lib/haptics'
import ReactionPicker from './ReactionPicker'
import DateSeparator from './DateSeparator'
import ImageUploadPreview from './ImageUploadPreview'
import UnreadBadge from './UnreadBadge'
import VoiceRecorder from './VoiceRecorder'
import VoicePlayer from './VoicePlayer'
import Composer from './Composer'
import { getDateLabel, formatLastSeen } from '../utils/dates'
import { linkify } from '../utils/linkify'

const MAX_MESSAGE_LENGTH = 2000
const PULL_THRESHOLD = 72 // px of pull to trigger reload
const TYPING_TIMEOUT = 3000
const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#2a2a2e"/><circle cx="60" cy="47" r="21" fill="#6b6b70"/><path d="M18 116c4-25 21-38 42-38s38 13 42 38z" fill="#6b6b70"/></svg>`
  )

export default function ChatApp({ session }) {
  const user = session.user

  const [messages, setMessages] = useState([])
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
  const [partnerLastSeen, setPartnerLastSeen] = useState(null)
  const [presenceNow, setPresenceNow] = useState(() => Date.now())
  const [pinnedMessageId, setPinnedMessageId] = useState(null)
  const [showGallery, setShowGallery] = useState(false)
  const [channelStatus, setChannelStatus] = useState('SUBSCRIBED')
  const [privacyBlur, setPrivacyBlur] = useState(false)
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
  const [copiedToast, setCopiedToast] = useState(null)
  const [recording, setRecording] = useState(false)
  const copyTimerRef = useRef(null)
  const toastTimerRef = useRef(null)
  const [signedUrls, setSignedUrls] = useState({})
  const [lastSeenAt, setLastSeenAt] = useState(() =>
    localStorage.getItem('our-space-last-seen') || new Date(0).toISOString()
  )

  const messagesEndRef = useRef(null)
  const mainRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const lastTypingSentRef = useRef(0)
  const typingChannelRef = useRef(null)
  const partnerUserIdRef = useRef(null)
  const wallpaperRef = useRef(selectedWallpaper)
  const pendingFilesRef = useRef({}) // tempId → File/Blob awaiting upload
  const previewUrlsRef = useRef({}) // tempId → local object URL
  const forceBottomRef = useRef(false) // next messages change → instant jump to sent message
  const [pullDist, setPullDist] = useState(0) // header pull-to-reload distance
  const pullRef = useRef({ startY: 0, active: false, engaged: false })
  const suppressClickUntilRef = useRef(0) // swallows taps that were actually drags

  // ---------- Header pull-to-reload ----------
  const onPullDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pullRef.current = { startY: e.clientY, active: true, engaged: false }
  }

  const onPullMove = (e) => {
    const s = pullRef.current
    if (!s.active) return
    const dy = e.clientY - s.startY
    if (dy > 8) s.engaged = true
    setPullDist(s.engaged ? Math.max(0, Math.min(dy * 0.5, 96)) : 0)
  }

  const onPullEnd = (e) => {
    const s = pullRef.current
    if (!s.active) return
    s.active = false
    if (s.engaged) suppressClickUntilRef.current = Date.now() + 400
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* pointer already released */
    }
    if (s.engaged && pullDist >= PULL_THRESHOLD) {
      window.location.reload()
      return // keep the indicator up while the page reloads
    }
    setPullDist(0)
  }

  const onHeaderClickCapture = (e) => {
    if (Date.now() < suppressClickUntilRef.current) {
      e.stopPropagation()
      e.preventDefault()
    }
  }

  // Persist wallpaper + crossfade
  const setSelectedWallpaper = (url) => {
    setPrevWallpaper(selectedWallpaper)
    setSelectedWallpaperState(url)
    wallpaperRef.current = url
    localStorage.setItem('our-space-wallpaper', url)
    setTimeout(() => setPrevWallpaper(null), 600)
    if (roomId) {
      supabase.from('rooms').update({ wallpaper_url: url }).eq('id', roomId).then(() => {})
    }
  }

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const el = mainRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
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

      // Load room-level state (pinned message + shared wallpaper)
      const { data: roomRow } = await supabase
        .from('rooms')
        .select('pinned_message_id, wallpaper_url')
        .eq('id', rid)
        .single()

      if (!cancelled && roomRow) {
        setPinnedMessageId(roomRow.pinned_message_id || null)
        if (roomRow.wallpaper_url) {
          setSelectedWallpaperState(roomRow.wallpaper_url)
          wallpaperRef.current = roomRow.wallpaper_url
          localStorage.setItem('our-space-wallpaper', roomRow.wallpaper_url)
        }
      }

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
            .select('user_id, display_name, avatar_url, last_seen_at')
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
              setPartnerLastSeen(theirs.last_seen_at)
              partnerUserIdRef.current = theirs.user_id
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
          if (payload.new.sender_id !== user.id) {
            setPartnerLastSeen(payload.new.created_at)
            buzz(HAPTIC.receive)
          }
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev
            // Own echo racing the insert promise → swap the matching pending bubble
            if (payload.new.sender_id === user.id) {
              const idx = prev.findIndex(
                (m) =>
                  m.pending &&
                  m.sender_id === user.id &&
                  (m.content || null) === (payload.new.content || null) &&
                  m.message_type === payload.new.message_type &&
                  (m.reply_to || null) === (payload.new.reply_to || null)
              )
              if (idx !== -1) {
                const preview = prev[idx].localPreviewUrl
                const next = [...prev]
                next[idx] = preview
                  ? { ...payload.new, localPreviewUrl: preview }
                  : payload.new
                return next
              }
            }
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
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id))
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          setPinnedMessageId(payload.new.pinned_message_id || null)
          if (
            payload.new.wallpaper_url &&
            payload.new.wallpaper_url !== wallpaperRef.current
          ) {
            setPrevWallpaper(wallpaperRef.current)
            setSelectedWallpaperState(payload.new.wallpaper_url)
            wallpaperRef.current = payload.new.wallpaper_url
            localStorage.setItem('our-space-wallpaper', payload.new.wallpaper_url)
            setTimeout(() => setPrevWallpaper(null), 600)
          }
        }
      )
      .subscribe((status) => {
        setChannelStatus(status)
      })

    const handleOnline = () => setChannelStatus('SUBSCRIBED')
    const handleOffline = () => setChannelStatus('CHANNEL_ERROR')
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      supabase.removeChannel(channel)
    }
  }, [roomId, user.id])

  const isReconnecting =
    channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT' || channelStatus === 'CLOSED'

  // ---------- Signed URLs for photos + voice ----------
  useEffect(() => {
    const mediaMsgs = messages.filter(
      (m) =>
        (m.message_type === 'photo' || m.message_type === 'voice') &&
        m.media_url &&
        !m.media_url.startsWith('http') && // GIFs hotlink Giphy CDN — nothing to sign
        !signedUrls[m.id]
    )
    if (!mediaMsgs.length) return

    let cancelled = false
    async function loadUrls() {
      const entries = await Promise.all(
        mediaMsgs.map(async (m) => {
          const bucket = m.message_type === 'voice' ? 'chat-audio' : 'chat-photos'
          try {
            const { data } = await supabase.storage
              .from(bucket)
              .createSignedUrl(m.media_url, 3600)
            return [m.id, data?.signedUrl || null]
          } catch {
            return [m.id, null]
          }
        })
      )
      if (cancelled) return

      const succeeded = entries.filter(([, url]) => url)
      // All failed → leave state untouched so the effect doesn't re-run
      // and hammer the API in a loop. They retry on the next message change.
      if (!succeeded.length) return

      const ids = succeeded.map(([id]) => id)
      setSignedUrls((prev) => {
        const next = { ...prev }
        for (const [id, url] of succeeded) next[id] = url
        return next
      })

      // Signed URL took over → release the local blob from memory
      if (messages.some((m) => ids.includes(m.id) && m.localPreviewUrl)) {
        setMessages((prev) =>
          prev.map((m) =>
            ids.includes(m.id) && m.localPreviewUrl
              ? { ...m, localPreviewUrl: null }
              : m
          )
        )
      }
      for (const id of ids) {
        const url = previewUrlsRef.current[id]
        if (url) {
          URL.revokeObjectURL(url)
          delete previewUrlsRef.current[id]
        }
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

  const galleryPhotos = messages
    .filter(
      (m) =>
        m.message_type === 'photo' &&
        (signedUrls[m.id] || (m.media_url && m.media_url.startsWith('http')))
    )
    .map((m) => ({ id: m.id, url: signedUrls[m.id] || m.media_url }))
    .reverse()

  // ---------- Presence: heartbeat + partner last-seen ----------
  useEffect(() => {
    let cancelled = false

    const beat = () => {
      if (document.visibilityState !== 'visible') return
      supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .then(() => {})
    }
    beat()
    const beatTimer = setInterval(beat, 30000)

    const refreshPartner = async () => {
      const pid = partnerUserIdRef.current
      if (!pid) return
      const { data } = await supabase
        .from('profiles')
        .select('last_seen_at')
        .eq('user_id', pid)
        .single()
      if (!cancelled && data) setPartnerLastSeen(data.last_seen_at)
    }

    const poll = setInterval(refreshPartner, 20000)
    const onFocus = () => refreshPartner()
    window.addEventListener('focus', onFocus)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        beat()
        refreshPartner()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    const tick = setInterval(() => setPresenceNow(Date.now()), 30000)

    return () => {
      cancelled = true
      clearInterval(beatTimer)
      clearInterval(poll)
      clearInterval(tick)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user.id])

  // ---------- Privacy blur (app switcher) ----------
  useEffect(() => {
    const onVis = () => setPrivacyBlur(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

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
    if (now - lastTypingSentRef.current < 400) return
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
        if (editingMsg) {
          setEditingMsg(null)
          setEditText('')
        }
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
    if (forceBottomRef.current) {
      forceBottomRef.current = false
      el.scrollTo({ top: el.scrollHeight, behavior: 'instant' })
      return
    }
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (atBottom) scrollToBottom()
  }, [messages, otherUserTyping, scrollToBottom])

  // ---------- Send message (optimistic — bubble appears instantly) ----------
  const isTempId = (id) => typeof id === 'string' && id.startsWith('temp-')

  const appendOptimistic = ({ content, message_type, media_url, media_metadata, reply_to, localPreviewUrl }) => {
    const tempId = `temp-${crypto.randomUUID()}`
    previewUrlsRef.current[tempId] = localPreviewUrl || null
    forceBottomRef.current = true // focus on the message being sent — no drift
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        room_id: roomId,
        sender_id: user.id,
        content: content ?? null,
        message_type,
        media_url: media_url || null,
        media_metadata: media_metadata || null,
        reply_to: reply_to || null,
        read_at: null,
        created_at: new Date().toISOString(),
        pending: true,
        failed: false,
        localPreviewUrl: localPreviewUrl || null,
        uploadPath: null,
      },
    ])
    return tempId
  }

  const settlePending = (tempId, realMsg) => {
    const preview = previewUrlsRef.current[tempId]
    delete previewUrlsRef.current[tempId]
    delete pendingFilesRef.current[tempId]
    const msg = preview ? { ...realMsg, localPreviewUrl: preview } : realMsg
    setMessages((prev) => {
      const withoutDup = prev.filter((m) => m.id !== msg.id)
      if (withoutDup.some((m) => m.id === tempId)) {
        return withoutDup.map((m) => (m.id === tempId ? msg : m))
      }
      return [...withoutDup, msg]
    })
  }

  const failPending = (tempId) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m))
    )
  }

  const uploadMedia = async (messageType, file) => {
    const isVoice = messageType === 'voice'
    let ext
    if (isVoice) {
      const t = file.type || ''
      ext = t.includes('mp4') ? 'm4a' : t.includes('ogg') ? 'ogg' : t.includes('wav') ? 'wav' : 'webm'
    } else {
      ext = file.name?.split('.').pop() || 'jpg'
    }
    const path = `${crypto.randomUUID()}.${ext}`
    const bucket = isVoice ? 'chat-audio' : 'chat-photos'
    const opts = isVoice ? { contentType: file.type || 'audio/webm' } : undefined
    const { error } = await supabase.storage.from(bucket).upload(path, file, opts)
    return error ? null : path
  }

  const deliver = async (tempMsg) => {
    let path = tempMsg.media_url || tempMsg.uploadPath || null
    const file = pendingFilesRef.current[tempMsg.id]

    if (!path && file) {
      setUploadingImage(true)
      path = await uploadMedia(tempMsg.message_type, file)
      setUploadingImage(false)
      if (!path) {
        failPending(tempMsg.id)
        setSendError('Upload failed — tap “Retry” on the message.')
        return
      }
      delete pendingFilesRef.current[tempMsg.id]
      setMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? { ...m, uploadPath: path } : m)))
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        room_id: roomId,
        sender_id: user.id,
        content: tempMsg.content || null,
        message_type: tempMsg.message_type,
        media_url: path,
        media_metadata: tempMsg.media_metadata || null,
        reply_to: tempMsg.reply_to || null,
      })
      .select()
      .single()

    if (error) {
      failPending(tempMsg.id)
      setSendError('Message failed to send — tap “Retry”.')
      return
    }

    settlePending(tempMsg.id, data)
  }

  const handleSend = (text) => {
    if ((!text && !imageFile) || !roomId) return false
    if (text.length > MAX_MESSAGE_LENGTH) {
      setSendError(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`)
      return false
    }

    setSendError('')
    const file = imageFile || null
    const messageType = file ? 'photo' : 'text'
    const replyId = replyingTo && !isTempId(replyingTo.id) ? replyingTo.id : null
    const localPreviewUrl = file ? URL.createObjectURL(file) : null

    const tempId = appendOptimistic({
      content: text || null,
      message_type: messageType,
      reply_to: replyId,
      localPreviewUrl,
    })
    if (file) pendingFilesRef.current[tempId] = file

    // Instant UI reset — Composer clears its own input on true
    setReplyingTo(null)
    clearImage()
    buzz(HAPTIC.send)

    deliver({
      id: tempId,
      content: text || null,
      message_type: messageType,
      reply_to: replyId,
      media_metadata: null,
      media_url: null,
      uploadPath: null,
    })
    return true
  }

  // ---------- GIF + stickers ----------
  const handleGifSend = (gif) => {
    if (!roomId || !gif?.url) return
    setSendError('')
    const replyId = replyingTo && !isTempId(replyingTo.id) ? replyingTo.id : null
    const tempId = appendOptimistic({
      content: null,
      message_type: 'photo',
      media_url: gif.url,
      media_metadata: { gif: true },
      reply_to: replyId,
    })
    setReplyingTo(null)
    buzz(HAPTIC.gif)
    deliver({
      id: tempId,
      content: null,
      message_type: 'photo',
      reply_to: replyId,
      media_url: gif.url,
      media_metadata: { gif: true },
      uploadPath: null,
    })
  }

  const handleStickerSend = (emoji) => {
    if (!roomId || !emoji) return
    setSendError('')
    const replyId = replyingTo && !isTempId(replyingTo.id) ? replyingTo.id : null
    const tempId = appendOptimistic({
      content: emoji,
      message_type: 'text',
      media_metadata: { sticker: true },
      reply_to: replyId,
    })
    setReplyingTo(null)
    buzz(HAPTIC.sticker)
    deliver({
      id: tempId,
      content: emoji,
      message_type: 'text',
      reply_to: replyId,
      media_metadata: { sticker: true },
      media_url: null,
      uploadPath: null,
    })
  }

  const retrySend = (msgId) => {
    const m = messages.find((x) => x.id === msgId)
    if (!m || !m.failed) return
    setSendError('')
    setMessages((prev) =>
      prev.map((x) => (x.id === msgId ? { ...x, pending: true, failed: false } : x))
    )
    deliver({
      id: m.id,
      content: m.content,
      message_type: m.message_type,
      reply_to: m.reply_to,
      media_url: m.media_url,
      media_metadata: m.media_metadata,
      uploadPath: m.uploadPath,
    })
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
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(null)
    setImagePreviewUrl('')
  }

  // ---------- Voice messages ----------
  const handleVoiceCancel = (reason) => {
    setRecording(false)
    if (reason === 'blocked') {
      showToast('Microphone blocked — check browser permissions')
    }
  }

  const handleVoiceSend = (blob, duration) => {
    setRecording(false)
    if (!roomId) return

    const replyId = replyingTo && !isTempId(replyingTo.id) ? replyingTo.id : null
    const localPreviewUrl = URL.createObjectURL(blob)
    const tempId = appendOptimistic({
      content: null,
      message_type: 'voice',
      media_metadata: { duration },
      reply_to: replyId,
      localPreviewUrl,
    })
    pendingFilesRef.current[tempId] = blob
    setReplyingTo(null)
    buzz(HAPTIC.send)

    deliver({
      id: tempId,
      content: null,
      message_type: 'voice',
      reply_to: replyId,
      media_metadata: { duration },
      media_url: null,
      uploadPath: null,
    })
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
    const msg = messages.find((m) => m.id === msgId)
    const { error } = await supabase.from('messages').delete().eq('id', msgId)
    if (!error) {
      setMessages((prev) => prev.filter((m) => m.id !== msgId))
      // Best-effort: also remove the backing file (photo/voice)
      // GIFs hotlink the Giphy CDN — no storage file to remove
      if (msg?.media_url && !msg.media_url.startsWith('http')) {
        const bucket = msg.message_type === 'voice' ? 'chat-audio' : 'chat-photos'
        supabase.storage.from(bucket).remove([msg.media_url]).then(() => {})
      }
      if (msg?.localPreviewUrl) URL.revokeObjectURL(msg.localPreviewUrl)
      delete previewUrlsRef.current[msgId]
      delete pendingFilesRef.current[msgId]
    }
    setConfirmDeleteId(null)
  }

  // ---------- Pin / unpin ----------
  const togglePin = async (msgId) => {
    if (!roomId) return
    const next = pinnedMessageId === msgId ? null : msgId
    setPinnedMessageId(next)
    supabase.from('rooms').update({ pinned_message_id: next }).eq('id', roomId).then(() => {})
  }

  // ---------- Copy on long-press / right-click + swipe-to-reply ----------
  const suppressClickRef = useRef(false)
  const swipeRef = useRef(null)

  const showToast = (msg = 'Copied') => {
    setCopiedToast(msg)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setCopiedToast(null), 1200)
  }

  const copyMessage = (msg) => {
    if (!msg.content) return
    navigator.clipboard.writeText(msg.content).then(showToast)
  }

  const handleBubbleTouchStart = (msg, e) => {
    const t = e.touches[0]
    swipeRef.current = { msg, startX: t.clientX, startY: t.clientY, decided: false, swiping: false, offset: 0 }
    clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => {
      suppressClickRef.current = true
      copyMessage(msg)
    }, 500)
  }

  const handleBubbleTouchMove = (e) => {
    const s = swipeRef.current
    if (!s) return
    const t = e.touches[0]
    const dx = t.clientX - s.startX
    const dy = t.clientY - s.startY
    if (!s.decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      s.decided = true
      s.swiping = dx > 0 && Math.abs(dx) > Math.abs(dy)
      clearTimeout(copyTimerRef.current)
    }
    if (!s.swiping) return
    const bubbleCol = e.currentTarget.parentElement
    const offset = Math.min(Math.max(dx, 0), 80)
    s.offset = offset
    bubbleCol.style.transition = 'none'
    bubbleCol.style.transform = `translateX(${offset}px)`
    const arrow = bubbleCol.querySelector('.swipe-reply-arrow')
    if (arrow) arrow.style.opacity = String(Math.min(offset / 48, 1))
  }

  const handleBubbleTouchEnd = (e) => {
    clearTimeout(copyTimerRef.current)
    const s = swipeRef.current
    swipeRef.current = null
    if (!s?.swiping) return
    const bubbleCol = e.currentTarget.parentElement
    bubbleCol.style.transition = 'transform 0.2s ease'
    bubbleCol.style.transform = 'translateX(0)'
    const arrow = bubbleCol.querySelector('.swipe-reply-arrow')
    if (arrow) arrow.style.opacity = '0'
    if (s.offset >= 48 && !s.msg.pending && !s.msg.failed) {
      suppressClickRef.current = true
      setReplyingTo(s.msg)
    }
  }

  const handleBubbleClick = (msgId, e) => {
    e.stopPropagation()
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    setActiveMsgId((prev) => (prev === msgId ? null : msgId))
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

        {/* Header — pull down anywhere on it to reload */}
        <header
          onPointerDown={onPullDown}
          onPointerMove={onPullMove}
          onPointerUp={onPullEnd}
          onPointerCancel={onPullEnd}
          onClickCapture={onHeaderClickCapture}
          onDragStart={(e) => e.preventDefault()}
          style={{ touchAction: 'none' }}
          className="relative z-20 flex items-center justify-between px-4 py-3 bg-black/45 backdrop-blur-md border-b border-white/15 select-none shrink-0"
        >
          {/* Pull indicator */}
          {pullDist > 0 && (
            <div
              className="absolute left-1/2 top-full pointer-events-none flex flex-col items-center"
              style={{ transform: `translateX(-50%) translateY(${pullDist}px)`, opacity: Math.min(pullDist / 32, 1) }}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${
                  pullDist >= PULL_THRESHOLD
                    ? 'bg-blue-500 border-blue-400 text-white'
                    : 'bg-black/60 border-white/25 text-white/80'
                }`}
              >
                <svg
                  className="w-4 h-4"
                  style={{ transform: `rotate(${pullDist * 4}deg)` }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2.5">
            {/* Partner info */}
            <img
              src={partnerAvatar}
              alt={partnerName}
              className="w-9 h-9 rounded-full object-cover ring-1 ring-white/20"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-semibold tracking-tight text-white">{partnerName || 'Friend'}</h1>
                <UnreadBadge count={unreadCount} onClick={clearUnread} />
              </div>
              <span className="flex items-center gap-1 text-[11px] text-white/50">
                {(() => {
                  const status = formatLastSeen(partnerLastSeen, presenceNow)
                  const isOnline = status === 'Active now'
                  return (
                    <>
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? 'bg-green-400' : 'bg-white/30'}`}
                      />
                      {status}
                    </>
                  )
                })()}
              </span>
            </div>
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
              onClick={() => setShowGallery(true)}
              title="Shared photos"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white/90 transition-all border border-white/10 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
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

        {/* Reconnect banner */}
        {isReconnecting && (
          <div className="relative z-20 flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-500/15 border-b border-amber-400/25 backdrop-blur-md shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] text-amber-200 font-medium">Connection lost — reconnecting…</span>
          </div>
        )}

        {/* Pinned message bar */}
        {(() => {
          const pinned = messages.find((m) => m.id === pinnedMessageId)
          if (!pinned) return null
          const sender = pinned.sender_id === user.id ? 'You' : (partnerName || 'Friend')
          return (
            <div className="relative z-20 px-4 py-2 bg-black/50 backdrop-blur-md border-b border-white/10 flex items-center gap-3 shrink-0">
              <span className="text-amber-300 shrink-0">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </span>
              <button
                onClick={() => {
                  const el = document.getElementById(`msg-${pinned.id}`)
                  const main = mainRef.current
                  if (el && main) {
                    main.scrollTo({
                      top: el.offsetTop - main.clientHeight / 2 + el.offsetHeight / 2,
                      behavior: 'smooth',
                    })
                  }
                }}
                className="flex-1 min-w-0 text-left cursor-pointer"
              >
                <p className="text-[11px] text-amber-300/90 font-medium">Pinned · {sender}</p>
                <p className="text-xs text-white/60 truncate">
                  {pinned.message_type === 'photo' ? '📷 Photo'
                    : pinned.message_type === 'voice' ? '🎤 Voice'
                    : pinned.content || '...'}
                </p>
              </button>
              <button
                onClick={() => togglePin(pinned.id)}
                aria-label="Unpin"
                className="text-white/40 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )
        })()}

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
              const isPhoto =
                msg.message_type === 'photo' && (msg.media_url || msg.localPreviewUrl)
              const isVoice =
                msg.message_type === 'voice' && (msg.media_url || msg.localPreviewUrl)
              const isPendingMsg = !!msg.pending
              const isFailedMsg = !!msg.failed
              const isSticker = msg.message_type === 'text' && !!msg.media_metadata?.sticker
              const isGif = msg.message_type === 'photo' && !!msg.media_metadata?.gif
              const showDate = idx === 0 ||
                getDateLabel(msg.created_at) !== getDateLabel(messages[idx - 1].created_at)
              const myReaction = msg.reactions?.[user.id]
              const reactions = msg.reactions || {}
              const repliedMsg = msg.reply_to ? messages.find((m) => m.id === msg.reply_to) : null
              const isEditing = editingMsg?.id === msg.id
              const showDeleteConfirm = confirmDeleteId === msg.id
              const photoUrl = signedUrls[msg.id] || msg.localPreviewUrl || msg.media_url
              const emojiCounts = {}
              for (const emoji of Object.values(reactions)) {
                emojiCounts[emoji] = (emojiCounts[emoji] || 0) + 1
              }

              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className="[content-visibility:auto] [contain-intrinsic-size:auto_100px]"
                >
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
                        {/* Swipe-to-reply arrow */}
                        <span className="swipe-reply-arrow absolute -left-8 top-1/2 -translate-y-1/2 text-white/70 opacity-0 pointer-events-none select-none">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2m0 0l-3-3m3 3l3-3" />
                          </svg>
                        </span>

                        {/* Reaction picker on hover */}
                        {!isPendingMsg && !isFailedMsg && (
                          <ReactionPicker
                            myReaction={myReaction}
                            open={activeMsgId === msg.id}
                            onReact={(emoji) => { addReaction(msg.id, emoji); setActiveMsgId(null) }}
                            onReply={() => { setReplyingTo(msg); setActiveMsgId(null) }}
                            onEdit={() => { startEdit(msg); setActiveMsgId(null) }}
                            onDelete={() => { setConfirmDeleteId(msg.id); setActiveMsgId(null) }}
                            onPin={() => { togglePin(msg.id); setActiveMsgId(null) }}
                            isPinned={pinnedMessageId === msg.id}
                            isOwn={isOutgoing}
                            side={isOutgoing ? 'right' : 'left'}
                          />
                        )}

                        <div
                          onClick={(e) => handleBubbleClick(msg.id, e)}
                          onTouchStart={(e) => handleBubbleTouchStart(msg, e)}
                          onTouchMove={handleBubbleTouchMove}
                          onTouchEnd={handleBubbleTouchEnd}
                          onContextMenu={(e) => { e.preventDefault(); copyMessage(msg) }}
                          className={`relative rounded-2xl text-sm leading-snug cursor-pointer select-none ${
                            isSticker
                              ? ''
                              : `px-3.5 py-2.5 shadow-md backdrop-blur-md ${
                                  isOutgoing
                                    ? 'bg-[#007aff] text-white rounded-br-xs'
                                    : 'bg-[#262629]/90 text-white rounded-bl-xs border border-white/10'
                                }`
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
                                {repliedMsg.message_type === 'photo'
                                  ? (repliedMsg.media_metadata?.gif ? '🎞 GIF' : '📷 Photo')
                                  : repliedMsg.message_type === 'voice' ? '🎤 Voice'
                                  : repliedMsg.content || '...'}
                              </p>
                            </div>
                          )}

                          {isPhoto && (
                            <div
                              className={`relative mb-1.5 -mx-1 -mt-1 overflow-hidden rounded-xl ${photoUrl ? 'cursor-pointer' : ''}`}
                              onClick={(e) => { if (!photoUrl) return; e.stopPropagation(); setViewingPhoto(photoUrl) }}
                            >
                              {photoUrl ? (
                                <>
                                  <img
                                    src={photoUrl}
                                    alt="Attachment"
                                    decoding="async"
                                    className={`w-full object-cover ${isGif ? 'max-h-52 max-w-[240px]' : 'max-h-56'} ${isPendingMsg ? 'opacity-70' : isGif ? '' : 'hover:scale-[1.02]'} transition-transform duration-200`}
                                  />
                                  {isPendingMsg && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                      <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="w-44 h-28 flex items-center justify-center bg-white/10">
                                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                </div>
                              )}
                            </div>
                          )}

                          {isVoice && (
                            <div className="mb-1.5 -mx-1 -mt-1">
                              <VoicePlayer
                                url={signedUrls[msg.id] || msg.localPreviewUrl || null}
                                duration={msg.media_metadata?.duration}
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
                              isSticker ? (
                                <p className="text-6xl leading-none py-1 select-none" aria-label="Sticker">
                                  {msg.content}
                                </p>
                              ) : (
                                <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                                  {linkify(msg.content).map((part, i) =>
                                    part.type === 'link' ? (
                                      <a
                                        key={i}
                                        href={part.value}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline underline-offset-2 text-blue-300 hover:text-blue-200"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {part.value}
                                      </a>
                                    ) : (
                                      <span key={i}>{part.value}</span>
                                    )
                                  )}
                                </p>
                              )
                            )
                          )}

                          <div className={`flex items-center justify-end gap-1 text-[10px] mt-1 select-none ${isOutgoing ? 'text-white/70' : 'text-white/40'}`}>
                            {msg.edited_at && <span className="italic opacity-70">edited</span>}
                            <span>{formatTime(msg.created_at)}</span>
                            {isOutgoing && isPendingMsg && (
                              <span className="flex items-center gap-1 text-white/60" title="Sending">
                                <span className="w-2.5 h-2.5 border border-white/50 border-t-transparent rounded-full animate-spin inline-block" />
                                sending
                              </span>
                            )}
                            {isOutgoing && isFailedMsg && (
                              <button
                                onClick={(e) => { e.stopPropagation(); retrySend(msg.id) }}
                                className="text-red-300 hover:text-red-100 font-bold underline underline-offset-2 cursor-pointer"
                                title="Tap to retry"
                              >
                                failed · retry
                              </button>
                            )}
                            {isOutgoing && !isPendingMsg && !isFailedMsg && (
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
                {replyingTo.message_type === 'photo'
                  ? (replyingTo.media_metadata?.gif ? '🎞 GIF' : '📷 Photo')
                  : replyingTo.message_type === 'voice' ? '🎤 Voice'
                  : replyingTo.content || '...'}
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

        {/* Voice recorder */}
        {recording && (
          <VoiceRecorder onCancel={handleVoiceCancel} onSend={handleVoiceSend} />
        )}

        {/* Composer */}
        <footer className="relative z-20 p-3 bg-black/50 backdrop-blur-2xl border-t border-white/15 shrink-0 pb-safe">
          <Composer
            onSend={handleSend}
            onTyping={sendTyping}
            onFileSelect={handleFileSelect}
            onSendGif={handleGifSend}
            onSendSticker={handleStickerSend}
            onMic={() => {
              if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
                showToast('Voice messages not supported in this browser')
                return
              }
              if (imageFile) clearImage()
              setRecording(true)
            }}
            hasAttachment={!!imageFile}
            uploading={uploadingImage}
            recording={recording}
          />
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

      <PhotoGallery
        photos={galleryPhotos}
        onOpen={(url) => { setShowGallery(false); setViewingPhoto(url) }}
        onDelete={(id) => deleteMessage(id)}
        onClose={showGallery ? () => setShowGallery(false) : null}
      />

      {/* Copied/Exported toast */}
      {copiedToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white/90 text-xs font-medium shadow-lg toast-in select-none pointer-events-none">
          {copiedToast}
        </div>
      )}

      {/* Privacy blur for app switcher */}
      {privacyBlur && (
        <div className="fixed inset-0 z-[200] bg-[#090d16]/95 backdrop-blur-2xl flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg">
            <span className="text-xl font-bold text-white">OS</span>
          </div>
        </div>
      )}
    </div>
  )
}
