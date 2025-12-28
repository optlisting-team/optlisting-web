# Lemon Squeezy Checkout API 설정 가이드

## ✅ 구현 완료

Lemon Squeezy Checkout API를 사용하도록 코드가 업데이트되었습니다.

## 🔧 설정 필요 사항

### Step 1: Lemon Squeezy API 키 발급

1. **Lemon Squeezy Dashboard** 접속
   - https://app.lemonsqueezy.com/

2. **Settings** → **API** 클릭

3. **"Create API Key"** 버튼 클릭

4. API 키 복사 (예: `sk_test_xxxxx` 또는 `sk_live_xxxxx`)

5. **Store ID** 확인
   - Settings → **Store** 클릭
   - Store ID 복사 (숫자 형태, 예: `12345`)

### Step 2: Railway 환경 변수 설정

Railway 대시보드 → 프로젝트 → **Variables** 탭:

1. **"+ New Variable"** 클릭

2. 다음 환경 변수 추가:

```
LEMON_SQUEEZY_API_KEY=sk_test_xxxxx  # 위에서 복사한 API 키
LEMON_SQUEEZY_STORE_ID=12345         # 위에서 복사한 Store ID
```

3. **"Add"** 클릭

4. Railway가 자동으로 재배포합니다

### Step 3: 확인

1. Railway 재배포 완료 대기

2. 프론트엔드에서 크레딧 구매 버튼 클릭

3. Checkout 페이지가 열리면 성공!

---

## 📝 변경 사항

### Backend (`backend/main.py`)
- `/api/lemonsqueezy/create-checkout` 엔드포인트 추가
- Lemon Squeezy Checkout API를 사용하여 checkout 생성
- `user_id`를 custom data로 전달

### Frontend (`frontend/src/components/Sidebar.jsx`)
- `<a href>` 태그 → `<button onClick>` 변경
- Checkout API 호출로 변경
- 로딩 상태 추가 ("Creating Checkout...")

### Dependencies (`backend/requirements.txt`)
- `requests>=2.31.0` 추가

---

## 🚨 에러 발생 시

### "Lemon Squeezy API not configured"
- Railway 환경 변수가 설정되지 않았습니다
- Step 2를 확인하세요

### "Failed to create checkout"
- API 키 또는 Store ID가 잘못되었습니다
- Variant ID가 존재하지 않습니다
- Lemon Squeezy Dashboard에서 확인하세요

---

## 🔗 참고

- [Lemon Squeezy Checkout API 문서](https://docs.lemonsqueezy.com/api/checkouts)
- [Lemon Squeezy API 키 발급](https://app.lemonsqueezy.com/settings/api)

