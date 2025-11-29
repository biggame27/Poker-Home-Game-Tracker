'use client'

// Minimal toast shim to replace the external `sonner` dependency.
// In this stub we log to the console; swap with a real toast later if desired.
type ToastFn = (message: string) => void

const log: ToastFn = (message) => {
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log('[toast]', message)
  }
}

export const toast = Object.assign(log, {
  success: log,
  error: log,
  info: log,
  warning: log,
})
