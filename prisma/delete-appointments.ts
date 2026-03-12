
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start deleting all appointments...');
  
  // Delete all appointments
  // Due to cascade delete settings in schema.prisma, this should also delete related AppointmentHistory and Notification records
  const result = await prisma.appointment.deleteMany({});
  
  console.log(`Deleted ${result.count} appointments.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
