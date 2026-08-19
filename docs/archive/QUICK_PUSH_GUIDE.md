# 빠른 푸시 가이드

## Personal Access Token 생성 후 푸시하기

### 1. 토큰 생성 (1분)

1. https://github.com/settings/tokens 접속
2. "Generate new token (classic)" 클릭
3. `repo` 권한 체크
4. 토큰 생성 후 복사

### 2. 푸시 명령어

토큰 생성 후 다음 명령어 실행:

```bash
git push -u origin develop
```

**자격 증명 입력 시:**
- Username: `optlisting` (또는 GitHub 사용자명)
- Password: 생성한 Personal Access Token 붙여넣기

---

## 또는 SSH 사용 (토큰 대신)

### SSH 키로 전환

```bash
# Remote를 SSH로 변경
git remote set-url origin git@github.com:optlisting/optlisting-.git

# 푸시 시도
git push -u origin develop
```

SSH 키가 없다면:
1. `ssh-keygen -t ed25519 -C "your-email@example.com"`
2. `type $env:USERPROFILE\.ssh\id_ed25519.pub | clip` (공개키 복사)
3. GitHub Settings → SSH and GPG keys → New SSH key

---

## 저장소 권한 확인

만약 여전히 "Repository not found" 오류가 나면:

1. GitHub에서 저장소 페이지 확인
   - https://github.com/optlisting/optlisting- 접속 가능한지 확인

2. 저장소 소유자 확인
   - 저장소가 `optlisting` 조직 소유인지 확인
   - 개인 계정 저장소라면 사용자명 확인

3. 접근 권한 확인
   - 저장소 Settings → Collaborators에서 접근 권한 확인





