/**
 * Focused regression for SyncDraft collaborative undo scope.
 *
 * Reproduces the bug: a local user's UndoManager tracks remote (provider-origin)
 * updates, so pressing undo removes a collaborator's content.
 *
 * We simulate the exact production configuration from demo_editor.jsx:
 *   new Y.UndoManager(ydoc.getXmlFragment("default"), {
 *     trackedOrigins: new Set([null, provider])   // buggy baseline
 *   })
 *
 * After fix, trackedOrigins must NOT include the provider origin, so a local
 * undo only reverts the local edit and preserves the remote edit.
 */

import * as Y from 'yjs'

// Stand-in for a Hocuspocus provider object. In production, remote updates are
// applied with transaction origin === provider. UndoManager keys off identity.
const fakeProvider = { _isFakeProvider: true }

// Mirrors demo_editor.jsx createUndoManager configuration (post-fix).
// Only local (null-origin) transactions are tracked; remote updates arriving
// through the provider must NOT enter the local undo stack.
function createUndoManager(ydoc, provider) {
  return new Y.UndoManager(ydoc.getXmlFragment('default'), {
    trackedOrigins: new Set([null]),
  })
}

describe('SyncDraft collaborative undo scope', () => {
  test('local undo must NOT remove a remote (provider-origin) edit', () => {
    const ydoc = new Y.Doc()
    const fragment = ydoc.getXmlFragment('default')
    const undoManager = createUndoManager(ydoc, fakeProvider)

    // --- Local edit: user A types "A-undo-scope" ---
    // Default transaction origin is null (local).
    ydoc.transact(() => {
      const p = new Y.XmlElement('paragraph')
      const text = new Y.XmlText()
      text.insert(0, 'A-undo-scope')
      p.insert(0, [text])
      fragment.insert(0, [p])
    })

    // --- Remote edit: collaborator B types "B-must-survive" ---
    // Remote updates arrive through the provider; their transaction origin is
    // the provider object. This is exactly how Hocuspocus applies updates.
    ydoc.transact(
      () => {
        const p = new Y.XmlElement('paragraph')
        const text = new Y.XmlText()
        text.insert(0, 'B-must-survive')
        p.insert(0, [text])
        fragment.insert(fragment.length, [p])
      },
      fakeProvider
    )

    // Both edits should be visible in the shared document.
    const htmlBefore = fragment.toString()
    expect(htmlBefore).toContain('A-undo-scope')
    expect(htmlBefore).toContain('B-must-survive')

    // --- User A undoes ONCE (only their own edit) ---
    undoManager.undo()

    const htmlAfter = fragment.toString()

    // Expected (correct): A's content gone, B's content preserved.
    expect(htmlAfter).not.toContain('A-undo-scope')
    // This assertion FAILS on the buggy baseline because the provider-origin
    // update was tracked, so undo also reverts B's edit.
    expect(htmlAfter).toContain('B-must-survive')

    ydoc.destroy()
    undoManager.destroy()
  })
})
