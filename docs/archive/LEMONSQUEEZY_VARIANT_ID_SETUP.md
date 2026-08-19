# Lemon Squeezy Variant ID 설정 가이드

## 🎯 목표
크레딧 충전 기능 테스트를 위해 실제 Lemon Squeezy Variant ID를 설정합니다.

---

## 📋 Step 1: Lemon Squeezy에서 Variant ID 확인

### 1.1 Test Mode 활성화
1. [Lemon Squeezy Dashboard](https://app.lemonsqueezy.com/) 접속
2. 상단에 **"Test Mode"** 토글이 켜져 있는지 확인
3. 켜져 있지 않으면 활성화

### 1.2 크레딧 팩 상품 생성 (아직 없다면)

각 크레딧 팩별로 상품을 생성합니다:

1. **Products** → **New Product** 클릭
2. **Type**: One-time 선택
3. 각 팩별로 다음 정보로 생성:

| 상품명 | 가격 | 크레딧 |
|--------|------|--------|
| Credit Pack - Starter | $5.00 | 1,000 |
| Credit Pack - Popular | $10.00 | 2,200 |
| Credit Pack - Value | $15.00 | 3,400 |
| Credit Pack - Best | $20.00 | 5,600 |
| Credit Pack - Pro | $25.00 | 7,200 |
| Credit Pack - Business | $50.00 | 16,000 |

4. 각 상품의 **Status**를 **Published**로 설정
5. **Save** 클릭

### 1.3 Variant ID 확인

각 상품 생성 후:

1. 생성된 상품 클릭 (또는 **Products** → 상품 선택)
2. **Variants** 탭 클릭
3. Variant의 **ID** 복사 (숫자 형태, 예: `123456`)
4. 각 팩별 Variant ID를 기록:

```
Starter ($5):   [VARIANT_ID_5]
Popular ($10):  [VARIANT_ID_10]
Value ($15):    [VARIANT_ID_15]
Best ($20):     [VARIANT_ID_20]
Pro ($25):      [VARIANT_ID_25]
Business ($50): [VARIANT_ID_50]
```

---

## 📋 Step 2: 프론트엔드에 Variant ID 설정

### 방법 1: 환경 변수 사용 (권장)

1. `frontend/.env` 파일 생성 (또는 Vercel 환경 변수에 추가):

```env
VITE_LEMON_SQUEEZY_STORE=https://optlisting.lemonsqueezy.com
VITE_LS_VARIANT_CREDIT_5=123456
VITE_LS_VARIANT_CREDIT_10=123457
VITE_LS_VARIANT_CREDIT_15=123458
VITE_LS_VARIANT_CREDIT_20=123459
VITE_LS_VARIANT_CREDIT_25=123460
VITE_LS_VARIANT_CREDIT_50=123461
```

2. `frontend/src/components/Sidebar.jsx` 수정:

```javascript
// Variant ID 매핑 (환경 변수에서 가져오기)
const variantIdMap = {
  'credit-5': import.meta.env.VITE_LS_VARIANT_CREDIT_5,
  'credit-10': import.meta.env.VITE_LS_VARIANT_CREDIT_10,
  'credit-15': import.meta.env.VITE_LS_VARIANT_CREDIT_15,
  'credit-20': import.meta.env.VITE_LS_VARIANT_CREDIT_20,
  'credit-25': import.meta.env.VITE_LS_VARIANT_CREDIT_25,
  'credit-50': import.meta.env.VITE_LS_VARIANT_CREDIT_50,
}
```

### 방법 2: 코드에 직접 설정

`frontend/src/components/Sidebar.jsx` 파일에서 `VARIANT_ID_PLACEHOLDER_*` 부분을 실제 Variant ID로 교체:

```javascript
const variantIdMap = {
  'credit-5': '123456',    // 실제 Variant ID로 변경
  'credit-10': '123457',   // 실제 Variant ID로 변경
  'credit-15': '123458',   // 실제 Variant ID로 변경
  'credit-20': '123459',   // 실제 Variant ID로 변경
  'credit-25': '123460',   // 실제 Variant ID로 변경
  'credit-50': '123461',   // 실제 Variant ID로 변경
}
```

---

## 📋 Step 3: Webhook 설정 확인

웹훅이 설정되어 있는지 확인:

1. **Settings** → **Webhooks**
2. Webhook URL: `https://optlisting-production.up.railway.app/webhooks/lemonsqueezy`
3. Events:
   - ✅ `order_created`
   - ✅ `subscription_created`
   - ✅ `subscription_updated`
   - ✅ `subscription_cancelled`
4. **Signing secret** 복사 → Railway 환경 변수 `LS_WEBHOOK_SECRET`에 설정

---

## 📋 Step 4: 테스트

### 4.1 Test Mode에서 결제 테스트

1. 프론트엔드 실행 (또는 배포된 사이트 접속)
2. Sidebar에서 크레딧 구매 모달 열기
3. 크레딧 팩 선택
4. "Get Credits" 버튼 클릭
5. Lemon Squeezy Checkout 페이지가 열리는지 확인

**테스트 카드 정보:**
- 카드번호: `4242 4242 4242 4242`
- 만료일: 미래 날짜 (예: `12/35`)
- CVC: 아무 3자리 (예: `123`)
- 이름: 아무 이름
- 이메일: 아무 이메일

### 4.2 결제 완료 후 확인

1. **Railway 로그 확인:**
   ```bash
   railway logs
   ```
   - 웹훅 수신 로그 확인
   - `order_created` 이벤트 확인
   - 크레딧 추가 로그 확인

2. **DB에서 크레딧 확인:**
   ```sql
   SELECT user_id, purchased_credits, consumed_credits 
   FROM profiles 
   WHERE user_id = 'default-user';
   ```

3. **프론트엔드에서 크레딧 확인:**
   - Dashboard에서 크레딧 표시 확인
   - Sidebar에서 크레딧 표시 확인

---

## ✅ 체크리스트

- [ ] Lemon Squeezy Test Mode 활성화
- [ ] 크레딧 팩 6개 상품 생성 (Published 상태)
- [ ] 각 팩의 Variant ID 확인 및 복사
- [ ] 프론트엔드에 Variant ID 설정 (환경 변수 또는 코드)
- [ ] Webhook URL 및 Events 설정 확인
- [ ] `LS_WEBHOOK_SECRET` 환경 변수 설정 확인
- [ ] Test Mode에서 결제 테스트 완료
- [ ] 웹훅 수신 확인 (Railway 로그)
- [ ] 크레딧 추가 확인 (DB 또는 프론트엔드)

---

## 🚨 문제 해결

### 체크아웃 페이지가 열리지 않음
- ✅ Variant ID가 올바른지 확인
- ✅ 상품이 Published 상태인지 확인
- ✅ Test Mode가 활성화되어 있는지 확인
- ✅ 브라우저 콘솔에서 에러 확인

### 웹훅 수신 안 됨
- ✅ Railway 서버가 실행 중인지 확인
- ✅ Webhook URL이 올바른지 확인
- ✅ Railway 환경 변수 `LS_WEBHOOK_SECRET` 설정 확인
- ✅ Railway 로그에서 에러 확인

### 크레딧 추가 안 됨
- ✅ 웹훅 로그에서 `user_id` 확인
- ✅ `custom_data.user_id`가 올바르게 전달되는지 확인
- ✅ DB `profiles` 테이블에서 해당 `user_id` 확인
- ✅ 웹훅 핸들러 로그 확인 (`backend/webhooks.py`)

---

## 📚 참고 자료

- [Lemon Squeezy Test Mode 공식 문서](https://docs.lemonsqueezy.com/help/getting-started/test-mode)
- [Lemon Squeezy Test Cards](https://docs.lemonsqueezy.com/help/getting-started/test-mode#test-card-numbers)
- [Lemon Squeezy Webhooks](https://docs.lemonsqueezy.com/api/webhooks)
- [Lemon Squeezy Checkout URLs](https://docs.lemonsqueezy.com/api/checkouts)

