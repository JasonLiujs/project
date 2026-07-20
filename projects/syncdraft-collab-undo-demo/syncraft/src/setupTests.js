// CRA Jest setup. jsdom test environment in older jest/jsdom does not expose
// the Web Crypto API on window, which lib0 (a yjs dependency) requires at
// import time. Polyfill it from Node's crypto before any test imports yjs.
if (typeof globalThis.crypto === 'undefined') {
  // Node 18+ exposes webcrypto on the global crypto module.
  const { webcrypto } = require('crypto')
  globalThis.crypto = webcrypto
  if (typeof window !== 'undefined') {
    window.crypto = webcrypto
  }
}
