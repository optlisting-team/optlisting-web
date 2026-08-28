import { createContext, useContext, useState, useEffect } from 'react'
import { apiClient } from '../lib/api'
import { supabase } from '../lib/supabase'

const AccountContext = createContext({
  subscriptionStatus: 'inactive',
  plan: 'FREE',
  apiStatus: 'checking',
  connectionError: null,
  showPlanModal: false,
  setShowPlanModal: () => {},
  refreshSubscription: () => {}
})

export const AccountProvider = ({ children }) => {
  const [subscriptionStatus, setSubscriptionStatus] = useState('inactive')
  const [plan, setPlan] = useState('FREE')
  const [apiStatus, setApiStatus] = useState('checking')
  const [connectionError, setConnectionError] = useState(null)
  const [showPlanModal, setShowPlanModal] = useState(false)

  // Subscription request with extended timeout (single attempt)
  const SUBSCRIPTION_TIMEOUT_MS = 90000 // 90 seconds - ensure backend/DB is ready before giving up
  const SUBSCRIPTION_MAX_RETRIES = 3
  const SUBSCRIPTION_BACKOFF_MS = [2000, 5000, 10000] // 2s, 5s, 10s between retries

  const fetchSubscription = async () => {
    let lastErr = null
    for (let attempt = 0; attempt <= SUBSCRIPTION_MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const backoff = SUBSCRIPTION_BACKOFF_MS[attempt - 1] ?? 5000
          await new Promise(r => setTimeout(r, backoff))
        }
        const response = await apiClient.get('/api/subscription/status', {
          timeout: SUBSCRIPTION_TIMEOUT_MS
        })
        if (response.data) {
          setSubscriptionStatus(response.data.status || 'inactive')
          setPlan(response.data.plan || 'FREE')
          setApiStatus('connected')
          setConnectionError(null)
          return
        }
        setApiStatus('error')
        return
      } catch (err) {
        lastErr = err
        // 401: try session refresh once, then retry loop
        if (err.response?.status === 401 && attempt === 0) {
          try {
            const { data: { session }, error: refreshError } = await supabase.auth.refreshSession()
            if (!refreshError && session?.access_token) {
              // Retry this attempt with fresh token (no backoff yet)
              const retryResponse = await apiClient.get('/api/subscription/status', {
                timeout: SUBSCRIPTION_TIMEOUT_MS
              })
              if (retryResponse.data) {
                setSubscriptionStatus(retryResponse.data.status || 'inactive')
                setPlan(retryResponse.data.plan || 'FREE')
                setApiStatus('connected')
                setConnectionError(null)
                return
              }
            }
          } catch (refreshErr) {
            lastErr = refreshErr
          }
        }
        if (attempt < SUBSCRIPTION_MAX_RETRIES) {
          const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout')
          if (isTimeout) {
            console.warn(`Subscription status fetch timeout (attempt ${attempt + 1}/${SUBSCRIPTION_MAX_RETRIES + 1}), retrying after backoff...`)
          }
        }
      }
    }
    if (lastErr?.code === 'ECONNABORTED' || lastErr?.message?.includes('timeout')) {
      console.warn('Subscription status fetch timeout after retries')
    } else {
      console.error('Failed to fetch subscription status:', lastErr)
    }
    setApiStatus('error')
  }

  // Fetch subscription status on mount only (no automatic polling)
  useEffect(() => {
    fetchSubscription()
  }, [])

  return (
    <AccountContext.Provider
      value={{
        subscriptionStatus,
        plan,
        apiStatus,
        connectionError,
        showPlanModal,
        setShowPlanModal,
        refreshSubscription: fetchSubscription
      }}
    >
      {children}
    </AccountContext.Provider>
  )
}

export const useAccount = () => {
  const context = useContext(AccountContext)
  if (!context) {
    throw new Error('useAccount must be used within an AccountProvider')
  }
  return context
}
