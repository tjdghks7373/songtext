# Songtext

외국 곡 가사를 한 줄씩 해설하는 서비스. 단순 번역이 아니라 감정·문화·시대 맥락까지 분석.

## 구조

```
apps/api/   - FastAPI 백엔드
apps/web/   - Next.js 프론트엔드
packages/prompts/  - LLM 프롬프트
```

## 로컬 실행

```bash
# 백엔드
cd apps/api && pip install -r requirements.txt
PYTHONPATH=apps/api:. python apps/api/run.py

# 프론트엔드
cd apps/web && npm install && npm run dev
```

## 환경변수

`apps/api/.env` 참조.
