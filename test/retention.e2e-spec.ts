import { INestApplicationContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentStatus, UserStatus } from '@prisma/client';
import { RetentionModule } from '../src/modules/retention/retention.module';
import { RetentionService } from '../src/modules/retention/retention.service';
import { UserType } from '../src/modules/users/dto/user.dto';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { PrismaModule } from '../src/modules/prisma/prisma.module';

describe('RetentionService (e2e)', () => {
  let app: INestApplicationContext;
  let prismaService: PrismaService;
  let retentionService: RetentionService;
  let testUserId: string;
  let testTimeSlotId: string;
  let seq = 0;

  const createNumber = () => {
    seq += 1;
    return `RT${Date.now().toString().slice(-8)}${seq.toString().padStart(3, '0')}`;
  };

  beforeAll(async () => {
    process.env.RETENTION_DAYS = '30';
    process.env.RETENTION_BATCH_SIZE = '2';
    process.env.RETENTION_BATCH_SLEEP_MS = '0';
    process.env.RETENTION_DRY_RUN = 'false';
    process.env.RETENTION_ENABLED = 'true';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, RetentionModule],
    }).compile();

    app = moduleFixture;

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    retentionService = moduleFixture.get<RetentionService>(RetentionService);

    const user = await prismaService.user.create({
      data: {
        name: 'Retention User',
        phone: `1390000${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
        phoneHash: `hash_${Date.now()}`,
        userType: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
      },
    });
    testUserId = user.id;

    const slot = await prismaService.timeSlot.create({
      data: {
        slotTime: `08:${Math.floor(Math.random() * 50)
          .toString()
          .padStart(2, '0')}:00`,
        durationMinutes: 30,
        isActive: true,
        displayOrder: 999,
      },
    });
    testTimeSlotId = slot.id;
  });

  afterAll(async () => {
    await prismaService.appointmentHistory.deleteMany();
    await prismaService.notification.deleteMany();
    await prismaService.appointment.deleteMany();
    await prismaService.timeSlot.deleteMany({ where: { id: testTimeSlotId } });
    await prismaService.user.deleteMany({ where: { id: testUserId } });
    await app.close();
  });

  it('deletes only cancelled/completed appointments older than 30 days with cascade', async () => {
    await prismaService.appointmentHistory.deleteMany();
    await prismaService.notification.deleteMany();
    await prismaService.appointment.deleteMany();

    const now = new Date();
    const oldDate = new Date(now);
    oldDate.setDate(oldDate.getDate() - 40);
    const recentDate = new Date(now);
    recentDate.setDate(recentDate.getDate() - 10);
    const appointmentDate = new Date(now);
    const pendingAppointmentDate = new Date(now);
    pendingAppointmentDate.setDate(pendingAppointmentDate.getDate() + 1);

    const cancelledOld = await prismaService.appointment.create({
      data: {
        appointmentNumber: createNumber(),
        userId: testUserId,
        appointmentDate,
        timeSlotId: testTimeSlotId,
        customerName: 'old-cancelled',
        customerPhone: '13000000001',
        status: AppointmentStatus.CANCELLED,
        cancelledAt: oldDate,
        updatedAt: oldDate,
      },
    });

    const completedOld = await prismaService.appointment.create({
      data: {
        appointmentNumber: createNumber(),
        userId: testUserId,
        appointmentDate,
        timeSlotId: testTimeSlotId,
        customerName: 'old-completed',
        customerPhone: '13000000002',
        status: AppointmentStatus.COMPLETED,
        completedAt: oldDate,
        updatedAt: oldDate,
      },
    });

    const cancelledRecent = await prismaService.appointment.create({
      data: {
        appointmentNumber: createNumber(),
        userId: testUserId,
        appointmentDate,
        timeSlotId: testTimeSlotId,
        customerName: 'recent-cancelled',
        customerPhone: '13000000003',
        status: AppointmentStatus.CANCELLED,
        cancelledAt: recentDate,
        updatedAt: recentDate,
      },
    });

    const pendingOld = await prismaService.appointment.create({
      data: {
        appointmentNumber: createNumber(),
        userId: testUserId,
        appointmentDate: pendingAppointmentDate,
        timeSlotId: testTimeSlotId,
        customerName: 'old-pending',
        customerPhone: '13000000004',
        status: AppointmentStatus.PENDING,
        updatedAt: oldDate,
      },
    });

    await prismaService.appointmentHistory.createMany({
      data: [
        { appointmentId: cancelledOld.id, action: 'CANCEL' },
        { appointmentId: completedOld.id, action: 'COMPLETE' },
        { appointmentId: cancelledRecent.id, action: 'CANCEL' },
      ],
    });

    await prismaService.notification.createMany({
      data: [
        {
          userId: testUserId,
          appointmentId: cancelledOld.id,
          type: 'PUSH',
          title: 'old-cancelled',
          content: 'old-cancelled',
          isRead: true,
        },
        {
          userId: testUserId,
          appointmentId: completedOld.id,
          type: 'PUSH',
          title: 'old-completed',
          content: 'old-completed',
          isRead: true,
        },
        {
          userId: testUserId,
          appointmentId: pendingOld.id,
          type: 'PUSH',
          title: 'old-pending',
          content: 'old-pending',
          isRead: true,
        },
      ],
    });

    const summary = await retentionService.runExecute();
    expect(summary.mode).toBe('execute');
    expect(summary.matchedAppointments).toBe(2);
    expect(summary.deletedAppointments).toBe(2);

    const remainingIds = (
      await prismaService.appointment.findMany({
        select: { id: true },
      })
    ).map((item) => item.id);

    expect(remainingIds).toContain(cancelledRecent.id);
    expect(remainingIds).toContain(pendingOld.id);
    expect(remainingIds).not.toContain(cancelledOld.id);
    expect(remainingIds).not.toContain(completedOld.id);

    const historyForDeleted = await prismaService.appointmentHistory.count({
      where: { appointmentId: { in: [cancelledOld.id, completedOld.id] } },
    });
    const notificationsForDeleted = await prismaService.notification.count({
      where: { appointmentId: { in: [cancelledOld.id, completedOld.id] } },
    });

    expect(historyForDeleted).toBe(0);
    expect(notificationsForDeleted).toBe(0);
  });

  it('dry-run does not delete records', async () => {
    await prismaService.appointment.deleteMany();

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 40);

    const candidate = await prismaService.appointment.create({
      data: {
        appointmentNumber: createNumber(),
        userId: testUserId,
        appointmentDate: new Date(),
        timeSlotId: testTimeSlotId,
        customerName: 'dry-run-candidate',
        customerPhone: '13000000005',
        status: AppointmentStatus.CANCELLED,
        cancelledAt: oldDate,
        updatedAt: oldDate,
      },
    });

    const summary = await retentionService.runDry();
    expect(summary.mode).toBe('dry-run');
    expect(summary.matchedAppointments).toBeGreaterThanOrEqual(1);
    expect(summary.deletedAppointments).toBe(0);

    const stillExists = await prismaService.appointment.findUnique({
      where: { id: candidate.id },
    });
    expect(stillExists).not.toBeNull();
  });
});
