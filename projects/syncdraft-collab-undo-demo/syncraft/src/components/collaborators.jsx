import { useEffect, useState } from "react"

export default function Collaborators({ provider }) {
  const [users, setUsers] = useState([])
  const [hoveredUser, setHoveredUser] = useState(null)

  useEffect(() => {
    const updateUsers = () => {
      const states = Array.from(provider.awareness.getStates().values())
      setUsers(states.map(s => s.user)) 
    }

    updateUsers()

    // listen for changes
    provider.awareness.on("change", updateUsers)

    // cleanup
    return () => {
      provider.awareness.off("change", updateUsers)
    }
  }, [provider])

  // Extract initials from email/name
  const getInitials = (name) => {
    if (!name) return "?"
    const parts = name.split("@")[0].split(".")
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "0.25rem",
      position: "relative"
    }}>
      {users.map((u, idx) => (
        <div
          key={idx}
          onMouseEnter={() => setHoveredUser(idx)}
          onMouseLeave={() => setHoveredUser(null)}
          style={{
            position: "relative",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: u?.color || "#6b7280",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            fontWeight: "600",
            cursor: "pointer",
            border: "2px solid white",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            transform: hoveredUser === idx ? "scale(1.1)" : "scale(1)",
            zIndex: hoveredUser === idx ? 10 : 1
          }}
        >
          {getInitials(u?.name)}
          
          {/* Tooltip on hover */}
          {hoveredUser === idx && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: "50%",
              transform: "translateX(-50%)",
              background: "#1f2937",
              color: "white",
              padding: "0.4rem 0.75rem",
              borderRadius: "6px",
              fontSize: "0.8rem",
              whiteSpace: "nowrap",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              zIndex: 1000,
              animation: "fadeIn 0.2s ease"
            }}>
              {u?.name || "Anonymous"}
              {/* Triangle pointer */}
              <div style={{
                position: "absolute",
                top: "-4px",
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "4px solid transparent",
                borderRight: "4px solid transparent",
                borderBottom: "4px solid #1f2937"
              }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}