# GitHub Personal Access Token 생성 가이드

## Personal Access Token 생성

### 1단계: GitHub에서 토큰 생성

1. **GitHub 로그인**
   - https://github.com 접속
   - 새 계정으로 로그인

2. **Settings 접속**
   - 우측 상단 프로필 사진 클릭
   - "Settings" 클릭

3. **Developer settings**
   - 좌측 메뉴 맨 아래 "Developer settings" 클릭
   - 또는 직접 접속: https://github.com/settings/developers

4. **Personal access tokens**
   - "Personal access tokens" → "Tokens (classic)" 클릭
   - 또는 직접 접속: https://github.com/settings/tokens

5. **Generate new token**
   - "Generate new token" → "Generate new token (classic)" 클릭
   - GitHub 비밀번호 입력 요청 시 입력

6. **토큰 설정**
   - **Note**: `optlisting-repo` (원하는 이름)
   - **Expiration**: 90 days (또는 원하는 기간)
   - **Select scopes** (권한 선택):
     - ✅ `repo` (전체 체크) - 저장소 접근 권한
       - repo (전체)
       - repo:status
       - repo_deployment
       - public_repo
       - repo:invite
       - security_events
     - ✅ `workflow` (GitHub Actions 사용 시)

7. **토큰 생성**
   - 맨 아래 "Generate token" 버튼 클릭
   - ⚠️ **중요**: 생성된 토큰을 즉시 복사하세요! (한 번만 보여줍니다)

### 2단계: Git Credential 설정

#### 방법 1: 푸시 시 토큰 입력 (간단)

토큰을 복사한 후, 푸시할 때:
- Username: GitHub 사용자명 입력
- Password: Personal Access Token 붙여넣기

#### 방법 2: Git Credential Manager 사용 (권장)

Windows에서는 Git Credential Manager가 자동으로 토큰을 저장합니다.

1. 푸시 시도:
   ```bash
   git push -u origin develop
   ```

2. 자격 증명 입력:
   - Username: `optlisting` (또는 GitHub 사용자명)
   - Password: Personal Access Token 붙여넣기

3. 자동 저장: 이후부터는 자동으로 사용됩니다

#### 방법 3: URL에 토큰 포함 (임시)

⚠️ **주의**: 이 방법은 보안상 권장되지 않지만 빠르게 테스트할 때 사용 가능

```bash
git remote set-url origin https://YOUR_TOKEN@github.com/optlisting/optlisting-.git
```

---

## SSH 키 사용 (대안)

Personal Access Token 대신 SSH 키를 사용할 수도 있습니다.

### SSH 키 생성

```bash
# SSH 키 생성
ssh-keygen -t ed25519 -C "your-email@example.com"

# 공개키 복사 (Windows)
type $env:USERPROFILE\.ssh\id_ed25519.pub | clip
```

### GitHub에 SSH 키 추가

1. 생성된 공개키 복사
2. GitHub Settings → SSH and GPG keys
3. "New SSH key" 클릭
4. 키 붙여넣기 및 저장

### Remote를 SSH로 변경

```bash
git remote set-url origin git@github.com:optlisting/optlisting-.git
```

---

## 문제 해결

### "Repository not found" 오류

- 저장소 이름 확인: `optlisting-` (하이픈 포함)
- 저장소 접근 권한 확인
- 토큰의 `repo` 권한 확인

### "Authentication failed" 오류

- Personal Access Token이 올바른지 확인
- 토큰이 만료되지 않았는지 확인
- `repo` 권한이 체크되어 있는지 확인

### 토큰 재생성

토큰을 잃어버렸다면:
1. GitHub Settings → Developer settings → Personal access tokens
2. 기존 토큰 삭제
3. 새 토큰 생성

---

## 보안 권장사항

1. ✅ 토큰을 코드에 하드코딩하지 마세요
2. ✅ 토큰을 GitHub에 커밋하지 마세요
3. ✅ `.gitignore`에 `.env` 파일 포함
4. ✅ 토큰은 필요한 최소 권한만 부여
5. ✅ 정기적으로 토큰 만료 설정





