import { GlobalRegistrator } from '@happy-dom/global-registrator'

// Bun initializes CommonJS imports before any ESM module body runs, so a
// static @testing-library import would bind document.body before the DOM
// exists. Register the DOM first, then load the testing libraries dynamically.
GlobalRegistrator.register()

export const rtl = await import('@testing-library/react')
export const userEvent = (await import('@testing-library/user-event')).default
