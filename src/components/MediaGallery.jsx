import { useState } from 'react'
import VoicePlayer from './VoicePlayer'

function formatWhen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return time
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`
}

export default function MediaGallery({ photos, voices, onOpenPhoto, onDelete, onCleanup, onDeleteOld, onCountOld, onClose }) {
  const [tab, setTab] = useState('photos')
  const [confirmId, setConfirmId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [pendingAction, setPendingAction] = useState(null) // 'orphans' | 'old'
  const [oldCount, setOldCount] = useState(null)
  const [working, setWorking] = useState(null)
  const [note, setNote] = useState('')

  if (!onClose) return null

  const handleDelete = async (id) => {
    setBusyId(id)
    await onDelete(id)
    setBusyId(null)
    setConfirmId(null)
  }

  const openAction = (action) => {
    setPendingAction(action)
    setNote('')
    if (action === 'old') {
      setOldCount(null)
      if (onCountOld) {
        onCountOld()
          .then((c) => setOldCount(typeof c === 'number' && c >= 0 ? c : -1))
          .catch(() => setOldCount(-1))
      }
    }
  }

  const runAction = async (action) => {
    const run = action === 'orphans' ? onCleanup : onDeleteOld
    if (!run) return
    setPendingAction(null)
    setWorking(action)
    setNote('')
    const result = await run()
    setWorking(null)
    if (!result) return

    if (result.error) {
      setNote(`${action === 'orphans' ? 'Cleanup' : 'Delete'} failed: ${result.error}`)
      return
    }
    if (action === 'orphans') {
      setNote(
        result.removed
          ? `Removed ${result.removed} unused file${result.removed === 1 ? '' : 's'}`
          : 'Nothing to clean — every file belongs to a message'
      )
      return
    }
    const n = result.removed || 0
    if (!n) {
      setNote('No messages older than 7 days')
      return
    }
    setNote(
      `Deleted ${n} message${n === 1 ? '' : 's'}${
        result.files ? ` and ${result.files} file${result.files === 1 ? '' : 's'}` : ''
      } older than 7 days`
    )
  }

  const ACTIONS = {
    orphans: {
      title: 'Delete files that no message points to?',
      hint: 'Only unused uploads are removed.',
      label: 'Clean',
    },
    old: {
      title: 'Delete every message older than 7 days?',
      hint: 'Text, photos and voice notes are removed permanently.',
      label: 'Delete',
    },
  }

  const renderConfirm = (id, label) => (
    <div className="absolute inset-x-2 bottom-2 rounded-lg bg-black/90 backdrop-blur-sm border border-white/15 p-2 text-center z-10">
      <p className="text-[10px] text-white/80 mb-1.5">Delete this {label}?</p>
      <div className="flex gap-1">
        <button
          onClick={() => handleDelete(id)}
          disabled={busyId === id}
          className="flex-1 py-1 rounded-md bg-red-500 hover:bg-red-400 text-white text-[10px] font-medium transition-colors cursor-pointer disabled:opacity-50"
        >
          {busyId === id ? '…' : 'Delete'}
        </button>
        <button
          onClick={() => setConfirmId(null)}
          className="flex-1 py-1 rounded-md bg-white/10 hover:bg-white/15 text-white text-[10px] transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/95 backdrop-blur-sm flex flex-col photo-viewer-in"
      role="dialog"
      aria-label="Shared media"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-white">Shared media</h2>
        <div className="flex items-center gap-1">
          {onDeleteOld && (
            <button
              onClick={() => openAction('old')}
              disabled={!!working}
              aria-label="Delete messages older than 7 days"
              title="Delete messages older than 7 days"
              className="text-white/60 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
            >
              {working === 'old' ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>
          )}
          {onCleanup && (
            <button
              onClick={() => openAction('orphans')}
              disabled={!!working}
              aria-label="Remove unused files"
              title="Remove unused files"
              className="text-white/60 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
            >
              {working === 'orphans' ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                </svg>
              )}
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close media gallery"
            className="text-white/60 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {pendingAction && (
        <div
          className="flex items-start justify-between gap-3 px-4 py-2 border-b border-white/10 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="min-w-0">
            <p className="text-[11px] text-white/80">{ACTIONS[pendingAction].title}</p>
            <p className="text-[10px] text-white/45 mt-0.5">
              {pendingAction === 'old'
                ? oldCount === null
                  ? 'Checking how many messages…'
                  : oldCount === -1
                    ? 'This permanently deletes the old messages and their media.'
                    : oldCount === 0
                      ? 'No messages are older than 7 days.'
                      : `${oldCount} message${oldCount === 1 ? '' : 's'} and their media will be permanently deleted.`
                : ACTIONS[pendingAction].hint}
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => runAction(pendingAction)}
              disabled={pendingAction === 'old' && (oldCount === null || oldCount === 0)}
              className="px-2.5 py-1 rounded-md bg-red-500 hover:bg-red-400 text-white text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {ACTIONS[pendingAction].label}
            </button>
            <button
              onClick={() => setPendingAction(null)}
              className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/15 text-white text-[11px] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {note && (
        <div className="px-4 py-2 border-b border-white/10 shrink-0 text-[11px] text-white/60" onClick={(e) => e.stopPropagation()}>
          {note}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 px-4 py-2 border-b border-white/10 shrink-0" onClick={(e) => e.stopPropagation()}>
        {[
          { id: 'photos', label: `Photos (${photos.length})` },
          { id: 'voice', label: `Voice (${voices.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setConfirmId(null) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
              tab === t.id
                ? 'bg-white text-black border-white'
                : 'bg-white/5 text-white/70 border-white/15 hover:bg-white/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'photos' ? (
        photos.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/40">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3">🖼</div>
            <p className="text-sm">No photos yet</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2 chat-scrollbar" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((p) => (
                <div key={p.id} className="relative aspect-square">
                  <button
                    onClick={() => onOpenPhoto(p.url)}
                    className="w-full h-full overflow-hidden rounded-lg cursor-pointer group"
                  >
                    <img
                      src={p.url}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </button>

                  <button
                    onClick={() => setConfirmId(confirmId === p.id ? null : p.id)}
                    aria-label="Delete photo"
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/65 hover:bg-red-500/90 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer backdrop-blur-sm border border-white/20"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  {confirmId === p.id && renderConfirm(p.id, 'photo')}
                </div>
              ))}
            </div>
          </div>
        )
      ) : voices.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/40">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3">🎤</div>
          <p className="text-sm">No voice messages yet</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 chat-scrollbar space-y-2" onClick={(e) => e.stopPropagation()}>
          {voices.map((v) => (
            <div key={v.id} className="relative rounded-xl bg-white/5 border border-white/10 px-3 pt-2 pb-2.5 text-white">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] text-white/55 truncate">
                  {v.senderName} · {formatWhen(v.createdAt)}
                </span>
                <button
                  onClick={() => setConfirmId(confirmId === v.id ? null : v.id)}
                  aria-label="Delete voice message"
                  className="w-6 h-6 rounded-full bg-white/10 hover:bg-red-500/90 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/15 shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <VoicePlayer url={v.url} duration={v.duration} />
              {confirmId === v.id && renderConfirm(v.id, 'voice message')}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
