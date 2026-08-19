import { prisma } from "./client.js";

async function main() {
  await prisma.scenario.upsert({
    where: { slug: "intro-ping" },
    update: {},
    create: {
      slug: "intro-ping",
      title: "Pengenalan Terminal: Ping",
      level: "beginner",
      description: "Gunakan perintah `ping` untuk memeriksa konektivitas ke server target.",
      data: {
        objectives: [{ id: "obj-1", description: "Jalankan `ping 10.0.0.5`", points: 10 }],
        hints: ["Ketik `help` untuk melihat daftar perintah yang tersedia."],
      },
    },
  });
  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
