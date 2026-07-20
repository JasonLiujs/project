import './legal.css'

export default function LegalLayout({ title, updatedAt, children }) {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <header className="legal-header">
          <h1 className="legal-title">{title}</h1>
          <p className="legal-updated">Last updated: {updatedAt}</p>
        </header>

        <section className="legal-content">
          {children}
        </section>
      </div>
    </div>
  )
}
