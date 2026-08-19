# Classic Personal Access Token 생성 가이드

## Classic Token 생성

### 1단계: 토큰 생성

1. **토큰 생성 페이지 접속**
   - https://github.com/settings/tokens/new 접속

2. **Classic Token 생성**
   - "Generate new token" → **"Generate new token (classic)"** 클릭
   - GitHub 비밀번호 입력 요청 시 입력

3. **토큰 설정**
   - **Note**: `optlisting-team-repo`
   - **Expiration**: 90 days (또는 원하는 기간)
   - **Select scopes**:
     - ✅ **repo** (전체 체크)
       - ✅ repo (전체)
       - ✅ repo:status
       - ✅ repo_deployment
       - ✅ public_repo
       - ✅ repo:invite
       - ✅ security_events

4. **토큰 생성**
   - 맨 아래 "Generate token" 버튼 클릭
   - ⚠️ **중요**: 생성된 토큰을 즉시 복사하세요! (한 번만 보여줍니다)

### 2단계: 조직 Settings 확인

조직 Settings → "Tokens (classic)" 탭에서:
- "Allow access via personal access tokens"가 활성화되어 있는지 확인

### 3단계: 토큰으로 푸시

생성한 Classic Token을 복사한 후:

```bash
# Remote URL에 토큰 포함 (임시)
git remote set-url origin https://YOUR_NEW_CLASSIC_TOKEN@github.com/optlisting-team/optlisting-.git

# 푸시
git push -u origin develop
```

또는 Git Credential Manager 사용:
```bash
# Remote URL 정리
git remote set-url origin https://github.com/optlisting-team/optlisting-.git

# 푸시 시 자격 증명 입력
git push -u origin develop
# Username: optlisting (또는 GitHub 사용자명)
# Password: 생성한 Classic Token 붙여넣기
```

---

## Classic Token vs Fine-grained Token

- **Classic Token**: 조직 승인 요구와 독립적으로 작동, 더 간단
- **Fine-grained Token**: 더 세밀한 권한 제어, 승인 필요할 수 있음

**조직 저장소용으로는 Classic Token이 더 간단합니다!**





