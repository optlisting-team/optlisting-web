import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle, X, AlertTriangle } from 'lucide-react'

function Toast({ message, type = 'error', duration = 5000, onClose }) {
  useEffect(() => {
    if (duration > 0 && onClose) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  if (!message) return null

  const bgColor = type === 'error' 
    ? 'bg-red-900/90 border-red-700 text-red-100'
    : type === 'success'
    ? 'bg-green-900/90 border-green-700 text-green-100'
    : 'bg-amber-900/90 border-amber-700 text-amber-100'

  const Icon = type === 'error' 
    ? AlertCircle 
    : type === 'success'
    ? CheckCircle
    : AlertTriangle

  return createPortal(
    <div className="fixed bottom-4 left-1/2 z-[9999] -translate-x-1/2 animate-in slide-in-from-bottom-5">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border shadow-lg ${bgColor} max-w-[420px]`}>
        <Icon className="w-4 h-4 flex-shrink-0" />
        <p className="text-xs flex-1">{message}</p>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 text-current opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}

export default Toast

