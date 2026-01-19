import { createContext, useContext, useState, useEffect } from 'react'

// Use environment variable for Railway URL, fallback based on environment
// CRITICAL: Production MUST use relative path /api (proxied by vercel.json) to avoid CORS issues
// Only use VITE_API_URL in development if needed, production always uses relative path
const API_BASE_URL = import.meta.env.DEV 
  ? (import.meta.env.VITE_API_URL || '')  // Development: use env var or empty for Vite proxy
  : ''  // Production: ALWAYS use relative path (vercel.json proxy handles routing to Railway)

const AccountContext = createContext({
  credits: null,
  plan: 'FREE',
  apiStatus: 'checking',
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
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showCreditModal, setShowCreditModal] = useState(false)

  // Retry utility function
  const retryFetch = async (url, options, maxRetries = 3, delay = 2000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // Increased from 10s to 30s
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
        return response
      } catch (err) {
        const isLastAttempt = i === maxRetries - 1
        if (isLastAttempt) {
          throw err
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)))
      }
    }
  }

  const fetchCredits = async () => {
    try {
      const response = await retryFetch(
        `${API_BASE_URL}/api/credits`,  // user_id는 JWT에서 추출됨
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        setCredits(data.available_credits || 0)
        setPlan(data.current_plan || 'FREE')
        setApiStatus('connected')
      } else {
        // Set 'error' status for server errors (502, 503, 504, etc.)
        setApiStatus('error')
        // Keep default values (credits remains null)
      }
    } catch (err) {
      // Handle all errors: network errors, timeouts, CORS errors, etc.
      if (err.name === 'AbortError') {
        console.warn('Credits fetch timeout')
      } else {
        console.error('Failed to fetch credits:', err)
      }
      setApiStatus('error')
      // Keep default values on error (so app continues to work)
    }
  }

  useEffect(() => {
    fetchCredits()
    // Refresh every 30 seconds
    const interval = setInterval(fetchCredits, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <AccountContext.Provider
      value={{
        credits,
        plan,
        apiStatus,
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
