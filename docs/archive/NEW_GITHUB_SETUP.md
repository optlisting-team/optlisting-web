# 새로운 GitHub 저장소로 푸시하기

## 1단계: 새로운 GitHub 저장소 생성

1. **새 GitHub 계정으로 로그인**
   - https://github.com 접속
   - 새로운 계정으로 로그인

2. **새 저장소 생성**
   - 우측 상단 "+" 버튼 → "New repository" 클릭
   - Repository name: `optlisting` (또는 원하는 이름)
   - Description: 원하는 설명 입력
   - Public 또는 Private 선택
   - ⚠️ **"Initialize this repository with a README"는 체크하지 마세요!**
   - "Create repository" 클릭

3. **저장소 URL 복사**
   - 생성된 저장소 페이지에서 URL 복사
   - 예: `https://github.com/your-new-username/optlisting.git`

---

## 2단계: Git Remote 변경

### 현재 상태 확인
```bash
git remote -v
```

### 기존 remote 제거
```bash
git remote remove origin
```

### 새로운 remote 추가
```bash
git remote add origin https://github.com/your-new-username/optlisting.git
```

**또는 SSH 사용 (권장):**
```bash
git remote add origin git@github.com:your-new-username/optlisting.git
```

---

## 3단계: 새 저장소로 푸시

### 방법 1: 기존 브랜치 그대로 푸시

```bash
# develop 브랜치 푸시
git push -u origin develop

# main 또는 master 브랜치가 있다면
git push -u origin main
```

### 방법 2: main 브랜치로 시작 (추천)

```bash
# 현재 브랜치 이름 확인
git branch

# develop 브랜치를 main으로 이름 변경 (선택사항)
git branch -M main

# main 브랜치로 푸시
git push -u origin main
```

---

## 4단계: GitHub 인증 설정

### Personal Access Token 사용 (HTTPS)

1. GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. "Generate new token (classic)" 클릭
3. 권한 선택:
   - `repo` (전체 저장소 접근 권한)
   - `workflow` (GitHub Actions 사용 시)
4. 토큰 생성 후 복사
5. 푸시 시 비밀번호 대신 토큰 입력

### SSH 키 사용 (권장)

1. **SSH 키 생성** (없는 경우)
```bash
ssh-keygen -t ed25519 -C "your-new-email@example.com"
```

2. **공개키 복사**
```bash
# Windows
type $env:USERPROFILE\.ssh\id_ed25519.pub | clip

# Mac/Linux
cat ~/.ssh/id_ed25519.pub | pbcopy
```

3. **GitHub에 SSH 키 추가**
   - GitHub Settings → SSH and GPG keys
   - "New SSH key" 클릭
   - 복사한 키 붙여넣기

---

## 5단계: Git 사용자 정보 변경 (선택사항)

새로운 계정 정보로 변경하려면:

```bash
# 전역 설정
git config --global user.name "Your New Name"
git config --global user.email "your-new-email@example.com"

# 현재 프로젝트만 변경
git config user.name "Your New Name"
git config user.email "your-new-email@example.com"

# 설정 확인
git config user.name
git config user.email
```

---

## 빠른 명령어 모음

```bash
# 1. 현재 커밋 확인
git log --oneline -5

# 2. 기존 remote 제거
git remote remove origin

# 3. 새 remote 추가 (URL은 실제 저장소 URL로 변경)
git remote add origin https://github.com/your-new-username/optlisting.git

# 4. Remote 확인
git remote -v

# 5. 브랜치를 main으로 변경 (선택사항)
git branch -M main

# 6. 새 저장소로 푸시
git push -u origin main

# 또는 develop 브랜치 그대로 푸시
git push -u origin develop
```

---

## 문제 해결

### 인증 오류 발생 시

**HTTPS 사용 중 403 오류:**
- Personal Access Token 사용
- 비밀번호 대신 토큰 입력

**SSH 사용 중 오류:**
```bash
# SSH 연결 테스트
ssh -T git@github.com

# SSH 키 추가 확인
ssh-add ~/.ssh/id_ed25519
```

### "remote origin already exists" 오류

```bash
# 기존 remote 제거 후 다시 추가
git remote remove origin
git remote add origin https://github.com/your-new-username/optlisting.git
```

### "Updates were rejected" 오류

새 저장소가 비어있지 않은 경우:
```bash
# 강제 푸시 (주의: 새 저장소에서만 사용)
git push -u origin main --force
```

---

## 다음 단계

1. ✅ 새 저장소에 코드가 정상적으로 푸시되었는지 확인
2. ✅ GitHub에서 파일들이 보이는지 확인
3. ✅ Railway에서 새 저장소 연결
4. ✅ Vercel에서 새 저장소 연결 (프론트엔드)

---

## 참고사항

- 기존 저장소의 커밋 이력은 그대로 유지됩니다
- 새 계정으로 커밋하려면 `user.name`과 `user.email` 변경 후 새 커밋을 만드세요
- 기존 저장소와의 연결은 제거되었으므로 더 이상 기존 저장소에 푸시되지 않습니다





