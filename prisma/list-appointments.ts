
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all appointments...');

  const appointments = await prisma.appointment.findMany({
    include: {
      user: true,
      timeSlot: true,
      service: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`Found ${appointments.length} appointments:`);
  console.log(JSON.stringify(appointments, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
