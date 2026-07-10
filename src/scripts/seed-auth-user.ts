import { hashPassword } from "../lib/password";
import { prisma } from "../lib/prisma";

const email = process.env.SEED_AUTH_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_AUTH_PASSWORD;
const companyName = process.env.SEED_COMPANY_NAME?.trim() || "BluePeak Service & Supply";
const ownerName = process.env.SEED_OWNER_NAME?.trim() || "Demo Workspace Owner";

async function main() {
  if (!email || !password) {
    throw new Error("Set SEED_AUTH_EMAIL and SEED_AUTH_PASSWORD before seeding an auth user.");
  }
  await prisma.user.upsert({
    where: {
      email,
    },
    update: {
      name: ownerName,
      companyName,
      companyEmail: email,
      admin: true,
      passwordHash: hashPassword(password),
    },
    create: {
      name: ownerName,
      companyName,
      companyEmail: email,
      email,
      admin: true,
      passwordHash: hashPassword(password),
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
