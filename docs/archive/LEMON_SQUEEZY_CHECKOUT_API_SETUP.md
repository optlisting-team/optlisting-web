# Lemon Squeezy Checkout API 사용 가이드

## 현재 문제
직접 `/checkout/buy/[variant_id]` URL 형식이 작동하지 않음 (404 에러)

## 해결 방법: Checkout API 사용

Lemon Squeezy Checkout API를 사용하여 checkout을 생성하고 그 URL로 리다이렉트합니다.

---

## Step 1: Lemon Squeezy API 키 발급

1. **Lemon Squeezy Dashboard** → **Settings** → **API**
2. **"Create API Key"** 클릭
3. API 키 복사 (예: `sk_live_xxxxx` 또는 `sk_test_xxxxx`)
4. **Store ID** 확인 (Settings → Store → Store ID)

---

## Step 2: Backend에 API 키 설정

### Railway Environment Variables 추가

1. Railway 대시보드 → 프로젝트 → **Variables** 탭
2. 다음 환경 변수 추가:

```
LEMON_SQUEEZY_API_KEY=sk_test_xxxxx  # 또는 sk_live_xxxxx
LEMON_SQUEEZY_STORE_ID=12345  # Store ID
```

---

## Step 3: Backend API 엔드포인트 생성

`backend/lemonsqueezy_checkout.py` 파일 생성 (또는 `backend/main.py`에 추가):

```python
import os
import requests
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from backend.auth import get_current_user  # 또는 인증 방식에 맞게 수정
from backend.database import get_db

router = APIRouter()

LS_API_KEY = os.getenv("LEMON_SQUEEZY_API_KEY")
LS_STORE_ID = os.getenv("LEMON_SQUEEZY_STORE_ID")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://optlisting.vercel.app")

@router.post("/api/lemonsqueezy/create-checkout")
async def create_checkout(
    variant_id: str,
    user_id: str = Depends(get_current_user),  # 인증 필요
    db: Session = Depends(get_db)
):
    """
    Lemon Squeezy Checkout API를 사용하여 checkout 생성
    """
    if not LS_API_KEY or not LS_STORE_ID:
        raise HTTPException(
            status_code=500,
            detail="Lemon Squeezy API credentials not configured"
        )
    
    try:
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
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to create checkout: {response.text}"
            )
        
        checkout_data = response.json()
        checkout_url = checkout_data["data"]["attributes"]["url"]
        
        return {"checkout_url": checkout_url}
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error creating checkout: {str(e)}"
        )
```

---

## Step 4: Frontend 수정

`frontend/src/components/Sidebar.jsx`에서 직접 URL 대신 API 호출:

```javascript
const handleGetCredits = async (selectedPack) => {
  try {
    const variantId = variantIdMap[selectedPack.id] || variantIdMap['credit-5']
    
    const response = await fetch(`${API_BASE_URL}/api/lemonsqueezy/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,  // 인증 토큰
      },
      body: JSON.stringify({
        variant_id: variantId,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create checkout');
    }
    
    const data = await response.json();
    window.open(data.checkout_url, '_blank');
  } catch (error) {
    console.error('Failed to create checkout:', error);
    alert('Failed to create checkout. Please try again.');
  }
};
```

---

## 대안: 간단한 해결책 (임시)

API 설정이 복잡하다면, **Lemon Squeezy Storefront**를 사용할 수도 있습니다:

1. Lemon Squeezy → **Design** → **Storefront** 활성화
2. Storefront URL에서 제품 페이지 URL 확인
3. 그 URL을 코드에 사용

하지만 이것도 제품이 Storefront에서 공개되어 있어야 합니다.

---

## 권장 방법

**Lemon Squeezy Checkout API 사용**이 가장 확실하고 안정적인 방법입니다.

