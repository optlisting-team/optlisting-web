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
  refreshSubscription: () => {}
})

export const AccountProvider = ({ children }) => {
  const [subscriptionStatus, setSubscriptionStatus] = useState('inactive')
  const [plan, setPlan] = useState('FREE')
  const [apiStatus, setApiStatus] = useState('checking')
  const [connectionError, setConnectionError] = useState(null)
  const [showPlanModal, setShowPlanModal] = useState(false)

  // Fetch subscription status using apiClient (goes directly to Railway in production)
  const fetchSubscription = async () => {
    try {
      const response = await apiClient.get('/api/subscription/status', {
        timeout: 60000  // 60 seconds timeout
      })
      
      if (response.data) {
        setSubscriptionStatus(response.data.status || 'inactive')
        setPlan(response.data.plan || 'FREE')
        setApiStatus('connected')
        setConnectionError(null)  // Clear any previous errors on success
      } else {
        setApiStatus('error')
      }
    } catch (err) {
      // Handle 401 Unauthorized - attempt session refresh
      if (err.response?.status === 401) {
        console.warn('401 Unauthorized - attempting session refresh')
        try {
          const { data: { session }, error: refreshError } = await supabase.auth.refreshSession()
          
          if (refreshError || !session?.access_token) {
            console.error('Session refresh failed:', refreshError)
            setConnectionError('authentication_failed')
            setApiStatus('error')
            return
          }
          
          // Retry the request after successful refresh
          try {
            const retryResponse = await apiClient.get('/api/subscription/status', {
              timeout: 60000
            })
            if (retryResponse.data) {
              setSubscriptionStatus(retryResponse.data.status || 'inactive')
              setPlan(retryResponse.data.plan || 'FREE')
              setApiStatus('connected')
              setConnectionError(null)
              return
            }
          } catch (retryErr) {
            console.error('Retry after refresh failed:', retryErr)
            setConnectionError('authentication_failed')
            setApiStatus('error')
            return
          }
        } catch (refreshErr) {
          console.error('Failed to refresh session:', refreshErr)
          setConnectionError('authentication_failed')
          setApiStatus('error')
          return
        }
      }
      
      // Handle all other errors: network errors, timeouts, CORS errors, etc.
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        console.warn('Subscription status fetch timeout')
        setApiStatus('error')
      } else {
        console.error('Failed to fetch subscription status:', err)
        setApiStatus('error')
      }
      // Keep default values on error (so app continues to work)
    }
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
