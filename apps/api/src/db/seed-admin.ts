import bcrypt from "bcrypt";
import { prisma } from "./client.js";

// Reads credentials from env vars instead of hardcoding them here, so a
// plaintext admin password never ends up committed to git history. Set
// ADMIN_EMAIL / ADMIN_USERNAME / ADMIN_PASSWORD in your local .env (which is
// gitignored) before running `pnpm db:seed-admin`.
const email = process.env.ADMIN_EMAIL;
const username = process.env.ADMIN_USERNAME ?? "admin";
const password = process.env.ADMIN_PASSWORD;

async function main() {
  if (!email || !password) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before running this script.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "admin", passwordHash },
    create: { email, username, passwordHash, role: "admin" },
  });

  console.log(`Admin ready: ${user.email} (username: ${user.username}, role: ${user.role})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
