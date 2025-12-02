import React, { useState } from 'react'
import { Button } from './ui/button'

// Store License Table Component
function StoreLicenseTable({ 
  stores = [], 
  planStoreLimit = 3, 
  globalStoreLimit = 10,
  userPlan = 'PRO',
  onConnect,
  onDisconnect 
}) {
  // Generate available slots
  const usedSlots = stores.length
  const planSlots = Math.min(planStoreLimit, globalStoreLimit)
  const availableSlots = []
  
  for (let i = usedSlots; i < planSlots; i++) {
    availableSlots.push({ slot: i + 1, type: 'plan' })
  }
  
  // Credit expansion slots (if plan limit reached but under global limit)
  const creditSlots = []
  if (usedSlots >= planStoreLimit && usedSlots < globalStoreLimit) {
    for (let i = Math.max(usedSlots, planStoreLimit); i < globalStoreLimit; i++) {
      creditSlots.push({ slot: i + 1, type: 'credit' })
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Store Name</th>
            <th className="text-left px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
            <th className="text-left px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Connected Date</th>
            <th className="text-left px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">License</th>
            <th className="text-right px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Action</th>
          </tr>
        </thead>
        <tbody>
          {/* Connected Stores */}
          {stores.map((store, index) => (
            <tr key={store.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🏪</span>
                  <div>
                    <div className="font-semibold text-white">{store.name || `Store ${index + 1}`}</div>
                    <div className="text-xs text-zinc-500">{store.email || 'user@ebay.com'}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-semibold text-emerald-400">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Connected
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-zinc-400">
                {store.connectedDate || new Date().toLocaleDateString()}
              </td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                  index < planStoreLimit 
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {index < planStoreLimit ? userPlan : 'CREDIT'}
                  <span className="opacity-70">({index + 1}/{index < planStoreLimit ? planStoreLimit : globalStoreLimit})</span>
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDisconnect && onDisconnect(store.id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  Disconnect
                </Button>
              </td>
            </tr>
          ))}
          
          {/* Available Plan Slots */}
          {availableSlots.map((slot) => (
            <tr key={`slot-${slot.slot}`} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl opacity-30">🏪</span>
                  <div>
                    <div className="font-semibold text-zinc-500">(Slot {slot.slot})</div>
                    <div className="text-xs text-zinc-600">Available</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded-full text-xs font-semibold text-zinc-500">
                  Available
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-zinc-600">
                N/A
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-xs font-bold">
                  {userPlan}
                  <span className="opacity-70">({slot.slot}/{planStoreLimit})</span>
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onConnect && onConnect()}
                  className="text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                >
                  + Connect Store
                </Button>
              </td>
            </tr>
          ))}
          
          {/* Credit Expansion Slots (shown when plan limit reached) */}
          {stores.length >= planStoreLimit && stores.length < globalStoreLimit && (
            <tr className="border-b border-zinc-800/50 bg-amber-500/5">
              <td colSpan="5" className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">💰</span>
                    <div>
                      <div className="font-semibold text-amber-400">Credit Store Expansion</div>
                      <div className="text-xs text-zinc-500">
                        {globalStoreLimit - stores.length} additional slot(s) available with credits
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onConnect && onConnect()}
                    className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                  >
                    + Add with Credits
                  </Button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// Main Settings Component
function Settings() {
  // Mock data - replace with actual data from context/API
  const [userPlan] = useState('PRO')
  const [planStoreLimit] = useState(3)
  const [globalStoreLimit] = useState(10)
  const [userCredits] = useState(8500)
  const [usedCredits] = useState(0)
  
  const [connectedStores, setConnectedStores] = useState([
    { id: '1', name: 'US Store', email: 'user@ebay.com', connectedDate: '2025-12-01' },
    { id: '2', name: 'UK Store', email: 'user@ebay.co.uk', connectedDate: '2025-12-02' },
  ])

  const handleConnect = () => {
    // TODO: Open OAuth flow
    alert('Connect Store flow will open here')
  }

  const handleDisconnect = (storeId) => {
    if (confirm('Are you sure you want to disconnect this store?')) {
      setConnectedStores(connectedStores.filter(s => s.id !== storeId))
    }
  }

  // Plan info
  const planInfo = {
    BASIC: { stores: 1, price: 19, color: 'cyan' },
    PRO: { stores: 3, price: 49, color: 'blue' },
    'POWER SELLER': { stores: 10, price: 99, color: 'purple' }
  }

  return (
    <div className="font-sans bg-black min-h-full p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-zinc-400 text-sm mt-1">Manage your stores and subscription</p>
          </div>
        </div>

        {/* Current Plan Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600/30 to-blue-600/10 border border-blue-500/30 rounded-2xl flex items-center justify-center">
                <span className="text-2xl">👑</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{userPlan} Plan</h2>
                  <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs font-bold text-emerald-400">
                    Active
                  </span>
                </div>
                <p className="text-zinc-400 text-sm mt-1">
                  ${planInfo[userPlan]?.price}/month • {planStoreLimit} Store License{planStoreLimit > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Button className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400">
              Upgrade Plan
            </Button>
          </div>
        </div>

        {/* Credits Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-600/30 to-emerald-600/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center">
                <span className="text-2xl">💰</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{(userCredits - usedCredits).toLocaleString()} Credits</h2>
                <p className="text-zinc-400 text-sm mt-1">
                  {usedCredits > 0 ? `${usedCredits.toLocaleString()} used this month` : 'All credits rollover to next month'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">✨ 100% Rollover</span>
              <Button variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                Buy Credits
              </Button>
            </div>
          </div>
        </div>

        {/* Store Licenses Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Store Licenses</h2>
              <p className="text-zinc-400 text-sm mt-1">
                {connectedStores.length}/{planStoreLimit} plan licenses used • 
                Global limit: {globalStoreLimit} stores
              </p>
            </div>
          </div>
          
          <StoreLicenseTable
            stores={connectedStores}
            planStoreLimit={planStoreLimit}
            globalStoreLimit={globalStoreLimit}
            userPlan={userPlan}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
          
          {/* Expansion Info */}
          <div className="mt-4 p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl">
            <p className="text-sm text-zinc-400">
              <strong className="text-white">{userPlan}</strong> 플랜은 <strong className="text-blue-400">{planStoreLimit}개</strong>의 스토어 라이선스를 제공합니다. 
              추가 스토어 연결은 <strong className="text-amber-400">Global Credit Limit</strong> (현재 {globalStoreLimit}개) 내에서 언제든지 가능합니다. 
              추가 스토어 라이선스가 필요할 경우, <strong className="text-purple-400">POWER SELLER</strong> 플랜으로 업그레이드하십시오.
            </p>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="border border-red-500/20 rounded-xl p-6">
          <h2 className="text-lg font-bold text-red-400 mb-2">Danger Zone</h2>
          <p className="text-zinc-400 text-sm mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10">
            Delete Account
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Settings

