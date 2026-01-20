import { createContext, useContext, useState, useEffect } from 'react'
import apiClient from '../lib/api'
import { supabase } from '../lib/supabase'

const AccountContext = createContext({
  credits: null,
  plan: 'FREE',
  apiStatus: 'checking',
  connectionError: null,
  showPlanModal: false,
  showCreditModal: false,
  setShowPlanModal: () => {},
  setShowCreditModal: () => {},
  refreshCredits: () => {}
})

export const AccountProvider = ({ children }) => {
  const [credits, setCredits] = useState(null)
  const [plan, setPlan] = useState('FREE')
  const [apiStatus, setApiStatus] = useState('checking')
  const [connectionError, setConnectionError] = useState(null)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showCreditModal, setShowCreditModal] = useState(false)

  // Fetch credits using apiClient (goes directly to Railway in production)
  const fetchCredits = async () => {
    try {
      const response = await apiClient.get('/api/credits', {
        timeout: 60000  // 60 seconds timeout
      })
      
      if (response.data) {
        setCredits(response.data.available_credits || 0)
        setPlan(response.data.current_plan || 'FREE')
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
            // Prompt user to re-login
            return
          }
          
          // Retry the request after successful refresh
          try {
            const retryResponse = await apiClient.get('/api/credits', {
              timeout: 60000
            })
            if (retryResponse.data) {
              setCredits(retryResponse.data.available_credits || 0)
              setPlan(retryResponse.data.current_plan || 'FREE')
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
        console.warn('Credits fetch timeout')
        setApiStatus('error')
      } else {
        console.error('Failed to fetch credits:', err)
        setApiStatus('error')
      }
      // Keep default values on error (so app continues to work)
    }
  }

  // Fetch credits on mount only (no automatic polling)
  useEffect(() => {
    fetchCredits()
  }, [])

  return (
    <AccountContext.Provider
      value={{
        credits,
        plan,
        apiStatus,
        connectionError,
        showPlanModal,
        showCreditModal,
        setShowPlanModal,
        setShowCreditModal,
        refreshCredits: fetchCredits
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
