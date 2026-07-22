/**
 * Regression test: collaborative undo must not remove remote content.
 *
 * Baseline bug: A and B edit the same doc. After A undoes once,
 * B's content disappears because the UndoManager tracked `null` as an
 * origin, and Y.applyUpdate (used by HocuspocusProvider to apply remote
 * wire updates) fires transactions with origin=null by default.
 *
 * Fix: track ONLY the local provider identity so that remote updates
 * (origin=null) never enter the local undo stack.
 */

import * as Y from 'yjs'

/**
 * FIXED UndoManager configuration — only the local provider is tracked.
 * Remote updates arrive with origin=null and are therefore excluded.
 */
const createUndoManager = (ydoc, provider) =>
  new Y.UndoManager(ydoc.getXmlFragment('default'), {
    trackedOrigins: new Set([provider]),
  })

describe('collaborative undo isolation', () => {
  test('local undo must not remove remote edits', () => {
    const ydoc = new Y.Doc()

    // Two clients, each with its own provider identity.
    const providerA = { id: 'providerA' }

    const umA = createUndoManager(ydoc, providerA)

    const frag = ydoc.getXmlFragment('default')

    // A types local text — origin = providerA (tracked by A's UndoManager).
    ydoc.transact(() => {
      const p = new Y.XmlElement('paragraph')
      p.insert(0, [new Y.XmlText('A-undo-scope-001')])
      frag.insert(0, [p])
    }, providerA)

    // B types — simulated as a REMOTE update arriving on the shared ydoc.
    // HocuspocusProvider applies incoming wire updates via Y.applyUpdate,
    // whose default transaction origin is `null`.
    ydoc.transact(() => {
      const p = new Y.XmlElement('paragraph')
      p.insert(0, [new Y.XmlText('B-must-survive-001')])
      frag.insert(1, [p])
    }, null) // remote origin

    // Sanity: both texts present.
    const html = frag.toString()
    expect(html).toContain('A-undo-scope-001')
    expect(html).toContain('B-must-survive-001')

    // A undoes once — should only undo A's own edit.
    umA.undo()

    const htmlAfterUndo = frag.toString()

    // A's content is removed by the undo.
    expect(htmlAfterUndo).not.toContain('A-undo-scope-001')

    // B's content MUST survive A's undo.
    expect(htmlAfterUndo).toContain('B-must-survive-001')
  })

  test('consecutive undos reverse local edits in order', () => {
    const ydoc = new Y.Doc()
    const providerA = { id: 'providerA' }
    const umA = createUndoManager(ydoc, providerA)
    const frag = ydoc.getXmlFragment('default')

    // A types two paragraphs locally in SEPARATE capture groups.
    // Y.UndoManager merges consecutive same-origin transactions into a
    // single undo item unless stopCapturing() is called between them.
    ydoc.transact(() => {
      const p = new Y.XmlElement('paragraph')
      p.insert(0, [new Y.XmlText('first-local-edit')])
      frag.insert(0, [p])
    }, providerA)
    umA.stopCapturing()

    ydoc.transact(() => {
      const p = new Y.XmlElement('paragraph')
      p.insert(0, [new Y.XmlText('second-local-edit')])
      frag.insert(1, [p])
    }, providerA)

    expect(frag.toString()).toContain('first-local-edit')
    expect(frag.toString()).toContain('second-local-edit')

    // First undo removes the second edit (LIFO).
    umA.undo()
    expect(frag.toString()).not.toContain('second-local-edit')
    expect(frag.toString()).toContain('first-local-edit')

    // Second undo removes the first edit.
    umA.undo()
    expect(frag.toString()).not.toContain('first-local-edit')
  })

  test('remote edits never enter the local undo stack', () => {
    const ydoc = new Y.Doc()
    const providerA = { id: 'providerA' }
    const umA = createUndoManager(ydoc, providerA)
    const frag = ydoc.getXmlFragment('default')

    // Only remote edits (origin=null), no local edits.
    ydoc.transact(() => {
      const p = new Y.XmlElement('paragraph')
      p.insert(0, [new Y.XmlText('remote-only-edit')])
      frag.insert(0, [p])
    }, null)

    // Undo stack should be empty — nothing to undo.
    expect(umA.undoStack.length).toBe(0)
    expect(umA.canUndo()).toBe(false)
  })
})
