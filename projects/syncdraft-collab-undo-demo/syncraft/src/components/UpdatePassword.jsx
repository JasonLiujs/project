import { useState } from "react"
import { ArrowLeft, Key, KeyRound, CheckCircle, AlertCircle } from "lucide-react"
import { supabase } from "./supabase_client"
import { useNavigate } from "react-router-dom"
import "./Auth.css" // Reuse the same styles


export default function UpdatePassword() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const navigate = useNavigate()

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    
    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    // Validate password length
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setLoading(true)
    setError("")
    setSuccess("")

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
    } else {
      setSuccess("Password updated successfully! Redirecting to login...")
      setTimeout(() => navigate("/auth"), 2000)
    }

    setLoading(false)
  }

  return (
    <div className="auth-container">
      {/* Back Button */}
      <button 
        className="back-button" 
        onClick={() => navigate('/auth')}
        aria-label="Back to login"
      >
        <ArrowLeft size={16} />
        Back to Login
      </button>

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">
            <Key size={28} strokeWidth={2.5} />
          </div>
          <h2>Set New Password</h2>
          <p>Enter your new password below</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} className="alert-icon" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <CheckCircle size={18} className="alert-icon" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="auth-form">
          <div className="form-group">
            <label>New Password</label>
            <div className="input-wrapper">
              <KeyRound size={18} className="input-icon" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Confirm New Password</label>
            <div className="input-wrapper">
              <KeyRound size={18} className="input-icon" />
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="button-group">
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? <span className="spinner"></span> : "Update Password"}
            </button>
          </div>
        </form>

        <div className="auth-footer">
          Protected by enterprise-grade security
        </div>
      </div>
    </div>
  )
}