import { createContext, useContext, useState, useEffect } from 'react'
import apiClient from '../lib/api'
import { supabase } from '../lib/supabase'

const AccountContext = createContext({
  subscriptionStatus: 'inactive',
  plan: 'FREE',
  apiStatus: 'checking',
  connectionError: null,
  showPlanModal: false,
  setShowPlanModal: () => {},
  refreshSubscription: () => {},
  credits: null,
  refreshCredits: () => {},
  showCreditModal: false,
  setShowCreditModal: () => {}
})

export const AccountProvider = ({ children }) => {
  const [subscriptionStatus, setSubscriptionStatus] = useState('inactive')
  const [plan, setPlan] = useState('FREE')
  const [apiStatus, setApiStatus] = useState('checking')
  const [connectionError, setConnectionError] = useState(null)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [credits, setCredits] = useState(null)

  // Fetch credits (for Dashboard/Sidebar - prevents "r is not a function" TypeError in minified builds)
  const fetchCredits = async () => {
    try {
      const response = await apiClient.get('/api/credits', { timeout: 15000 })
      if (response.data && typeof response.data.available_credits === 'number') {
        setCredits(response.data.available_credits)
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        console.warn('Failed to fetch credits:', err.message)
      }
      setCredits(0)
    }
  }

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
          await fetchCredits()
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
                await fetchCredits()
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

  // Ensure refreshCredits is always a callable function (avoids "r is not a function" when consumed)
  const safeRefreshCredits = typeof fetchCredits === 'function' ? fetchCredits : () => Promise.resolve()

  return (
    <AccountContext.Provider
      value={{
        subscriptionStatus,
        plan,
        apiStatus,
        connectionError,
        showPlanModal,
        setShowPlanModal,
        refreshSubscription: fetchSubscription,
        credits,
        refreshCredits: safeRefreshCredits,
        showCreditModal,
        setShowCreditModal
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
