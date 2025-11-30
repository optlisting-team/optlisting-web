# 푸시 문제 해결 가이드

## 현재 오류: "Write access to repository not granted" (403)

### 가능한 원인들:

1. **토큰 권한 부족**
   - 토큰 생성 시 `repo` 권한이 전체 체크되어 있는지 확인
   - 특히 `repo` 하위의 모든 권한 체크 필요

2. **저장소 소유권 문제**
   - 저장소가 `optlisting` **조직** 소유인 경우
   - 조직 설정에서 Personal Access Token 접근을 제한했을 수 있음

3. **저장소 접근 권한**
   - 저장소 Settings → Collaborators에서 본인 계정이 있는지 확인

---

## 해결 방법

### 방법 1: 토큰 권한 다시 확인 및 재생성

1. https://github.com/settings/tokens 접속
2. 기존 토큰 삭제
3. 새 토큰 생성 시:
   - ✅ **repo** (전체 체크)
     - ✅ repo (전체)
     - ✅ repo:status
     - ✅ repo_deployment
     - ✅ public_repo
     - ✅ repo:invite
     - ✅ security_events

### 방법 2: 저장소 소유권 확인

저장소가 `optlisting` 조직 소유라면:

1. GitHub에서 저장소 페이지 확인
2. 저장소 이름 옆 소유자 확인
3. 개인 계정 저장소라면:
   - `https://github.com/YOUR-USERNAME/optlisting-.git` 형식으로 변경

### 방법 3: 조직 설정 확인

저장소가 조직 소유인 경우:

1. 조직 Settings → Third-party access
2. Personal access tokens 정책 확인
3. 필요시 토큰 접근 허용 설정

### 방법 4: 개인 계정 저장소로 변경

조직 저장소 대신 개인 계정 저장소 사용:

1. 새 저장소를 개인 계정에 생성
2. Remote URL 변경:
   ```bash
   git remote set-url origin https://github.com/YOUR-USERNAME/optlisting-.git
   ```

---

## 보안: 토큰을 URL에서 제거

현재 토큰이 URL에 포함되어 있습니다. 보안을 위해 제거하는 것이 좋습니다.

### Git Credential Manager 사용 (권장)

```bash
# Remote URL에서 토큰 제거
git remote set-url origin https://github.com/optlisting/optlisting-.git

# Windows Credential Manager에 토큰 저장
# 푸시 시 자격 증명 입력하면 자동 저장됨
git push -u origin develop
```

자격 증명 입력:
- Username: `optlisting` 또는 GitHub 사용자명
- Password: Personal Access Token

---

## 빠른 확인 체크리스트

- [ ] 토큰에 `repo` 전체 권한이 있는가?
- [ ] 저장소가 조직 소유인가, 개인 계정 소유인가?
- [ ] 저장소 Settings에서 접근 권한 확인
- [ ] 토큰이 만료되지 않았는가?

---

## 다음 단계

1. 토큰 권한 확인 후 재생성
2. 저장소 소유권 확인
3. 필요시 개인 계정 저장소로 변경
4. 다시 푸시 시도





