import { useEffect } from 'react'
import { RotateCw, Zap, X, CheckCircle } from 'lucide-react'
import { createPortal } from 'react-dom'

function FilteringModal({ 
  isOpen, 
  onClose, 
  onConfirm,
  creditsRequired = 0, 
  currentCredits = 0,
  listingCount = 0,
  isFiltering = false
}) {
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleConfirm = () => {
    if (onConfirm && !isFiltering) {
      onConfirm()
    }
  }

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={isFiltering ? undefined : onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
        {/* Close Button - Only show when not filtering */}
        {!isFiltering && (
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
            <div className={`w-12 h-12 ${isFiltering ? 'bg-amber-500/20' : 'bg-blue-500/20'} rounded-xl flex items-center justify-center`}>
              {isFiltering ? (
                <RotateCw className="w-6 h-6 text-amber-400 animate-spin" />
              ) : (
                <Zap className="w-6 h-6 text-blue-400" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {isFiltering ? 'Analyzing Listings' : 'Start Analysis'}
              </h2>
              <p className="text-sm text-zinc-400">
                {isFiltering ? 'Filtering in progress...' : 'Credit consumption required'}
              </p>
            </div>
          </div>
        </div>

        {/* Credit Information */}
        <div className="mb-6 p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-400">Credits Required:</span>
            <span className="text-lg font-bold text-amber-400">{creditsRequired.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Current Credits:</span>
            <span className="text-lg font-bold text-white">{currentCredits.toLocaleString()}</span>
          </div>
          {listingCount > 0 && (
            <div className="mt-2 pt-2 border-t border-zinc-700/50">
              <span className="text-xs text-zinc-500">
                Will analyze {listingCount.toLocaleString()} listings
              </span>
            </div>
          )}
        </div>

        {/* Status Message */}
        {!isFiltering ? (
          <div className="mb-6">
            <p className="text-sm text-zinc-300">
              Click "Start Analysis" to begin filtering your listings and identifying low-performing items.
            </p>
          </div>
        ) : (
          <div className="mb-6">
            <div className="flex items-center gap-3 text-zinc-300 mb-2">
              <RotateCw className="w-5 h-5 animate-spin text-amber-400" />
              <span className="text-base font-medium">Filtering in progress...</span>
            </div>
            <p className="text-sm text-zinc-400 ml-8">
              Please wait while we analyze your listings and identify low-performing items.
            </p>
            {/* Progress Indicator */}
            <div className="mt-4 w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!isFiltering && (
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={currentCredits < creditsRequired}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Start Analysis
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default FilteringModal

