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
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10초 타임아웃
      
      const response = await fetch(`${API_BASE_URL}/api/credits?user_id=default-user`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const data = await response.json()
        setCredits(data.available_credits || 0)
        setPlan(data.current_plan || 'FREE')
        setApiStatus('connected')
      } else {
        // 502, 503, 504 등의 서버 에러는 'error' 상태로 설정
        setApiStatus('error')
        // 기본값 유지 (credits는 null로 유지)
      }
    } catch (err) {
      // 네트워크 에러, 타임아웃, CORS 에러 등 모든 에러 처리
      if (err.name === 'AbortError') {
        console.warn('Credits fetch timeout')
      } else {
        console.error('Failed to fetch credits:', err)
      }
      setApiStatus('error')
      // 에러 발생 시에도 기본값 유지 (앱이 계속 작동하도록)
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
