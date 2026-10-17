# Backlog — ideas for Our Space

Features discussed and parked. Claimed items get checked off when shipped.

## Shipped from this list
- [x] Sounds & haptics (vibration on send/receive) — shipped with stickers+GIFs batch
- [x] Stickers (emoji sticker grid, bubble-less render)
- [x] GIF picker (Giphy search via `VITE_GIPHY_API_KEY` + curated fallback)

## Parked — build next (user picked all)
- [ ] **Disappearing messages** — self-destruct timer (1h/1d/1w), delete after read/timer; privacy-first
- [ ] **App lock** — PIN/biometric lock screen before chat opens
- [ ] **Tap-to-translate** — per-message translate button; doubles as the "Translator" disguise
- [ ] **Voice/video calls** — WebRTC with ringing + call UI; biggest build of the list
- [ ] **Chat search** — full-text search across history, jump-to-message highlights
- [ ] **File sending** — any file type (docs, PDFs), new bucket + storage policy migration
- [ ] **Anniversary/memory** — days-together counter, chat streak, "on this day" photos
- [ ] **Mini game** — tic-tac-toe or similar, two-player inside the chat

## Notes
- Disappearing messages + app lock pair well as one "privacy pack" batch
- Voice/video calls need a signaling channel (reuse existing Supabase realtime) — plan before coding
- File sending needs `chat-files` bucket + RLS migration (SQL the user runs)
