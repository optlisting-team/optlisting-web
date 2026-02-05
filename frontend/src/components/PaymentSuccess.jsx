import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { useAccount } from '../contexts/AccountContext'

// Use environment variable for Railway URL, fallback based on environment
// CRITICAL: Production MUST use relative path /api (proxied by vercel.json) to avoid CORS issues
// Only use VITE_API_URL in development if needed, production always uses relative path
const API_BASE_URL = import.meta.env.DEV 
  ? (import.meta.env.VITE_API_URL || '')  // Development: use env var or empty for Vite proxy
  : ''  // Production: ALWAYS use relative path (vercel.json proxy handles routing to Railway)

const POLLING_INTERVAL = 1500 // 1.5s
const MAX_POLLING_TIME = 30000 // 30s

function PaymentSuccess() {
  const navigate = useNavigate()
  const { subscriptionStatus, plan, refreshSubscription } = useAccount()
  const [status, setStatus] = useState('polling') // 'polling', 'success', 'timeout'
  const [initialSubscriptionStatus, setInitialSubscriptionStatus] = useState(null)
  const [pollingStartTime, setPollingStartTime] = useState(null)
  const pollingIntervalRef = useRef(null)
  const timeoutRef = useRef(null)

  // Refresh subscription status immediately when returning from payment
  useEffect(() => {
    console.log('🔄 [PAYMENT SUCCESS] Refreshing subscription status after payment...')
    refreshSubscription()
    
    // Also refresh after a short delay to ensure webhook has processed
    const delayedRefresh = setTimeout(() => {
      console.log('🔄 [PAYMENT SUCCESS] Delayed refresh to catch webhook updates...')
      refreshSubscription()
    }, 3000) // 3 second delay to allow webhook processing
    
    return () => clearTimeout(delayedRefresh)
  }, [refreshSubscription])

  // Initial subscription status check
  useEffect(() => {
    setInitialSubscriptionStatus(subscriptionStatus)
    setPollingStartTime(Date.now())
  }, [])

  // Polling for subscription activation
  useEffect(() => {
    if (initialSubscriptionStatus === null || pollingStartTime === null) {
      return
    }

    const checkSubscription = () => {
      // Refresh subscription status
      refreshSubscription()
      
      // Check if subscription became active
      if (subscriptionStatus === 'active' && plan === 'PROFESSIONAL') {
        console.log('✅ [PAYMENT SUCCESS] Subscription activated!')
        setStatus('success')
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
      }
    }

    // Check immediately
    checkSubscription()

    // Polling: Refresh subscription status every 1.5 seconds
    pollingIntervalRef.current = setInterval(() => {
      refreshSubscription()
      checkSubscription()
    }, POLLING_INTERVAL)

    // 30 second timeout
    timeoutRef.current = setTimeout(() => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
      setStatus('timeout')
    }, MAX_POLLING_TIME)

    // Cleanup
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [initialSubscriptionStatus, pollingStartTime, subscriptionStatus, plan, refreshSubscription])

  const handleRefresh = () => {
    window.location.reload()
  }

  const handleGoToDashboard = () => {
    navigate('/dashboard')
  }

  const elapsedTime = pollingStartTime 
    ? Math.min(Math.floor((Date.now() - pollingStartTime) / 1000), MAX_POLLING_TIME / 1000)
    : 0

  return (
    <div className="min-h-screen bg-zinc-950 dark:bg-zinc-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-zinc-900 dark:bg-zinc-900 border-zinc-800 dark:border-zinc-800">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-white dark:text-white">
            Payment Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === 'polling' && (
            <>
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                <p className="text-zinc-400 dark:text-zinc-400 text-center">
                  Payment completed. Activating your Professional Plan...
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-500">
                  {elapsedTime}s / {MAX_POLLING_TIME / 1000}s
                </p>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex flex-col items-center justify-center space-y-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
                <p className="text-white dark:text-white text-lg font-semibold text-center">
                  Payment completed successfully!
                </p>
                <p className="text-zinc-400 dark:text-zinc-400 text-center">
                  Your Professional Plan is now active.
                </p>
                <div className="mt-4 p-4 bg-zinc-800 dark:bg-zinc-800 rounded-lg">
                  <p className="text-sm text-zinc-400 dark:text-zinc-400">
                    Subscription Status
                  </p>
                  <p className="text-2xl font-bold text-white dark:text-white">
                    {plan === 'PROFESSIONAL' ? 'Professional Plan' : plan}
                  </p>
                  <p className="text-sm text-emerald-400 mt-1">
                    {subscriptionStatus === 'active' ? '✓ Active' : subscriptionStatus}
                  </p>
                </div>
                <Button
                  onClick={handleGoToDashboard}
                  className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Go to Dashboard
                </Button>
              </div>
            </>
          )}

          {status === 'timeout' && (
            <>
              <div className="flex flex-col items-center justify-center space-y-4">
                <AlertCircle className="h-12 w-12 text-yellow-500" />
                <p className="text-white dark:text-white text-lg font-semibold text-center">
                  Payment completed but activation is delayed
                </p>
                <p className="text-zinc-400 dark:text-zinc-400 text-center text-sm">
                  Your payment was processed successfully. Subscription activation may take a few moments.
                  Please refresh in a moment to check your status.
                </p>
                <div className="flex flex-col space-y-2 w-full mt-4">
                  <Button
                    onClick={handleRefresh}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button
                    onClick={handleGoToDashboard}
                    variant="outline"
                    className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  >
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default PaymentSuccess



