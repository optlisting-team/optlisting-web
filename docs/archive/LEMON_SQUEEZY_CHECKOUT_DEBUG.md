# Lemon Squeezy Checkout 404 에러 해결 가이드

## 현재 상황
- Variant ID: `1150506` (확인됨)
- Store URL: `optlisting.lemonsqueezy.com` (확인됨)
- 404 에러 발생

## 문제 해결 단계

### 1. Variant가 올바르게 설정되었는지 확인

Lemon Squeezy 대시보드에서:
1. **Products** → **Credit Pack_1000** 클릭
2. **Variants** 탭 클릭
3. Variant `1150506` 확인:
   - ✅ **Status**: Published 여부 확인
   - ✅ **Pricing**: Single payment, $5.00 설정 확인
   - ✅ **Name**: "Default" 또는 다른 이름이 설정되어 있는지 확인

### 2. 실제 Checkout URL 테스트

브라우저에서 직접 다음 URL을 입력해보세요:

```
https://optlisting.lemonsqueezy.com/checkout/buy/1150506
```

- ✅ 작동하면: URL 형식은 맞음, custom data 파라미터 문제일 수 있음
- ❌ 404 에러: Variant ID나 Store URL 문제

### 3. Store 활성화 확인

Lemon Squeezy Settings → Stores:
- ✅ Store가 활성화되어 있는지 확인
- ✅ Test Mode가 켜져 있으면 테스트 가능

### 4. 대안: Lemon Squeezy API 사용

직접 URL이 작동하지 않으면, Lemon Squeezy Checkout API를 사용해야 할 수 있습니다:

```javascript
// Lemon Squeezy Checkout API를 통해 checkout 생성
const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${LEMON_SQUEEZY_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    data: {
      type: 'checkouts',
      attributes: {
        variant_id: variantId,
        custom_price: null,
        product_options: {},
        checkout_options: {},
        checkout_data: {
          custom: {
            user_id: userId
          }
        }
      }
    }
  })
})

const checkout = await response.json()
// checkout.data.attributes.url을 사용
```

### 5. 빠른 확인 방법

브라우저 콘솔에서 테스트:

```javascript
// 직접 URL 테스트
window.open('https://optlisting.lemonsqueezy.com/checkout/buy/1150506', '_blank')
```

## 일반적인 원인

1. **Variant가 Published 상태가 아님**
   - 해결: Variant 편집 → Published로 변경

2. **Store가 활성화되지 않음**
   - 해결: Settings → Stores → Store 활성화

3. **Variant ID가 잘못됨**
   - 해결: Variant 페이지 URL에서 정확한 ID 확인

4. **Store URL이 잘못됨**
   - 해결: Settings → Stores → 정확한 도메인 확인

