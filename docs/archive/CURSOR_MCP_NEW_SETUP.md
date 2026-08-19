# Cursor Supabase MCP 새 연결 가이드

## 새로운 Supabase MCP 방식

Supabase MCP가 업데이트되어 이제 **Remote MCP 서버**를 사용합니다:
- ✅ Personal Access Token (PAT) 불필요
- ✅ 브라우저 기반 OAuth 인증
- ✅ 프로젝트 스코핑 지원
- ✅ Read-only 모드 옵션

## 설정 방법

### Step 1: Cursor MCP 설정 파일 업데이트

`.cursor/mcp.json` 파일을 다음 내용으로 업데이트:

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=hjbmoncohuuwnywrpwpi"
    }
  }
}
```

**프로젝트 스코핑:**
- `project_ref=hjbmoncohuuwnywrpwpi` 파라미터로 특정 프로젝트만 접근
- 프로젝트 ID를 제거하면 모든 프로젝트 접근 가능

### Step 2: Cursor에서 인증

1. **Cursor 재시작**
   - Cursor를 완전히 종료하고 재시작

2. **자동 인증**
   - Cursor가 Supabase MCP를 사용할 때 자동으로 브라우저 창이 열림
   - Supabase 계정으로 로그인
   - **조직 접근 권한 허용** (필요 시)

3. **프로젝트 확인**
   - `hjbmoncohuuwnywrpwpi` 프로젝트에 접근 가능한지 확인

### Step 3: Read-only 모드 (선택사항)

프로덕션 데이터 보호를 위해 Read-only 모드 사용:

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=hjbmoncohuuwnywrpwpi&read_only=true"
    }
  }
}
```

## 설정 옵션

### 프로젝트 스코핑
```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=hjbmoncohuuwnywrpwpi"
    }
  }
}
```

### 모든 프로젝트 접근
```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp"
    }
  }
}
```

### Read-only 모드
```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=hjbmoncohuuwnywrpwpi&read_only=true"
    }
  }
}
```

## 인증 확인

Cursor에서 다음 명령으로 확인:
- "List Supabase projects"
- "Get Supabase project details for hjbmoncohuuwnywrpwpi"
- "List tables in hjbmoncohuuwnywrpwpi"

## 보안 권장사항

### ⚠️ 중요 보안 사항

1. **프로덕션 데이터 연결 금지**
   - MCP는 개발/테스트용으로만 사용
   - 프로덕션 데이터에는 절대 연결하지 마세요

2. **프로젝트 스코핑 사용**
   - 특정 프로젝트만 접근하도록 제한
   - `project_ref` 파라미터 사용

3. **Read-only 모드 사용**
   - 실수로 데이터를 변경하는 것을 방지
   - `read_only=true` 파라미터 사용

4. **수동 승인 활성화**
   - Cursor에서 모든 MCP 도구 호출을 수동으로 승인
   - Settings → MCP → Manual Approval 활성화

5. **브랜칭 사용**
   - Supabase 브랜칭 기능으로 개발 브랜치 생성
   - 프로덕션과 분리된 환경에서 테스트

## 문제 해결

### 인증 실패 시
1. Cursor 재시작
2. 브라우저에서 Supabase 로그인 확인
3. 조직 권한 확인

### 프로젝트 접근 불가 시
1. 프로젝트 ID 확인: `hjbmoncohuuwnywrpwpi`
2. MCP 설정의 `project_ref` 파라미터 확인
3. Supabase 대시보드에서 프로젝트 상태 확인

### 권한 오류 시
1. Supabase 조직 설정 확인
2. MCP 접근 권한 확인
3. 프로젝트 소유자 권한 확인

## 참고 문서

- [Supabase MCP 공식 문서](https://supabase.com/docs/guides/getting-started/mcp)
- [Cursor MCP 설정](https://docs.cursor.com/features/model-context-protocol)

