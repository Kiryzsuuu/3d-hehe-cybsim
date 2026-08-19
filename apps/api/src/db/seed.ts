import { createHash } from "node:crypto";
import { prisma } from "./client.js";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

const CTF_FLAG = "CYBERSIM{w3lc0m3_t0_th3_s1mul4t0r}";
// Base64 of the flag, shown to the player as an in-scenario hint they have to decode.
const CTF_FLAG_ENCODED = Buffer.from(CTF_FLAG, "utf8").toString("base64");

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
