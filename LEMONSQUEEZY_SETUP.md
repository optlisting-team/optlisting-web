# Lemon Squeezy 결제 연동 가이드

## 🎯 개요
OptListing에서 크레딧 팩 구매와 구독 결제를 Lemon Squeezy로 처리합니다.

---

## 📋 Step 1: Lemon Squeezy 계정 설정

### 1.1 계정 생성
1. [Lemon Squeezy](https://www.lemonsqueezy.com/) 접속
2. 계정 생성 및 비즈니스 정보 입력
3. 결제 수단 연결 (Stripe 연동)

### 1.2 스토어 생성
1. **Dashboard** → **Store** → **Create Store**
2. 스토어 이름: `OptListing`
3. 기본 통화: USD

---

## 📋 Step 2: 상품 생성

### 2.1 크레딧 팩 (일회성 구매)

| 상품명 | 가격 | 크레딧 |
|--------|------|--------|
| Credit Pack - Starter | $5 | 300 |
| Credit Pack - Popular | $10 | 800 |
| Credit Pack - Value | $15 | 1,200 |
| Credit Pack - Best | $20 | 2,000 |
| Credit Pack - Pro | $25 | 2,600 |
| Credit Pack - Business | $50 | 6,000 |

**설정:**
1. **Products** → **New Product**
2. **Type**: One-time
3. 각 팩별로 상품 생성

### 2.2 구독 플랜

| 플랜명 | 가격 | 기능 |
|--------|------|------|
| Pro Monthly | $49/월 | 무제한 리스팅 |
| Business Monthly | $99/월 | 무제한 + 팀 기능 |

**설정:**
1. **Products** → **New Product**
2. **Type**: Subscription
3. **Billing interval**: Monthly

---

## 📋 Step 3: Webhook 설정

### 3.1 Webhook URL 등록
1. **Settings** → **Webhooks**
2. **New Webhook** 클릭
3. **URL**: `https://optlisting-production.up.railway.app/webhooks/lemonsqueezy`
4. **Events** 선택:
   - ✅ `order_created` (크레딧 팩 구매)
   - ✅ `subscription_created` (구독 시작)
   - ✅ `subscription_updated` (구독 변경)
   - ✅ `subscription_cancelled` (구독 취소)

### 3.2 Webhook Secret 복사
1. Webhook 생성 후 **Signing secret** 복사
2. Railway 환경 변수에 추가:
   - **Key**: `LS_WEBHOOK_SECRET`
   - **Value**: (복사한 시크릿)

---

## 📋 Step 4: Checkout Link 생성

### 4.1 사용자 ID 전달 (Custom Data)
Checkout URL에 `checkout[custom][user_id]` 파라미터 추가:

```
https://optlisting.lemonsqueezy.com/checkout/buy/xxxxx?checkout[custom][user_id]=USER_ID_HERE
```

### 4.2 프론트엔드 연동
```javascript
const handlePurchase = (packId, userId) => {
  const checkoutUrl = `https://optlisting.lemonsqueezy.com/checkout/buy/${packId}?checkout[custom][user_id]=${userId}`;
  window.open(checkoutUrl, '_blank');
};
```

---

## 📋 Step 5: Railway 환경 변수

Railway Dashboard → Variables에 추가:

| Variable | Value |
|----------|-------|
| `LS_WEBHOOK_SECRET` | (Lemon Squeezy Webhook Secret) |
| `LS_API_KEY` | (선택: API 직접 호출용) |

---

## 📋 Step 6: 테스트

### 6.1 Test Mode 사용
1. Lemon Squeezy Dashboard → **Test Mode** 활성화
2. 테스트 카드로 구매 테스트:
   - 카드번호: `4242 4242 4242 4242`
   - 만료: 미래 날짜
   - CVC: 아무 3자리

### 6.2 Webhook 테스트
1. Lemon Squeezy → Webhooks → **Send Test**
2. Railway 로그에서 웹훅 수신 확인
3. DB에서 크레딧 추가 확인

---

## 🔍 웹훅 이벤트 처리

### order_created (크레딧 팩 구매)
```json
{
  "meta": {
    "event_name": "order_created"
  },
  "data": {
    "attributes": {
      "total": 500,  // $5.00 (cents)
      "customer_id": "12345",
      "custom_data": {
        "user_id": "supabase-user-id"
      }
    }
  }
}
```

### subscription_created (구독 시작)
```json
{
  "meta": {
    "event_name": "subscription_created"
  },
  "data": {
    "attributes": {
      "customer_id": "12345",
      "status": "active",
      "custom_data": {
        "user_id": "supabase-user-id"
      }
    }
  }
}
```

---

## ✅ 체크리스트

- [ ] Lemon Squeezy 계정 생성
- [ ] 스토어 생성
- [ ] 크레딧 팩 상품 6개 생성
- [ ] 구독 상품 생성
- [ ] Webhook URL 등록
- [ ] LS_WEBHOOK_SECRET 환경 변수 설정
- [ ] Test Mode에서 구매 테스트
- [ ] 웹훅 수신 확인
- [ ] 크레딧 추가 확인

---

## 🚨 문제 해결

### 웹훅 수신 안 됨
1. Railway URL 확인
2. Webhook Events 선택 확인
3. Railway 로그 확인

### 크레딧 추가 안 됨
1. `custom_data.user_id` 확인
2. Webhook 로그에서 에러 확인
3. DB profiles 테이블 확인

### 시그니처 검증 실패
1. `LS_WEBHOOK_SECRET` 환경 변수 확인
2. Signing secret 재복사

