import { useState } from 'react'

export default function ProfileEdit({ open, currentName, currentAvatar, onSave, onClose }) {
  const [name, setName] = useState(currentName)
  const [avatar, setAvatar] = useState(currentAvatar)
  const [saving, setSaving] = useState(false)

  if (!open) return null

  const handleSave = async () => {
    setSaving(true)
    await onSave({ displayName: name.trim(), avatarUrl: avatar.trim() })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#1c1c1e] border border-white/15 rounded-2xl w-full max-w-sm p-5 shadow-2xl text-white">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">Edit Profile</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white p-1 rounded-lg cursor-pointer">
            ✕
          </button>
        </div>

        {/* Avatar preview */}
        <div className="flex justify-center mb-5">
          <div className="relative">
            <img
              src={avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'}
              alt="Avatar preview"
              className="w-20 h-20 rounded-full object-cover ring-2 ring-white/20"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              placeholder="Your name"
              className="w-full bg-[#111726] border border-slate-700 text-white placeholder-slate-500 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Avatar Image URL</label>
            <input
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              className="w-full bg-[#111726] border border-slate-700 text-white placeholder-slate-500 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
