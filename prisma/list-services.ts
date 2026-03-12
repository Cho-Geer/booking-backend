
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all services...');

  const services = await prisma.service.findMany({
    include: {
      category: true,
    },
    orderBy: {
      displayOrder: 'asc',
    },
  });

  console.log(`Found ${services.length} services:`);
  console.log(JSON.stringify(services, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
