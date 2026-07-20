import { useState, useEffect } from 'react'
import './Loader.css'

const COMMANDS = [
  '> initializing workspace...',
  '> connecting peers...',
  '> fetching last sync state...',
  '> ready.'
]

const SyncraftLoader = ({ message = "Crafting your workspace" }) => {
  const [terminalLines, setTerminalLines] = useState([])
  const [showCursor, setShowCursor] = useState(true)
  const [dots, setDots] = useState('')

  useEffect(() => {
    COMMANDS.forEach((command, index) => {
      setTimeout(() => {
        setTerminalLines(prev => [...prev, command])
      }, index * 800)
    })

    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev)
    }, 500)

    const dotsInterval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'))
    }, 400)

    return () => {
      clearInterval(cursorInterval)
      clearInterval(dotsInterval)
    }
  }, [])

  return (
    <div className="syncraft-loader">
      <div className="syncraft-loader__container">
        <div className="syncraft-logo">
          <div className="syncraft-logo__block syncraft-logo__block--1"></div>
          <div className="syncraft-logo__block syncraft-logo__block--2"></div>
          <div className="syncraft-logo__block syncraft-logo__block--3"></div>
          <div className="syncraft-logo__block syncraft-logo__block--4"></div>
          <div className="syncraft-logo__center">S</div>
        </div>

        <div className="syncraft-loader__message">
          {message}{dots}
        </div>

        <div className="syncraft-terminal">
          <div className="syncraft-terminal__header">
            <div className="syncraft-terminal__dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div className="syncraft-terminal__title">syncraft.init</div>
          </div>
          <div className="syncraft-terminal__body">
            {terminalLines.map((line, index) => (
              <div key={index} className="syncraft-terminal__line">
                {line}
                {index === terminalLines.length - 1 && showCursor && (
                  <span className="syncraft-terminal__cursor">_</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SyncraftLoader
