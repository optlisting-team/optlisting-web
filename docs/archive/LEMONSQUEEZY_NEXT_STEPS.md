# Lemon Squeezy 통합 다음 단계

## ✅ 완료된 작업

1. ✅ Lemon Squeezy 계정 승인
2. ✅ 프론트엔드 Pricing 페이지 생성 (`/pricing`)
3. ✅ Lemon Squeezy Checkout 링크 생성 로직 구현
4. ✅ 백엔드 웹훅 엔드포인트 준비 (`/webhooks/lemonsqueezy`)

---

## 📋 다음 단계

### 1. Lemon Squeezy Dashboard 설정

#### 1.1 스토어 생성 (이미 완료된 경우 건너뛰기)
1. [Lemon Squeezy Dashboard](https://app.lemonsqueezy.com/) 접속
2. **Store** → **Create Store**
3. 스토어 이름: `OptListing`
4. 기본 통화: USD

#### 1.2 상품 생성

**크레딧 팩 (One-time Products):**
1. **Products** → **New Product**
2. **Type**: One-time
3. 다음 상품들을 각각 생성:

| 상품명 | 가격 | 크레딧 | Product ID (생성 후 복사) |
|--------|------|--------|-------------------------|
| Credit Pack - Starter | $5 | 300 | `credit-pack-starter` |
| Credit Pack - Popular | $10 | 800 | `credit-pack-popular` |
| Credit Pack - Value | $15 | 1,200 | `credit-pack-value` |
| Credit Pack - Best | $20 | 2,000 | `credit-pack-best` |
| Credit Pack - Pro | $25 | 2,600 | `credit-pack-pro` |
| Credit Pack - Business | $50 | 6,000 | `credit-pack-business` |

**구독 플랜 (Subscription Products):**
1. **Products** → **New Product**
2. **Type**: Subscription
3. **Billing interval**: Monthly
4. 다음 플랜들을 각각 생성:

| 플랜명 | 가격 | Product ID (생성 후 복사) |
|--------|------|-------------------------|
| Pro Monthly | $49/월 | `subscription-pro-monthly` |
| Business Monthly | $99/월 | `subscription-business-monthly` |

**중요:** 각 상품 생성 후 **Product ID**를 복사하여 `frontend/src/components/Pricing.jsx`의 `generateCheckoutUrl` 함수에서 사용할 수 있도록 준비하세요.

#### 1.3 Webhook 설정

1. **Settings** → **Webhooks** → **New Webhook**
2. **URL**: 
   ```
   https://optlisting-production.up.railway.app/webhooks/lemonsqueezy
   ```
3. **Events** 선택:
   - ✅ `order_created` (크레딧 팩 구매)
   - ✅ `subscription_created` (구독 시작)
   - ✅ `subscription_updated` (구독 변경)
   - ✅ `subscription_cancelled` (구독 취소)
4. **Signing secret** 복사 (다음 단계에서 사용)

---

### 2. Railway 환경 변수 설정

1. [Railway Dashboard](https://railway.app/) 접속
2. OptListing 프로젝트 선택
3. **Variables** 탭으로 이동
4. 다음 환경 변수 추가:

| Variable | Value | 설명 |
|----------|-------|------|
| `LS_WEBHOOK_SECRET` | (Lemon Squeezy에서 복사한 Signing secret) | 웹훅 시그니처 검증용 |

5. **Deploy** 버튼 클릭하여 재배포

---

### 3. 프론트엔드 환경 변수 설정 (선택사항)

실제 Lemon Squeezy 스토어 URL이 다를 경우:

1. `frontend/.env` 파일 생성 (또는 Vercel 환경 변수 설정)
2. 다음 추가:
   ```
   VITE_LEMON_SQUEEZY_STORE=https://your-store.lemonsqueezy.com
   ```

또는 `frontend/src/components/Pricing.jsx`의 `LEMON_SQUEEZY_STORE` 상수를 직접 수정하세요.

---

### 4. Product ID 업데이트

Lemon Squeezy에서 상품을 생성한 후, 실제 Product ID를 `frontend/src/components/Pricing.jsx`에 반영하세요:

```javascript
// 예시: 실제 Product ID로 변경
const generateCheckoutUrl = (productId, variantId = null, isSubscription = false) => {
  // productId는 실제 Lemon Squeezy Product ID로 변경
  // 예: '12345' (Lemon Squeezy Dashboard에서 확인)
}
```

또는 `handlePurchase` 함수 호출 시 실제 Product ID를 전달:

```javascript
onClick={() => handlePurchase('12345')} // 실제 Product ID
```

---

### 5. 테스트

#### 5.1 Test Mode 활성화
1. Lemon Squeezy Dashboard → **Test Mode** 활성화
2. 테스트 카드 정보:
   - 카드번호: `4242 4242 4242 4242`
   - 만료: 미래 날짜 (예: 12/25)
   - CVC: 아무 3자리 (예: 123)

#### 5.2 웹훅 테스트
1. Lemon Squeezy → **Webhooks** → **Send Test**
2. Railway 로그에서 웹훅 수신 확인:
   ```bash
   railway logs
   ```
3. DB에서 크레딧 추가 확인:
   - `profiles` 테이블의 `purchased_credits` 필드 확인

#### 5.3 실제 구매 테스트
1. `https://www.optlisting.com/pricing` 접속
2. 크레딧 팩 또는 구독 플랜 선택
3. Test Mode에서 결제 완료
4. 크레딧 자동 추가 확인

---

## 🔍 문제 해결

### 웹훅 수신 안 됨
- ✅ Railway URL 확인 (`https://optlisting-production.up.railway.app/webhooks/lemonsqueezy`)
- ✅ Webhook Events 선택 확인
- ✅ Railway 로그 확인: `railway logs`

### 크레딧 추가 안 됨
- ✅ `custom_data.user_id` 확인 (웹훅 로그)
- ✅ Webhook 로그에서 에러 확인
- ✅ DB `profiles` 테이블 확인

### 시그니처 검증 실패
- ✅ `LS_WEBHOOK_SECRET` 환경 변수 확인
- ✅ Signing secret 재복사
- ✅ Railway 재배포 확인

---

## 📝 체크리스트

- [ ] Lemon Squeezy 스토어 생성
- [ ] 크레딧 팩 6개 상품 생성
- [ ] 구독 플랜 2개 상품 생성
- [ ] Webhook URL 등록
- [ ] `LS_WEBHOOK_SECRET` 환경 변수 설정
- [ ] Railway 재배포
- [ ] Test Mode에서 구매 테스트
- [ ] 웹훅 수신 확인
- [ ] 크레딧 추가 확인
- [ ] 실제 Product ID로 프론트엔드 업데이트

---

## 🎉 완료 후

모든 테스트가 성공하면:
1. **Test Mode 비활성화**
2. **Production Mode로 전환**
3. 실제 고객 결제 수신 준비 완료!

