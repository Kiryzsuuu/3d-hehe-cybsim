# CyberSim — Network & Cyber Security Simulator

Web-based simulator jaringan dan cybersecurity. Lihat [CLAUDE.md](./CLAUDE.md) untuk panduan lengkap arsitektur dan roadmap.

## Quick start

```bash
npm i -g pnpm
pnpm install
cp .env.example .env   # isi JWT_SECRET dengan string acak >=32 karakter
docker-compose up -d
pnpm --filter @cybersim/api db:generate
pnpm --filter @cybersim/api db:push
pnpm --filter @cybersim/api db:seed
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- Network engine (opsional, Fase 2+): `cd packages/network-engine && pip install -r requirements.txt && uvicorn main:app --reload --port 8000`

## Status

Phase 1 (Foundation) scaffolded: monorepo, auth (register/login/JWT), Xterm.js terminal over authenticated WebSocket with a whitelisted command parser, Prisma schema (User/Scenario/Progress), Docker Compose for Postgres+Redis, and a resource-limited/network-isolated sandbox service skeleton. Phases 2–5 (network topology editor, 3D viewer, scenario engine, DVWA sandbox, leaderboard) are not yet built.
