import React, { useState, useRef, useCallback } from 'react'

interface GridDividerProps {
  direction: 'horizontal' | 'vertical'
  onResize: (delta: number) => void
}

export default function GridDivider({ direction, onResize }: GridDividerProps) {
  const [dragging, setDragging] = useState(false)
  const startRef = useRef(0)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setDragging(true)
    startRef.current = direction === 'vertical' ? e.clientX : e.clientY
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [direction])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return
    const current = direction === 'vertical' ? e.clientX : e.clientY
    const delta = current - startRef.current
    startRef.current = current
    onResize(delta)
  }, [dragging, direction, onResize])

  const handlePointerUp = useCallback(() => {
    setDragging(false)
  }, [])

  return (
    <div
      className={`flex-none relative group ${
        direction === 'vertical'
          ? 'w-1.5 cursor-col-resize'
          : 'h-1.5 cursor-row-resize'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ touchAction: 'none' }}
    >
      {/* Visible divider line */}
      <div className={`absolute transition-colors duration-150 ${
        direction === 'vertical'
          ? 'inset-y-0 left-1/2 -translate-x-1/2 w-px'
          : 'inset-x-0 top-1/2 -translate-y-1/2 h-px'
      } ${dragging ? 'bg-teal-400' : 'bg-slate-700/60 group-hover:bg-teal-600/60'}`} />

      {/* Wider hit area */}
      <div className={`absolute ${
        direction === 'vertical'
          ? 'inset-y-0 -left-1 -right-1'
          : 'inset-x-0 -top-1 -bottom-1'
      }`} />

      {/* Center grip indicator */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity ${
        dragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
      }`}>
        {direction === 'vertical' ? (
          <div className="flex flex-col gap-0.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1 h-1 rounded-full bg-teal-400" />
            ))}
          </div>
        ) : (
          <div className="flex gap-0.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1 h-1 rounded-full bg-teal-400" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
