# Vercel에 GitHub 권한 주기

## 방법 1: Vercel에서 권한 요청 (추천)

### 1. Vercel 대시보드 접속
1. https://vercel.com 접속
2. 로그인 (또는 가입)

### 2. 새 프로젝트 생성
1. **"Add New Project"** 또는 **"New Project"** 클릭
2. GitHub로 로그인하라고 나오면 **"Continue with GitHub"** 클릭
3. 권한 요청 화면이 나타남

### 3. 권한 승인
권한 요청 화면에서:
- ✅ **저장소 접근 권한** 허용
- ✅ **조직(`optlisting-team`) 접근 권한** 허용
- **"Authorize Vercel"** 또는 **"Install"** 클릭

---

## 방법 2: GitHub Settings에서 직접 확인/설정

### 1. GitHub Settings 접속
1. GitHub 로그인
2. 우측 상단 프로필 사진 클릭
3. **"Settings"** 클릭

### 2. Applications 메뉴
1. 좌측 메뉴에서 **"Applications"** 클릭
2. **"Installed GitHub Apps"** 탭 클릭
3. **"Vercel"** 찾기

### 3. 권한 확인/수정
1. **Vercel** 클릭
2. **"Configure"** 클릭
3. 권한 범위 확인:
   - ✅ **Repository access**: `optlisting-team` 조직 선택
   - ✅ 저장소 목록 확인

---

## 방법 3: 조직 설정에서 권한 관리

### 조직(`optlisting-team`)에서:
1. GitHub → `optlisting-team` 조직 선택
2. **Settings** → **Third-party access** 또는 **Applications**
3. **Vercel** 찾기
4. 권한 설정 확인/변경

---

## 빠른 확인 방법

### Vercel 대시보드에서:
1. **"Add New Project"** 클릭
2. GitHub 저장소 목록이 보이면 → ✅ 권한 있음
3. 저장소가 안 보이면 → 권한 필요

---

## 문제 해결

### 저장소가 안 보여요?

1. **권한 재요청**
   - Vercel에서 "Add New Project" → "GitHub" 선택
   - 권한 승인 화면 다시 나타남

2. **조직 접근 권한 확인**
   - GitHub Settings → Applications → Vercel
   - `optlisting-team` 조직 선택 확인

3. **Vercel 재연결**
   - GitHub Settings → Applications → Vercel → "Configure"
   - 조직 접근 권한 다시 설정

---

## 일반적인 흐름

### 첫 연결 시:
1. Vercel → "Add New Project"
2. "Continue with GitHub" 클릭
3. GitHub 로그인
4. **권한 승인 화면** → 허용
5. 저장소 목록에서 `optlisting-team/optlisting-` 선택

---

## 체크리스트

- [ ] Vercel 가입 완료
- [ ] "Add New Project" 클릭
- [ ] GitHub 권한 승인
- [ ] `optlisting-team` 조직 저장소 접근 허용
- [ ] `optlisting-` 저장소 목록에 표시되는지 확인



