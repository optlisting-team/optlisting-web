@echo off
git add -A
git commit -m "fix: correct datetime import, credit_service syntax, and move listing cleanup to run once after full sync (not per-page)"
git push origin develop
