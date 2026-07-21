// react-scripts loads this file before every test suite.
// jsdom (default jest environment) does not provide globalThis.crypto,
// which lib0/webcrypto.js + lib0/random.js require at module-load time
// (yjs → lib0).  Inject Node's webcrypto so the import chain succeeds.
if (typeof globalThis.crypto === 'undefined') {
  const { webcrypto } = require('crypto')
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: true,
    configurable: true,
  })
}
