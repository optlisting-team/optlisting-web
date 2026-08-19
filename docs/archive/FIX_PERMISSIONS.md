# 저장소 권한 문제 해결 가이드

## 현재 오류: "Write access to repository not granted" (403)

저장소는 존재하지만, 쓰기 권한이 없습니다. 조직 저장소에서는 추가 설정이 필요합니다.

---

## 해결 방법

### 방법 1: 조직 Settings에서 Personal Access Token 허용

1. **조직 Settings 접속**
   - https://github.com/organizations/optlisting-team/settings/profile 접속
   - 또는: GitHub → optlisting-team 조직 → Settings

2. **Third-party access 설정**
   - 좌측 메뉴에서 "Third-party access" 또는 "Personal access tokens" 찾기
   - "Personal access tokens" 설정 확인

3. **토큰 정책 변경**
   - "Personal access tokens" 정책에서:
     - ✅ "Allow" 또는 "Require approval" 선택
     - ❌ "Block"이 선택되어 있으면 변경 필요

### 방법 2: 새 토큰 생성 (Fine-grained 권한)

조직 저장소용 Fine-grained Personal Access Token 생성:

1. **토큰 생성**
   - https://github.com/settings/tokens/new 접속
   - "Generate new token" → "Generate new token (fine-grained)"

2. **토큰 설정**
   - **Token name**: `optlisting-team-repo`
   - **Expiration**: 90 days
   - **Repository access**: ✅ **Only select repositories**
     - `optlisting-team/optlisting-` 선택
   - **Permissions**:
     - ✅ **Repository permissions** → **Contents**: Read and write
     - ✅ **Repository permissions** → **Metadata**: Read-only

3. **토큰 생성 후 사용**

### 방법 3: 조직 소유자 권한 확인

조직의 소유자(Owner)라면:
- 조직 Settings → Members에서 본인 계정 권한 확인
- Owner 권한이 필요할 수 있음

---

## 빠른 확인 체크리스트

- [ ] 저장소가 실제로 생성되었는가? (https://github.com/optlisting-team/optlisting- 접속 확인)
- [ ] Personal Access Token에 `repo` 권한이 있는가?
- [ ] 조직 Settings에서 Personal Access Token 접근이 허용되어 있는가?
- [ ] 본인이 조직의 Owner 또는 Admin 권한이 있는가?

---

## 대안: 개인 계정 저장소 사용

조직 저장소 권한 문제를 피하려면:

1. 개인 계정에 저장소 생성
2. Remote URL 변경:
   ```bash
   git remote set-url origin https://github.com/YOUR-USERNAME/optlisting-.git
   ```
3. 푸시 진행

---

## 다음 단계

조직 Settings에서 Personal Access Token 접근을 허용한 후, 다시 푸시를 시도해보세요:

```bash
git push -u origin develop
```





