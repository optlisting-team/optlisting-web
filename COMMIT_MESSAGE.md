# Commit Message

```
Fix: Implement 202 Accepted async sync, zero-Korean policy, and direct Railway communication

- Backend: Return 202 Accepted immediately for /api/ebay/listings/sync, execute sync in background
- Frontend: Handle 202 response with 10s timeout, implement single-retry polling logic
- API: Configure apiClient to use Railway URL directly in production (bypass Vercel serverless)
- Code: Remove all Korean comments and user-facing messages from Dashboard.jsx
- Docs: Add FINAL_CLEANUP_REPORT.md and FINAL_AUDIT_REPORT.md

Fixes:
- Vercel 30s timeout issue (202 Accepted + background processing)
- Infinite polling loops (single retry only)
- Production URL consistency (Railway direct connection)
- Encoding issues (zero-Korean policy)
```
