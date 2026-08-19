# CyberSim - Network & Cyber Security Simulator

Web-based simulator jaringan dan cybersecurity. Lihat [CLAUDE.md](./CLAUDE.md) untuk panduan lengkap arsitektur dan roadmap.

## Quick start

```bash
npm i -g pnpm
pnpm install   # otomatis build packages/types & packages/cli-parser lewat postinstall
cp .env.example .env   # isi DATABASE_URL (MongoDB Atlas) dan JWT_SECRET (string acak >=32 karakter)
docker-compose up -d    # menyalakan Redis lokal saja, MongoDB pakai Atlas
pnpm --filter @cybersim/api db:generate
pnpm --filter @cybersim/api db:push
pnpm --filter @cybersim/api db:seed
pnpm dev
```

Daftar akun baru di http://localhost:3000/register lalu mulai main dari dashboard.

- Web: http://localhost:3000
- API: http://localhost:3001
- Network engine (dibutuhkan untuk fitur "Cek Konektivitas" di Network Topology): `cd packages/network-engine && pip install -r requirements.txt && uvicorn main:app --reload --port 8000`. Pastikan `.env` sudah di-load (butuh `NETWORK_ENGINE_SECRET` yang sama dengan punya `apps/api`)
- Sandbox CLI (dibutuhkan untuk panel "Sandbox" di dashboard): `docker build -t cybersim-sandbox:latest docker/sandbox`
- DVWA (dibutuhkan untuk panel "DVWA Target" di dashboard): `docker pull vulnerables/web-dvwa` (image publik, ditarik otomatis saat container pertama dibuat kalau belum ada secara lokal)
- Akun admin: isi `ADMIN_EMAIL`/`ADMIN_USERNAME`/`ADMIN_PASSWORD` di `.env`, lalu `pnpm --filter @cybersim/api db:seed-admin` (idempotent, bisa dijalankan ulang untuk update password/role akun yang sama)

## Status

Diverifikasi end-to-end dengan playtest Playwright penuh yang menirukan sesi pemain sungguhan: guard redirect saat belum login, register, command terminal, selesaikan misi (checklist + layar "Misi Selesai!"), submit flag CTF, topologi jaringan 2D/3D live + reachability check + packet flow animation, leaderboard dengan baris sendiri ter-highlight, mulai sandbox Docker, mulai DVWA (container nyata, dites sampai halaman login DVWA lewat HTTP), logout, dan guard redirect lagi. 0 error console di sepanjang alur. Bukan cuma typecheck.

- **Phase 1 (Foundation)**: monorepo, auth (register/login/JWT dengan MongoDB Atlas + bcrypt), terminal Xterm.js lewat WebSocket terautentikasi dengan command parser whitelist, schema Prisma di MongoDB (User/Scenario/Progress), Redis lewat Docker Compose, dan sandbox service yang resource-limited/network-isolated.
- **Phase 2**: `/dashboard/network`, editor topologi React Flow (tambah/hubungkan/hapus node router, switch, pc, server, firewall) yang tersinkron live via zustand store ke viewer 3D server rack Three.js (lazy-loaded). Kontrol "Cek Konektivitas" mengirim topologi lewat backend ke `network-engine` (FastAPI/NetworkX) untuk reachability check nyata, dan jalur yang ditemukan tampil sebagai edge beranimasi (packet flow). Belum dibangun: Cisco IOS command parser, simulator kabel fisik, integrasi GNS3.
- **Phase 3**: `/dashboard/scenarios` menampilkan daftar misi (4 skenario beginner) dengan badge "Selesai" untuk yang sudah dikerjakan, `/dashboard/scenarios/[slug]` untuk checklist objective, hint berjenjang, submit flag (khusus skenario CTF), dan layar penyelesaian misi. Dashboard menampilkan progress nyata dari MongoDB. Belum dibangun: auto-tracking objective dari aksi user (mis. command terminal atau aksi topologi otomatis mencentang objective tanpa perlu dicentang manual), scenario editor/admin panel.
- **Phase 4/5**: sistem CTF flag (hash SHA-256 tersimpan di scenario data, verifikasi server-side dengan timing-safe compare, rate limit ketat 10/menit, hash tidak pernah diekspos ke client), `/leaderboard` global yang mengagregasi total skor per user (dengan highlight baris sendiri), Docker sandbox manager per-user yang benar-benar jalan (`/api/sandbox/start|stop`, container terisolasi NetworkMode=none + CPU/RAM dibatasi + read-only rootfs, terverifikasi lewat `docker inspect` sungguhan), dan DVWA target per-user (`/api/sandbox/dvwa/start|stop`, container DVWA nyata di network privat per-user, port cuma bind ke 127.0.0.1, terverifikasi bisa diakses browser sungguhan sampai halaman login DVWA). Belum dibangun: firewall configuration simulator, vulnerability scanner simulation, achievement system, CI/CD pipeline.
- **UX/polish**: auth guard di semua halaman terproteksi (redirect ke `/login` kalau belum login, sudah dites dengan request nyata), header navigasi konsisten dengan tab aktif + logout, landing page mendeteksi sesi yang sudah login, badge status skenario, leaderboard dengan medali dan highlight diri sendiri.
- **Profil & Admin**: `/dashboard/profile` menampilkan statistik (total skor, misi selesai, sedang berjalan, flag ditangkap, peringkat) dan riwayat/checkpoint tiap skenario. Sistem role (`user`/`admin`) tersimpan di User model dan JWT; `/dashboard/admin` (khusus admin, guard di frontend + `403` sungguhan di backend kalau dipaksa akses) menampilkan statistik platform dan tabel semua user dengan tombol toggle role. Akun admin dibuat lewat script `db:seed-admin` yang baca kredensial dari env (bukan hardcoded di source), diverifikasi login sungguhan lewat browser.
- **Chat**: World Chat (semua user), Direct Message (cari lewat username), dan Grup dengan sistem invite (undang lewat username, penerima harus accept dulu sebelum bisa lihat isi grup). Real-time lewat WebSocket (`/ws/chat`), riwayat pesan tersimpan di MongoDB. Diverifikasi dengan 2 browser context terpisah: pesan World Chat dan DM muncul live di sisi penerima, undangan grup muncul dan bisa di-accept, semua 0 error.
- **Room Multiplayer**: mode solo (default, sudah ada sejak awal) tetap berjalan seperti biasa. Mode co-op baru: `/dashboard/rooms` untuk buat room (generate kode 6 karakter) atau join pakai kode, `/dashboard/rooms/[code]` untuk kerja bareng — tiap objective skenario bisa "diklaim" satu pemain (supaya kerjaan terbagi, tidak dobel), status klaim/selesai tersinkron real-time ke semua pemain di room lewat WebSocket (`/ws/room`) tanpa perlu refresh. Diverifikasi dengan 2 browser context: pemain B melihat klaim dan penyelesaian objective pemain A secara live.

### Kredensial admin

Akun admin dibuat lewat `pnpm --filter @cybersim/api db:seed-admin` yang membaca `ADMIN_EMAIL`/`ADMIN_USERNAME`/`ADMIN_PASSWORD` dari `.env` lokal (gitignored, tidak pernah masuk ke git history). Password minimal 6 karakter (diturunkan dari 8 atas permintaan eksplisit saat setup akun admin pertama).

### Known gap

Container DVWA per-user bisa mengakses internet keluar. Diuji secara empiris: Docker `--internal` pada custom bridge network memang memblokir akses keluar, tapi juga memblokir port publishing ke host, jadi browser tidak bisa akses DVWA sama sekali kalau dipakai. Trade-off yang diambil: `Internal: false` supaya DVWA tetap bisa diakses browser, port cuma di-bind ke `127.0.0.1` (tidak terekspos ke jaringan luar/user lain), dan tiap user punya network privat sendiri (tidak bisa saling menjangkau). Yang TIDAK terblokir: DVWA container itu sendiri bisa mengakses internet. Untuk hardening lebih lanjut, perlu custom iptables egress filter atau proxy pembatas host tujuan, di luar scope sesi ini.

Sandbox dan DVWA container tidak auto-dibersihkan kalau user menutup tab tanpa klik "Hentikan" (bisa jadi resource leak di host kalau dipakai banyak orang tanpa reaper/cron pembersih). Cukup aman untuk pemakaian personal/demo, tapi perlu job pembersih terjadwal sebelum dipakai multi-user produksi sungguhan.
