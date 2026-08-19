# CyberSim — Network & Cyber Security Simulator

Web-based simulator jaringan dan cybersecurity. Lihat [CLAUDE.md](./CLAUDE.md) untuk panduan lengkap arsitektur dan roadmap.

## Quick start

```bash
npm i -g pnpm
pnpm install
cp .env.example .env   # isi DATABASE_URL (MongoDB Atlas) dan JWT_SECRET (string acak >=32 karakter)
docker-compose up -d    # menyalakan Redis lokal saja — MongoDB pakai Atlas
pnpm --filter @cybersim/api db:generate
pnpm --filter @cybersim/api db:push
pnpm --filter @cybersim/api db:seed
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- Network engine (opsional, Fase 2+): `cd packages/network-engine && pip install -r requirements.txt && uvicorn main:app --reload --port 8000`

## Status

Phase 1 (Foundation) built and verified end-to-end: monorepo, auth (register/login/JWT backed by MongoDB Atlas + bcrypt), Xterm.js terminal over an authenticated WebSocket with a whitelisted command parser, Prisma schema on MongoDB (User/Scenario/Progress), Redis via Docker Compose, and a resource-limited/network-isolated sandbox service skeleton. Phases 2–5 (network topology editor, 3D viewer, scenario engine, DVWA sandbox, leaderboard) are not yet built.
