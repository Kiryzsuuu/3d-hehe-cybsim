# 🛡️ Network & Cyber Security Simulator — Project Guide for Claude Code

> Panduan lengkap untuk membangun web-based Network & Cyber Security Simulator,
> mirip game di Steam, menggunakan Claude Code di VSCode.

---

## 📋 Daftar Isi

1. [Gambaran Proyek](#gambaran-proyek)
2. [Software & Tools yang Dibutuhkan](#software--tools-yang-dibutuhkan)
3. [Arsitektur Sistem](#arsitektur-sistem)
4. [Struktur Folder](#struktur-folder)
5. [Tech Stack](#tech-stack)
6. [Fase Development](#fase-development)
7. [Instruksi untuk Claude Code](#instruksi-untuk-claude-code)
8. [Environment Variables](#environment-variables)
9. [Perintah Penting](#perintah-penting)

---

## Gambaran Proyek

Simulator berbasis web yang menggabungkan:

- **Network Simulation** — Topologi jaringan interaktif, konfigurasi switch/router via CLI
- **Cybersecurity Education** — Skenario exploit (SQLi, XSS, dll) + Blue Team defense
- **CTF-style Challenges** — Misi berjenjang dengan scoring system
- **3D Visualization** — Server rack, kabel fisik, perangkat jaringan yang bisa diklik
- **Interactive Terminal** — CLI realistis berbasis browser (Cisco IOS-like & Bash)

---

## Software & Tools yang Dibutuhkan

### 🖥️ Wajib Install di Lokal

| Software | Versi | Kegunaan | Link |
|----------|-------|----------|------|
| **Node.js** | v20 LTS | Runtime backend & frontend tooling | https://nodejs.org |
| **pnpm** | latest | Package manager (lebih cepat dari npm) | `npm i -g pnpm` |
| **Docker Desktop** | latest | Sandbox isolasi tiap user (KRITIS untuk keamanan) | https://docker.com |
| **Git** | latest | Version control | https://git-scm.com |
| **VSCode** | latest | Editor utama | https://code.visualstudio.com |
| **Python** | v3.11+ | Network simulation engine & scripting | https://python.org |

### 🔌 VSCode Extensions (Wajib)

```
ext install dbaeumer.vscode-eslint
ext install esbenp.prettier-vscode
ext install bradlc.vscode-tailwindcss
ext install ms-vscode.vscode-typescript-next
ext install ms-python.python
ext install ms-azuretools.vscode-docker
ext install GraphQL.vscode-graphql-syntax
ext install formulahendry.auto-rename-tag
ext install christian-kohler.path-intellisense
```

### 🛢️ Database & Infrastructure

| Software | Versi | Kegunaan |
|----------|-------|----------|
| **PostgreSQL** | v16 | Database utama (user, progress, scenario) |
| **Redis** | v7 | Session, real-time state, queue |
| **Nginx** | latest | Reverse proxy & WebSocket support |

> ✅ PostgreSQL + Redis bisa dijalankan via Docker Compose — tidak perlu install manual.

### 🌐 Simulasi Jaringan (Pilih Salah Satu)

| Opsi | Keterangan | Rekomendasi |
|------|-----------|-------------|
| **GNS3** | Simulator jaringan paling realistis, ada REST API | Untuk production |
| **EVE-NG** | Alternative GNS3, lebih enterprise | Untuk production |
| **Custom Engine** | Graph-based simulation pakai Python/NetworkX | Untuk MVP/dev awal |

> 🚀 **Rekomendasi awal**: Gunakan custom engine dulu untuk MVP, lalu integrasikan GNS3 di fase lanjut.

### 🔒 Cybersecurity Sandbox Tools

| Tool | Kegunaan |
|------|----------|
| **DVWA** (Damn Vulnerable Web App) | Target latihan SQLi, XSS, CSRF |
| **WebGoat** | Platform latihan OWASP |
| **Metasploitable** | VM vulnerable untuk advanced scenario |
| **OpenVAS / Greenbone** | Vulnerability scanning simulation |

> Semua tools ini dijalankan dalam **Docker container terisolasi** per user session.

---

## Arsitektur Sistem

```
┌─────────────────────────────────────────────────────┐
│                    USER BROWSER                      │
│  React + Three.js + Xterm.js + React Flow           │
└──────────────────┬──────────────────────────────────┘
                   │ HTTPS / WSS
┌──────────────────▼──────────────────────────────────┐
│                  NGINX (Reverse Proxy)               │
└──────┬─────────────────────────────┬────────────────┘
       │ HTTP                        │ WebSocket
┌──────▼──────────┐       ┌──────────▼──────────────┐
│  Next.js API    │       │  WebSocket Server        │
│  (REST API)     │       │  (Terminal + Events)     │
└──────┬──────────┘       └──────────┬───────────────┘
       │                             │
┌──────▼─────────────────────────────▼───────────────┐
│              Backend Services (Node.js)             │
│  - Auth Service    - Scenario Engine               │
│  - Progress Track  - Network Simulator             │
│  - CTF Scoring     - Sandbox Manager               │
└──────┬──────────────────────────┬──────────────────┘
       │                          │
┌──────▼──────┐          ┌────────▼────────┐
│ PostgreSQL  │          │  Docker Engine  │
│   + Redis   │          │ (User Sandboxes)│
└─────────────┘          └────────┬────────┘
                                  │
                    ┌─────────────▼──────────┐
                    │  Isolated Containers   │
                    │  - DVWA per user       │
                    │  - Custom CLI env      │
                    │  - Network namespace   │
                    └────────────────────────┘
```

---

## Struktur Folder

```
cyber-simulator/
├── CLAUDE.md                    ← File ini (baca pertama kali!)
├── docker-compose.yml           ← PostgreSQL, Redis, DVWA
├── docker-compose.prod.yml      ← Production setup
├── .env.example                 ← Template environment variables
│
├── apps/
│   ├── web/                     ← Frontend (Next.js 14 App Router)
│   │   ├── src/
│   │   │   ├── app/             ← Next.js App Router pages
│   │   │   ├── components/
│   │   │   │   ├── terminal/    ← Xterm.js terminal component
│   │   │   │   ├── network/     ← React Flow topology editor
│   │   │   │   ├── 3d/          ← Three.js server rack viewer
│   │   │   │   ├── ctf/         ← CTF challenge UI
│   │   │   │   └── ui/          ← Shadcn/ui components
│   │   │   ├── hooks/           ← Custom React hooks
│   │   │   ├── lib/             ← Utilities & API clients
│   │   │   └── stores/          ← Zustand state management
│   │   ├── public/
│   │   │   └── models/          ← 3D model assets (GLTF/GLB)
│   │   └── package.json
│   │
│   └── api/                     ← Backend (Node.js + Fastify)
│       ├── src/
│       │   ├── routes/          ← API endpoints
│       │   ├── services/
│       │   │   ├── auth/        ← Auth & session management
│       │   │   ├── network/     ← Network simulation engine
│       │   │   ├── sandbox/     ← Docker sandbox manager
│       │   │   ├── scenario/    ← Mission & scenario system
│       │   │   └── ctf/         ← CTF scoring engine
│       │   ├── websocket/       ← WebSocket handlers (terminal)
│       │   ├── db/              ← Prisma schema & migrations
│       │   └── utils/
│       └── package.json
│
├── packages/
│   ├── network-engine/          ← Shared network simulation logic (Python/JS)
│   ├── cli-parser/              ← Cisco IOS + Linux command parser
│   └── types/                   ← Shared TypeScript types
│
├── scenarios/                   ← JSON/YAML skenario misi
│   ├── beginner/
│   ├── intermediate/
│   └── advanced/
│
├── docker/
│   ├── sandbox/                 ← Dockerfile untuk user sandbox
│   └── dvwa/                    ← DVWA container config
│
└── scripts/
    ├── setup.sh                 ← Setup otomatis environment
    ├── seed-scenarios.ts        ← Seed database dengan skenario
    └── create-sandbox.sh        ← Script buat Docker sandbox
```

---

## Tech Stack

### Frontend (`apps/web`)

```json
{
  "dependencies": {
    "next": "14.x",
    "react": "18.x",
    "three": "^0.165.0",
    "@react-three/fiber": "^8.x",
    "@react-three/drei": "^9.x",
    "reactflow": "^11.x",
    "xterm": "^5.x",
    "xterm-addon-fit": "^0.8.x",
    "xterm-addon-web-links": "^0.9.x",
    "zustand": "^4.x",
    "socket.io-client": "^4.x",
    "@tanstack/react-query": "^5.x",
    "tailwindcss": "^3.x",
    "framer-motion": "^11.x",
    "shadcn-ui": "latest"
  }
}
```

### Backend (`apps/api`)

```json
{
  "dependencies": {
    "fastify": "^4.x",
    "@fastify/websocket": "^8.x",
    "@fastify/cors": "^9.x",
    "@fastify/jwt": "^8.x",
    "prisma": "^5.x",
    "@prisma/client": "^5.x",
    "redis": "^4.x",
    "dockerode": "^4.x",
    "socket.io": "^4.x",
    "bcrypt": "^5.x",
    "zod": "^3.x"
  }
}
```

### Network Engine (`packages/network-engine`)

```
Python:
- networkx          ← Graph-based network simulation
- scapy             ← Packet manipulation & simulation
- flask / fastapi   ← REST API untuk network engine
- paramiko          ← SSH simulation
```

---

## Fase Development

### Phase 1 — Foundation (2–4 minggu)
**Target: Terminal CLI + Auth + Basic UI**

```
[ ] Setup monorepo dengan pnpm workspaces
[ ] Setup Docker Compose (PostgreSQL + Redis)
[ ] Auth system (register/login/JWT)
[ ] Xterm.js terminal component di browser
[ ] WebSocket connection terminal ↔ server
[ ] Basic command parser (ping, ls, help)
[ ] Landing page + dashboard UI
```

### Phase 2 — Network Visualization (4–6 minggu)
**Target: Topologi jaringan interaktif + 3D viewer**

```
[ ] React Flow network topology editor
[ ] Node types: Router, Switch, PC, Server, Firewall
[ ] Three.js server rack 3D viewer
[ ] Network simulation engine (Python/NetworkX)
[ ] Cisco IOS command parser (interface, ip address, show)
[ ] Packet flow visualization (animasi data packet)
[ ] Physical connection simulator (kabel RJ45)
```

### Phase 3 — Scenario & Mission System (3–4 minggu)
**Target: Misi berjenjang dengan objective & scoring**

```
[ ] Scenario schema (JSON/YAML based)
[ ] Mission loader & validator
[ ] Objective tracking system
[ ] Hint system (tiered hints)
[ ] Progress save & resume
[ ] Scenario editor (admin panel)
[ ] 10 skenario dasar (beginner)
```

### Phase 4 — Cybersecurity Sandbox (4–6 minggu)
**Target: Vulnerable apps + Blue Team challenges**

```
[ ] Docker sandbox manager (isolasi per user)
[ ] DVWA integration (SQL Injection, XSS, CSRF)
[ ] Firewall configuration simulator
[ ] Vulnerability scanner simulation
[ ] Security patch system
[ ] Blue team scoring (patch = poin)
[ ] Network sniffing simulation
[ ] CTF flag system
```

### Phase 5 — Polish & Launch (2–3 minggu)
**Target: Production-ready**

```
[ ] Leaderboard global
[ ] User profile & achievement system
[ ] Onboarding tutorial interaktif
[ ] Performance optimization (lazy load 3D assets)
[ ] Security audit (OWASP checklist)
[ ] Docker production setup
[ ] CI/CD pipeline (GitHub Actions)
```

---

## Instruksi untuk Claude Code

> Gunakan instruksi ini saat membuka proyek di Claude Code (VSCode)

```
Kamu adalah AI assistant untuk proyek Network & Cyber Security Simulator.

KONTEKS PROYEK:
- Web-based simulator jaringan dan cybersecurity mirip game di Steam
- Monorepo: Next.js 14 (frontend) + Fastify (backend) + Python (network engine)
- Menggunakan Docker untuk isolasi sandbox user

ATURAN CODING:
1. Selalu gunakan TypeScript (strict mode)
2. Gunakan Zod untuk validasi input/output API
3. Setiap Docker container user harus punya resource limit (CPU + RAM)
4. Jangan pernah expose Docker socket langsung ke frontend
5. Semua command user di terminal harus divalidasi whitelist sebelum dieksekusi
6. Gunakan Prisma untuk semua operasi database, jangan raw SQL
7. WebSocket harus punya authentication middleware
8. Komponen React harus lazy-loaded jika > 50KB (terutama Three.js)

SECURITY RULES (KRITIS):
- Input sanitasi wajib sebelum masuk ke network engine
- Sandbox container tidak boleh akses network host
- Rate limiting wajib di semua endpoint
- File upload tidak diperbolehkan di fase MVP

FOLDER CONVENTIONS:
- Komponen UI: apps/web/src/components/ui/
- Business logic: apps/web/src/hooks/ atau apps/api/src/services/
- Types: packages/types/src/
- Skenario baru: scenarios/{level}/nama-scenario.yaml

SAAT MEMBUAT FITUR BARU:
1. Tanya dulu apakah ada type yang perlu ditambah di packages/types
2. Buat service di backend dulu, baru komponen frontend
3. Selalu tambahkan error handling & loading state
4. Test dengan scenario paling simpel dulu
```

---

## Environment Variables

Buat file `.env` di root dan di masing-masing app:

```bash
# Root .env
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/cybersim"
REDIS_URL="redis://localhost:6379"

# Auth
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
JWT_EXPIRES_IN="7d"

# Docker
DOCKER_HOST="unix:///var/run/docker.sock"
SANDBOX_IMAGE="cybersim-sandbox:latest"
SANDBOX_CPU_LIMIT="0.5"       # 50% 1 core
SANDBOX_MEMORY_LIMIT="256m"   # 256 MB per user

# Network Engine
NETWORK_ENGINE_URL="http://localhost:8000"
NETWORK_ENGINE_SECRET="internal-secret-key"

# Frontend
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_WS_URL="ws://localhost:3001"

# Optional: GNS3 (fase lanjut)
GNS3_HOST="localhost"
GNS3_PORT="3080"
GNS3_USER="admin"
GNS3_PASSWORD=""
```

---

## Perintah Penting

### Setup Awal

```bash
# Clone & install dependencies
git clone <repo-url> cyber-simulator
cd cyber-simulator
pnpm install

# Setup database & services
docker-compose up -d

# Setup database schema
pnpm --filter api db:push
pnpm --filter api db:seed

# Jalankan semua service
pnpm dev
```

### Development

```bash
# Jalankan frontend saja
pnpm --filter web dev

# Jalankan backend saja
pnpm --filter api dev

# Jalankan network engine (Python)
cd packages/network-engine
python -m uvicorn main:app --reload --port 8000

# Lihat log Docker sandbox
docker logs cybersim-sandbox-<user-id>

# Reset sandbox semua user
docker rm -f $(docker ps -q --filter "name=cybersim-sandbox")
```

### Database

```bash
# Generate Prisma client setelah ubah schema
pnpm --filter api db:generate

# Buat migration baru
pnpm --filter api db:migrate

# Buka Prisma Studio (GUI database)
pnpm --filter api db:studio
```

### Build Production

```bash
# Build semua
pnpm build

# Jalankan production
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🗺️ Roadmap Visual

```
MVP (Bulan 1-2)          Beta (Bulan 3-4)         Production (Bulan 5-6)
─────────────────        ─────────────────         ──────────────────────
✅ Auth System            ✅ Network 3D Viewer       ✅ Leaderboard
✅ Terminal CLI           ✅ Packet Animation        ✅ Achievement System
✅ Basic Commands         ✅ DVWA Sandbox            ✅ 30+ Scenarios
✅ Network Topology       ✅ Blue Team Mode          ✅ CI/CD Pipeline
✅ 5 Basic Scenarios      ✅ CTF Scoring             ✅ Production Deploy
```

---

## ⚠️ Hal yang Harus Diperhatikan

1. **Docker wajib jalan** sebelum start development — sandbox tidak bisa berfungsi tanpa Docker
2. **Python environment** harus punya `networkx`, `scapy`, `fastapi` terinstall
3. **Port yang digunakan**: `3000` (frontend), `3001` (backend), `8000` (network engine), `5432` (postgres), `6379` (redis)
4. **Jangan commit** file `.env` ke Git — gunakan `.env.example` saja
5. **Resource limit** Docker sandbox wajib diset — tanpa limit, 1 user bisa crash server

---

*Generated for Claude Code — Network & Cyber Security Simulator Project*
