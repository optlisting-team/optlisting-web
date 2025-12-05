import { useState, useMemo } from 'react'
import HistoryTable from './HistoryTable'

const DATE_FILTERS = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: '7days' },
  { label: 'Last 30 Days', value: '30days' },
]

const SUPPLIER_FILTERS = [
  { label: 'All Suppliers', value: 'all' },
  { label: 'Amazon', value: 'Amazon' },
  { label: 'Walmart', value: 'Walmart' },
  { label: 'AliExpress', value: 'AliExpress' },
  { label: 'Home Depot', value: 'Home Depot' },
  { label: 'Costway', value: 'Costway' },
  { label: 'Banggood', value: 'Banggood' },
]

function HistoryView({ historyLogs, loading, onBack }) {
  const [dateFilter, setDateFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Filter logic
  const filteredLogs = useMemo(() => {
    let result = [...historyLogs]

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      let cutoffDate = new Date()
      
      if (dateFilter === 'today') {
        cutoffDate.setHours(0, 0, 0, 0)
      } else if (dateFilter === '7days') {
        cutoffDate.setDate(now.getDate() - 7)
      } else if (dateFilter === '30days') {
        cutoffDate.setDate(now.getDate() - 30)
      }

      result = result.filter(log => new Date(log.deleted_at) >= cutoffDate)
    }

    // Supplier filter
    if (supplierFilter !== 'all') {
      result = result.filter(log => log.supplier === supplierFilter)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(log => 
        (log.title || '').toLowerCase().includes(query) ||
        (log.sku || '').toLowerCase().includes(query)
      )
    }

    return result
  }, [historyLogs, dateFilter, supplierFilter, searchQuery])

  // Stats based on filtered data
  const stats = useMemo(() => ({
    total: filteredLogs.length,
    amazon: filteredLogs.filter(l => l.supplier === 'Amazon').length,
    walmart: filteredLogs.filter(l => l.supplier === 'Walmart').length,
    others: filteredLogs.filter(l => !['Amazon', 'Walmart'].includes(l.supplier)).length,
  }), [filteredLogs])

  return (
    <div className="mt-6">
      {/* History Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center">
            <span className="text-xl">💀</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Deletion History</h2>
            <p className="text-sm text-zinc-500">All items exported for deletion</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">
            Showing: <span className="text-white font-bold">{filteredLogs.length}</span> of {historyLogs.length} items
          </span>
          <button
            onClick={onBack}
            className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-all"
          >
            ← Back to Listings
          </button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <input
            type="text"
            placeholder="Search by title or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Period:</span>
          <div className="flex gap-1">
            {DATE_FILTERS.map(filter => (
              <button
                key={filter.value}
                onClick={() => setDateFilter(filter.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  dateFilter === filter.value
                    ? 'bg-white text-black'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Supplier Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Supplier:</span>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-500"
          >
            {SUPPLIER_FILTERS.map(filter => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters */}
        {(dateFilter !== 'all' || supplierFilter !== 'all' || searchQuery) && (
          <button
            onClick={() => {
              setDateFilter('all')
              setSupplierFilter('all')
              setSearchQuery('')
            }}
            className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 transition-all"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* History Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div 
          onClick={() => setSupplierFilter('all')}
          className={`opt-card p-4 text-center cursor-pointer transition-all ${supplierFilter === 'all' ? 'ring-1 ring-white/30' : 'hover:bg-zinc-800/50'}`}
        >
          <div className="text-2xl font-black text-white">{stats.total}</div>
          <div className="text-[10px] text-zinc-500 uppercase">Total</div>
        </div>
        <div 
          onClick={() => setSupplierFilter('Amazon')}
          className={`opt-card p-4 text-center cursor-pointer transition-all ${supplierFilter === 'Amazon' ? 'ring-1 ring-amber-500/50' : 'hover:bg-zinc-800/50'}`}
        >
          <div className="text-2xl font-black text-amber-400">{stats.amazon}</div>
          <div className="text-[10px] text-zinc-500 uppercase">Amazon</div>
        </div>
        <div 
          onClick={() => setSupplierFilter('Walmart')}
          className={`opt-card p-4 text-center cursor-pointer transition-all ${supplierFilter === 'Walmart' ? 'ring-1 ring-blue-500/50' : 'hover:bg-zinc-800/50'}`}
        >
          <div className="text-2xl font-black text-blue-400">{stats.walmart}</div>
          <div className="text-[10px] text-zinc-500 uppercase">Walmart</div>
        </div>
        <div 
          onClick={() => {
            // For "others", we need to handle differently
            if (supplierFilter !== 'all' && !['Amazon', 'Walmart'].includes(supplierFilter)) {
              setSupplierFilter('all')
            }
          }}
          className="opt-card p-4 text-center cursor-pointer hover:bg-zinc-800/50 transition-all"
        >
          <div className="text-2xl font-black text-zinc-400">{stats.others}</div>
          <div className="text-[10px] text-zinc-500 uppercase">Others</div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6">
          <HistoryTable logs={filteredLogs} loading={loading} />
        </div>
      </div>
    </div>
  )
}

export default HistoryView

