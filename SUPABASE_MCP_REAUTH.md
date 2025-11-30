# Supabase MCP 새 계정 재인증 가이드

## 현재 상황
- MCP가 예전 Supabase 계정에 연결되어 있음
- 새 프로젝트 `hjbmoncohuuwnywrpwpi`는 다른 계정에 있음
- 새 계정으로 재인증 필요

## 해결 방법

### 방법 1: Cursor에서 자동 재인증 (권장)

1. **`.cursor/mcp.json` 파일 업데이트**
   - 새 프로젝트 ID로 업데이트:
   ```json
   {
     "mcpServers": {
       "supabase": {
         "url": "https://mcp.supabase.com/mcp?project_ref=hjbmoncohuuwnywrpwpi"
       }
     }
   }
   ```

2. **Cursor 완전 재시작**
   - Cursor를 완전히 종료
   - 다시 시작

3. **Supabase MCP 사용 시 자동 인증**
   - Cursor에서 Supabase 관련 명령 사용
   - 브라우저 창이 자동으로 열림
   - **새 Supabase 계정으로 로그인**
   - 조직 접근 권한 허용

4. **인증 확인**
   - Cursor에서 "List Supabase projects" 명령 실행
   - `hjbmoncohuuwnywrpwpi` 프로젝트가 보이는지 확인

### 방법 2: Cursor MCP 설정에서 수동 재인증

1. **Cursor Settings 열기**
   - Cursor → Settings (또는 `Ctrl+,`)
   - "MCP" 또는 "Model Context Protocol" 검색

2. **Supabase MCP 서버 재시작**
   - Supabase MCP 서버 찾기
   - "Disconnect" 또는 "Remove" 클릭
   - 다시 추가하거나 재시작

3. **브라우저 인증**
   - Supabase MCP 사용 시 브라우저 창 열림
   - 새 계정으로 로그인
   - 권한 허용

### 방법 3: 브라우저 캐시/쿠키 삭제 (필요 시)

인증이 계속 실패하면:

1. **브라우저에서 Supabase 로그아웃**
   - https://supabase.com/dashboard 접속
   - 로그아웃

2. **Cursor 재시작**

3. **새로 인증**
   - Cursor에서 Supabase MCP 사용
   - 브라우저에서 새 계정으로 로그인

## 확인 방법

### MCP 연결 상태 확인

Cursor에서 다음 명령으로 확인:
- "List Supabase projects"
- "Get project details for hjbmoncohuuwnywrpwpi"

**예상 결과:**
- ✅ `hjbmoncohuuwnywrpwpi` 프로젝트가 리스트에 표시됨
- ✅ 프로젝트 정보를 성공적으로 가져옴

**오류 발생 시:**
- ❌ "You do not have permission" → 계정이 다름
- ❌ "Project not found" → 프로젝트 ID 확인 필요

## 문제 해결

### 여전히 예전 계정으로 연결되는 경우

1. **Cursor 완전 종료**
   - 모든 Cursor 창 닫기
   - 작업 관리자에서 프로세스 확인

2. **`.cursor/mcp.json` 확인**
   - 프로젝트 ID가 올바른지 확인
   - `hjbmoncohuuwnywrpwpi`로 설정되어 있는지 확인

3. **브라우저에서 Supabase 로그아웃**
   - 예전 계정에서 로그아웃
   - 새 계정으로 로그인

4. **Cursor 재시작 후 재인증**

### 권한 오류가 계속 발생하는 경우

1. **프로젝트 소유자 확인**
   - Supabase 대시보드에서 프로젝트 소유자 확인
   - 새 계정이 프로젝트에 접근 권한이 있는지 확인

2. **조직 권한 확인**
   - Supabase 조직 설정에서 MCP 접근 권한 확인
   - 새 계정이 조직 멤버인지 확인

## 체크리스트

- [ ] `.cursor/mcp.json`에 새 프로젝트 ID 설정
- [ ] Cursor 완전 재시작
- [ ] 브라우저에서 새 Supabase 계정으로 로그인
- [ ] 조직 접근 권한 허용
- [ ] MCP 연결 확인 (List projects)
- [ ] 새 프로젝트 접근 확인

## 참고

- Remote MCP는 브라우저 기반 OAuth 인증 사용
- Personal Access Token (PAT) 불필요
- 인증은 브라우저 세션 기반
- Cursor 재시작 시 자동으로 재인증 시도

