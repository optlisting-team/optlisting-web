import React from 'react'
import { X } from 'lucide-react'

function PlatformSelectModal({ isOpen, onClose, onSelectPlatform, loading = false }) {
  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-700">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">플랫폼 선택</h3>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-zinc-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-zinc-400 mt-2">
            CSV 내보내기 형식을 선택하세요
          </p>
        </div>
        
        {/* Platform Buttons */}
        <div className="p-6 space-y-3">
          <button
            onClick={() => onSelectPlatform('shopify')}
            disabled={loading}
            className="w-full px-6 py-4 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors border border-zinc-700 hover:border-emerald-500/50 flex items-center justify-center gap-3"
          >
            <span className="text-2xl">🛍️</span>
            <span>Shopify</span>
          </button>
          
          <button
            onClick={() => onSelectPlatform('bigcommerce')}
            disabled={loading}
            className="w-full px-6 py-4 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors border border-zinc-700 hover:border-emerald-500/50 flex items-center justify-center gap-3"
          >
            <span className="text-2xl">🏪</span>
            <span>BigCommerce</span>
          </button>
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-zinc-700">
          <p className="text-xs text-zinc-500 text-center">
            각 플랫폼별로 최적화된 CSV 형식으로 내보냅니다
          </p>
        </div>
      </div>
    </div>
  )
}

export default PlatformSelectModal
