import React, { useEffect, useMemo, useRef, useCallback } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import { useNavigate } from 'react-router-dom'
import Document from "@tiptap/extension-document"
import Paragraph from "@tiptap/extension-paragraph"
import Text from "@tiptap/extension-text"
import Heading from "@tiptap/extension-heading"
import Bold from "@tiptap/extension-bold"
import Italic from "@tiptap/extension-italic"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import { BulletList, OrderedList, ListItem } from "@tiptap/extension-list"
import CodeBlock from "@tiptap/extension-code-block"
import { TableKit } from "@tiptap/extension-table"
import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import { Placeholder } from "@tiptap/extensions"

import {
  MdUndo, MdRedo, MdImage,
  MdFormatBold, MdFormatItalic, MdFormatUnderlined,
  MdFormatAlignLeft, MdFormatAlignCenter, MdFormatAlignRight,
  MdLooksOne, MdLooksTwo, MdLooks3,MdHome
} from "react-icons/md"
import {
  AiOutlineOrderedList,
  AiOutlineUnorderedList,
} from "react-icons/ai"

import * as Y from "yjs"
import { HocuspocusProvider } from "@hocuspocus/provider"

import "./demo.css"

/**
 * Create a per-user UndoManager that only tracks LOCAL edits.
 *
 * Bug: the previous `trackedOrigins: new Set([null, provider])` made every
 * remote update undoable locally.  HocuspocusProvider applies incoming wire
 * updates via Y.applyUpdate(), whose default transaction origin is `null`.
 * Because `null` was in trackedOrigins, A's undo would revert B's remote
 * edits — B's content vanished.
 *
 * Fix: track ONLY the provider identity so remote updates (origin=null)
 * never enter the local undo stack.
 */
const createUndoManager = (ydoc, provider) => new Y.UndoManager(ydoc.getXmlFragment("default"), {
  trackedOrigins: new Set([provider]),
})

// ─────────────────────────────────────────────
// DEMO CONSTANTS
// ─────────────────────────────────────────────
const DEMO_DOC_ID = "syncdraft-demo-doc-v2"

const DEMO_USER = {
  name: localStorage.getItem("syncdraft_demo_user") || `Guest-${Math.floor(Math.random() * 1000)}`,
  color: localStorage.getItem("syncdraft_demo_color") || `hsl(${Math.random() * 360}, 70%, 60%)`,
}

localStorage.setItem("syncdraft_demo_user", DEMO_USER.name)
localStorage.setItem("syncdraft_demo_color", DEMO_USER.color)

const DEMO_CONTENT = `
<h1>SyncDraft</h1>
<p>
  A real-time collaborative editor for focused, fast writing.
</p>

<h2>Live collaboration</h2>
<p>
  Open this page in two tabs and type together. Changes sync instantly.
</p>

<h2>Rich editing</h2>
<ul>
  <li>Headings, lists, alignment</li>
  <li>Code blocks and tables</li>
  <li>Images and formatting</li>
</ul>

<pre><code>console.log("Real-time collaboration");</code></pre>

<hr />

<p>
  <strong>Sign in to unlock the full experience:</strong><br />
  persistent documents, version history, and team collaboration.
</p>

<p style="opacity: 0.6; font-size: 14px;">
  Demo changes reset on refresh.
</p>
`


// ─────────────────────────────────────────────
// DEMO EDITOR
// ─────────────────────────────────────────────
const DemoEditor = () => {
  const ydocRef = useRef(new Y.Doc())
  const providerRef = useRef(null)
  const undoManagerRef = useRef(null)
  const navigate = useNavigate()

  // ─────────────────────────────────────────────
  // Hocuspocus Provider
  // ─────────────────────────────────────────────
  if (!providerRef.current) {
    const WS_URL =
      process.env.REACT_APP_WS_URL || "ws://localhost:1234"

    providerRef.current = new HocuspocusProvider({
      url: WS_URL,
      name: DEMO_DOC_ID,
      document: ydocRef.current,
    })

    undoManagerRef.current = createUndoManager(ydocRef.current, providerRef.current)
  }

  const extensions = useMemo(() => [
    Document,
    Paragraph,
    Text,
    Heading.configure({ levels: [1, 2, 3] }),
    BulletList,
    OrderedList,
    ListItem,
    Bold,
    Italic,
    Underline,
    CodeBlock,
    TableKit.configure({ resizable: true }),
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    Collaboration.configure({
      document: ydocRef.current,
    }),
    CollaborationCaret.configure({
      provider: providerRef.current,
      user: DEMO_USER,
    }),
    Placeholder.configure({
      placeholder: "Write something…",
    }),
  ], [])

  const editor = useEditor({
    extensions,
    editable: true,
  })

  useEffect(() => {
    if (editor) {
      window.__syncraftEditor = editor
      window.__syncraftUndoManager = undoManagerRef.current
    }
  }, [editor])

  // ─────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────
  const addImage = useCallback(() => {
    const url = window.prompt("Enter image URL")
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  const resetDemo = () => {
    editor.commands.clearContent()
    editor.commands.setContent(DEMO_CONTENT)
  }

  if (!editor) return null

  // DemoEditor.jsx (UPDATED CLASS NAMES ONLY)

return (
  <>
    {/* Demo Banner */}
    <div className="demo-banner">
      🚀 Demo Mode — no login, no saving, changes reset on refresh
    </div>

    <div className="demo-control-group">
      <div className="demo-toolbar demo-desktop-toolbar">

        <div className="demo-group">
          <button
            onClick={() => navigate('/')}
            className="demo-icon-button demo-home-button"
            title="Go to Home"
          >
            <MdHome />
          </button>
        </div>

        <div className="demo-group">
          <button onClick={() => undoManagerRef.current?.undo()}>
            <MdUndo />
          </button>
          <button onClick={() => undoManagerRef.current?.redo()}>
            <MdRedo />
          </button>
        </div>

        <div className="demo-group">
          <button onClick={() => editor.chain().focus().toggleBold().run()}>
            <MdFormatBold />
          </button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()}>
            <MdFormatItalic />
          </button>
          <button onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <MdFormatUnderlined />
          </button>
        </div>

        <div className="demo-group">
          <button onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <AiOutlineUnorderedList />
          </button>
          <button onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <AiOutlineOrderedList />
          </button>
        </div>

        <div className="demo-group">
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <MdLooksOne />
          </button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <MdLooksTwo />
          </button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <MdLooks3 />
          </button>
        </div>

        <div className="demo-group">
          <button onClick={() => editor.chain().focus().setTextAlign("left").run()}>
            <MdFormatAlignLeft />
          </button>
          <button onClick={() => editor.chain().focus().setTextAlign("center").run()}>
            <MdFormatAlignCenter />
          </button>
          <button onClick={() => editor.chain().focus().setTextAlign("right").run()}>
            <MdFormatAlignRight />
          </button>
        </div>

        <div className="demo-group">
          <button onClick={addImage}>
            <MdImage />
          </button>
        </div>

        <div className="demo-group">
          <button
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
          >
            Table
          </button>
        </div>

        <div className="demo-group" style={{ marginLeft: "auto" }}>
          <button onClick={resetDemo}>Reset Demo</button>
        </div>

      </div>
    </div>

    <EditorContent
      className="demo-editor-container"
      editor={editor}
    />
  </>
)
}

export default DemoEditor
