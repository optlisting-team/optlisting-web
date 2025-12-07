import { createContext, useContext, useState, useEffect } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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

  const fetchCredits = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/credits?user_id=default-user`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setCredits(data.available_credits)
        setPlan(data.current_plan || 'FREE')
        setApiStatus('connected')
      } else {
        setApiStatus('error')
      }
    } catch (err) {
      console.error('Failed to fetch credits:', err)
      setApiStatus('error')
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
