const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  const subs = await prisma.subscription.findMany();
  console.log("ALL SUBSCRIPTIONS IN DB:");
  console.log(JSON.stringify(subs, null, 2));
  await prisma.$disconnect();
}

check();
