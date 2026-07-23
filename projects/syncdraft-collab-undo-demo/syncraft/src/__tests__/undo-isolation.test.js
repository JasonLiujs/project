/**
 * Two-client undo/redo regression test for SyncDraft collaborative editor.
 *
 * Root cause being verified:
 *   demo_editor.jsx previously created its own
 *   `new Y.UndoManager(..., { trackedOrigins: new Set([null, provider]) })`.
 *   In this dependency stack:
 *     - Tiptap local editor changes use origin `ySyncPluginKey` (see @tiptap/y-tiptap ySyncPlugin).
 *     - Hocuspocus inbound remote updates use origin `provider` (see MessageReceiver.applySyncMessage →
 *       readSyncMessage(encoding, decoder, doc, provider)).
 *     - `null` is NOT a local origin in this editor path.
 *   By tracking `provider` (and `null`), the custom UndoManager recorded remote B edits into A's
 *   undo history, so A's undo removed B's content.
 *
 * The fix removes the custom UndoManager entirely and lets @tiptap/extension-collaboration's
 * built-in yUndoPlugin manage undo history. That plugin creates an UndoManager with
 * `trackedOrigins: new Set([ySyncPluginKey])`, which only tracks local Tiptap edits and
 * excludes remote (provider-origin) updates.
 *
 * This test simulates the real A/B update propagation path using BOTH the buggy and the fixed
 * UndoManager configurations to prove the fix:
 *   - A's local Tiptap transaction uses origin = ySyncPluginKey (as in ySyncPlugin).
 *   - B's remote update uses origin = provider (as in Hocuspocus MessageReceiver).
 */

import * as Y from 'yjs'

// Mirror the real local origin that @tiptap/y-tiptap's ySyncPlugin uses for local editor transactions.
// ySyncPluginKey is a ProseMirror PluginKey instance; its identity is what matters.
const ySyncPluginKey = { description: 'y-sync-plugin-key' }

describe('two-client collaborative undo regression', () => {
  test('BUGGY config: A undo removes B content (confirms bug exists with wrong origins)', () => {
    const docA = new Y.Doc()
    const providerA = { name: 'provider-A' }

    // This is the buggy production config from the original demo_editor.jsx
    const buggyManager = new Y.UndoManager(docA.getXmlFragment('default'), {
      trackedOrigins: new Set([null, providerA]),
    })

    const docB = new Y.Doc()

    // A types (local origin = ySyncPluginKey)
    docA.transact(() => {
      const frag = docA.getXmlFragment('default')
      const p = new Y.XmlElement('paragraph')
      p.insert(0, [new Y.XmlText('A-undo-scope')])
      frag.insert(0, [p])
    }, ySyncPluginKey)

    // B types (local origin = ySyncPluginKey on B's doc)
    docB.transact(() => {
      const frag = docB.getXmlFragment('default')
      const p = new Y.XmlElement('paragraph')
      p.insert(0, [new Y.XmlText('B-must-survive')])
      frag.insert(0, [p])
    }, ySyncPluginKey)

    // B → A sync (remote origin = providerA, as in Hocuspocus inbound)
    const updateFromB = Y.encodeStateAsUpdate(docB)
    Y.applyUpdate(docA, updateFromB, providerA)

    expect(docA.getXmlFragment('default').toString()).toContain('B-must-survive')

    // A undoes
    buggyManager.undo()

    // BUG: B's content is also gone because provider was tracked
    const aTextAfterUndo = docA.getXmlFragment('default').toString()
    expect(aTextAfterUndo).not.toContain('B-must-survive')
  })

  test('FIXED config: A undo only removes A content; B content survives (undo regression)', () => {
    const docA = new Y.Doc()
    const providerA = { name: 'provider-A-fixed' }

    // This mirrors the fixed config: @tiptap/extension-collaboration's yUndoPlugin creates
    // UndoManager with trackedOrigins = new Set([ySyncPluginKey]), only tracking local edits.
    const fixedManager = new Y.UndoManager(docA.getXmlFragment('default'), {
      trackedOrigins: new Set([ySyncPluginKey]),
    })

    const docB = new Y.Doc()

    // A types (local origin = ySyncPluginKey)
    docA.transact(() => {
      const frag = docA.getXmlFragment('default')
      const p = new Y.XmlElement('paragraph')
      p.insert(0, [new Y.XmlText('A-undo-scope')])
      frag.insert(0, [p])
    }, ySyncPluginKey)

    // B types
    docB.transact(() => {
      const frag = docB.getXmlFragment('default')
      const p = new Y.XmlElement('paragraph')
      p.insert(0, [new Y.XmlText('B-must-survive')])
      frag.insert(0, [p])
    }, ySyncPluginKey)

    // B → A sync (remote origin = providerA — NOT tracked by fixedManager)
    const updateFromB = Y.encodeStateAsUpdate(docB)
    Y.applyUpdate(docA, updateFromB, providerA)

    // A should now have both paragraphs
    const aTextAfterSync = docA.getXmlFragment('default').toString()
    expect(aTextAfterSync).toContain('A-undo-scope')
    expect(aTextAfterSync).toContain('B-must-survive')

    // A undoes — should only undo A's own edit
    fixedManager.undo()

    const aTextAfterUndo = docA.getXmlFragment('default').toString()

    // B's content must survive A's undo
    expect(aTextAfterUndo).toContain('B-must-survive')
    // A's content should be gone
    expect(aTextAfterUndo).not.toContain('A-undo-scope')
  })

  test('FIXED config: A redo only restores A content; B content survives and is not duplicated (redo regression)', () => {
    const docA = new Y.Doc()
    const providerA = { name: 'provider-A-redo' }
    const fixedManager = new Y.UndoManager(docA.getXmlFragment('default'), {
      trackedOrigins: new Set([ySyncPluginKey]),
    })

    const docB = new Y.Doc()

    // A types
    docA.transact(() => {
      const frag = docA.getXmlFragment('default')
      const p = new Y.XmlElement('paragraph')
      p.insert(0, [new Y.XmlText('A-redo-scope')])
      frag.insert(0, [p])
    }, ySyncPluginKey)

    // B types
    docB.transact(() => {
      const frag = docB.getXmlFragment('default')
      const p = new Y.XmlElement('paragraph')
      p.insert(0, [new Y.XmlText('B-redo-survive')])
      frag.insert(0, [p])
    }, ySyncPluginKey)

    // B → A sync (remote origin = providerA)
    const updateFromB = Y.encodeStateAsUpdate(docB)
    Y.applyUpdate(docA, updateFromB, providerA)

    // A undoes
    fixedManager.undo()

    // A redoes — should restore A's content only
    fixedManager.redo()

    const aTextAfterRedo = docA.getXmlFragment('default').toString()

    // B must still be present and not duplicated
    const bCount = (aTextAfterRedo.match(/B-redo-survive/g) || []).length
    expect(aTextAfterRedo).toContain('A-redo-scope')
    expect(aTextAfterRedo).toContain('B-redo-survive')
    expect(bCount).toBe(1)
  })
})
