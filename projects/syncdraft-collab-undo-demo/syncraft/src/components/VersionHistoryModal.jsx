import { useState } from "react";
import "./VersionHistoryModal.css";

export default function VersionHistoryModal({ 
  versions, 
  isLoading, 
  onRestore, 
  onClose 
}) {
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'manual', 'auto'

  // Separate versions by type
  const manualVersions = versions.filter(v => !v.is_auto_save);
  const autoVersions = versions.filter(v => v.is_auto_save);

  // Get current tab versions
  const getCurrentVersions = () => {
    if (activeTab === 'manual') return manualVersions;
    if (activeTab === 'auto') return autoVersions;
    return versions;
  };

  const currentVersions = getCurrentVersions();

  return (
    <div className="version-history-overlay" onClick={onClose}>
      <div className="version-history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="version-history-header">
          <h3>Version History</h3>
          <button
            className="version-history-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="version-history-tabs">
          <button
            className={`version-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All ({versions.length})
          </button>
          <button
            className={`version-tab ${activeTab === 'manual' ? 'active' : ''}`}
            onClick={() => setActiveTab('manual')}
          >
            Named ({manualVersions.length})
          </button>
          <button
            className={`version-tab ${activeTab === 'auto' ? 'active' : ''}`}
            onClick={() => setActiveTab('auto')}
          >
            Auto-saves ({autoVersions.length})
          </button>
        </div>

        <div className="version-history-content">
          {isLoading && (
            <div className="version-history-loading">
              <div className="version-loading-spinner"></div>
              <p>Loading versions...</p>
            </div>
          )}

          {!isLoading && currentVersions.length === 0 && (
            <div className="version-history-empty">
              {activeTab === 'all' && (
                <>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <p>No versions saved yet.</p>
                  <span>Save your document to create auto-saves, or create a named version.</span>
                </>
              )}
              {activeTab === 'manual' && (
                <>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <p>No named versions yet.</p>
                  <span>Click "Save Version" to create a named snapshot.</span>
                </>
              )}
              {activeTab === 'auto' && (
                <>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <p>No auto-saves yet.</p>
                  <span>Auto-saves are created when you save your document.</span>
                </>
              )}
            </div>
          )}

          {!isLoading && currentVersions.length > 0 && (
            <ul className="version-history-list">
              {currentVersions.map((v) => (
                <li key={v.id} className="version-history-item">
                  <div className="version-info">
                    <div className="version-main">
                      {v.version_name ? (
                        <div className="version-name">{v.version_name}</div>
                      ) : (
                        <div className="version-date-primary">
                          {new Date(v.created_at).toLocaleString()}
                        </div>
                      )}
                      <div className="version-meta">
                        {v.version_name && (
                          <span className="version-date">
                            {new Date(v.created_at).toLocaleString()}
                          </span>
                        )}
                        <span className={`version-badge ${v.is_auto_save ? 'auto' : 'manual'}`}>
                          {v.is_auto_save ? 'Auto-save' : 'Named'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    className="version-restore-btn"
                    onClick={() => onRestore(v.id)}
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}