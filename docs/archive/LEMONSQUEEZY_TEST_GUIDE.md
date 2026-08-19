# Lemon Squeezy Test Mode 테스트 가이드

## 🎯 목표
Test Mode에서 결제 플로우와 웹훅이 정상 작동하는지 확인

---

## 📋 Step 1: Lemon Squeezy Dashboard 설정

### 1.1 Test Mode 활성화 확인
1. [Lemon Squeezy Dashboard](https://app.lemonsqueezy.com/) 접속
2. 상단에 **"Test Mode"** 토글이 켜져 있는지 확인
3. 켜져 있지 않으면 활성화

### 1.2 테스트 상품 생성
1. **Products** → **New Product** 클릭
2. **Type**: One-time 선택
3. **Name**: `Credit Pack - Starter` (또는 원하는 이름)
4. **Price**: $5.00
5. **Status**: Published (중요!)
6. **Save** 클릭
7. 생성된 상품의 **Product ID** 복사 (URL에서 확인 가능)
   - 예: `https://app.lemonsqueezy.com/products/12345` → Product ID는 `12345`

### 1.3 Webhook 설정 (아직 안 했다면)
1. **Settings** → **Webhooks** → **New Webhook**
2. **URL**: `https://optlisting-production.up.railway.app/webhooks/lemonsqueezy`
3. **Events** 선택:
   - ✅ `order_created`
   - ✅ `subscription_created`
   - ✅ `subscription_updated`
   - ✅ `subscription_cancelled`
4. **Signing secret** 복사 (Railway 환경 변수에 추가 필요)

---

## 📋 Step 2: 프론트엔드에서 Product ID 설정

### 2.1 Pricing.jsx 업데이트
`frontend/src/components/Pricing.jsx` 파일을 열고, 실제 Product ID로 업데이트:

```javascript
// 예시: handlePurchase 함수 호출 시 실제 Product ID 사용
<button
  onClick={() => handlePurchase('12345')} // 실제 Product ID로 변경
  className="..."
>
  구매하기
</button>
```

또는 더 나은 방법: 환경 변수 사용

```javascript
// frontend/.env 파일에 추가
VITE_LEMON_SQUEEZY_PRODUCT_STARTER=12345
VITE_LEMON_SQUEEZY_PRODUCT_POPULAR=12346
// ... 등등

// Pricing.jsx에서 사용
const PRODUCT_IDS = {
  starter: import.meta.env.VITE_LEMON_SQUEEZY_PRODUCT_STARTER,
  popular: import.meta.env.VITE_LEMON_SQUEEZY_PRODUCT_POPULAR,
  // ...
}
```

---

## 📋 Step 3: 실제 테스트

### 3.1 로컬에서 테스트 (또는 배포된 사이트)

1. **프론트엔드 실행**:
   ```bash
   cd frontend
   npm run dev
   ```

2. **브라우저에서 접속**:
   - 로컬: `http://localhost:5173/pricing`
   - 배포: `https://www.optlisting.com/pricing`

3. **크레딧 팩 선택**:
   - "Starter" 팩의 "구매하기" 버튼 클릭
   - Lemon Squeezy Checkout 페이지가 새 창에서 열림

### 3.2 Test Mode에서 결제 완료

**중요: 실제 카드 정보를 사용하지 마세요!**

다음 테스트 카드 정보 사용:

| 항목 | 값 |
|------|-----|
| 카드번호 | `4242 4242 4242 4242` (Visa) |
| 만료일 | 미래 날짜 (예: `12/35`) |
| CVC | 아무 3자리 (예: `123`) |
| 이름 | 아무 이름 |
| 이메일 | 아무 이메일 (테스트 모드에서는 실제 이메일로 전송 안 됨) |

**결제 완료 후:**
- ✅ 주문 확인 페이지 표시
- ✅ 이메일 수신 (Dashboard에 등록된 이메일로만 전송)

---

## 📋 Step 4: 웹훅 수신 확인

### 4.1 Railway 로그 확인
```bash
# Railway CLI 사용
railway logs

# 또는 Railway Dashboard에서 확인
# https://railway.app → 프로젝트 → Deploy Logs
```

**확인할 로그:**
```
웹훅 이벤트 수신: order_created
크레딧 팩 구매 완료: user_id=xxx, credits=300, order_id=xxx
```

### 4.2 DB에서 크레딧 확인
```sql
-- Supabase 또는 DB 클라이언트에서 확인
SELECT user_id, purchased_credits, available_credits 
FROM profiles 
WHERE user_id = 'default-user';
```

### 4.3 프론트엔드에서 크레딧 확인
1. Dashboard로 이동
2. 상단 크레딧 표시 확인
3. 또는 `/api/credits` 엔드포인트 직접 호출:
   ```bash
   curl https://optlisting-production.up.railway.app/api/credits?user_id=default-user
   ```

---

## 📋 Step 5: 웹훅 수동 테스트 (선택사항)

Lemon Squeezy Dashboard에서 웹훅을 수동으로 테스트할 수 있습니다:

1. **Settings** → **Webhooks** → 생성한 웹훅 선택
2. **Send Test** 버튼 클릭
3. **Event Type** 선택: `order_created`
4. **Send** 클릭
5. Railway 로그에서 수신 확인

---

## 🔍 문제 해결

### 체크아웃 페이지가 열리지 않음
- ✅ Product ID가 올바른지 확인
- ✅ 상품이 Published 상태인지 확인
- ✅ Test Mode가 활성화되어 있는지 확인
- ✅ 브라우저 콘솔에서 에러 확인

### 웹훅 수신 안 됨
- ✅ Railway 서버가 실행 중인지 확인
- ✅ Webhook URL이 올바른지 확인 (`/webhooks/lemonsqueezy`)
- ✅ Railway 환경 변수 `LS_WEBHOOK_SECRET` 설정 확인
- ✅ Railway 로그에서 에러 확인

### 크레딧 추가 안 됨
- ✅ 웹훅 로그에서 `user_id` 확인
- ✅ `custom_data.user_id`가 올바르게 전달되는지 확인
- ✅ DB `profiles` 테이블에서 해당 `user_id` 확인
- ✅ 웹훅 핸들러 로그 확인 (`backend/webhooks.py`)

### 시그니처 검증 실패
- ✅ `LS_WEBHOOK_SECRET` 환경 변수 확인
- ✅ Lemon Squeezy Dashboard에서 Signing secret 재복사
- ✅ Railway 재배포

---

## 📝 체크리스트

- [ ] Test Mode 활성화
- [ ] 테스트 상품 생성 (Published 상태)
- [ ] Product ID 확인 및 프론트엔드에 반영
- [ ] Webhook URL 등록
- [ ] `LS_WEBHOOK_SECRET` 환경 변수 설정
- [ ] 테스트 카드로 결제 완료
- [ ] 웹훅 수신 확인 (Railway 로그)
- [ ] 크레딧 추가 확인 (DB 또는 API)
- [ ] 프론트엔드에서 크레딧 표시 확인

---

## 🎉 성공 확인

다음이 모두 확인되면 테스트 성공:

1. ✅ Lemon Squeezy Checkout 페이지 정상 표시
2. ✅ 테스트 카드로 결제 완료
3. ✅ Railway 로그에서 웹훅 수신 확인
4. ✅ DB에서 크레딧 추가 확인
5. ✅ 프론트엔드에서 크레딧 표시 확인

---

## 📚 참고 자료

- [Lemon Squeezy Test Mode 공식 문서](https://docs.lemonsqueezy.com/help/getting-started/test-mode)
- [Lemon Squeezy Test Cards](https://docs.lemonsqueezy.com/help/getting-started/test-mode#test-card-numbers)
- [Lemon Squeezy Webhooks](https://docs.lemonsqueezy.com/api/webhooks)

