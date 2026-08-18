# Lemon Squeezy 체크아웃 URL 확인 방법

## 🚨 현재 문제
`https://optlisting.lemonsqueezy.com/checkout/buy/1150506` 접속 시 404 에러 발생

## ✅ 해결 방법: Lemon Squeezy 대시보드에서 실제 URL 확인

### Step 1: 제품 페이지 접근

1. **Lemon Squeezy Dashboard** 접속
   - https://app.lemonsqueezy.com/

2. **Products** → **Credit Pack_1000** 클릭

3. **Variants** 탭 클릭

4. Variant (`1150506`) 클릭

### Step 2: 공유 URL 확인

제품 페이지 또는 Variant 페이지에서:

1. **"Share"** 버튼 찾기 (또는 **"Get checkout link"** 버튼)
   - 보통 상단 또는 우측에 위치

2. 공유 URL 확인
   - 형식 예: `https://optlisting.lemonsqueezy.com/checkout/buy/xxxxx`
   - 또는 다른 형식일 수 있음

3. **URL 복사**

### Step 3: URL 형식 확인

복사한 URL이:
- `/checkout/buy/1150506` 형식이면 → Variant ID가 맞음
- 다른 형식이면 → 그 형식을 코드에 적용

---

## 🔄 대안: Checkout API 사용 (권장)

Variant ID 직접 사용 대신, Lemon Squeezy Checkout API를 사용:

### Backend API 엔드포인트 생성

```python
# backend/lemonsqueezy.py (새 파일)
import requests
from fastapi import APIRouter, Depends, HTTPException
from backend.auth import get_current_user

router = APIRouter()

@router.post("/api/lemonsqueezy/create-checkout")
async def create_checkout(
    variant_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    Lemon Squeezy Checkout API를 사용하여 checkout 생성
    """
    LS_API_KEY = os.getenv("LEMON_SQUEEZY_API_KEY")
    LS_STORE_ID = os.getenv("LEMON_SQUEEZY_STORE_ID")
    
    response = requests.post(
        "https://api.lemonsqueezy.com/v1/checkouts",
        headers={
            "Authorization": f"Bearer {LS_API_KEY}",
            "Accept": "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json",
        },
        json={
            "data": {
                "type": "checkouts",
                "attributes": {
                    "custom_price": None,
                    "product_options": {
                        "enabled_variants": [variant_id],
                        "redirect_url": f"{FRONTEND_URL}/dashboard?payment=success",
                        "receipt_link_url": f"{FRONTEND_URL}/dashboard",
                        "receipt_button_text": "Return to Dashboard",
                        "receipt_thank_you_note": "Thank you for your purchase!",
                    },
                    "checkout_options": {
                        "embed": False,
                        "media": False,
                        "logo": True,
                    },
                    "checkout_data": {
                        "custom": {
                            "user_id": user_id,
                        },
                    },
                    "expires_at": None,
                },
                "relationships": {
                    "store": {
                        "data": {
                            "type": "stores",
                            "id": LS_STORE_ID,
                        },
                    },
                    "variant": {
                        "data": {
                            "type": "variants",
                            "id": variant_id,
                        },
                    },
                },
            },
        },
    )
    
    if response.status_code != 201:
        raise HTTPException(status_code=400, detail="Failed to create checkout")
    
    checkout_data = response.json()
    checkout_url = checkout_data["data"]["attributes"]["url"]
    
    return {"checkout_url": checkout_url}
```

### Frontend에서 사용

```javascript
// Sidebar.jsx
const handleGetCredits = async (selectedPack) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/lemonsqueezy/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        variant_id: variantIdMap[selectedPack.id],
      }),
    });
    
    const data = await response.json();
    window.open(data.checkout_url, '_blank');
  } catch (error) {
    console.error('Failed to create checkout:', error);
  }
};
```

---

## 🎯 빠른 해결책

**지금 당장 할 수 있는 것:**

1. Lemon Squeezy 대시보드에서 "Share" 버튼으로 실제 URL 확인
2. 그 URL을 코드에 직접 사용 (하드코딩)
3. 또는 Checkout API 사용으로 전환

