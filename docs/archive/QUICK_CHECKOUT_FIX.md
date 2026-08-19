# Lemon Squeezy 체크아웃 문제 빠른 해결

## 현재 상황
- `/checkout/buy/1150506` URL 접속 시 404 에러
- Lemon Squeezy 대시보드에서 체크아웃 링크를 찾을 수 없음

## 빠른 확인 사항

### 1. Variant가 생성되었는지 확인
현재 "Add Variant" 폼이 열려 있다면, **먼저 Variant를 생성**해야 합니다:

1. "Add Variant" 폼에서:
   - Variant name: `Default` (또는 원하는 이름)
   - Variant description: (선택사항)
   - Pricing: `Single payment` 선택 (이미 선택됨)
   - Price: `$5.00` 입력
   - **"Save"** 또는 **"Create Variant"** 버튼 클릭

2. Variant 생성 후:
   - Variant 목록에서 생성된 Variant 클릭
   - 브라우저 주소창 URL 확인 (Variant ID 포함)

### 2. Storefront 확인
Lemon Squeezy → **Design** → **Storefront**에서:

1. Storefront가 활성화되어 있는지 확인
2. Storefront URL 확인 (예: `https://optlisting.lemonsqueezy.com`)
3. 제품 페이지 URL 확인

---

## 임시 해결책: 하드코딩된 URL 테스트

현재 Variant ID `1150506`이 맞는지 확인하기 위해, 다른 형식의 URL을 시도해볼 수 있습니다:

1. `https://optlisting.lemonsqueezy.com/buy/1150506`
2. `https://optlisting.lemonsqueezy.com/checkout/1150506`
3. Storefront URL + 제품 slug

---

## 최종 해결책: Checkout API 사용

직접 URL이 작동하지 않는다면, **Lemon Squeezy Checkout API**를 사용해야 합니다.

### 필요한 것:
1. Lemon Squeezy API 키 (Settings → API)
2. Store ID (Settings → Store)
3. Backend API 엔드포인트 구현
4. Frontend 수정

### 구현 시간: 약 30분

