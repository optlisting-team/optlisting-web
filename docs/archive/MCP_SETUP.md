# Cursor MCP 설정 가이드

## MCP (Model Context Protocol)란?

Cursor IDE에서 Supabase, GitHub 등의 서비스와 직접 통합할 수 있게 해주는 프로토콜입니다.

## 설정된 MCP 서버

### 1. Supabase MCP
- **위치**: `.cursor/mcp.json`
- **기능**: Supabase 프로젝트와 데이터베이스에 직접 접근
- **설정 필요**: Supabase 인증

### 2. GitHub MCP (선택사항)
- **위치**: `.cursor/mcp.json`
- **기능**: GitHub 저장소, 이슈, PR 등 관리
- **설정 필요**: Personal Access Token

---

## Supabase MCP 설정

### 1. 초기 인증

1. **Cursor에서 MCP 사용**
   - Cursor에서 Supabase 관련 명령을 사용하면 자동으로 인증 창이 열립니다
   - 또는 Cursor 설정에서 MCP 서버 확인

2. **브라우저 인증**
   - 브라우저 창이 자동으로 열림
   - Supabase 계정으로 로그인
   - **조직 접근 권한 허용** (중요!)

3. **프로젝트 선택**
   - 인증 후 `optlisting` 프로젝트 선택
   - 또는 자동으로 감지됨

### 2. 프로젝트 연결 확인

Cursor에서 Supabase MCP를 사용할 때:
- 새로 생성한 `optlisting` 프로젝트가 표시되어야 합니다
- 조직 이름이 변경되었다면 재인증 필요할 수 있습니다

---

## GitHub MCP 설정 (선택사항)

### 1. Personal Access Token 생성

1. **GitHub Settings 접속**
   - https://github.com/settings/tokens/new

2. **토큰 생성**
   - "Generate new token (classic)"
   - Note: `cursor-mcp-github`
   - Scopes:
     - ✅ `repo` (전체)
     - ✅ `read:org` (조직 읽기)
     - ✅ `read:user` (사용자 정보 읽기)

3. **토큰 복사**
   - 생성된 토큰 복사 (한 번만 표시됨!)

### 2. MCP 설정 파일 업데이트

`.cursor/mcp.json` 파일에서 GitHub 토큰 설정:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_token_here"
      }
    }
  }
}
```

⚠️ **보안 주의**: 
- `.cursor/mcp.json`은 `.gitignore`에 추가하는 것이 좋습니다
- 토큰을 저장소에 커밋하지 마세요!

---

## Railway MCP (추가 가능)

Railway MCP가 필요한 경우:

```json
{
  "mcpServers": {
    "railway": {
      "command": "npx",
      "args": [
        "-y",
        "@railway/cli"
      ],
      "env": {
        "RAILWAY_TOKEN": ""
      }
    }
  }
}
```

Railway CLI 토큰 생성:
1. Railway 대시보드 → Settings → Tokens
2. 새 토큰 생성 후 `.cursor/mcp.json`에 추가

---

## 문제 해결

### Supabase MCP가 작동하지 않을 때

1. **재인증 필요**
   - Cursor 재시작
   - 또는 Cursor 설정에서 MCP 서버 재설정

2. **조직 접근 권한 확인**
   - Supabase 대시보드 → Settings → Team
   - MCP 클라이언트에 접근 권한이 있는지 확인

3. **프로젝트 ID 확인**
   - Supabase 대시보드에서 프로젝트 ID 확인
   - MCP 설정에서 프로젝트 ID 지정 (필요시)

### GitHub MCP가 작동하지 않을 때

1. **토큰 권한 확인**
   - GitHub Settings → Developer settings → Personal access tokens
   - 토큰에 필요한 권한이 있는지 확인

2. **조직 접근 권한**
   - `optlisting-team` 조직에 접근 권한이 있는지 확인
   - 토큰에 `read:org` 권한 필요

3. **토큰 만료 확인**
   - 토큰이 만료되지 않았는지 확인

---

## 보안 체크리스트

- [ ] `.cursor/mcp.json`이 `.gitignore`에 포함되어 있는지 확인
- [ ] 토큰이 저장소에 커밋되지 않았는지 확인
- [ ] MCP 서버에 최소 권한만 부여
- [ ] 프로덕션 데이터베이스에는 연결하지 않기

---

## 다음 단계

1. ✅ Supabase MCP 인증 완료
2. ✅ 새 `optlisting` 프로젝트 연결 확인
3. ⬜ GitHub MCP 설정 (선택사항)
4. ⬜ Railway MCP 설정 (선택사항)

---

## 참고 링크

- [Supabase MCP 문서](https://supabase.com/docs/guides/getting-started/mcp)
- [Cursor MCP 설정](https://docs.cursor.com/features/model-context-protocol)
- [GitHub MCP 서버](https://github.com/modelcontextprotocol/servers/tree/main/src/github)





