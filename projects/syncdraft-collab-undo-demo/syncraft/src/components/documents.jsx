import { useNavigate } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
import { supabase } from "./supabase_client"
import { Plus, LogOut, FileText, Users, Inbox, MoreVertical, Handshake, Edit2, Trash2 } from "lucide-react"
import "./Documents.css"
import SyncraftLoader from "./Loader"

// Rename Modal Component
function RenameModal({ document, onClose, onRename }) {
  const [newTitle, setNewTitle] = useState(document?.title || "Untitled Document")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newTitle.trim() || isSubmitting) return

    setIsSubmitting(true)
    await onRename(document.id, newTitle.trim())
    setIsSubmitting(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div className="rename-modal-overlay" onClick={onClose}>
      <div className="rename-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rename-modal-header">
          <h3>Rename Document</h3>
          <button className="rename-modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="rename-modal-content">
            <div className="rename-input-wrapper">
              <input
                ref={inputRef}
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Document name"
                maxLength={100}
                className="rename-input"
                disabled={isSubmitting}
              />
              <div className="rename-char-count">{newTitle.length}/100</div>
            </div>
            <div className="rename-modal-actions">
              <button type="button" onClick={onClose} className="rename-btn-cancel">
                Cancel
              </button>
              <button type="submit" className="rename-btn-save" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// Delete Confirmation Modal
function DeleteModal({ document, onClose, onDelete }) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    await onDelete(document.id)
    setIsDeleting(false)
  }

  return (
    <div className="delete-modal-overlay" onClick={onClose}>
      <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
        <div className="delete-modal-header">
          <div className="delete-icon-wrapper">
            <Trash2 size={32} />
          </div>
          <h3>Delete Document?</h3>
        </div>
        <div className="delete-modal-content">
          <p>Are you sure you want to delete <strong>"{document?.title || "Untitled Document"}"</strong>?</p>
          <p className="delete-warning">This action cannot be undone.</p>
        </div>
        <div className="delete-modal-actions">
          <button onClick={onClose} className="delete-btn-cancel">
            Cancel
          </button>
          <button onClick={handleDelete} className="delete-btn-confirm" disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}

// Document Menu Dropdown
function DocumentMenu({ doc, onRename, onDelete, isOwner = true }) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      window.document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      window.document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="document-menu" ref={menuRef}>
      <button
        className="card-menu"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
      >
        <MoreVertical size={18} />
      </button>

      {isOpen && (
        <div className="document-menu-dropdown">
          {isOwner && (
            <button
              className="menu-item"
              onClick={(e) => {
                e.stopPropagation()
                setIsOpen(false)
                onRename()
              }}
            >
              <Edit2 size={16} />
              Rename
            </button>
          )}
          {isOwner && (
            <button
              className="menu-item delete"
              onClick={(e) => {
                e.stopPropagation()
                setIsOpen(false)
                onDelete()
              }}
            >
              <Trash2 size={16} />
              Delete
            </button>
          )}
          {!isOwner && (
            <div className="menu-item disabled">
              No actions available
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Documents() {
  const [docs, setDocs] = useState([])
  const [colDocs, setColDocs] = useState([])
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [renameDoc, setRenameDoc] = useState(null)
  const [deleteDoc, setDeleteDoc] = useState(null)
  const [cssLoaded, setCssLoaded] = useState(false)
  const navigate = useNavigate()

  // Wait for CSS to load
  useEffect(() => {
    const timer = setTimeout(() => setCssLoaded(true), 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError) throw userError
        if (!user) {
          navigate("/")
          return
        }

        setUser(user)

        // Fetch user-owned docs
        const { data: docsData, error: docsError } = await supabase
          .from("documents")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })

        if (docsError) throw docsError
        setDocs(docsData || [])

        // Fetch collaborator references
        const { data: collabData, error: collabError } = await supabase
          .from("collaborators")
          .select("document_id, role")
          .eq("user_id", user.id)

        if (collabError) throw collabError

        // Get full docs for collaborations
        if (collabData && collabData.length > 0) {
          const documentIds = collabData
            .map((c) => c.document_id?.trim())
            .filter(Boolean)

          if (documentIds.length > 0) {
            const { data: colDocsData, error: colDocsError } = await supabase
              .from("documents")
              .select("*")
              .filter('id', 'in', `(${documentIds.map(id => `"${id}"`).join(',')})`)
              .order("created_at", { ascending: false })

            if (colDocsError) throw colDocsError
            setColDocs(colDocsData || [])
          }
        }
      } catch (err) {
        console.error("Error fetching documents:", err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchDocs()
  }, [navigate])

  const createDocument = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from("documents")
        .insert([{ title: "Untitled Document", owner_id: user.id }])
        .select()

      if (error) throw error

      const newDoc = data[0]
      setDocs([newDoc, ...docs])
      navigate(`/documents/${user.id}/${newDoc.id}`)
    } catch (err) {
      console.error("Error creating document:", err)
      alert("Failed to create document")
    }
  }

  const handleRename = async (docId, newTitle) => {
    try {
      const { error } = await supabase
        .from("documents")
        .update({ title: newTitle })
        .eq("id", docId)

      if (error) throw error

      // Update local state
      setDocs(docs.map(doc =>
        doc.id === docId ? { ...doc, title: newTitle } : doc
      ))
      setRenameDoc(null)
    } catch (err) {
      console.error("Error renaming document:", err)
      alert("Failed to rename document")
    }
  }

  const handleDelete = async (docId) => {
    try {
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", docId)

      if (error) throw error

      // Update local state
      setDocs(docs.filter(doc => doc.id !== docId))
      setDeleteDoc(null)
    } catch (err) {
      console.error("Error deleting document:", err)
      alert("Failed to delete document")
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate("/")
  }

  const getUserInitials = (email) => {
    if (!email) return "U"
    return email.charAt(0).toUpperCase()
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now - date)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) return "Today"
    if (diffDays === 2) return "Yesterday"
    if (diffDays <= 7) return `${diffDays - 1} days ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading || !cssLoaded) {
    return <SyncraftLoader />
  }

  if (error) {
    return (
      <div className="error-container">
        <div>
          <h2>Error: {error}</h2>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-wrapper">
      <nav className="dashboard-navbar">
        <div className="navbar-content">
          <div className="user-profile">
            <div className="user-avatar">
              {getUserInitials(user?.email)}
            </div>
            <div className="user-details">
              <h4>{user?.email}</h4>
              <p>Manage your documents</p>
            </div>
          </div>

          <div className="navbar-actions">
            <button className="btn btn-primary" onClick={createDocument}>
              <Plus size={20} className="btn-icon" />
              <span className="btn-text">New Document</span>
            </button>
            <button className="btn btn-secondary" onClick={handleLogout}>
              <LogOut size={20} className="btn-icon" />
              <span className="btn-text">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="dashboard-container">
        <header className="welcome-section">
          <h1 className="welcome-title">Welcome back! 👋</h1>
          <p className="welcome-subtitle">Here are all your documents</p>
        </header>

        <section className="documents-section">
          <div className="section-header">
            <div className="section-title-wrapper">
              <FileText size={24} className="section-icon" />
              <h2>Your Documents</h2>
            </div>
            <span className="document-count">
              {docs.length} document{docs.length !== 1 ? 's' : ''}
            </span>
          </div>

          {docs.length > 0 ? (
            <ul className="documents-list" style={{ opacity: cssLoaded ? 1 : 0 }}>
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="document-card"
                  onClick={() => navigate(`/documents/${user.id}/${doc.id}`)}
                >
                  <div className="card-header">
                    <div className="document-icon">
                      <FileText size={24} />
                    </div>
                    <DocumentMenu
                      doc={doc}
                      onRename={() => setRenameDoc(doc)}
                      onDelete={() => setDeleteDoc(doc)}
                      isOwner={true}
                    />
                  </div>
                  <div className="card-content">
                    <h3 className="document-title">
                      {doc.title || "Untitled Document"}
                    </h3>
                    <p className="document-meta">
                      Created {formatDate(doc.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <FileText size={48} />
              </div>
              <h3 className="empty-state-title">No documents yet</h3>
              <p className="empty-state-subtitle">Create your first document to get started</p>
            </div>
          )}
        </section>

        <section className="documents-section">
          <div className="section-header">
            <div className="section-title-wrapper">
              <Handshake size={24} className="section-icon" />
              <h2>Shared With You</h2>
            </div>
            <span className="document-count">
              {colDocs.length} document{colDocs.length !== 1 ? 's' : ''}
            </span>
          </div>

          {colDocs.length > 0 ? (
            <ul className="documents-list" style={{ opacity: cssLoaded ? 1 : 0 }}>
              {colDocs.map((doc) => (
                <li
                  key={doc.id}
                  className="document-card"
                  onClick={() => navigate(`/documents/${user.id}/${doc.id}`)}
                >
                  <div className="card-header">
                    <div className="document-icon">
                      <FileText size={24} />
                    </div>
                    <DocumentMenu
                      doc={doc}
                      onRename={() => { }}
                      onDelete={() => { }}
                      isOwner={false}
                    />
                  </div>
                  <div className="card-content">
                    <h3 className="document-title">
                      {doc.title || "Untitled Document"}
                    </h3>
                    <div className="document-footer">
                      <p className="document-meta">
                        <Users size={14} className="inline-icon" />
                        Shared document
                      </p>
                      <span className="collab-badge">Collaborator</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Handshake size={48} />
              </div>
              <h3 className="empty-state-title">No shared documents</h3>
              <p className="empty-state-subtitle">Documents shared with you will appear here</p>
            </div>
          )}
        </section>
      </div>

      {renameDoc && (
        <RenameModal
          document={renameDoc}
          onClose={() => setRenameDoc(null)}
          onRename={handleRename}
        />
      )}

      {deleteDoc && (
        <DeleteModal
          document={deleteDoc}
          onClose={() => setDeleteDoc(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}