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
    <div className="fixed top-4 right-4 z-[9999] animate-in slide-in-from-top-5">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${bgColor} min-w-[300px] max-w-[500px]`}>
        <Icon className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm flex-1">{message}</p>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 text-current opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}

export default Toast

