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

Verified end-to-end (real Playwright run: register → login → terminal command → live 2D/3D sync), not just typechecked.

- **Phase 1 (Foundation)**: monorepo, auth (register/login/JWT backed by MongoDB Atlas + bcrypt), Xterm.js terminal over an authenticated WebSocket with a whitelisted command parser, Prisma schema on MongoDB (User/Scenario/Progress), Redis via Docker Compose, and a resource-limited/network-isolated sandbox service skeleton.
- **Phase 2 (partial)**: `/dashboard/network` — a React Flow topology editor (add/connect/delete router, switch, pc, server, firewall nodes) synced live via a zustand store to a lazy-loaded Three.js 3D server rack viewer. Not yet built from Phase 2: Cisco IOS command parser, packet flow animation, physical cable simulator, GNS3/NetworkX-backed reachability checks wired into the UI (the FastAPI/NetworkX skeleton in `packages/network-engine` exists but isn't called yet).
- **Not started**: Phase 3 (scenario/mission system), Phase 4 (DVWA sandbox, blue-team scoring, CTF flags), Phase 5 (leaderboard, achievements, CI/CD).

### Known gap

`apps/api`'s production path (`pnpm build && pnpm start`, i.e. running compiled `dist/index.js` with plain `node`) has not been verified — dev only runs through `tsx`, which resolves the `@cybersim/types`/`@cybersim/cli-parser` workspace packages' raw `.ts` source directly. Plain Node can't do that under `"type": "module"` without a build step for those packages first. Fine for now since only `pnpm dev` has been used; needs a real fix (build `packages/types`/`packages/cli-parser` to JS before `apps/api` build, or switch API's own runtime to `tsx`/`tsx watch` in production too) before deploying.
