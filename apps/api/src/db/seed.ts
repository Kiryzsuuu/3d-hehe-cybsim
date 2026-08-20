import { createHash } from "node:crypto";
import { prisma } from "./client.js";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

const CTF_FLAG = "CYBERSIM{w3lc0m3_t0_th3_s1mul4t0r}";
// Base64 of the flag, shown to the player as an in-scenario hint they have to decode.
const CTF_FLAG_ENCODED = Buffer.from(CTF_FLAG, "utf8").toString("base64");

function rot13(input: string): string {
  return input.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

const CTF_FLAG_2 = "CYBERSIM{r0t13_1s_n0t_3ncrypt10n}";
const CTF_FLAG_2_ENCODED = rot13(CTF_FLAG_2);

const scenarios = [
  {
    slug: "intro-ping",
    title: "Pengenalan Terminal: Ping",
    level: "beginner",
    description: "Gunakan perintah `ping` untuk memeriksa konektivitas ke server target.",
    data: {
      objectives: [{ id: "obj-1", description: "Jalankan `ping 10.0.0.5`", points: 10 }],
      hints: ["Ketik `help` untuk melihat daftar perintah yang tersedia."],
    },
  },
  {
    slug: "intro-topology",
    title: "Membangun Topologi Pertama",
    level: "beginner",
    description: "Susun router dan switch di Network Topology editor, lalu sambungkan keduanya.",
    data: {
      objectives: [
        { id: "obj-1", description: "Tambahkan 1 router dan 1 switch", points: 10 },
        { id: "obj-2", description: "Sambungkan router ke switch", points: 10 },
        { id: "obj-3", description: "Jalankan Cek Konektivitas dan pastikan hasilnya terhubung", points: 15 },
      ],
      hints: ["Buka halaman Network Topology dari dashboard.", "Tarik garis dari titik bawah node ke titik atas node lain."],
    },
  },
  {
    slug: "recon-whoami",
    title: "Reconnaissance Dasar",
    level: "beginner",
    description: "Kenali environment Anda menggunakan perintah whoami dan ifconfig sebelum memulai misi lanjutan.",
    data: {
      objectives: [
        { id: "obj-1", description: "Jalankan `whoami`", points: 5 },
        { id: "obj-2", description: "Jalankan `ifconfig`", points: 5 },
      ],
      hints: ["Semua perintah terminal ada di whitelist, ketik `help` untuk melihat daftarnya."],
    },
  },
  {
    slug: "ctf-decode-flag",
    title: "CTF: Pesan Terenkode",
    level: "beginner",
    description:
      "Tim intelijen mencegat sebuah pesan base64 dari server target. Dekode pesan itu untuk menemukan flag, lalu submit di bawah.",
    data: {
      objectives: [{ id: "obj-1", description: "Temukan dan submit flag yang benar", points: 25 }],
      hints: [
        `Pesan terenkode (base64): ${CTF_FLAG_ENCODED}`,
        "Gunakan tool decode base64 apa pun (mis. `atob()` di browser console, atau situs decoder online).",
        "Format flag: CYBERSIM{...}",
      ],
      flag: { hash: sha256Hex(CTF_FLAG), points: 25 },
    },
  },
  {
    slug: "terminal-exploration",
    title: "Eksplorasi Terminal Lanjutan",
    level: "beginner",
    description: "Kenali lebih jauh perintah terminal lain: melihat isi direktori, konfigurasi, dan mencoba koneksi ke host lain.",
    data: {
      objectives: [
        { id: "obj-1", description: "Jalankan `ls` untuk melihat isi direktori kerja", points: 5 },
        { id: "obj-2", description: "Jalankan `show running-config`", points: 10 },
        { id: "obj-3", description: "Jalankan `connect 10.0.0.5`", points: 10 },
      ],
      hints: [
        "Semua perintah ini aman untuk dicoba, hanya mensimulasikan output — tidak benar-benar menjalankan apa pun di server.",
        "Ketik `help` kapan saja untuk melihat daftar lengkap perintah.",
      ],
    },
  },
  {
    slug: "topology-firewall-segment",
    title: "Segmentasi Jaringan dengan Firewall",
    level: "intermediate",
    description:
      "Perusahaan ingin memisahkan jaringan server dari jaringan klien menggunakan firewall. Susun topologi router, firewall, switch, dan server, lalu pastikan semuanya terhubung.",
    data: {
      objectives: [
        { id: "obj-1", description: "Tambahkan 1 router, 1 firewall, 1 switch, dan 1 server", points: 15 },
        { id: "obj-2", description: "Sambungkan router ke firewall, firewall ke switch, dan switch ke server", points: 20 },
        { id: "obj-3", description: "Jalankan Cek Konektivitas dari router sampai ke server", points: 20 },
      ],
      hints: [
        "Firewall diletakkan di antara router dan switch supaya semua trafik ke jaringan server harus melewatinya.",
        "Cek Konektivitas menelusuri jalur node demi node — pastikan tidak ada node yang terlewat tersambung.",
      ],
    },
  },
  {
    slug: "dvwa-first-recon",
    title: "Sandbox: Kenalan dengan DVWA",
    level: "intermediate",
    description:
      "DVWA (Damn Vulnerable Web App) adalah target latihan resmi untuk uji SQL Injection, XSS, dan CSRF. Nyalakan DVWA di sandbox pribadimu dan lakukan login pertama.",
    data: {
      objectives: [
        { id: "obj-1", description: "Nyalakan DVWA lewat Dashboard atau Konsol Server (FPV)", points: 10 },
        { id: "obj-2", description: "Buka DVWA di tab baru dan login dengan admin/password", points: 10 },
        { id: "obj-3", description: "Atur DVWA Security Level ke 'low' dari menu setup DVWA", points: 5 },
        { id: "obj-4", description: "Matikan DVWA setelah selesai supaya tidak memakan resource server", points: 5 },
      ],
      hints: [
        "Kredensial default DVWA: username admin, password password.",
        "DVWA berjalan di container Docker terisolasi khusus akunmu, tidak terlihat oleh pemain lain.",
        "Selalu klik tombol Hentikan/Matikan setelah selesai berlatih.",
      ],
    },
  },
  {
    slug: "ctf-rot13-cipher",
    title: "CTF: Sandi Sederhana",
    level: "intermediate",
    description:
      "Sebuah pesan lama ditemukan di log server, disandikan dengan cipher klasik. Pecahkan sandinya untuk menemukan flag.",
    data: {
      objectives: [{ id: "obj-1", description: "Temukan dan submit flag yang benar", points: 30 }],
      hints: [
        `Pesan tersandi: ${CTF_FLAG_2_ENCODED}`,
        "Cipher ini menggeser tiap huruf 13 posisi di alfabet (ROT13) — menggeser lagi 13 posisi akan mengembalikannya ke teks asli.",
        "Coba cari 'ROT13 decoder online' kalau ingin cara cepat.",
        "Format flag: CYBERSIM{...}",
      ],
      flag: { hash: sha256Hex(CTF_FLAG_2), points: 30 },
    },
  },
];

async function main() {
  for (const scenario of scenarios) {
    await prisma.scenario.upsert({
      where: { slug: scenario.slug },
      update: { title: scenario.title, level: scenario.level, description: scenario.description, data: scenario.data },
      create: scenario,
    });
  }
  console.log(`Seed complete: ${scenarios.length} scenarios.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
