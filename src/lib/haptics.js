// Vibration feedback (Android/Windows). iOS Safari ignores vibrate() — harmless no-op there.
export function buzz(pattern = 12) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern)
    }
  } catch {
    /* unsupported */
  }
}

export const HAPTIC = {
  send: 12,
  sticker: [15, 30, 15],
  gif: [15, 30, 15],
  receive: [18, 40, 18],
}
