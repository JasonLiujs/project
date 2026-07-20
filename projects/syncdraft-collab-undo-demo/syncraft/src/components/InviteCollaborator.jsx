import { useState } from "react";
import { supabase } from "./supabase_client";
import "./InviteCollaborator.css";

export default function InviteCollaborator({ documentId }) {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleInvite = async () => {
    if (!email.trim()) {
      setMessage({ type: "error", text: "Please enter an email address." });
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      // Step 1: Look up user by email
      const { data, error } = await supabase.rpc("get_user_by_email", {
        p_email: email.trim(),
      });

      if (error) throw error;
      if (!data || data.length === 0) {
        setMessage({ type: "error", text: "No user found with that email address." });
        setLoading(false);
        return;
      }

      const userId = data[0].id;

      // Step 2: Add collaborator
      const { error: insertError } = await supabase
        .from("collaborators")
        .insert([{ document_id: documentId, user_id: userId, role }]);

      if (insertError) throw insertError;

      setMessage({ type: "success", text: `Successfully invited ${email} as ${role}!` });
      
      setTimeout(() => {
        setEmail("");
        setShowModal(false);
        setMessage({ type: "", text: "" });
      }, 2000);
    } catch (err) {
       if (err?.message?.includes("duplicate key value")) {
    setMessage({
      type: "success",
      text: "This user is already a collaborator.",
    })
  } else {
    setMessage({
      type: "error",
      text: "Error inviting collaborator: " + err.message,
    })
  }
} finally {
  setLoading(false)
}

    setLoading(false);
  };

  return (
    <>
      {/* Invite Button */}
      <button className="invite-btn" onClick={() => setShowModal(true)}>
        Invite
      </button>

      {/* Modal */}
      {showModal && (
        <div className="invite-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="invite-modal" onClick={(e) => e.stopPropagation()}>
            <div className="invite-modal-header">
              <h3>Invite Collaborator</h3>
              <button
                className="invite-modal-close"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            {message.text && (
              <div className={`invite-message ${message.type}`}>
                <span>{message.type === "success" ? "✓" : "⚠️"}</span>
                <span>{message.text}</span>
              </div>
            )}

            <form
              className="invite-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleInvite();
              }}
            >
              <div className="invite-form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="invite-form-group">
                <label htmlFor="role">Role</label>
                <select 
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={loading}
                >
                  <option value="editor">Editor - Can edit the document</option>
                  <option value="viewer">Viewer - Can only view the document</option>
                </select>
              </div>

              <div className="invite-form-actions">
                <button
                  type="button"
                  className="invite-btn-cancel"
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="invite-btn-submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="invite-loading"></span>
                      <span style={{ marginLeft: "0.5rem" }}>Inviting...</span>
                    </>
                  ) : (
                    "Send Invite"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}