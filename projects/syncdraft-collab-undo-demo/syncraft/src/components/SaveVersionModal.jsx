import { useState } from "react";
import "./SaveVersionModal.css";

export default function SaveVersionModal({ onSave, onCancel }) {
  const [versionName, setVersionName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleSave = async () => {
    if (!versionName.trim()) {
      setMessage({ type: "error", text: "Please enter a version name." });
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      await onSave(versionName.trim());
      setMessage({ type: "success", text: "Version saved successfully!" });
      
      setTimeout(() => {
        onCancel();
      }, 1000);
    } catch (err) {
      setMessage({ type: "error", text: "Error saving version: " + err.message });
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleSave();
    }
  };

  const generateDefaultName = () => {
    const now = new Date();
    return `Snapshot ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const handleUseDefault = () => {
    setVersionName(generateDefaultName());
  };

  return (
    <div className="save-version-modal-overlay" onClick={onCancel}>
      <div className="save-version-modal" onClick={(e) => e.stopPropagation()}>
        <div className="save-version-modal-header">
          <h3>Save Version</h3>
          <button
            className="save-version-modal-close"
            onClick={onCancel}
            disabled={loading}
          >
            ×
          </button>
        </div>

        {message.text && (
          <div className={`save-version-message ${message.type}`}>
            <span>{message.type === "success" ? "✓" : "⚠️"}</span>
            <span>{message.text}</span>
          </div>
        )}

        <div className="save-version-form">
          <div className="save-version-form-group">
            <label htmlFor="versionName">Version Name</label>
            <input
              id="versionName"
              type="text"
              placeholder="e.g., Draft v1, Final review, Before major changes"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              required
              autoFocus
            />
            <button
              type="button"
              className="save-version-quick-fill"
              onClick={handleUseDefault}
              disabled={loading}
            >
              Use timestamp
            </button>
          </div>

          <div className="save-version-info">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM7 4v1h2V4H7zm0 2v6h2V6H7z"/>
            </svg>
            <span>Create a snapshot of your current document to restore later</span>
          </div>

          <div className="save-version-form-actions">
            <button
              type="button"
              className="save-version-btn-cancel"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="save-version-btn-submit"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="save-version-loading"></span>
                  <span style={{ marginLeft: "0.5rem" }}>Saving...</span>
                </>
              ) : (
                "Save Version"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}