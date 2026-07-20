import { useState } from "react";
import "./RenameModal.css";

export default function RenameModal({ currentTitle, onRename, onCancel }) {
  const [title, setTitle] = useState(currentTitle || "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleRename = async () => {
    if (!title.trim()) {
      setMessage({ type: "error", text: "Please enter a document title." });
      return;
    }

    if (title.trim() === currentTitle) {
      setMessage({ type: "error", text: "Please enter a different title." });
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      await onRename(title.trim());
      setMessage({ type: "success", text: "Document renamed successfully!" });
      
      setTimeout(() => {
        onCancel();
      }, 1000);
    } catch (err) {
      setMessage({ type: "error", text: "Error renaming document: " + err.message });
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleRename();
    }
  };

  return (
    <div className="rename-modal-overlay" onClick={onCancel}>
      <div className="rename-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rename-modal-header">
          <h3>Rename Document</h3>
          <button
            className="rename-modal-close"
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        {message.text && (
          <div className={`rename-message ${message.type}`}>
            <span>{message.type === "success" ? "✓" : "⚠️"}</span>
            <span>{message.text}</span>
          </div>
        )}

        <div className="rename-form">
          <div className="rename-form-group">
            <label htmlFor="title">Document Title</label>
            <input
              id="title"
              type="text"
              placeholder="Enter document title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              required
              autoFocus
            />
          </div>

          <div className="rename-form-actions">
            <button
              type="button"
              className="rename-btn-cancel"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rename-btn-submit"
              onClick={handleRename}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="rename-loading"></span>
                  <span style={{ marginLeft: "0.5rem" }}>Renaming...</span>
                </>
              ) : (
                "Rename"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}