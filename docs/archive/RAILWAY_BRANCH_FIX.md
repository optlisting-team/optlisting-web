# Railway 브랜치 설정 변경 가이드

## 현재 상황
- Railway가 `develop` 브랜치를 배포하고 있음
- `main` 브랜치에도 최신 코드가 머지되어 있음
- Railway를 `main` 브랜치로 변경해야 함

## Railway 브랜치 설정 변경 방법

### 방법 1: Railway 웹 대시보드에서 변경 (추천)

1. **Railway 대시보드 접속**
   - https://railway.app 접속
   - 프로젝트 선택

2. **Settings 탭 클릭**
   - 프로젝트 상단의 "Settings" 탭 클릭

3. **Source 섹션 찾기**
   - Settings 페이지에서 "Source" 또는 "Repository" 섹션 찾기

4. **브랜치 변경**
   - "Branch" 드롭다운 메뉴 클릭
   - `develop` → `main`으로 변경
   - "Save" 또는 "Update" 버튼 클릭

5. **자동 재배포**
   - 브랜치 변경 시 Railway가 자동으로 재배포 시작
   - 2-3분 후 배포 완료

### 방법 2: Railway CLI 사용

```bash
# Railway CLI 설치 (없다면)
npm i -g @railway/cli

# 로그인
railway login

# 프로젝트 연결
railway link

# 브랜치 설정 확인
railway variables

# 브랜치 변경 (Railway CLI에서는 직접 변경 불가)
# 웹 대시보드에서 변경해야 함
```

## 확인 방법

브랜치 변경 후:
1. Railway 대시보드 → Deployments 탭
2. 최신 배포의 브랜치가 `main`인지 확인
3. 배포 완료 후 테스트:
   - https://web-production-3dc73.up.railway.app/docs
   - `/api/listings` 엔드포인트 테스트

## 참고

- `main` 브랜치와 `develop` 브랜치 모두 최신 코드가 있음
- Railway를 `main`으로 변경하면 프로덕션 배포로 적합
- `develop` 브랜치는 개발/테스트용으로 유지 가능

