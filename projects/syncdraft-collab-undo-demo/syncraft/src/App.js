import { Routes, Route, Navigate, useParams } from "react-router-dom"
import { useState, useEffect } from "react"
import { supabase } from "./components/supabase_client"

import LandingPage from "./components/LandingPage"
import Login from "./components/login"
import Documents from "./components/documents"
import Tiptap from "./components/editor"
import SyncraftLoader from "./components/Loader"
import UpdatePassword from "./components/UpdatePassword"
import DemoEditor from "./components/demo_editor.jsx"
import PrivacyPolicy from "./components/PrivacyPolicy"
import TermsOfService from "./components/TermsOfService"
import CookiePolicy from "./components/CookiePolicy"

/* ─────────────────────────────────────────────
   Wake up Render backend (cold start fix)
───────────────────────────────────────────── */
const wakeUpBackend = async () => {
  try {
    await fetch("https://syncdraft-distributed-collaborative.onrender.com/", {
      method: "GET",
      mode: "cors",
    })
    console.log("Backend awake")
  } catch (err) {
    console.error("Backend wake-up failed", err)
  }
}



function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.body.style.visibility = "visible";
  }, []);


  useEffect(() => {
    const init = async () => {
      //  Wake backend early
      wakeUpBackend()

      //  Get initial session
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setLoading(false)
    }

    init()

    //  Listen to auth changes
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session)
      })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <SyncraftLoader message="Loading" />

  return (
    <Routes>
      {/* Public landing page */}
      <Route
        path="/"
        element={
          session
            ? <Navigate to={`/my-documents/${session.user.id}`} replace />
            : <LandingPage />
        }
      />

      {/* Login */}
      <Route
        path="/login"
        element={
          session
            ? <Navigate to={`/my-documents/${session.user.id}`} replace />
            : <Login />
        }
      />

      {/* Documents list (protected) */}
      <Route
        path="/my-documents/:userId"
        element={session ? <Documents /> : <Navigate to="/" replace />}
      />

      {/* Editor (protected) */}
      <Route
        path="/documents/:userId/:docId"
        element={
          session
            ? <EditorWrapper user={session.user} />
            : <Navigate to="/" replace />
        }
      />

      {/* Update password */}
      <Route path="/update-password" element={<UpdatePassword />} />

      <Route path="/demo" element={<DemoEditor />} />

      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/cookies" element={<CookiePolicy />} />


      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

/* ─────────────────────────────────────────────
   Editor Wrapper
───────────────────────────────────────────── */
function EditorWrapper({ user }) {
  const { docId } = useParams()
  if (!user) return <SyncraftLoader message="Loading Editor" />
  return <Tiptap docId={docId} user={user} />
}

export default App
