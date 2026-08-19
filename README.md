# CyberSim - Network & Cyber Security Simulator

Web-based simulator jaringan dan cybersecurity. Lihat [CLAUDE.md](./CLAUDE.md) untuk panduan lengkap arsitektur dan roadmap.

## Quick start

```bash
npm i -g pnpm
pnpm install
cp .env.example .env   # isi DATABASE_URL (MongoDB Atlas) dan JWT_SECRET (string acak >=32 karakter)
docker-compose up -d    # menyalakan Redis lokal saja, MongoDB pakai Atlas
pnpm --filter @cybersim/api db:generate
pnpm --filter @cybersim/api db:push
pnpm --filter @cybersim/api db:seed
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- Network engine (dibutuhkan untuk fitur "Cek Konektivitas" di Network Topology): `cd packages/network-engine && pip install -r requirements.txt && uvicorn main:app --reload --port 8000`. Pastikan `.env` sudah di-load (butuh `NETWORK_ENGINE_SECRET` yang sama dengan punya `apps/api`)
- Sandbox CLI (dibutuhkan untuk panel "Sandbox" di dashboard): `docker build -t cybersim-sandbox:latest docker/sandbox`
- DVWA (dibutuhkan untuk panel "DVWA Target" di dashboard): `docker pull vulnerables/web-dvwa` (image publik, ditarik otomatis saat container pertama dibuat kalau belum ada secara lokal)

## Status

Diverifikasi end-to-end (Playwright asli: register, login, command terminal, sinkronisasi 2D/3D live, reachability check, scenario flow lengkap), bukan cuma typecheck.

- **Phase 1 (Foundation)**: monorepo, auth (register/login/JWT dengan MongoDB Atlas + bcrypt), terminal Xterm.js lewat WebSocket terautentikasi dengan command parser whitelist, schema Prisma di MongoDB (User/Scenario/Progress), Redis lewat Docker Compose, dan skeleton sandbox service yang resource-limited/network-isolated.
- **Phase 2**: `/dashboard/network`, editor topologi React Flow (tambah/hubungkan/hapus node router, switch, pc, server, firewall) yang tersinkron live via zustand store ke viewer 3D server rack Three.js (lazy-loaded). Kontrol "Cek Konektivitas" mengirim topologi lewat backend ke `network-engine` (FastAPI/NetworkX) untuk reachability check nyata, dan jalur yang ditemukan tampil sebagai edge beranimasi (packet flow). Belum dibangun: Cisco IOS command parser, simulator kabel fisik, integrasi GNS3.
- **Phase 3**: `/dashboard/scenarios` menampilkan daftar misi (4 skenario beginner), `/dashboard/scenarios/[slug]` untuk checklist objective, hint berjenjang, dan penyelesaian misi (skor tersimpan ke Progress). Dashboard menampilkan progress nyata dari MongoDB. Belum dibangun: auto-tracking objective dari aksi user (mis. command terminal atau aksi topologi otomatis mencentang objective), scenario editor/admin panel.
- **Phase 4/5 (partial)**: sistem CTF flag (hash SHA-256 tersimpan di scenario data, verifikasi server-side dengan timing-safe compare, rate limit ketat 10/menit, hash tidak pernah diekspos ke client), `/leaderboard` global yang mengagregasi total skor per user, Docker sandbox manager per-user yang benar-benar jalan (`/api/sandbox/start|stop`, container terisolasi NetworkMode=none + CPU/RAM dibatasi + read-only rootfs, terverifikasi lewat `docker inspect` sungguhan), dan DVWA target per-user (`/api/sandbox/dvwa/start|stop`, container DVWA nyata di network privat per-user, port cuma bind ke 127.0.0.1, terverifikasi bisa diakses browser sungguhan sampai halaman login DVWA). Belum dibangun: firewall configuration simulator, vulnerability scanner simulation, achievement system, CI/CD pipeline.

### Known gap

- Jalur produksi `apps/api` (`pnpm build && pnpm start`, menjalankan `dist/index.js` dengan `node` biasa) belum diverifikasi. Dev selama ini jalan lewat `tsx`, yang me-resolve source `.ts` mentah dari workspace package `@cybersim/types`/`@cybersim/cli-parser` langsung. Node biasa tidak bisa melakukan itu di bawah `"type": "module"` tanpa build step untuk package-package tersebut lebih dulu. Tidak masalah untuk saat ini karena hanya `pnpm dev` yang dipakai, tapi perlu diperbaiki sebelum deploy sungguhan (build `packages/types`/`packages/cli-parser` ke JS dulu sebelum build `apps/api`, atau ganti runtime produksi API ke `tsx`/`tsx watch` juga).
- Container DVWA per-user bisa mengakses internet keluar. Diuji secara empiris: Docker `--internal` pada custom bridge network memang memblokir akses keluar, tapi juga memblokir port publishing ke host, jadi browser tidak bisa akses DVWA sama sekali kalau dipakai. Trade-off yang diambil: `Internal: false` supaya DVWA tetap bisa diakses browser, port cuma di-bind ke `127.0.0.1` (tidak terekspos ke jaringan luar/user lain), dan tiap user punya network privat sendiri (tidak bisa saling menjangkau). Yang TIDAK terblokir: DVWA container itu sendiri bisa mengakses internet. Untuk hardening lebih lanjut, perlu custom iptables egress filter atau proxy pembatas host tujuan, di luar scope sesi ini.
