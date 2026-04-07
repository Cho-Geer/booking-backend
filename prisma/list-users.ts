import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all users...');

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      userType: true,
      status: true,
      email: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`Found ${users.length} users:`);
  console.log('=' .repeat(80));
  
  users.forEach((user, index) => {
    console.log(`User ${index + 1}:`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Phone: ${user.phone}`);
    console.log(`  Role: ${user.userType}`);
    console.log(`  Status: ${user.status}`);
    console.log(`  Email: ${user.email || 'N/A'}`);
    console.log(`  Verified: ${user.isVerified ? 'Yes' : 'No'}`);
    console.log(`  Created: ${new Date(user.createdAt).toLocaleString()}`);
    console.log(`  Updated: ${new Date(user.updatedAt).toLocaleString()}`);
    console.log('-' .repeat(80));
  });
  
  console.log(`Total users: ${users.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
