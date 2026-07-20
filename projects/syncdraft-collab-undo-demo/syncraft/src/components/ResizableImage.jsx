// ResizableImage.js - Custom extension for resizable images
import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import React, { useState, useRef, useEffect } from 'react'

// React component for the resizable image
const ResizableImageComponent = ({ node, updateAttributes, editor }) => {
  const [isResizing, setIsResizing] = useState(false)
  const [dimensions, setDimensions] = useState({
    width: node.attrs.width || null,
    height: node.attrs.height || null
  })
  const imageRef = useRef(null)
  const resizeInfoRef = useRef({ corner: '', startX: 0, startY: 0, startWidth: 0, startHeight: 0, aspectRatio: 1 })

  const isEditable = editor.isEditable

  useEffect(() => {
    // Get natural dimensions when image loads
    const img = imageRef.current
    if (img && img.complete) {
      if (!node.attrs.width && !node.attrs.height) {
        setDimensions({
          width: img.naturalWidth,
          height: img.naturalHeight
        })
      }
    }
  }, [node.attrs.width, node.attrs.height])

  useEffect(() => {
    setDimensions({
      width: node.attrs.width || null,
      height: node.attrs.height || null
    })
  }, [node.attrs.width, node.attrs.height])

  const handleMouseDown = (e, corner) => {
    if (!isEditable) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const img = imageRef.current
    if (!img) return

    const rect = img.getBoundingClientRect()
    const currentWidth = dimensions.width || rect.width
    const currentHeight = dimensions.height || rect.height
    const aspectRatio = currentHeight / currentWidth

    resizeInfoRef.current = {
      corner,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: currentWidth,
      startHeight: currentHeight,
      aspectRatio
    }
    
    setIsResizing(true)

    // Attach listeners to document for better tracking
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleMouseMove = (e) => {
    if (!isResizing) return

    const { corner, startX, startY, startWidth, startHeight, aspectRatio } = resizeInfoRef.current
    const deltaX = e.clientX - startX
    const deltaY = e.clientY - startY
    
    let newWidth = startWidth
    let newHeight = startHeight
    
    if (corner === 'se') {
      // Southeast corner - resize proportionally
      newWidth = Math.max(50, startWidth + deltaX)
      newHeight = newWidth * aspectRatio
    } else if (corner === 'e') {
      // East side - width only
      newWidth = Math.max(50, startWidth + deltaX)
      newHeight = startHeight
    } else if (corner === 's') {
      // South side - height only
      newWidth = startWidth
      newHeight = Math.max(50, startHeight + deltaY)
    }
    
    setDimensions({ width: newWidth, height: newHeight })
  }

  const handleMouseUp = () => {
    if (!isResizing) return
    
    setIsResizing(false)
    
    // Update the node attributes
    updateAttributes({
      width: Math.round(dimensions.width),
      height: Math.round(dimensions.height)
    })
    
    // Remove listeners
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  const handleImageLoad = (e) => {
    // Set initial dimensions if not set
    if (!dimensions.width && !dimensions.height) {
      const img = e.target
      setDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight
      })
      updateAttributes({
        width: img.naturalWidth,
        height: img.naturalHeight
      })
    }
  }

  return (
    <NodeViewWrapper
  style={{
    display: 'inline-block',
    position: 'relative',
    lineHeight: 0,
    width: dimensions.width ? `${dimensions.width}px` : 'auto',
    height: dimensions.height ? `${dimensions.height}px` : 'auto',
    boxSizing: 'border-box'
  }}
>
  <img
    ref={imageRef}
    src={node.attrs.src}
    alt={node.attrs.alt || ''}
    title={node.attrs.title || ''}
    onLoad={handleImageLoad}
    style={{
      width: '100%',
      height: '100%',
      display: 'block',
      objectFit: 'contain',
      borderRadius: '2px'
    }}
    draggable={false}
  />

  {isEditable && (
    <>
      {/* Example SE handle */}
      <div
        onMouseDown={(e) => handleMouseDown(e, 'se')}
        style={{
          position: 'absolute',
          right: '0',
          bottom: '0',
          width: '8px',
          height: '8px',
          backgroundColor: '#1a73e8',
          border: '1px solid white',
          borderRadius: '50%',
          cursor: 'nwse-resize',
          zIndex: 10,
          transform: 'translate(50%, 50%)',
        }}
      />
      {/* other handles similarly */}
    </>
  )}
</NodeViewWrapper>

  )
}

// Custom Image extension
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element => {
          const width = element.getAttribute('width') || element.style.width
          return width ? parseInt(width) : null
        },
        renderHTML: attributes => {
          if (!attributes.width) return {}
          return { 
            width: `${attributes.width}`,
            style: `width: ${attributes.width}px;`
          }
        }
      },
      height: {
        default: null,
        parseHTML: element => {
          const height = element.getAttribute('height') || element.style.height
          return height ? parseInt(height) : null
        },
        renderHTML: attributes => {
          if (!attributes.height) return {}
          return { 
            height: `${attributes.height}`,
            style: `height: ${attributes.height}px;`
          }
        }
      }
    }
  },

  renderHTML({ HTMLAttributes }) {
    // Ensure both attribute and inline style are rendered
    const { width, height, ...restAttrs } = HTMLAttributes
    let style = ''
    
    if (width) {
      style += `width: ${width}px; `
    }
    if (height) {
      style += `height: ${height}px; `
    }
    
    return ['img', { 
      ...restAttrs, 
      width: width || undefined,
      height: height || undefined,
      style: style || undefined 
    }]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent)
  }
})