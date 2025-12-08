import { useState, useEffect } from 'react'
import { useAccount } from '../contexts/AccountContext'
import { useAuth } from '../contexts/AuthContext'
import { Check, Zap, TrendingUp, Crown } from 'lucide-react'

// Lemon Squeezy Store URL (실제 스토어 URL로 변경 필요)
// 환경 변수 또는 Lemon Squeezy Dashboard에서 확인한 실제 스토어 URL로 변경
const LEMON_SQUEEZY_STORE = import.meta.env.VITE_LEMON_SQUEEZY_STORE || 'https://optlisting.lemonsqueezy.com'

// 크레딧 팩 정의 (LEMONSQUEEZY_SETUP.md와 동일)
const CREDIT_PACKS = [
  { id: 'starter', name: 'Starter', price: 5, credits: 300, popular: false },
  { id: 'popular', name: 'Popular', price: 10, credits: 800, popular: true },
  { id: 'value', name: 'Value', price: 15, credits: 1200, popular: false },
  { id: 'best', name: 'Best Value', price: 20, credits: 2000, popular: false },
  { id: 'pro', name: 'Pro', price: 25, credits: 2600, popular: false },
  { id: 'business', name: 'Business', price: 50, credits: 6000, popular: false },
]

// 구독 플랜 정의
const SUBSCRIPTION_PLANS = [
  {
    id: 'pro-monthly',
    name: 'Pro Monthly',
    price: 49,
    interval: 'month',
    features: [
      '무제한 리스팅 분석',
      '무제한 크레딧',
      '우선 지원',
      '고급 필터링',
    ],
    icon: Zap,
    popular: true,
  },
  {
    id: 'business-monthly',
    name: 'Business Monthly',
    price: 99,
    interval: 'month',
    features: [
      'Pro 플랜의 모든 기능',
      '팀 멤버 관리',
      'API 액세스',
      '전용 지원',
    ],
    icon: Crown,
    popular: false,
  },
]

export default function Pricing() {
  const { credits } = useAccount()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  // Lemon Squeezy Checkout 링크 생성
  const generateCheckoutUrl = (productId, variantId = null, isSubscription = false) => {
    // Supabase user ID 또는 기본값 사용
    const userId = user?.id || user?.user_metadata?.user_id || 'default-user'
    const baseUrl = `${LEMON_SQUEEZY_STORE}/checkout/buy/${productId}`
    const params = new URLSearchParams({
      'checkout[custom][user_id]': userId,
    })
    
    if (variantId) {
      params.append('checkout[variant_id]', variantId)
    }
    
    return `${baseUrl}?${params.toString()}`
  }

  const handlePurchase = (productId, variantId = null, isSubscription = false) => {
    setLoading(true)
    const checkoutUrl = generateCheckoutUrl(productId, variantId, isSubscription)
    window.open(checkoutUrl, '_blank')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-16 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Pricing</h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            크레딧 팩을 구매하거나 구독 플랜을 선택하여 OptListing을 최대한 활용하세요
          </p>
          {credits !== null && (
            <div className="mt-6 inline-block px-6 py-3 bg-zinc-800 rounded-lg">
              <span className="text-zinc-400">현재 크레딧: </span>
              <span className="text-2xl font-bold text-white">{credits.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* 크레딧 팩 섹션 */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold mb-8 text-center">크레딧 팩</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className={`relative bg-zinc-900 border rounded-xl p-6 ${
                  pack.popular
                    ? 'border-purple-500 shadow-lg shadow-purple-500/20'
                    : 'border-zinc-800'
                }`}
              >
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                      인기
                    </span>
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold mb-2">{pack.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">${pack.price}</span>
                  </div>
                  <div className="text-zinc-400 text-sm mb-2">
                    {pack.credits.toLocaleString()} 크레딧
                  </div>
                  <div className="text-zinc-500 text-xs">
                    ${(pack.price / pack.credits).toFixed(4)} per credit
                  </div>
                </div>
                <button
                  onClick={() => handlePurchase(`credit-pack-${pack.id}`)}
                  disabled={loading}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                    pack.popular
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                  }`}
                >
                  {loading ? '처리 중...' : '구매하기'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 구독 플랜 섹션 */}
        <div>
          <h2 className="text-3xl font-bold mb-8 text-center">구독 플랜</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {SUBSCRIPTION_PLANS.map((plan) => {
              const Icon = plan.icon
              return (
                <div
                  key={plan.id}
                  className={`relative bg-zinc-900 border rounded-xl p-8 ${
                    plan.popular
                      ? 'border-purple-500 shadow-lg shadow-purple-500/20 scale-105'
                      : 'border-zinc-800'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                        인기
                      </span>
                    </div>
                  )}
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-800 rounded-full mb-4">
                      <Icon className="w-8 h-8 text-purple-500" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                    <div className="mb-4">
                      <span className="text-5xl font-bold">${plan.price}</span>
                      <span className="text-zinc-400 text-lg">/{plan.interval}</span>
                    </div>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-zinc-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handlePurchase(`subscription-${plan.id}`, null, true)}
                    disabled={loading}
                    className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                      plan.popular
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                    }`}
                  >
                    {loading ? '처리 중...' : '구독하기'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* 안내 사항 */}
        <div className="mt-16 text-center text-zinc-400 text-sm">
          <p>결제는 Lemon Squeezy를 통해 안전하게 처리됩니다.</p>
          <p className="mt-2">
            구매 후 크레딧은 자동으로 추가되며, 구독은 즉시 활성화됩니다.
          </p>
        </div>
      </div>
    </div>
  )
}

