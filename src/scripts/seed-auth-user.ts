import { hashPassword } from "../lib/password";
import { prisma } from "../lib/prisma";

const email = "oscar.a.castro818@gmail.com";
const password = "CodexIsAwesome123";
const companyName = "Castro Home Services";

async function main() {
  await prisma.user.upsert({
    where: {
      email,
    },
    update: {
      name: "Oscar Castro",
      companyName,
      companyEmail: email,
      admin: true,
      passwordHash: hashPassword(password),
    },
    create: {
      name: "Oscar Castro",
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
