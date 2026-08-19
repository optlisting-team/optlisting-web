# optlisting-team 조직에 저장소 생성 가이드

## 1단계: 저장소 생성

1. **조직 저장소 생성 페이지 접속**
   - 직접 링크: https://github.com/organizations/optlisting-team/repositories/new
   - 또는: GitHub → optlisting-team 조직 → "Repositories" 탭 → "New repository" 버튼

2. **저장소 설정**
   - **Repository name**: `optlisting-`
   - **Description**: "OptListing - Zombie Listing Detector SaaS"
   - **Visibility**: ✅ **Private** (추천)
   - ⚠️ **"Initialize this repository with a README"** - 체크하지 마세요!
   - ⚠️ **"Add .gitignore"** - 체크하지 마세요!
   - ⚠️ **"Choose a license"** - None 선택

3. **"Create repository" 클릭**

## 2단계: 저장소 생성 확인

생성 후 페이지에서 저장소 URL 확인:
- 예: `https://github.com/optlisting-team/optlisting-`

## 3단계: 푸시 준비

저장소가 생성되면:
- Remote URL이 이미 올바르게 설정되어 있습니다: `https://github.com/optlisting-team/optlisting-.git`
- Personal Access Token이 준비되어 있습니다
- 코드가 커밋되어 있습니다

## 4단계: 푸시

저장소 생성 후 알려주시면 바로 푸시하겠습니다!

```bash
git push -u origin develop
```

---

## 문제 해결

### "Repository not found" 오류

- 저장소가 정말 생성되었는지 확인
- 저장소 이름이 정확히 `optlisting-`인지 확인
- 조직에 접근 권한이 있는지 확인

### "Write access not granted" 오류

- Personal Access Token에 `repo` 권한이 있는지 확인
- 조직 Settings → Third-party access에서 토큰 접근 허용 설정





