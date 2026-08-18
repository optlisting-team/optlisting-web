# Lemon Squeezy 404 에러 해결 방법

## 현재 상황
- Variant ID: `1150506` (확인됨)
- Product ID: `731081` (확인됨)
- URL: `https://optlisting.lemonsqueezy.com/checkout/buy/1150506` → **404 에러**

## 원인
Lemon Squeezy에서 직접 `/checkout/buy/[variant_id]` URL 형식이 작동하지 않을 수 있습니다.
대시보드에 체크아웃 링크가 표시되지 않는 것도 같은 이유입니다.

## 해결 방법: Lemon Squeezy Checkout API 사용 (권장)

### Step 1: API 키 발급

1. Lemon Squeezy Dashboard → **Settings** → **API**
2. **"Create API Key"** 클릭
3. API 키 복사 (예: `sk_test_xxxxx`)
4. **Store ID** 확인 (Settings → Store → Store ID)

### Step 2: Railway 환경 변수 추가

Railway 대시보드 → 프로젝트 → **Variables** 탭:

```
LEMON_SQUEEZY_API_KEY=sk_test_xxxxx
LEMON_SQUEEZY_STORE_ID=12345
```

### Step 3: Backend API 엔드포인트 구현

`backend/main.py`에 다음 엔드포인트 추가:

```python
import requests
import os

@app.post("/api/lemonsqueezy/create-checkout")
async def create_checkout(
    variant_id: str,
    current_user: dict = Depends(get_current_user),  # 인증 필요
    db: Session = Depends(get_db)
):
    """Lemon Squeezy Checkout API를 사용하여 checkout 생성"""
    LS_API_KEY = os.getenv("LEMON_SQUEEZY_API_KEY")
    LS_STORE_ID = os.getenv("LEMON_SQUEEZY_STORE_ID")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "https://optlisting.vercel.app")
    
    if not LS_API_KEY or not LS_STORE_ID:
        raise HTTPException(status_code=500, detail="Lemon Squeezy API not configured")
    
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
                                "user_id": current_user["id"],
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
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
```

### Step 4: Frontend 수정

`frontend/src/components/Sidebar.jsx`에서 `<a href>` 대신 API 호출 사용:

```javascript
// onClick handler로 변경
onClick={async (e) => {
  e.preventDefault()
  
  const variantId = variantIdMap[selectedPack.id] || variantIdMap['credit-5']
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/lemonsqueezy/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 인증 헤더 추가 필요
      },
      body: JSON.stringify({ variant_id: variantId }),
    })
    
    if (!response.ok) {
      throw new Error('Failed to create checkout')
    }
    
    const data = await response.json()
    window.open(data.checkout_url, '_blank')
  } catch (error) {
    console.error('Failed to create checkout:', error)
    alert('Failed to create checkout. Please try again.')
  }
}}
```

---

## 대안: Storefront 사용

Lemon Squeezy → **Design** → **Storefront** 활성화 후:
- Storefront URL에서 제품 페이지 접근
- 또는 Storefront 제품 페이지 URL 직접 사용

---

## 빠른 테스트

현재 URL 형식을 테스트하려면:
1. `https://optlisting.lemonsqueezy.com/checkout/buy/1150506` (현재 방식)
2. `https://optlisting.lemonsqueezy.com/buy/1150506` (Storefront 방식)

둘 다 404면 → **Checkout API 필수**

