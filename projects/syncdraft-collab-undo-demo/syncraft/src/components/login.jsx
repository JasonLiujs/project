import { useState } from "react"
import { ArrowLeft, Lock, Mail, KeyRound, CheckCircle, AlertCircle } from "lucide-react"
import { supabase } from "./supabase_client"
import { useNavigate } from "react-router-dom"
import "./Auth.css"

export default function Auth() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [mode, setMode] = useState("login") // "login" or "signup"
  const navigate = useNavigate()
  
  // Handle signup
  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")
    
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
    } else {
      setSuccess("Check your email for verification link!")
      if (data?.user) {
        setTimeout(() => navigate(`/my-documents/${data.user.id}`), 2000)
      }
    }
    setLoading(false)
  }

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
    } else {
      if (data?.user) {
        navigate(`/my-documents/${data.user.id}`)
      }
    }
    setLoading(false)
  }

  // Handle password reset
  const handleResetPassword = async () => {
    if (!email) {
      setError("Please enter your email to reset your password.")
      return
    }

    setLoading(true)
    setError("")
    setSuccess("")

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })

    if (error) {
      setError(error.message)
    } else {
      setSuccess("Password reset email sent. Check your inbox.")
    }

    setLoading(false)
  }

  return (
    <div className="auth-container">
      {/* Back Button */}
      <button 
        className="back-button" 
        onClick={() => navigate('/')}
        aria-label="Back to home"
      >
        <ArrowLeft size={16} />
        Back to Home
      </button>

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">
            <Lock size={28} strokeWidth={2.5} />
          </div>
          <h2>{mode === "login" ? "Welcome Back" : "Create an Account"}</h2>
          <p>{mode === "login" ? "Sign in to your account" : "Start collaborating with Syncdraft"}</p>
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

        <form className="auth-form" onSubmit={mode === "login" ? handleLogin : handleSignUp}>
          <div className="form-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-wrapper">
              <KeyRound size={18} className="input-icon" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            {mode === "login" && (
              <button
                type="button"
                className="link-button"
                onClick={handleResetPassword}
                disabled={loading}
              >
                Forgot password?
              </button>
            )}
          </div>

          <div className="button-group">
            <button
              disabled={loading}
              className="btn btn-primary"
              type="submit"
            >
              {loading ? <span className="spinner"></span> : mode === "login" ? "Sign In" : "Sign Up"}
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login")
                setError("")
                setSuccess("")
              }}
              disabled={loading}
            >
              {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
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