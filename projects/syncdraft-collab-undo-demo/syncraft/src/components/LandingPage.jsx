import { useNavigate } from 'react-router-dom'
import './LandingPage.css'
import iconPng from '../assets/favi-new-120.png';

export default function LandingPage() {
  const navigate = useNavigate()

  const features = [
    {
      icon: "sync",
      title: "Real-Time Collaboration",
      description: "Edit together with conflict-free CRDT technology"
    },
    {
      icon: "offline",
      title: "Offline First",
      description: "Keep working without internet, syncs automatically"
    },
    {
      icon: "history",
      title: "Version History",
      description: "Never lose work with automatic snapshots"
    },
    {
      icon: "shield",
      title: "Secure & Private",
      description: "Enterprise-grade authentication and encryption"
    },
    {
      icon: "bolt",
      title: "Lightning Fast",
      description: "Powered by Yjs and optimized WebSocket sync"
    },
    {
      icon: "edit",
      title: "Rich Text Editor",
      description: "Full formatting, images, links, and more"
    }
  ]

  const getIconSVG = (type) => {
    const icons = {
      sync: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" /></svg>,
      offline: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" /></svg>,
      history: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
      shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
      bolt: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
      edit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
    }
    return icons[type]
  }

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="navbar">
        <div className="navbar-container">
          <div className="navbar-content">
            {/* Logo */}
            <div className="logo-section">
              <div className="logo-icon">
                <img src={iconPng} alt="SyncDraft Icon" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <span className="logo-text">SyncDraft</span>
            </div>

            {/* Desktop Navigation */}
            <div className="nav-links">
              <a href="#home" className="nav-link">Home</a>
              <a href="#features" className="nav-link">Features</a>
              <a href="#about" className="nav-link">About</a>
              <a href="#pricing" className="nav-link">Pricing</a>
            </div>

            {/* Auth Buttons */}

            <div className="auth-buttons">

              <button onClick={() => navigate('/demo')} className="demo-button">
                Try Demo
              </button>
              <button onClick={() => navigate('/login')} className="signin-button">
                Sign In
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="hero-section">
        <div className="hero-container">
          {/* Badge Pills */}
          <div className="badge-pills">
            <span className="badge badge-blue">
              Powered by CRDT
            </span>
            <span className="badge badge-purple">
              Enterprise Ready
            </span>
            <span className="badge badge-green">
              100% Free & Open Source
            </span>
          </div>

          {/* Main Headline */}
          <div className="hero-content">
            <h1 className="hero-title">
              Effortless Collaboration.
              <br />
              <span className="gradient-text">
                Brilliant Documents.
              </span>
            </h1>

            <p className="hero-subtitle">
              Experience the ultimate collaborative editing platform with SyncDraft.
              <br className="desktop-break" />
              Real-time document collaboration that just works.
            </p>

            {/* CTA Button */}
            <button
              onClick={() => navigate('/login')}
              className="cta-button"
            >
              <span>Get Started Free</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>


            <p className="hero-note">
              Designed for teams. Engineered for scale.
            </p>
          </div>
          {/* Tech Stack Logos */}
          <div className="tech-stack">
            <div className="tech-item">
              <div className="tech-logo">
                <img
                  src="https://cdn.simpleicons.org/supabase/3FCF8E"
                  alt="Supabase"
                />
              </div>
              <span className="tech-name">Supabase</span>
            </div>
            <div className="tech-item">
              <div className="tech-logo">
                <svg viewBox="0 0 24 24" fill="#FDB515">
                  <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18L19.82 8 12 11.82 4.18 8 12 4.18zM4 9.82l7 3.5v7.36l-7-3.5V9.82zm16 0v7.36l-7 3.5v-7.36l7-3.5z" />
                </svg>
              </div>
              <span className="tech-name">Yjs</span>
            </div>
            <div className="tech-item">
              <div className="tech-logo">
                <img
                  src="https://cdn.simpleicons.org/redis/DC382D"
                  alt="Redis"
                />
              </div>
              <span className="tech-name">Redis</span>
            </div>
            <div className="tech-item">
              <div className="tech-logo">
                <svg viewBox="0 0 24 24" fill="#4A90E2">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
              </div>
              <span className="tech-name">WebSocket</span>
            </div>
            <div className="tech-item">
              <div className="tech-logo">
                <svg viewBox="0 0 24 24" fill="#23ACD0">
                  <path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2zm2-11h14v1H5V7zm0 7h14v1H5v-1zm0 7h14v1H5v-1z" />
                </svg>
              </div>
              <span className="tech-name">TipTap</span>
            </div>
            <div className="tech-item">
              <div className="tech-logo">
                <img
                  src="https://cdn.simpleicons.org/grafana/F46800"
                  alt="Grafana"
                />
              </div>
              <span className="tech-name">Grafana</span>
            </div>
          </div>
        </div>
      </section>

      {/* Image Gallery Section */}
      <section className="gallery-section">
        <div className="gallery-container">
          <div className="gallery-grid">
            <div className="gallery-item gradient-blue">
              <div className="gallery-content">
                <div className="gallery-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                  </svg>
                </div>
                <div className="gallery-text">Real-time Sync</div>
              </div>
            </div>
            <div className="gallery-item gradient-purple">
              <div className="gallery-content">
                <div className="gallery-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </div>
                <div className="gallery-text">Rich Editor</div>
              </div>
            </div>
            <div className="gallery-item gradient-pink">
              <div className="gallery-content">
                <div className="gallery-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div className="gallery-text">Collaboration</div>
              </div>
            </div>
            <div className="gallery-item gradient-green">
              <div className="gallery-content">
                <div className="gallery-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="gallery-text">Version History</div>
              </div>
            </div>
            <div className="gallery-item gradient-orange">
              <div className="gallery-content">
                <div className="gallery-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
                  </svg>
                </div>
                <div className="gallery-text">Offline Mode</div>
              </div>
            </div>
            <div className="gallery-item gradient-red">
              <div className="gallery-content">
                <div className="gallery-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <div className="gallery-text">Conflict-Free</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="features-container">
          <div className="features-header">
            <h2 className="features-title">
              Everything You Need for
              <br />
              <span className="features-title-accent">Seamless Collaboration</span>
            </h2>
            <p className="features-subtitle">
              Built with cutting-edge technology to deliver the best collaborative editing experience
            </p>
          </div>

          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">
                  {getIconSVG(feature.icon)}
                </div>
                <h3 className="feature-title">
                  {feature.title}
                </h3>
                <p className="feature-description">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="about-section">
        <div className="about-container">
          <div className="about-content">
            <div className="about-text">
              <span className="about-label">About SyncDraft</span>
              <h2 className="about-title">
                Built by Sachin,
                <br />
                <span className="gradient-text">For Everyone</span>
              </h2>
              <p className="about-description">
                SyncDraft was born from a simple vision: to create a collaborative editing platform that combines the power of modern web technologies with an intuitive user experience. We believe that great tools should be accessible to everyone, which is why SyncDraft is completely free and open source.
              </p>
              <p className="about-description">
                Powered by cutting-edge technologies like Yjs for conflict-free collaborative editing, Supabase for reliable data storage, and Redis for lightning-fast synchronization, SyncDraft delivers enterprise-grade performance without the enterprise price tag.
              </p>
              <div className="about-stats">
                <div className="stat-item">
                  <div className="stat-number">100%</div>
                  <div className="stat-label">Open Source</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">Real-time</div>
                  <div className="stat-label">Synchronization</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">Offline</div>
                  <div className="stat-label">First Design</div>
                </div>
              </div>
            </div>
            <div className="about-image">
              <div className="about-image-card">
                <div className="about-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div className="about-card-text">
                  <h3>Open Source Philosophy</h3>
                  <p>Community-driven development with transparency at its core</p>
                </div>
              </div>
              <div className="about-image-card">
                <div className="about-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
                <div className="about-card-text">
                  <h3>Modern Architecture</h3>
                  <p>Built with React, WebSockets, and cutting-edge CRDTs</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="pricing-section">
        <div className="pricing-container">
          <div className="pricing-header">
            <h2 className="pricing-title">
              Simple, Transparent
              <br />
              <span className="gradient-text">Forever Free</span>
            </h2>
            <p className="pricing-subtitle">
              No hidden fees. No premium tiers. Just powerful collaboration tools, completely free.
            </p>
          </div>

          <div className="pricing-card">
            <div className="pricing-badge">
              <svg viewBox="0 0 24 24" fill="currentColor" className="pricing-badge-icon">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span>Open Source</span>
            </div>

            <div className="pricing-amount">
              <span className="currency">₹</span>
              <span className="price">0</span>
              <span className="period">/forever</span>
            </div>

            <h3 className="pricing-plan-title">Free for Everyone</h3>
            <p className="pricing-plan-description">
              All features included. No credit card required. No catch.
            </p>

            <ul className="pricing-features">
              <li className="pricing-feature">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Unlimited documents</span>
              </li>
              <li className="pricing-feature">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Real-time collaboration</span>
              </li>
              <li className="pricing-feature">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Offline mode support</span>
              </li>
              <li className="pricing-feature">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Version history</span>
              </li>
              <li className="pricing-feature">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Rich text editing</span>
              </li>
              <li className="pricing-feature">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Enterprise-grade security</span>
              </li>
            </ul>

            <button
              onClick={() => navigate('/login')}
              className="pricing-button"
            >
              Get Started Free
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>



            <div className="pricing-opensource">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
              <p>
                SyncDraft is open source and always will be. Check out our code on{' '}
                <a href="https://github.com/Sachin1395/Distributed-Collaborative-Editor" target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-container">
          <h2 className="cta-title">
            Ready to Start Collaborating?
          </h2>
          <p className="cta-subtitle">
            Join thousands of teams building better documents together.
            <br />
            Offline or online, your work always stays in sync.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="cta-button-white"
          >
            <span>Get Started Free</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-top">
            <div className="footer-section">
              <div className="footer-logo">
                <div className="logo-icon">
                  <img src={iconPng} alt="SyncDraft Icon" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <span className="logo-text">SyncDraft</span>
              </div>
              <p className="footer-description">
                The modern collaborative editing platform built for teams.
              </p>
              <div className="footer-social">
                <a href="https://github.com/Sachin1395/Distributed-Collaborative-Editor" className="social-link" aria-label="GitHub">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
                  </svg>
                </a>
                <a href="https://www.linkedin.com/in/sachin1395" className="social-link" aria-label="LinkedIn">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
                    <circle cx="4" cy="4" r="2" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="footer-section">
              <h4 className="footer-heading">Product</h4>
              <ul className="footer-list">
                <li><a href="#features" className="footer-link">Features</a></li>
                <li><a href="https://github.com/Sachin1395/Distributed-Collaborative-Editor#readme" className="footer-link">Security</a></li>
              </ul>
            </div>

            <div className="footer-section">
              <h4 className="footer-heading">Company</h4>
              <ul className="footer-list">
                <li><a href="#about" className="footer-link">About</a></li>
                <li><a href="#" className="footer-link">Blog</a></li>
                <li><a href="https://github.com/Sachin1395/Distributed-Collaborative-Editor/issues" className="footer-link">Contact</a></li>
              </ul>
            </div>

            <div className="footer-section">
              <h4 className="footer-heading">Resources</h4>
              <ul className="footer-list">
                <li><a href="https://github.com/Sachin1395/Distributed-Collaborative-Editor/" className="footer-link">Documentation</a></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <p className="footer-text">
              © 2026 SyncDraft. Built with React, Yjs, TipTap, Supabase, and Redis.
            </p>
            <div className="footer-links">
              <a href="/privacy" className="footer-link">Privacy Policy</a>
              <a href="/terms" className="footer-link">Terms of Service</a>
              <a href="/cookies" className="footer-link">Cookie Policy</a>

            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
