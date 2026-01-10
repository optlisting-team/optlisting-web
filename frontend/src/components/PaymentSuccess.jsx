import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? '' : 'https://optlisting-production.up.railway.app')

const POLLING_INTERVAL = 1500 // 1.5초
const MAX_POLLING_TIME = 30000 // 30초

function PaymentSuccess() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('polling') // 'polling', 'success', 'timeout'
  const [initialCredits, setInitialCredits] = useState(null)
  const [currentCredits, setCurrentCredits] = useState(null)
  const [pollingStartTime, setPollingStartTime] = useState(null)
  const pollingIntervalRef = useRef(null)
  const timeoutRef = useRef(null)

  // 초기 크레딧 잔액 조회
  useEffect(() => {
    const fetchInitialCredits = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/credits?user_id=default-user`,
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
          setInitialCredits(data.available_credits || 0)
          setCurrentCredits(data.available_credits || 0)
          setPollingStartTime(Date.now())
        }
      } catch (error) {
        console.error('Failed to fetch initial credits:', error)
      }
    }

    fetchInitialCredits()
  }, [])

  // Polling 시작
  useEffect(() => {
    if (initialCredits === null || pollingStartTime === null) {
      return
    }

    const checkCredits = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/credits?user_id=default-user`,
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
          const newCredits = data.available_credits || 0
          setCurrentCredits(newCredits)

          // 크레딧이 증가했으면 성공으로 처리
          if (newCredits > initialCredits) {
            setStatus('success')
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current)
            }
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current)
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch credits during polling:', error)
      }
    }

    // 즉시 한 번 체크
    checkCredits()

    // Polling 시작
    pollingIntervalRef.current = setInterval(checkCredits, POLLING_INTERVAL)

    // 30초 타임아웃 설정
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
  }, [initialCredits, pollingStartTime])

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
            결제 처리 중
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === 'polling' && (
            <>
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                <p className="text-zinc-400 dark:text-zinc-400 text-center">
                  결제가 완료되었습니다. 크레딧 반영을 확인하고 있습니다...
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-500">
                  {elapsedTime}초 / {MAX_POLLING_TIME / 1000}초
                </p>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex flex-col items-center justify-center space-y-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
                <p className="text-white dark:text-white text-lg font-semibold text-center">
                  결제가 성공적으로 완료되었습니다!
                </p>
                <p className="text-zinc-400 dark:text-zinc-400 text-center">
                  크레딧이 계정에 반영되었습니다.
                </p>
                {currentCredits !== null && (
                  <div className="mt-4 p-4 bg-zinc-800 dark:bg-zinc-800 rounded-lg">
                    <p className="text-sm text-zinc-400 dark:text-zinc-400">
                      현재 크레딧 잔액
                    </p>
                    <p className="text-2xl font-bold text-white dark:text-white">
                      {currentCredits.toLocaleString()} 크레딧
                    </p>
                  </div>
                )}
                <Button
                  onClick={handleGoToDashboard}
                  className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  대시보드로 이동
                </Button>
              </div>
            </>
          )}

          {status === 'timeout' && (
            <>
              <div className="flex flex-col items-center justify-center space-y-4">
                <AlertCircle className="h-12 w-12 text-yellow-500" />
                <p className="text-white dark:text-white text-lg font-semibold text-center">
                  결제는 완료되었으나 반영이 지연되고 있습니다
                </p>
                <p className="text-zinc-400 dark:text-zinc-400 text-center text-sm">
                  결제는 정상적으로 처리되었습니다. 크레딧 반영에 시간이 걸릴 수 있습니다.
                  잠시 후 새로고침하여 확인해주세요.
                </p>
                <div className="flex flex-col space-y-2 w-full mt-4">
                  <Button
                    onClick={handleRefresh}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    새로고침
                  </Button>
                  <Button
                    onClick={handleGoToDashboard}
                    variant="outline"
                    className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  >
                    대시보드로 이동
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



