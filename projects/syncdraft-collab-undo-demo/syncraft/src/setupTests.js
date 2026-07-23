import '@testing-library/jest-dom'

// yjs → lib0/random → lib0/webcrypto requires a global `crypto`.
// jsdom doesn't expose Node's crypto module, so we inject it.
const { webcrypto } = require('crypto')
if (!global.crypto) {
  global.crypto = webcrypto
}

// jsdom doesn't implement matchMedia; Tiptap / CRA tests may touch it.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

// jsdom doesn't implement ResizeObserver.
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
