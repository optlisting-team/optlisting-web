import React from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, X, CreditCard } from 'lucide-react'

function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm,
  creditsRequired = 1,
  currentCredits = 0,
  isProcessing = false
}) {
  if (!isOpen) return null

  const handleConfirm = () => {
    if (onConfirm && !isProcessing) {
      onConfirm()
    }
  }

  const hasEnoughCredits = currentCredits >= creditsRequired

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={isProcessing ? undefined : onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl max-w-md w-full p-6">
        {/* Close Button */}
        {!isProcessing && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Confirm Analysis
              </h2>
              <p className="text-sm text-zinc-400">
                {isProcessing ? 'Processing...' : 'Credit consumption required'}
              </p>
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="mb-6">
          <p className="text-base text-zinc-300 mb-4">
            This analysis consumes <strong className="text-amber-400">{creditsRequired} credit{creditsRequired !== 1 ? 's' : ''}</strong>. Continue?
          </p>
          
          {/* Credit Info */}
          <div className="p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">Required:</span>
              <span className="text-lg font-bold text-amber-400">{creditsRequired}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Your Credits:</span>
              <span className={`text-lg font-bold ${hasEnoughCredits ? 'text-white' : 'text-red-400'}`}>
                {currentCredits.toLocaleString()}
              </span>
            </div>
            {!hasEnoughCredits && (
              <div className="mt-3 pt-3 border-t border-zinc-700/50 flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span>Insufficient credits. Please purchase more credits.</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing || !hasEnoughCredits}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30"
          >
            {isProcessing ? 'Processing...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ConfirmModal

