import { Editor } from "@tiptap/core"
import Document from "@tiptap/extension-document"
import Paragraph from "@tiptap/extension-paragraph"
import Text from "@tiptap/extension-text"
import { Collaboration } from "@tiptap/extension-collaboration"
import * as Y from "yjs"
import { HocuspocusProvider } from "@hocuspocus/provider"
import { CollaborationUndoIsolation } from "../extensions/collaboration-undo-isolation"

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const setup = async (DOC_ID) => {
  const ydocA = new Y.Doc()
  const providerA = new HocuspocusProvider({ url: "ws://localhost:1234", name: DOC_ID, document: ydocA })
  const editorA = new Editor({ extensions: [Document, Paragraph, Text, Collaboration.configure({ document: ydocA }), CollaborationUndoIsolation] })
  const ydocB = new Y.Doc()
  const providerB = new HocuspocusProvider({ url: "ws://localhost:1234", name: DOC_ID, document: ydocB })
  const editorB = new Editor({ extensions: [Document, Paragraph, Text, Collaboration.configure({ document: ydocB })] })
  await sleep(3000)
  return { ydocA, providerA, editorA, ydocB, providerB, editorB }
}

const cleanup = (ctx) => {
  ctx.editorA.destroy(); ctx.editorB.destroy()
  ctx.providerA.destroy(); ctx.providerB.destroy()
  ctx.ydocA.destroy(); ctx.ydocB.destroy()
}

describe("v3 fix verification", () => {
  test("V1: A types, B inserts at pos0, A undo → B's full text preserved", async () => {
    const ctx = await setup(`v3v1-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    try {
      ctx.editorA.commands.setContent("<p></p>")
      await sleep(500)
      ctx.editorA.chain().focus().insertContent("Hello-from-A").run()
      await sleep(2000)
      ctx.editorB.chain().focus().setTextSelection(0).insertContent("Hello-from-B").run()
      await sleep(2000)

      ctx.editorA.commands.safeUndo()
      await sleep(2000)

      const aHtml = ctx.editorA.getHTML()
      const bHtml = ctx.editorB.getHTML()
      console.log(`V1 after undo: A=${aHtml} B=${bHtml}`)
      expect(aHtml).toContain("Hello-from-B")
      expect(aHtml).not.toContain("Hello-from-A")
      expect(bHtml).toContain("Hello-from-B")
    } finally { cleanup(ctx) }
  }, 30000)

  test("V2: A types, B inserts at end, A undo → B's text preserved", async () => {
    const ctx = await setup(`v3v2-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    try {
      ctx.editorA.commands.setContent("<p></p>")
      await sleep(500)
      ctx.editorA.chain().focus().insertContent("Hello-from-A").run()
      await sleep(2000)
      ctx.editorB.chain().focus().setTextSelection(13).insertContent("Hello-from-B").run()
      await sleep(2000)

      ctx.editorA.commands.safeUndo()
      await sleep(2000)

      const aHtml = ctx.editorA.getHTML()
      const bHtml = ctx.editorB.getHTML()
      console.log(`V2 after undo: A=${aHtml} B=${bHtml}`)
      expect(aHtml).toContain("Hello-from-B")
      expect(aHtml).not.toContain("Hello-from-A")
    } finally { cleanup(ctx) }
  }, 30000)

  test("V3: A types, B in separate paragraph, A undo → B paragraph survives", async () => {
    const ctx = await setup(`v3v3-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    try {
      ctx.editorA.commands.setContent("<p></p>")
      await sleep(500)
      ctx.editorA.chain().focus().insertContent("Hello-from-A").run()
      await sleep(2000)
      ctx.editorB.chain().focus().insertContent("<p>Hello-from-B</p>").run()
      await sleep(2000)

      ctx.editorA.commands.safeUndo()
      await sleep(2000)

      const aHtml = ctx.editorA.getHTML()
      console.log(`V3 after undo: A=${aHtml}`)
      expect(aHtml).toContain("Hello-from-B")
      expect(aHtml).not.toContain("Hello-from-A")
    } finally { cleanup(ctx) }
  }, 30000)

  test("V4: A types, B inserts at pos0, A undo, A redo → B preserved", async () => {
    const ctx = await setup(`v3v4-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    try {
      ctx.editorA.commands.setContent("<p></p>")
      await sleep(500)
      ctx.editorA.chain().focus().insertContent("Hello-from-A").run()
      await sleep(2000)
      ctx.editorB.chain().focus().setTextSelection(0).insertContent("Hello-from-B").run()
      await sleep(2000)

      ctx.editorA.commands.safeUndo()
      await sleep(2000)
      const afterUndo = ctx.editorA.getHTML()
      console.log(`V4 after undo: A=${afterUndo}`)
      expect(afterUndo).toContain("Hello-from-B")
      expect(afterUndo).not.toContain("Hello-from-A")

      ctx.editorA.commands.safeRedo()
      await sleep(2000)
      const afterRedo = ctx.editorA.getHTML()
      console.log(`V4 after redo: A=${afterRedo}`)
      // redo 后 B 的内容仍应保留（redo 可能无法恢复 A 的文本，这是 Yjs 协作 undo 的固有行为）
      expect(afterRedo).toContain("Hello-from-B")
    } finally { cleanup(ctx) }
  }, 30000)

  test("V5: Multiple steps - A types Apple, B types Banana at pos0, A types Cherry, undo Cherry, undo Apple", async () => {
    const ctx = await setup(`v3v5-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    try {
      ctx.editorA.commands.setContent("<p></p>")
      await sleep(500)
      ctx.editorA.chain().focus().insertContent("Apple").run()
      await sleep(2000)
      ctx.editorB.chain().focus().setTextSelection(0).insertContent("Banana").run()
      await sleep(2000)
      ctx.editorA.chain().focus().setTextSelection(17).insertContent(" Cherry").run()
      await sleep(2000)

      ctx.editorA.commands.safeUndo()
      await sleep(2000)
      console.log(`V5 after undo Cherry: A=${ctx.editorA.getHTML()}`)

      ctx.editorA.commands.safeUndo()
      await sleep(2000)
      const aHtml = ctx.editorA.getHTML()
      console.log(`V5 after undo Apple: A=${aHtml}`)
      expect(aHtml).toContain("Banana")
      expect(aHtml).not.toContain("Apple")
    } finally { cleanup(ctx) }
  }, 30000)

  test("V6: Single user undo works normally", async () => {
    const ctx = await setup(`v3v6-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    try {
      ctx.editorA.commands.setContent("<p></p>")
      await sleep(500)
      ctx.editorA.chain().focus().insertContent("Hello-from-A").run()
      await sleep(2000)

      ctx.editorA.commands.safeUndo()
      await sleep(1000)

      expect(ctx.editorA.getHTML()).toBe("<p></p>")
    } finally { cleanup(ctx) }
  }, 30000)
})
