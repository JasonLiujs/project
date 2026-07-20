import { useEditor, EditorContent } from '@tiptap/react'
import Heading from '@tiptap/extension-heading'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Document from '@tiptap/extension-document'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { Placeholder } from '@tiptap/extensions'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import { ResizableImage } from './ResizableImage'
import { CodeBlockButton } from '@/components/tiptap-ui/code-block-button'
import CodeBlock from '@tiptap/extension-code-block'
import RenameModal from './RenameModal'
import {
  MdMenu, MdClose, MdSave, MdLogout, MdDownload, MdImage, MdHistory, MdUndo,
  MdRedo, MdHome
} from 'react-icons/md'
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { MdFormatBold, MdFormatItalic, MdFormatUnderlined } from 'react-icons/md'
import { AiOutlineOrderedList, AiOutlineUnorderedList } from 'react-icons/ai'
import { MdFormatAlignLeft, MdFormatAlignCenter, MdFormatAlignRight } from 'react-icons/md'
import { MdLooksOne, MdLooksTwo, MdLooks3 } from 'react-icons/md'
import { VscSaveAll } from "react-icons/vsc";
import { FaFilePdf, FaFileWord } from 'react-icons/fa'
import './editor.css'
import { FontFamily } from './FontFamily'
import InviteCollaborator from './InviteCollaborator'
import Collaborators from './collaborators'
import { useNavigate } from "react-router-dom"
import { supabase } from "./supabase_client"
import { saveAs } from "file-saver"
import htmlDocx from "html-docx-js/dist/html-docx"
import jsPDF from "jspdf"
import Collaboration from '@tiptap/extension-collaboration'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import SyncraftLoader from './Loader'
import { TableKit } from '@tiptap/extension-table'
import { IndexeddbPersistence } from "y-indexeddb";
import SaveVersionModal from './SaveVersionModal';
import TableMenuDropdown from './TableMenuDropdown'
import VersionHistoryModal from "./VersionHistoryModal";
import AlertToast from './AlertToast'
import './AlertToast.css'

// ✅ Move outside component to prevent recreation
function stringToColor(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  let color = '#'
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff
    color += ('00' + value.toString(16)).slice(-2)
  }
  return color
}

const Tiptap = ({ docId, user }) => {
  const renderCountRef = useRef(0)
  renderCountRef.current++
  console.log("🌀 Tiptap render count:", renderCountRef.current, "for docId:", docId, "user:", user?.email)

  const navigate = useNavigate()
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [currentTitle, setCurrentTitle] = useState("")
  const [userRole, setUserRole] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [versions, setVersions] = useState([])
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [showSaveVersionModal, setShowSaveVersionModal] = useState(false);
  const [currentFont, setCurrentFont] = useState('default')
  const [alerts, setAlerts] = useState([])

  // Helper function to show alerts
  const showAlert = (message, type = "success", duration = 3000) => {
    const id = Date.now()
    setAlerts(prev => [...prev, { id, message, type, duration }])
  }

  // Function to remove an alert
  const removeAlert = (id) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id))
  }


  // ✅ NEW STATE VARIABLES FOR BETTER RECONNECTION HANDLING
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isReconnecting, setIsReconnecting] = useState(false)

  // ✅ Use refs to ensure provider is created only once per docId
  const providerRef = useRef(null)
  const ydocRef = useRef(null)
  const currentDocIdRef = useRef(null)
  const [providerSynced, setProviderSynced] = useState(false)



  // ✅ Create provider only once per docId using refs
  if (currentDocIdRef.current !== docId) {
    console.log("🌐 Creating NEW provider for:", docId)

    // Cleanup old provider if docId changed
    if (providerRef.current) {
      console.log("🧹 Cleaning up old provider")
      providerRef.current.disconnect()
      providerRef.current.destroy()
    }
    if (ydocRef.current) {
      ydocRef.current.destroy()
    }

    currentDocIdRef.current = docId
    ydocRef.current = new Y.Doc()



    // ✅ Persist Y.Doc to IndexedDB for offline support
    if (typeof window !== "undefined") {
      const persistence = new IndexeddbPersistence(docId, ydocRef.current)

      persistence.on("synced", () => {
        console.log("💾 IndexedDB loaded for doc:", docId)
      })
    }

    const WS_URL = process.env.REACT_APP_WS_URL || "ws://localhost:1234"


    // ✅ ENHANCED PROVIDER WITH CONNECTION PRESERVATION
    providerRef.current = new HocuspocusProvider({
      url: WS_URL,
      name: docId,
      document: ydocRef.current,
      preserveConnection: true,
      maxReconnectTimeout: 2000,
      onStatus: ({ status }) => {
        console.log('Connection status:', status)
        if (status === 'connecting') {
          setIsReconnecting(true)
        }
      },
      onSynced: () => {
        setIsReconnecting(false)
      },
      onDisconnect: () => {
        console.log('Disconnected - will auto-reconnect')
      }
    })

    setProviderSynced(false)
  }

  const ydoc = ydocRef.current
  const provider = providerRef.current


  // ✅ Wait for provider to sync before initializing editor
  useEffect(() => {
    if (!provider) return

    const handleSync = (synced) => {
      console.log("🔄 Provider synced:", synced)
      setProviderSynced(synced)

      // ✅ Mark initial load as complete
      if (synced && isInitialLoad) {
        setIsInitialLoad(false)
      }

      // ✅ Clear reconnecting state
      if (synced) {
        setIsReconnecting(false)
      }
    }

    provider.on('synced', handleSync)

    // Check if already synced
    if (provider.isSynced) {
      setProviderSynced(true)
      setIsInitialLoad(false)
    }

    return () => {
      provider.off('synced', handleSync)
    }
  }, [provider, isInitialLoad])

  // ✅ Cleanup only on component unmount
  useEffect(() => {
    return () => {
      console.log("🧹 Component unmounting - cleaning up provider")
      if (providerRef.current) {
        providerRef.current.disconnect()
        providerRef.current.destroy()
        providerRef.current = null
      }
      if (ydocRef.current) {
        ydocRef.current.destroy()
        ydocRef.current = null
      }


      currentDocIdRef.current = null
    }
  }, [])

  // Load content from Supabase only after provider is synced
  useEffect(() => {
    if (!providerSynced) return

    const loadContent = async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("content")
        .eq("id", docId)
        .single()

      if (error) {
        console.error("Error loading content:", error)
        return
      }

      if (data?.content) {
        try {
          const binaryString = atob(data.content)
          const update = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            update[i] = binaryString.charCodeAt(i)
          }
          Y.applyUpdate(ydoc, update)
          console.log("Loaded saved content into Y.Doc")

        } catch (err) {
          console.error("Error decoding Y.Doc:", err)
        }
      }
    }
    loadContent()
  }, [docId, ydoc, providerSynced])

  // Fetch user role
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.id || !docId) return
      console.log("Fetching role for user:", user.id, "and doc:", docId)

      const { data: docData, error: docError } = await supabase
        .from("documents")
        .select("owner_id")
        .eq("id", docId)
        .maybeSingle()

      if (docError) {
        console.error("Error fetching document owner:", docError)
        return
      }

      if (docData?.owner_id === user.id) {
        setUserRole("owner")
        return
      }

      const { data: collabData, error: collabError } = await supabase
        .from("collaborators")
        .select("role")
        .eq("document_id", docId)
        .eq("user_id", user.id)
        .single()

      console.log("collabData:", collabData)
      console.log("collabError:", collabError)

      if (collabError && collabError.code !== "PGRST116") {
        console.error("Error fetching collaborator role:", collabError)
        return
      }

      if (collabData?.role === "editor") {
        setUserRole("editor")
      } else if (collabData?.role === "viewer") {
        setUserRole("viewer")
      } else {
        setUserRole("UnidentifiedUser")
      }
    }

    fetchUserRole()
  }, [docId, user?.id])

  console.log("User Role:", userRole)

  const isOwner = userRole === "owner"
  const isEditor = userRole === "editor"
  const isViewer = userRole === "viewer"

  // ✅ Memoize user info to prevent extensions from recreating
  const userInfo = useMemo(() => ({
    name: user?.email || "Anonymous",
    color: stringToColor(user?.email || "anon")
  }), [user?.email])

  // ✅ Memoize extensions - will only recreate if dependencies change
  const extensions = useMemo(() => {
    console.log("📦 Creating extensions array")
    return [
      Document,
      Paragraph,
      FontFamily,
      Text,
      BulletList,
      ListItem,
      OrderedList,
      Heading.configure({
        levels: [1, 2, 3],
      }),
      TableKit.configure({
        resizable: true,
      }),
      Bold,
      Italic,
      ResizableImage,
      Underline,
      Collaboration.configure({
        document: ydoc,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      CodeBlock.configure({ HTMLAttributes: { class: 'my-code-block' } }),
      CollaborationCaret.configure({
        provider: provider,
        user: userInfo,
      }),
      Placeholder.configure({
        placeholder: 'Write something… It will be shared with everyone else looking at this document.',
      }),
    ]
  }, [ydoc, provider, userInfo])

  // ✅ Create editor with dependency array - only after provider is synced
  const editor = useEditor({
    extensions,
    editable: userRole !== "viewer",
  }, [extensions, providerSynced])

  // Update editability when userRole changes
  useEffect(() => {
    if (editor && userRole !== null) {
      editor.setEditable(userRole !== "viewer")
    }
  }, [editor, userRole])

  const addImage = useCallback(() => {
    const url = window.prompt('Enter image URL')
    if (url) {
      editor?.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  useEffect(() => {
    if (userRole && !["owner", "editor", "viewer"].includes(userRole)) {
      alert("You do not have permission to access this document.")
      navigate("/")
    }
  }, [userRole, navigate])

  async function saveDocument(docId, ydoc) {
    try {
      const { data: docData, error: fetchError } = await supabase
        .from("documents")
        .select("title")
        .eq("id", docId)
        .single()

      if (fetchError) {
        console.error("Error fetching document title:", fetchError)
        return
      }

      if (docData?.title === "Untitled Document") {
        setCurrentTitle(docData.title)
        setShowRenameModal(true)
        setMobileMenuOpen(false)
        return
      }

      const update = Y.encodeStateAsUpdate(ydoc)
      const base64 = btoa(String.fromCharCode(...update))

      const { error } = await supabase
        .from("documents")
        .update({ content: base64 })
        .eq("id", docId)

      if (error) {
        console.error("Error saving document:", error)
        showAlert("Failed to save document.", "error")
      } else {
        showAlert("Save successful", "success")
        console.log("✅ Document saved to Supabase")
        await saveSnapshot(docId, ydoc, {
          isAutoSave: true,
          userId: user?.id || null,
        })
      }
      setMobileMenuOpen(false)
    } catch (err) {
      console.error("Unexpected error saving doc:", err)
    }
  }
  async function saveSnapshot(
    docId,
    ydoc,
    { isAutoSave = false, versionName = null, userId = null } = {}
  ) {
    try {
      const update = Y.encodeStateAsUpdate(ydoc)
      const base64 = btoa(String.fromCharCode(...update))

      const { error } = await supabase
        .from("document_versions")
        .insert({
          doc_id: docId,
          snapshot: base64,
          is_auto_save: isAutoSave,
          version_name: versionName,
          user_id: userId,
        })

      if (error) {
        console.error("Error saving snapshot:", error)

        // ❗ For manual saves, let caller (SaveVersionModal) handle the error
        if (!isAutoSave) {
          throw error
        }
        // For auto-saves, just log and continue
        return
      }

      console.log("✅ Snapshot saved", { isAutoSave, versionName })
    } catch (err) {
      console.error("Unexpected error saving snapshot:", err)
      if (!isAutoSave) {
        // Re-throw for manual path so modal can show the error
        throw err
      }
    }
  }


  async function loadVersions(docId) {
    try {
      setIsLoadingVersions(true)

      const { data, error } = await supabase
        .from("document_versions")
        .select("id, created_at, version_name, is_auto_save")
        .eq("doc_id", docId)
        .order("created_at", { ascending: false })


      if (error) {
        console.error("Error loading versions:", error)
        showAlert("Failed to load version history.", "error")
        return
      }

      setVersions(data || [])
      setShowHistory(true)
    } catch (err) {
      console.error("Unexpected error loading versions:", err)
    } finally {
      setIsLoadingVersions(false)
    }
  }

  async function restoreVersion(versionId) {
    const confirmRestore = window.confirm(
      "This will replace the current document content with the selected version for everyone. Continue?"
    )

    if (!confirmRestore) return

    try {
      const { data, error } = await supabase
        .from("document_versions")
        .select("snapshot")
        .eq("id", versionId)
        .single()

      if (error) {
        console.error("Error fetching snapshot:", error)
        alert("Failed to load selected version.")
        return
      }

      if (!data?.snapshot) {
        showAlert("No snapshot data found.", "error")
        return
      }

      // Decode base64 → Uint8Array
      const binaryString = atob(data.snapshot)
      const update = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        update[i] = binaryString.charCodeAt(i)
      }

      // 🔁 1) Build a temporary Y.Doc that represents the saved version
      const tempDoc = new Y.Doc()
      Y.applyUpdate(tempDoc, update)

      // Get the fragment Tiptap uses (default field)
      const tempFragment = tempDoc.getXmlFragment('default')

      // 🔁 2) Replace current document content with a clone of tempFragment
      ydoc.transact(() => {
        const fragment = ydoc.getXmlFragment('default')

        // Remove all existing nodes
        if (fragment.length) {
          fragment.delete(0, fragment.length)
        }

        // Clone nodes from the snapshot doc into the live doc
        const nodes = tempFragment.toArray().map(node => node.clone())

        if (nodes.length) {
          fragment.insert(0, nodes)
        }
      })

      // 📝 3) (Optional but recommended) persist new state to `documents` table
      try {
        const newUpdate = Y.encodeStateAsUpdate(ydoc)
        const newBase64 = btoa(String.fromCharCode(...newUpdate))

        await supabase
          .from("documents")
          .update({ content: newBase64 })
          .eq("id", docId)
      } catch (persistErr) {
        console.warn("Restored in editor, but failed to persist main document:", persistErr)
      }

      showAlert("Document restored from selected version", "success")
      setShowHistory(false)
    } catch (err) {
      console.error("Unexpected error restoring version:", err)
      showAlert("Failed to restore version.", "error")
    }
  }



  const handleRenameAndSave = async (newTitle) => {
    try {
      const { error: titleError } = await supabase
        .from("documents")
        .update({ title: newTitle })
        .eq("id", docId)

      if (titleError) {
        throw titleError
      }

      console.log(`📝 Title updated to: ${newTitle}`)

      const update = Y.encodeStateAsUpdate(ydoc)
      const base64 = btoa(String.fromCharCode(...update))

      const { error: contentError } = await supabase
        .from("documents")
        .update({ content: base64 })
        .eq("id", docId)

      if (contentError) {
        throw contentError
      }

      showAlert("✅ Document renamed and saved successfully", "success")
      console.log("✅ Document saved to Supabase")

      setShowRenameModal(false)
    } catch (err) {
      console.error("Error saving document:", err)
      throw err
    }
  }

  function addTableStyles(html) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    // Style all tables
    doc.querySelectorAll("table").forEach((table) => {
      table.style.borderCollapse = "collapse"
      table.style.width = table.style.width || "100%"
    })

    // Style all table headers and cells
    doc.querySelectorAll("th, td").forEach((cell) => {
      cell.style.border = cell.style.border || "1px solid #000"
      cell.style.padding = cell.style.padding || "4px"
      cell.style.verticalAlign = cell.style.verticalAlign || "top"
    })

    return doc.body.innerHTML
  }

  async function downloadAsDocx() {
    if (!editor) return

    try {
      // 1) Get HTML from editor
      let html = editor.getHTML()

      // 2) Convert images to base64
      let htmlWithBase64Images = await convertImagesToBase64(html)

      // 3) Ensure empty paragraphs are preserved
      htmlWithBase64Images = htmlWithBase64Images.replace(
        /<p>(\s|<br\s*\/?>)*<\/p>/g,
        "<p>&#8203;</p>"
      )

      // 4) Inject table borders & formatting
      htmlWithBase64Images = addTableStyles(htmlWithBase64Images)

      // 5) Build HTML document for conversion
      const htmlContent = `<!DOCTYPE html>
      <html>
        <head><meta charset="utf-8" /></head>
        <body>${htmlWithBase64Images}</body>
      </html>`

      // 6) Resolve filename from Supabase (fallback to docId)
      let filename = `document-${docId}`
      try {
        const { data: docData, error: fetchError } = await supabase
          .from('documents')
          .select('title')
          .eq('id', docId)
          .single()

        if (!fetchError && docData?.title) {
          filename = String(docData.title)
        }
      } catch (err) {
        console.warn('Could not fetch title for filename, using fallback.', err)
      }

      // 7) Sanitize filename and ensure .docx extension
      const sanitize = (name) => {
        const trimmed = name.trim()
        const safe = trimmed.replace(/[\/\\?%*:|"<>]/g, '-')
        return safe || `document-${docId}`
      }
      filename = sanitize(filename)
      if (!filename.toLowerCase().endsWith('.docx')) filename += '.docx'

      // 8) Convert and trigger download
      const converted = htmlDocx.asBlob(htmlContent)
      saveAs(converted, filename)

      setMobileMenuOpen(false)
    } catch (error) {
      console.error('Error exporting DOCX:', error)
    }
  }


  async function downloadAsPDF() {
    const htmlWithBase64Images = await convertImagesToBase64(editor.getHTML())

    const htmlContent = `
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page { size: A4; margin: 20mm; }
            body {
              font-family: 'Times New Roman', serif;
              font-size: 12pt;
              line-height: 1.5;
              color: #000;
            }
            h1, h2, h3 { font-weight: bold; margin-bottom: 8px; }
            p { margin: 0 0 10px; }
            ul, ol { margin: 10px 0; padding-left: 20px; }
            img { display: block; }
            table { border-collapse: collapse; width: 100%; margin: 10px 0; }
            td, th { border: 1px solid #000; padding: 8px; }
          </style>
        </head>
        <body>${htmlWithBase64Images}</body>
      </html>
    `

    const element = document.createElement("div")
    element.innerHTML = htmlContent
    document.body.appendChild(element)

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    await pdf.html(element, {
      x: 10,
      y: 10,
      html2canvas: {
        scale: 0.8,
        useCORS: true,
        allowTaint: true
      },
      callback: function (pdf) {
        pdf.save(`document-${docId}.pdf`)
        document.body.removeChild(element)
        setShowDownloadMenu(false)
        setMobileMenuOpen(false)
      },
    })
  }

  async function convertImagesToBase64(html) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const images = doc.querySelectorAll('img')

    const promises = Array.from(images).map(async (img) => {
      try {
        const src = img.getAttribute('src')

        if (src.startsWith('data:')) {
          return
        }

        const response = await fetch(src)
        const blob = await response.blob()
        const base64 = await blobToBase64(blob)

        img.setAttribute('src', base64)
      } catch (error) {
        console.error('Error converting image:', error)
      }
    })

    await Promise.all(promises)
    return doc.body.innerHTML
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()

  }

  // ✅ Show full loader only on true initial load
  if (isInitialLoad && (!editor || !user?.email || !providerSynced)) {
    return <SyncraftLoader message='Craft in Progress'></SyncraftLoader>
  }


  const handleUndo = () => {
    if (!editor) return
    editor.chain().focus().undo().run()
  }

  const handleRedo = () => {
    if (!editor) return
    editor.chain().focus().redo().run()
  }

  const handleGoHome = () => {
    const confirmLeave = window.confirm(
      "Are you sure you want to leave? Make sure you've saved your document."
    )

    if (confirmLeave) {
      navigate("/")
    }
  }
  return (
    <>
      

      <div className="control-group">
        {/* Desktop Toolbar */}
        <div className="toolbar desktop-toolbar">
          <div className="group">
            <button
              onClick={handleGoHome}
              className="icon-button home-button"
              title="Go to Home"
            >
              <MdHome />
            </button>
          </div>
          {(isOwner || isEditor) && (
            <div className="group">
              <button
                onClick={() => saveDocument(docId, ydoc)}
                className="icon-button"
                title="Save Document"
              >
                <MdSave />
              </button>

              {/* 🔖 Save named version (opens modal) */}
              <button
                onClick={() => setShowSaveVersionModal(true)}
                className="icon-button"
                title="Save Named Version"

              >
                <VscSaveAll />
              </button>

              <button
                onClick={() => loadVersions(docId)}
                className="icon-button"
                title="Version History"
              >
                <MdHistory />
              </button>
            </div>
          )}

          <div className="group">
            <button
              onClick={handleUndo}
              className="icon-button"
              title="Undo"
            >
              <MdUndo />
            </button>
            <button
              onClick={handleRedo}
              className="icon-button"
              title="Redo"
            >
              <MdRedo />
            </button>
          </div>


          <div className="group">
            <button onClick={() => editor.chain().focus().toggleBold().run()}
              className={editor.isActive('bold') ? 'active' : ''}>
              <MdFormatBold />
            </button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()}
              className={editor.isActive('italic') ? 'active' : ''}>
              <MdFormatItalic />
            </button>
            <button onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={editor.isActive('underline') ? 'active' : ''}>
              <MdFormatUnderlined />
            </button>
          </div>

          <div className="group">
            <button onClick={() => editor.chain().focus().toggleBulletList().run()}>
              <AiOutlineUnorderedList />
            </button>
            <button onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              <AiOutlineOrderedList />
            </button>
          </div>

          <div className="group">
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

          <div className="group">
            <button onClick={() => editor.chain().focus().setTextAlign('left').run()}>
              <MdFormatAlignLeft />
            </button>
            <button onClick={() => editor.chain().focus().setTextAlign('center').run()}>
              <MdFormatAlignCenter />
            </button>
            <button onClick={() => editor.chain().focus().setTextAlign('right').run()}>
              <MdFormatAlignRight />
            </button>
          </div>

          <div className="group">
            <button onClick={addImage}><MdImage /></button>
          </div>

          <div className="group">
            <CodeBlockButton
              editor={editor}
              hideWhenUnavailable={true}
              onToggled={() => console.log('Code block toggled!')}
            />
          </div>

          <TableMenuDropdown editor={editor} />

          <div className="group">
            <select
              value={currentFont}
              onChange={(e) => {
                const v = e.target.value
                setCurrentFont(v)

                if (v === 'default') {
                  editor.chain().focus().unsetFontFamily().run()
                } else {
                  editor.chain().focus().setFontFamily(v).run()
                }
              }}
              style={{ padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid #ccc' }}
            >
              <option value="default">Font</option>
              <option value="Inter">Inter</option>
              <option value="Roboto">Roboto</option>
              <option value="Arial">Arial</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Georgia">Georgia</option>
              <option value="Verdana">Verdana</option>
              <option value="Courier New">Courier New</option>
            </select>
          </div>

          {(isOwner || isEditor) && (
            <div className="group download-menu-wrapper">
              <button
                className="icon-button"
                onClick={() => setShowDownloadMenu(true)}
                title="Download Document"
              >
                <MdDownload />
              </button>

              {showDownloadMenu && (
                <div
                  className="download-menu"
                  onMouseEnter={() => setShowDownloadMenu(true)}
                  onMouseLeave={() => setShowDownloadMenu(false)}
                >
                  {/* <button onClick={downloadAsPDF} className="download-option">
                    <FaFilePdf className="format-icon pdf" />
                    <span>PDF</span>
                  </button> */}
                  <button onClick={downloadAsDocx} className="download-option">
                    <FaFileWord className="format-icon docx" />
                    <span>DOCX</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {isOwner && (
            <div>
              <InviteCollaborator documentId={docId} />
            </div>
          )}

          <div className="group" style={{ marginLeft: "auto" }}>
            <Collaborators provider={provider} />
          </div>

          <div className="group">
            <button
              onClick={handleLogout}
              className="icon-button logout-button"
              title="Logout"
            >
              <MdLogout />
            </button>
          </div>
        </div>

        {/* Mobile Hamburger Menu */}
        <div className="mobile-only mobile-header">
          <div className="mobile-collaborators">
            <Collaborators provider={provider} />
          </div>
          <button className="hamburger-button" onClick={() => setMobileMenuOpen(true)}>
            <MdMenu />
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        <div
          className={`mobile-menu-overlay ${mobileMenuOpen ? 'open' : ''}`}
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Mobile Menu Sidebar */}
        <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="mobile-menu-header">
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Menu</h3>
            <button
              onClick={() => setMobileMenuOpen(false)}
              style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#374151' }}
            >
              <MdClose />
            </button>
          </div>

          <div className="mobile-menu-content">
            {(isOwner || isEditor) && (
              <div className="mobile-menu-section">
                <div className="mobile-menu-section-title">Document</div>
                <div className="mobile-menu-buttons">
                  <button onClick={() => saveDocument(docId, ydoc)} className="mobile-menu-button">
                    <MdSave /> Save Document
                  </button>
                  <button onClick={downloadAsPDF} className="mobile-menu-button">
                    <FaFilePdf className="pdf" /> Download PDF
                  </button>
                  <button onClick={downloadAsDocx} className="mobile-menu-button">
                    <FaFileWord className="docx" /> Download DOCX
                  </button>
                </div>
              </div>
            )}

            <div className="mobile-menu-section">
              <div className="mobile-menu-section-title">Formatting</div>
              <div className="mobile-menu-buttons">
                <button onClick={() => { editor.chain().focus().toggleBold().run(); setMobileMenuOpen(false); }} className="mobile-menu-button">
                  <MdFormatBold /> Bold
                </button>
                <button onClick={() => { editor.chain().focus().toggleItalic().run(); setMobileMenuOpen(false); }} className="mobile-menu-button">
                  <MdFormatItalic /> Italic
                </button>
                <button onClick={() => { editor.chain().focus().toggleUnderline().run(); setMobileMenuOpen(false); }} className="mobile-menu-button">
                  <MdFormatUnderlined /> Underline
                </button>
              </div>
            </div>

            <div className="mobile-menu-section">
              <div className="mobile-menu-section-title">Lists & Headings</div>
              <div className="mobile-menu-buttons">
                <button onClick={() => { editor.chain().focus().toggleBulletList().run(); setMobileMenuOpen(false); }} className="mobile-menu-button">
                  <AiOutlineUnorderedList /> Bullet List
                </button>
                <button onClick={() => { editor.chain().focus().toggleOrderedList().run(); setMobileMenuOpen(false); }} className="mobile-menu-button">
                  <AiOutlineOrderedList /> Numbered List
                </button>
                <button onClick={() => { editor.chain().focus().toggleHeading({ level: 1 }).run(); setMobileMenuOpen(false); }} className="mobile-menu-button">
                  <MdLooksOne /> Heading 1
                </button>
                <button onClick={() => { editor.chain().focus().toggleHeading({ level: 2 }).run(); setMobileMenuOpen(false); }} className="mobile-menu-button">
                  <MdLooksTwo /> Heading 2
                </button>
              </div>
            </div>

            <div className="mobile-menu-section">
              <div className="mobile-menu-section-title">Alignment</div>
              <div className="mobile-menu-buttons">
                <button onClick={() => { editor.chain().focus().setTextAlign('left').run(); setMobileMenuOpen(false); }} className="mobile-menu-button">
                  <MdFormatAlignLeft /> Align Left
                </button>
                <button onClick={() => { editor.chain().focus().setTextAlign('center').run(); setMobileMenuOpen(false); }} className="mobile-menu-button">
                  <MdFormatAlignCenter /> Align Center
                </button>
                <button onClick={() => { editor.chain().focus().setTextAlign('right').run(); setMobileMenuOpen(false); }} className="mobile-menu-button">
                  <MdFormatAlignRight /> Align Right
                </button>
              </div>
            </div>

            <div className="mobile-menu-section">
              <div className="mobile-menu-section-title">Insert</div>
              <div className="mobile-menu-buttons">
                <button
                  onClick={() => {
                    addImage()
                    setMobileMenuOpen(false)
                  }}
                  className="mobile-menu-button"
                >
                  <MdImage /> Add Image
                </button>
                <button
                  onClick={() => {
                    editor
                      .chain()
                      .focus()
                      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                      .run()
                    setMobileMenuOpen(false)
                  }}
                  className="mobile-menu-button"
                >
                  Insert Table
                </button>
                <button
                  onClick={() => {
                    editor.chain().focus().deleteTable().run()
                    setMobileMenuOpen(false)
                  }}
                  className="mobile-menu-button"
                >
                  Delete Table
                </button>
              </div>
            </div>

            <div className="mobile-menu-section">
              <div className="mobile-menu-buttons">
                <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="mobile-menu-button logout-mobile">
                  <MdLogout /> Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <EditorContent className='editor-div' editor={editor} />
      {showRenameModal && (
        <RenameModal
          currentTitle={currentTitle}
          onRename={handleRenameAndSave}
          onCancel={() => setShowRenameModal(false)}
        />
      )}
      {showSaveVersionModal && (
        <SaveVersionModal
          onSave={async (versionName) => {
            // This is what your modal calls
            await saveSnapshot(docId, ydoc, {
              isAutoSave: false,
              versionName,
              userId: user?.id || null,
            })
          }}
          onCancel={() => setShowSaveVersionModal(false)}
        />
      )}
      {showHistory && (
        <VersionHistoryModal
          versions={versions}
          isLoading={isLoadingVersions}
          onRestore={restoreVersion}
          onClose={() => setShowHistory(false)}
        />
      )}
      <div className="alert-container">
        {alerts.map(alert => (
          <AlertToast
            key={alert.id}
            message={alert.message}
            type={alert.type}
            duration={alert.duration}
            onClose={() => removeAlert(alert.id)}
          />
        ))}
      </div>

    </>
  )
}

export default Tiptap